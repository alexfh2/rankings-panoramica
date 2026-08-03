import * as XLSX from 'xlsx';

/**
 * Parser pur per als Excel de l'Orde del Mèrit de Parelles (Fourball Stableford).
 * No depèn de Supabase, React ni de cap component visual. No modifica el workbook rebut.
 */

export type PairParseIssue = {
  code: string;
  message: string;
  row?: number;
  field?: string;
  blocking: boolean;
};

export type PairLicenseKind = 'federativa' | 'no_federativa' | 'missing';

export type ParsedPairPlayer = {
  sourceRow: number;
  name: string;
  licenseRaw: string | null;
  licenseNormalized: string | null;
  licenseKind: PairLicenseKind;
  exactHandicap: number | null;
  playingHandicap: number | null;
  gender: 'M' | 'F' | null;
  scores: Array<number | null>;
  liftedHoles: number[];
  warnings: PairParseIssue[];
  errors: PairParseIssue[];
};

export type ParsedPairCategory = 'hcp_low' | 'hcp_high';

export type ParsedPair = {
  sourceRows: number[];
  position: number | null;
  pairKey: string | null;
  pairKeyKind: 'licenses' | 'name_fallback' | 'none';
  needsManualReview: boolean;
  player1: ParsedPairPlayer;
  player2: ParsedPairPlayer;
  pairHandicap: number | null;
  category: ParsedPairCategory | null;
  grossPoints: number | null;
  netPoints: number | null;
  isValid: boolean;
  warnings: PairParseIssue[];
  errors: PairParseIssue[];
};

export type ParsePairExcelSummary = {
  totalPairs: number;
  validPairs: number;
  invalidPairs: number;
  totalPlayers: number;
  headerRow: number | null;
  sheetName: string | null;
};

export type ParsePairExcelResult = {
  sheetName: string | null;
  headerRow: number | null;
  pairs: ParsedPair[];
  errors: PairParseIssue[];
  warnings: PairParseIssue[];
  summary: ParsePairExcelSummary;
};

export type ParsePairExcelOptions = {
  categoryThreshold?: number;
  sheetName?: string;
};

export const DEFAULT_PAIR_CATEGORY_THRESHOLD = 15.4;

const FEDERATIVE_LICENSE_RE = /^[A-Z]{2}\d{8}$/;

/* ------------------------------------------------------------------ helpers */

function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/** Normalitza un nom per a comparacions i claus de fallback. */
export function normalizePairPlayerName(value: unknown): string {
  return String(value ?? '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]/g, '');
}

/** Normalitza una llicència sense perdre zeros inicials ni convertir-la a number. */
export function normalizePairLicense(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    const asString = Number.isInteger(value) ? String(value) : String(value);
    return asString.toUpperCase();
  }
  const cleaned = String(value)
    .trim()
    .replace(/[\s.\-_/]/g, '')
    .toUpperCase();
  return cleaned.length > 0 ? cleaned : null;
}

export function classifyPairLicense(normalized: string | null): PairLicenseKind {
  if (!normalized) return 'missing';
  return FEDERATIVE_LICENSE_RE.test(normalized) ? 'federativa' : 'no_federativa';
}

/** Converteix valors amb coma decimal ("15,9", " 10,5 ", 8.2) a number. */
export function parsePairDecimal(value: unknown): { value: number | null; malformed: boolean } {
  if (value === null || value === undefined) return { value: null, malformed: false };
  if (typeof value === 'number') {
    return Number.isFinite(value) ? { value, malformed: false } : { value: null, malformed: true };
  }
  const raw = String(value).trim();
  if (raw === '' || raw === '-') return { value: null, malformed: false };
  const cleaned = raw.replace(/\s/g, '').replace(',', '.');
  if (!/^[+-]?\d+(\.\d+)?$/.test(cleaned)) return { value: null, malformed: true };
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? { value: parsed, malformed: false } : { value: null, malformed: true };
}

