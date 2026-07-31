/**
 * Vista pública per iframe — Orden del Mérito Individual 2026 (Panorámica).
 * Reutilitza íntegrament useCompetitionIndividualRanking; cap lògica nova.
 */
import { useMemo, useState } from 'react';
import {
  useCompetitionIndividualRanking,
  type CompetitionRankedPlayer,
} from '@/hooks/useCompetitionIndividualRanking';
import CompetitionRounds from '@/components/embed/CompetitionRounds';
import { formatPlayerDisplayName } from '@/lib/formatPlayerDisplayName';
import '@/styles/embed-panoramica.css';

const SLUG = 'individual-2026';

type TabKey = 'hcpLow' | 'hcpHigh' | 'scratch';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'hcpLow', label: '1ª Categoría' },
  { key: 'hcpHigh', label: '2ª Categoría' },
  { key: 'scratch', label: 'Scratch' },
];

type SectionKey = 'ranking' | 'rounds' | 'stats';

const SECTIONS: { key: SectionKey; label: string; disabled?: boolean }[] = [
  { key: 'ranking', label: 'Orden del mérito' },
  { key: 'rounds', label: 'Pruebas' },
  { key: 'stats', label: 'Estadísticas', disabled: true },
];

const MAX_MATRIX_ROUNDS = 8;

const EmbedIndividual2026 = () => {
  const {
    rounds,
    results,
    rankings,
    categoryThreshold,
    categoryHandicapMap,
    scheduledRounds,
    isLoading,
    error,
    competitionNotFound,
  } = useCompetitionIndividualRanking(SLUG);
  const [section, setSection] = useState<SectionKey>('ranking');
  const [tab, setTab] = useState<TabKey>('hcpLow');

  const state = (msg: string) => <p className="pano-embed__state">{msg}</p>;

  // Columnes: sempre 1..scheduled_rounds (8). Si existeix jornada amb aquest
  // round_number s'hi associa; si no, columna futura buida.
  const matrixColumns = useMemo(() => {
    const count = scheduledRounds > 0 ? scheduledRounds : MAX_MATRIX_ROUNDS;
    return Array.from({ length: count }, (_, i) => {
      const number = i + 1;
      const round = rounds.find((r) => r.round_number === number);
      return { number, round };
    });
  }, [rounds, scheduledRounds]);

  const renderList = (players: CompetitionRankedPlayer[]) => {
    if (!players.length) return state('Todavía no hay clasificación en esta categoría.');
    // Una sola definició de columnes: mateixa classe + mateixa variable CSS.
    const gridStyle = { '--pano-round-count': matrixColumns.length } as React.CSSProperties;
    return (
      <>
        <div className="pano-matrix__line pano-matrix__head" style={gridStyle}>
          <span className="pano-embed__pos" aria-hidden="true" />
          <span className="pano-embed__name" aria-hidden="true" />
          <span className="pano-matrix__grid">
            {matrixColumns.map(({ number, round }) => {
              const label = round
                ? `Prueba ${number}${round.name ? ` · ${round.name}` : ''}${round.date ? ` · ${round.date}` : ''}`
                : `Prueba ${number} · pendiente`;
              return (
                <span key={number} className="pano-matrix__label" title={label} aria-label={label}>
                  P{number}
                </span>
              );
            })}
          </span>
          <span className="pano-embed__points">Total</span>
        </div>
        <ol className="pano-embed__list">
          {players.map((p, i) => {
            const discarded = new Set(p.discardedRoundIds);
            const displayName = formatPlayerDisplayName(p.name);
            return (
              <li
                key={p.id}
                className="pano-embed__row pano-matrix__line pano-matrix__row"
                style={gridStyle}
                aria-label={`${p.name}, ${p.total} puntos, ${p.roundsPlayed} pruebas disputadas`}
              >
                <span className="pano-embed__pos">{String(i + 1).padStart(2, '0')}</span>
                <span className="pano-embed__name" title={p.name}>
                  {displayName}
                </span>
                <span className="pano-matrix__grid">
                  {matrixColumns.map(({ number, round }) => {
                    const pts = round ? p.pointsByRound[round.id] : undefined;
                    if (pts == null) {
                      return (
                        <span
                          key={number}
                          className="pano-matrix__cell pano-matrix__cell--empty"
                          aria-label={`Prueba ${number}: sin resultado`}
                        >
                          —
                        </span>
                      );
                    }
                    const isDiscarded = round ? discarded.has(round.id) : false;
                    return (
                      <span
                        key={number}
                        className={`pano-matrix__cell${isDiscarded ? ' pano-matrix__cell--discarded' : ''}`}
                        title={isDiscarded ? 'Resultado descartado' : undefined}
                        aria-label={
                          isDiscarded
                            ? `Prueba ${number}: ${pts} puntos — resultado descartado`
                            : `Prueba ${number}: ${pts} puntos`
                        }
                      >
                        {pts}
                      </span>
                    );
                  })}
                </span>
                <span className="pano-embed__points">
                  <strong className="pano-matrix__total">{p.total}</strong>
                  <span className="pano-matrix__unit">pts</span>
                </span>
              </li>
            );
          })}
        </ol>
      </>
    );
  };

  const body = () => {
    if (isLoading) return state('Cargando clasificación…');

    if (competitionNotFound) return state('Competición no disponible.');
    if (error) return state('No se ha podido cargar la clasificación. Inténtalo de nuevo más tarde.');
    if (!rounds.length) return state('Esta competición todavía no tiene pruebas programadas.');
    if (!results.length) return state('Todavía no hay resultados publicados.');

    if (section === 'rounds') {
      return (
        <CompetitionRounds
          rounds={rounds}
          results={results}
          categoryThreshold={categoryThreshold}
          categoryHandicapMap={categoryHandicapMap}
        />
      );
    }

    const activeLabel = TABS.find((t) => t.key === tab)?.label ?? '';

    return (
      <>
        <div className="pano-embed__tabs" role="tablist" aria-label="Categorías del ranking">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              className="pano-embed__tab"
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="pano-embed__caption">Orden del mérito individual — {activeLabel}</p>
        {renderList(rankings[tab])}
      </>
    );
  };

  return (
    <div className="pano-embed">
      <div className="pano-embed__inner">
        <p className="pano-embed__eyebrow">Panorámica Golf · Temporada 2026</p>
        <h1 className="pano-embed__title">Orden del Mérito Individual</h1>

        <nav className="pano-embed__nav" role="tablist" aria-label="Secciones">
          {SECTIONS.map((sec) => (
            <button
              key={sec.key}
              type="button"
              role="tab"
              aria-selected={section === sec.key}
              disabled={sec.disabled}
              className="pano-embed__tab"
              onClick={() => !sec.disabled && setSection(sec.key)}
            >
              {sec.disabled ? `${sec.label} · Próximamente` : sec.label}
            </button>
          ))}
        </nav>

        <section
          id="pano-ranking-panel"
          role="tabpanel"
          aria-label={SECTIONS.find((sec) => sec.key === section)?.label}
          aria-live="polite"
        >
          <h2 className="pano-embed__sr">
            {SECTIONS.find((sec) => sec.key === section)?.label}
          </h2>
          {body()}
        </section>
      </div>
    </div>
  );
};

export default EmbedIndividual2026;
