/**
 * Directorio público de parejas de UNA competición (Orden del Mérito de Parejas).
 * Solo presentación: recibe el ranking ya construido y no ejecuta consultas.
 */
import { useMemo, useState } from 'react';
import {
  buildCompetitionPairsDirectory,
  filterPairDirectory,
  type PairDirectoryEntry,
} from '@/lib/buildCompetitionPairsDirectory';
import { formatDirectoryHandicap } from '@/lib/buildCompetitionPlayersDirectory';
import type { PairRankingRow } from '@/lib/buildPairsRanking';

export type CompetitionPairsDirectoryProps = {
  rows: readonly PairRankingRow[];
  visibleRoundIds: readonly string[];
  onPairSelect: (pairId: string) => void;
  searchPlaceholder?: string;
  emptyText?: string;
  noMatchesText?: string;
};

const CompetitionPairsDirectory = ({
  rows,
  visibleRoundIds,
  onPairSelect,
  searchPlaceholder = 'Buscar pareja o jugador…',
  emptyText = 'No hay parejas publicadas todavía.',
  noMatchesText = 'No se han encontrado parejas.',
}: CompetitionPairsDirectoryProps) => {
  const [query, setQuery] = useState('');

  const entries = useMemo<PairDirectoryEntry[]>(
    () => buildCompetitionPairsDirectory({ rows, visibleRoundIds }),
    [rows, visibleRoundIds]
  );
  const filtered = useMemo(() => filterPairDirectory(entries, query), [entries, query]);

  if (!entries.length) return <p className="pano-embed__state">{emptyText}</p>;

  const searching = query.trim().length > 0;

  return (
    <div className="pano-dir">
      <div className="pano-dir__toolbar">
        <div className="pano-dir__search">
          <input
            type="search"
            className="pano-dir__input"
            value={query}
            placeholder={searchPlaceholder}
            aria-label="Buscar pareja o jugador"
            onChange={(e) => setQuery(e.target.value)}
          />
          {searching && (
            <button
              type="button"
              className="pano-dir__clear"
              aria-label="Limpiar búsqueda"
              onClick={() => setQuery('')}
            >
              ×
            </button>
          )}
        </div>
        <p className="pano-dir__count" aria-live="polite">
          {searching ? `${filtered.length} coincidencias` : `${entries.length} parejas con participación`}
        </p>
      </div>

      {!filtered.length ? (
        <p className="pano-embed__state">{noMatchesText}</p>
      ) : (
        <ul className="pano-dir__list">
          {filtered.map((entry) => (
            <li key={entry.pairId} className="pano-dir__item">
              <button
                type="button"
                className="pano-dir__row"
                title={entry.displayName}
                aria-label={`Ver ficha de ${entry.displayName}`}
                onClick={() => onPairSelect(entry.pairId)}
              >
                <span className="pano-dir__name">{entry.displayName}</span>
                <span className="pano-dir__hcp">{formatDirectoryHandicap(entry.initialPairHandicap)}</span>
                <span className="pano-dir__chev" aria-hidden="true">
                  ›
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default CompetitionPairsDirectory;
