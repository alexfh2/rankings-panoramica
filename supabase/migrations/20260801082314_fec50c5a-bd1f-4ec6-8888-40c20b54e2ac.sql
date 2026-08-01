CREATE TABLE public.pairs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  pair_key text NOT NULL,
  player_1_id uuid NOT NULL REFERENCES public.players(id) ON DELETE RESTRICT,
  player_2_id uuid NOT NULL REFERENCES public.players(id) ON DELETE RESTRICT,
  first_round_id uuid NULL REFERENCES public.rounds(id) ON DELETE SET NULL,
  initial_pair_handicap numeric,
  fixed_category public.player_category NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pairs_competition_pair_key_unique UNIQUE (competition_id, pair_key),
  CONSTRAINT pairs_distinct_players CHECK (player_1_id <> player_2_id),
  CONSTRAINT pairs_pair_key_not_blank CHECK (length(trim(pair_key)) > 0)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pairs TO authenticated;
GRANT SELECT ON public.pairs TO anon;
GRANT ALL ON public.pairs TO service_role;

ALTER TABLE public.pairs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage pairs"
  ON public.pairs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.pair_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pair_id uuid NOT NULL REFERENCES public.pairs(id) ON DELETE CASCADE,
  round_id uuid NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
  position integer NULL,
  gross_points integer NULL,
  net_points integer NOT NULL,
  pair_handicap numeric,
  player_1_exact_handicap numeric,
  player_2_exact_handicap numeric,
  player_1_playing_handicap numeric,
  player_2_playing_handicap numeric,
  player_1_scorecard jsonb NOT NULL DEFAULT '{}'::jsonb,
  player_2_scorecard jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pair_results_round_pair_unique UNIQUE (round_id, pair_id),
  CONSTRAINT pair_results_position_positive CHECK (position IS NULL OR position > 0),
  CONSTRAINT pair_results_net_points_non_negative CHECK (net_points >= 0),
  CONSTRAINT pair_results_gross_points_non_negative CHECK (gross_points IS NULL OR gross_points >= 0)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pair_results TO authenticated;
GRANT SELECT ON public.pair_results TO anon;
GRANT ALL ON public.pair_results TO service_role;

ALTER TABLE public.pair_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage pair results"
  ON public.pair_results FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Published round pair results are publicly readable"
  ON public.pair_results FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.rounds r
    WHERE r.id = pair_results.round_id
      AND r.status = 'published'::round_status
  ));

CREATE POLICY "Pairs of published rounds are publicly readable"
  ON public.pairs FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1
    FROM public.pair_results pr
    JOIN public.rounds r ON r.id = pr.round_id
    WHERE pr.pair_id = pairs.id
      AND r.status = 'published'::round_status
  ));

CREATE INDEX idx_pairs_competition_id ON public.pairs(competition_id);
CREATE INDEX idx_pairs_player_1_id ON public.pairs(player_1_id);
CREATE INDEX idx_pairs_player_2_id ON public.pairs(player_2_id);
CREATE INDEX idx_pairs_first_round_id ON public.pairs(first_round_id);
CREATE INDEX idx_pair_results_pair_id ON public.pair_results(pair_id);
CREATE INDEX idx_pair_results_round_id ON public.pair_results(round_id);

CREATE TRIGGER update_pairs_updated_at
  BEFORE UPDATE ON public.pairs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pair_results_updated_at
  BEFORE UPDATE ON public.pair_results
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();