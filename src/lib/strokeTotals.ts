/**
 * Totals de GOLPES (no de punts) d'una targeta.
 *
 * Regla única del projecte: un forat sense resultat (bola aixecada, buit, 0, null,
 * no numèric) NO és 0 golpes. Per tant un subtotal només existeix si TOTS els seus
 * forats tenen golpes vàlids; si en falta un, el subtotal és `null` i la UI mostra "—".
 *
 * Aquest helper no toca ni els punts Stableford Net ni els Scratch: un forat sense
 * resultat aporta 0 PUNTS, però invalida només el total de GOLPES.
 */

export type RawStroke = number | string | null | undefined;

/** Un valor de golpes és vàlid si és un enter finit > 0. */
export const isValidStrokeCount = (value: RawStroke): boolean => {
  if (value === null || value === undefined || value === '') return false;
  const n = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  return Number.isFinite(n) && Number.isInteger(n) && n > 0;
};

/** Normalitza a número, o null si el forat no té resultat. */
export const toStrokeCount = (value: RawStroke): number | null =>
  isValidStrokeCount(value) ? Number(value) : null;

/** Suma un tram només si tots els seus forats tenen golpes vàlids. Si no, null. */
export const sumStrokeSegment = (values: RawStroke[], expectedHoles?: number): number | null => {
  if (expectedHoles != null && values.length !== expectedHoles) return null;
  if (values.length === 0) return null;
  let total = 0;
  for (const v of values) {
    const n = toStrokeCount(v);
    if (n == null) return null;
    total += n;
  }
  return total;
};

export interface StrokeTotals {
  /** Golpes dels forats 1-9, o null si en falta algun. */
  out: number | null;
  /** Golpes dels forats 10-18, o null si en falta algun. */
  in: number | null;
  /** Golpes dels 18 forats, o null si en falta algun. */
  total: number | null;
  /** Nombre de forats amb golpes vàlids. */
  validHoles: number;
  /** True només si hi ha 18 forats amb golpes vàlids. */
  isComplete: boolean;
}

/** Calcula Ida / Vuelta / Total de golpes d'una targeta de 18 forats. */
export const computeStrokeTotals = (scores: RawStroke[] | null | undefined): StrokeTotals => {
  const holes = Array.isArray(scores) ? scores : [];
  const validHoles = holes.filter(isValidStrokeCount).length;
  const isComplete = holes.length === 18 && validHoles === 18;
  return {
    out: holes.length >= 9 ? sumStrokeSegment(holes.slice(0, 9), 9) : null,
    in: holes.length >= 18 ? sumStrokeSegment(holes.slice(9, 18), 9) : null,
    total: isComplete ? sumStrokeSegment(holes.slice(0, 18), 18) : null,
    validHoles,
    isComplete,
  };
};
