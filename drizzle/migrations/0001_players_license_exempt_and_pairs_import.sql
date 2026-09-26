ALTER TABLE public.players ALTER COLUMN license DROP NOT NULL;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS license_exempt boolean NOT NULL DEFAULT false;
ALTER TABLE public.players ADD CONSTRAINT players_license_or_exempt CHECK (license IS NOT NULL OR license_exempt = true);
COMMENT ON COLUMN public.players.license_exempt IS 'true only when an admin explicitly confirmed the player has no federative license (license IS NULL).';

CREATE OR REPLACE FUNCTION public.import_pair_results_batch(p_round_id uuid, p_source_filename text, p_pairs jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_competition_id uuid;
  v_format competition_format;
  v_threshold numeric := 15.4;
  v_pair jsonb;
  v_idx int := 0;
  v_p1 jsonb;
  v_p2 jsonb;
  v_tmp jsonb;
  v_lic1 text;
  v_lic2 text;
  v_nolic1 boolean;
  v_nolic2 boolean;
  v_fp1 uuid;
  v_fp2 uuid;
  v_tok1 text;
  v_tok2 text;
  v_ttmp text;
  v_utmp uuid;
  v_btmp boolean;
  v_pair_key text;
  v_client_key text;
  v_hex1 numeric;
  v_hex2 numeric;
  v_php1 numeric;
  v_php2 numeric;
  v_pair_hcp numeric;
  v_category player_category;
  v_pid1 uuid;
  v_pid2 uuid;
  v_pair_id uuid;
  v_net int;
  v_gross int;
  v_pos int;
  v_scores jsonb;
  v_el jsonb;
  v_i int;
  v_pairs_created int := 0;
  v_pairs_reused int := 0;
  v_players_created int := 0;
  v_players_matched int := 0;
  v_results_inserted int := 0;
  v_results_updated int := 0;
  v_warnings jsonb := '[]'::jsonb;
  v_seen_keys text[] := '{}';
  v_seen_players text[] := '{}';
  v_seen_pids uuid[] := '{}';
  v_was_insert boolean;
  v_affected uuid[] := '{}';
  v_aid uuid;
  v_first record;
  v_fp_row record;
BEGIN
  -- 1. SEGURETAT
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'NOT_ADMIN: només els administradors poden importar resultats de parelles';
  END IF;

  -- 2. VALIDACIÓ DE LA JORNADA I DEL FORMAT
  SELECT r.competition_id, c.format,
         COALESCE(NULLIF(c.rules_config #>> '{category_threshold}', '')::numeric, 15.4)
    INTO v_competition_id, v_format, v_threshold
    FROM public.rounds r
    JOIN public.competitions c ON c.id = r.competition_id
   WHERE r.id = p_round_id;

  IF v_competition_id IS NULL THEN
    RAISE EXCEPTION 'ROUND_NOT_FOUND: la jornada % no existeix', p_round_id;
  END IF;

  IF v_format <> 'pairs'::competition_format THEN
    RAISE EXCEPTION 'COMPETITION_NOT_PAIRS: la competició de la jornada no és de format parelles';
  END IF;

  -- 3. VALIDACIÓ DEL PAYLOAD
  IF p_pairs IS NULL OR jsonb_typeof(p_pairs) <> 'array' OR jsonb_array_length(p_pairs) = 0 THEN
    RAISE EXCEPTION 'EMPTY_PAYLOAD: cal enviar com a mínim una parella';
  END IF;

  -- 4. BLOQUEIG DE CONCURRÈNCIA
  PERFORM pg_advisory_xact_lock(
    hashtextextended('pair_import:' || v_competition_id::text, 0)
  );

  -- 5. PROCESSAMENT PARELLA A PARELLA
  FOR v_pair IN SELECT * FROM jsonb_array_elements(p_pairs)
  LOOP
    v_idx := v_idx + 1;
    v_p1 := v_pair -> 'player1';
    v_p2 := v_pair -> 'player2';

    IF v_p1 IS NULL OR v_p2 IS NULL OR jsonb_typeof(v_p1) <> 'object' OR jsonb_typeof(v_p2) <> 'object' THEN
      RAISE EXCEPTION 'PAIR_INCOMPLETE: la parella #% no té dos jugadors', v_idx;
    END IF;

    -- 5.1 Normalització de llicències
    v_lic1 := NULLIF(upper(regexp_replace(
      COALESCE(NULLIF(btrim(v_p1 #>> '{licenseNormalized}'), ''), v_p1 #>> '{licenseRaw}', ''),
      '[[:space:]._/-]', '', 'g')), '');
    v_lic2 := NULLIF(upper(regexp_replace(
      COALESCE(NULLIF(btrim(v_p2 #>> '{licenseNormalized}'), ''), v_p2 #>> '{licenseRaw}', ''),
      '[[:space:]._/-]', '', 'g')), '');

    -- Excepció explícita d'administrador: només aplica quan NO hi ha llicència
    v_nolic1 := v_lic1 IS NULL AND jsonb_typeof(v_p1 -> 'noLicenseConfirmed') = 'boolean'
                AND (v_p1 ->> 'noLicenseConfirmed')::boolean;
    v_nolic2 := v_lic2 IS NULL AND jsonb_typeof(v_p2 -> 'noLicenseConfirmed') = 'boolean'
                AND (v_p2 ->> 'noLicenseConfirmed')::boolean;

    IF (v_lic1 IS NULL AND NOT v_nolic1) OR (v_lic2 IS NULL AND NOT v_nolic2) THEN
      RAISE EXCEPTION 'MISSING_LICENSE: la parella #% té algun jugador sense llicència', v_idx;
    END IF;

    IF v_lic1 IS NOT NULL AND v_lic1 = v_lic2 THEN
      RAISE EXCEPTION 'DUPLICATE_PLAYER_IN_PAIR: la parella #% repeteix el mateix jugador', v_idx;
    END IF;

    -- 5.1bis Jugadors sense llicència vinculats explícitament (fairwayPlayerId)
    v_fp1 := NULL;
    v_fp2 := NULL;
    IF v_nolic1 AND NULLIF(btrim(COALESCE(v_p1 #>> '{fairwayPlayerId}', '')), '') IS NOT NULL THEN
      BEGIN
        v_fp1 := (v_p1 #>> '{fairwayPlayerId}')::uuid;
      EXCEPTION WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'FAIRWAY_PLAYER_NOT_FOUND: identificador de jugador invàlid a la parella #%', v_idx;
      END;
      SELECT id, license, license_exempt INTO v_fp_row FROM public.players WHERE id = v_fp1;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'FAIRWAY_PLAYER_NOT_FOUND: el jugador vinculat % no existeix', v_fp1;
      END IF;
      IF v_fp_row.license IS NOT NULL OR NOT v_fp_row.license_exempt THEN
        RAISE EXCEPTION 'FAIRWAY_PLAYER_NOT_UNLICENSED: el jugador vinculat % no és un jugador sense llicència', v_fp1;
      END IF;
    END IF;
    IF v_nolic2 AND NULLIF(btrim(COALESCE(v_p2 #>> '{fairwayPlayerId}', '')), '') IS NOT NULL THEN
      BEGIN
        v_fp2 := (v_p2 #>> '{fairwayPlayerId}')::uuid;
      EXCEPTION WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'FAIRWAY_PLAYER_NOT_FOUND: identificador de jugador invàlid a la parella #%', v_idx;
      END;
      SELECT id, license, license_exempt INTO v_fp_row FROM public.players WHERE id = v_fp2;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'FAIRWAY_PLAYER_NOT_FOUND: el jugador vinculat % no existeix', v_fp2;
      END IF;
      IF v_fp_row.license IS NOT NULL OR NOT v_fp_row.license_exempt THEN
        RAISE EXCEPTION 'FAIRWAY_PLAYER_NOT_UNLICENSED: el jugador vinculat % no és un jugador sense llicència', v_fp2;
      END IF;
    END IF;

    IF v_fp1 IS NOT NULL AND v_fp1 = v_fp2 THEN
      RAISE EXCEPTION 'DUPLICATE_PLAYER_IN_PAIR: la parella #% repeteix el mateix jugador', v_idx;
    END IF;

    -- 5.2 Identitat provisional de cada jugador dins l'operació
    --     llicència -> LIC ; vinculat -> ID:<uuid> ; nou sense llicència -> NEW:<parella>:<n> (temporal)
    v_tok1 := COALESCE(v_lic1, CASE WHEN v_fp1 IS NOT NULL THEN 'ID:' || v_fp1::text ELSE 'NEW:' || v_idx || ':1' END);
    v_tok2 := COALESCE(v_lic2, CASE WHEN v_fp2 IS NOT NULL THEN 'ID:' || v_fp2::text ELSE 'NEW:' || v_idx || ':2' END);

    IF v_tok1 > v_tok2 THEN
      v_tmp := v_p1; v_p1 := v_p2; v_p2 := v_tmp;
      v_ttmp := v_lic1; v_lic1 := v_lic2; v_lic2 := v_ttmp;
      v_ttmp := v_tok1; v_tok1 := v_tok2; v_tok2 := v_ttmp;
      v_utmp := v_fp1; v_fp1 := v_fp2; v_fp2 := v_utmp;
      v_btmp := v_nolic1; v_nolic1 := v_nolic2; v_nolic2 := v_btmp;
    END IF;

    v_pair_key := v_tok1 || '|' || v_tok2;

    -- Comprovació de la clau del client: només per a parelles amb dues llicències (flux actual)
    IF v_lic1 IS NOT NULL AND v_lic2 IS NOT NULL THEN
      v_client_key := upper(regexp_replace(COALESCE(v_pair #>> '{pairKey}', ''), '[[:space:]._/|-]', '', 'g'));
      IF v_client_key <> '' AND v_client_key <> replace(v_pair_key, '|', '') THEN
        RAISE EXCEPTION 'PAIR_KEY_MISMATCH: la parella #% no coincideix amb la seva clau canònica', v_idx;
      END IF;
    END IF;

    IF v_pair_key = ANY (v_seen_keys) THEN
      RAISE EXCEPTION 'DUPLICATE_PAIR_IN_PAYLOAD: la parella % apareix més d''una vegada', v_pair_key;
    END IF;
    v_seen_keys := v_seen_keys || v_pair_key;

    IF v_tok1 = ANY (v_seen_players) OR v_tok2 = ANY (v_seen_players) THEN
      RAISE EXCEPTION 'PLAYER_IN_MULTIPLE_PAIRS: un jugador de la parella % ja consta en una altra parella', v_pair_key;
    END IF;
    v_seen_players := v_seen_players || v_tok1 || v_tok2;

    -- 5.3 Punts oficials (font de veritat del fitxer)
    IF v_pair #>> '{netPoints}' IS NULL THEN
      RAISE EXCEPTION 'MISSING_NET_POINTS: la parella % no té punts Net oficials', v_pair_key;
    END IF;
    v_net := (v_pair #>> '{netPoints}')::int;
    IF v_net < 0 THEN
      RAISE EXCEPTION 'INVALID_NET_POINTS: punts Net negatius a la parella %', v_pair_key;
    END IF;

    v_gross := NULLIF(v_pair #>> '{grossPoints}', '')::int;
    IF v_gross IS NOT NULL AND v_gross < 0 THEN
      RAISE EXCEPTION 'INVALID_GROSS_POINTS: punts Brt negatius a la parella %', v_pair_key;
    END IF;

    v_pos := NULLIF(v_pair #>> '{position}', '')::int;

    -- 5.4 Hàndicap exacte: obligatori per als dos jugadors
    v_hex1 := NULLIF(v_p1 #>> '{exactHandicap}', '')::numeric;
    v_hex2 := NULLIF(v_p2 #>> '{exactHandicap}', '')::numeric;
    IF v_hex1 IS NULL OR v_hex2 IS NULL THEN
      RAISE EXCEPTION 'MISSING_PAIR_HANDICAP_DATA: falta l''hàndicap exacte a la parella %', v_pair_key;
    END IF;
    v_pair_hcp := round((v_hex1 + v_hex2) / 2.0, 2);
    v_category := CASE WHEN v_pair_hcp <= v_threshold THEN 'hcp_low' ELSE 'hcp_high' END::player_category;

    -- 5.4bis HPU (playingHandicap) OPCIONAL
    v_php1 := NULL;
    v_php2 := NULL;

    IF v_p1 ? 'playingHandicap' AND jsonb_typeof(v_p1 -> 'playingHandicap') <> 'null' THEN
      IF jsonb_typeof(v_p1 -> 'playingHandicap') = 'number' THEN
        v_php1 := (v_p1 #>> '{playingHandicap}')::numeric;
      ELSIF jsonb_typeof(v_p1 -> 'playingHandicap') = 'string'
            AND btrim(v_p1 #>> '{playingHandicap}') ~ '^-?[0-9]+([.,][0-9]+)?$' THEN
        v_php1 := replace(btrim(v_p1 #>> '{playingHandicap}'), ',', '.')::numeric;
      ELSIF jsonb_typeof(v_p1 -> 'playingHandicap') = 'string'
            AND btrim(v_p1 #>> '{playingHandicap}') = '' THEN
        v_php1 := NULL;
      ELSE
        RAISE EXCEPTION 'INVALID_PAIR_PAYLOAD: HPU no numèric a la parella %', v_pair_key;
      END IF;
    END IF;

    IF v_p2 ? 'playingHandicap' AND jsonb_typeof(v_p2 -> 'playingHandicap') <> 'null' THEN
      IF jsonb_typeof(v_p2 -> 'playingHandicap') = 'number' THEN
        v_php2 := (v_p2 #>> '{playingHandicap}')::numeric;
      ELSIF jsonb_typeof(v_p2 -> 'playingHandicap') = 'string'
            AND btrim(v_p2 #>> '{playingHandicap}') ~ '^-?[0-9]+([.,][0-9]+)?$' THEN
        v_php2 := replace(btrim(v_p2 #>> '{playingHandicap}'), ',', '.')::numeric;
      ELSIF jsonb_typeof(v_p2 -> 'playingHandicap') = 'string'
            AND btrim(v_p2 #>> '{playingHandicap}') = '' THEN
        v_php2 := NULL;
      ELSE
        RAISE EXCEPTION 'INVALID_PAIR_PAYLOAD: HPU no numèric a la parella %', v_pair_key;
      END IF;
    END IF;

    -- 5.5 Validació valor a valor de les 18 posicions
    FOREACH v_tmp IN ARRAY ARRAY[v_p1, v_p2]
    LOOP
      v_scores := v_tmp -> 'scores';
      IF v_scores IS NULL OR jsonb_typeof(v_scores) <> 'array' OR jsonb_array_length(v_scores) <> 18 THEN
        RAISE EXCEPTION 'INVALID_SCORECARD: la parella % no té 18 forats per jugador', v_pair_key;
      END IF;
      FOR v_i IN 0..17 LOOP
        v_el := v_scores -> v_i;
        IF jsonb_typeof(v_el) = 'null' THEN
          CONTINUE;
        ELSIF jsonb_typeof(v_el) = 'number' THEN
          IF (v_el #>> '{}')::numeric <= 0 THEN
            RAISE EXCEPTION 'INVALID_SCORECARD: valor de forat no positiu a la parella %', v_pair_key;
          END IF;
        ELSE
          RAISE EXCEPTION 'INVALID_SCORECARD: valor de forat no numèric a la parella %', v_pair_key;
        END IF;
      END LOOP;
    END LOOP;

    -- 5.6 Resolució de jugadors
    IF v_lic1 IS NOT NULL THEN
      SELECT id INTO v_pid1 FROM public.players WHERE license = v_lic1;
      IF v_pid1 IS NULL THEN
        INSERT INTO public.players (license, name, gender, initial_handicap, current_handicap)
        VALUES (
          v_lic1,
          COALESCE(NULLIF(btrim(v_p1 #>> '{name}'), ''), v_lic1),
          CASE WHEN upper(COALESCE(v_p1 #>> '{gender}', '')) IN ('M', 'F') THEN upper(v_p1 #>> '{gender}') ELSE NULL END,
          v_hex1, v_hex1
        )
        RETURNING id INTO v_pid1;
        v_players_created := v_players_created + 1;
      ELSE
        v_players_matched := v_players_matched + 1;
      END IF;
      IF (v_p1 #>> '{playerId}') IS NOT NULL AND (v_p1 #>> '{playerId}')::uuid <> v_pid1 THEN
        RAISE EXCEPTION 'PLAYER_IDENTITY_CONFLICT: el jugador % no coincideix amb la llicència %', v_p1 #>> '{playerId}', v_lic1;
      END IF;
    ELSIF v_fp1 IS NOT NULL THEN
      v_pid1 := v_fp1;
      v_players_matched := v_players_matched + 1;
    ELSE
      INSERT INTO public.players (license, license_exempt, name, gender, initial_handicap, current_handicap)
      VALUES (
        NULL, true,
        COALESCE(NULLIF(btrim(v_p1 #>> '{name}'), ''), 'Jugador sin licencia'),
        CASE WHEN upper(COALESCE(v_p1 #>> '{gender}', '')) IN ('M', 'F') THEN upper(v_p1 #>> '{gender}') ELSE NULL END,
        v_hex1, v_hex1
      )
      RETURNING id INTO v_pid1;
      v_players_created := v_players_created + 1;
    END IF;

    IF v_lic2 IS NOT NULL THEN
      SELECT id INTO v_pid2 FROM public.players WHERE license = v_lic2;
      IF v_pid2 IS NULL THEN
        INSERT INTO public.players (license, name, gender, initial_handicap, current_handicap)
        VALUES (
          v_lic2,
          COALESCE(NULLIF(btrim(v_p2 #>> '{name}'), ''), v_lic2),
          CASE WHEN upper(COALESCE(v_p2 #>> '{gender}', '')) IN ('M', 'F') THEN upper(v_p2 #>> '{gender}') ELSE NULL END,
          v_hex2, v_hex2
        )
        RETURNING id INTO v_pid2;
        v_players_created := v_players_created + 1;
      ELSE
        v_players_matched := v_players_matched + 1;
      END IF;
      IF (v_p2 #>> '{playerId}') IS NOT NULL AND (v_p2 #>> '{playerId}')::uuid <> v_pid2 THEN
        RAISE EXCEPTION 'PLAYER_IDENTITY_CONFLICT: el jugador % no coincideix amb la llicència %', v_p2 #>> '{playerId}', v_lic2;
      END IF;
    ELSIF v_fp2 IS NOT NULL THEN
      v_pid2 := v_fp2;
      v_players_matched := v_players_matched + 1;
    ELSE
      INSERT INTO public.players (license, license_exempt, name, gender, initial_handicap, current_handicap)
      VALUES (
        NULL, true,
        COALESCE(NULLIF(btrim(v_p2 #>> '{name}'), ''), 'Jugador sin licencia'),
        CASE WHEN upper(COALESCE(v_p2 #>> '{gender}', '')) IN ('M', 'F') THEN upper(v_p2 #>> '{gender}') ELSE NULL END,
        v_hex2, v_hex2
      )
      RETURNING id INTO v_pid2;
      v_players_created := v_players_created + 1;
    END IF;

    -- Protecció final per identitat interna (players.id)
    IF v_pid1 = v_pid2 THEN
      RAISE EXCEPTION 'DUPLICATE_PLAYER_IN_PAIR: la parella % repeteix el mateix jugador', v_pair_key;
    END IF;
    IF v_pid1 = ANY (v_seen_pids) OR v_pid2 = ANY (v_seen_pids) THEN
      RAISE EXCEPTION 'PLAYER_IN_MULTIPLE_PAIRS: un jugador de la parella % ja consta en una altra parella', v_pair_key;
    END IF;
    v_seen_pids := v_seen_pids || v_pid1 || v_pid2;

    -- 5.6bis pair_key definitiu: llicència o ID:<players.id>, ordenat
    v_tok1 := COALESCE(v_lic1, 'ID:' || v_pid1::text);
    v_tok2 := COALESCE(v_lic2, 'ID:' || v_pid2::text);
    IF v_tok1 > v_tok2 THEN
      v_tmp := v_p1; v_p1 := v_p2; v_p2 := v_tmp;
      v_ttmp := v_tok1; v_tok1 := v_tok2; v_tok2 := v_ttmp;
      v_utmp := v_pid1; v_pid1 := v_pid2; v_pid2 := v_utmp;
      v_tmp := to_jsonb(v_hex1); v_hex1 := v_hex2; v_hex2 := (v_tmp #>> '{}')::numeric;
      v_tmp := to_jsonb(v_php1); v_php1 := v_php2; v_php2 := NULLIF(v_tmp #>> '{}', '')::numeric;
    END IF;
    v_pair_key := v_tok1 || '|' || v_tok2;

    -- 5.7 Parella: primer per identitat interna dels dos jugadors (A,B) = (B,A)
    v_pair_id := NULL;
    SELECT id INTO v_pair_id
      FROM public.pairs
     WHERE competition_id = v_competition_id
       AND ((player_1_id = v_pid1 AND player_2_id = v_pid2)
         OR (player_1_id = v_pid2 AND player_2_id = v_pid1))
     LIMIT 1;

    IF v_pair_id IS NOT NULL THEN
      UPDATE public.pairs SET updated_at = now() WHERE id = v_pair_id;
      v_pairs_reused := v_pairs_reused + 1;
    ELSE
      IF EXISTS (SELECT 1 FROM public.pairs WHERE competition_id = v_competition_id AND pair_key = v_pair_key) THEN
        RAISE EXCEPTION 'PAIR_IDENTITY_CONFLICT: la clau % ja pertany a una altra parella', v_pair_key;
      END IF;
      INSERT INTO public.pairs (
        competition_id, pair_key, player_1_id, player_2_id,
        fixed_category, initial_pair_handicap, first_round_id
      )
      VALUES (
        v_competition_id, v_pair_key, v_pid1, v_pid2,
        v_category, v_pair_hcp, p_round_id
      )
      RETURNING id INTO v_pair_id;
      v_pairs_created := v_pairs_created + 1;
    END IF;

    IF NOT (v_pair_id = ANY (v_affected)) THEN
      v_affected := v_affected || v_pair_id;
    END IF;

    -- Alinear l'ordre J1/J2 amb el de la parella guardada
    IF EXISTS (SELECT 1 FROM public.pairs WHERE id = v_pair_id AND player_1_id = v_pid2) THEN
      v_tmp := v_p1; v_p1 := v_p2; v_p2 := v_tmp;
      v_tmp := to_jsonb(v_hex1); v_hex1 := v_hex2; v_hex2 := (v_tmp #>> '{}')::numeric;
      v_tmp := to_jsonb(v_php1); v_php1 := v_php2; v_php2 := NULLIF(v_tmp #>> '{}', '')::numeric;
    END IF;

    -- 5.8 Resultat idempotent per (round_id, pair_id)
    INSERT INTO public.pair_results (
      pair_id, round_id, position, gross_points, net_points, pair_handicap,
      player_1_exact_handicap, player_2_exact_handicap,
      player_1_playing_handicap, player_2_playing_handicap,
      player_1_scorecard, player_2_scorecard
    )
    VALUES (
      v_pair_id, p_round_id, v_pos, v_gross, v_net, v_pair_hcp,
      v_hex1, v_hex2,
      v_php1, v_php2,
      COALESCE(v_p1, '{}'::jsonb), COALESCE(v_p2, '{}'::jsonb)
    )
    ON CONFLICT (round_id, pair_id) DO UPDATE SET
      position = EXCLUDED.position,
      gross_points = EXCLUDED.gross_points,
      net_points = EXCLUDED.net_points,
      pair_handicap = EXCLUDED.pair_handicap,
      player_1_exact_handicap = EXCLUDED.player_1_exact_handicap,
      player_2_exact_handicap = EXCLUDED.player_2_exact_handicap,
      player_1_playing_handicap = EXCLUDED.player_1_playing_handicap,
      player_2_playing_handicap = EXCLUDED.player_2_playing_handicap,
      player_1_scorecard = EXCLUDED.player_1_scorecard,
      player_2_scorecard = EXCLUDED.player_2_scorecard,
      updated_at = now()
    RETURNING (xmax = 0) INTO v_was_insert;

    IF v_was_insert THEN
      v_results_inserted := v_results_inserted + 1;
    ELSE
      v_results_updated := v_results_updated + 1;
    END IF;

    -- 5.9 Warnings informatius (no bloquejants)
    IF (v_pair #>> '{validationStatus}') IN ('mismatch', 'provisional', 'insufficient_data') THEN
      v_warnings := v_warnings || jsonb_build_object(
        'code', upper(v_pair #>> '{validationStatus}'),
        'pairKey', v_pair_key,
        'netPoints', v_net,
        'grossPoints', v_gross
      );
    END IF;
  END LOOP;

  -- 6. RECÀLCUL CRONOLÒGIC DE LA PRIMERA PARTICIPACIÓ
  FOREACH v_aid IN ARRAY v_affected
  LOOP
    SELECT pr.round_id, pr.pair_handicap
      INTO v_first
      FROM public.pair_results pr
      JOIN public.rounds r ON r.id = pr.round_id
     WHERE pr.pair_id = v_aid
     ORDER BY r.date ASC, r.round_number ASC, r.created_at ASC
     LIMIT 1;

    UPDATE public.pairs
       SET first_round_id = v_first.round_id,
           initial_pair_handicap = v_first.pair_handicap,
           fixed_category = CASE
             WHEN v_first.pair_handicap IS NULL THEN fixed_category
             WHEN v_first.pair_handicap <= v_threshold THEN 'hcp_low'
             ELSE 'hcp_high'
           END::player_category,
           updated_at = now()
     WHERE id = v_aid;
  END LOOP;

  -- 7. LOG D'IMPORTACIÓ
  INSERT INTO public.import_logs (
    round_id, source, source_url, status,
    records_imported, records_skipped, warnings, skipped_records, imported_by
  )
  VALUES (
    p_round_id,
    'pairs_excel:' || COALESCE(NULLIF(btrim(p_source_filename), ''), 'unknown'),
    NULL,
    'completed',
    v_results_inserted + v_results_updated,
    0,
    v_warnings,
    '[]'::jsonb,
    auth.uid()
  );

  -- 8. RESPOSTA
  RETURN jsonb_build_object(
    'roundId', p_round_id,
    'competitionId', v_competition_id,
    'categoryThreshold', v_threshold,
    'pairsCreated', v_pairs_created,
    'pairsReused', v_pairs_reused,
    'playersCreated', v_players_created,
    'playersMatched', v_players_matched,
    'resultsInserted', v_results_inserted,
    'resultsUpdated', v_results_updated,
    'warnings', v_warnings
  );
END;
$function$;