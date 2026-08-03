/**
 * Validación previa a publicar una jornada de Parejas.
 *
 * Solo lectura: no escribe, no recalcula ni sobrescribe resultados.
 * El Net oficial del Excel sigue siendo la fuente de verdad; aquí únicamente
 * se compara con la tarjeta Fourball derivada para detectar discrepancias.
 */
import { buildFourballScorecard, type FourballValidationStatus } from './buildFourballScorecard';

export interface PairValidationRoundInput {
  coursePar: number[] | null;
  courseHandicap: number[] | null;
  courseHandicapWomen: number[] | null;
}

export interface PairValidationScorecard {
  name?: string | null;
  gender?: string | null;
  scores?: (number | null)[];
  liftedHoles?: number[];
  playingHandicap?: number | null;
}

export interface PairValidationResultInput {
  id: string;
  pairId: string;
  pairName: string;
  netPoints: number;
  grossPoints: number | null;
  player1ExactHandicap: number | null;
  player2ExactHandicap: number | null;
  player1PlayingHandicap: number | null;
  player2PlayingHandicap: number | null;
  player1Scorecard: PairValidationScorecard | null;
  player2Scorecard: PairValidationScorecard | null;
}

export interface PairValidationEntry {
  resultId: string;
  pairId: string;
  pairName: string;
  status: FourballValidationStatus;
  officialNetPoints: number;
  calculatedNetPoints: number | null;
  netDifference: number | null;
  reason: string;
}

export interface PairsRoundValidationSummary {
  entries: PairValidationEntry[];
  valid: PairValidationEntry[];
  mismatch: PairValidationEntry[];
  provisional: PairValidationEntry[];
  insufficientData: PairValidationEntry[];
  canPublish: boolean;
  requiresConfirmation: boolean;
}

const REASON: Record<FourballValidationStatus, string> = {
  valid: 'Cálculo hoyo a hoyo coincide con el Net oficial',
  mismatch: 'El cálculo hoyo a hoyo no coincide con el Net oficial',
  provisional: 'Validación provisional: se ha usado un hándicap de hoyos alternativo',
  insufficient_data: 'Faltan datos completos para comprobar hoyo a hoyo',
};

export function validatePairsRoundPublication(
  round: PairValidationRoundInput,
  results: readonly PairValidationResultInput[],
): PairsRoundValidationSummary {
  const entries: PairValidationEntry[] = results.map((res) => {
    const sc1 = res.player1Scorecard;
    const sc2 = res.player2Scorecard;
    const hpu1 = res.player1PlayingHandicap ?? sc1?.playingHandicap ?? null;
    const hpu2 = res.player2PlayingHandicap ?? sc2?.playingHandicap ?? null;

    const base = {
      resultId: res.id,
      pairId: res.pairId,
      pairName: res.pairName,
      officialNetPoints: res.netPoints,
    };

    if (
      hpu1 == null ||
      hpu2 == null ||
      !round.coursePar ||
      !round.courseHandicap ||
      !sc1?.scores ||
      !sc2?.scores
    ) {
      return {
        ...base,
        status: 'insufficient_data' as const,
        calculatedNetPoints: null,
        netDifference: null,
        reason: REASON.insufficient_data,
      };
    }

    const fourball = buildFourballScorecard({
      player1: {
        playerId: `${res.pairId}-1`,
        name: sc1.name ?? undefined,
        gender: sc1.gender ?? null,
        scorecard: { scores: sc1.scores, liftedHoles: sc1.liftedHoles },
        exactHandicap: res.player1ExactHandicap,
        playingHandicap: hpu1,
      },
      player2: {
        playerId: `${res.pairId}-2`,
        name: sc2.name ?? undefined,
        gender: sc2.gender ?? null,
        scorecard: { scores: sc2.scores, liftedHoles: sc2.liftedHoles },
        exactHandicap: res.player2ExactHandicap,
        playingHandicap: hpu2,
      },
      coursePar: round.coursePar,
      courseHandicap: round.courseHandicap,
      courseHandicapWomen: round.courseHandicapWomen,
      officialNetPoints: res.netPoints,
      officialGrossPoints: res.grossPoints,
    });

    return {
      ...base,
      status: fourball.validationStatus,
      calculatedNetPoints: fourball.calculatedNetPoints,
      netDifference: fourball.netDifference,
      reason: REASON[fourball.validationStatus],
    };
  });

  const valid = entries.filter((e) => e.status === 'valid');
  const mismatch = entries.filter((e) => e.status === 'mismatch');
  const provisional = entries.filter((e) => e.status === 'provisional');
  const insufficientData = entries.filter((e) => e.status === 'insufficient_data');

  return {
    entries,
    valid,
    mismatch,
    provisional,
    insufficientData,
    canPublish: mismatch.length === 0,
    requiresConfirmation:
      mismatch.length === 0 && provisional.length + insufficientData.length > 0,
  };
}
