/**
 * Adaptador GolfDirecto Parelles → format intern de l'importador de Parelles.
 *
 * Converteix la resposta de la funció parse-golfdirecto-pairs al mateix
 * ParsePairExcelResult que produeix l'Excel, perquè tots dos comparteixin
 * vista prèvia, validació Fourball, buildPairImportPayload i RPC.
 *
 * No calcula Fourball, no assigna la categoria oficial (ho fa el backend)
 * i no utilitza l'identificador de GolfDirecto com a identitat.
 */
import {
  buildPairKey,
  classifyPairLicense,
  normalizePairLicense,
  DEFAULT_PAIR_CATEGORY_THRESHOLD,
  type PairParseIssue,
  type ParsedPair,
  type ParsedPairCategory,
  type ParsedPairPlayer,
  type ParsePairExcelResult,
} from '@/lib/parsePairExcelResults';

export interface GolfDirectoPairsRawPlayer {
  sourcePlayerId: string | null;
  firstName: string | null;
  surname: string | null;
  license: string | null;
  gender: string | null;
  hcpExact: number | null;
  hcpGame: number | null;
  /** gross1..18 tal com els dona GolfDirecto (0 = sense resultat). null si no hi ha targeta. */
  gross: Array<number | null> | null;
}

export interface GolfDirectoPairsRawEntry {
  sourceCategoryId: string;
  sourceCategoryName: string;
  sourceGroupId: string | null;
  position: number | null;
  netPoints: number | null;
  grossPoints: number | null;
  players: GolfDirectoPairsRawPlayer[];
}

export interface GolfDirectoPairsResponse {
  success: boolean;
  game?: { id: string; name: string | null; date: string | null };
  categories?: { id: string; name: string }[];
  entries?: GolfDirectoPairsRawEntry[];
  code?: string;
  error?: string;
}

const issue = (code: string, message: string, blocking: boolean, field?: string): PairParseIssue => ({
  code,
  message,
  blocking,
  ...(field ? { field } : {}),
});

const formatName = (p: GolfDirectoPairsRawPlayer): string => {
  const surname = (p.surname ?? '').trim();
  const first = (p.firstName ?? '').trim();
  return surname && first ? `${surname}, ${first}` : surname || first;
};

/** gross 0 (o buit) → null i el forat queda a liftedHoles. */
export const normalizeGolfDirectoScores = (
  gross: Array<number | null> | null,
): { scores: Array<number | null>; liftedHoles: number[] } => {
  const scores: Array<number | null> = [];
  const liftedHoles: number[] = [];
  for (let h = 0; h < 18; h++) {
    const v = gross ? gross[h] : null;
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
      scores.push(Math.round(v));
    } else {
      scores.push(null);
      if (gross && (v === 0 || v === null)) liftedHoles.push(h + 1);
    }
  }
  return { scores, liftedHoles };
};

const toPlayer = (p: GolfDirectoPairsRawPlayer | undefined, index: number): ParsedPairPlayer => {
  const warnings: PairParseIssue[] = [];
  const errors: PairParseIssue[] = [];
  const raw = p ?? {
    sourcePlayerId: null, firstName: null, surname: null, license: null,
    gender: null, hcpExact: null, hcpGame: null, gross: null,
  };
  const name = formatName(raw);
  const licenseRaw = raw.license && raw.license.trim() ? raw.license.trim() : null;
  const licenseNormalized = normalizePairLicense(licenseRaw);
  if (!licenseNormalized) {
    warnings.push(issue('MISSING_LICENSE', `Falta licencia — revisión manual (${name || `jugador ${index}`})`, false, 'license'));
  }
  if (!raw.gross) {
    warnings.push(issue('MISSING_SCORECARD', `No se ha podido descargar la tarjeta de ${name || `jugador ${index}`}`, false));
  }
  const { scores, liftedHoles } = normalizeGolfDirectoScores(raw.gross);
  const gender = raw.gender === 'M' || raw.gender === 'F' ? raw.gender : null;
  return {
    sourceRow: index,
    name,
    licenseRaw,
    licenseNormalized,
    licenseKind: classifyPairLicense(licenseNormalized),
    exactHandicap: raw.hcpExact,
    // HPU tal com arriba, sense Math.abs.
    playingHandicap: raw.hcpGame,
    gender,
    scores,
    liftedHoles,
    warnings,
    errors,
  };
};

const sameEntry = (a: GolfDirectoPairsRawEntry, b: GolfDirectoPairsRawEntry): boolean =>
  a.netPoints === b.netPoints &&
  a.grossPoints === b.grossPoints &&
  JSON.stringify([...a.players].sort((x, y) => String(x.license).localeCompare(String(y.license)))) ===
    JSON.stringify([...b.players].sort((x, y) => String(x.license).localeCompare(String(y.license))));

export interface GolfDirectoPairsAdaptOptions {
  /** Només per a la vista prèvia; la categoria oficial la calcula el backend. */
  categoryThreshold?: number;
}

