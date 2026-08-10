/**
 * Helpers Stableford puros, extraídos de ScorecardVisual para poder reutilizarlos
 * en tarjetas individuales y en el motor Fourball de parejas.
 * La fórmula es exactamente la misma que ya usan las tarjetas individuales.
 */

/** Hándicap de juego (redondeo al entero más próximo). */
export const calcPlayingHcp = (hcp: number): number => Math.round(hcp);

/**
 * Golpes recibidos (o entregados) en un hoyo según su índice HCP (1..18) y el hándicap del jugador.
 * Funciona simétricamente para HPU positivos y negativos (plus handicap):
 *  - base = trunc(hpu / 18) en todos los hoyos
 *  - remainder > 0 → +1 en los strokeIndex más bajos (1..remainder)
 *  - remainder < 0 → -1 en los strokeIndex más altos (19-|remainder| .. 18)
 */
export const calcExtraStrokes = (strokeIndex: number, playerHcp: number): number => {
  const playingHcp = calcPlayingHcp(playerHcp);
  const base = Math.trunc(playingHcp / 18) || 0; // evita -0
  const remainder = playingHcp - base * 18;
  let strokes = base;
  if (remainder > 0 && strokeIndex <= remainder) strokes += 1;
  if (remainder < 0 && strokeIndex >= 19 - Math.abs(remainder)) strokes -= 1;
  return strokes || 0;
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
