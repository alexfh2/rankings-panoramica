/**
 * Helper PURO del directorio público de parejas de UNA competición.
 * No consulta Supabase, no recalcula Net ni hándicaps, no expone licencias ni pair_key.
 * Trabaja solo con las filas de ranking ya construidas (parejas con resultados visibles).
 */
import { formatPairMemberName, type PairRankingRow } from '@/lib/buildPairsRanking';
import { normalizeForSearch } from '@/lib/buildCompetitionPlayersDirectory';

export type PairDirectoryEntry = {
  pairId: string;
  /** "Jugador 1 / Jugador 2" con nombres públicos. */
  displayName: string;
  player1Name: string;
  player2Name: string;
  /** pairs.initial_pair_handicap — hándicap con el que quedó fijada la categoría. */
  initialPairHandicap: number | null;
  roundsPlayed: number;
  /** Criterio técnico de orden estable; nunca se muestra. */
  sortKey: string;
};

export function buildCompetitionPairsDirectory(input: {
  rows: readonly PairRankingRow[];
  /** Ids de jornada actualmente visibles; si se indica, exige al menos un resultado en ellas. */
  visibleRoundIds?: readonly string[];
}): PairDirectoryEntry[] {
  const visible = input.visibleRoundIds ? new Set(input.visibleRoundIds) : null;
  const byPairId = new Map<string, PairDirectoryEntry>();

  for (const row of input.rows) {
    if (byPairId.has(row.pairId)) continue;
    const roundIds = Object.keys(row.scoresByRoundId);
    const visibleCount = visible ? roundIds.filter((id) => visible.has(id)).length : roundIds.length;
    if (visibleCount === 0) continue;

    const player1Name = formatPairMemberName(row.player1);
    const player2Name = formatPairMemberName(row.player2);

    byPairId.set(row.pairId, {
      pairId: row.pairId,
      displayName: `${player1Name} / ${player2Name}`,
      player1Name,
      player2Name,
      initialPairHandicap: row.initialPairHandicap,
      roundsPlayed: visibleCount,
      sortKey: row.pairKey,
    });
  }

  return Array.from(byPairId.values()).sort((a, b) => {
    const c1 = normalizeForSearch(a.player1Name).localeCompare(normalizeForSearch(b.player1Name), 'es-ES');
    if (c1 !== 0) return c1;
    const c2 = normalizeForSearch(a.player2Name).localeCompare(normalizeForSearch(b.player2Name), 'es-ES');
    if (c2 !== 0) return c2;
    return a.sortKey.localeCompare(b.sortKey);
  });
}

export function filterPairDirectory(
  entries: readonly PairDirectoryEntry[],
  query: string
): PairDirectoryEntry[] {
  const q = normalizeForSearch(query);
  if (!q) return [...entries];
  return entries.filter(
    (e) =>
      normalizeForSearch(e.player1Name).includes(q) ||
      normalizeForSearch(e.player2Name).includes(q) ||
      normalizeForSearch(e.displayName).includes(q)
  );
}
