-- ──────────────────────────────────────────────────────────────
-- 005_compras.sql
-- Historial de compras de reposición (originadas desde Cesta)
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS lscale.compras (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id   uuid   NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  fecha        timestamptz NOT NULL DEFAULT now(),
  notas        text,
  creado_por   text
);

CREATE TABLE IF NOT EXISTS lscale.compra_lineas (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  compra_id    bigint NOT NULL REFERENCES lscale.compras(id) ON DELETE CASCADE,
  company_id   uuid   NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  material_id  bigint REFERENCES lscale.materiales(id) ON DELETE SET NULL,
  nombre       text   NOT NULL,
  cantidad     numeric NOT NULL DEFAULT 0,
  unidad       text   DEFAULT 'ud'
);

ALTER TABLE lscale.compras       ENABLE ROW LEVEL SECURITY;
ALTER TABLE lscale.compra_lineas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "compras_own" ON lscale.compras FOR ALL USING (
  company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())
);
CREATE POLICY "compra_lineas_own" ON lscale.compra_lineas FOR ALL USING (
  company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())
);

GRANT ALL ON lscale.compras       TO authenticated;
GRANT ALL ON lscale.compra_lineas TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA lscale TO authenticated;
