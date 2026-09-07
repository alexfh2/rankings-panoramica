ALTER TABLE public.rates
  ALTER COLUMN suffix TYPE jsonb
  USING CASE
    WHEN suffix IS NULL OR btrim(suffix) = '' THEN NULL
    ELSE jsonb_build_object('es', suffix)
  END;