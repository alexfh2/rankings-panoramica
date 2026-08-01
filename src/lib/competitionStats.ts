/**
 * Helpers purs per a les estadístiques d'UNA competició (individual-2026).
 * Sense React, sense Supabase, sense mutar els arrays rebuts.
 * Reutilitza els criteris de càlcul ja existents a Stats.tsx i computeScratchStableford.
 */
import { computeScratchStableford } from '@/lib/scratchStableford';
import type { PublicResult } from '@/lib/publicCircuitData';

export type StatEntry = {
  playerId: string;
  name: string;
  value: number;
  detail?: string;
  extra?: string;
};

export type HoleStat = {
  hole: number;
  par: number;
  avgStrokes: number;
  avgOverPar: number;
};

export type CompetitionStatsSummary = {
  roundsPlayed: number;
  playersCount: number;
  cardsCount: number;
  avgStableford: number | null;
};

export type SpecialShots = {
  holeInOne: number;
  albatross: number;
  eagles: number;
  topEagles: StatEntry | null;
};

export type CompetitionStatsResult = {
  summary: CompetitionStatsSummary;
  bestHandicapRounds: StatEntry[];
  bestScratchRounds: StatEntry[];
  regularity: StatEntry[];
  birdies: StatEntry[];
  special: SpecialShots;
  hardestHoles: HoleStat[];
  easiestHoles: HoleStat[];
  parAverages: { par: 3 | 4 | 5; avg: number | null; holesPlayed: number }[];
};

/** Mateix helper que Stats.tsx per llegir scorecard / course_par. */
const getHoleScores = (value: unknown): number[] => {
  if (value && typeof value === 'object' && Array.isArray((value as { scores?: unknown }).scores)) {
    return ((value as { scores: unknown[] }).scores).map(Number);
  }
  if (Array.isArray(value)) return value.map(Number);
  return [];
};

const playerName = (r: PublicResult) => r.players_public?.name || 'Jugador sin nombre';
const roundName = (r: PublicResult) => r.rounds?.name || '';
const getHcp = (r: PublicResult) => r.handicap_at_round ?? r.players_public?.current_handicap ?? null;

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

