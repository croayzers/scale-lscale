-- ============================================================
-- L-Scale — Migración correctiva (003)
-- Aplica sobre el schema original de 01_lscale.sql.
-- Es idempotente: seguro de ejecutar varias veces.
-- ============================================================

-- ── 1. Añadir datos_json a empresa_config (estaba ausente) ──
ALTER TABLE lscale.empresa_config
  ADD COLUMN IF NOT EXISTS datos_json  jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS updated_at  timestamptz NOT NULL DEFAULT now();

-- Migrar datos existentes: si col_config tiene prefs, copiarlos a datos_json
UPDATE lscale.empresa_config
   SET datos_json = col_config
 WHERE datos_json = '{}' AND col_config != '{}';

-- ── 2. Columnas faltantes en materiales ──────────────────────
ALTER TABLE lscale.materiales
  ADD COLUMN IF NOT EXISTS almacen_id bigint;

-- ── 3. Columnas faltantes en pedidos ─────────────────────────
ALTER TABLE lscale.pedidos
  ADD COLUMN IF NOT EXISTS creado_por_id     text,
  ADD COLUMN IF NOT EXISTS creado_por_nombre text,
  ADD COLUMN IF NOT EXISTS vistos_por        jsonb NOT NULL DEFAULT '[]';

-- ── 4. Permisos de escritura para authenticated ───────────────
-- (el schema original solo concedía SELECT)
GRANT INSERT, UPDATE, DELETE ON ALL TABLES    IN SCHEMA lscale TO authenticated;
GRANT USAGE                  ON ALL SEQUENCES IN SCHEMA lscale TO authenticated;

-- ── 5. Políticas de escritura (las originales eran FOR SELECT) ─
-- empresa_config
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'lscale' AND tablename = 'empresa_config'
       AND cmd IN ('INSERT','UPDATE','DELETE','ALL')
  ) THEN
    CREATE POLICY "empresa_config_write" ON lscale.empresa_config
      FOR ALL
      USING      (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()))
      WITH CHECK (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));
  END IF;
END $$;

-- materiales
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'lscale' AND tablename = 'materiales'
       AND cmd IN ('INSERT','UPDATE','DELETE','ALL')
  ) THEN
    CREATE POLICY "materiales_write" ON lscale.materiales
      FOR ALL
      USING      (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()))
      WITH CHECK (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));
  END IF;
END $$;

-- pedidos
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'lscale' AND tablename = 'pedidos'
       AND cmd IN ('INSERT','UPDATE','DELETE','ALL')
  ) THEN
    CREATE POLICY "pedidos_write" ON lscale.pedidos
      FOR ALL
      USING      (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()))
      WITH CHECK (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));
  END IF;
END $$;

-- expediciones
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'lscale' AND tablename = 'expediciones'
       AND cmd IN ('INSERT','UPDATE','DELETE','ALL')
  ) THEN
    CREATE POLICY "expediciones_write" ON lscale.expediciones
      FOR ALL
      USING      (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()))
      WITH CHECK (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));
  END IF;
END $$;

-- ── 6. Trigger updated_at en empresa_config ─────────────────
CREATE OR REPLACE FUNCTION lscale.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
     WHERE tgname = 'trg_empresa_config_updated_at'
  ) THEN
    CREATE TRIGGER trg_empresa_config_updated_at
      BEFORE UPDATE ON lscale.empresa_config
      FOR EACH ROW EXECUTE FUNCTION lscale.set_updated_at();
  END IF;
END $$;
