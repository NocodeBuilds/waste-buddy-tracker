-- Photo evidence for waste entries
CREATE TABLE public.waste_entry_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  waste_entry_id UUID NOT NULL REFERENCES public.waste_entries(id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.waste_entry_photos TO authenticated;
GRANT ALL ON public.waste_entry_photos TO service_role;

ALTER TABLE public.waste_entry_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "site members read photos"
  ON public.waste_entry_photos FOR SELECT
  TO authenticated
  USING (public.has_site_access(auth.uid(), site_id));

CREATE POLICY "site members insert photos"
  ON public.waste_entry_photos FOR INSERT
  TO authenticated
  WITH CHECK (public.has_site_access(auth.uid(), site_id) AND uploaded_by = auth.uid());

CREATE POLICY "uploader or admin delete photos"
  ON public.waste_entry_photos FOR DELETE
  TO authenticated
  USING (uploaded_by = auth.uid() OR public.is_site_admin_or_manager(auth.uid(), site_id));

CREATE INDEX idx_waste_entry_photos_entry ON public.waste_entry_photos(waste_entry_id);

-- Storage policies: private bucket "waste-photos", path convention: <site_id>/<entry_id>/<uuid>.<ext>
CREATE POLICY "site members read waste photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'waste-photos'
    AND public.has_site_access(auth.uid(), (split_part(name, '/', 1))::uuid)
  );

CREATE POLICY "site members upload waste photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'waste-photos'
    AND public.has_site_access(auth.uid(), (split_part(name, '/', 1))::uuid)
    AND owner = auth.uid()
  );

CREATE POLICY "uploader or admin delete waste photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'waste-photos'
    AND (
      owner = auth.uid()
      OR public.is_site_admin_or_manager(auth.uid(), (split_part(name, '/', 1))::uuid)
    )
  );