-- ============================================================================
-- 016_erp_trazabilidad_financiero.sql
-- L-Scale → ERP logístico-financiero
--   · Trazabilidad: SKU inmutable, tipo de control (Serie / Lote-FIFO / PMP),
--     tablas lotes + unidades_serie.
--   · Líneas de pedido como tabla real (sustituye al jsonb pedidos.datos).
--   · Retornos como tabla real, con Estado_Recepcion y Responsable_Merma.
--   · Financiero: cargos_merma (cliente) + deudas_proveedor.
--   · Motores PL/pgSQL: line-splitting, valoración FIFO/PMP/Serie, disparadores
--     financieros de retorno. Outbox eventos_salientes para notificar.
--
-- ⚠️ En PRODUCCIÓN lscale.pedidos.id es BIGINT (confirmado por 014 + fix db9adb2).
--    Por eso TODAS las FK a pedidos son bigint, igual que reservas_stock.
-- ⚠️ Ejecutar manualmente en el SQL Editor de Supabase (proyecto Scale).
--    Idempotente: usa IF NOT EXISTS / OR REPLACE / DROP TRIGGER IF EXISTS.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- FASE 1.1 · Productos: SKU interno inmutable + tipo de trazabilidad
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE lscale.materiales
  ADD COLUMN IF NOT EXISTS sku_interno       text,
  ADD COLUMN IF NOT EXISTS tipo_trazabilidad text NOT NULL DEFAULT 'Consumible_PMP';

-- CHECK del enum (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_materiales_tipo_trazabilidad'
  ) THEN
    ALTER TABLE lscale.materiales
      ADD CONSTRAINT chk_materiales_tipo_trazabilidad
      CHECK (tipo_trazabilidad IN ('Serializado','Lotes_FIFO','Consumible_PMP'));
  END IF;
END$$;

-- Unicidad de SKU por empresa (solo cuando hay SKU)
CREATE UNIQUE INDEX IF NOT EXISTS uq_materiales_sku
  ON lscale.materiales(company_id, sku_interno)
  WHERE sku_interno IS NOT NULL;

-- Autogenerar SKU si llega nulo: LSC-<id> (correlativo del propio id)
CREATE OR REPLACE FUNCTION lscale.fn_autoset_sku()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.sku_interno IS NULL OR btrim(NEW.sku_interno) = '' THEN
    NEW.sku_interno := 'LSC-' || NEW.id::text;
  END IF;
  RETURN NEW;
END;
$$;

-- bigserial ya asignó NEW.id en BEFORE INSERT, así que podemos derivar de él
DROP TRIGGER IF EXISTS trg_autoset_sku ON lscale.materiales;
CREATE TRIGGER trg_autoset_sku
  BEFORE INSERT ON lscale.materiales
  FOR EACH ROW EXECUTE FUNCTION lscale.fn_autoset_sku();

-- Inmutabilidad: una vez fijado, sku_interno no cambia
CREATE OR REPLACE FUNCTION lscale.fn_sku_inmutable()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.sku_interno IS NOT NULL
     AND NEW.sku_interno IS DISTINCT FROM OLD.sku_interno THEN
    RAISE EXCEPTION 'El SKU interno (%) es inmutable y no puede modificarse', OLD.sku_interno;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sku_inmutable ON lscale.materiales;
CREATE TRIGGER trg_sku_inmutable
  BEFORE UPDATE ON lscale.materiales
  FOR EACH ROW EXECUTE FUNCTION lscale.fn_sku_inmutable();

