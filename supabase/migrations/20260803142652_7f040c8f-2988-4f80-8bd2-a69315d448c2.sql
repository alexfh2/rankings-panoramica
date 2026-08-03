CREATE OR REPLACE FUNCTION public.strip_pair_scorecard_identifiers()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.player_1_scorecard IS NOT NULL THEN
    NEW.player_1_scorecard := (NEW.player_1_scorecard - 'licenseRaw' - 'licenseNormalized' - 'license');
  END IF;
  IF NEW.player_2_scorecard IS NOT NULL THEN
    NEW.player_2_scorecard := (NEW.player_2_scorecard - 'licenseRaw' - 'licenseNormalized' - 'license');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS strip_pair_scorecard_identifiers_trg ON public.pair_results;
CREATE TRIGGER strip_pair_scorecard_identifiers_trg
BEFORE INSERT OR UPDATE ON public.pair_results
FOR EACH ROW EXECUTE FUNCTION public.strip_pair_scorecard_identifiers();

UPDATE public.pair_results
SET player_1_scorecard = (player_1_scorecard - 'licenseRaw' - 'licenseNormalized' - 'license'),
    player_2_scorecard = (player_2_scorecard - 'licenseRaw' - 'licenseNormalized' - 'license')
WHERE player_1_scorecard ?| ARRAY['licenseRaw','licenseNormalized','license']
   OR player_2_scorecard ?| ARRAY['licenseRaw','licenseNormalized','license'];