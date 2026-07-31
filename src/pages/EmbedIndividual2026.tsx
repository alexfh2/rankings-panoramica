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
    isLoading,
    error,
    competitionNotFound,
  } = useCompetitionIndividualRanking(SLUG);
  const [section, setSection] = useState<SectionKey>('ranking');
  const [tab, setTab] = useState<TabKey>('hcpLow');

  const state = (msg: string) => <p className="pano-embed__state">{msg}</p>;

  // Columnas de la matriz: jornadas programadas ordenadas por round_number y fecha.
  const matrixRounds = useMemo(
    () =>
      [...rounds]
        .sort((a, b) => {
          const an = a.round_number ?? Number.MAX_SAFE_INTEGER;
          const bn = b.round_number ?? Number.MAX_SAFE_INTEGER;
          if (an !== bn) return an - bn;
          return (a.date ?? '').localeCompare(b.date ?? '');
        })
        .slice(0, MAX_MATRIX_ROUNDS),
    [rounds]
  );

  const renderList = (players: CompetitionRankedPlayer[]) => {
    if (!players.length) return state('Todavía no hay clasificación en esta categoría.');
    return (
      <>
        <div className="pano-matrix__head" aria-hidden="true">
          <span className="pano-embed__pos" />
          <span className="pano-embed__name" />
          <span className="pano-matrix__grid">
            {matrixRounds.map((r, i) => (
              <span
                key={r.id}
                className="pano-matrix__label"
                title={`${r.name}${r.date ? ` · ${r.date}` : ''}`}
              >
                P{r.round_number ?? i + 1}
              </span>
            ))}
          </span>
          <span className="pano-embed__points">Total</span>
        </div>
        <ol className="pano-embed__list">
          {players.map((p, i) => {
            const discarded = new Set(p.discardedRoundIds);
            return (
              <li
                key={p.id}
                className="pano-embed__row pano-matrix__row"
                aria-label={`${p.name}, ${p.total} puntos, ${p.roundsPlayed} pruebas disputadas`}
              >
                <span className="pano-embed__pos">{String(i + 1).padStart(2, '0')}</span>
                <span className="pano-embed__name">{p.name}</span>
                <span className="pano-matrix__grid">
                  {matrixRounds.map((r) => {
                    const pts = p.pointsByRound[r.id];
                    if (pts == null) {
                      return (
                        <span key={r.id} className="pano-matrix__cell pano-matrix__cell--empty">
                          —
                        </span>
                      );
                    }
                    const isDiscarded = discarded.has(r.id);
                    return (
                      <span
                        key={r.id}
                        className={`pano-matrix__cell${isDiscarded ? ' pano-matrix__cell--discarded' : ''}`}
                        title={isDiscarded ? 'Resultado descartado' : undefined}
                        aria-label={isDiscarded ? `${pts} puntos — resultado descartado` : `${pts} puntos`}
                      >
                        {pts}
                      </span>
                    );
                  })}
                </span>
                <span className="pano-embed__points">{p.total} pts</span>
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
