/**
 * Helper PURO de estadísticas del Orden del Mérito de Parejas.
 *
 * - No consulta Supabase ni Edge Functions: recibe los datos ya cargados por
 *   useCompetitionPairsRanking (públicos = solo jornadas published).
 * - El Net oficial (pair_results.net_points) es SIEMPRE la fuente de verdad:
 *   nunca se recalcula ni se sustituye.
 * - El Brt oficial (gross_points) es informativo y se excluye cuando es null.
 * - Las estadísticas Fourball hoyo a hoyo solo usan resultados con HPU de ambos
 *   jugadores y recorrido completo, descartando `insufficient_data`.
 */
import { resolvePairsWomenHoleHandicap } from '@/lib/panoramicaPairsCourse';
import {
  buildFourballScorecard,
  type FourballContributor,
} from '@/lib/buildFourballScorecard';
import type {
  PairCategory,
  PairRankingRow,
  PairResultEntity,
  PairsRankingOutput,
  RoundColumn,
} from '@/lib/buildPairsRanking';

export interface PairsStatsRound extends RoundColumn {
  coursePar: number[] | null;
  courseHandicap: number[] | null;
  courseHandicapWomen: number[] | null;
}

export interface PairsStatsInput {
  rounds: readonly PairsStatsRound[];
  pairResults: readonly PairResultEntity[];
  ranking: PairsRankingOutput;
  bestNScores: number;
}

export interface PairsSummary {
  roundsCount: number;
  pairsCount: number;
  resultsCount: number;
  avgNet: number | null;
  avgGross: number | null;
  grossSampleSize: number;
}

export interface PairsLeader {
  categoryLabel: string;
  row: PairRankingRow | null;
  countedResults: number;
  gap: number | null;
}

export interface PairsBestNetEntry {
  resultId: string;
  pairId: string;
  displayName: string;
  roundLabel: string;
  roundName: string;
  date: string | null;
  category: PairCategory;
  netPoints: number;
  grossPoints: number | null;
  position: number | null;
}

export interface PairsRegularityEntry {
  pairId: string;
  displayName: string;
  roundsPlayed: number;
  avgNet: number;
  deviation: number;
}

export interface PairsRoundPerformance {
  roundId: string;
  label: string;
  name: string;
  date: string | null;
  status: string | null;
  isPublished: boolean;
  pairsCount: number;
  avgNet: number | null;
  bestNet: number | null;
  worstNet: number | null;
  winner: PairRankingRow | null;
  countAtLeast36: number;
  pctAtLeast36: number | null;
}

export interface PairsCountEntry {
  pairId: string;
  displayName: string;
  value: number;
}

export interface PairsDiscardsStats {
  pairsWithDiscards: number;
  totalDiscards: number;
  bestDiscard: { pairId: string; displayName: string; netPoints: number; roundLabel: string } | null;
  biggestGap: { pairId: string; displayName: string; difference: number } | null;
}

export interface FourballPairContribution {
  pairId: string;
  displayName: string;
  player1Name: string;
  player2Name: string;
  validResults: number;
  holesPlayer1: number;
  holesPlayer2: number;
  holesTie: number;
  holesNone: number;
  pctPlayer1: number;
  pctPlayer2: number;
  pctTie: number;
}

export interface FourballHoleStat {
  hole: number;
  par: number;
  holeHcp: number;
  avgNetPoints: number;
  samples: number;
}

export interface FourballStats {
  totalResults: number;
  validResults: number;
  holesPlayer1: number;
  holesPlayer2: number;
  holesTie: number;
  holesNone: number;
  pctPlayer1: number | null;
  pctPlayer2: number | null;
  pctTie: number | null;
  pctNone: number | null;
  netMatches: number;
  netMismatches: number;
  contributions: FourballPairContribution[];
  lowestHoles: FourballHoleStat[];
  highestHoles: FourballHoleStat[];
}

