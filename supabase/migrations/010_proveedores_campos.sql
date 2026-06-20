-- 010_proveedores_campos.sql — campos flexibles por proveedor.
--
-- Cada proveedor tiene SUS propias columnas (uno aporta Categoría, otro
-- Descuento, etc.). Para no añadir una columna por cada posible campo:
--   · proveedores.plantilla (jsonb): mapeo de columnas del Excel del proveedor
--     (qué columna es Nombre/Categoría/Referencia/Coste/Descuento/…) + qué
--     campos incluir al exportar. Se reusa en cada import de ese proveedor.
--   · correlaciones.datos (jsonb): valores de esos campos para ese material
--     según ese proveedor (p.ej. { "categoria": "Mobiliario", "coste": 12.5 }).
-- Las columnas referencia/coste/descuento del 009 se mantienen por compat;
-- los campos nuevos (categoria, etc.) viven en `datos`.
--
-- Ejecutar en el SQL Editor de Supabase (proyecto Scale).

ALTER TABLE lscale.proveedores   ADD COLUMN IF NOT EXISTS plantilla jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE lscale.correlaciones ADD COLUMN IF NOT EXISTS datos     jsonb NOT NULL DEFAULT '{}'::jsonb;

-- (los grants del 009 ya cubren estas tablas)
