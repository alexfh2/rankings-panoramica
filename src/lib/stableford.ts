/**
 * Helpers Stableford puros, extraídos de ScorecardVisual para poder reutilizarlos
 * en tarjetas individuales y en el motor Fourball de parejas.
 * La fórmula es exactamente la misma que ya usan las tarjetas individuales.
 */

/** Hándicap de juego (redondeo al entero más próximo). */
export const calcPlayingHcp = (hcp: number): number => Math.round(hcp);

/** Golpes recibidos en un hoyo según su índice HCP (1..18) y el hándicap del jugador. */
export const calcExtraStrokes = (strokeIndex: number, playerHcp: number): number => {
  const playingHcp = calcPlayingHcp(playerHcp);
  const fullStrokes = Math.floor(playingHcp / 18);
  const remainder = playingHcp % 18;
  return fullStrokes + (strokeIndex <= remainder ? 1 : 0);
};

/** Puntos Stableford a partir de golpes netos respecto al par. */
export const stablefordFromNetDiff = (diff: number): number => {
  if (diff <= -3) return 5;
  if (diff === -2) return 4;
  if (diff === -1) return 3;
  if (diff === 0) return 2;
  if (diff === 1) return 1;
  return 0;
};

/** Puntos Stableford con hándicap de un hoyo. null si no hay golpes (bola levantada). */
export const calcStablefordPoints = (
  gross: number,
  holePar: number,
  strokeIndex: number,
  playerHcp: number
): number | null => {
  if (gross == null || gross === 0) return null;
  const extra = calcExtraStrokes(strokeIndex, playerHcp);
  return stablefordFromNetDiff(gross - extra - holePar);
};

/** Puntos Stableford scratch (sin hándicap) de un hoyo. null si no hay golpes. */
export const calcScratchStablefordPoints = (gross: number, holePar: number): number | null => {
  if (gross == null || gross === 0) return null;
  return stablefordFromNetDiff(gross - holePar);
};
