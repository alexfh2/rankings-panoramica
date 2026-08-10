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

/**
 * ÚNICA fuente de verdad del "último hándicap dentro de la competición".
 * Devuelve un Map playerId → hándicap de la participación cronológicamente más
 * reciente (round.date → round.round_number → round.id) usando handicap_at_round,
 * con players.current_handicap SOLO como fallback si no existe ningún snapshot.
 * Solo considera resultados de las jornadas recibidas (las visibles del embed).
 */
export function buildLatestCompetitionHandicapMap(input: {
  results: readonly DirectoryResultLike[];
  rounds: readonly DirectoryRoundLike[];
  players?: readonly DirectoryPlayerLike[];
}): Map<string, number | null> {
  const roundsById = new Map<string, DirectoryRoundLike>();
  for (const r of input.rounds) roundsById.set(r.id, r);
  const visibleRoundIds = new Set(input.rounds.map((r) => r.id));
  const playersById = new Map<string, DirectoryPlayerLike>();
  for (const p of input.players ?? []) playersById.set(p.id, p);

  const acc = new Map<string, { lastKey: string | null; lastHcp: number | null; current: number | null }>();

  for (const res of input.results) {
    if (visibleRoundIds.size > 0 && !visibleRoundIds.has(res.round_id)) continue;

    const current =
      res.players_public?.current_handicap ?? playersById.get(res.player_id)?.current_handicap ?? null;
    const entry = acc.get(res.player_id) ?? { lastKey: null, lastHcp: null, current };

    if (res.handicap_at_round != null && Number.isFinite(res.handicap_at_round)) {
      const key = roundSortKey(roundsById.get(res.round_id), res.round_id);
      if (entry.lastKey == null || key > entry.lastKey) {
        entry.lastKey = key;
        entry.lastHcp = res.handicap_at_round;
      }
    }

    acc.set(res.player_id, entry);
  }

  const out = new Map<string, number | null>();
  for (const [playerId, e] of acc) out.set(playerId, e.lastHcp ?? e.current);
  return out;
}

/** Etiqueta pública "(HCP 14,1)" / "(HCP —)". */
export const formatHandicapSuffix = (value: number | null | undefined): string =>
  `(${formatDirectoryHandicap(value ?? null)})`;



export function buildCompetitionPlayersDirectory(input: {
  results: readonly DirectoryResultLike[];
  rounds: readonly DirectoryRoundLike[];
  players?: readonly DirectoryPlayerLike[];
}): PlayerDirectoryEntry[] {
  const visibleRoundIds = new Set(input.rounds.map((r) => r.id));
  const playersById = new Map<string, DirectoryPlayerLike>();
  for (const p of input.players ?? []) playersById.set(p.id, p);

  // Único cálculo del último hándicap de competición (compartido con el ranking).
  const lastHandicapByPlayer = buildLatestCompetitionHandicapMap(input);

  const namesByPlayer = new Map<string, string>();
  for (const res of input.results) {
    // Solo resultados de jornadas actualmente visibles en este embed.
    if (visibleRoundIds.size > 0 && !visibleRoundIds.has(res.round_id)) continue;
    if (namesByPlayer.has(res.player_id)) continue;

    const name = res.players_public?.name ?? playersById.get(res.player_id)?.name ?? '';
    if (!name) continue;
    namesByPlayer.set(res.player_id, name);
  }

  const entries: PlayerDirectoryEntry[] = Array.from(namesByPlayer.entries()).map(([playerId, fullName]) => ({
    playerId,
    fullName,
    displayName: formatPlayerDisplayName(fullName),
    lastHandicap: lastHandicapByPlayer.get(playerId) ?? null,
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
