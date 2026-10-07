-- Ejecutar en Supabase SQL Editor. Requiere la función public.is_admin()
-- existente en Super Gol (misma fuente de rol que utiliza la aplicación).

CREATE TABLE IF NOT EXISTS public.lugar_fotos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL,
  storage_path TEXT NOT NULL UNIQUE,
  descripcion TEXT NOT NULL DEFAULT '',
  orden INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lugar_info (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  direccion TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.lugar_fotos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lugar_info ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lugar_fotos_read ON public.lugar_fotos;
CREATE POLICY lugar_fotos_read ON public.lugar_fotos
  FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS lugar_fotos_admin_insert ON public.lugar_fotos;
CREATE POLICY lugar_fotos_admin_insert ON public.lugar_fotos
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS lugar_fotos_admin_update ON public.lugar_fotos;
CREATE POLICY lugar_fotos_admin_update ON public.lugar_fotos
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS lugar_fotos_admin_delete ON public.lugar_fotos;
CREATE POLICY lugar_fotos_admin_delete ON public.lugar_fotos
  FOR DELETE TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS lugar_info_read ON public.lugar_info;
CREATE POLICY lugar_info_read ON public.lugar_info
  FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS lugar_info_admin_insert ON public.lugar_info;
CREATE POLICY lugar_info_admin_insert ON public.lugar_info
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS lugar_info_admin_update ON public.lugar_info;
CREATE POLICY lugar_info_admin_update ON public.lugar_info
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS lugar_info_admin_delete ON public.lugar_info;
CREATE POLICY lugar_info_admin_delete ON public.lugar_info
  FOR DELETE TO authenticated USING (public.is_admin());

GRANT SELECT ON public.lugar_fotos, public.lugar_info TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.lugar_fotos, public.lugar_info TO authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('lugar', 'lugar', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS lugar_storage_read ON storage.objects;
CREATE POLICY lugar_storage_read ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'lugar');
DROP POLICY IF EXISTS lugar_storage_admin_insert ON storage.objects;
CREATE POLICY lugar_storage_admin_insert ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'lugar' AND public.is_admin());
DROP POLICY IF EXISTS lugar_storage_admin_update ON storage.objects;
CREATE POLICY lugar_storage_admin_update ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'lugar' AND public.is_admin())
  WITH CHECK (bucket_id = 'lugar' AND public.is_admin());
DROP POLICY IF EXISTS lugar_storage_admin_delete ON storage.objects;
CREATE POLICY lugar_storage_admin_delete ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'lugar' AND public.is_admin());

GRANT SELECT ON storage.objects TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON storage.objects TO authenticated;
