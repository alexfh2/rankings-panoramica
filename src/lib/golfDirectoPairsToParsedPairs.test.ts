import { describe, expect, it } from 'vitest';
import {
  golfDirectoPairsToParsedPairs,
  type GolfDirectoPairsRawEntry,
  type GolfDirectoPairsRawPlayer,
} from '@/lib/golfDirectoPairsToParsedPairs';
import { validateSameGolfDirectoGame } from '@/lib/golfDirectoUrl';
import { buildFourballScorecard } from '@/lib/buildFourballScorecard';
import { buildPairImportPayload } from '@/lib/buildPairImportPayload';

const GAME = '6a7355854cb1cc3fe8bec20a';
const INF = '6a7355854cb1cc3fe8bec24a';
const SUP = '6a7355854cb1cc3fe8bec24d';
const url = (cat: string, game = GAME) =>
  `https://www.golfdirecto.com/game/${game}/ranking/entry?view=day&category=${cat}`;

const PAR = [4, 5, 3, 5, 3, 4, 3, 4, 5, 4, 5, 3, 4, 4, 4, 3, 4, 5];
const HCP = [10, 14, 18, 4, 16, 6, 12, 8, 2, 1, 5, 11, 17, 7, 3, 15, 13, 9];

// Cas real: 1a parella HANDICAP INFERIOR, TORNEO OM PAREJAS (26/09/2026)
const mormeneo: GolfDirectoPairsRawPlayer = {
  sourcePlayerId: '6aae81410ab32ecb83e880b0',
  firstName: 'MIGUEL ANGEL',
  surname: 'MORMENEO HERRERO',
  license: 'LV35760053',
  gender: 'M',
  hcpExact: 7.2,
  hcpGame: 7,
  gross: [4, 5, 3, 5, 4, 4, 3, 0, 4, 4, 5, 5, 4, 5, 4, 3, 0, 5],
};
const arcusa: GolfDirectoPairsRawPlayer = {
  sourcePlayerId: '6aae818e0ab32ecb83f43750',
  firstName: 'JOSE',
  surname: 'ARCUSA PARRAS',
  license: 'LV35498709',
  gender: 'M',
  hcpExact: 6.9,
  hcpGame: 7,
  gross: [4, 5, 3, 6, 3, 4, 4, 4, 4, 5, 5, 3, 5, 4, 5, 4, 4, 6],
};

const entry = (players: GolfDirectoPairsRawPlayer[], over: Partial<GolfDirectoPairsRawEntry> = {}): GolfDirectoPairsRawEntry => ({
  sourceCategoryId: INF,
  sourceCategoryName: 'HANDICAP INFERIOR',
  sourceGroupId: '6ab2989d55d1f26f76aabe5f',
  position: 1,
  netPoints: 44,
  grossPoints: 37,
  players,
  ...over,
});

const adapt = (entries: GolfDirectoPairsRawEntry[]) =>
  golfDirectoPairsToParsedPairs({ success: true, entries });

