-- ──────────────────────────────────────────────────────────────
-- 006_compras_almacen.sql
-- Compras a fábrica por almacén + precio de venta del material.
-- Amplía 005_compras.sql. Idempotente. Ejecutar tras 005 si faltara.
-- ──────────────────────────────────────────────────────────────

-- Precio de VENTA del material (el coste ya existe como precio_coste).
ALTER TABLE lscale.materiales    ADD COLUMN IF NOT EXISTS precio       numeric;

-- La línea de compra registra a qué almacén repone y el coste unitario de esa compra.
ALTER TABLE lscale.compra_lineas ADD COLUMN IF NOT EXISTS almacen_id   bigint;
ALTER TABLE lscale.compra_lineas ADD COLUMN IF NOT EXISTS precio_coste numeric;

-- La compra guarda los nombres de los almacenes involucrados (CSV) para listado rápido.
ALTER TABLE lscale.compras       ADD COLUMN IF NOT EXISTS almacenes    text;
