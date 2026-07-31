-- 1. Enum de formato
DO $$ BEGIN
  CREATE TYPE public.competition_format AS ENUM ('individual', 'pairs');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Tabla competitions
CREATE TABLE IF NOT EXISTS public.competitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id uuid NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  format public.competition_format NOT NULL,
  rules_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_competitions_season_id ON public.competitions(season_id);

GRANT SELECT ON public.competitions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.competitions TO authenticated;
GRANT ALL ON public.competitions TO service_role;

ALTER TABLE public.competitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Competitions are publicly readable"
  ON public.competitions FOR SELECT USING (true);

CREATE POLICY "Admins can manage competitions"
  ON public.competitions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS update_competitions_updated_at ON public.competitions;
CREATE TRIGGER update_competitions_updated_at
  BEFORE UPDATE ON public.competitions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Temporada 2026 (idempotente, sin tocar el unique de year)
INSERT INTO public.seasons (year, active, rules_config)
VALUES (2026, true, '{}'::jsonb)
ON CONFLICT (year) DO NOTHING;

-- 4. Tres competiciones idempotentes por slug
INSERT INTO public.competitions (season_id, name, slug, format, rules_config, active)
SELECT s.id, v.name, v.slug, v.format::public.competition_format, v.rules_config::jsonb, true
FROM public.seasons s
CROSS JOIN (VALUES
  ('Orden del Mérito Individual 2026', 'individual-2026', 'individual',
   '{"best_n_scores":7,"scheduled_rounds":8,"category_threshold":15.4,"categories":["hcp_low","hcp_high","scratch"],"lock_category_on_first_result":true,"tiebreakers":["rounds_played","last_3_calendar_points","lowest_handicap"]}'),
  ('Orden del Mérito de Parejas 2026', 'parejas-2026', 'pairs',
   '{"best_n_scores":6,"scheduled_rounds":8,"category_threshold":15.4,"pair_handicap_method":"half_sum","categories":["hcp_low","hcp_high"],"lock_category_on_first_result":true,"tiebreakers":["rounds_played","last_3_calendar_points","lowest_pair_handicap"]}'),
  ('Liga de Verano 2026', 'verano-2026', 'individual',
   '{"best_n_scores":4,"scheduled_rounds":5,"category_threshold":16.4,"categories":["hcp_low","hcp_high"],"lock_category_on_first_result":true,"tiebreakers":["rounds_played","lowest_handicap"]}')
) AS v(name, slug, format, rules_config)
WHERE s.year = 2026
ON CONFLICT (slug) DO NOTHING;

-- 5. rounds: competition_id obligatorio y nuevo unique
ALTER TABLE public.rounds
  ADD COLUMN competition_id uuid NOT NULL
  REFERENCES public.competitions(id) ON DELETE RESTRICT;

ALTER TABLE public.rounds
  DROP CONSTRAINT IF EXISTS rounds_season_id_round_number_key;

ALTER TABLE public.rounds
  ADD CONSTRAINT rounds_competition_id_round_number_key UNIQUE (competition_id, round_number);

CREATE INDEX IF NOT EXISTS idx_rounds_competition_id ON public.rounds(competition_id);