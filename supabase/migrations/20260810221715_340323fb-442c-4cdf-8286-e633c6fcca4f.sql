-- 1) Defense in depth: only admins may set/change news_drafts.status (esp. 'published')
CREATE OR REPLACE FUNCTION public.enforce_news_status_admin_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status IS DISTINCT FROM 'draft' AND NOT public.has_role(auth.uid(), 'admin') THEN
      RAISE EXCEPTION 'Only admins can create news with a non-draft status';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can change the publication status of news';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_news_status_admin_only ON public.news_drafts;
CREATE TRIGGER enforce_news_status_admin_only
BEFORE INSERT OR UPDATE ON public.news_drafts
FOR EACH ROW EXECUTE FUNCTION public.enforce_news_status_admin_only();

-- 2) Explicit admin SELECT policy on pairs
DROP POLICY IF EXISTS "Admins can read all pairs" ON public.pairs;
CREATE POLICY "Admins can read all pairs"
ON public.pairs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));