import { describe, it, expect } from 'vitest';
import { parseGolfDirectoUrl, splitUrlLines, validateSameGolfDirectoGame } from '@/lib/golfDirectoUrl';
import { mergeGolfDirectoResults, type RawGolfDirectoEntry } from '@/lib/mergeGolfDirectoResults';

const URL_A =
  'https://www.golfdirecto.com/next/game/6a551f513d009b2c4b394bee/ranking/entry?view=day&category=6a551f513d009b2c4b394c2b';
const URL_B =
  'https://www.golfdirecto.com/next/game/6a551f513d009b2c4b394bee/ranking/entry?view=day&category=6a551f513d009b2c4b394c2e';

const PARS = [4, 5, 3, 5, 3, 4, 3, 4, 5, 4, 5, 3, 4, 4, 4, 3, 4, 5];
const HCPS = [10, 14, 18, 4, 16, 6, 12, 8, 2, 1, 5, 11, 17, 7, 3, 15, 13, 9];

const base = (over: Partial<RawGolfDirectoEntry> = {}): RawGolfDirectoEntry => ({
  position: 1,
  name: 'ALVAREZ HEREDERO, ENRIQUE',
  license: '4405646600',
  gender: 'M',
  handicap: 14.1,
  handicap_play: 16,
  stableford_points: 39,
  scratch_score: 69,
  scores: [5, 5, 3, 5, 3, 5, 4, 5, 7, 4, 6, 3, 4, 5, 5, 4, 6, 6],
  source_url: URL_A,
  source_player_id: 'p1',
  category_id: 'catA',
  category_name: 'HANDICAP INFERIOR',
  official_net_points: 39,
  official_gross_points: 23,
  official_strokes: 69,
  pars: PARS,
  hole_hcp: HCPS,
  ...over,
});

describe('golfDirectoUrl', () => {
  it('extreu gameId i categoryId de les URLs reals', () => {
    expect(parseGolfDirectoUrl(URL_A)).toMatchObject({
      gameId: '6a551f513d009b2c4b394bee',
      categoryId: '6a551f513d009b2c4b394c2b',
    });
    expect(parseGolfDirectoUrl(URL_B).categoryId).toBe('6a551f513d009b2c4b394c2e');
  });

  it('accepta les dues URLs com el mateix torneig', () => {
    const res = validateSameGolfDirectoGame([URL_A, URL_B]);
    expect(res.ok).toBe(true);
    expect(res.gameId).toBe('6a551f513d009b2c4b394bee');
  });

  it('bloqueja URLs de tornejos diferents', () => {
    const res = validateSameGolfDirectoGame([URL_A, URL_A.replace('6a551f513d009b2c4b394bee', 'aaaaaaaaaaaaaaaaaaaaaaaa')]);
    expect(res.ok).toBe(false);
    expect(res.code).toBe('GOLFDIRECTO_DIFFERENT_GAME');
    expect(res.error).toContain('torneos diferentes');
  });

  it('separa URLs per línies', () => {
    expect(splitUrlLines(` ${URL_A} \n\n${URL_B}\n`)).toEqual([URL_A, URL_B]);
  });
});

describe('mergeGolfDirectoResults', () => {
  it('calcula Net i Scratch des de la targeta amb el motor existent', () => {
    const { results } = mergeGolfDirectoResults([base()]);
    expect(results).toHaveLength(1);
    expect(results[0].computed_scratch_points).toBe(23);
    expect(results[0].computed_net_points).toBe(39);
    expect(results[0].validation).toBe('valid');
    expect(results[0].has_full_scorecard).toBe(true);
  });

  it('no duplica jugadors presents en dues categories i avisa', () => {
    const { results, warnings, summary } = mergeGolfDirectoResults(
      [base(), base({ source_url: URL_B, category_id: 'catB', category_name: 'HANDICAP SUPERIOR' })],
      { categoryCount: 2 }
    );
    expect(results).toHaveLength(1);
    expect(summary.categories).toBe(2);
    expect(warnings.some(w => w.code === 'GOLFDIRECTO_DUPLICATE_PLAYER')).toBe(true);
    expect(warnings.some(w => w.code === 'GOLFDIRECTO_PLAYER_CONFLICT')).toBe(false);
  });

  it("avisa de conflicte quan la mateixa persona té dades diferents", () => {
    const { warnings } = mergeGolfDirectoResults([
      base(),
      base({ handicap: 18.2, official_net_points: 35, category_id: 'catB' }),
    ]);
    expect(warnings.some(w => w.code === 'GOLFDIRECTO_PLAYER_CONFLICT')).toBe(true);
  });

  it('avisa quan el Net calculat no coincideix amb el Net oficial i conserva l’oficial', () => {
    const { results, warnings } = mergeGolfDirectoResults([base({ official_net_points: 41, stableford_points: 41 })]);
    expect(results[0].validation).toBe('mismatch');
    expect(results[0].stableford_points).toBe(41);
    expect(warnings.some(w => w.code === 'GOLFDIRECTO_CALCULATION_MISMATCH')).toBe(true);
  });

  it('avisa quan falta la targeta', () => {
    const { warnings, results } = mergeGolfDirectoResults([
      base({ scores: [], pars: null, hole_hcp: null }),
    ]);
    expect(results[0].has_full_scorecard).toBe(false);
    expect(warnings.some(w => w.code === 'GOLFDIRECTO_MISSING_SCORECARD')).toBe(true);
  });

  it('dedupica per llicència quan no hi ha id, i per nom com a últim recurs', () => {
    const byLicense = mergeGolfDirectoResults([
      base({ source_player_id: null }),
      base({ source_player_id: null, license: '44.056.466-00', category_id: 'catB' }),
    ]);
    expect(byLicense.results).toHaveLength(1);

    const byName = mergeGolfDirectoResults([
      base({ source_player_id: null, license: '' }),
      base({ source_player_id: null, license: '', name: 'Alvarez Heredero, Énrique', category_id: 'catB' }),
    ]);
    expect(byName.results).toHaveLength(1);
  });

  it('una sola categoria (flux antic) manté una participació per jugador', () => {
    const { results, warnings } = mergeGolfDirectoResults([
      base(),
      base({ source_player_id: 'p2', license: 'LV78525801', name: 'POU WITTY, MATEU', position: 2 }),
    ]);
    expect(results.map(r => r.position)).toEqual([1, 2]);
    expect(warnings.some(w => w.code === 'GOLFDIRECTO_DUPLICATE_PLAYER')).toBe(false);
  });
});
