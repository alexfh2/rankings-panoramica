CREATE TABLE public.promotion_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id uuid NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
  cta_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX promotion_clicks_promo_idx ON public.promotion_clicks(promotion_id, created_at);
GRANT SELECT ON public.promotion_clicks TO authenticated;
GRANT ALL ON public.promotion_clicks TO service_role;
ALTER TABLE public.promotion_clicks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read promotion clicks" ON public.promotion_clicks FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.get_promotion_click_counts()
RETURNS TABLE(promotion_id uuid, total bigint, last_7d bigint, last_click timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.promotion_id, count(*), count(*) FILTER (WHERE c.created_at > now() - interval '7 days'), max(c.created_at)
  FROM public.promotion_clicks c
  WHERE public.has_role(auth.uid(), 'admin')
  GROUP BY c.promotion_id
$$;
REVOKE ALL ON FUNCTION public.get_promotion_click_counts() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_promotion_click_counts() TO authenticated;