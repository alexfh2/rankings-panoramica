CREATE TABLE public.rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  "group" text NOT NULL,
  sort integer NOT NULL DEFAULT 0,
  label jsonb NOT NULL DEFAULT '{}'::jsonb,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  custom jsonb NOT NULL DEFAULT '{}'::jsonb,
  amount numeric,
  amount_alt numeric,
  suffix text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.rates TO anon;
GRANT SELECT ON public.rates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rates TO authenticated;
GRANT ALL ON public.rates TO service_role;

ALTER TABLE public.rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage rates"
  ON public.rates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Active rates are publicly readable"
  ON public.rates FOR SELECT TO anon, authenticated
  USING (active = true);

CREATE TRIGGER update_rates_updated_at
  BEFORE UPDATE ON public.rates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();