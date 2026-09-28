-- Permite que fairwayPlayerId (vinculación explícita del administrador) apunte a un jugador
-- existente CON licencia cuando el archivo no la trae: se reutiliza por su licencia, sin modificarlo.
DO $mig$
DECLARE
  d text := pg_get_functiondef('public.import_pair_results_batch(uuid, text, jsonb)'::regprocedure);
  n text;
  o text;
BEGIN
  FOREACH n IN ARRAY ARRAY['1','2'] LOOP
    o := format($f$      IF v_fp_row.license IS NOT NULL OR NOT v_fp_row.license_exempt THEN
        RAISE EXCEPTION 'FAIRWAY_PLAYER_NOT_UNLICENSED: el jugador vinculat %% no és un jugador sense llicència', v_fp%s;
      END IF;$f$, n);
    IF position(o IN d) = 0 THEN RAISE EXCEPTION 'bloque fairwayPlayerId % no encontrado', n; END IF;
    d := replace(d, o, format($f$      -- Vinculació explícita a un jugador existent: amb llicència es reutilitza per la seva
      -- llicència (mateix players.id, sense modificar-lo); sense llicència, ha de ser exempt.
      IF v_fp_row.license IS NOT NULL THEN
        v_lic%1$s := v_fp_row.license;
        v_fp%1$s := NULL;
      ELSIF NOT v_fp_row.license_exempt THEN
        RAISE EXCEPTION 'FAIRWAY_PLAYER_NOT_UNLICENSED: el jugador vinculat %% no és un jugador sense llicència', v_fp%1$s;
      END IF;$f$, n));
  END LOOP;
  o := '    IF v_fp1 IS NOT NULL AND v_fp1 = v_fp2 THEN';
  IF position(o IN d) = 0 THEN RAISE EXCEPTION 'bloque duplicado no encontrado'; END IF;
  d := replace(d, o, E'    IF v_lic1 IS NOT NULL AND v_lic1 = v_lic2 THEN\n      RAISE EXCEPTION ''DUPLICATE_PLAYER_IN_PAIR: la parella #% repeteix el mateix jugador'', v_idx;\n    END IF;\n\n' || o);
  EXECUTE d;
END
$mig$;