import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import {
  parsePairExcelResults,
  normalizePairLicense,
  classifyPairLicense,
  parsePairDecimal,
  parsePairHoleScore,
  buildPairKey,
} from './parsePairExcelResults';

const HEADER = [
  'Pos', 'Nombre', 'Licencia', 'Hex', 'NVH', 'Niv', 'Sex', 'Cat.',
  '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18',
  'Brt', 'Hpu', 'Net',
];

type Row = Array<string | number | null>;

function holes(value: string | number | null = 4): Row {
  return Array.from({ length: 18 }, () => value);
}

function playerRow(opts: {
  pos?: string | number | null;
  name: string;
  license: string | null;
  hex: string | number | null;
  sex?: string;
  scores?: Row;
  brt?: string | number | null;
  hpu?: string | number | null;
  net?: string | number | null;
}): Row {
  return [
    opts.pos ?? '',
    opts.name,
    opts.license ?? '',
    opts.hex,
    '',
    'S',
    opts.sex ?? 'M',
    2,
    ...(opts.scores ?? holes()),
    opts.brt ?? '',
    opts.hpu ?? '',
    opts.net ?? '',
  ];
}

function buildWorkbook(rows: Row[]): XLSX.WorkBook {
  const ws = XLSX.utils.aoa_to_sheet([HEADER, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'PAREJAS');
  return wb;
}

function onePair(overrides: {
  a?: Partial<Parameters<typeof playerRow>[0]>;
  b?: Partial<Parameters<typeof playerRow>[0]>;
} = {}): Row[] {
  return [
    playerRow({
      pos: 1,
      name: 'SUILS BARRAU, DAVID',
      license: 'CB55225390',
      hex: '8,7',
      brt: 34,
      hpu: 9,
      net: 41,
      ...overrides.a,
    } as Parameters<typeof playerRow>[0]),
    playerRow({
      name: 'CALDERON ALARCON, FRANCISCO',
      license: 'LV35027394',
      hex: '2,2',
      ...overrides.b,
    } as Parameters<typeof playerRow>[0]),
    Array.from({ length: HEADER.length }, () => ''),
  ];
}

describe('helpers', () => {
  it('normalizes licenses preserving leading zeros', () => {
    expect(normalizePairLicense(' cb-552.253 90 ')).toBe('CB55225390');
    expect(normalizePairLicense('00123456')).toBe('00123456');
    expect(normalizePairLicense('')).toBeNull();
    expect(classifyPairLicense('CB55225390')).toBe('federativa');
    expect(classifyPairLicense('XXX4440000')).toBe('no_federativa');
    expect(classifyPairLicense(null)).toBe('missing');
  });

  it('parses decimal comma values', () => {
    expect(parsePairDecimal('1,4').value).toBe(1.4);
    expect(parsePairDecimal(' 10,5 ').value).toBe(10.5);
    expect(parsePairDecimal('36,0').value).toBe(36);
    expect(parsePairDecimal(8.2).value).toBe(8.2);
    expect(parsePairDecimal('abc')).toEqual({ value: null, malformed: true });
  });

  it('treats dashes as lifted ball', () => {
    expect(parsePairHoleScore('-')).toEqual({ value: null, lifted: true, invalid: false });
    expect(parsePairHoleScore('5 -')).toEqual({ value: 5, lifted: true, invalid: false });
    expect(parsePairHoleScore(0)).toEqual({ value: null, lifted: false, invalid: false });
    expect(parsePairHoleScore('x')).toEqual({ value: null, lifted: false, invalid: true });
  });

  it('builds an order-independent pairKey', () => {
    const a = { licenseNormalized: 'CB12345678', name: 'A' };
    const b = { licenseNormalized: 'LV87654321', name: 'B' };
    expect(buildPairKey(a, b).pairKey).toBe(buildPairKey(b, a).pairKey);
    expect(buildPairKey(a, b).pairKey).toBe('CB12345678|LV87654321');
  });

  it('creates a different pairKey when a member changes', () => {
    const a = { licenseNormalized: 'CB12345678', name: 'A' };
    const b = { licenseNormalized: 'LV87654321', name: 'B' };
    const c = { licenseNormalized: 'LV11112222', name: 'C' };
    expect(buildPairKey(a, b).pairKey).not.toBe(buildPairKey(a, c).pairKey);
  });

  it('falls back to name when one license is missing', () => {
    const result = buildPairKey(
      { licenseNormalized: 'CB12345678', name: 'A' },
      { licenseNormalized: null, name: 'Pérez Gómez, Joan' },
    );
    expect(result.kind).toBe('name_fallback');
    expect(result.pairKey).toContain('NAME:PEREZGOMEZJOAN');
  });
});

describe('parsePairExcelResults', () => {
  it('parses a two-row block', () => {
    const result = parsePairExcelResults(buildWorkbook(onePair()));
    expect(result.errors.filter((e) => e.blocking)).toHaveLength(0);
    expect(result.summary.totalPairs).toBe(1);
    expect(result.summary.totalPlayers).toBe(2);
    expect(result.headerRow).toBe(1);
    const pair = result.pairs[0];
    expect(pair.position).toBe(1);
    expect(pair.netPoints).toBe(41);
    expect(pair.grossPoints).toBe(34);
    expect(pair.player1.scores).toHaveLength(18);
    expect(pair.player2.scores).toHaveLength(18);
    expect(pair.pairKey).toBe('CB55225390|LV35027394');
  });

  it('fails when the header is missing', () => {
    const ws = XLSX.utils.aoa_to_sheet([['foo', 'bar'], [1, 2]]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'X');
    const result = parsePairExcelResults(wb);
    expect(result.errors.some((e) => e.code === 'HEADER_NOT_FOUND' && e.blocking)).toBe(true);
    expect(result.pairs).toHaveLength(0);
  });

  it('flags incomplete pairs', () => {
    const rows = onePair();
    const result = parsePairExcelResults(buildWorkbook([rows[0], rows[2]]));
    expect(result.errors.some((e) => e.code === 'PAIR_INCOMPLETE' && e.blocking)).toBe(true);
  });

  it('flags blocks with more than two players', () => {
    const rows = onePair();
    const extra = playerRow({ name: 'TERCERO, JUAN', license: 'LV00000001', hex: '10,0' });
    const result = parsePairExcelResults(buildWorkbook([rows[0], rows[1], extra]));
    expect(result.errors.some((e) => e.code === 'UNEXPECTED_PAIR_SIZE' && e.blocking)).toBe(true);
  });

  it('requires Net', () => {
    const result = parsePairExcelResults(buildWorkbook(onePair({ a: { net: '' } })));
    expect(result.errors.some((e) => e.code === 'MISSING_NET_POINTS' && e.blocking)).toBe(true);
  });

  it('warns when Brt is missing but does not block', () => {
    const result = parsePairExcelResults(buildWorkbook(onePair({ a: { brt: '' } })));
    expect(result.warnings.some((w) => w.code === 'MISSING_GROSS_POINTS')).toBe(true);
    expect(result.pairs[0].isValid).toBe(true);
  });

  it('normalizes lowercase licenses with a warning', () => {
    const result = parsePairExcelResults(buildWorkbook(onePair({ a: { license: 'cb55225390' } })));
    expect(result.pairs[0].player1.licenseNormalized).toBe('CB55225390');
    expect(result.warnings.some((w) => w.code === 'LICENSE_NORMALIZED')).toBe(true);
  });

  it('keeps placeholder licenses as warnings only', () => {
    const result = parsePairExcelResults(buildWorkbook(onePair({ a: { license: 'XXX4440000' } })));
    expect(result.pairs[0].player1.licenseKind).toBe('no_federativa');
    expect(result.warnings.some((w) => w.code === 'NON_FEDERATIVE_LICENSE')).toBe(true);
    expect(result.pairs[0].isValid).toBe(true);
  });

  it('detects duplicated pairKey (also reversed order)', () => {
    const first = onePair();
    const second = [
      playerRow({ pos: 2, name: 'CALDERON ALARCON, FRANCISCO', license: 'LV35027394', hex: '2,2', brt: 30, net: 38 }),
      playerRow({ name: 'SUILS BARRAU, DAVID', license: 'CB55225390', hex: '8,7' }),
    ];
    const result = parsePairExcelResults(buildWorkbook([...first, ...second]));
    expect(result.errors.filter((e) => e.code === 'DUPLICATE_PAIR_IN_FILE')).toHaveLength(2);
  });

  it('detects a player appearing in two pairs', () => {
    const first = onePair();
    const second = [
      playerRow({ pos: 2, name: 'SUILS BARRAU, DAVID', license: 'CB55225390', hex: '8,7', brt: 30, net: 38 }),
      playerRow({ name: 'OTRO JUGADOR, PEPE', license: 'LV99998888', hex: '12,0' }),
    ];
    const result = parsePairExcelResults(buildWorkbook([...first, ...second]));
    expect(result.errors.some((e) => e.code === 'PLAYER_IN_MULTIPLE_PAIRS' && e.blocking)).toBe(true);
  });

  it('keeps lifted-ball signals from dashes', () => {
    const scores = holes(4);
    scores[2] = '-';
    scores[9] = '5 -';
    const result = parsePairExcelResults(buildWorkbook(onePair({ a: { scores } })));
    const p1 = result.pairs[0].player1;
    expect(p1.liftedHoles).toEqual([3, 10]);
    expect(p1.scores[2]).toBeNull();
    expect(p1.scores[9]).toBe(5);
  });

  it('classifies hcp_low at or below the threshold', () => {
    const result = parsePairExcelResults(buildWorkbook(onePair({ a: { hex: '14,0' }, b: { hex: '16,8' } })));
    expect(result.pairs[0].pairHandicap).toBeCloseTo(15.4);
    expect(result.pairs[0].category).toBe('hcp_low');
  });

  it('classifies hcp_high above the threshold', () => {
    const result = parsePairExcelResults(buildWorkbook(onePair({ a: { hex: '22,1' }, b: { hex: '22,1' } })));
    expect(result.pairs[0].pairHandicap).toBeCloseTo(22.1);
    expect(result.pairs[0].category).toBe('hcp_high');
  });

  it('blocks when a Hex is missing', () => {
    const result = parsePairExcelResults(buildWorkbook(onePair({ b: { hex: '' } })));
    expect(result.errors.some((e) => e.code === 'MISSING_PAIR_HANDICAP_DATA' && e.blocking)).toBe(true);
    expect(result.pairs[0].pairHandicap).toBeNull();
  });

  it('respects a custom categoryThreshold', () => {
    const result = parsePairExcelResults(buildWorkbook(onePair({ a: { hex: '16,0' }, b: { hex: '16,0' } })), {
      categoryThreshold: 16,
    });
    expect(result.pairs[0].category).toBe('hcp_low');
  });
});
