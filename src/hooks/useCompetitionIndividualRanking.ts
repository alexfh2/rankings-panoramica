/**
 * Hook técnico y aislado para rankings de UNA competición concreta (por slug).
 * Reutiliza los mismos helpers y fórmulas que /ranquings — no es un motor nuevo.
 * No lo usa ninguna vista pública existente.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchPublicCircuitData, publicCircuitDataQueryKey, type PublicResult } from '@/lib/publicCircuitData';
import { buildPlayerCategoryHandicapMap, buildPlayerLastHandicapMap } from '@/lib/playerCategoryHandicap';
import { computeScratchStableford } from '@/lib/scratchStableford';

export const DEFAULT_BEST_N = 8;
export const DEFAULT_CATEGORY_THRESHOLD = 15.0;

export type CompetitionRankedPlayer = {
  id: string;
  name: string;
  handicap: number | null;
  displayHandicap: number | null;
  total: number;
  roundsPlayed: number;
  /** Puntos por jornada (Stableford hcp en categorías; Scratch en la pestaña Scratch). */
  pointsByRound: Record<string, number>;
  /** IDs de jornada cuyos resultados SÍ entran en el total (los mejores bestN). */
  countedRoundIds: string[];
  /** IDs de jornada cuyos resultados quedan descartados por bestN. */
  discardedRoundIds: string[];
};

export type CompetitionRankings = {
  hcpLow: CompetitionRankedPlayer[];
  hcpHigh: CompetitionRankedPlayer[];
  scratch: CompetitionRankedPlayer[];
};

export const DEFAULT_COMPETITION_SLUG = 'individual-2026';