export function golfDirectoPairsToParsedPairs(
  response: GolfDirectoPairsResponse,
  options: GolfDirectoPairsAdaptOptions = {},
): ParsePairExcelResult {
  const threshold = options.categoryThreshold ?? DEFAULT_PAIR_CATEGORY_THRESHOLD;
  const errors: PairParseIssue[] = [];
  const warnings: PairParseIssue[] = [];
  const entries = response.entries ?? [];

  // Deduplicació per pairKey de llicències (mai per nom).
  const kept: { entry: GolfDirectoPairsRawEntry; conflict: boolean }[] = [];
  const byKey = new Map<string, number>();
  for (const entry of entries) {
    const lics = entry.players.map((p) => normalizePairLicense(p.license));
    const key = entry.players.length === 2 && lics[0] && lics[1] ? [lics[0], lics[1]].sort().join('|') : null;
    if (key && byKey.has(key)) {
      const idx = byKey.get(key)!;
      if (sameEntry(kept[idx].entry, entry)) {
        warnings.push(issue('DUPLICATE_PAIR_ACROSS_CATEGORIES', `Pareja ${key} repetida en varias categorías de GolfDirecto: se importa una sola vez`, false));
        continue;
      }
      kept[idx].conflict = true;
      kept.push({ entry, conflict: true });
      continue;
    }
    if (key) byKey.set(key, kept.length);
    kept.push({ entry, conflict: false });
  }

  const pairs: ParsedPair[] = kept.map(({ entry, conflict }, i) => {
    const pairErrors: PairParseIssue[] = [];
    const pairWarnings: PairParseIssue[] = [];
    if (entry.players.length !== 2) {
      pairErrors.push(issue('UNEXPECTED_PAIR_SIZE', `La entrada de GolfDirecto tiene ${entry.players.length} jugador(es); se esperaban 2`, true));
    }
    const player1 = toPlayer(entry.players[0], i * 2 + 1);
    const player2 = toPlayer(entry.players[1], i * 2 + 2);
    const { pairKey, kind } = buildPairKey(player1, player2);
    const needsManualReview = kind !== 'licenses';
    if (kind === 'none') {
      pairErrors.push(issue('PAIR_WITHOUT_LICENSES', 'Ninguno de los dos jugadores tiene licencia', true, 'license'));
    } else if (kind === 'name_fallback') {
      pairWarnings.push(issue('IDENTITY_USES_NAME_FALLBACK', 'Falta una licencia — revisión manual antes de importar', false, 'license'));
    }
    if (conflict) {
      pairErrors.push(issue('PAIR_SOURCE_CONFLICT', `La pareja ${pairKey} aparece en varias categorías con datos diferentes`, true));
    }
    const pairHandicap =
      player1.exactHandicap != null && player2.exactHandicap != null
        ? (player1.exactHandicap + player2.exactHandicap) / 2
        : null;
    if (pairHandicap == null) {
      pairErrors.push(issue('MISSING_PAIR_HANDICAP_DATA', 'Falta el hándicap exacto de algún jugador', true, 'hex'));
    }
    if (entry.netPoints == null) {
      pairErrors.push(issue('MISSING_NET_POINTS', 'Falta el Net oficial de la pareja', true, 'net'));
    }
    if (entry.grossPoints == null) {
      pairWarnings.push(issue('MISSING_GROSS_POINTS', 'Falta el Brt oficial de la pareja', false, 'gross'));
    }
    const category: ParsedPairCategory | null =
      pairHandicap == null ? null : pairHandicap <= threshold ? 'hcp_low' : 'hcp_high';
    return {
      sourceRows: [i + 1],
      position: entry.position != null ? Math.trunc(entry.position) : null,
      pairKey,
      pairKeyKind: kind,
      needsManualReview,
      player1,
      player2,
      pairHandicap,
      category,
      grossPoints: entry.grossPoints != null ? Math.round(entry.grossPoints) : null,
      netPoints: entry.netPoints != null ? Math.round(entry.netPoints) : null,
      isValid: pairErrors.length === 0,
      warnings: pairWarnings,
      errors: pairErrors,
    };
  });

  // Jugador en més d'una parella diferent
  const byLicense = new Map<string, Set<number>>();
  pairs.forEach((pair, index) => {
    for (const p of [pair.player1, pair.player2]) {
      if (!p.licenseNormalized) continue;
      const set = byLicense.get(p.licenseNormalized) ?? new Set<number>();
      set.add(index);
      byLicense.set(p.licenseNormalized, set);
    }
  });
  for (const [license, set] of byLicense) {
    if (set.size < 2) continue;
    for (const index of set) {
      if (pairs[index].errors.some((e) => e.code === 'PAIR_SOURCE_CONFLICT')) continue;
      pairs[index].errors.push(issue('PLAYER_IN_MULTIPLE_PAIRS', `El jugador con licencia ${license} aparece en más de una pareja`, true, 'license'));
      pairs[index].isValid = false;
    }
  }

  for (const pair of pairs) {
    errors.push(...pair.errors);
    warnings.push(...pair.warnings, ...pair.player1.warnings, ...pair.player2.warnings);
  }

  return {
    sheetName: null,
    headerRow: null,
    pairs,
    errors,
    warnings,
    summary: {
      totalPairs: pairs.length,
      validPairs: pairs.filter((p) => p.isValid).length,
      invalidPairs: pairs.filter((p) => !p.isValid).length,
      totalPlayers: pairs.reduce((a, p) => a + (p.player1.name ? 1 : 0) + (p.player2.name ? 1 : 0), 0),
      headerRow: null,
      sheetName: null,
    },
  };
}
