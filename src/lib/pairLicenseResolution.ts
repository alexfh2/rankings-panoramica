import {
  buildPairKey,
  normalizePairLicense,
  type ParsedPair,
  type ParsedPairPlayer,
} from '@/lib/parsePairExcelResults';

/**
 * Decisión explícita del administrador para un jugador que llega SIN licencia.
 * La ausencia de licencia nunca se acepta sola: hace falta una de estas tres acciones.
 * - license: el administrador introduce la licencia real (vuelve al flujo normal).
 * - no_license: confirma que el participante no tiene licencia (se creará al importar).
 * - linked: vincula a un jugador sin licencia ya existente (players.id elegido a mano).
 */
export type LicenseResolution =
  | { kind: 'license'; license: string }
  | { kind: 'no_license' }
  | { kind: 'linked'; playerId: string; playerName: string };

export type PlayerSlot = 1 | 2;

export const resolutionKey = (pairIndex: number, slot: PlayerSlot) => `${pairIndex}:${slot}`;

export interface PlayerIdentityMeta {
  noLicenseConfirmed: boolean;
  fairwayPlayerId: string | null;
}

export type ResolvedPlayerStatus =
  | 'existing'
  | 'new'
  | 'manual_review'
  | 'no_license_confirmed'
  | 'linked';

export interface ResolvedPair {
  pair: ParsedPair;
  meta1: PlayerIdentityMeta;
  meta2: PlayerIdentityMeta;
  licenseEntered1: boolean;
  licenseEntered2: boolean;
  /** Clave mostrada en la vista previa; la definitiva de los sin licencia la calcula la base de datos. */
  previewKey: string | null;
  /** true cuando los dos jugadores tienen identidad resuelta (licencia o excepción confirmada). */
  identityResolved: boolean;
}

const NO_META: PlayerIdentityMeta = { noLicenseConfirmed: false, fairwayPlayerId: null };

function applyToPlayer(
  player: ParsedPairPlayer,
  resolution: LicenseResolution | undefined,
): { player: ParsedPairPlayer; meta: PlayerIdentityMeta; licenseEntered: boolean } {
  // Si el jugador ya trae licencia, la resolución no aplica: flujo actual intacto.
  if (player.licenseNormalized || !resolution) return { player, meta: NO_META, licenseEntered: false };

  if (resolution.kind === 'license') {
    const normalized = normalizePairLicense(resolution.license);
    if (!normalized) return { player, meta: NO_META, licenseEntered: false };
    return {
      player: { ...player, licenseRaw: resolution.license.trim(), licenseNormalized: normalized },
      meta: NO_META,
      licenseEntered: true,
    };
  }
  if (resolution.kind === 'no_license') {
    return { player, meta: { noLicenseConfirmed: true, fairwayPlayerId: null }, licenseEntered: false };
  }
  return {
    player,
    meta: { noLicenseConfirmed: true, fairwayPlayerId: resolution.playerId },
    licenseEntered: false,
  };
}

function previewToken(player: ParsedPairPlayer, meta: PlayerIdentityMeta): string | null {
  if (player.licenseNormalized) return player.licenseNormalized;
  if (meta.fairwayPlayerId) return `ID:${meta.fairwayPlayerId}`;
  if (meta.noLicenseConfirmed) return 'ID:(nuevo)';
  return null;
}

export function applyLicenseResolutions(
  pair: ParsedPair,
  r1: LicenseResolution | undefined,
  r2: LicenseResolution | undefined,
): ResolvedPair {
  const a = applyToPlayer(pair.player1, r1);
  const b = applyToPlayer(pair.player2, r2);

  let next: ParsedPair = pair;
  if (a.licenseEntered || b.licenseEntered) {
    const { pairKey, kind } = buildPairKey(a.player, b.player);
    next = { ...pair, player1: a.player, player2: b.player, pairKey, pairKeyKind: kind };
  }

  const t1 = previewToken(a.player, a.meta);
  const t2 = previewToken(b.player, b.meta);
  const identityResolved = !!t1 && !!t2;
  const anyUnlicensed = a.meta.noLicenseConfirmed || b.meta.noLicenseConfirmed;
  const previewKey = anyUnlicensed && t1 && t2 ? [t1, t2].sort().join('|') : next.pairKey;

  return {
    pair: next,
    meta1: a.meta,
    meta2: b.meta,
    licenseEntered1: a.licenseEntered,
    licenseEntered2: b.licenseEntered,
    previewKey,
    identityResolved,
  };
}

export function resolvePlayerStatus(
  player: ParsedPairPlayer,
  meta: PlayerIdentityMeta,
  identityResolved: boolean,
  knownLicenses: { has(license: string): boolean } | undefined,
): ResolvedPlayerStatus {
  if (meta.fairwayPlayerId) return 'linked';
  if (meta.noLicenseConfirmed) return 'no_license_confirmed';
  if (!player.licenseNormalized || !identityResolved) return 'manual_review';
  return knownLicenses?.has(player.licenseNormalized) ? 'existing' : 'new';
}

/** Normaliza un nombre solo para SUGERIR candidatos. Nunca se usa para vincular. */
export function normalizeNameForSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

export interface UnlicensedCandidate {
  id: string;
  name: string;
}

/** Ordena candidatos por parecido de nombre (sugerencia). Devuelve todos: la elección es del administrador. */
export function rankUnlicensedCandidates<T extends UnlicensedCandidate>(name: string, candidates: T[]): T[] {
  const target = normalizeNameForSearch(name);
  const words = new Set(target.split(' ').filter(Boolean));
  const score = (c: T) => {
    const n = normalizeNameForSearch(c.name);
    if (n === target) return 100;
    return n.split(' ').filter((w) => words.has(w)).length;
  };
  return [...candidates].sort((x, y) => score(y) - score(x) || x.name.localeCompare(y.name));
}