function parseIntegerCell(value: unknown): { value: number | null; malformed: boolean } {
  const parsed = parsePairDecimal(value);
  if (parsed.value === null) return parsed;
  return { value: Math.round(parsed.value), malformed: parsed.malformed };
}

type HoleParse = { value: number | null; lifted: boolean; invalid: boolean };

/** Normalitza un golf d'un forat: "-" = bola aixecada, "5 -" = 5 cops i aixecada. */
export function parsePairHoleScore(value: unknown): HoleParse {
  if (value === null || value === undefined) return { value: null, lifted: false, invalid: false };
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return { value: null, lifted: false, invalid: true };
    return { value: value > 0 ? Math.round(value) : null, lifted: false, invalid: false };
  }
  const raw = String(value).trim();
  if (raw === '') return { value: null, lifted: false, invalid: false };
  if (/^[-–—]+$/.test(raw)) return { value: null, lifted: true, invalid: false };
  const withDash = raw.match(/^(\d+)\s*[-–—]$/);
  if (withDash) {
    const n = Number(withDash[1]);
    return { value: n > 0 ? n : null, lifted: true, invalid: false };
  }
  const numeric = raw.replace(/\s/g, '').replace(',', '.');
  if (/^\d+(\.\d+)?$/.test(numeric)) {
    const n = Number(numeric);
    return { value: n > 0 ? Math.round(n) : null, lifted: false, invalid: false };
  }
  return { value: null, lifted: false, invalid: true };
}

/** Construeix la clau canònica d'una parella. L'ordre dels integrants és irrellevant. */
export function buildPairKey(
  player1: Pick<ParsedPairPlayer, 'licenseNormalized' | 'name'>,
  player2: Pick<ParsedPairPlayer, 'licenseNormalized' | 'name'>,
): { pairKey: string | null; kind: 'licenses' | 'name_fallback' | 'none' } {
  const l1 = player1.licenseNormalized;
  const l2 = player2.licenseNormalized;
  if (l1 && l2) {
    return { pairKey: [l1, l2].sort().join('|'), kind: 'licenses' };
  }
  if (l1 || l2) {
    const withLicense = l1 ? l1 : (l2 as string);
    const withoutName = l1 ? normalizePairPlayerName(player2.name) : normalizePairPlayerName(player1.name);
    return { pairKey: [withLicense, `NAME:${withoutName}`].sort().join('|'), kind: 'name_fallback' };
  }
  return { pairKey: null, kind: 'none' };
}

function issue(
  code: string,
  message: string,
  blocking: boolean,
  row?: number,
  field?: string,
): PairParseIssue {
  return { code, message, blocking, ...(row !== undefined ? { row } : {}), ...(field !== undefined ? { field } : {}) };
}

/* --------------------------------------------------------- header detection */

const HEADER_ALIASES: Record<string, string[]> = {
  pos: ['pos', 'posicion', 'posicio', 'position', 'clas'],
  name: ['nombre', 'nom', 'jugador', 'player', 'name'],
  license: ['licencia', 'llicencia', 'lic', 'license', 'nlicencia'],
  hex: ['hex', 'hexacto', 'handicapexacto', 'hcpexacto'],
  gender: ['sex', 'sexo', 'genero', 'genere'],
  gross: ['brt', 'bruto', 'brut', 'gross'],
  hpu: ['hpu', 'hcpjuego', 'handicapjuego'],
  net: ['net', 'neto', 'nett'],
};

type ColumnMap = {
  pos: number;
  name: number;
  license: number;
  hex: number;
  gender: number | null;
  gross: number;
  hpu: number;
  net: number;
  holes: number[];
};

type HeaderDetection =
  | { ok: true; headerRow: number; columns: ColumnMap; missingHoles: number[] }
  | { ok: false; missing: string[]; bestRow: number | null };

