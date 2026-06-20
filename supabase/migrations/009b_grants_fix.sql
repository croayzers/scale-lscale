-- 009b_grants_fix.sql — FIX del 403 en proveedores/correlaciones.
--
-- El 009 se ejecutó sin los GRANTs, por eso lscale.proveedores y
-- lscale.correlaciones devuelven 403 (permission denied) al rol authenticated.
-- Ejecuta SOLO esto en el SQL Editor de Supabase para arreglarlo (idempotente).

GRANT ALL ON lscale.proveedores   TO authenticated;
GRANT ALL ON lscale.correlaciones TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA lscale TO authenticated;
