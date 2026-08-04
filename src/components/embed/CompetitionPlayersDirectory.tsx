/**
 * Directorio público de jugadores de UNA competición (Individual, Liga de Verano).
 * Solo presentación: recibe los datos ya cargados por el embed y no ejecuta consultas.
 */
import { useMemo, useState } from 'react';
import {
  buildCompetitionPlayersDirectory,
  filterPlayerDirectory,
  formatDirectoryHandicap,
  type DirectoryPlayerLike,
  type DirectoryResultLike,
  type DirectoryRoundLike,
} from '@/lib/buildCompetitionPlayersDirectory';

export type CompetitionPlayersDirectoryProps = {
  results: readonly DirectoryResultLike[];
  rounds: readonly DirectoryRoundLike[];
  players?: readonly DirectoryPlayerLike[];
  onPlayerSelect: (playerId: string) => void;
  searchPlaceholder?: string;
  emptyText?: string;
  noMatchesText?: string;
};

const CompetitionPlayersDirectory = ({
  results,
  rounds,
  players,
  onPlayerSelect,
  searchPlaceholder = 'Buscar jugador…',
  emptyText = 'No hay jugadores publicados todavía.',
  noMatchesText = 'No se han encontrado jugadores.',
}: CompetitionPlayersDirectoryProps) => {
  const [query, setQuery] = useState('');

  const entries = useMemo(
    () => buildCompetitionPlayersDirectory({ results, rounds, players }),
    [results, rounds, players]
  );
  const filtered = useMemo(() => filterPlayerDirectory(entries, query), [entries, query]);

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
            aria-label="Buscar jugador"
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
          {searching
            ? `${filtered.length} coincidencias`
            : `${entries.length} jugadores con participación`}
        </p>
      </div>

      {!filtered.length ? (
        <p className="pano-embed__state">{noMatchesText}</p>
      ) : (
        <ul className="pano-dir__list">
          {filtered.map((entry) => (
            <li key={entry.playerId} className="pano-dir__item">
              <button
                type="button"
                className="pano-dir__row"
                title={entry.fullName}
                aria-label={`Ver ficha de ${entry.fullName}`}
                onClick={() => onPlayerSelect(entry.playerId)}
              >
                <span className="pano-dir__name">{entry.displayName}</span>
                <span className="pano-dir__hcp">{formatDirectoryHandicap(entry.lastHandicap)}</span>
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

export default CompetitionPlayersDirectory;
