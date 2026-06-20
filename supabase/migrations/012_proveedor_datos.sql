-- 012_proveedor_datos.sql — Datos de contacto/fiscales del proveedor (opcionales).
--
-- Se guardan en una columna jsonb `datos` para no añadir muchas columnas sueltas.
-- Campos esperados (todos opcionales): cif, persona, telefono, email, direccion, web, notas.
-- Se usan en la cabecera del PDF/Excel de pedido a proveedor (destinatario).
--
-- Ejecutar en el SQL Editor de Supabase (proyecto Scale).

ALTER TABLE lscale.proveedores
  ADD COLUMN IF NOT EXISTS datos jsonb NOT NULL DEFAULT '{}'::jsonb;
