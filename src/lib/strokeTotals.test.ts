import { describe, it, expect } from 'vitest';
import { computeStrokeTotals, isValidStrokeCount, sumStrokeSegment } from '@/lib/strokeTotals';
import { mergeGolfDirectoResults, type RawGolfDirectoEntry } from '@/lib/mergeGolfDirectoResults';

const PARS = [4, 4, 5, 3, 5, 3, 4, 4, 4, 4, 5, 3, 4, 5, 4, 4, 3, 5];
const HCPS = [10, 14, 18, 4, 16, 6, 12, 8, 2, 1, 5, 11, 17, 7, 3, 15, 13, 9];
const FULL = [4, 4, 5, 3, 5, 3, 4, 4, 4, 4, 5, 3, 4, 5, 4, 4, 3, 5]; // 72

describe('isValidStrokeCount', () => {
  it('acepta enteros > 0 y rechaza los marcadores de bola levantada', () => {
    expect(isValidStrokeCount(4)).toBe(true);
    expect(isValidStrokeCount('4')).toBe(true);
    expect([0, null, undefined, '', 'X', NaN, -3, 3.5].map(isValidStrokeCount)).toEqual([
      false, false, false, false, false, false, false, false,
    ]);
  });
});

describe('computeStrokeTotals', () => {
  it('A. 18 scores válidos → total correcto', () => {
    const t = computeStrokeTotals(FULL);
    expect(t.total).toBe(73);
    expect(t.out).toBe(36);
    expect(t.in).toBe(37);
    expect(t.isComplete).toBe(true);
  });

  it('B. 17 válidos + un 0 → total null', () => {
    const scores = [...FULL];
    scores[12] = 0;
    expect(computeStrokeTotals(scores).total).toBeNull();
  });

  it('C. 17 válidos + null → total null', () => {
    const scores: (number | null)[] = [...FULL];
    scores[5] = null;
    expect(computeStrokeTotals(scores).total).toBeNull();
  });

  it('D. falta un hoyo en Ida → Ida null y Total null (Vuelta se mantiene)', () => {
    const scores: (number | null)[] = [...FULL];
    scores[3] = null;
    const t = computeStrokeTotals(scores);
    expect(t.out).toBeNull();
    expect(t.total).toBeNull();
    expect(t.in).toBe(37);
  });

  it('E. falta un hoyo en Vuelta → Vuelta null y Total null (Ida se mantiene)', () => {
    const scores = [...FULL];
    scores[16] = 0;
    const t = computeStrokeTotals(scores);
    expect(t.in).toBeNull();
    expect(t.total).toBeNull();
    expect(t.out).toBe(36);
  });

  it('nunca fabrica un total parcial sumando las partes conocidas', () => {
    const scores = [...FULL.slice(0, 17), 0];
    const t = computeStrokeTotals(scores);
    expect(t.total).toBeNull();
    expect(t.validHoles).toBe(17);
  });

  it('tarjeta vacía o de menos de 18 hoyos → sin totales', () => {
    expect(computeStrokeTotals([]).total).toBeNull();
    expect(computeStrokeTotals(FULL.slice(0, 9)).total).toBeNull();
    expect(sumStrokeSegment([4, 4], 9)).toBeNull();
  });
});

describe('F. bola levantada: Stableford intacto, golpes sin total', () => {
  const entry = (scores: (number | null)[]): RawGolfDirectoEntry => ({
    position: 1,
    name: 'MAS PITARCH, ISABEL',
    license: 'LV0001',
    gender: 'F',
    handicap: -3.2,
    handicap_play: -3,
    stableford_points: 34,
    scratch_score: null,
    scores,
    source_url: 'https://www.golfdirecto.com/next/game/aaaaaaaaaaaaaaaaaaaaaaaa/ranking/entry',
    official_net_points: 34,
    pars: PARS,
    hole_hcp: HCPS,
  });

  it('calcula Net y Scratch aunque falte un hoyo, y deja los golpes en null', () => {
    const complete = mergeGolfDirectoResults([entry(FULL)]).results[0];
    const scores: (number | null)[] = [...FULL];
    scores[17] = 0; // bola levantada en el 18
    const lifted = mergeGolfDirectoResults([entry(scores)]).results[0];

    expect(complete.total_strokes).toBe(73);
    expect(lifted.total_strokes).toBeNull();
    expect(lifted.out_strokes).toBe(36);
    expect(lifted.in_strokes).toBeNull();

    // Los puntos siguen existiendo: el hoyo levantado aporta 0 puntos, no invalida el total.
    expect(lifted.computed_net_points).toBe(complete.computed_net_points! - 2);
    expect(lifted.computed_scratch_points).toBe(complete.computed_scratch_points! - 2);
    expect(lifted.computed_net_points).not.toBeNull();
    expect(lifted.computed_scratch_points).not.toBeNull();
  });

  it('no se valida Scr calc. contra el total de golpes', () => {
    const scores = [...FULL];
    scores[17] = 0;
    const merged = mergeGolfDirectoResults([entry(scores)]);
    // La validación sólo compara Net calculado con Net oficial.
    expect(merged.results[0].validation).toBe(
      merged.results[0].computed_net_points === 34 ? 'valid' : 'mismatch'
    );
    expect(merged.warnings.some(w => w.code === 'GOLFDIRECTO_MISSING_SCORECARD')).toBe(false);
  });
});
