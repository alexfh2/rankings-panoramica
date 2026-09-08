CREATE TABLE public.news_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  news_id uuid NOT NULL REFERENCES public.news(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  image_url text NOT NULL,
  sort integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX news_images_news_id_sort_idx ON public.news_images (news_id, sort);

GRANT SELECT ON public.news_images TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.news_images TO authenticated;
GRANT ALL ON public.news_images TO service_role;

ALTER TABLE public.news_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published news images are publicly readable"
ON public.news_images FOR SELECT TO anon, authenticated
USING (EXISTS (SELECT 1 FROM public.news n WHERE n.id = news_images.news_id AND n.published = true));

CREATE POLICY "Admins can read all news images"
ON public.news_images FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage news images"
ON public.news_images FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));