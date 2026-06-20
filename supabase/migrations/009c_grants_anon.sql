-- 009c_grants_anon.sql — iguala los grants a las tablas que SÍ funcionan.
--
-- Diagnóstico: lscale.materiales responde 200 al rol `anon` (RLS lo protege),
-- pero lscale.proveedores/correlaciones daban 401 a `anon`. La app usa el rol
-- `authenticated`, así que con el 009b ya deberían funcionar logueado; esto
-- añade `anon` para igualar el comportamiento del resto de tablas lscale y
-- evitar 403 si la sesión cae a anon. La RLS sigue impidiendo ver datos de
-- otras empresas — anon no pertenece a ninguna company_member, ve [].
--
-- Ejecutar en el SQL Editor de Supabase (idempotente).

GRANT SELECT, INSERT, UPDATE, DELETE ON lscale.proveedores   TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON lscale.correlaciones TO anon;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA lscale TO anon;
