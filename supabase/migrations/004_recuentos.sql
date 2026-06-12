-- ============================================================
-- 004_recuentos.sql — Sistema de recuentos físicos de almacén
-- ============================================================

-- ── Sesiones de recuento ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS lscale.recuento_sesiones (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id   uuid   NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  almacen_id   bigint,                              -- null = todos los almacenes
  nombre       text,                                -- "Recuento mayo 2026"
  estado       text   NOT NULL DEFAULT 'abierta',  -- abierta | cerrada | cancelada
  notas        text,
  creado_por   text,
  cerrado_por  text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  closed_at    timestamptz
);

-- ── Líneas de recuento (una por material) ────────────────────
CREATE TABLE IF NOT EXISTS lscale.recuento_lineas (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sesion_id          bigint NOT NULL REFERENCES lscale.recuento_sesiones(id) ON DELETE CASCADE,
  company_id         uuid   NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  material_id        bigint NOT NULL REFERENCES lscale.materiales(id) ON DELETE CASCADE,
  cantidad_sistema   numeric NOT NULL DEFAULT 0,
  cantidad_contada   numeric,                       -- null = no contado aún
  diferencia         numeric GENERATED ALWAYS AS (
                       COALESCE(cantidad_contada, cantidad_sistema) - cantidad_sistema
                     ) STORED,
  notas              text,
  contado_en         timestamptz,
  contado_por        text
);

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE lscale.recuento_sesiones ENABLE ROW LEVEL SECURITY;
ALTER TABLE lscale.recuento_lineas   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recuento_sesiones_own" ON lscale.recuento_sesiones
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "recuento_lineas_own" ON lscale.recuento_lineas
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
    )
  );

-- ── Permisos ─────────────────────────────────────────────────
GRANT ALL ON lscale.recuento_sesiones TO authenticated;
GRANT ALL ON lscale.recuento_lineas   TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA lscale TO authenticated;
