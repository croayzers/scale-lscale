-- 011_proveedor_items.sql — Catálogo COMPLETO de cada proveedor + enlace a la correlación.
--
-- Hasta ahora `correlaciones` solo guardaba los materiales que CASABAN con los
-- tuyos. Para poder correlacionar haciendo clic (elegir tu material y luego el
-- ítem equivalente de cada proveedor) necesitamos guardar el catálogo entero de
-- cada proveedor, casen o no con un material tuyo.
--
--   lscale.proveedor_items  →  una fila por ítem del Excel del proveedor
--                              (cómo lo llama él, su ref/categoría/coste/…).
--   correlaciones.proveedor_item_id  →  qué ítem del proveedor está enlazado a
--                              tu material (el `nombre_proveedor` se sigue
--                              copiando en correlaciones para que la compra se
--                              traduzca sin un join extra — carga selectiva).
--
-- Ejecutar en el SQL Editor de Supabase (proyecto Scale).

-- ── proveedor_items ───────────────────────────────────────
-- Catálogo del proveedor (todas las filas de su Excel). `datos` (jsonb) lleva
-- los campos flexibles que aporte su plantilla (igual que correlaciones.datos).
CREATE TABLE IF NOT EXISTS lscale.proveedor_items (
  id            bigserial PRIMARY KEY,
  company_id    uuid   NOT NULL REFERENCES public.companies(id)   ON DELETE CASCADE,
  proveedor_id  bigint NOT NULL REFERENCES lscale.proveedores(id) ON DELETE CASCADE,
  nombre        text   NOT NULL,              -- nombre del material para ese proveedor
  referencia    text,                         -- ref/código del proveedor
  categoria     text,                         -- categoría según el proveedor
  coste         numeric,                      -- coste del proveedor
  descuento     numeric,                      -- % descuento
  datos         jsonb  NOT NULL DEFAULT '{}'::jsonb,  -- campos extra de su plantilla
  created_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE lscale.proveedor_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "proveedor_items_own" ON lscale.proveedor_items
  FOR ALL USING (
    company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())
  );
CREATE INDEX IF NOT EXISTS idx_proveedor_items_proveedor ON lscale.proveedor_items(proveedor_id);

-- ── correlaciones.proveedor_item_id ───────────────────────
-- Enlace opcional al ítem del proveedor elegido en la correlación clic-a-clic.
-- ON DELETE SET NULL: si se reimporta el catálogo del proveedor y desaparece el
-- ítem, la correlación se mantiene (con su nombre_proveedor ya copiado).
ALTER TABLE lscale.correlaciones
  ADD COLUMN IF NOT EXISTS proveedor_item_id bigint
    REFERENCES lscale.proveedor_items(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_correlaciones_item ON lscale.correlaciones(proveedor_item_id);

-- ── GRANTS ────────────────────────────────────────────────
-- Imprescindible (mismo patrón que 009): sin esto da 403 al rol authenticated.
GRANT ALL ON lscale.proveedor_items TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA lscale TO authenticated;
