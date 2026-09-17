import { describe, it, expect } from 'vitest';
import {
  buildPairsRanking,
  type PairEntity,
  type PairResultEntity,
  type RoundColumn,
} from '@/lib/buildPairsRanking';

const round = (n: number): RoundColumn => ({
  id: `r${n}`,
  label: `J${n}`,
  roundNumber: n,
  name: `Jornada ${n}`,
  date: `2026-0${n}-01`,
  status: 'published',
  isPublished: true,
});

const ROUNDS = [1, 2, 3, 4, 5, 6, 7, 8].map(round);

const pair = (id: string): PairEntity => ({
  id,
  competitionId: 'c1',
  pairKey: id,
  fixedCategory: 'hcp_low',
  initialPairHandicap: 10,
  firstRoundId: 'r1',
  player1: { id: `${id}-p1`, name: 'A A', license: null, gender: null, currentHandicap: null },
  player2: { id: `${id}-p2`, name: 'B B', license: null, gender: null, currentHandicap: null },
});

const results = (pairId: string, byRound: Record<string, number>): PairResultEntity[] =>
  Object.entries(byRound).map(([roundId, netPoints]) => ({
    id: `${pairId}-${roundId}`,
    pairId,
    roundId,
    position: null,
    grossPoints: null,
    netPoints,
    pairHandicap: null,
    player1ExactHandicap: null,
    player2ExactHandicap: null,
    player1PlayingHandicap: null,
    player2PlayingHandicap: null,
    player1Scorecard: null,
    player2Scorecard: null,
  }));

const run = (a: Record<string, number>, b: Record<string, number>) =>
  buildPairsRanking({
    rounds: ROUNDS,
    pairs: [pair('A'), pair('B')],
    pairResults: [...results('A', a), ...results('B', b)],
    bestNScores: 6,
  }).rankings.hcpLow.map((r) => r.pairId);

describe('buildPairsRanking — desempate 2026 con Net', () => {
  it('mismo total → gana el mejor Net de la última jornada celebrada', () => {
    expect(run({ r1: 30, r8: 40 }, { r1: 40, r8: 30 })).toEqual(['A', 'B']);
  });

  it('misma última jornada → gana quien ha disputado más pruebas', () => {
    expect(run({ r5: 10, r6: 20, r8: 40 }, { r6: 30, r8: 40 })).toEqual(['A', 'B']);
  });

  it('mismas pruebas disputadas → decide la penúltima', () => {
    expect(run({ r1: 20, r7: 35, r8: 40 }, { r1: 30, r7: 25, r8: 40 })).toEqual(['A', 'B']);
  });

  it('ausencia en la última jornada pierde frente a un resultado', () => {
    expect(run({ r7: 30, r8: 35 }, { r6: 30, r7: 35 })).toEqual(['A', 'B']);
  });

  it('ambas ausentes en la última → se continúa hacia atrás', () => {
    expect(run({ r1: 30, r7: 36 }, { r1: 30, r7: 32 })).toEqual(['A', 'B']);
  });

  it('empate absoluto → comparador estable (devuelve 0)', () => {
    const same = { r1: 30, r2: 30, r8: 35 };
    expect(run(same, { ...same })).toEqual(['A', 'B']);
    expect(
      buildPairsRanking({
        rounds: ROUNDS,
        pairs: [pair('B'), pair('A')],
        pairResults: [...results('A', same), ...results('B', { ...same })],
        bestNScores: 6,
      }).rankings.hcpLow.map((r) => r.pairId)
    ).toEqual(['B', 'A']);
  });

  it('sigue calculando los mejores 6 de 8 (dos descartes)', () => {
    const scores = { r1: 30, r2: 31, r3: 32, r4: 33, r5: 34, r6: 35, r7: 36, r8: 37 };
    const out = buildPairsRanking({
      rounds: ROUNDS,
      pairs: [pair('A')],
      pairResults: results('A', scores),
      bestNScores: 6,
    }).rankings.hcpLow[0];
    expect(out.total).toBe(32 + 33 + 34 + 35 + 36 + 37);
    expect(out.countedRoundIds).toHaveLength(6);
    expect(out.discardedRoundIds).toHaveLength(2);
    expect(out.roundsPlayed).toBe(8);
  });

  it('no usa el hándicap inicial de pareja como desempate', () => {
    const pairs = [
      { ...pair('A'), initialPairHandicap: 30 },
      { ...pair('B'), initialPairHandicap: 4 },
    ];
    const out = buildPairsRanking({
      rounds: ROUNDS,
      pairs,
      pairResults: [...results('A', { r8: 40 }), ...results('B', { r8: 30 })],
      bestNScores: 6,
    }).rankings.hcpLow.map((r) => r.pairId);
    expect(out).toEqual(['A', 'B']);
  });
});
