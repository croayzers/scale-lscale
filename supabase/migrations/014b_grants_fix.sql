-- 014b_grants_fix.sql — GRANTs para reservas_stock y lineas_subalquiler.
--
-- La migración 014 creó las tablas sin GRANTs → 403 (permission denied).
-- Mismo patrón que 009b/009c. Ejecutar en SQL Editor de Supabase (idempotente).

GRANT SELECT, INSERT, UPDATE, DELETE ON lscale.reservas_stock    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON lscale.lineas_subalquiler TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON lscale.reservas_stock    TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON lscale.lineas_subalquiler TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA lscale TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA lscale TO anon;
