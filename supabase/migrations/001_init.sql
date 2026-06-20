-- ============================================================
-- L-Scale schema inicial
-- Ejecutar en Supabase SQL Editor (proyecto Scale compartido)
-- ============================================================

CREATE SCHEMA IF NOT EXISTS lscale;

-- ── empresa_config ─────────────────────────────────────────
-- Una fila por empresa contratada. datos_json guarda
-- preferencias: almacenes, vehículos, roles de importación.
CREATE TABLE IF NOT EXISTS lscale.empresa_config (
  company_id  uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  col_config  jsonb NOT NULL DEFAULT '{}',
  datos_json  jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE lscale.empresa_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "empresa_config_own" ON lscale.empresa_config
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
    )
  );

-- ── materiales ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lscale.materiales (
  id           bigserial PRIMARY KEY,
  company_id   uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  referencia   text,
  nombre       text NOT NULL,
  descripcion  text,
  categoria    text,
  unidad       text NOT NULL DEFAULT 'ud',
  stock_actual numeric NOT NULL DEFAULT 0,
  stock_minimo numeric NOT NULL DEFAULT 0,
  ubicacion    text,
  estado       text NOT NULL DEFAULT 'activo',
  proveedor    text,
  precio_coste numeric,
  notas        text,
  almacen_id   bigint,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE lscale.materiales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "materiales_own" ON lscale.materiales
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
    )
  );

-- ── pedidos ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lscale.pedidos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  codigo        text,
  nombre        text,
  fecha_pedido  date,
  fecha_entrega date,
  estado        text NOT NULL DEFAULT 'borrador',
  destino       text,
  notas         text,
  datos         jsonb NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE lscale.pedidos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pedidos_own" ON lscale.pedidos
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
    )
  );

-- ── expediciones ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lscale.expediciones (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  pedido_id      uuid REFERENCES lscale.pedidos(id) ON DELETE SET NULL,
  codigo         text,
  fecha_salida   date,
  fecha_retorno  date,
  estado         text NOT NULL DEFAULT 'preparando',
  destino        text,
  responsable    text,
  vehiculo       text,
  datos          jsonb NOT NULL DEFAULT '{}',
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE lscale.expediciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expediciones_own" ON lscale.expediciones
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
    )
  );

-- ── trigger updated_at ─────────────────────────────────────
CREATE OR REPLACE FUNCTION lscale.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_empresa_config_updated_at
  BEFORE UPDATE ON lscale.empresa_config
  FOR EACH ROW EXECUTE FUNCTION lscale.set_updated_at();
