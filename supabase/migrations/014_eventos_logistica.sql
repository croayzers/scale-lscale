-- 014_eventos_logistica.sql
-- Inventario dinámico por fechas + lógica de eventos (subalquiler, retorno express)

-- ── Campos nuevos en materiales ────────────────────────────────────────────
ALTER TABLE lscale.materiales
  ADD COLUMN IF NOT EXISTS coste_adquisicion   numeric,
  ADD COLUMN IF NOT EXISTS margen              numeric,
  ADD COLUMN IF NOT EXISTS pvp                 numeric,
  ADD COLUMN IF NOT EXISTS periodo_amortizacion_dias integer,
  ADD COLUMN IF NOT EXISTS tipo_activo         text NOT NULL DEFAULT 'propio';

-- coste_amortizacion_diario: calculado = coste_adquisicion / periodo_amortizacion_dias
ALTER TABLE lscale.materiales
  ADD COLUMN IF NOT EXISTS coste_amortizacion_diario numeric
  GENERATED ALWAYS AS (
    CASE WHEN periodo_amortizacion_dias > 0 AND coste_adquisicion IS NOT NULL
    THEN coste_adquisicion / periodo_amortizacion_dias
    ELSE NULL END
  ) STORED;

-- ── Tabla reservas_stock ────────────────────────────────────────────────────
-- pedido_id usa el mismo tipo que lscale.pedidos.id (bigint en producción)
CREATE TABLE IF NOT EXISTS lscale.reservas_stock (
  id              bigserial PRIMARY KEY,
  company_id      uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  pedido_id       bigint NOT NULL REFERENCES lscale.pedidos(id) ON DELETE CASCADE,
  material_id     bigint NOT NULL REFERENCES lscale.materiales(id) ON DELETE CASCADE,
  cantidad        numeric NOT NULL DEFAULT 0,
  fecha_inicio    date NOT NULL,
  fecha_fin       date NOT NULL,
  tipo_origen     text NOT NULL DEFAULT 'propio',
  proveedor_id    bigint REFERENCES lscale.proveedores(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE lscale.reservas_stock ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reservas_own" ON lscale.reservas_stock
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_reservas_company     ON lscale.reservas_stock(company_id);
CREATE INDEX IF NOT EXISTS idx_reservas_material    ON lscale.reservas_stock(material_id);
CREATE INDEX IF NOT EXISTS idx_reservas_pedido      ON lscale.reservas_stock(pedido_id);
CREATE INDEX IF NOT EXISTS idx_reservas_fechas      ON lscale.reservas_stock(fecha_inicio, fecha_fin);

-- ── Función: stock disponible para un rango de fechas ──────────────────────
CREATE OR REPLACE FUNCTION lscale.stock_disponible(
  p_material_id bigint,
  p_fecha_inicio date,
  p_fecha_fin    date,
  p_excluir_pedido bigint DEFAULT NULL
)
RETURNS numeric LANGUAGE sql STABLE AS $$
  SELECT COALESCE(m.stock_actual, 0)
       - COALESCE(
           (SELECT SUM(r.cantidad)
            FROM lscale.reservas_stock r
            WHERE r.material_id = p_material_id
              AND r.company_id  = m.company_id
              AND r.fecha_inicio <= p_fecha_fin
              AND r.fecha_fin   >= p_fecha_inicio
              AND (p_excluir_pedido IS NULL OR r.pedido_id <> p_excluir_pedido)
           ), 0
         )
  FROM lscale.materiales m
  WHERE m.id = p_material_id
$$;

-- ── Campos nuevos en pedidos (datos de evento) ─────────────────────────────
ALTER TABLE lscale.pedidos
  ADD COLUMN IF NOT EXISTS fecha_evento_inicio date,
  ADD COLUMN IF NOT EXISTS fecha_evento_fin    date,
  ADD COLUMN IF NOT EXISTS tipo_pedido         text NOT NULL DEFAULT 'estandar';

-- ── Tabla lineas_subalquiler ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lscale.lineas_subalquiler (
  id              bigserial PRIMARY KEY,
  company_id      uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  pedido_id       bigint NOT NULL REFERENCES lscale.pedidos(id) ON DELETE CASCADE,
  material_id     bigint REFERENCES lscale.materiales(id) ON DELETE SET NULL,
  nombre_material text NOT NULL,
  cantidad        numeric NOT NULL DEFAULT 0,
  cantidad_propia numeric NOT NULL DEFAULT 0,
  cantidad_sub    numeric NOT NULL DEFAULT 0,
  proveedor_id    bigint REFERENCES lscale.proveedores(id) ON DELETE SET NULL,
  coste_sub       numeric,
  coste_total_sub numeric,
  opcion_logistica text NOT NULL DEFAULT 'mixto',
  alerta_retorno  boolean NOT NULL DEFAULT false,
  notas           text,
  estado          text NOT NULL DEFAULT 'pendiente',
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE lscale.lineas_subalquiler ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subalquiler_own" ON lscale.lineas_subalquiler
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_subalquiler_company ON lscale.lineas_subalquiler(company_id);
CREATE INDEX IF NOT EXISTS idx_subalquiler_pedido  ON lscale.lineas_subalquiler(pedido_id);