export function computeCompetitionStats(results: PublicResult[]): CompetitionStatsResult {
  const validCards = results.filter((r) => !!r.players_public);

  // ---- Resum general ----
  const roundIds = new Set<string>();
  const playerIds = new Set<string>();
  let stbSum = 0;
  let stbCount = 0;
  for (const r of validCards) {
    roundIds.add(r.round_id);
    playerIds.add(r.player_id);
    if (typeof r.stableford_points === 'number' && Number.isFinite(r.stableford_points)) {
      stbSum += r.stableford_points;
      stbCount += 1;
    }
  }

  const summary: CompetitionStatsSummary = {
    roundsPlayed: roundIds.size,
    playersCount: playerIds.size,
    cardsCount: validCards.length,
    avgStableford: stbCount > 0 ? round1(stbSum / stbCount) : null,
  };

  // ---- Millors voltes: Stableford hàndicap (empat → hcp més baix, com a Rounds) ----
  const bestHandicapRounds: StatEntry[] = validCards
    .filter((r) => typeof r.stableford_points === 'number')
    .slice()
    .sort((a, b) => {
      const diff = (b.stableford_points ?? 0) - (a.stableford_points ?? 0);
      if (diff !== 0) return diff;
      return (getHcp(a) ?? Infinity) - (getHcp(b) ?? Infinity);
    })
    .slice(0, 5)
    .map((r) => {
      const hcp = getHcp(r);
      return {
        playerId: r.player_id,
        name: playerName(r),
        value: r.stableford_points ?? 0,
        detail: roundName(r),
        extra: hcp != null ? `Hcp ${hcp}` : undefined,
      };
    });

  // ---- Millors voltes Scratch (mateix càlcul i fallback existents) ----
  const scratchEntries: { r: PublicResult; pts: number }[] = [];
  for (const r of validCards) {
    let pts = computeScratchStableford(r.scorecard, r.rounds?.course_par);
    if (pts == null && r.scratch_score != null && r.scratch_score <= 50) pts = r.scratch_score;
    if (pts == null) continue;
    scratchEntries.push({ r, pts });
  }
  const bestScratchRounds: StatEntry[] = scratchEntries
    .sort((a, b) => {
      const diff = b.pts - a.pts;
      if (diff !== 0) return diff;
      return (getHcp(b.r) ?? -Infinity) - (getHcp(a.r) ?? -Infinity);
    })
    .slice(0, 5)
    .map(({ r, pts }) => ({
      playerId: r.player_id,
      name: playerName(r),
      value: pts,
      detail: roundName(r),
    }));

  // ---- Agregats per jugador: regularitat, birdies, cops destacats ----
  const byPlayer = new Map<
    string,
    { name: string; stableford: number[]; birdies: number; cards: number; eagles: number }
  >();

  let holeInOne = 0;
  let albatross = 0;
  let eagles = 0;

  for (const r of validCards) {
    const pid = r.player_id;
    if (!byPlayer.has(pid)) {
      byPlayer.set(pid, { name: playerName(r), stableford: [], birdies: 0, cards: 0, eagles: 0 });
    }
    const agg = byPlayer.get(pid)!;
    agg.cards += 1;
    if (typeof r.stableford_points === 'number' && Number.isFinite(r.stableford_points)) {
      agg.stableford.push(r.stableford_points);
    }

    const pars = getHoleScores(r.rounds?.course_par);
    const scores = getHoleScores(r.scorecard);
    for (let h = 0; h < Math.min(scores.length, pars.length); h++) {
      const par = pars[h];
      const score = scores[h];
      if (!par || Number.isNaN(par) || !score || Number.isNaN(score) || score <= 0) continue;
      // Mateix criteri que Stats.tsx
      if (score <= par - 1) agg.birdies += 1;
      const diff = score - par;
      if (score === 1) holeInOne += 1;
      else if (diff <= -3) albatross += 1;
      else if (diff === -2) {
        eagles += 1;
        agg.eagles += 1;
      }
    }
  }

  const regularity: StatEntry[] = Array.from(byPlayer.entries())
    .filter(([, p]) => p.stableford.length >= 3)
    .map(([pid, p]) => ({
      playerId: pid,
      name: p.name,
      value: round1(p.stableford.reduce((a, b) => a + b, 0) / p.stableford.length),
      detail: `${p.stableford.length} pruebas`,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  const birdies: StatEntry[] = Array.from(byPlayer.entries())
    .filter(([, p]) => p.birdies > 0)
    .map(([pid, p]) => ({
      playerId: pid,
      name: p.name,
      value: p.birdies,
      detail: `${p.cards} ${p.cards === 1 ? 'prueba' : 'pruebas'}`,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  const eagleLeader = Array.from(byPlayer.entries())
    .filter(([, p]) => p.eagles > 0)
    .sort((a, b) => b[1].eagles - a[1].eagles)[0];

  const special: SpecialShots = {
    holeInOne,
    albatross,
    eagles,
    topEagles: eagleLeader
      ? { playerId: eagleLeader[0], name: eagleLeader[1].name, value: eagleLeader[1].eagles }
      : null,
  };

  // ---- El campo: dificultat per forat (bola aixecada = par + 4, com a Stats.tsx) ----
  const holes = new Map<number, { totalOverPar: number; count: number; parCounts: Record<string, number> }>();
  const parGroups: Record<3 | 4 | 5, { strokes: number; count: number }> = {
    3: { strokes: 0, count: 0 },
    4: { strokes: 0, count: 0 },
    5: { strokes: 0, count: 0 },
  };

  for (const r of validCards) {
    const pars = getHoleScores(r.rounds?.course_par);
    const scores = getHoleScores(r.scorecard);
    for (let h = 0; h < Math.min(scores.length, pars.length); h++) {
      const par = pars[h];
      if (!par || Number.isNaN(par)) continue;
      const agg = holes.get(h + 1) ?? { totalOverPar: 0, count: 0, parCounts: {} };
      const raw = scores[h];
      const holeScore = !raw || Number.isNaN(raw) || raw === 0 ? par + 4 : raw;
      agg.totalOverPar += holeScore - par;
      agg.count += 1;
      agg.parCounts[String(par)] = (agg.parCounts[String(par)] || 0) + 1;
      holes.set(h + 1, agg);

      if ((par === 3 || par === 4 || par === 5) && raw > 0 && !Number.isNaN(raw)) {
        const g = parGroups[par as 3 | 4 | 5];
        g.strokes += raw;
        g.count += 1;
      }
    }
  }

  const holeList: HoleStat[] = Array.from(holes.entries()).map(([hole, agg]) => {
    const par = Number(Object.entries(agg.parCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 0);
    const avgOverPar = agg.count > 0 ? agg.totalOverPar / agg.count : 0;
    return {
      hole,
      par,
      avgStrokes: round2(par + avgOverPar),
      avgOverPar: round2(avgOverPar),
    };
  });

  const byDifficulty = [...holeList].sort((a, b) => b.avgOverPar - a.avgOverPar || a.hole - b.hole);
  const hardestHoles = byDifficulty.slice(0, 3);
  const easiestHoles = [...holeList]
    .sort((a, b) => a.avgOverPar - b.avgOverPar || a.hole - b.hole)
    .slice(0, 3);

  const parAverages = ([3, 4, 5] as const).map((par) => {
    const g = parGroups[par];
    return {
      par,
      avg: g.count > 0 ? round2(g.strokes / g.count) : null,
      holesPlayed: g.count,
    };
  });

  return {
    summary,
    bestHandicapRounds,
    bestScratchRounds,
    regularity,
    birdies,
    special,
    hardestHoles,
    easiestHoles,
    parAverages,
  };
}
