-- 009_proveedores.sql — Proveedores y correlación de materiales por proveedor.
--
-- Modelo: la empresa tiene SUS materiales (lscale.materiales). Cada proveedor
-- llama a cada material de SU forma. La tabla `correlaciones` mapea:
--   material de la empresa  ↔  nombre que usa cada proveedor
-- Así, al pedir a un proveedor, la compra se traduce a sus nombres.
--
-- Ejecutar en el SQL Editor de Supabase (proyecto Scale).

-- ── proveedores ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lscale.proveedores (
  id          bigserial PRIMARY KEY,
  company_id  uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  nombre      text NOT NULL,
  contacto    text,
  color       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE lscale.proveedores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "proveedores_own" ON lscale.proveedores
  FOR ALL USING (
    company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())
  );

-- ── correlaciones ─────────────────────────────────────────
-- Una fila por (material de la empresa, proveedor). `nombre_proveedor` = cómo
-- llama ESE proveedor a ese material (lo que se envía en la compra).
CREATE TABLE IF NOT EXISTS lscale.correlaciones (
  id               bigserial PRIMARY KEY,
  company_id       uuid   NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  material_id      bigint NOT NULL REFERENCES lscale.materiales(id)  ON DELETE CASCADE,
  proveedor_id     bigint NOT NULL REFERENCES lscale.proveedores(id) ON DELETE CASCADE,
  nombre_proveedor text   NOT NULL,            -- nombre del material para ese proveedor
  referencia       text,                       -- ref/código del proveedor (opcional)
  coste            numeric,                     -- coste del proveedor (opcional)
  descuento        numeric,                     -- % descuento (opcional)
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (material_id, proveedor_id)
);
ALTER TABLE lscale.correlaciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "correlaciones_own" ON lscale.correlaciones
  FOR ALL USING (
    company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_correlaciones_material  ON lscale.correlaciones(material_id);
CREATE INDEX IF NOT EXISTS idx_correlaciones_proveedor ON lscale.correlaciones(proveedor_id);

-- ── GRANTS ────────────────────────────────────────────────
-- IMPRESCINDIBLE: sin esto las tablas dan 403 (permission denied) al rol
-- authenticated aunque la RLS esté bien. Mismo patrón que 004/005.
GRANT ALL ON lscale.proveedores   TO authenticated;
GRANT ALL ON lscale.correlaciones TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA lscale TO authenticated;
