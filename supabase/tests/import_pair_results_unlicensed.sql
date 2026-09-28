-- Tests de import_pair_results_batch para jugadores sin licencia.
-- Se ejecuta como un único bloque DO que termina SIEMPRE con RAISE EXCEPTION,
-- de modo que todos los cambios se deshacen (no deja datos en la base).
-- Requiere: un admin en user_roles y una jornada de una competición de parejas.
DO $$
DECLARE
  v_admin uuid := (SELECT user_id FROM public.user_roles WHERE role = 'admin' LIMIT 1);
  v_round uuid := (SELECT r.id FROM public.rounds r JOIN public.competitions c ON c.id = r.competition_id
                   WHERE c.format = 'pairs' ORDER BY r.date DESC LIMIT 1);
  v_comp uuid;
  v_sc jsonb := (SELECT jsonb_agg(4) FROM generate_series(1, 18));
  v_res jsonb;
  v_report text := '';
  v_id_a uuid; v_id_x uuid; v_id_y uuid; v_n int; v_key text; v_pair uuid;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  SELECT competition_id INTO v_comp FROM public.rounds WHERE id = v_round;

  -- helper inline: jsonb de jugador
  CREATE TEMP TABLE _t(name text, ok boolean, info text) ON COMMIT DROP;

  -- 1. licencia vacía sin confirmación -> MISSING_LICENSE
  BEGIN
    PERFORM public.import_pair_results_batch(v_round, 't', jsonb_build_array(jsonb_build_object('netPoints', 40,
      'player1', jsonb_build_object('name','T SIN LIC','licenseRaw',null,'exactHandicap',10,'scores',v_sc),
      'player2', jsonb_build_object('name','T FED','licenseRaw','ZZ00000001','exactHandicap',10,'scores',v_sc))));
    INSERT INTO _t VALUES ('01 sin confirmación bloquea', false, 'no bloqueó');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO _t VALUES ('01 sin confirmación bloquea', SQLERRM LIKE 'MISSING_LICENSE%', SQLERRM);
  END;

  -- 15. noLicenseConfirmed false / string "true" no sirven
  BEGIN
    PERFORM public.import_pair_results_batch(v_round, 't', jsonb_build_array(jsonb_build_object('netPoints', 40,
      'player1', jsonb_build_object('name','T SIN LIC','noLicenseConfirmed',false,'exactHandicap',10,'scores',v_sc),
      'player2', jsonb_build_object('name','T FED','licenseRaw','ZZ00000001','exactHandicap',10,'scores',v_sc))));
    INSERT INTO _t VALUES ('15a confirmed=false bloquea', false, 'no bloqueó');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO _t VALUES ('15a confirmed=false bloquea', SQLERRM LIKE 'MISSING_LICENSE%', SQLERRM);
  END;
  BEGIN
    PERFORM public.import_pair_results_batch(v_round, 't', jsonb_build_array(jsonb_build_object('netPoints', 40,
      'player1', jsonb_build_object('name','T SIN LIC','noLicenseConfirmed','true','exactHandicap',10,'scores',v_sc),
      'player2', jsonb_build_object('name','T FED','licenseRaw','ZZ00000001','exactHandicap',10,'scores',v_sc))));
    INSERT INTO _t VALUES ('15b confirmed="true" texto bloquea', false, 'no bloqueó');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO _t VALUES ('15b confirmed="true" texto bloquea', SQLERRM LIKE 'MISSING_LICENSE%', SQLERRM);
  END;

  -- 2 + 8. confirmación crea jugador license NULL / exempt; pair_key ID:<uuid>|LIC
  v_res := public.import_pair_results_batch(v_round, 't', jsonb_build_array(jsonb_build_object('netPoints', 40,
      'player1', jsonb_build_object('name','T GREZES','noLicenseConfirmed',true,'exactHandicap',10,'scores',v_sc),
      'player2', jsonb_build_object('name','T FED','licenseRaw','ZZ00000001','exactHandicap',12,'scores',v_sc))));
  SELECT id INTO v_id_a FROM public.players WHERE name = 'T GREZES';
  INSERT INTO _t SELECT '02 crea sin licencia', license IS NULL AND license_exempt, coalesce(license,'NULL')
    FROM public.players WHERE id = v_id_a;
  SELECT pair_key, id INTO v_key, v_pair FROM public.pairs WHERE competition_id = v_comp AND v_id_a IN (player_1_id, player_2_id);
  INSERT INTO _t VALUES ('08 pair_key licencia+ID', v_key = 'ID:' || v_id_a || '|ZZ00000001', v_key);

  -- 9 + 11. orden inverso + vinculado -> misma pareja, mismo key
  v_res := public.import_pair_results_batch(v_round, 't', jsonb_build_array(jsonb_build_object('netPoints', 41,
      'player1', jsonb_build_object('name','T FED','licenseRaw','ZZ00000001','exactHandicap',12,'scores',v_sc),
      'player2', jsonb_build_object('name','T GREZES','noLicenseConfirmed',true,'fairwayPlayerId',v_id_a,'exactHandicap',10,'scores',v_sc))));
  INSERT INTO _t VALUES ('03 fairwayPlayerId reutiliza', (v_res->>'playersCreated')::int = 0, v_res::text);
  SELECT count(*) INTO v_n FROM public.pairs WHERE competition_id = v_comp AND v_id_a IN (player_1_id, player_2_id);
  INSERT INTO _t VALUES ('09/11 orden inverso = misma pareja', v_n = 1 AND (v_res->>'pairsReused')::int = 1, 'pairs=' || v_n);

  -- 4. fairwayPlayerId inexistente
  BEGIN
    PERFORM public.import_pair_results_batch(v_round, 't', jsonb_build_array(jsonb_build_object('netPoints', 40,
      'player1', jsonb_build_object('name','X','noLicenseConfirmed',true,'fairwayPlayerId',gen_random_uuid(),'exactHandicap',10,'scores',v_sc),
      'player2', jsonb_build_object('name','T FED2','licenseRaw','ZZ00000002','exactHandicap',10,'scores',v_sc))));
    INSERT INTO _t VALUES ('04 id inexistente', false, 'no bloqueó');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO _t VALUES ('04 id inexistente', SQLERRM LIKE 'FAIRWAY_PLAYER_NOT_FOUND%', SQLERRM);
  END;

  -- 5. fairwayPlayerId de jugador CON licencia (caso Barros / Confalonieri):
  --    reutiliza el federado, no lo modifica, no crea jugador ni pareja nuevos.
  v_res := public.import_pair_results_batch(v_round, 't', jsonb_build_array(jsonb_build_object('netPoints', 50,
      'pairKey','ZZ00000010|ZZ00000011',
      'player1', jsonb_build_object('name','T CONFALONIERI, ERNESTO','licenseRaw','ZZ00000011','exactHandicap',18,'scores',v_sc),
      'player2', jsonb_build_object('name','T BARROS BALAGUER, JORGE','licenseRaw','ZZ00000010','exactHandicap',16,'scores',v_sc))));
  SELECT id INTO v_id_x FROM public.players WHERE license = 'ZZ00000010';
  SELECT id INTO v_id_y FROM public.players WHERE license = 'ZZ00000011';
  v_res := public.import_pair_results_batch(v_round, 't', jsonb_build_array(jsonb_build_object('netPoints', 39,
      'player1', jsonb_build_object('name','T BARROS, JORGE','noLicenseConfirmed',true,'fairwayPlayerId',v_id_x,'exactHandicap',16,'scores',v_sc),
      'player2', jsonb_build_object('name','T CONFALONIERI, ERNESTO','licenseRaw','ZZ00000011','exactHandicap',18,'scores',v_sc))));
  INSERT INTO _t VALUES ('05a id con licencia reutiliza federado',
    (v_res->>'playersCreated')::int = 0 AND (v_res->>'pairsReused')::int = 1, v_res::text);
  SELECT count(*) INTO v_n FROM public.players WHERE name LIKE 'T BARROS%';
  INSERT INTO _t VALUES ('05b no crea segundo jugador', v_n = 1, 'jugadores=' || v_n);
  INSERT INTO _t VALUES ('05c federado conserva licencia y nombre',
    EXISTS (SELECT 1 FROM public.players WHERE id = v_id_x AND license = 'ZZ00000010'
            AND NOT license_exempt AND name = 'T BARROS BALAGUER, JORGE'), v_id_x::text);
  SELECT count(*) INTO v_n FROM public.pairs WHERE competition_id = v_comp
    AND v_id_x IN (player_1_id, player_2_id) AND v_id_y IN (player_1_id, player_2_id);
  INSERT INTO _t VALUES ('05d no crea segunda pareja', v_n = 1, 'parejas=' || v_n);

  -- 5e. fairwayPlayerId con licencia + misma licencia en el otro jugador -> duplicado
  BEGIN
    PERFORM public.import_pair_results_batch(v_round, 't', jsonb_build_array(jsonb_build_object('netPoints', 40,
      'player1', jsonb_build_object('name','X','noLicenseConfirmed',true,'fairwayPlayerId',v_id_x,'exactHandicap',10,'scores',v_sc),
      'player2', jsonb_build_object('name','Y','licenseRaw','ZZ00000010','exactHandicap',10,'scores',v_sc))));
    INSERT INTO _t VALUES ('05e mismo jugador dos veces', false, 'no bloqueó');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO _t VALUES ('05e mismo jugador dos veces', SQLERRM LIKE 'DUPLICATE_PLAYER_IN_PAIR%', SQLERRM);
  END;

  -- 6 + 10. mismo nombre sin vincular -> jugador nuevo distinto; dos sin licencia -> pareja válida
  v_res := public.import_pair_results_batch(v_round, 't', jsonb_build_array(jsonb_build_object('netPoints', 30,
      'player1', jsonb_build_object('name','T GREZES','noLicenseConfirmed',true,'exactHandicap',20,'scores',v_sc),
      'player2', jsonb_build_object('name','T INVITADO','noLicenseConfirmed',true,'exactHandicap',22,'scores',v_sc))));
  SELECT count(*) INTO v_n FROM public.players WHERE name = 'T GREZES';
  INSERT INTO _t VALUES ('06 mismo nombre no fusiona', v_n = 2, 'jugadores=' || v_n);
  SELECT pair_key INTO v_key FROM public.pairs p JOIN public.players a ON a.id = p.player_1_id JOIN public.players b ON b.id = p.player_2_id
   WHERE p.competition_id = v_comp AND a.license IS NULL AND b.license IS NULL LIMIT 1;
  INSERT INTO _t VALUES ('10 dos sin licencia', v_key ~ '^ID:[0-9a-f-]{36}\|ID:[0-9a-f-]{36}$', coalesce(v_key,'null'));

  -- 12. licencia añadida después -> se localiza por players.id, no se duplica
  UPDATE public.players SET license = 'ZZ00000999', license_exempt = false WHERE id = v_id_a;
  v_res := public.import_pair_results_batch(v_round, 't', jsonb_build_array(jsonb_build_object('netPoints', 42,
      'player1', jsonb_build_object('name','T GREZES','licenseRaw','ZZ00000999','exactHandicap',10,'scores',v_sc),
      'player2', jsonb_build_object('name','T FED','licenseRaw','ZZ00000001','exactHandicap',12,'scores',v_sc))));
  SELECT count(*) INTO v_n FROM public.pairs WHERE competition_id = v_comp AND v_id_a IN (player_1_id, player_2_id);
  INSERT INTO _t VALUES ('12 licencia posterior no duplica', v_n = 1 AND (v_res->>'pairsReused')::int = 1, v_res::text);

  -- 7. federados: comportamiento actual
  v_res := public.import_pair_results_batch(v_round, 't', jsonb_build_array(jsonb_build_object('netPoints', 35,
      'pairKey','ZZ00000003|ZZ00000004',
      'player1', jsonb_build_object('name','T F4','licenseRaw','zz-00000004','exactHandicap',5,'scores',v_sc),
      'player2', jsonb_build_object('name','T F3','licenseRaw','ZZ00000003','exactHandicap',6,'scores',v_sc))));
  SELECT pair_key INTO v_key FROM public.pairs WHERE competition_id = v_comp AND pair_key = 'ZZ00000003|ZZ00000004';
  INSERT INTO _t VALUES ('07 federados intacto', v_key IS NOT NULL AND (v_res->>'playersCreated')::int = 2, v_res::text);

  -- constraint: license NULL sin exempt imposible
  BEGIN
    INSERT INTO public.players (name, license) VALUES ('T BAD', NULL);
    INSERT INTO _t VALUES ('constraint license/exempt', false, 'permitió');
  EXCEPTION WHEN check_violation THEN
    INSERT INTO _t VALUES ('constraint license/exempt', true, 'bloqueado');
  END;

  SELECT string_agg(CASE WHEN ok THEN 'OK   ' ELSE 'FAIL ' END || name || CASE WHEN ok THEN '' ELSE ' :: ' || info END, E'\n' ORDER BY name)
    INTO v_report FROM _t;
  RAISE EXCEPTION E'TEST_REPORT (rollback)\n%', v_report;
END $$;
