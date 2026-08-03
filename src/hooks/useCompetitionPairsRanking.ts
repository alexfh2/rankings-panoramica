/**
 * Datos del Orden del Mérito de Parejas para una competición (por slug).
 * Solo lectura: cuatro consultas agrupadas (competition, rounds, pairs, pair_results)
 * más una consulta de jugadores por id. Sin N+1, sin escrituras.
 *
 * En la vista pública se filtra explícitamente rounds.status = 'published' y se
 * descartan los pair_results cuyo round_id no pertenezca a ese conjunto.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  buildPairsRanking,
  DEFAULT_PAIRS_BEST_N,
  type PairEntity,
  type PairMember,
  type PairResultEntity,
  type PairScorecardPlayer,
  type PairsRankingOutput,
  type RoundColumn,
  type RoundStatus,
} from '@/lib/buildPairsRanking';

export interface PairsRound extends RoundColumn {
  coursePar: number[] | null;
  courseHandicap: number[] | null;
  courseHandicapWomen: number[] | null;
}

export interface PairsCompetitionData {
  competition: { id: string; name: string; slug: string; rulesConfig: Record<string, unknown> } | null;
  rounds: PairsRound[];
  roundsById: Map<string, PairsRound>;
  pairs: PairEntity[];
  pairResults: PairResultEntity[];
  ranking: PairsRankingOutput;
  bestNScores: number;
  isLoading: boolean;
  error: Error | null;
  competitionNotFound: boolean;
}

const toNumberArray = (value: unknown): number[] | null => {
  if (!Array.isArray(value) || value.length !== 18) return null;
  const arr = value.map((v) => (typeof v === 'number' ? v : Number(v)));
  return arr.every((n) => Number.isFinite(n)) ? arr : null;
};

const toScorecard = (value: unknown): PairScorecardPlayer | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const scores = Array.isArray(raw.scores)
    ? raw.scores.map((v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null))
    : undefined;
  const lifted = Array.isArray(raw.liftedHoles)
    ? raw.liftedHoles.filter((v): v is number => typeof v === 'number')
    : undefined;
  const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
  return {
    name: str(raw.name),
    licenseRaw: str(raw.licenseRaw),
    licenseNormalized: str(raw.licenseNormalized),
    gender: str(raw.gender),
    exactHandicap: num(raw.exactHandicap),
    playingHandicap: num(raw.playingHandicap),
    scores,
    liftedHoles: lifted,
  };
};

export function useCompetitionPairsRanking(slug: string, includeUnpublished = false): PairsCompetitionData {
  const competitionQuery = useQuery({
    queryKey: ['pairs-competition', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('competitions')
        .select('id, name, slug, format, rules_config')
        .eq('slug', slug)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const competitionId = competitionQuery.data?.id ?? null;

  const roundsQuery = useQuery({
    queryKey: ['pairs-rounds', competitionId, includeUnpublished],
    enabled: !!competitionId,
    queryFn: async () => {
      let query = supabase
        .from('rounds')
        .select('id, name, round_number, date, status, course_par, course_handicap, course_handicap_women')
        .eq('competition_id', competitionId!);
      if (!includeUnpublished) query = query.eq('status', 'published');
      const { data, error } = await query.order('round_number', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const pairsQuery = useQuery({
    queryKey: ['pairs-list', competitionId],
    enabled: !!competitionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pairs')
        .select('id, competition_id, pair_key, fixed_category, initial_pair_handicap, first_round_id, player_1_id, player_2_id')
        .eq('competition_id', competitionId!);
      if (error) throw error;
      return data ?? [];
    },
  });

  const playerIds = useMemo(() => {
    const set = new Set<string>();
    for (const p of pairsQuery.data ?? []) {
      set.add(p.player_1_id);
      set.add(p.player_2_id);
    }
    return Array.from(set).sort();
  }, [pairsQuery.data]);

  /**
   * Vista pública: RPC segura que devuelve SOLO player_id + display_name de jugadores
   * con resultados en jornadas publicadas. No expone licencia, género ni hándicap.
   * Vista admin (includeUnpublished): consulta autenticada existente sobre players_public.
   */
  const publicNamesQuery = useQuery({
    queryKey: ['pairs-public-names', slug],
    enabled: !includeUnpublished && !!competitionId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_published_pair_player_names', {
        p_competition_slug: slug,
      });
      if (error) throw error;
      return data ?? [];
    },
  });

  const playersQuery = useQuery({
    queryKey: ['pairs-players', playerIds],
    enabled: includeUnpublished && playerIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('players_public')
        .select('id, name, license, gender, current_handicap')
        .in('id', playerIds);
      if (error) throw error;
      return data ?? [];
    },
  });


  const roundIds = useMemo(() => (roundsQuery.data ?? []).map((r) => r.id).sort(), [roundsQuery.data]);

  const resultsQuery = useQuery({
    queryKey: ['pair-results', competitionId, roundIds],
    enabled: !!competitionId && roundIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pair_results')
        .select(
          'id, pair_id, round_id, position, gross_points, net_points, pair_handicap, player_1_exact_handicap, player_2_exact_handicap, player_1_playing_handicap, player_2_playing_handicap, player_1_scorecard, player_2_scorecard'
        )
        .in('round_id', roundIds);
      if (error) throw error;
      return data ?? [];
    },
  });

  const rounds = useMemo<PairsRound[]>(
    () =>
      (roundsQuery.data ?? []).map((r) => ({
        id: r.id,
        label: r.round_number != null ? `J${r.round_number}` : '—',
        roundNumber: r.round_number ?? null,
        name: r.name,
        date: r.date ?? null,
        status: (r.status ?? null) as RoundStatus | null,
        isPublished: r.status === 'published',
        coursePar: toNumberArray(r.course_par),
        courseHandicap: toNumberArray(r.course_handicap),
        courseHandicapWomen: toNumberArray(r.course_handicap_women),
      })),
    [roundsQuery.data]
  );

  const playersById = useMemo(() => {
    const map = new Map<string, PairMember>();
    // Público: solo id + nombre desde la RPC (sin licencia ni datos personales).
    for (const p of publicNamesQuery.data ?? []) {
      if (!p.player_id) continue;
      map.set(p.player_id, {
        id: p.player_id,
        name: p.display_name ?? '—',
        license: null,
        gender: null,
        currentHandicap: null,
      });
    }
    for (const p of playersQuery.data ?? []) {
      if (!p.id) continue;
      map.set(p.id, {
        id: p.id,
        name: p.name ?? '—',
        license: p.license ?? null,
        gender: p.gender ?? null,
        currentHandicap: p.current_handicap ?? null,
      });
    }
    return map;
  }, [playersQuery.data, publicNamesQuery.data]);


  const pairs = useMemo<PairEntity[]>(
    () =>
      (pairsQuery.data ?? []).map((p) => ({
        id: p.id,
        competitionId: p.competition_id,
        pairKey: p.pair_key,
        fixedCategory: p.fixed_category === 'hcp_low' ? 'hcp_low' : 'hcp_high',
        initialPairHandicap: p.initial_pair_handicap ?? null,
        firstRoundId: p.first_round_id ?? null,
        player1: playersById.get(p.player_1_id) ?? null,
        player2: playersById.get(p.player_2_id) ?? null,
      })),
    [pairsQuery.data, playersById]
  );

  const allowedRoundIds = useMemo(() => new Set(rounds.map((r) => r.id)), [rounds]);

  const pairResults = useMemo<PairResultEntity[]>(
    () =>
      (resultsQuery.data ?? [])
        .filter((r) => allowedRoundIds.has(r.round_id))
        .map((r) => ({
          id: r.id,
          pairId: r.pair_id,
          roundId: r.round_id,
          position: r.position ?? null,
          grossPoints: r.gross_points ?? null,
          netPoints: r.net_points,
          pairHandicap: r.pair_handicap ?? null,
          player1ExactHandicap: r.player_1_exact_handicap ?? null,
          player2ExactHandicap: r.player_2_exact_handicap ?? null,
          player1PlayingHandicap: r.player_1_playing_handicap ?? null,
          player2PlayingHandicap: r.player_2_playing_handicap ?? null,
          player1Scorecard: toScorecard(r.player_1_scorecard),
          player2Scorecard: toScorecard(r.player_2_scorecard),
        })),
    [resultsQuery.data, allowedRoundIds]
  );

  const rules = (competitionQuery.data?.rules_config ?? {}) as Record<string, unknown>;
  const bestNScores =
    typeof rules.best_n_scores === 'number' && rules.best_n_scores > 0
      ? Math.floor(rules.best_n_scores)
      : DEFAULT_PAIRS_BEST_N;

  const ranking = useMemo(
    () => buildPairsRanking({ rounds, pairs, pairResults, bestNScores }),
    [rounds, pairs, pairResults, bestNScores]
  );

  const roundsById = useMemo(() => {
    const map = new Map<string, PairsRound>();
    for (const r of rounds) map.set(r.id, r);
    return map;
  }, [rounds]);

  return {
    competition: competitionQuery.data
      ? {
          id: competitionQuery.data.id,
          name: competitionQuery.data.name,
          slug: competitionQuery.data.slug,
          rulesConfig: rules,
        }
      : null,
    rounds,
    roundsById,
    pairs,
    pairResults,
    ranking,
    bestNScores,
    isLoading:
      competitionQuery.isLoading ||
      roundsQuery.isLoading ||
      pairsQuery.isLoading ||
      resultsQuery.isLoading ||
      playersQuery.isLoading ||
      publicNamesQuery.isLoading,
    error: (competitionQuery.error ||
      roundsQuery.error ||
      pairsQuery.error ||
      resultsQuery.error ||
      playersQuery.error ||
      publicNamesQuery.error) as Error | null,

    competitionNotFound: competitionQuery.isSuccess && !competitionQuery.data,
  };
}
