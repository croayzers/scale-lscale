-- 013_indices_company.sql — Índices de rendimiento para L-Scale.
--
-- Auditoría 2026-06-21: todas las tablas de lscale tienen RLS correcta, pero las
-- que filtran por empresa NO tenían índice de company_id (las demás apps —pscale,
-- qscale, sscale— sí lo tienen). Cada query de L-Scale filtra por company_id; sin
-- índice escanea la tabla entera. Se añaden ahora que es barato (tablas pequeñas).
--
-- Índices compuestos donde la consulta típica lo aprovecha (company + fecha / FK),
-- imitando el patrón de qscale (el mejor indexado de la suite).
--
-- Idempotente (IF NOT EXISTS). Ejecutar en el SQL Editor de Supabase (proyecto Scale).

-- Materiales: se listan por empresa y por almacén.
CREATE INDEX IF NOT EXISTS idx_lsc_materiales_company   ON lscale.materiales   (company_id);
CREATE INDEX IF NOT EXISTS idx_lsc_materiales_almacen   ON lscale.materiales   (company_id, almacen_id);

-- Pedidos: por empresa y por fecha (Planning / Flota filtran por fecha_entrega).
CREATE INDEX IF NOT EXISTS idx_lsc_pedidos_company      ON lscale.pedidos      (company_id);
CREATE INDEX IF NOT EXISTS idx_lsc_pedidos_fecha        ON lscale.pedidos      (company_id, fecha_entrega);

-- Expediciones: por empresa y por su pedido.
CREATE INDEX IF NOT EXISTS idx_lsc_expediciones_company ON lscale.expediciones (company_id);
CREATE INDEX IF NOT EXISTS idx_lsc_expediciones_pedido  ON lscale.expediciones (pedido_id);

-- Movimientos de stock: por empresa y por material.
CREATE INDEX IF NOT EXISTS idx_lsc_movimientos_company  ON lscale.movimientos  (company_id);
CREATE INDEX IF NOT EXISTS idx_lsc_movimientos_material ON lscale.movimientos  (material_id);

-- Proveedores y su catálogo: company_id (proveedor_items ya tiene idx por proveedor).
CREATE INDEX IF NOT EXISTS idx_lsc_proveedores_company  ON lscale.proveedores      (company_id);
CREATE INDEX IF NOT EXISTS idx_lsc_proveedor_items_co   ON lscale.proveedor_items  (company_id);

-- Compras y líneas.
CREATE INDEX IF NOT EXISTS idx_lsc_compras_company      ON lscale.compras       (company_id);
CREATE INDEX IF NOT EXISTS idx_lsc_compra_lineas_compra ON lscale.compra_lineas (compra_id);

-- Recuentos de inventario.
CREATE INDEX IF NOT EXISTS idx_lsc_recuento_ses_company ON lscale.recuento_sesiones (company_id);
CREATE INDEX IF NOT EXISTS idx_lsc_recuento_lin_sesion  ON lscale.recuento_lineas   (sesion_id);
