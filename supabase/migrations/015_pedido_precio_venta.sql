-- 015_pedido_precio_venta.sql
-- Añade campos de precio de venta y margen a lscale.pedidos para analytics.

ALTER TABLE lscale.pedidos
  ADD COLUMN IF NOT EXISTS margen_venta  numeric,
  ADD COLUMN IF NOT EXISTS tipo_margen   text NOT NULL DEFAULT 'pct',
  ADD COLUMN IF NOT EXISTS precio_venta  numeric;

COMMENT ON COLUMN lscale.pedidos.margen_venta IS 'Valor del margen aplicado (% o € fijo según tipo_margen)';
COMMENT ON COLUMN lscale.pedidos.tipo_margen  IS 'Tipo de margen: pct (porcentaje) o fijo (€ fijo)';
COMMENT ON COLUMN lscale.pedidos.precio_venta IS 'Precio de venta calculado = coste + margen. Desnormalizado para analytics.';
