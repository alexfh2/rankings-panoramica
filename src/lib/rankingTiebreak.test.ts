import { describe, it, expect } from 'vitest';
import { compareRankingWithTiebreak, type TiebreakCompetitor } from '@/lib/rankingTiebreak';

const ROUNDS = ['r1', 'r2', 'r3', 'r4'];

const c = (total: number, scores: Record<string, number>): TiebreakCompetitor => ({
  total,
  roundsPlayed: Object.keys(scores).length,
  scoreForRound: (id) => scores[id],
});

describe('compareRankingWithTiebreak', () => {
  it('1. mismo total → gana el mejor resultado de la última jornada celebrada', () => {
    const a = c(100, { r1: 30, r4: 38 });
    const b = c(100, { r1: 40, r4: 30 });
    expect(compareRankingWithTiebreak(a, b, ROUNDS)).toBeLessThan(0);
  });

  it('2. mismo total y misma última jornada → gana quien ha disputado más pruebas', () => {
    const a = c(100, { r2: 30, r3: 30, r4: 35 });
    const b = c(100, { r3: 30, r4: 35 });
    expect(compareRankingWithTiebreak(a, b, ROUNDS)).toBeLessThan(0);
  });

  it('3. mismas pruebas disputadas → decide la penúltima jornada', () => {
    const a = c(100, { r1: 20, r3: 33, r4: 35 });
    const b = c(100, { r1: 40, r3: 31, r4: 35 });
    expect(compareRankingWithTiebreak(a, b, ROUNDS)).toBeLessThan(0);
  });

  it('4. empate en la penúltima → se compara la antepenúltima y sucesivas', () => {
    const a = c(100, { r1: 25, r2: 34, r3: 30, r4: 35 });
    const b = c(100, { r1: 40, r2: 30, r3: 30, r4: 35 });
    expect(compareRankingWithTiebreak(a, b, ROUNDS)).toBeLessThan(0);
    // si r2 también empata, decide r1
    const a2 = c(100, { r1: 25, r2: 34, r3: 30, r4: 35 });
    const b2 = c(100, { r1: 40, r2: 34, r3: 30, r4: 35 });
    expect(compareRankingWithTiebreak(a2, b2, ROUNDS)).toBeGreaterThan(0);
  });

  it('5. resultado vs ausencia en la última jornada → gana quien puntuó', () => {
    const a = c(100, { r1: 30, r4: 35 });
    const b = c(100, { r1: 30, r3: 40 });
    expect(compareRankingWithTiebreak(a, b, ROUNDS)).toBeLessThan(0);
    expect(compareRankingWithTiebreak(b, a, ROUNDS)).toBeGreaterThan(0);
  });

  it('6. ambos ausentes en una jornada → se continúa hacia atrás', () => {
    const a = c(100, { r1: 30, r2: 36 });
    const b = c(100, { r1: 30, r2: 32 });
    expect(compareRankingWithTiebreak(a, b, ROUNDS)).toBeLessThan(0);
  });

  it('7. empate absoluto → devuelve 0', () => {
    const a = c(100, { r1: 30, r2: 30, r4: 35 });
    const b = c(100, { r1: 30, r2: 30, r4: 35 });
    expect(compareRankingWithTiebreak(a, b, ROUNDS)).toBe(0);
  });

  it('el total sigue siendo el criterio principal', () => {
    const a = c(101, { r4: 10 });
    const b = c(100, { r4: 40 });
    expect(compareRankingWithTiebreak(a, b, ROUNDS)).toBeLessThan(0);
  });

  it('las jornadas no incluidas en la secuencia no intervienen', () => {
    const a = c(100, { r5: 40 });
    const b = c(100, { r5: 10 });
    expect(compareRankingWithTiebreak(a, b, ROUNDS)).toBe(0);
  });
});
