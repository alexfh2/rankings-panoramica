ALTER TABLE public.promotions
  ADD COLUMN cta_type text NOT NULL DEFAULT 'none';

ALTER TABLE public.promotions
  ADD CONSTRAINT promotions_cta_type_check
  CHECK (cta_type IN ('none', 'web', 'email', 'phone'));

COMMENT ON COLUMN public.promotions.cta_type IS 'Call to action sobre la imagen: none (sin botón), web (usa link_url), email (mailto golf@panoramicagrupo.com), phone (tel +34 964 49 30 72). Lo renderiza panoramicaclubdegolf.com.';