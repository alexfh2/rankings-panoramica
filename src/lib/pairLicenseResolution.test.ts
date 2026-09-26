import { describe, expect, it } from 'vitest';
import type { ParsedPair, ParsedPairPlayer } from '@/lib/parsePairExcelResults';
import {
  applyLicenseResolutions,
  rankUnlicensedCandidates,
  resolvePlayerStatus,
} from '@/lib/pairLicenseResolution';
import { buildPairImportPayload } from '@/lib/buildPairImportPayload';
import { golfDirectoPairsToParsedPairs, type GolfDirectoPairsResponse } from '@/lib/golfDirectoPairsToParsedPairs';

const player = (name: string, license: string | null, row = 1): ParsedPairPlayer => ({
  sourceRow: row,
  name,
  licenseRaw: license,
  licenseNormalized: license,
  licenseKind: license ? 'federativa' : 'missing',
  exactHandicap: 10,
  playingHandicap: 10,
  gender: 'M',
  scores: Array(18).fill(4),
  liftedHoles: [],
  warnings: [],
  errors: [],
});

const pair = (p1: ParsedPairPlayer, p2: ParsedPairPlayer): ParsedPair => ({
  sourceRows: [1, 2],
  position: 1,
  pairKey: p1.licenseNormalized && p2.licenseNormalized ? [p1.licenseNormalized, p2.licenseNormalized].sort().join('|') : null,
  pairKeyKind: p1.licenseNormalized && p2.licenseNormalized ? 'licenses' : 'none',
  needsManualReview: false,
  player1: p1,
  player2: p2,
  pairHandicap: 10,
  category: 'hcp_low',
  grossPoints: 30,
  netPoints: 40,
  isValid: true,
  warnings: [],
  errors: [],
});

const known = new Set(['LV00000001']);
const UUID = '550e8400-e29b-41d4-a716-446655440000';

