import { describe, it, expect } from 'vitest';
import { buildFourballScorecard } from './buildFourballScorecard';

const PAR = [4, 4, 5, 3, 5, 3, 4, 4, 4, 4, 5, 3, 4, 5, 4, 4, 3, 5];
const HCP = [10, 4, 12, 16, 8, 18, 2, 6, 14, 9, 11, 17, 1, 13, 5, 7, 15, 3];
const HCP_W = [8, 6, 12, 16, 10, 18, 2, 4, 14, 11, 9, 17, 1, 13, 3, 7, 15, 5];

const scoresAllPar = () => PAR.slice();

const player = (over: Partial<Parameters<typeof buildFourballScorecard>[0]['player1']> = {}) => ({
  playerId: 'p',
  gender: 'M',
  scorecard: { scores: scoresAllPar(), liftedHoles: [] },
  exactHandicap: 0,
  playingHandicap: 0,
  ...over,
});

const base = (over: Partial<Parameters<typeof buildFourballScorecard>[0]> = {}) =>
  buildFourballScorecard({
    player1: player({ playerId: 'p1' }),
    player2: player({ playerId: 'p2' }),
    coursePar: PAR,
    courseHandicap: HCP,
    officialNetPoints: 36,
    officialGrossPoints: 36,
    ...over,
  });

