-- ──────────────────────────────────────────────────────────────
-- 017_compra_proveedor.sql
-- Proveedor en la línea de compra: permite categorizar el historial de
-- compras por proveedor implicado (además del almacén ya existente).
-- Amplía 005/006. Idempotente. Ejecutar en el SQL Editor de Supabase.
-- ──────────────────────────────────────────────────────────────

-- A qué proveedor se le compró esa línea (NULL = compra sin proveedor / directa).
ALTER TABLE lscale.compra_lineas
  ADD COLUMN IF NOT EXISTS proveedor_id bigint REFERENCES lscale.proveedores(id) ON DELETE SET NULL;

-- Índice para filtrar el historial por proveedor.
CREATE INDEX IF NOT EXISTS idx_compra_lineas_proveedor ON lscale.compra_lineas(proveedor_id);
-- Índice por material para los sumatorios "todas las X en un rango".
CREATE INDEX IF NOT EXISTS idx_compra_lineas_material  ON lscale.compra_lineas(material_id);

-- Las compras viejas quedan con proveedor_id = NULL (no se infiere retroactivamente).
