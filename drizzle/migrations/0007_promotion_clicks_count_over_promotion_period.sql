-- Click counters now cover the promotion's own occupancy window (start_date -> end_date, Madrid time)
-- instead of a rolling last-7-days window. Row data in promotion_clicks is untouched.
DROP FUNCTION IF EXISTS public.get_promotion_click_counts();

CREATE FUNCTION public.get_promotion_click_counts()
RETURNS TABLE(promotion_id uuid, total bigint, in_period bigint, last_click timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    c.promotion_id,
    count(*),
    count(*) FILTER (
      WHERE c.created_at >= timezone('Europe/Madrid', p.start_date::timestamp)
        AND (p.end_date IS NULL OR c.created_at < timezone('Europe/Madrid', (p.end_date + 1)::timestamp))
    ),
    max(c.created_at)
  FROM public.promotion_clicks c
  JOIN public.promotions p ON p.id = c.promotion_id
  WHERE public.has_role(auth.uid(), 'admin')
  GROUP BY c.promotion_id, p.start_date, p.end_date
$$;
REVOKE ALL ON FUNCTION public.get_promotion_click_counts() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_promotion_click_counts() TO authenticated;
COMMENT ON FUNCTION public.get_promotion_click_counts() IS 'Admin-only click counters per promotion: total clicks, clicks during the promotion occupancy window (start_date..end_date in Europe/Madrid), and last click timestamp.';