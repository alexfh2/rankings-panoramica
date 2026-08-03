import { describe, expect, it } from 'vitest';
import { buildPairImportPayload, type PairImportPreviewRow } from '@/lib/buildPairImportPayload';
import type { ParsedPair, ParsedPairPlayer } from '@/lib/parsePairExcelResults';

const player = (
  license: string,
  name: string,
  exactHandicap: number | null,
  playingHandicap: number | null,
): ParsedPairPlayer =>
  ({
    name,
    licenseRaw: license,
    licenseNormalized: license,
    gender: 'M',
    exactHandicap,
    playingHandicap,
    scores: Array.from({ length: 18 }, () => 4),
    liftedHoles: [],
  }) as unknown as ParsedPairPlayer;

const pair = (
  p1: ParsedPairPlayer,
  p2: ParsedPairPlayer,
  netPoints: number | null,
): ParsedPair =>
  ({
    pairKey: `${p1.licenseNormalized}|${p2.licenseNormalized}`,
    position: 1,
    grossPoints: 30,
    netPoints,
    player1: p1,
    player2: p2,
  }) as unknown as ParsedPair;

const row = (p: ParsedPair, status: 'valid' | 'insufficient_data' = 'valid'): PairImportPreviewRow => ({
  pair: p,
  fourball: {
    validationStatus: status,
    calculatedNetPoints: 30,
    calculatedGrossPoints: 28,
    netDifference: 0,
    grossDifference: 0,
  } as PairImportPreviewRow['fourball'],
});

describe('buildPairImportPayload — HPU opcional', () => {
  it('envia els dos HPU quan estan presents', () => {
    const payload = buildPairImportPayload([
      row(pair(player('A1', 'Ana Uno', 9.4, 9), player('B2', 'Bea Dos', 1.2, 1), 34)),
    ]);
    expect(payload).toHaveLength(1);
    expect(payload[0].player1.playingHandicap).toBe(9);
    expect(payload[0].player2.playingHandicap).toBe(1);
  });

  it('envia null quan falta l\'HPU del jugador 2, sense copiar el de l\'altre', () => {
    const payload = buildPairImportPayload([
      row(pair(player('A1', 'Ana Uno', 9.4, 9), player('B2', 'Bea Dos', 1.2, null), 34), 'insufficient_data'),
    ]);
    expect(payload[0].player1.playingHandicap).toBe(9);
    expect(payload[0].player2.playingHandicap).toBeNull();
    expect(payload[0].validationStatus).toBe('insufficient_data');
  });

  it('envia null quan falten els dos HPU i manté els hàndicaps exactes', () => {
    const payload = buildPairImportPayload([
      row(pair(player('A1', 'Ana Uno', 9.4, null), player('B2', 'Bea Dos', 1.2, null), 34), 'insufficient_data'),
    ]);
    expect(payload[0].player1.playingHandicap).toBeNull();
    expect(payload[0].player2.playingHandicap).toBeNull();
    expect(payload[0].player1.exactHandicap).toBe(9.4);
    expect(payload[0].player2.exactHandicap).toBe(1.2);
  });

  it('conserva el Net oficial encara que falti l\'HPU i no el recalcula', () => {
    const payload = buildPairImportPayload([
      row(pair(player('A1', 'Ana Uno', 9.4, null), player('B2', 'Bea Dos', 1.2, null), 41), 'insufficient_data'),
    ]);
    expect(payload[0].netPoints).toBe(41);
    expect(payload[0].validation.calculatedNetPoints).toBe(30);
  });

  it('omet les parelles sense Net oficial (bloqueig previ a la RPC)', () => {
    const payload = buildPairImportPayload([
      row(pair(player('A1', 'Ana Uno', 9.4, 9), player('B2', 'Bea Dos', 1.2, 1), null)),
    ]);
    expect(payload).toHaveLength(0);
  });

  it('és determinista: el mateix input produeix el mateix payload (import idempotent)', () => {
    const rows = [row(pair(player('A1', 'Ana Uno', 9.4, null), player('B2', 'Bea Dos', 1.2, 1), 34))];
    expect(buildPairImportPayload(rows)).toEqual(buildPairImportPayload(rows));
  });
});
