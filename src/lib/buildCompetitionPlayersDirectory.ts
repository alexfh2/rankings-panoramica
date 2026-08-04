/**
 * Helper PURO del directorio público de jugadores de UNA competición.
 * No consulta Supabase, no muta argumentos, no recalcula hándicaps ni puntos.
 * Solo trabaja con los resultados y jornadas YA visibles del embed activo.
 */
import { formatPlayerDisplayName } from '@/lib/formatPlayerDisplayName';

export type DirectoryRoundLike = {
  id: string;
  date: string | null;
  round_number: number | null;
};

export type DirectoryResultLike = {
  round_id: string;
  player_id: string;
  handicap_at_round: number | null;
  players_public: { id?: string; name: string; current_handicap: number | null } | null;
};

export type DirectoryPlayerLike = {
  id: string;
  name: string;
  current_handicap: number | null;
};

export type PlayerDirectoryEntry = {
  playerId: string;
  /** Nombre almacenado (uso interno: title / aria-label / búsqueda). */
  fullName: string;
  /** Nombre público "Nombre Apellido". */
  displayName: string;
  /** Último hándicap dentro de la competición activa (o current_handicap como fallback). */
  lastHandicap: number | null;
};

/** Clave estable de orden cronológico: fecha → nº de prueba → id. */
const roundSortKey = (round: DirectoryRoundLike | undefined, roundId: string): string => {
  const date = round?.date || '9999-99-99';
  const num = String(round?.round_number ?? 9999).padStart(4, '0');
  return `${date}|${num}|${round?.id ?? roundId}`;
};

/** Normaliza para búsqueda y orden: sin acentos, minúsculas, espacios simples. */
export const normalizeForSearch = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('es-ES');

/** "HCP 12,4" / "HCP —" */
export const formatDirectoryHandicap = (value: number | null): string =>
  value == null || !Number.isFinite(value) ? 'HCP —' : `HCP ${value.toFixed(1).replace('.', ',')}`;

export function buildCompetitionPlayersDirectory(input: {
  results: readonly DirectoryResultLike[];
  rounds: readonly DirectoryRoundLike[];
  players?: readonly DirectoryPlayerLike[];
}): PlayerDirectoryEntry[] {
  const roundsById = new Map<string, DirectoryRoundLike>();
  for (const r of input.rounds) roundsById.set(r.id, r);

  const visibleRoundIds = new Set(input.rounds.map((r) => r.id));
  const playersById = new Map<string, DirectoryPlayerLike>();
  for (const p of input.players ?? []) playersById.set(p.id, p);

  type Acc = { fullName: string; currentHandicap: number | null; lastKey: string | null; lastHcp: number | null };
  const byPlayer = new Map<string, Acc>();

  for (const res of input.results) {
    // Solo resultados de jornadas actualmente visibles en este embed.
    if (visibleRoundIds.size > 0 && !visibleRoundIds.has(res.round_id)) continue;

    const name = res.players_public?.name ?? playersById.get(res.player_id)?.name ?? '';
    if (!name) continue;

    const current = res.players_public?.current_handicap ?? playersById.get(res.player_id)?.current_handicap ?? null;
    const acc = byPlayer.get(res.player_id) ?? {
      fullName: name,
      currentHandicap: current,
      lastKey: null,
      lastHcp: null,
    };

    if (res.handicap_at_round != null) {
      const key = roundSortKey(roundsById.get(res.round_id), res.round_id);
      if (acc.lastKey == null || key > acc.lastKey) {
        acc.lastKey = key;
        acc.lastHcp = res.handicap_at_round;
      }
    }

    byPlayer.set(res.player_id, acc);
  }

  const entries: PlayerDirectoryEntry[] = Array.from(byPlayer.entries()).map(([playerId, acc]) => ({
    playerId,
    fullName: acc.fullName,
    displayName: formatPlayerDisplayName(acc.fullName),
    lastHandicap: acc.lastHcp ?? acc.currentHandicap,
  }));

  entries.sort((a, b) => {
    const cmp = normalizeForSearch(a.displayName).localeCompare(normalizeForSearch(b.displayName), 'es-ES');
    return cmp !== 0 ? cmp : a.playerId.localeCompare(b.playerId);
  });

  return entries;
}

export function filterPlayerDirectory(
  entries: readonly PlayerDirectoryEntry[],
  query: string
): PlayerDirectoryEntry[] {
  const q = normalizeForSearch(query);
  if (!q) return [...entries];
  return entries.filter(
    (e) => normalizeForSearch(e.displayName).includes(q) || normalizeForSearch(e.fullName).includes(q)
  );
}
