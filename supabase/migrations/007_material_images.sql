-- ============================================================
-- L-Scale · Imágenes de materiales
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- 1. Columna en la tabla
ALTER TABLE lscale.materiales
  ADD COLUMN IF NOT EXISTS imagen_url text;

-- 2. Bucket de Storage (público — las URLs se muestran en un catálogo)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'material-images',
  'material-images',
  true,
  5242880,   -- 5 MB por imagen
  ARRAY['image/jpeg','image/png','image/webp','image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- 3. Políticas de Storage
-- Lectura: pública (catálogo web)
DROP POLICY IF EXISTS "material_images_public_read" ON storage.objects;
CREATE POLICY "material_images_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'material-images');

-- Subida: solo miembros de la empresa (carpeta = company_id)
DROP POLICY IF EXISTS "material_images_member_insert" ON storage.objects;
CREATE POLICY "material_images_member_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'material-images'
    AND (storage.foldername(name))[1] IN (
      SELECT company_id::text FROM public.company_members WHERE user_id = auth.uid()
    )
  );

-- Borrado: solo miembros de la empresa
DROP POLICY IF EXISTS "material_images_member_delete" ON storage.objects;
CREATE POLICY "material_images_member_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'material-images'
    AND (storage.foldername(name))[1] IN (
      SELECT company_id::text FROM public.company_members WHERE user_id = auth.uid()
    )
  );