export function useCompetitionIndividualRanking(slugArg?: string) {
  const slug = slugArg?.trim() || DEFAULT_COMPETITION_SLUG;

  const competitionQuery = useQuery({
    queryKey: ['competition-by-slug', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('competitions')
        .select('id, name, slug, format, season_id, rules_config')
        .eq('slug', slug)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const competition = competitionQuery.data;

  const roundsQuery = useQuery({
    queryKey: ['competition-rounds', competition?.id],
    enabled: !!competition?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rounds')
        .select('id, name, round_number, date, status, is_master, master_coefficient')
        .eq('competition_id', competition!.id)
        .order('round_number', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const resultsQuery = useQuery({
    queryKey: publicCircuitDataQueryKey(slug),
    queryFn: () => fetchPublicCircuitData(slug),
    select: (data) => data.results as PublicResult[],
  });

  const rounds = roundsQuery.data;
  const allResults = resultsQuery.data;

  const rules = (competition?.rules_config ?? {}) as Record<string, unknown>;
  const bestN = typeof rules.best_n_scores === 'number' ? rules.best_n_scores : DEFAULT_BEST_N;
  const scheduledRounds =
    typeof rules.scheduled_rounds === 'number' && rules.scheduled_rounds > 0
      ? Math.floor(rules.scheduled_rounds)
      : 8;
  const categoryThreshold =
    typeof rules.category_threshold === 'number' ? rules.category_threshold : DEFAULT_CATEGORY_THRESHOLD;

  if (import.meta.env.DEV && competition) {
    if (typeof rules.best_n_scores !== 'number') {
      console.warn(`[${slug}] rules_config.best_n_scores no configurat — fallback ${DEFAULT_BEST_N}`);
    }
    if (typeof rules.category_threshold !== 'number') {
      console.warn(`[${slug}] rules_config.category_threshold no configurat — fallback ${DEFAULT_CATEGORY_THRESHOLD}`);
    }
  }

  // La Edge Function ja filtra per competició al backend (slug) — sense filtre client.
  const results = useMemo(() => allResults ?? [], [allResults]);

  // Mismo mapa de hándicap de categoría (primera participación) que usa el ranking.
  const categoryHandicapMap = useMemo(
    () => buildPlayerCategoryHandicapMap(results as any),
    [results]
  );

  const rankings = useMemo<CompetitionRankings>(() => {
    const empty: CompetitionRankings = { hcpLow: [], hcpHigh: [], scratch: [] };
    if (!results.length) return empty;

    const categoryHcpMap = categoryHandicapMap;
    const lastHcpMap = buildPlayerLastHandicapMap(results as any);

    const byPlayer = new Map<string, {
      name: string;
      handicap: number | null;
      displayHandicap: number | null;
      scores: { roundId: string; points: number; weighted: number }[];
    }>();

    for (const r of results) {
      if (!r.players_public || r.stableford_points == null) continue;
      const pid = r.player_id;
      if (!byPlayer.has(pid)) {
        byPlayer.set(pid, {
          name: r.players_public.name,
          handicap: categoryHcpMap.get(pid) ?? r.players_public.current_handicap ?? r.handicap_at_round,
          displayHandicap: lastHcpMap.get(pid) ?? r.players_public.current_handicap ?? r.handicap_at_round,
          scores: [],
        });
      }
      const coef = r.rounds?.master_coefficient || 1;
      const isMaster = r.rounds?.is_master || false;
      const weighted = Math.round(r.stableford_points * (isMaster ? coef : 1));
      byPlayer.get(pid)!.scores.push({ roundId: r.round_id, points: r.stableford_points, weighted });
    }

    const build = (filterFn: (p: { handicap: number | null }) => boolean): CompetitionRankedPlayer[] => {
      const list: CompetitionRankedPlayer[] = [];
      for (const [id, p] of byPlayer.entries()) {
        if (!filterFn(p)) continue;
        const ranked = [...p.scores].sort((a, b) => b.weighted - a.weighted);
        const sorted = ranked.slice(0, bestN);
        const pointsByRound: Record<string, number> = {};
        for (const s2 of p.scores) pointsByRound[s2.roundId] = s2.points;
        list.push({
          id,
          name: p.name,
          handicap: p.handicap,
          displayHandicap: p.displayHandicap,
          total: sorted.reduce((s, x) => s + x.weighted, 0),
          roundsPlayed: p.scores.length,
          pointsByRound,
          countedRoundIds: sorted.map((x) => x.roundId),
          discardedRoundIds: ranked.slice(bestN).map((x) => x.roundId),
        });
      }
      // Empate → gana el hándicap más bajo (mismo criterio que prueba a prueba).
      list.sort((a, b) => {
        if (b.total !== a.total) return b.total - a.total;
        const ah = a.displayHandicap ?? a.handicap ?? Infinity;
        const bh = b.displayHandicap ?? b.handicap ?? Infinity;
        if (ah !== bh) return ah - bh;
        return a.name.localeCompare(b.name);
      });
      return list;
    };

    // Scratch (misma fórmula que /ranquings)
    const scratchByPlayer = new Map<string, { name: string; handicap: number | null; displayHandicap: number | null; scores: { roundId: string; points: number }[] }>();
    for (const r of results) {
      if (!r.players_public) continue;
      let scratchPts = computeScratchStableford(r.scorecard, r.rounds?.course_par);
      if (scratchPts == null && r.scratch_score != null && r.scratch_score <= 50) {
        scratchPts = r.scratch_score;
      }
      if (scratchPts == null) continue;
      const pid = r.player_id;
      if (!scratchByPlayer.has(pid)) {
        scratchByPlayer.set(pid, {
          name: r.players_public.name,
          handicap: categoryHcpMap.get(pid) ?? r.players_public.current_handicap ?? r.handicap_at_round,
          displayHandicap: lastHcpMap.get(pid) ?? r.players_public.current_handicap ?? r.handicap_at_round,
          scores: [],
        });
      }
      scratchByPlayer.get(pid)!.scores.push({ roundId: r.round_id, points: scratchPts });
    }

    const scratch: CompetitionRankedPlayer[] = Array.from(scratchByPlayer.entries()).map(([id, p]) => {
      const ranked = [...p.scores].sort((a, b) => b.points - a.points);
      const sorted = ranked.slice(0, bestN);
      const pointsByRound: Record<string, number> = {};
      for (const s2 of p.scores) pointsByRound[s2.roundId] = s2.points;
      return {
        id,
        name: p.name,
        handicap: p.handicap,
        displayHandicap: p.displayHandicap,
        total: sorted.reduce((s, x) => s + x.points, 0),
        roundsPlayed: p.scores.length,
        pointsByRound,
        countedRoundIds: sorted.map((x) => x.roundId),
        discardedRoundIds: ranked.slice(bestN).map((x) => x.roundId),
      };
    });
    scratch.sort((a, b) => b.total - a.total);

    return {
      hcpLow: build((p) => p.handicap != null && p.handicap <= categoryThreshold),
      hcpHigh: build((p) => p.handicap != null && p.handicap > categoryThreshold),
      scratch,
    };
  }, [results, bestN, categoryThreshold, categoryHandicapMap]);

  return {
    competition,
    rounds: rounds || [],
    results,
    rankings,
    categoryHandicapMap,
    bestN,
    scheduledRounds,
    categoryThreshold,
    isLoading: competitionQuery.isLoading || roundsQuery.isLoading || resultsQuery.isLoading,
    error: (competitionQuery.error || roundsQuery.error || resultsQuery.error) as Error | null,
    competitionNotFound: competitionQuery.isSuccess && !competitionQuery.data,
  };
}
