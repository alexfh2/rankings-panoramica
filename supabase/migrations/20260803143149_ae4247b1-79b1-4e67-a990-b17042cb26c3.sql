CREATE OR REPLACE FUNCTION public.get_published_pair_player_names(p_competition_slug text)
RETURNS TABLE (player_id uuid, display_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT pl.id AS player_id, pl.name AS display_name
  FROM public.players pl
  JOIN public.pairs pa ON pl.id IN (pa.player_1_id, pa.player_2_id)
  JOIN public.competitions c ON c.id = pa.competition_id
  WHERE c.slug = p_competition_slug
    AND EXISTS (
      SELECT 1
      FROM public.pair_results pr
      JOIN public.rounds r ON r.id = pr.round_id
      WHERE pr.pair_id = pa.id
        AND r.status = 'published'
        AND r.competition_id = c.id
    );
$$;

REVOKE ALL ON FUNCTION public.get_published_pair_player_names(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_published_pair_player_names(text) TO anon, authenticated;