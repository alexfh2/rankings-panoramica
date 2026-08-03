/**
 * Helper PURO del Orden del Mérito de Parejas.
 * No consulta Supabase, no muta argumentos, no recalcula Net.
 * El Net oficial (pair_results.net_points) es siempre la fuente de verdad.
 */
import { formatPlayerDisplayName } from '@/lib/formatPlayerDisplayName';

export type PairCategory = 'hcp_low' | 'hcp_high';

export type RoundStatus = 'draft' | 'imported' | 'review' | 'validated' | 'published';

export interface PairMember {
  id: string;
  name: string;
  license: string | null;
  gender: string | null;
  currentHandicap: number | null;
}

export interface PairEntity {
  id: string;
  competitionId: string;
  pairKey: string;
  fixedCategory: PairCategory;
  initialPairHandicap: number | null;
  firstRoundId: string | null;
  player1: PairMember | null;
  player2: PairMember | null;
}

export interface PairScorecardPlayer {
  name?: string | null;
  licenseRaw?: string | null;
  licenseNormalized?: string | null;
  gender?: string | null;
  exactHandicap?: number | null;
  playingHandicap?: number | null;
  scores?: readonly (number | null)[];
  liftedHoles?: readonly number[];
}

export interface PairResultEntity {
  id: string;
  pairId: string;
  roundId: string;
  position: number | null;
  /** Brt oficial (informativo). */
  grossPoints: number | null;
  /** Net oficial: valor de clasificación. */
  netPoints: number;
  pairHandicap: number | null;
  player1ExactHandicap: number | null;
  player2ExactHandicap: number | null;
  player1PlayingHandicap: number | null;
  player2PlayingHandicap: number | null;
  player1Scorecard: PairScorecardPlayer | null;
  player2Scorecard: PairScorecardPlayer | null;
}

export interface RoundColumn {
  id: string;
  label: string;
  roundNumber: number | null;
  name: string;
  date: string | null;
  status: RoundStatus | null;
  isPublished: boolean;
}

export interface PairRoundScore {
  roundId: string;
  netPoints: number;
  grossPoints: number | null;
  counted: boolean;
}

export interface PairRankingRow {
  pairId: string;
  pairKey: string;
  category: PairCategory;
  initialPairHandicap: number | null;
  player1: PairMember | null;
  player2: PairMember | null;
  displayName: string;
  roundsPlayed: number;
  total: number;
  scoresByRoundId: Record<string, PairRoundScore>;
  countedRoundIds: string[];
  discardedRoundIds: string[];
  lastThreeNet: number;
}

export interface PairsRankingInput {
  rounds: readonly RoundColumn[];
  pairs: readonly PairEntity[];
  pairResults: readonly PairResultEntity[];
  bestNScores: number;
}

export interface PairsRankingOutput {
  columns: RoundColumn[];
  bestNScores: number;
  rankings: { hcpLow: PairRankingRow[]; hcpHigh: PairRankingRow[] };
  rowsByPairId: Map<string, PairRankingRow>;
}

export const DEFAULT_PAIRS_BEST_N = 6;

export const formatPairMemberName = (member: PairMember | null): string =>
  member?.name ? formatPlayerDisplayName(member.name) : '—';

export const orderRoundColumns = (rounds: readonly RoundColumn[]): RoundColumn[] =>
  [...rounds].sort((a, b) => {
    const an = a.roundNumber ?? Number.MAX_SAFE_INTEGER;
    const bn = b.roundNumber ?? Number.MAX_SAFE_INTEGER;
    if (an !== bn) return an - bn;
    return (a.date ?? '').localeCompare(b.date ?? '');
  });

