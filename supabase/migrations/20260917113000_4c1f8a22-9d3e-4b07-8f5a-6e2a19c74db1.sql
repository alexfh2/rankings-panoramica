-- ---------------------------------------------------------------------------
-- Tarifas: lectura pública de `rates` y corrección del texto del Golf Pass.
-- ---------------------------------------------------------------------------

-- 1. La web pública usa la columna `active` para OCULTAR la fila entera de una
--    tarifa desactivada desde el dashboard.
--
--    Con USING (active = true) esa fila nunca llega al navegador: la web no se
--    entera de que existe, aplica su regla de respaldo ("si no hay dato fiable,
--    deja lo que pone el HTML") y sigue publicando el precio antiguo. El
--    interruptor del dashboard deja de tener efecto en la web.
--
--    Con USING (true) la fila llega con active = false y la web la oculta.
--    `rates` no contiene nada sensible: son precios de servicios, todos
--    públicos. `school_rates` ya usa USING (true) desde su creación.
--
--    Las políticas de `news` NO se tocan: allí USING (published = true) sí
--    protege borradores sin publicar.

DROP POLICY IF EXISTS "Active rates are publicly readable" ON public.rates;

CREATE POLICY "Rates are publicly readable"
  ON public.rates FOR SELECT
  TO anon, authenticated
  USING (true);

-- 2. El green fee con Golf Pass es el 50% de la tarifa que corresponda a cada
--    día, no solo de lunes a viernes (confirmado por dirección deportiva).
--    Laborable 65 € -> 32,50 €. Festivo 89 € -> 44,50 €.
--
--    OJO: las dos cifras están escritas, no calculadas. Si cambia `gf_18`,
--    hay que revisar este texto a mano.

UPDATE public.rates
SET custom = jsonb_build_object(
      'es', '50% de la tarifa oficial · 32,50 € laboral / 44,50 € festivo',
      'en', '50% of the standard rate · €32.50 weekday / €44.50 weekend'
    )
WHERE code = 'golf_pass_green_fee';