function detectHeader(rows: unknown[][]): HeaderDetection {
  let best: { missing: string[]; row: number } | null = null;
  const limit = Math.min(rows.length, 10);

  for (let r = 0; r < limit; r++) {
    const row = rows[r] ?? [];
    const found: Record<string, number> = {};
    const holes = new Map<number, number>();

    for (let c = 0; c < row.length; c++) {
      const raw = row[c];
      if (raw === null || raw === undefined || String(raw).trim() === '') continue;
      const normalized = normalizeHeader(raw);
      const holeMatch = String(raw).trim().match(/^(?:h(?:oyo|ole)?\s*)?(\d{1,2})$/i);
      if (holeMatch) {
        const num = Number(holeMatch[1]);
        if (num >= 1 && num <= 18 && !holes.has(num)) {
          holes.set(num, c);
          continue;
        }
      }
      for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
        if (found[field] === undefined && aliases.includes(normalized)) {
          found[field] = c;
          break;
        }
      }
    }

    const missing: string[] = [];
    for (const field of ['pos', 'name', 'license', 'hex', 'gross', 'hpu', 'net']) {
      if (found[field] === undefined) missing.push(field);
    }
    const missingHoles: number[] = [];
    for (let h = 1; h <= 18; h++) if (!holes.has(h)) missingHoles.push(h);
    if (missingHoles.length > 0) missing.push(`hoyos:${missingHoles.join(',')}`);

    if (missing.length === 0) {
      const holeColumns: number[] = [];
      for (let h = 1; h <= 18; h++) holeColumns.push(holes.get(h) as number);
      return {
        ok: true,
        headerRow: r,
        missingHoles: [],
        columns: {
          pos: found.pos,
          name: found.name,
          license: found.license,
          hex: found.hex,
          gender: found.gender ?? null,
          gross: found.gross,
          hpu: found.hpu,
          net: found.net,
          holes: holeColumns,
        },
      };
    }
    if (!best || missing.length < best.missing.length) best = { missing, row: r };
  }

  return { ok: false, missing: best?.missing ?? ['pos', 'name', 'license', 'hex', 'gross', 'hpu', 'net'], bestRow: best?.row ?? null };
}

/* ----------------------------------------------------------------- grouping */

type RawBlock = {
  rows: number[];
  posRow: number | null;
  headerRowIndex: number;
  position: number | null;
  positionInferred: boolean;
};

function cell(rows: unknown[][], r: number, c: number | null): unknown {
  if (c === null) return null;
  const row = rows[r];
  if (!row) return null;
  const v = row[c];
  if (v === undefined) return null;
  return v;
}

function isBlank(value: unknown): boolean {
  return value === null || value === undefined || String(value).trim() === '';
}

/* ------------------------------------------------------------------- player */

