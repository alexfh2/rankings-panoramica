CREATE TABLE public.promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  active boolean NOT NULL DEFAULT false,
  start_date date NOT NULL,
  end_date date NULL,
  image_desktop_url text NULL,
  image_mobile_url text NULL,
  image_desktop_url_en text NULL,
  image_mobile_url_en text NULL,
  image_desktop_url_fr text NULL,
  image_mobile_url_fr text NULL,
  link_url text NULL,
  alt jsonb NULL,
  sort integer NOT NULL DEFAULT 0,
  images_purged_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT promotions_es_image_required CHECK (
    images_purged_at IS NOT NULL OR image_desktop_url IS NOT NULL OR image_mobile_url IS NOT NULL
  ),
  CONSTRAINT promotions_dates_order CHECK (end_date IS NULL OR end_date >= start_date)
);

GRANT SELECT ON public.promotions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.promotions TO authenticated;
GRANT ALL ON public.promotions TO service_role;

ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Current promotions are publicly readable"
ON public.promotions FOR SELECT TO anon, authenticated
USING (
  active = true
  AND start_date <= (now() AT TIME ZONE 'Europe/Madrid')::date
  AND (end_date IS NULL OR end_date >= (now() AT TIME ZONE 'Europe/Madrid')::date)
);

CREATE POLICY "Admins can read all promotions"
ON public.promotions FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage promotions"
ON public.promotions FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX promotions_dates_idx ON public.promotions (active, start_date, end_date);

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;