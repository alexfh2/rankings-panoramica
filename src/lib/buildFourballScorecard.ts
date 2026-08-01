/**
 * Motor puro Fourball Stableford de parejas.
 *
 * Deriva la tarjeta de pareja a partir de las dos tarjetas individuales:
 * en cada hoyo se toma el MEJOR resultado Stableford (neto y bruto) de los dos
 * jugadores — nunca el menor número de golpes brutos.
 *
 * Los valores oficiales del Excel (Net / Brt) siguen siendo la fuente de verdad:
 * esta función solo calcula valores derivados y los compara.
 *
 * Sin React, sin Supabase, sin efectos secundarios, sin mutar argumentos, sin `any`.
 */

import { calcExtraStrokes, calcStablefordPoints, calcScratchStablefordPoints } from './stableford';

export type FourballContributor = 'player_1' | 'player_2' | 'tie' | 'none';

export type FourballValidationStatus = 'valid' | 'mismatch' | 'provisional' | 'insufficient_data';

export type FourballWarningCode =
  | 'WOMEN_HOLE_HANDICAP_FALLBACK'
  | 'FOURBALL_NET_MISMATCH'
  | 'FOURBALL_GROSS_MISMATCH'
  | 'INVALID_COURSE_PAR'
  | 'INVALID_COURSE_HANDICAP'
  | 'MISSING_PLAYING_HANDICAP'
  | 'INCOMPLETE_SCORECARD'
  | 'MISSING_OFFICIAL_NET'
  | 'MISSING_OFFICIAL_GROSS';

export interface FourballWarning {
  code: FourballWarningCode;
  message: string;
}

export interface FourballPlayerScorecard {
  /** Puntuaciones por hoyo; null/0 = sin golpes (bola levantada). */
  scores: readonly (number | null)[];
  /** Hoyos con bola levantada, 1-indexados. */
  liftedHoles?: readonly number[];
}

export interface FourballPlayerInput {
  /** Identificador (uuid o local) del jugador. */
  playerId: string;
  name?: string;
  gender?: string | null;
  scorecard: FourballPlayerScorecard;
  exactHandicap?: number | null;
  playingHandicap?: number | null;
}

export interface BuildFourballScorecardInput {
  player1: FourballPlayerInput;
  player2: FourballPlayerInput;
  coursePar?: readonly number[] | null;
  courseHandicap?: readonly number[] | null;
  courseHandicapWomen?: readonly number[] | null;
  officialNetPoints?: number | null;
  officialGrossPoints?: number | null;
}

export interface FourballPlayerHoleResult {
  grossStrokes: number | null;
  strokesReceived: number;
  netStrokes: number | null;
  scratchPoints: number;
  netPoints: number;
  lifted: boolean;
}

export interface FourballHoleResult {
  hole: number;
  par: number;
  holeHandicapPlayer1: number;
  holeHandicapPlayer2: number;
  player1: FourballPlayerHoleResult;
  player2: FourballPlayerHoleResult;
  pairGrossPoints: number;
  pairNetPoints: number;
  grossContributor: FourballContributor;
  netContributor: FourballContributor;
}

export interface FourballScorecardResult {
  holes: FourballHoleResult[];
  calculatedNetPoints: number | null;
  calculatedGrossPoints: number | null;
  officialNetPoints: number | null;
  officialGrossPoints: number | null;
  netMatchesOfficial: boolean | null;
  grossMatchesOfficial: boolean | null;
  netDifference: number | null;
  grossDifference: number | null;
  validationStatus: FourballValidationStatus;
  /** true cuando la validación depende de un fallback (p.ej. HCP femenino). */
  provisional: boolean;
  warnings: FourballWarning[];
  playerNetPoints: { player1: number | null; player2: number | null };
  playerScratchPoints: { player1: number | null; player2: number | null };
}

const HOLES = 18;

const isValidNumberArray = (arr: readonly (number | null)[] | null | undefined): arr is readonly number[] =>
  Array.isArray(arr) && arr.length === HOLES && arr.every((v) => typeof v === 'number' && Number.isFinite(v));

const isFemale = (gender?: string | null): boolean =>
  typeof gender === 'string' && gender.trim().toUpperCase().startsWith('F');