function buildPlayer(
  rows: unknown[][],
  rowIndex: number,
  columns: ColumnMap,
): ParsedPairPlayer {
  const warnings: PairParseIssue[] = [];
  const errors: PairParseIssue[] = [];
  const excelRow = rowIndex + 1;

  const name = String(cell(rows, rowIndex, columns.name) ?? '').trim();

  const licenseRawValue = cell(rows, rowIndex, columns.license);
  const licenseRaw = isBlank(licenseRawValue) ? null : String(licenseRawValue).trim();
  const licenseNormalized = normalizePairLicense(licenseRawValue);
  const licenseKind = classifyPairLicense(licenseNormalized);

  if (licenseKind === 'missing') {
    warnings.push(issue('MISSING_LICENSE', `Jugador sense llicència: ${name}`, false, excelRow, 'license'));
  } else {
    if (licenseRaw && licenseRaw !== licenseNormalized) {
      warnings.push(
        issue(
          'LICENSE_NORMALIZED',
          `Llicència normalitzada de "${licenseRaw}" a "${licenseNormalized}"`,
          false,
          excelRow,
          'license',
        ),
      );
    }
    if (licenseKind === 'no_federativa') {
      warnings.push(
        issue(
          'NON_FEDERATIVE_LICENSE',
          `Llicència no federativa o provisional: ${licenseNormalized}`,
          false,
          excelRow,
          'license',
        ),
      );
    }
  }

  const hexParsed = parsePairDecimal(cell(rows, rowIndex, columns.hex));
  if (hexParsed.malformed) {
    warnings.push(issue('MALFORMED_EXACT_HANDICAP', `Hex il·legible per a ${name}`, false, excelRow, 'hex'));
  }
  const hpuParsed = parsePairDecimal(cell(rows, rowIndex, columns.hpu));
  if (hpuParsed.malformed) {
    warnings.push(issue('MALFORMED_PLAYING_HANDICAP', `Hpu il·legible per a ${name}`, false, excelRow, 'hpu'));
  }

  const genderRawValue = cell(rows, rowIndex, columns.gender);
  let gender: 'M' | 'F' | null = null;
  const genderRaw = isBlank(genderRawValue) ? '' : String(genderRawValue).trim().toUpperCase();
  if (genderRaw === 'M' || genderRaw === 'H') gender = 'M';
  else if (genderRaw === 'F' || genderRaw === 'D') gender = 'F';
  else if (genderRaw !== '') {
    warnings.push(issue('UNKNOWN_GENDER', `Sexe no reconegut ("${genderRaw}") per a ${name}`, false, excelRow, 'gender'));
  }

  const scores: Array<number | null> = [];
  const liftedHoles: number[] = [];
  for (let h = 0; h < 18; h++) {
    const raw = cell(rows, rowIndex, columns.holes[h]);
    const parsed = parsePairHoleScore(raw);
    if (parsed.invalid) {
      warnings.push(
        issue('INVALID_HOLE_SCORE', `Cop il·legible al forat ${h + 1} de ${name}`, false, excelRow, `hole_${h + 1}`),
      );
    } else if (isBlank(raw)) {
      warnings.push(issue('EMPTY_HOLE_SCORE', `Forat ${h + 1} buit per a ${name}`, false, excelRow, `hole_${h + 1}`));
    }
    scores.push(parsed.value);
    if (parsed.lifted) liftedHoles.push(h + 1);
  }

  return {
    sourceRow: excelRow,
    name,
    licenseRaw,
    licenseNormalized,
    licenseKind,
    exactHandicap: hexParsed.value,
    playingHandicap: hpuParsed.value,
    gender,
    scores,
    liftedHoles,
    warnings,
    errors,
  };
}

/* -------------------------------------------------------------------- entry */