describe('resolución de jugadores sin licencia', () => {
  it('sin decisión del administrador sigue en revisión manual y no se puede importar', () => {
    const r = applyLicenseResolutions(pair(player('GREZES', null), player('FED', 'LV00000001')), undefined, undefined);
    expect(r.identityResolved).toBe(false);
    expect(resolvePlayerStatus(r.pair.player1, r.meta1, r.identityResolved, known)).toBe('manual_review');
    expect(buildPairImportPayload([{ pair: r.pair, fourball: null, meta1: r.meta1, meta2: r.meta2 }])).toHaveLength(0);
  });

  it('confirmar sin licencia marca noLicenseConfirmed sin inventar licencia', () => {
    const r = applyLicenseResolutions(pair(player('GREZES', null), player('FED', 'LV00000001')), { kind: 'no_license' }, undefined);
    expect(r.identityResolved).toBe(true);
    expect(resolvePlayerStatus(r.pair.player1, r.meta1, true, known)).toBe('no_license_confirmed');
    const [payload] = buildPairImportPayload([{ pair: r.pair, fourball: null, meta1: r.meta1, meta2: r.meta2 }]);
    expect(payload.player1.noLicenseConfirmed).toBe(true);
    expect(payload.player1.licenseRaw).toBeNull();
    expect(payload.player1.licenseNormalized).toBeNull();
    expect(payload.player1.fairwayPlayerId).toBeUndefined();
    expect(payload.pairKey).toBe('');
  });

  it('vincular envía el players.id elegido', () => {
    const r = applyLicenseResolutions(
      pair(player('FED', 'LV00000001'), player('GREZES', null)),
      undefined,
      { kind: 'linked', playerId: UUID, playerName: 'GREZES' },
    );
    expect(resolvePlayerStatus(r.pair.player2, r.meta2, true, known)).toBe('linked');
    expect(r.previewKey).toBe(`ID:${UUID}|LV00000001`);
    const [payload] = buildPairImportPayload([{ pair: r.pair, fourball: null, meta1: r.meta1, meta2: r.meta2 }]);
    expect(payload.player2).toMatchObject({ noLicenseConfirmed: true, fairwayPlayerId: UUID });
    expect(payload.player1.noLicenseConfirmed).toBeUndefined();
  });

  it('la clave de vista previa no depende del orden (licencia+ID = ID+licencia)', () => {
    const link = { kind: 'linked', playerId: UUID, playerName: 'X' } as const;
    const a = applyLicenseResolutions(pair(player('X', null), player('F', 'LV00000001')), link, undefined);
    const b = applyLicenseResolutions(pair(player('F', 'LV00000001'), player('X', null)), undefined, link);
    expect(a.previewKey).toBe(b.previewKey);
  });

  it('dos jugadores sin licencia confirmados forman una pareja importable', () => {
    const r = applyLicenseResolutions(pair(player('A', null), player('B', null, 2)), { kind: 'no_license' }, { kind: 'no_license' });
    expect(r.identityResolved).toBe(true);
    expect(buildPairImportPayload([{ pair: r.pair, fourball: null, meta1: r.meta1, meta2: r.meta2 }])).toHaveLength(1);
  });

  it('introducir licencia vuelve al flujo federado normal', () => {
    const r = applyLicenseResolutions(pair(player('A', null), player('F', 'LV00000001')), { kind: 'license', license: 'lv-00000002' }, undefined);
    expect(r.licenseEntered1).toBe(true);
    expect(r.pair.pairKey).toBe('LV00000001|LV00000002');
    expect(r.meta1.noLicenseConfirmed).toBe(false);
    const [payload] = buildPairImportPayload([{ pair: r.pair, fourball: null, meta1: r.meta1, meta2: r.meta2 }]);
    expect(payload.player1.licenseNormalized).toBe('LV00000002');
    expect(payload.player1.noLicenseConfirmed).toBeUndefined();
  });

  it('un jugador federado ignora cualquier resolución y no lleva campos nuevos', () => {
    const r = applyLicenseResolutions(pair(player('F', 'LV00000001'), player('G', 'LV00000003')), { kind: 'no_license' }, undefined);
    expect(r.meta1.noLicenseConfirmed).toBe(false);
    const [payload] = buildPairImportPayload([{ pair: r.pair, fourball: null, meta1: r.meta1, meta2: r.meta2 }]);
    expect(payload.pairKey).toBe('LV00000001|LV00000003');
    expect(payload.player1).not.toHaveProperty('noLicenseConfirmed');
    expect(resolvePlayerStatus(r.pair.player1, r.meta1, true, known)).toBe('existing');
  });

  it('nombres iguales solo se sugieren: se devuelven todos los candidatos', () => {
    const list = rankUnlicensedCandidates('Phillippe Grezes', [
      { id: '1', name: 'OTRO' },
      { id: '2', name: 'PHILLIPPE GREZES' },
      { id: '3', name: 'PHILLIPPE GREZES' },
    ]);
    expect(list).toHaveLength(3);
    expect(list[0].name).toBe('PHILLIPPE GREZES');
    expect(list[1].name).toBe('PHILLIPPE GREZES');
  });

  it('GolfDirecto con licencia ausente sigue llegando como revisión manual', () => {
    const response = {
      success: true,
      game: { id: 'g', name: 'T', date: null },
      categories: [{ id: 'c', name: 'C' }],
      entries: [{
        sourceCategoryId: 'c', sourceCategoryName: 'C', sourceGroupId: 'grp', position: 1, netPoints: 40, grossPoints: 30,
        players: [
          { sourcePlayerId: 'a', firstName: 'Phillippe', surname: 'Grezes', license: null, gender: 'M', hcpExact: 10, hcpGame: 10, gross: Array(18).fill(4) },
          { sourcePlayerId: 'b', firstName: 'Fed', surname: 'Player', license: 'LV00000001', gender: 'M', hcpExact: 10, hcpGame: 10, gross: Array(18).fill(4) },
        ],
      }],
    } as unknown as GolfDirectoPairsResponse;
    const parsed = golfDirectoPairsToParsedPairs(response, {});
    const p = parsed.pairs[0];
    const missing = p.player1.licenseNormalized ? p.player2 : p.player1;
    expect(missing.licenseNormalized).toBeNull();
    const r = applyLicenseResolutions(p, undefined, undefined);
    expect(r.identityResolved).toBe(false);
    expect(resolvePlayerStatus(missing, { noLicenseConfirmed: false, fairwayPlayerId: null }, false, known)).toBe('manual_review');
  });
});
