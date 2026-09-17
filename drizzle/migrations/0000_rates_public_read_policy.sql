DROP POLICY IF EXISTS "Active rates are publicly readable" ON public.rates;

CREATE POLICY "Rates are publicly readable"
  ON public.rates
  FOR SELECT
  TO anon, authenticated
  USING (true);