CREATE TABLE public.school_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pax int,
  audience text,
  segment text,
  product text NOT NULL,
  amount numeric NOT NULL,
  sort int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT school_rates_product_check CHECK (product IN ('clase','bono_5h','bono_10h','campo','iniciacion')),
  CONSTRAINT school_rates_audience_check CHECK (audience IS NULL OR audience IN ('socio','no_socio')),
  CONSTRAINT school_rates_segment_check CHECK (segment IS NULL OR segment IN ('ninos','adultos')),
  CONSTRAINT school_rates_pax_check CHECK (pax IS NULL OR (pax BETWEEN 1 AND 4)),
  CONSTRAINT school_rates_amount_check CHECK (amount >= 0),
  CONSTRAINT school_rates_shape_check CHECK (
    (product IN ('clase','bono_5h','bono_10h','campo') AND pax IS NOT NULL AND audience IS NOT NULL AND segment IS NULL)
    OR (product = 'iniciacion' AND pax IS NULL AND audience IS NULL AND segment IS NOT NULL)
  )
);

CREATE UNIQUE INDEX school_rates_lesson_unique
  ON public.school_rates (product, pax, audience)
  WHERE product IN ('clase','bono_5h','bono_10h','campo');

CREATE UNIQUE INDEX school_rates_iniciacion_unique
  ON public.school_rates (product, segment)
  WHERE product = 'iniciacion';

GRANT SELECT ON public.school_rates TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_rates TO authenticated;
GRANT ALL ON public.school_rates TO service_role;

ALTER TABLE public.school_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School rates are publicly readable"
  ON public.school_rates FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admins can manage school rates"
  ON public.school_rates FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_school_rates_updated_at
  BEFORE UPDATE ON public.school_rates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();