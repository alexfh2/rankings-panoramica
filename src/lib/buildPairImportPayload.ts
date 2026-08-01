import type { ParsedPair, ParsedPairPlayer } from '@/lib/parsePairExcelResults';
import type { FourballScorecardResult, FourballValidationStatus } from '@/lib/buildFourballScorecard';

/**
 * Contracte del payload esperat per la RPC public.import_pair_results_batch.
 * La RPC llegeix `player1` / `player2` (amb `scores` a dins) i `validationStatus`.
 * No s'envien competitionId, category, pairHandicap, ids de jugador ni de parella:
 * la RPC els resol i els recalcula.
 */
export interface PairImportPlayerPayload {
  name: string;
  licenseRaw: string | null;
  licenseNormalized: string | null;
  gender: 'M' | 'F' | null;
  exactHandicap: number | null;
  playingHandicap: number | null;
  scores: Array<number | null>;
  liftedHoles: number[];
}

export interface PairImportValidationPayload {
  status: FourballValidationStatus | null;
  calculatedNetPoints: number | null;
  calculatedGrossPoints: number | null;
  netDifference: number | null;
  grossDifference: number | null;
}

export interface PairImportPairPayload {
  pairKey: string;
  position: number | null;
  grossPoints: number | null;
  netPoints: number;
  player1: PairImportPlayerPayload;
  player2: PairImportPlayerPayload;
  validationStatus: FourballValidationStatus | null;
  validation: PairImportValidationPayload;
}

export interface PairImportPreviewRow {
  pair: ParsedPair;
  fourball: FourballScorecardResult | null;
}

const toPlayerPayload = (player: ParsedPairPlayer): PairImportPlayerPayload => ({
  name: player.name,
  licenseRaw: player.licenseRaw,
  licenseNormalized: player.licenseNormalized,
  gender: player.gender,
  exactHandicap: player.exactHandicap,
  playingHandicap: player.playingHandicap,
  scores: player.scores,
  liftedHoles: player.liftedHoles,
});

/**
 * Transforma les parelles previsualitzades al payload de la RPC.
 * Es manté l'ordre dels jugadors tal com el retorna el parser:
 * la RPC valida la pairKey i aplica l'ordre canònic.
 */
export function buildPairImportPayload(rows: PairImportPreviewRow[]): PairImportPairPayload[] {
  const payload: PairImportPairPayload[] = [];
  for (const { pair, fourball } of rows) {
    if (!pair.pairKey || pair.netPoints == null) continue;
    payload.push({
      pairKey: pair.pairKey,
      position: pair.position,
      grossPoints: pair.grossPoints,
      netPoints: pair.netPoints,
      player1: toPlayerPayload(pair.player1),
      player2: toPlayerPayload(pair.player2),
      validationStatus: fourball?.validationStatus ?? null,
      validation: {
        status: fourball?.validationStatus ?? null,
        calculatedNetPoints: fourball?.calculatedNetPoints ?? null,
        calculatedGrossPoints: fourball?.calculatedGrossPoints ?? null,
        netDifference: fourball?.netDifference ?? null,
        grossDifference: fourball?.grossDifference ?? null,
      },
    });
  }
  return payload;
}

export interface PairImportRpcSummary {
  roundId?: string;
  competitionId?: string;
  categoryThreshold?: number;
  pairsCreated?: number;
  pairsReused?: number;
  playersCreated?: number;
  playersMatched?: number;
  resultsInserted?: number;
  resultsUpdated?: number;
  warnings?: Array<{ code?: string; pairKey?: string; netPoints?: number; grossPoints?: number }>;
}

const ERROR_MESSAGES: Record<string, string> = {
  NOT_ADMIN: 'No tienes permisos de administrador para importar resultados.',
  ROUND_NOT_FOUND: 'La jornada seleccionada ya no existe.',
  COMPETITION_NOT_PAIRS: 'La jornada no pertenece a una competición de parejas.',
  EMPTY_IMPORT: 'El archivo no contiene parejas para importar.',
  EMPTY_PAYLOAD: 'El archivo no contiene parejas para importar.',
  INVALID_PAIR_PAYLOAD: 'Hay datos incompletos o inválidos en una pareja.',
  PAIR_INCOMPLETE: 'Hay datos incompletos o inválidos en una pareja.',
  MISSING_LICENSE: 'Hay datos incompletos o inválidos en una pareja.',
  MISSING_PAIR_HANDICAP_DATA: 'Hay datos incompletos o inválidos en una pareja.',
  MISSING_NET_POINTS: 'Hay un resultado Net inválido.',
  INVALID_PAIR_KEY: 'La identidad de una pareja no coincide con sus jugadores.',
  PAIR_KEY_MISMATCH: 'La identidad de una pareja no coincide con sus jugadores.',
  DUPLICATE_PAIR: 'El archivo contiene una pareja duplicada.',
  DUPLICATE_PAIR_IN_PAYLOAD: 'El archivo contiene una pareja duplicada.',
  DUPLICATE_PLAYER_IN_PAIR: 'Hay una pareja con el mismo jugador repetido.',
  PLAYER_IN_MULTIPLE_PAIRS: 'Un jugador aparece en dos parejas dentro de la misma jornada.',
  AMBIGUOUS_PLAYER_LICENSE: 'Existe más de un jugador con la misma licencia. Debe revisarse manualmente.',
  PAIR_IDENTITY_CONFLICT: 'La pareja ya existe con una identidad incompatible.',
  PLAYER_IDENTITY_CONFLICT: 'La pareja ya existe con una identidad incompatible.',
  INVALID_NET_POINTS: 'Hay un resultado Net inválido.',
  INVALID_GROSS_POINTS: 'Hay un resultado Brt inválido.',
  INVALID_SCORECARD: 'Hay una tarjeta incompleta o con golpes inválidos.',
};

export const FALLBACK_IMPORT_ERROR =
  'No se ha podido completar la importación. No se ha guardado ningún cambio.';

/** Tradueix els codis d'error de la RPC a missatges clars per l'administrador. */
export function mapPairImportError(rawMessage: string | null | undefined): string {
  if (!rawMessage) return FALLBACK_IMPORT_ERROR;
  for (const [code, message] of Object.entries(ERROR_MESSAGES)) {
    if (rawMessage.includes(code)) return message;
  }
  return FALLBACK_IMPORT_ERROR;
}