-- ────────────────────────────────────────────────────────────────────────────
-- FASE 1.2 · Trazabilidad: lotes (FIFO/PMP) y unidades serializadas
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lscale.lotes (
  id                bigserial PRIMARY KEY,
  company_id        uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  material_id       bigint NOT NULL REFERENCES lscale.materiales(id) ON DELETE CASCADE,
  codigo_lote       text,
  fecha_entrada     timestamptz NOT NULL DEFAULT now(),   -- orden FIFO
  coste_unitario    numeric NOT NULL DEFAULT 0,           -- coste de adquisición de ESTE lote
  cantidad_inicial  numeric NOT NULL DEFAULT 0,
  cantidad_restante numeric NOT NULL DEFAULT 0,           -- se descuenta en salidas
  proveedor_id      bigint REFERENCES lscale.proveedores(id) ON DELETE SET NULL,
  factura_ref       text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE lscale.lotes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lotes_own" ON lscale.lotes;
CREATE POLICY "lotes_own" ON lscale.lotes
  FOR ALL USING (
    company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_lotes_company ON lscale.lotes(company_id);
CREATE INDEX IF NOT EXISTS idx_lotes_fifo
  ON lscale.lotes(material_id, fecha_entrada) WHERE cantidad_restante > 0;

CREATE TABLE IF NOT EXISTS lscale.unidades_serie (
  id                bigserial PRIMARY KEY,
  company_id        uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  material_id       bigint NOT NULL REFERENCES lscale.materiales(id) ON DELETE CASCADE,
  numero_serie      text NOT NULL,
  estado            text NOT NULL DEFAULT 'disponible',
  coste_adquisicion numeric,
  pedido_id         bigint REFERENCES lscale.pedidos(id) ON DELETE SET NULL,  -- dónde está ahora
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, material_id, numero_serie)
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_serie_estado') THEN
    ALTER TABLE lscale.unidades_serie
      ADD CONSTRAINT chk_serie_estado
      CHECK (estado IN ('disponible','en_uso','cuarentena','roto','perdido','baja'));
  END IF;
END$$;

ALTER TABLE lscale.unidades_serie ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "serie_own" ON lscale.unidades_serie;
CREATE POLICY "serie_own" ON lscale.unidades_serie
  FOR ALL USING (
    company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_serie_company  ON lscale.unidades_serie(company_id);
CREATE INDEX IF NOT EXISTS idx_serie_material ON lscale.unidades_serie(material_id, estado);

-- Recalcular stock_actual (caché) como suma derivada de lotes/series por material.
-- Para materiales PMP/FIFO: suma cantidad_restante de lotes.
-- Para Serializado: cuenta unidades en estado disponible|en_uso.
-- Si el material no tiene lotes ni series (legacy), NO toca stock_actual.
CREATE OR REPLACE FUNCTION lscale.fn_recalc_stock(p_material_id bigint)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_tipo  text;
  v_total numeric;
  v_tiene boolean;
BEGIN
  SELECT tipo_trazabilidad INTO v_tipo FROM lscale.materiales WHERE id = p_material_id;
  IF v_tipo = 'Serializado' THEN
    SELECT count(*) INTO v_total FROM lscale.unidades_serie
      WHERE material_id = p_material_id AND estado IN ('disponible','en_uso','cuarentena');
    SELECT EXISTS(SELECT 1 FROM lscale.unidades_serie WHERE material_id = p_material_id) INTO v_tiene;
  ELSE
    SELECT COALESCE(SUM(cantidad_restante),0) INTO v_total FROM lscale.lotes
      WHERE material_id = p_material_id;
    SELECT EXISTS(SELECT 1 FROM lscale.lotes WHERE material_id = p_material_id) INTO v_tiene;
  END IF;
  IF v_tiene THEN
    UPDATE lscale.materiales SET stock_actual = v_total WHERE id = p_material_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION lscale.fn_trg_recalc_stock()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  PERFORM lscale.fn_recalc_stock(COALESCE(NEW.material_id, OLD.material_id));
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_recalc_stock_lotes ON lscale.lotes;
CREATE TRIGGER trg_recalc_stock_lotes
  AFTER INSERT OR UPDATE OR DELETE ON lscale.lotes
  FOR EACH ROW EXECUTE FUNCTION lscale.fn_trg_recalc_stock();

DROP TRIGGER IF EXISTS trg_recalc_stock_serie ON lscale.unidades_serie;
CREATE TRIGGER trg_recalc_stock_serie
  AFTER INSERT OR UPDATE OR DELETE ON lscale.unidades_serie
  FOR EACH ROW EXECUTE FUNCTION lscale.fn_trg_recalc_stock();

-- ────────────────────────────────────────────────────────────────────────────
-- FASE 1.3 · Líneas de pedido (tabla real, sustituye el array jsonb)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lscale.lineas_pedido (
  id                bigserial PRIMARY KEY,
  company_id        uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  pedido_id         bigint NOT NULL REFERENCES lscale.pedidos(id) ON DELETE CASCADE,
  material_id       bigint REFERENCES lscale.materiales(id) ON DELETE SET NULL,
  nombre            text NOT NULL,             -- snapshot
  categoria         text,
  unidad            text DEFAULT 'ud',
  cantidad          numeric NOT NULL DEFAULT 0,
  -- ── Núcleo del split híbrido ──
  origen_coste      text NOT NULL DEFAULT 'Almacen_Propio',
  id_origen_stock   bigint,                    -- FK polimórfica: lote.id | serie.id | factura proveedor
  tipo_origen_stock text,                      -- discrimina id_origen_stock
  proveedor_id      bigint REFERENCES lscale.proveedores(id) ON DELETE SET NULL,
  coste_unitario    numeric,
  coste_total       numeric,
  estado_linea      text NOT NULL DEFAULT 'planificada',
  grupo_split       uuid,                      -- agrupa las 2+ líneas de una sola petición
  datos             jsonb NOT NULL DEFAULT '{}',
  created_at        timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_linped_origen_coste') THEN
    ALTER TABLE lscale.lineas_pedido ADD CONSTRAINT chk_linped_origen_coste
      CHECK (origen_coste IN ('Almacen_Propio','Alquiler_Proveedor'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_linped_tipo_origen') THEN
    ALTER TABLE lscale.lineas_pedido ADD CONSTRAINT chk_linped_tipo_origen
      CHECK (tipo_origen_stock IS NULL OR tipo_origen_stock IN ('lote','serie','factura_proveedor'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_linped_estado') THEN
    ALTER TABLE lscale.lineas_pedido ADD CONSTRAINT chk_linped_estado
      CHECK (estado_linea IN ('planificada','pendiente_proveedor','confirmada','retornada'));
  END IF;
END$$;

ALTER TABLE lscale.lineas_pedido ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lineas_pedido_own" ON lscale.lineas_pedido;
CREATE POLICY "lineas_pedido_own" ON lscale.lineas_pedido
  FOR ALL USING (
    company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_lineas_pedido_pedido  ON lscale.lineas_pedido(pedido_id);
CREATE INDEX IF NOT EXISTS idx_lineas_pedido_company ON lscale.lineas_pedido(company_id);

-- ────────────────────────────────────────────────────────────────────────────
-- FASE 1.4 · Retornos (tabla real)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lscale.retornos (
  id                bigserial PRIMARY KEY,
  company_id        uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  pedido_id         bigint NOT NULL REFERENCES lscale.pedidos(id) ON DELETE CASCADE,
  linea_pedido_id   bigint REFERENCES lscale.lineas_pedido(id) ON DELETE SET NULL,
  material_id       bigint REFERENCES lscale.materiales(id) ON DELETE SET NULL,
  cantidad          numeric NOT NULL DEFAULT 0,
  estado_recepcion  text NOT NULL DEFAULT 'Apto',
  responsable_merma text,
  origen_coste      text,                      -- copiado de la línea para el disparador
  proveedor_id      bigint REFERENCES lscale.proveedores(id) ON DELETE SET NULL,
  notas             text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_retornos_estado_rec') THEN
    ALTER TABLE lscale.retornos ADD CONSTRAINT chk_retornos_estado_rec
      CHECK (estado_recepcion IN ('Apto','Cuarentena','Roto','Perdido'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_retornos_responsable') THEN
    ALTER TABLE lscale.retornos ADD CONSTRAINT chk_retornos_responsable
      CHECK (responsable_merma IS NULL OR responsable_merma IN ('Cliente','Proveedor','Almacen'));
  END IF;
END$$;

ALTER TABLE lscale.retornos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "retornos_own" ON lscale.retornos;
CREATE POLICY "retornos_own" ON lscale.retornos
  FOR ALL USING (
    company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_retornos_company ON lscale.retornos(company_id);
CREATE INDEX IF NOT EXISTS idx_retornos_pedido  ON lscale.retornos(pedido_id);

-- ────────────────────────────────────────────────────────────────────────────
-- FASE 1.5 · Financiero: cargos al cliente + deudas con proveedor
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lscale.cargos_merma (
  id          bigserial PRIMARY KEY,
  company_id  uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  retorno_id  bigint REFERENCES lscale.retornos(id) ON DELETE SET NULL,
  pedido_id   bigint REFERENCES lscale.pedidos(id) ON DELETE SET NULL,
  material_id bigint REFERENCES lscale.materiales(id) ON DELETE SET NULL,
  concepto    text NOT NULL,                  -- 'rotura' | 'perdida'
  importe     numeric NOT NULL DEFAULT 0,
  estado      text NOT NULL DEFAULT 'pendiente',
  created_at  timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_cargos_estado') THEN
    ALTER TABLE lscale.cargos_merma ADD CONSTRAINT chk_cargos_estado
      CHECK (estado IN ('pendiente','facturado','cobrado','anulado'));
  END IF;
END$$;

ALTER TABLE lscale.cargos_merma ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cargos_merma_own" ON lscale.cargos_merma;
CREATE POLICY "cargos_merma_own" ON lscale.cargos_merma
  FOR ALL USING (
    company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_cargos_company ON lscale.cargos_merma(company_id);
CREATE INDEX IF NOT EXISTS idx_cargos_pedido  ON lscale.cargos_merma(pedido_id);

CREATE TABLE IF NOT EXISTS lscale.deudas_proveedor (
  id           bigserial PRIMARY KEY,
  company_id   uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  proveedor_id bigint NOT NULL REFERENCES lscale.proveedores(id) ON DELETE CASCADE,
  retorno_id   bigint REFERENCES lscale.retornos(id) ON DELETE SET NULL,
  material_id  bigint REFERENCES lscale.materiales(id) ON DELETE SET NULL,
  concepto     text NOT NULL,
  importe      numeric NOT NULL DEFAULT 0,
  estado       text NOT NULL DEFAULT 'pendiente',
  created_at   timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_deudas_estado') THEN
    ALTER TABLE lscale.deudas_proveedor ADD CONSTRAINT chk_deudas_estado
      CHECK (estado IN ('pendiente','pagado','anulado'));
  END IF;
END$$;

ALTER TABLE lscale.deudas_proveedor ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deudas_proveedor_own" ON lscale.deudas_proveedor;
CREATE POLICY "deudas_proveedor_own" ON lscale.deudas_proveedor
  FOR ALL USING (
    company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_deudas_company   ON lscale.deudas_proveedor(company_id);
CREATE INDEX IF NOT EXISTS idx_deudas_proveedor ON lscale.deudas_proveedor(proveedor_id);

-- ────────────────────────────────────────────────────────────────────────────
-- FASE 1.6 · Outbox de eventos (notificaciones diferidas vía Worker)
-- Postgres no hace HTTP saliente sin pg_net: dejamos el evento en cola y la SPA
-- (o un cron) lo drena hacia Scale_Notifications.
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lscale.eventos_salientes (
  id          bigserial PRIMARY KEY,
  company_id  uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  tipo        text NOT NULL,                  -- 'merma_propia' | 'merma_alquiler'
  payload     jsonb NOT NULL DEFAULT '{}',
  estado      text NOT NULL DEFAULT 'pendiente',  -- pendiente | enviado | error
  created_at  timestamptz NOT NULL DEFAULT now(),
  sent_at     timestamptz
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_eventos_estado') THEN
    ALTER TABLE lscale.eventos_salientes ADD CONSTRAINT chk_eventos_estado
      CHECK (estado IN ('pendiente','enviado','error'));
  END IF;
END$$;

ALTER TABLE lscale.eventos_salientes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "eventos_salientes_own" ON lscale.eventos_salientes;
CREATE POLICY "eventos_salientes_own" ON lscale.eventos_salientes
  FOR ALL USING (
    company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_eventos_pendientes
  ON lscale.eventos_salientes(company_id, estado) WHERE estado = 'pendiente';

-- ============================================================================
-- FASE 2 · MOTORES
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 2.1 · Motor de Line Splitting
-- Crea 1 línea (todo propio) o 2 líneas (propio + alquiler) según disponibilidad
-- por fechas. Devuelve el conjunto de líneas creadas.
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION lscale.fn_split_linea(
  p_pedido_id   bigint,
  p_material_id bigint,
  p_cantidad    numeric,
  p_nombre      text DEFAULT NULL,
  p_categoria   text DEFAULT NULL,
  p_unidad      text DEFAULT 'ud'
)
RETURNS SETOF lscale.lineas_pedido
LANGUAGE plpgsql AS $$
DECLARE
  v_company        uuid;
  v_mat            lscale.materiales%ROWTYPE;
  v_fi             date;
  v_ff             date;
  v_dias           integer;
  v_disponible     numeric;
  v_cant_propia    numeric;
  v_cant_alquiler  numeric;
  v_grupo          uuid := gen_random_uuid();
  v_prov_id        bigint;
  v_prov_coste     numeric;
  v_principal_id   bigint;
  v_coste_propio_u numeric;
  v_nombre         text;
  v_cat            text;
BEGIN
  -- Material + empresa
  SELECT * INTO v_mat FROM lscale.materiales WHERE id = p_material_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Material % no existe', p_material_id;
  END IF;
  v_company := v_mat.company_id;
  v_nombre  := COALESCE(p_nombre, v_mat.nombre);
  v_cat     := COALESCE(p_categoria, v_mat.categoria);

  -- Fechas del pedido: evento si las tiene, si no fecha_entrega (1 día)
  SELECT COALESCE(fecha_evento_inicio, fecha_entrega, CURRENT_DATE),
         COALESCE(fecha_evento_fin, fecha_evento_inicio, fecha_entrega, CURRENT_DATE)
    INTO v_fi, v_ff
  FROM lscale.pedidos WHERE id = p_pedido_id;
  v_dias := GREATEST(1, (v_ff - v_fi) + 1);

  -- Disponibilidad por fechas (reusa función de la migración 014)
  v_disponible := COALESCE(
    lscale.stock_disponible(p_material_id, v_fi, v_ff, p_pedido_id), 0);
  v_disponible := GREATEST(0, v_disponible);

  v_cant_propia   := LEAST(p_cantidad, v_disponible);
  v_cant_alquiler := GREATEST(0, p_cantidad - v_disponible);

  -- Coste unitario propio = amortización diaria × días (si no hay, cae a precio_coste)
  v_coste_propio_u := COALESCE(v_mat.coste_amortizacion_diario * v_dias, v_mat.precio_coste, 0);

  -- ── Línea propia ──
  IF v_cant_propia > 0 THEN
    RETURN QUERY
    INSERT INTO lscale.lineas_pedido(
      company_id, pedido_id, material_id, nombre, categoria, unidad, cantidad,
      origen_coste, proveedor_id, coste_unitario, coste_total, estado_linea,
      grupo_split
    ) VALUES (
      v_company, p_pedido_id, p_material_id, v_nombre, v_cat, p_unidad, v_cant_propia,
      'Almacen_Propio', NULL, v_coste_propio_u, v_coste_propio_u * v_cant_propia,
      'planificada', v_grupo
    ) RETURNING *;
  END IF;

  -- ── Línea de alquiler (si hay faltante) ──
  IF v_cant_alquiler > 0 THEN
    -- Proveedor principal de la empresa (de empresa_config.datos_json)
    SELECT NULLIF(datos_json->>'proveedor_principal_id','')::bigint
      INTO v_principal_id
    FROM lscale.empresa_config WHERE company_id = v_company;

    -- 1) ¿El principal tiene este material en catálogo?
    IF v_principal_id IS NOT NULL THEN
      SELECT c.proveedor_id, c.coste INTO v_prov_id, v_prov_coste
      FROM lscale.correlaciones c
      WHERE c.material_id = p_material_id AND c.proveedor_id = v_principal_id
      LIMIT 1;
    END IF;

    -- 2) Si no, la correlación más barata
    IF v_prov_id IS NULL THEN
      SELECT c.proveedor_id, c.coste INTO v_prov_id, v_prov_coste
      FROM lscale.correlaciones c
      WHERE c.material_id = p_material_id AND c.coste IS NOT NULL
      ORDER BY c.coste ASC
      LIMIT 1;
    END IF;

    RETURN QUERY
    INSERT INTO lscale.lineas_pedido(
      company_id, pedido_id, material_id, nombre, categoria, unidad, cantidad,
      origen_coste, tipo_origen_stock, proveedor_id, coste_unitario, coste_total,
      estado_linea, grupo_split
    ) VALUES (
      v_company, p_pedido_id, p_material_id, v_nombre, v_cat, p_unidad, v_cant_alquiler,
      'Alquiler_Proveedor', 'factura_proveedor', v_prov_id,
      v_prov_coste, COALESCE(v_prov_coste,0) * v_cant_alquiler,
      CASE WHEN v_prov_id IS NULL THEN 'pendiente_proveedor' ELSE 'planificada' END,
      v_grupo
    ) RETURNING *;
  END IF;

  RETURN;
END;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 2.2 · Motor de Valoración de salida (FIFO / PMP / Serializado)
-- Descuenta stock real y devuelve el coste de la salida.
-- Para Serializado se exige p_series (array de números de serie).
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION lscale.fn_valorar_salida(
  p_material_id bigint,
  p_cantidad    numeric,
  p_series      text[] DEFAULT NULL
)
RETURNS numeric
LANGUAGE plpgsql AS $$
DECLARE
  v_tipo      text;
  v_coste     numeric := 0;
  v_restante  numeric := p_cantidad;
  v_lote      record;
  v_toma      numeric;
  v_pmp       numeric;
  v_serie     text;
  v_cu        numeric;
BEGIN
  SELECT tipo_trazabilidad INTO v_tipo FROM lscale.materiales WHERE id = p_material_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Material % no existe', p_material_id;
  END IF;

  IF v_tipo = 'Serializado' THEN
    IF p_series IS NULL OR array_length(p_series,1) IS NULL THEN
      RAISE EXCEPTION 'Material serializado: se requieren los números de serie';
    END IF;
    FOREACH v_serie IN ARRAY p_series LOOP
      SELECT coste_adquisicion INTO v_cu
      FROM lscale.unidades_serie
      WHERE material_id = p_material_id AND numero_serie = v_serie
        AND estado = 'disponible'
      FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Unidad serie % no disponible para material %', v_serie, p_material_id;
      END IF;
      UPDATE lscale.unidades_serie SET estado = 'en_uso'
        WHERE material_id = p_material_id AND numero_serie = v_serie;
      v_coste := v_coste + COALESCE(v_cu, 0);
    END LOOP;
    RETURN v_coste;

  ELSIF v_tipo = 'Lotes_FIFO' THEN
    FOR v_lote IN
      SELECT * FROM lscale.lotes
      WHERE material_id = p_material_id AND cantidad_restante > 0
      ORDER BY fecha_entrada ASC, id ASC
      FOR UPDATE
    LOOP
      EXIT WHEN v_restante <= 0;
      v_toma := LEAST(v_restante, v_lote.cantidad_restante);
      UPDATE lscale.lotes SET cantidad_restante = cantidad_restante - v_toma
        WHERE id = v_lote.id;
      v_coste    := v_coste + v_toma * v_lote.coste_unitario;
      v_restante := v_restante - v_toma;
    END LOOP;
    IF v_restante > 0 THEN
      RAISE EXCEPTION 'Stock FIFO insuficiente para material % (faltan %)', p_material_id, v_restante;
    END IF;
    RETURN v_coste;

  ELSE  -- Consumible_PMP
    SELECT CASE WHEN SUM(cantidad_restante) > 0
                THEN SUM(cantidad_restante * coste_unitario) / SUM(cantidad_restante)
                ELSE 0 END
      INTO v_pmp
    FROM lscale.lotes WHERE material_id = p_material_id AND cantidad_restante > 0;
    -- Descuento proporcional sobre los lotes con resto
    FOR v_lote IN
      SELECT * FROM lscale.lotes
      WHERE material_id = p_material_id AND cantidad_restante > 0
      ORDER BY fecha_entrada ASC, id ASC
      FOR UPDATE
    LOOP
      EXIT WHEN v_restante <= 0;
      v_toma := LEAST(v_restante, v_lote.cantidad_restante);
      UPDATE lscale.lotes SET cantidad_restante = cantidad_restante - v_toma
        WHERE id = v_lote.id;
      v_restante := v_restante - v_toma;
    END LOOP;
    RETURN p_cantidad * COALESCE(v_pmp, 0);
  END IF;
END;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 2.3 · Disparadores Financieros de Retorno
-- AFTER INSERT/UPDATE en retornos: si Roto/Perdido genera cargos/deudas + evento.
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION lscale.fn_disparador_retorno()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_origen        text;
  v_coste_unit    numeric;
  v_importe       numeric;
  v_concepto      text;
  v_prov_id       bigint;
  v_pmp           numeric;
BEGIN
  -- Solo mermas reales
  IF NEW.estado_recepcion NOT IN ('Roto','Perdido') THEN
    RETURN NEW;
  END IF;

  v_concepto := CASE WHEN NEW.estado_recepcion = 'Roto' THEN 'rotura' ELSE 'perdida' END;

  -- Origen del coste: el de la línea, o el copiado en el retorno
  v_origen := COALESCE(
    NEW.origen_coste,
    (SELECT origen_coste FROM lscale.lineas_pedido WHERE id = NEW.linea_pedido_id),
    'Almacen_Propio'
  );

  -- Coste unitario de reposición del material
  SELECT COALESCE(coste_adquisicion, precio_coste, 0) INTO v_coste_unit
  FROM lscale.materiales WHERE id = NEW.material_id;
  -- Si es PMP y hay lotes, usar PMP como valor del activo
  SELECT CASE WHEN SUM(cantidad_restante) > 0
              THEN SUM(cantidad_restante*coste_unitario)/SUM(cantidad_restante)
              ELSE NULL END
    INTO v_pmp
  FROM lscale.lotes WHERE material_id = NEW.material_id AND cantidad_restante > 0;
  v_coste_unit := COALESCE(v_pmp, v_coste_unit);
  v_importe    := COALESCE(v_coste_unit,0) * COALESCE(NEW.cantidad,0);

  IF v_origen = 'Almacen_Propio' THEN
    -- Cargo al cliente
    INSERT INTO lscale.cargos_merma(company_id, retorno_id, pedido_id, material_id, concepto, importe)
    VALUES (NEW.company_id, NEW.id, NEW.pedido_id, NEW.material_id, v_concepto, v_importe);

    -- Baja de activo: serie → baja; lotes → descuenta cantidad
    UPDATE lscale.unidades_serie SET estado = 'baja'
      WHERE id = (SELECT id_origen_stock FROM lscale.lineas_pedido
                  WHERE id = NEW.linea_pedido_id AND tipo_origen_stock = 'serie')
        AND material_id = NEW.material_id;
    -- Para lotes/PMP, descontar del lote más antiguo con resto
    UPDATE lscale.lotes SET cantidad_restante = GREATEST(0, cantidad_restante - NEW.cantidad)
      WHERE id = (
        SELECT id FROM lscale.lotes
        WHERE material_id = NEW.material_id AND cantidad_restante > 0
        ORDER BY fecha_entrada ASC, id ASC LIMIT 1
      );

    INSERT INTO lscale.eventos_salientes(company_id, tipo, payload)
    VALUES (NEW.company_id, 'merma_propia', jsonb_build_object(
      'retorno_id', NEW.id, 'pedido_id', NEW.pedido_id, 'material_id', NEW.material_id,
      'estado', NEW.estado_recepcion, 'responsable', NEW.responsable_merma, 'importe', v_importe
    ));

  ELSE  -- Alquiler_Proveedor
    v_prov_id := COALESCE(
      NEW.proveedor_id,
      (SELECT proveedor_id FROM lscale.lineas_pedido WHERE id = NEW.linea_pedido_id)
    );

    -- Deuda con el proveedor (valor de reposición)
    IF v_prov_id IS NOT NULL THEN
      INSERT INTO lscale.deudas_proveedor(company_id, proveedor_id, retorno_id, material_id, concepto, importe)
      VALUES (NEW.company_id, v_prov_id, NEW.id, NEW.material_id, v_concepto, v_importe);
    END IF;

    -- Cargo al cliente (se factura igualmente)
    INSERT INTO lscale.cargos_merma(company_id, retorno_id, pedido_id, material_id, concepto, importe)
    VALUES (NEW.company_id, NEW.id, NEW.pedido_id, NEW.material_id, v_concepto, v_importe);

    INSERT INTO lscale.eventos_salientes(company_id, tipo, payload)
    VALUES (NEW.company_id, 'merma_alquiler', jsonb_build_object(
      'retorno_id', NEW.id, 'pedido_id', NEW.pedido_id, 'material_id', NEW.material_id,
      'proveedor_id', v_prov_id, 'estado', NEW.estado_recepcion,
      'responsable', NEW.responsable_merma, 'importe', v_importe
    ));
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_disparador_retorno ON lscale.retornos;
CREATE TRIGGER trg_disparador_retorno
  AFTER INSERT OR UPDATE OF estado_recepcion ON lscale.retornos
  FOR EACH ROW EXECUTE FUNCTION lscale.fn_disparador_retorno();

-- ============================================================================
-- GRANTS (mismo patrón que migraciones previas: 014b/009b)
-- ============================================================================
GRANT USAGE ON SCHEMA lscale TO anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  lscale.lotes, lscale.unidades_serie, lscale.lineas_pedido, lscale.retornos,
  lscale.cargos_merma, lscale.deudas_proveedor, lscale.eventos_salientes
  TO authenticated, anon;

GRANT ALL ON ALL SEQUENCES IN SCHEMA lscale TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA lscale TO anon;

-- Funciones invocables como RPC
GRANT EXECUTE ON FUNCTION lscale.fn_split_linea(bigint,bigint,numeric,text,text,text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION lscale.fn_valorar_salida(bigint,numeric,text[])           TO authenticated, anon;

-- ============================================================================
-- FIN 016
-- ============================================================================