const normalizeScore = (value: number | null | undefined): number | null => {
  if (value == null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  return value;
};

const pickContributor = (p1: number, p2: number): FourballContributor => {
  if (p1 === 0 && p2 === 0) return 'none';
  if (p1 === p2) return 'tie';
  return p1 > p2 ? 'player_1' : 'player_2';
};

export function buildFourballScorecard(input: BuildFourballScorecardInput): FourballScorecardResult {
  if (!input || typeof input !== 'object' || !input.player1 || !input.player2) {
    throw new Error('buildFourballScorecard: se requieren player1 y player2');
  }
  const { player1, player2 } = input;
  for (const p of [player1, player2]) {
    if (!p.scorecard || !Array.isArray(p.scorecard.scores)) {
      throw new Error('buildFourballScorecard: cada jugador requiere scorecard.scores como array');
    }
  }

  const warnings: FourballWarning[] = [];
  const addWarning = (code: FourballWarningCode, message: string) => {
    warnings.push({ code, message });
  };

  const officialNetPoints =
    typeof input.officialNetPoints === 'number' && Number.isFinite(input.officialNetPoints)
      ? input.officialNetPoints
      : null;
  const officialGrossPoints =
    typeof input.officialGrossPoints === 'number' && Number.isFinite(input.officialGrossPoints)
      ? input.officialGrossPoints
      : null;

  const par = isValidNumberArray(input.coursePar) ? input.coursePar : null;
  const menHcp = isValidNumberArray(input.courseHandicap) ? input.courseHandicap : null;
  const womenHcp = isValidNumberArray(input.courseHandicapWomen) ? input.courseHandicapWomen : null;

  let insufficient = false;
  if (!par) {
    addWarning('INVALID_COURSE_PAR', 'El par del campo no contiene 18 valores numéricos válidos.');
    insufficient = true;
  }
  if (!menHcp) {
    addWarning('INVALID_COURSE_HANDICAP', 'El índice HCP del campo no contiene 18 valores numéricos válidos.');
    insufficient = true;
  }

  let provisional = false;
  const holeHcpFor = (p: FourballPlayerInput): readonly number[] | null => {
    if (isFemale(p.gender)) {
      if (womenHcp) return womenHcp;
      if (menHcp) {
        provisional = true;
        addWarning(
          'WOMEN_HOLE_HANDICAP_FALLBACK',
          `No hay índice HCP femenino en la jornada; se usa el masculino como fallback para ${p.name ?? p.playerId}. Validación provisional.`
        );
        return menHcp;
      }
      return null;
    }
    return menHcp;
  };

  const hcp1 = holeHcpFor(player1);
  const hcp2 = holeHcpFor(player2);

  const playingHandicapFor = (p: FourballPlayerInput): number | null => {
    if (typeof p.playingHandicap === 'number' && Number.isFinite(p.playingHandicap)) return p.playingHandicap;
    addWarning(
      'MISSING_PLAYING_HANDICAP',
      `Falta el hándicap de juego de ${p.name ?? p.playerId}; no se pueden calcular puntos netos.`
    );
    insufficient = true;
    return null;
  };

  const ph1 = playingHandicapFor(player1);
  const ph2 = playingHandicapFor(player2);

  const scoresFor = (p: FourballPlayerInput): (number | null)[] => {
    const lifted = new Set<number>(
      Array.isArray(p.scorecard.liftedHoles) ? p.scorecard.liftedHoles.filter((h) => typeof h === 'number') : []
    );
    const out: (number | null)[] = [];
    for (let i = 0; i < HOLES; i++) {
      out.push(lifted.has(i + 1) ? null : normalizeScore(p.scorecard.scores[i]));
    }
    if (p.scorecard.scores.length !== HOLES) {
      addWarning(
        'INCOMPLETE_SCORECARD',
        `La tarjeta de ${p.name ?? p.playerId} no contiene 18 hoyos (${p.scorecard.scores.length}).`
      );
      insufficient = true;
    }
    return out;
  };

  const scores1 = scoresFor(player1);
  const scores2 = scoresFor(player2);

  const liftedSet = (p: FourballPlayerInput): Set<number> =>
    new Set<number>(Array.isArray(p.scorecard.liftedHoles) ? p.scorecard.liftedHoles : []);
  const lifted1 = liftedSet(player1);
  const lifted2 = liftedSet(player2);

  const buildPlayerHole = (
    gross: number | null,
    holePar: number | null,
    strokeIndex: number | null,
    playingHcp: number | null,
    liftedFlag: boolean
  ): FourballPlayerHoleResult => {
    const received =
      strokeIndex != null && playingHcp != null ? calcExtraStrokes(strokeIndex, playingHcp) : 0;
    if (gross == null || holePar == null) {
      return {
        grossStrokes: null,
        strokesReceived: received,
        netStrokes: null,
        scratchPoints: 0,
        netPoints: 0,
        lifted: liftedFlag || gross == null,
      };
    }
    const scratch = calcScratchStablefordPoints(gross, holePar) ?? 0;
    const net =
      strokeIndex != null && playingHcp != null
        ? calcStablefordPoints(gross, holePar, strokeIndex, playingHcp) ?? 0
        : 0;
    return {
      grossStrokes: gross,
      strokesReceived: received,
      netStrokes: gross - received,
      scratchPoints: scratch,
      netPoints: net,
      lifted: liftedFlag,
    };
  };

  const holes: FourballHoleResult[] = [];
  for (let i = 0; i < HOLES; i++) {
    const holePar = par ? par[i] : null;
    const si1 = hcp1 ? hcp1[i] : null;
    const si2 = hcp2 ? hcp2[i] : null;

    const p1 = buildPlayerHole(scores1[i], holePar, si1, ph1, lifted1.has(i + 1) || scores1[i] == null);
    const p2 = buildPlayerHole(scores2[i], holePar, si2, ph2, lifted2.has(i + 1) || scores2[i] == null);

    holes.push({
      hole: i + 1,
      par: holePar ?? 0,
      holeHandicapPlayer1: si1 ?? 0,
      holeHandicapPlayer2: si2 ?? 0,
      player1: p1,
      player2: p2,
      pairGrossPoints: Math.max(p1.scratchPoints, p2.scratchPoints),
      pairNetPoints: Math.max(p1.netPoints, p2.netPoints),
      grossContributor: pickContributor(p1.scratchPoints, p2.scratchPoints),
      netContributor: pickContributor(p1.netPoints, p2.netPoints),
    });
  }

  const calculatedNetPoints = insufficient
    ? null
    : holes.reduce((sum, h) => sum + h.pairNetPoints, 0);
  const calculatedGrossPoints = insufficient
    ? null
    : holes.reduce((sum, h) => sum + h.pairGrossPoints, 0);

  const netDifference =
    calculatedNetPoints != null && officialNetPoints != null ? calculatedNetPoints - officialNetPoints : null;
  const grossDifference =
    calculatedGrossPoints != null && officialGrossPoints != null
      ? calculatedGrossPoints - officialGrossPoints
      : null;

  const netMatchesOfficial = netDifference == null ? null : netDifference === 0;
  const grossMatchesOfficial = grossDifference == null ? null : grossDifference === 0;

  if (officialNetPoints == null) {
    addWarning('MISSING_OFFICIAL_NET', 'No hay resultado Net oficial con el que comparar.');
  }
  if (officialGrossPoints == null) {
    addWarning('MISSING_OFFICIAL_GROSS', 'No hay resultado Brt oficial con el que comparar.');
  }
  if (netMatchesOfficial === false && netDifference != null) {
    addWarning(
      'FOURBALL_NET_MISMATCH',
      `Net calculado ${calculatedNetPoints} vs oficial ${officialNetPoints} (diferencia ${netDifference > 0 ? '+' : ''}${netDifference}). Se conserva el valor oficial.`
    );
  }
  if (grossMatchesOfficial === false && grossDifference != null) {
    addWarning(
      'FOURBALL_GROSS_MISMATCH',
      `Brt calculado ${calculatedGrossPoints} vs oficial ${officialGrossPoints} (diferencia ${grossDifference > 0 ? '+' : ''}${grossDifference}). Se conserva el valor oficial.`
    );
  }

  let validationStatus: FourballValidationStatus;
  if (insufficient) {
    validationStatus = 'insufficient_data';
  } else if (netMatchesOfficial === false || grossMatchesOfficial === false) {
    validationStatus = 'mismatch';
  } else if (provisional || netMatchesOfficial == null) {
    validationStatus = 'provisional';
  } else {
    validationStatus = 'valid';
  }

  return {
    holes,
    calculatedNetPoints,
    calculatedGrossPoints,
    officialNetPoints,
    officialGrossPoints,
    netMatchesOfficial,
    grossMatchesOfficial,
    netDifference,
    grossDifference,
    validationStatus,
    provisional,
    warnings,
    playerNetPoints: {
      player1: insufficient ? null : holes.reduce((s, h) => s + h.player1.netPoints, 0),
      player2: insufficient ? null : holes.reduce((s, h) => s + h.player2.netPoints, 0),
    },
    playerScratchPoints: {
      player1: insufficient ? null : holes.reduce((s, h) => s + h.player1.scratchPoints, 0),
      player2: insufficient ? null : holes.reduce((s, h) => s + h.player2.scratchPoints, 0),
    },
  };
}
