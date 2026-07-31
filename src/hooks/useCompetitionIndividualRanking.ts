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
};

export type CompetitionRankings = {
  hcpLow: CompetitionRankedPlayer[];
  hcpHigh: CompetitionRankedPlayer[];
  scratch: CompetitionRankedPlayer[];
};

export function useCompetitionIndividualRanking(slug: string) {
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
    queryKey: publicCircuitDataQueryKey(),
    queryFn: fetchPublicCircuitData,
    select: (data) => data.results as PublicResult[],
  });

  const rounds = roundsQuery.data;
  const allResults = resultsQuery.data;

  const rules = (competition?.rules_config ?? {}) as Record<string, unknown>;
  const bestN = typeof rules.best_n_scores === 'number' ? rules.best_n_scores : DEFAULT_BEST_N;
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

  // Solo resultados de las jornadas de esta competición
  const results = useMemo(() => {
    if (!rounds?.length || !allResults?.length) return [];
    const ids = new Set(rounds.map((r) => r.id));
    return allResults.filter((r) => ids.has(r.round_id));
  }, [rounds, allResults]);

  const rankings = useMemo<CompetitionRankings>(() => {
    const empty: CompetitionRankings = { hcpLow: [], hcpHigh: [], scratch: [] };
    if (!results.length) return empty;

    const categoryHcpMap = buildPlayerCategoryHandicapMap(results as any);
    const lastHcpMap = buildPlayerLastHandicapMap(results as any);

    const byPlayer = new Map<string, {
      name: string;
      handicap: number | null;
      displayHandicap: number | null;
      scores: { points: number; weighted: number }[];
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
      byPlayer.get(pid)!.scores.push({ points: r.stableford_points, weighted });
    }

    const build = (filterFn: (p: { handicap: number | null }) => boolean): CompetitionRankedPlayer[] => {
      const list: CompetitionRankedPlayer[] = [];
      for (const [id, p] of byPlayer.entries()) {
        if (!filterFn(p)) continue;
        const sorted = [...p.scores].sort((a, b) => b.weighted - a.weighted).slice(0, bestN);
        list.push({
          id,
          name: p.name,
          handicap: p.handicap,
          displayHandicap: p.displayHandicap,
          total: sorted.reduce((s, x) => s + x.weighted, 0),
          roundsPlayed: p.scores.length,
        });
      }
      list.sort((a, b) => b.total - a.total);
      return list;
    };

    // Scratch (misma fórmula que /ranquings)
    const scratchByPlayer = new Map<string, { name: string; handicap: number | null; displayHandicap: number | null; scores: number[] }>();
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
      scratchByPlayer.get(pid)!.scores.push(scratchPts);
    }

    const scratch: CompetitionRankedPlayer[] = Array.from(scratchByPlayer.entries()).map(([id, p]) => {
      const sorted = [...p.scores].sort((a, b) => b - a).slice(0, bestN);
      return {
        id,
        name: p.name,
        handicap: p.handicap,
        displayHandicap: p.displayHandicap,
        total: sorted.reduce((s, x) => s + x, 0),
        roundsPlayed: p.scores.length,
      };
    });
    scratch.sort((a, b) => b.total - a.total);

    return {
      hcpLow: build((p) => p.handicap != null && p.handicap <= categoryThreshold),
      hcpHigh: build((p) => p.handicap != null && p.handicap > categoryThreshold),
      scratch,
    };
  }, [results, bestN, categoryThreshold]);

  return {
    competition,
    rounds: rounds || [],
    results,
    rankings,
    bestN,
    categoryThreshold,
    isLoading: competitionQuery.isLoading || roundsQuery.isLoading || resultsQuery.isLoading,
    error: (competitionQuery.error || roundsQuery.error || resultsQuery.error) as Error | null,
    competitionNotFound: competitionQuery.isSuccess && !competitionQuery.data,
  };
}
