/**
 * Formateo (NO cálculo) de la clasificación general para el generador de noticias.
 *
 * Las listas de entrada llegan YA ordenadas y calculadas por el motor real de la
 * aplicación (useCompetitionIndividualRanking / buildPairsRanking + rankingTiebreak):
 * puntuación, descartes (best N), categorías y desempates están aplicados antes.
 * Aquí solo se recortan los primeros puestos y se convierten en texto para el prompt.
 */
import { formatPlayerDisplayName } from '@/lib/formatPlayerDisplayName';

export interface NewsRankingEntry {
  position: number;
  name: string;
  total: number;
}

export interface NewsRankingCategory {
  label: string;
  entries: NewsRankingEntry[];
}

export interface NewsRankingContext {
  /** true si la jornada es la última prueba del calendario de la competición. */
  isFinalRound: boolean;
  /** true si la clasificación enviada ya incluye los resultados de esta jornada. */
  includesThisRound: boolean;
  categories: NewsRankingCategory[];
}

export const NEWS_RANKING_TOP_N = 3;

const takeTop = <T,>(list: readonly T[]): T[] => list.slice(0, NEWS_RANKING_TOP_N);

/** Individual y Liga de Verano (formato individual). */
export function buildIndividualNewsRankingCategories(rankings: {
  hcpLow: readonly { name: string; total: number }[];
  hcpHigh: readonly { name: string; total: number }[];
  scratch: readonly { name: string; total: number }[];
}): NewsRankingCategory[] {
  const map: [string, readonly { name: string; total: number }[]][] = [
    ['HÁNDICAP BAJO', rankings.hcpLow],
    ['HÁNDICAP ALTO', rankings.hcpHigh],
    ['SCRATCH', rankings.scratch],
  ];
  return map
    .filter(([, list]) => list.length > 0)
    .map(([label, list]) => ({
      label,
      entries: takeTop(list).map((p, i) => ({
        position: i + 1,
        name: formatPlayerDisplayName(p.name),
        total: p.total,
      })),
    }));
}

/** Parejas: la pareja es la unidad competitiva; displayName ya viene formateado. */
export function buildPairsNewsRankingCategories(rankings: {
  hcpLow: readonly { displayName: string; total: number }[];
  hcpHigh: readonly { displayName: string; total: number }[];
}): NewsRankingCategory[] {
  const map: [string, readonly { displayName: string; total: number }[]][] = [
    ['PAREJAS HÁNDICAP BAJO', rankings.hcpLow],
    ['PAREJAS HÁNDICAP ALTO', rankings.hcpHigh],
  ];
  return map
    .filter(([, list]) => list.length > 0)
    .map(([label, list]) => ({
      label,
      entries: takeTop(list).map((p, i) => ({
        position: i + 1,
        name: p.displayName,
        total: p.total,
      })),
    }));
}

/** Bloque de texto literal que recibe la IA. */
export function formatNewsRankingBlock(ctx: NewsRankingContext): string {
  if (!ctx.categories.length) return 'No hay datos de clasificación general disponibles.';

  const header = ctx.isFinalRound
    ? 'CLASIFICACIÓN GENERAL FINAL (definitiva, calculada por el sistema):'
    : ctx.includesThisRound
      ? 'CLASIFICACIÓN GENERAL PROVISIONAL DESPUÉS DE ESTA JORNADA (calculada por el sistema):'
      : 'CLASIFICACIÓN GENERAL PROVISIONAL CON LAS JORNADAS PUBLICADAS HASTA LA FECHA — NO incluye todavía los resultados de esta jornada:';

  const body = ctx.categories
    .map(
      (cat) =>
        `${cat.label}:\n` +
        cat.entries.map((e) => `${e.position}. ${e.name} — ${e.total} puntos`).join('\n')
    )
    .join('\n\n');

  return `${header}\n\n${body}`;
}