describe('golfDirectoPairsToParsedPairs', () => {
  it('1. una entrada Fourball produce exactamente dos jugadores', () => {
    const { pairs } = adapt([entry([mormeneo, arcusa])]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].player1.name).toBe('MORMENEO HERRERO, MIGUEL ANGEL');
    expect(pairs[0].player2.name).toBe('ARCUSA PARRAS, JOSE');
  });

  it('2. extrae position, netPoints y grossPoints', () => {
    const [p] = adapt([entry([mormeneo, arcusa])]).pairs;
    expect(p.position).toBe(1);
    expect(p.netPoints).toBe(44);
    expect(p.grossPoints).toBe(37);
  });

  it('3. gross 0 → null y hoyo en liftedHoles', () => {
    const [p] = adapt([entry([mormeneo, arcusa])]).pairs;
    expect(p.player1.scores[7]).toBeNull();
    expect(p.player1.scores[16]).toBeNull();
    expect(p.player1.liftedHoles).toEqual([8, 17]);
    expect(p.player1.scores).not.toContain(0);
    expect(p.player2.liftedHoles).toEqual([]);
  });

  it('4. pairKey idéntico sea cual sea el orden de los jugadores', () => {
    const a = adapt([entry([mormeneo, arcusa])]).pairs[0].pairKey;
    const b = adapt([entry([arcusa, mormeneo])]).pairs[0].pairKey;
    expect(a).toBe('LV35498709|LV35760053');
    expect(b).toBe(a);
  });

  it('5. dos categorías del mismo torneo se aceptan', () => {
    expect(validateSameGolfDirectoGame([url(INF), url(SUP)]).ok).toBe(true);
  });

  it('6. dos torneos diferentes se rechazan', () => {
    const res = validateSameGolfDirectoGame([url(INF), url(SUP, 'aaaaaaaaaaaaaaaaaaaaaaaa')]);
    expect(res.ok).toBe(false);
    expect(res.code).toBe('GOLFDIRECTO_DIFFERENT_GAME');
  });

  it('7. pareja repetida entre categorías se deduplica', () => {
    const res = adapt([
      entry([mormeneo, arcusa]),
      entry([arcusa, mormeneo], { sourceCategoryId: SUP, sourceCategoryName: 'HANDICAP SUPERIOR' }),
    ]);
    expect(res.pairs).toHaveLength(1);
    expect(res.pairs[0].isValid).toBe(true);
    expect(res.warnings.some((w) => w.code === 'DUPLICATE_PAIR_ACROSS_CATEGORIES')).toBe(true);
  });

  it('7b. pareja repetida con datos distintos queda en conflicto, sin elegir', () => {
    const res = adapt([
      entry([mormeneo, arcusa]),
      entry([mormeneo, arcusa], { sourceCategoryId: SUP, netPoints: 40 }),
    ]);
    expect(res.pairs).toHaveLength(2);
    expect(res.pairs.every((p) => p.errors.some((e) => e.code === 'PAIR_SOURCE_CONFLICT'))).toBe(true);
  });

  it('8. jugador sin licencia queda en revisión y sin licencia inventada', () => {
    const noLic = { ...arcusa, license: null, sourcePlayerId: '6ab6911c4eee3b080afab66d' };
    const [p] = adapt([entry([mormeneo, noLic])]).pairs;
    expect(p.player2.licenseRaw).toBeNull();
    expect(p.player2.licenseNormalized).toBeNull();
    expect(p.needsManualReview).toBe(true);
    expect(p.pairKeyKind).toBe('name_fallback');
    expect(p.player2.warnings.some((w) => w.message.includes('Falta licencia — revisión manual'))).toBe(true);
    expect(JSON.stringify(p)).not.toContain('6ab6911c4eee3b080afab66d');
  });

  it('9. el _id de GolfDirecto no se envía como playerId', () => {
    const [p] = adapt([entry([mormeneo, arcusa])]).pairs;
    const payload = buildPairImportPayload([{ pair: p, fourball: null }]);
    expect(payload[0].player1).not.toHaveProperty('playerId');
    expect(payload[0].player2).not.toHaveProperty('playerId');
    expect(JSON.stringify(payload)).not.toContain(mormeneo.sourcePlayerId);
    expect(JSON.stringify(payload)).not.toContain('6ab2989d55d1f26f76aabe5f');
  });

  it('10. HPU negativo se conserva negativo', () => {
    const [p] = adapt([entry([{ ...mormeneo, hcpExact: -1.4, hcpGame: -2 }, arcusa])]).pairs;
    expect(p.player1.playingHandicap).toBe(-2);
    expect(p.player1.exactHandicap).toBe(-1.4);
  });

  it('11. caso real 1ª pareja Inferior: Net 44 / Brt 37 con el motor Fourball existente', () => {
    const [p] = adapt([entry([mormeneo, arcusa])]).pairs;
    expect([p.position, p.netPoints, p.grossPoints]).toEqual([1, 44, 37]);
    const fb = buildFourballScorecard({
      player1: {
        playerId: 'a',
        gender: p.player1.gender,
        scorecard: { scores: p.player1.scores, liftedHoles: p.player1.liftedHoles },
        exactHandicap: p.player1.exactHandicap,
        playingHandicap: p.player1.playingHandicap,
      },
      player2: {
        playerId: 'b',
        gender: p.player2.gender,
        scorecard: { scores: p.player2.scores, liftedHoles: p.player2.liftedHoles },
        exactHandicap: p.player2.exactHandicap,
        playingHandicap: p.player2.playingHandicap,
      },
      coursePar: PAR,
      courseHandicap: HCP,
      courseHandicapWomen: HCP,
      officialNetPoints: p.netPoints,
      officialGrossPoints: p.grossPoints,
    });
    expect(fb.calculatedNetPoints).toBe(44);
    expect(fb.calculatedGrossPoints).toBe(37);
    expect(fb.validationStatus).toBe('valid');
  });
});