describe('buildFourballScorecard', () => {
  it('suma 36 puntos con dos tarjetas al par y hcp 0', () => {
    const r = base();
    expect(r.calculatedNetPoints).toBe(36);
    expect(r.calculatedGrossPoints).toBe(36);
    expect(r.holes).toHaveLength(18);
  });

  it('el jugador 1 aporta el hoyo', () => {
    const s1 = scoresAllPar();
    s1[0] = PAR[0] - 1;
    const r = base({ player1: player({ playerId: 'p1', scorecard: { scores: s1, liftedHoles: [] } }) });
    expect(r.holes[0].netContributor).toBe('player_1');
    expect(r.holes[0].pairNetPoints).toBe(3);
  });

  it('el jugador 2 aporta el hoyo', () => {
    const s2 = scoresAllPar();
    s2[1] = PAR[1] - 2;
    const r = base({ player2: player({ playerId: 'p2', scorecard: { scores: s2, liftedHoles: [] } }) });
    expect(r.holes[1].netContributor).toBe('player_2');
    expect(r.holes[1].pairNetPoints).toBe(4);
  });

  it('empate entre ambos', () => {
    const r = base();
    expect(r.holes[0].netContributor).toBe('tie');
  });

  it('ambos obtienen 0 puntos', () => {
    const s = scoresAllPar().map((p) => p + 3);
    const r = base({
      player1: player({ playerId: 'p1', scorecard: { scores: s, liftedHoles: [] } }),
      player2: player({ playerId: 'p2', scorecard: { scores: s, liftedHoles: [] } }),
    });
    expect(r.holes[0].pairNetPoints).toBe(0);
    expect(r.holes[0].netContributor).toBe('none');
  });

  it('el menor golpe bruto no siempre da el mejor resultado neto', () => {
    // Hoyo 13 (índice 12) tiene HCP 1 -> el jugador 2 con hcp 1 recibe golpe ahí.
    const s1 = scoresAllPar();
    s1[12] = PAR[12]; // par, sin golpe recibido -> 2 puntos
    const s2 = scoresAllPar();
    s2[12] = PAR[12] + 1; // bogey bruto (peor golpes) pero con golpe recibido -> 2 puntos
    const r = base({
      player1: player({ playerId: 'p1', scorecard: { scores: s1, liftedHoles: [] }, playingHandicap: 0 }),
      player2: player({ playerId: 'p2', scorecard: { scores: s2, liftedHoles: [] }, playingHandicap: 1 }),
    });
    expect(r.holes[12].player1.grossStrokes).toBeLessThan(r.holes[12].player2.grossStrokes!);
    expect(r.holes[12].player2.netPoints).toBe(r.holes[12].player1.netPoints);
    expect(r.holes[12].netContributor).toBe('tie');
    // El bruto sí distingue
    expect(r.holes[12].grossContributor).toBe('player_1');
  });

  it('asigna un golpe de hándicap en el hoyo de índice 1', () => {
    const r = base({
      player1: player({ playerId: 'p1', playingHandicap: 1 }),
    });
    expect(r.holes[12].player1.strokesReceived).toBe(1);
    expect(r.holes[0].player1.strokesReceived).toBe(0);
    expect(r.holes[12].player1.netPoints).toBe(3);
  });

  it('asigna más de 18 golpes correctamente', () => {
    const r = base({ player1: player({ playerId: 'p1', playingHandicap: 20 }) });
    // 20 = 1 golpe en todos + 1 extra en índices <= 2
    expect(r.holes[12].player1.strokesReceived).toBe(2); // índice 1
    expect(r.holes[6].player1.strokesReceived).toBe(2); // índice 2
    expect(r.holes[0].player1.strokesReceived).toBe(1); // índice 10
  });

  it('bola levantada da 0 puntos y no inventa golpes', () => {
    const s1 = scoresAllPar();
    s1[4] = null;
    const r = base({
      player1: player({ playerId: 'p1', scorecard: { scores: s1, liftedHoles: [5] } }),
    });
    expect(r.holes[4].player1.grossStrokes).toBeNull();
    expect(r.holes[4].player1.netPoints).toBe(0);
    expect(r.holes[4].player1.scratchPoints).toBe(0);
    expect(r.holes[4].player1.lifted).toBe(true);
    expect(r.holes[4].netContributor).toBe('player_2');
  });

  it('coincide con el Net oficial', () => {
    const r = base({ officialNetPoints: 36 });
    expect(r.netMatchesOfficial).toBe(true);
    expect(r.netDifference).toBe(0);
    expect(r.validationStatus).toBe('valid');
  });

  it('detecta discrepancia con el Net oficial sin sobrescribirlo', () => {
    const r = base({ officialNetPoints: 40 });
    expect(r.netMatchesOfficial).toBe(false);
    expect(r.netDifference).toBe(-4);
    expect(r.officialNetPoints).toBe(40);
    expect(r.calculatedNetPoints).toBe(36);
    expect(r.validationStatus).toBe('mismatch');
    expect(r.warnings.some((w) => w.code === 'FOURBALL_NET_MISMATCH')).toBe(true);
  });

  it('coincide con el Brt oficial', () => {
    const r = base({ officialGrossPoints: 36 });
    expect(r.grossMatchesOfficial).toBe(true);
    expect(r.grossDifference).toBe(0);
  });

  it('usa course_handicap_women cuando existe', () => {
    const r = base({
      player1: player({ playerId: 'p1', gender: 'F', playingHandicap: 1 }),
      courseHandicapWomen: HCP_W,
    });
    // índice 1 femenino también es el hoyo 13
    expect(r.holes[12].holeHandicapPlayer1).toBe(1);
    expect(r.holes[14].holeHandicapPlayer1).toBe(3); // difiere del masculino (5)
    expect(r.warnings.some((w) => w.code === 'WOMEN_HOLE_HANDICAP_FALLBACK')).toBe(false);
  });

  it('marca provisional el fallback femenino', () => {
    const r = base({ player1: player({ playerId: 'p1', gender: 'F', playingHandicap: 1 }) });
    expect(r.provisional).toBe(true);
    expect(r.validationStatus).toBe('provisional');
    expect(r.warnings.some((w) => w.code === 'WOMEN_HOLE_HANDICAP_FALLBACK')).toBe(true);
  });

  it('devuelve insufficient_data sin par válido', () => {
    const r = base({ coursePar: [4, 4, 4] });
    expect(r.validationStatus).toBe('insufficient_data');
    expect(r.calculatedNetPoints).toBeNull();
    expect(r.warnings.some((w) => w.code === 'INVALID_COURSE_PAR')).toBe(true);
  });

  it('devuelve insufficient_data sin hándicap de juego', () => {
    const r = base({ player2: player({ playerId: 'p2', playingHandicap: null }) });
    expect(r.validationStatus).toBe('insufficient_data');
    expect(r.warnings.some((w) => w.code === 'MISSING_PLAYING_HANDICAP')).toBe(true);
  });

  it('lanza error solo con entrada estructuralmente inválida', () => {
    expect(() =>
      buildFourballScorecard({
        // @ts-expect-error entrada inválida a propósito
        player1: { playerId: 'x' },
        player2: player({ playerId: 'p2' }),
      })
    ).toThrow();
  });

  it('no muta los argumentos de entrada', () => {
    const scores = scoresAllPar();
    const snapshot = scores.slice();
    base({ player1: player({ playerId: 'p1', scorecard: { scores, liftedHoles: [] } }) });
    expect(scores).toEqual(snapshot);
  });
});