export interface PairsCompetitionStats {
  summary: PairsSummary;
  leaders: PairsLeader[];
  bestNet: PairsBestNetEntry[];
  bestGross: PairsBestNetEntry[];
  regularity: PairsRegularityEntry[];
  roundPerformance: PairsRoundPerformance[];
  wins: PairsCountEntry[];
  podiums: PairsCountEntry[];
  discards: PairsDiscardsStats | null;
  fourball: FourballStats;
}

const TOP = 5;
const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

const isValid18 = (arr: number[] | null): arr is number[] =>
  Array.isArray(arr) && arr.length === 18 && arr.every((v) => Number.isFinite(v));

export function computePairsCompetitionStats(input: PairsStatsInput): PairsCompetitionStats {
  const { rounds, pairResults, ranking, bestNScores } = input;
  const rowsByPairId = ranking.rowsByPairId;
  const roundsById = new Map<string, PairsStatsRound>(rounds.map((r) => [r.id, r]));
  const nameOf = (pairId: string) => rowsByPairId.get(pairId)?.displayName ?? '—';
  const keyOf = (pairId: string) => rowsByPairId.get(pairId)?.pairKey ?? pairId;

  // ── Resumen general (Net y Brt oficiales) ──────────────────────
  const nets = pairResults.map((r) => r.netPoints);
  const grosses = pairResults
    .map((r) => r.grossPoints)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  const pairsWithResults = new Set(pairResults.map((r) => r.pairId));

  const summary: PairsSummary = {
    roundsCount: ranking.columns.length,
    pairsCount: pairsWithResults.size,
    resultsCount: pairResults.length,
    avgNet: nets.length ? round1(nets.reduce((s, n) => s + n, 0) / nets.length) : null,
    avgGross: grosses.length ? round1(grosses.reduce((s, n) => s + n, 0) / grosses.length) : null,
    grossSampleSize: grosses.length,
  };

  // ── Líderes actuales (ranking oficial, sin duplicar lógica) ────
  const leaderFor = (label: string, list: PairRankingRow[]): PairsLeader => {
    const first = list[0] ?? null;
    return {
      categoryLabel: label,
      row: first,
      countedResults: first ? first.countedRoundIds.length : 0,
      gap: first && list[1] ? first.total - list[1].total : null,
    };
  };
  const leaders = [
    leaderFor('1ª Categoría', ranking.rankings.hcpLow),
    leaderFor('2ª Categoría', ranking.rankings.hcpHigh),
  ];

  // ── Mejores vueltas Net / Brt oficiales ────────────────────────
  const toEntry = (res: PairResultEntity): PairsBestNetEntry => {
    const round = roundsById.get(res.roundId);
    const row = rowsByPairId.get(res.pairId);
    return {
      resultId: res.id,
      pairId: res.pairId,
      displayName: row?.displayName ?? '—',
      roundLabel: round?.label ?? '—',
      roundName: round?.name ?? '—',
      date: round?.date ?? null,
      category: row?.category ?? 'hcp_high',
      netPoints: res.netPoints,
      grossPoints: res.grossPoints,
      position: res.position,
    };
  };

  const dateOf = (res: PairResultEntity) => roundsById.get(res.roundId)?.date ?? '';

  const bestNet = [...pairResults]
    .sort((a, b) => {
      if (b.netPoints !== a.netPoints) return b.netPoints - a.netPoints;
      const d = dateOf(a).localeCompare(dateOf(b));
      if (d !== 0) return d;
      return keyOf(a.pairId).localeCompare(keyOf(b.pairId));
    })
    .slice(0, TOP)
    .map(toEntry);

  const bestGross = pairResults
    .filter((r) => typeof r.grossPoints === 'number' && Number.isFinite(r.grossPoints))
    .sort((a, b) => {
      const ag = a.grossPoints ?? 0;
      const bg = b.grossPoints ?? 0;
      if (bg !== ag) return bg - ag;
      if (b.netPoints !== a.netPoints) return b.netPoints - a.netPoints;
      const d = dateOf(a).localeCompare(dateOf(b));
      if (d !== 0) return d;
      return keyOf(a.pairId).localeCompare(keyOf(b.pairId));
    })
    .slice(0, TOP)
    .map(toEntry);

  // ── Regularidad: desviación típica del Net oficial (mín. 3 pruebas) ──
  const resultsByPair = new Map<string, PairResultEntity[]>();
  for (const res of pairResults) {
    const list = resultsByPair.get(res.pairId);
    if (list) list.push(res);
    else resultsByPair.set(res.pairId, [res]);
  }

  const regularity: PairsRegularityEntry[] = [];
  for (const [pairId, list] of resultsByPair) {
    if (list.length < 3) continue;
    const values = list.map((r) => r.netPoints);
    const mean = values.reduce((s, n) => s + n, 0) / values.length;
    const variance = values.reduce((s, n) => s + (n - mean) ** 2, 0) / values.length;
    regularity.push({
      pairId,
      displayName: nameOf(pairId),
      roundsPlayed: list.length,
      avgNet: round1(mean),
      deviation: round2(Math.sqrt(variance)),
    });
  }
  regularity.sort((a, b) => {
    if (a.deviation !== b.deviation) return a.deviation - b.deviation;
    if (b.avgNet !== a.avgNet) return b.avgNet - a.avgNet;
    if (b.roundsPlayed !== a.roundsPlayed) return b.roundsPlayed - a.roundsPlayed;
    return keyOf(a.pairId).localeCompare(keyOf(b.pairId));
  });

  // ── Rendimiento por prueba ─────────────────────────────────────
  const roundPerformance: PairsRoundPerformance[] = ranking.columns.map((col) => {
    const list = pairResults.filter((r) => r.roundId === col.id);
    const values = list.map((r) => r.netPoints);
    const winnerRes =
      list.find((r) => r.position === 1) ??
      [...list].sort((a, b) => {
        if (b.netPoints !== a.netPoints) return b.netPoints - a.netPoints;
        return keyOf(a.pairId).localeCompare(keyOf(b.pairId));
      })[0];
    const atLeast36 = values.filter((v) => v >= 36).length;
    return {
      roundId: col.id,
      label: col.label,
      name: col.name,
      date: col.date,
      status: col.status,
      isPublished: col.isPublished,
      pairsCount: list.length,
      avgNet: values.length ? round1(values.reduce((s, n) => s + n, 0) / values.length) : null,
      bestNet: values.length ? Math.max(...values) : null,
      worstNet: values.length ? Math.min(...values) : null,
      winner: winnerRes ? rowsByPairId.get(winnerRes.pairId) ?? null : null,
      countAtLeast36: atLeast36,
      pctAtLeast36: values.length ? Math.round((atLeast36 / values.length) * 100) : null,
    };
  });

  // ── Victorias y podios (position oficial) ──────────────────────
  const winMap = new Map<string, number>();
  const podiumMap = new Map<string, number>();
  for (const res of pairResults) {
    if (res.position == null) continue;
    if (res.position === 1) winMap.set(res.pairId, (winMap.get(res.pairId) ?? 0) + 1);
    if (res.position >= 1 && res.position <= 3) {
      podiumMap.set(res.pairId, (podiumMap.get(res.pairId) ?? 0) + 1);
    }
  }
  const toCounts = (map: Map<string, number>): PairsCountEntry[] =>
    Array.from(map.entries())
      .map(([pairId, value]) => ({ pairId, displayName: nameOf(pairId), value }))
      .sort((a, b) => {
        if (b.value !== a.value) return b.value - a.value;
        return keyOf(a.pairId).localeCompare(keyOf(b.pairId));
      })
      .slice(0, TOP);

  // ── Resultados descartados (solo si alguna pareja supera bestN) ──
  const rowsWithDiscards = Array.from(rowsByPairId.values()).filter(
    (row) => row.discardedRoundIds.length > 0
  );
  let discards: PairsDiscardsStats | null = null;
  if (rowsWithDiscards.length) {
    let bestDiscard: PairsDiscardsStats['bestDiscard'] = null;
    let biggestGap: PairsDiscardsStats['biggestGap'] = null;
    let totalDiscards = 0;
    for (const row of rowsWithDiscards) {
      totalDiscards += row.discardedRoundIds.length;
      let grossTotal = 0;
      for (const score of Object.values(row.scoresByRoundId)) {
        grossTotal += score.netPoints;
        if (score.counted) continue;
        if (!bestDiscard || score.netPoints > bestDiscard.netPoints) {
          bestDiscard = {
            pairId: row.pairId,
            displayName: row.displayName,
            netPoints: score.netPoints,
            roundLabel: roundsById.get(score.roundId)?.label ?? '—',
          };
        }
      }
      const difference = grossTotal - row.total;
      if (!biggestGap || difference > biggestGap.difference) {
        biggestGap = { pairId: row.pairId, displayName: row.displayName, difference };
      }
    }
    discards = {
      pairsWithDiscards: rowsWithDiscards.length,
      totalDiscards,
      bestDiscard,
      biggestGap,
    };
  }

  // ── Análisis Fourball (solo resultados completos) ──────────────
  const contributions = new Map<string, FourballPairContribution>();
  const holeAcc = new Map<number, { par: number; hcp: number; sum: number; n: number }>();
  let holesPlayer1 = 0;
  let holesPlayer2 = 0;
  let holesTie = 0;
  let holesNone = 0;
  let validResults = 0;
  let netMatches = 0;
  let netMismatches = 0;

  for (const res of pairResults) {
    const round = roundsById.get(res.roundId);
    const row = rowsByPairId.get(res.pairId);
    if (!round || !row) continue;

    const ph1 = res.player1PlayingHandicap ?? res.player1Scorecard?.playingHandicap ?? null;
    const ph2 = res.player2PlayingHandicap ?? res.player2Scorecard?.playingHandicap ?? null;
    if (ph1 == null || ph2 == null) continue;
    if (!isValid18(round.coursePar) || !isValid18(round.courseHandicap)) continue;
    const scores1 = res.player1Scorecard?.scores;
    const scores2 = res.player2Scorecard?.scores;
    if (!Array.isArray(scores1) || !Array.isArray(scores2)) continue;

    const card = buildFourballScorecard({
      player1: {
        playerId: row.player1?.id ?? `${res.id}-p1`,
        name: row.player1?.name ?? undefined,
        gender: row.player1?.gender ?? res.player1Scorecard?.gender ?? null,
        scorecard: { scores: scores1, liftedHoles: res.player1Scorecard?.liftedHoles },
        exactHandicap: res.player1ExactHandicap,
        playingHandicap: ph1,
      },
      player2: {
        playerId: row.player2?.id ?? `${res.id}-p2`,
        name: row.player2?.name ?? undefined,
        gender: row.player2?.gender ?? res.player2Scorecard?.gender ?? null,
        scorecard: { scores: scores2, liftedHoles: res.player2Scorecard?.liftedHoles },
        exactHandicap: res.player2ExactHandicap,
        playingHandicap: ph2,
      },
      coursePar: round.coursePar,
      courseHandicap: round.courseHandicap,
      courseHandicapWomen: resolvePairsWomenHoleHandicap(round.courseHandicap, round.courseHandicapWomen),
      officialNetPoints: res.netPoints,
      officialGrossPoints: res.grossPoints,
    });

    if (card.validationStatus === 'insufficient_data') continue;

    validResults += 1;
    if (card.netMatchesOfficial === true) netMatches += 1;
    else if (card.netMatchesOfficial === false) netMismatches += 1;

    let entry = contributions.get(res.pairId);
    if (!entry) {
      entry = {
        pairId: res.pairId,
        displayName: row.displayName,
        player1Name: row.player1?.name ?? '—',
        player2Name: row.player2?.name ?? '—',
        validResults: 0,
        holesPlayer1: 0,
        holesPlayer2: 0,
        holesTie: 0,
        holesNone: 0,
        pctPlayer1: 0,
        pctPlayer2: 0,
        pctTie: 0,
      };
      contributions.set(res.pairId, entry);
    }
    entry.validResults += 1;

    for (const hole of card.holes) {
      const c: FourballContributor = hole.netContributor;
      if (c === 'player_1') {
        holesPlayer1 += 1;
        entry.holesPlayer1 += 1;
      } else if (c === 'player_2') {
        holesPlayer2 += 1;
        entry.holesPlayer2 += 1;
      } else if (c === 'tie') {
        holesTie += 1;
        entry.holesTie += 1;
      } else {
        holesNone += 1;
        entry.holesNone += 1;
      }

      const acc = holeAcc.get(hole.hole);
      if (acc) {
        acc.sum += hole.pairNetPoints;
        acc.n += 1;
      } else {
        holeAcc.set(hole.hole, {
          par: hole.par,
          hcp: hole.holeHandicapPlayer1,
          sum: hole.pairNetPoints,
          n: 1,
        });
      }
    }
  }

  const totalHoles = holesPlayer1 + holesPlayer2 + holesTie + holesNone;
  const pct = (n: number) => (totalHoles ? Math.round((n / totalHoles) * 1000) / 10 : null);

  const contributionList = Array.from(contributions.values())
    .map((c) => {
      const total = c.holesPlayer1 + c.holesPlayer2 + c.holesTie + c.holesNone;
      const p = (n: number) => (total ? Math.round((n / total) * 1000) / 10 : 0);
      return {
        ...c,
        pctPlayer1: p(c.holesPlayer1),
        pctPlayer2: p(c.holesPlayer2),
        pctTie: p(c.holesTie),
      };
    })
    .sort((a, b) => {
      if (b.validResults !== a.validResults) return b.validResults - a.validResults;
      return keyOf(a.pairId).localeCompare(keyOf(b.pairId));
    });

  const holeStats: FourballHoleStat[] = Array.from(holeAcc.entries())
    .map(([hole, acc]) => ({
      hole,
      par: acc.par,
      holeHcp: acc.hcp,
      avgNetPoints: round2(acc.sum / acc.n),
      samples: acc.n,
    }))
    .sort((a, b) => a.avgNetPoints - b.avgNetPoints || a.hole - b.hole);

  const fourball: FourballStats = {
    totalResults: pairResults.length,
    validResults,
    holesPlayer1,
    holesPlayer2,
    holesTie,
    holesNone,
    pctPlayer1: pct(holesPlayer1),
    pctPlayer2: pct(holesPlayer2),
    pctTie: pct(holesTie),
    pctNone: pct(holesNone),
    netMatches,
    netMismatches,
    contributions: contributionList,
    lowestHoles: holeStats.slice(0, 3),
    highestHoles: [...holeStats].reverse().slice(0, 3),
  };

  return {
    summary,
    leaders,
    bestNet,
    bestGross,
    regularity: regularity.slice(0, TOP),
    roundPerformance,
    wins: toCounts(winMap),
    podiums: toCounts(podiumMap),
    discards,
    fourball,
  };
}

export const PAIRS_BEST_N_FALLBACK = 6;
export const pairsStatsTopSize = TOP;
export type { PairRankingRow };
export const isPairsStatsEmpty = (input: PairsStatsInput): boolean =>
  input.pairResults.length === 0;
export const pairsBestNLabel = (bestN: number): string =>
  `Mejores ${bestN || PAIRS_BEST_N_FALLBACK} resultados`;