export function parsePairExcelResults(
  workbook: XLSX.WorkBook,
  options: ParsePairExcelOptions = {},
): ParsePairExcelResult {
  const categoryThreshold = options.categoryThreshold ?? DEFAULT_PAIR_CATEGORY_THRESHOLD;
  const errors: PairParseIssue[] = [];
  const warnings: PairParseIssue[] = [];

  const sheetName = options.sheetName ?? workbook.SheetNames[0] ?? null;
  const sheet = sheetName ? workbook.Sheets[sheetName] : undefined;

  const emptyResult = (headerRow: number | null): ParsePairExcelResult => ({
    sheetName,
    headerRow,
    pairs: [],
    errors,
    warnings,
    summary: { totalPairs: 0, validPairs: 0, invalidPairs: 0, totalPlayers: 0, headerRow, sheetName },
  });

  if (!sheet) {
    errors.push(issue('SHEET_NOT_FOUND', 'No s\'ha trobat cap fulla al fitxer Excel', true));
    return emptyResult(null);
  }

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: false,
    defval: null,
    blankrows: true,
  });

  const header: HeaderDetection = detectHeader(rows);
  if (header.ok !== true) {
    errors.push(
      issue(
        'HEADER_NOT_FOUND',
        `No s'ha detectat la capçalera esperada. Falten camps: ${header.missing.join(', ')}`,
        true,
      ),
    );
    return emptyResult(null);
  }


  const { columns, headerRow } = header;

  // Agrupació: un bloc nou s'obre quan la fila té Nombre i Net/Brt de parella.
  // Pos pot estar buida (parelles empatades) i s'hereta de l'última posició explícita.
  const blocks: RawBlock[] = [];
  let current: RawBlock | null = null;
  let lastExplicitPosition: number | null = null;
  for (let r = headerRow + 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const allBlank = row.every(isBlank);
    if (allBlank) continue;

    const posValue = cell(rows, r, columns.pos);
    const nameValue = cell(rows, r, columns.name);
    const hasPos = !isBlank(posValue);
    const hasPairTotals =
      !isBlank(cell(rows, r, columns.net)) || !isBlank(cell(rows, r, columns.gross));
    const isPairHeader = !isBlank(nameValue) && (hasPos || hasPairTotals);

    if (isPairHeader) {
      let position: number | null = null;
      let positionInferred = false;
      if (hasPos) {
        position = parseIntegerCell(posValue).value;
        if (position !== null) lastExplicitPosition = position;
      } else {
        position = lastExplicitPosition;
        positionInferred = position !== null;
      }
      current = {
        rows: [r],
        posRow: hasPos ? r : null,
        headerRowIndex: r,
        position,
        positionInferred,
      };
      blocks.push(current);
      continue;
    }

    if (!current) {
      if (isBlank(nameValue)) continue;
      current = { rows: [r], posRow: null, headerRowIndex: r, position: null, positionInferred: false };
      blocks.push(current);
      continue;
    }
    current.rows.push(r);
  }

  const pairs: ParsedPair[] = [];

  for (const block of blocks) {
    const blockErrors: PairParseIssue[] = [];
    const blockWarnings: PairParseIssue[] = [];
    const playerRows = block.rows.filter((r) => !isBlank(cell(rows, r, columns.name)));
    const firstRow = block.headerRowIndex + 1;

    if (block.posRow === null) {
      if (block.positionInferred) {
        blockWarnings.push(
          issue(
            'POSITION_INFERRED_FROM_TIE',
            `Posició inferida per empat (${block.position}) a la fila ${firstRow}`,
            false,
            firstRow,
            'pos',
          ),
        );
      } else {
        blockErrors.push(issue('MISSING_POSITION', 'Bloc sense columna Pos identificable', true, firstRow, 'pos'));
      }
    }


    if (playerRows.length !== 2) {
      const code = playerRows.length < 2 ? 'PAIR_INCOMPLETE' : 'UNEXPECTED_PAIR_SIZE';
      blockErrors.push(
        issue(
          code,
          playerRows.length < 2
            ? `La parella de la fila ${firstRow} només té ${playerRows.length} jugador(s)`
            : `El bloc de la fila ${firstRow} té ${playerRows.length} jugadors (s'esperaven 2)`,
          true,
          firstRow,
        ),
      );
    }

    const p1Row = playerRows[0];
    const p2Row = playerRows[1];
    const player1 = buildPlayer(rows, p1Row ?? (block.posRow ?? block.rows[0]), columns);
    const player2 =
      p2Row !== undefined
        ? buildPlayer(rows, p2Row, columns)
        : {
            ...buildPlayer(rows, p1Row ?? (block.posRow ?? block.rows[0]), columns),
            name: '',
            licenseRaw: null,
            licenseNormalized: null,
            licenseKind: 'missing' as PairLicenseKind,
            exactHandicap: null,
            playingHandicap: null,
            gender: null,
            scores: Array<number | null>(18).fill(null),
            liftedHoles: [],
            warnings: [],
            errors: [],
          };

    const { pairKey, kind } = buildPairKey(player1, player2);
    let needsManualReview = false;
    if (kind === 'none') {
      blockErrors.push(
        issue('PAIR_WITHOUT_LICENSES', `Cap dels dos jugadors de la fila ${firstRow} té llicència`, true, firstRow, 'license'),
      );
    } else if (kind === 'name_fallback') {
      needsManualReview = true;
      blockWarnings.push(
        issue(
          'IDENTITY_USES_NAME_FALLBACK',
          `Identitat de parella provisional (falta una llicència) a la fila ${firstRow}`,
          false,
          firstRow,
          'license',
        ),
      );
    }

    // Hàndicap de parella: mitja suma dels Hex, sense arrodonir.
    let pairHandicap: number | null = null;
    if (player1.exactHandicap !== null && player2.exactHandicap !== null) {
      pairHandicap = (player1.exactHandicap + player2.exactHandicap) / 2;
    } else if (playerRows.length === 2) {
      blockErrors.push(
        issue(
          'MISSING_PAIR_HANDICAP_DATA',
          `Falta el Hex d'algun jugador de la parella de la fila ${firstRow}`,
          true,
          firstRow,
          'hex',
        ),
      );
    }

    const category: ParsedPairCategory | null =
      pairHandicap === null ? null : pairHandicap <= categoryThreshold ? 'hcp_low' : 'hcp_high';

    const mainRow = block.posRow ?? block.rows[0];
    const grossParsed = parseIntegerCell(cell(rows, mainRow, columns.gross));
    const netParsed = parseIntegerCell(cell(rows, mainRow, columns.net));

    if (grossParsed.value === null) {
      blockWarnings.push(issue('MISSING_GROSS_POINTS', `Brt absent a la fila ${firstRow}`, false, firstRow, 'gross'));
    }
    if (netParsed.value === null) {
      blockErrors.push(issue('MISSING_NET_POINTS', `Net absent a la fila ${firstRow}`, true, firstRow, 'net'));
    }

    pairs.push({
      sourceRows: block.rows.map((r) => r + 1),
      position: block.position,
      pairKey,
      pairKeyKind: kind,
      needsManualReview,
      player1,
      player2,
      pairHandicap,
      category,
      grossPoints: grossParsed.value,
      netPoints: netParsed.value,
      isValid: blockErrors.length === 0,
      warnings: blockWarnings,
      errors: blockErrors,
    });
  }

  // Duplicats dins del fitxer
  const byKey = new Map<string, number[]>();
  const byLicense = new Map<string, Set<number>>();
  pairs.forEach((pair, index) => {
    if (pair.pairKey) {
      const list = byKey.get(pair.pairKey) ?? [];
      list.push(index);
      byKey.set(pair.pairKey, list);
    }
    for (const player of [pair.player1, pair.player2]) {
      if (!player.licenseNormalized) continue;
      const set = byLicense.get(player.licenseNormalized) ?? new Set<number>();
      set.add(index);
      byLicense.set(player.licenseNormalized, set);
    }
  });

  for (const [key, indexes] of byKey) {
    if (indexes.length < 2) continue;
    for (const index of indexes) {
      pairs[index].errors.push(
        issue('DUPLICATE_PAIR_IN_FILE', `Parella duplicada al fitxer (${key})`, true, pairs[index].sourceRows[0]),
      );
      pairs[index].isValid = false;
    }
  }

  for (const [license, set] of byLicense) {
    if (set.size < 2) continue;
    for (const index of set) {
      pairs[index].errors.push(
        issue(
          'PLAYER_IN_MULTIPLE_PAIRS',
          `El jugador amb llicència ${license} apareix en més d'una parella`,
          true,
          pairs[index].sourceRows[0],
          'license',
        ),
      );
      pairs[index].isValid = false;
    }
  }

  for (const pair of pairs) {
    errors.push(...pair.errors);
    warnings.push(...pair.warnings, ...pair.player1.warnings, ...pair.player2.warnings);
  }

  const validPairs = pairs.filter((p) => p.isValid).length;
  const totalPlayers = pairs.reduce(
    (acc, p) => acc + (p.player1.name ? 1 : 0) + (p.player2.name ? 1 : 0),
    0,
  );

  return {
    sheetName,
    headerRow: headerRow + 1,
    pairs,
    errors,
    warnings,
    summary: {
      totalPairs: pairs.length,
      validPairs,
      invalidPairs: pairs.length - validPairs,
      totalPlayers,
      headerRow: headerRow + 1,
      sheetName,
    },
  };
}
