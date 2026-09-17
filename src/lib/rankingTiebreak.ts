/**
 * Desempate oficial 2026 (Individual y Parejas) para las clasificaciones generales.
 *
 * Secuencia:
 *   1. Mayor puntuación TOTAL computable (calculada fuera de este módulo).
 *   2. Mejor resultado en la ÚLTIMA prueba celebrada/publicada del circuito.
 *   3. Mayor número de pruebas disputadas.
 *   4. Mejor resultado en la penúltima prueba, y así sucesivamente hacia atrás.
 *   5. Si todo coincide → 0 (empate real, lo resuelve el Comité de Competición).
 *
 * Una ausencia NO se convierte en puntuación deportiva: internamente se trata como
 * "sin resultado", que pierde frente a cualquier resultado presente y empata con otra ausencia.
 */

export type RoundScoreLookup = (roundId: string) => number | null | undefined;

/** Devuelve <0 si a va delante, >0 si b va delante, 0 si empatan en esa jornada. */
const compareRoundScore = (
  a: number | null | undefined,
  b: number | null | undefined
): number => {
  const aHas = typeof a === 'number' && Number.isFinite(a);
  const bHas = typeof b === 'number' && Number.isFinite(b);
  if (!aHas && !bHas) return 0;
  if (!aHas) return 1;
  if (!bHas) return -1;
  return (b as number) - (a as number);
};

export interface TiebreakCompetitor {
  total: number;
  roundsPlayed: number;
  /** Puntuación de la jornada indicada, o null/undefined si no participó. */
  scoreForRound: RoundScoreLookup;
}

/**
 * @param roundIdsChronological IDs de las jornadas celebradas/publicadas, de la más antigua
 *   a la más reciente. No debe incluir jornadas futuras no celebradas.
 */
export function compareRankingWithTiebreak(
  a: TiebreakCompetitor,
  b: TiebreakCompetitor,
  roundIdsChronological: readonly string[]
): number {
  if (b.total !== a.total) return b.total - a.total;

  const reversed = [...roundIdsChronological].reverse();

  // 2. Última prueba celebrada.
  if (reversed.length > 0) {
    const cmp = compareRoundScore(a.scoreForRound(reversed[0]), b.scoreForRound(reversed[0]));
    if (cmp !== 0) return cmp;
  }

  // 3. Número de pruebas disputadas.
  if (b.roundsPlayed !== a.roundsPlayed) return b.roundsPlayed - a.roundsPlayed;

  // 4. Jornadas anteriores, sucesivamente hacia atrás.
  for (let i = 1; i < reversed.length; i += 1) {
    const cmp = compareRoundScore(a.scoreForRound(reversed[i]), b.scoreForRound(reversed[i]));
    if (cmp !== 0) return cmp;
  }

  // 5. Empate real.
  return 0;
}