export function buildPairsRanking(input: PairsRankingInput): PairsRankingOutput {
  const bestN = Number.isFinite(input.bestNScores) && input.bestNScores > 0
    ? Math.floor(input.bestNScores)
    : DEFAULT_PAIRS_BEST_N;

  const columns = orderRoundColumns(input.rounds);
  const validRoundIds = new Set(columns.map((r) => r.id));
  const roundOrder = new Map<string, number>();
  columns.forEach((r, i) => roundOrder.set(r.id, i));

  const lastThreeIds = new Set(columns.slice(-3).map((r) => r.id));

  const resultsByPair = new Map<string, PairResultEntity[]>();
  for (const res of input.pairResults) {
    if (!validRoundIds.has(res.roundId)) continue;
    const list = resultsByPair.get(res.pairId);
    if (list) list.push(res);
    else resultsByPair.set(res.pairId, [res]);
  }

  const rows: PairRankingRow[] = [];

  for (const pair of input.pairs) {
    const results = resultsByPair.get(pair.id) ?? [];
    if (!results.length) continue;

    // Orden cronológico estable (round_number, luego fecha vía columns).
    const chronological = [...results].sort(
      (a, b) => (roundOrder.get(a.roundId) ?? 0) - (roundOrder.get(b.roundId) ?? 0)
    );

    // Selección determinista de los mejores N: Net desc, luego orden cronológico, luego roundId.
    const ranked = [...chronological].sort((a, b) => {
      if (b.netPoints !== a.netPoints) return b.netPoints - a.netPoints;
      const ao = roundOrder.get(a.roundId) ?? 0;
      const bo = roundOrder.get(b.roundId) ?? 0;
      if (ao !== bo) return ao - bo;
      return a.roundId.localeCompare(b.roundId);
    });

    const counted = ranked.slice(0, bestN);
    const discarded = ranked.slice(bestN);
    const countedIds = new Set(counted.map((r) => r.roundId));

    const scoresByRoundId: Record<string, PairRoundScore> = {};
    for (const r of chronological) {
      scoresByRoundId[r.roundId] = {
        roundId: r.roundId,
        netPoints: r.netPoints,
        grossPoints: r.grossPoints,
        counted: countedIds.has(r.roundId),
      };
    }

    rows.push({
      pairId: pair.id,
      pairKey: pair.pairKey,
      category: pair.fixedCategory,
      initialPairHandicap: pair.initialPairHandicap,
      player1: pair.player1,
      player2: pair.player2,
      displayName: `${formatPairMemberName(pair.player1)} / ${formatPairMemberName(pair.player2)}`,
      roundsPlayed: chronological.length,
      total: counted.reduce((sum, r) => sum + r.netPoints, 0),
      scoresByRoundId,
      countedRoundIds: counted.map((r) => r.roundId),
      discardedRoundIds: discarded.map((r) => r.roundId),
      lastThreeNet: chronological
        .filter((r) => lastThreeIds.has(r.roundId))
        .reduce((sum, r) => sum + r.netPoints, 0),
    });
  }

  const compare = (a: PairRankingRow, b: PairRankingRow): number => {
    if (b.total !== a.total) return b.total - a.total;
    if (b.roundsPlayed !== a.roundsPlayed) return b.roundsPlayed - a.roundsPlayed;
    if (b.lastThreeNet !== a.lastThreeNet) return b.lastThreeNet - a.lastThreeNet;
    const ah = a.initialPairHandicap ?? Number.POSITIVE_INFINITY;
    const bh = b.initialPairHandicap ?? Number.POSITIVE_INFINITY;
    if (ah !== bh) return ah - bh;
    return a.pairKey.localeCompare(b.pairKey);
  };

  const hcpLow = rows.filter((r) => r.category === 'hcp_low').sort(compare);
  const hcpHigh = rows.filter((r) => r.category === 'hcp_high').sort(compare);

  const rowsByPairId = new Map<string, PairRankingRow>();
  for (const row of rows) rowsByPairId.set(row.pairId, row);

  return { columns, bestNScores: bestN, rankings: { hcpLow, hcpHigh }, rowsByPairId };
}
