/**
 * Parejas Panorámica: la distribución de HCP por hoyo es compartida entre hombres y mujeres.
 * Caso real: J4, Juárez Escolano (F) / Oporto Menéndez (M), Net oficial 40, Brt oficial 24.
 */
import { describe, it, expect } from 'vitest';
import { buildFourballScorecard } from '@/lib/buildFourballScorecard';
import { resolvePairsWomenHoleHandicap } from '@/lib/panoramicaPairsCourse';

const PAR = [4, 5, 3, 5, 3, 4, 3, 4, 5, 4, 5, 3, 4, 4, 4, 3, 4, 5];
const HCP = [10, 14, 18, 4, 16, 6, 12, 8, 2, 1, 5, 11, 17, 7, 3, 15, 13, 9];
const S1 = [4, 5, 3, 8, 5, 5, 4, 6, 6, 4, 6, 4, 5, 5, 6, 3, 5, 6];
const S2 = [6, 5, 3, 6, 5, 5, 4, 5, 6, 6, 6, 5, 5, 5, 4, 4, 6, 5];

describe('resolvePairsWomenHoleHandicap', () => {
  it('usa el course_handicap compartido cuando no hay índices femeninos', () => {
    expect(resolvePairsWomenHoleHandicap(HCP, null)).toEqual(HCP);
    expect(resolvePairsWomenHoleHandicap(HCP, [])).toEqual(HCP);
  });

  it('respeta course_handicap_women cuando existe completo', () => {
    const women = HCP.slice().reverse();
    expect(resolvePairsWomenHoleHandicap(HCP, women)).toEqual(women);
  });

  it('devuelve null si no hay ningún array de 18 índices', () => {
    expect(resolvePairsWomenHoleHandicap(null, null)).toBeNull();
    expect(resolvePairsWomenHoleHandicap([1, 2, 3], null)).toBeNull();
  });
});

describe('pareja mixta con distribución HCP compartida (J4)', () => {
  const card = buildFourballScorecard({
    player1: {
      playerId: 'p1',
      name: 'JUAREZ ESCOLANO, MERCEDES',
      gender: 'F',
      scorecard: { scores: S1 },
      exactHandicap: null,
      playingHandicap: 16,
    },
    player2: {
      playerId: 'p2',
      name: 'OPORTO MENENDEZ, ALFREDO',
      gender: 'M',
      scorecard: { scores: S2 },
      exactHandicap: null,
      playingHandicap: 10,
    },
    coursePar: PAR,
    courseHandicap: HCP,
    courseHandicapWomen: resolvePairsWomenHoleHandicap(HCP, null),
    officialNetPoints: 40,
    officialGrossPoints: 24,
  });

  it('calcula el Net sin quedar en insufficient_data por falta de índices femeninos', () => {
    expect(card.calculatedNetPoints).not.toBeNull();
    expect(card.validationStatus).not.toBe('insufficient_data');
  });

  it('coincide con el Net oficial 40 y queda valid', () => {
    expect(card.calculatedNetPoints).toBe(40);
    expect(card.netMatchesOfficial).toBe(true);
    expect(card.validationStatus).toBe('valid');
  });
});
