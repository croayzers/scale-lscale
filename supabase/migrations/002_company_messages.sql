-- Chat mensajes entre usuarios de la misma empresa
-- Ejecutar en Supabase SQL Editor (proyecto Scale)

CREATE TABLE IF NOT EXISTS public.company_messages (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  from_user_id  uuid        NOT NULL REFERENCES auth.users(id),
  to_user_id    uuid        NOT NULL REFERENCES auth.users(id),
  message       text        NOT NULL CHECK (char_length(message) BETWEEN 1 AND 4000),
  is_read       boolean     NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_company_messages_company
  ON public.company_messages(company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_company_messages_unread
  ON public.company_messages(to_user_id, is_read) WHERE is_read = false;

ALTER TABLE public.company_messages ENABLE ROW LEVEL SECURITY;

-- Miembros de la empresa pueden leer y escribir mensajes de su empresa
CREATE POLICY "company_messages_member" ON public.company_messages
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
    )
  );

-- Habilitar Realtime para actualizaciones en tiempo real
ALTER PUBLICATION supabase_realtime ADD TABLE public.company_messages;
