/**
 * Contenidor compartit dels embeds públics de Panorámica.
 * Extret literalment de EmbedIndividual2026 i parametritzat per slug/títol/Scratch.
 * No afegeix consultes: tota la dada ve de useCompetitionIndividualRanking(slug).
 */
import { useMemo, useState } from 'react';
import {
  useCompetitionIndividualRanking,
  type CompetitionRankedPlayer,
} from '@/hooks/useCompetitionIndividualRanking';
import CompetitionRounds from '@/components/embed/CompetitionRounds';
import CompetitionStats from '@/components/embed/CompetitionStats';
import CompetitionRulesDialog from '@/components/embed/CompetitionRulesDialog';
import type { CompetitionRules } from '@/data/competitionRules';


import PlayerProfileDialog, { type PlayerProfileCompetitionData } from '@/components/PlayerProfileDialog';
import { formatPlayerDisplayName } from '@/lib/formatPlayerDisplayName';
import type { PublicPlayer } from '@/lib/publicCircuitData';
import '@/styles/embed-panoramica.css';

type TabKey = 'hcpLow' | 'hcpHigh' | 'scratch';

type SectionKey = 'ranking' | 'rounds' | 'stats';

const SECTIONS_DEFAULT: { key: SectionKey; label: string }[] = [
  { key: 'ranking', label: 'Orden del mérito' },
  { key: 'rounds', label: 'Pruebas' },
  { key: 'stats', label: 'Estadísticas' },
];

const MAX_MATRIX_ROUNDS = 8;

export type EmbedCompetitionViewProps = {
  slug: string;
  eyebrow: string;
  title: string;
  /** Etiqueta de la primera secció (per defecte "Orden del mérito"). */
  rankingLabel?: string;
  /** Text sota les pestanyes de categoria. */
  rankingCaption?: string;
  /** Mostrar la categoria Scratch (Individual: true; Liga de Verano: false). */
  showScratch?: boolean;
  /** Estat editorial quan encara no hi ha resultats. */
  emptyRankingTitle?: string;
  emptyRankingSubtitle?: string;
  emptyStatsText?: string;
  /** Reglament resumit; si no hi és, no es renderitza el botó. */
  rules?: CompetitionRules;
  /** PDF oficial enllaçat com a acció secundària dins del modal. */
  officialPdfUrl?: string;
  regulationLabel?: string;
  regulationAriaLabel?: string;
};


const EmbedCompetitionView = ({
  slug,
  eyebrow,
  title,
  rankingLabel = 'Orden del mérito',
  rankingCaption = 'Orden del mérito individual',
  showScratch = true,
  emptyRankingTitle = 'Todavía no hay resultados publicados.',
  emptyRankingSubtitle,
  emptyStatsText = 'Todavía no hay resultados publicados.',
  rules,
  officialPdfUrl,
  regulationLabel = 'REGLAMENTO',
  regulationAriaLabel,


}: EmbedCompetitionViewProps) => {
  const {
    rounds,
    results,
    rankings,
    categoryThreshold,
    categoryHandicapMap,
    scheduledRounds,
    bestN,
    isLoading,
    error,
    competitionNotFound,
  } = useCompetitionIndividualRanking(slug);

  const TABS = useMemo(
    () =>
      [
        { key: 'hcpLow' as TabKey, label: '1ª Categoría' },
        { key: 'hcpHigh' as TabKey, label: '2ª Categoría' },
        ...(showScratch ? [{ key: 'scratch' as TabKey, label: 'Scratch' }] : []),
      ],
    [showScratch]
  );

  const SECTIONS = useMemo(
    () => SECTIONS_DEFAULT.map((s) => (s.key === 'ranking' ? { ...s, label: rankingLabel } : s)),
    [rankingLabel]
  );

  const [section, setSection] = useState<SectionKey>('ranking');
  const [tab, setTab] = useState<TabKey>('hcpLow');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);


  // Jugadors derivats dels resultats ja carregats (cap consulta nova).
  const players = useMemo<PublicPlayer[]>(() => {
    const map = new Map<string, PublicPlayer>();
    for (const r of results) {
      if (r.players_public && !map.has(r.player_id)) map.set(r.player_id, r.players_public);
    }
    return Array.from(map.values());
  }, [results]);

  const competitionData = useMemo<PlayerProfileCompetitionData>(
    () => ({ players, results, rankings, bestN, categoryThreshold }),
    [players, results, rankings, bestN, categoryThreshold]
  );

  const state = (msg: string) => <p className="pano-embed__state">{msg}</p>;

  // Columnes: sempre 1..scheduled_rounds. Si existeix jornada amb aquest
  // round_number s'hi associa; si no, columna futura buida.
  const matrixColumns = useMemo(() => {
    const count = scheduledRounds > 0 ? scheduledRounds : MAX_MATRIX_ROUNDS;
    return Array.from({ length: count }, (_, i) => {
      const number = i + 1;
      const round = rounds.find((r) => r.round_number === number);
      return { number, round };
    });
  }, [rounds, scheduledRounds]);

  const gridStyle = { '--pano-round-count': matrixColumns.length } as React.CSSProperties;

  const renderMatrixHead = () => (
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
  );

  const renderList = (list: CompetitionRankedPlayer[]) => {
    if (!list.length) return state('Todavía no hay clasificación en esta categoría.');
    return (
      <>
        {renderMatrixHead()}
        <ol className="pano-embed__list">
          {list.map((p, i) => {
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
                <button
                  type="button"
                  className="pano-embed__name pano-embed__namebtn"
                  title={p.name}
                  aria-label={`Ver ficha de ${p.name}`}
                  onClick={() => setSelectedPlayerId(p.id)}
                >
                  {displayName}
                </button>

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

  const renderTabs = () => (
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
  );

  const body = () => {
    if (isLoading) return state('Cargando clasificación…');

    if (competitionNotFound) return state('Competición no disponible.');
    if (error) return state('No se ha podido cargar la clasificación. Inténtalo de nuevo más tarde.');
    // Sense jornades encara: cada secció mostra el seu propi estat editorial.

    if (section === 'stats') {
      if (!results.length) return state(emptyStatsText);
      return (
        <CompetitionStats
          results={results}
          rankings={rankings}
          bestN={bestN}
          showScratch={showScratch}
          onPlayerClick={setSelectedPlayerId}
        />
      );
    }

    if (section === 'rounds') {
      return (
        <CompetitionRounds
          rounds={rounds}
          results={results}
          categoryThreshold={categoryThreshold}
          categoryHandicapMap={categoryHandicapMap}
          showScratch={showScratch}
          onPlayerClick={setSelectedPlayerId}
        />
      );
    }

    const activeLabel = TABS.find((t) => t.key === tab)?.label ?? '';

    if (!results.length) {
      return (
        <>
          {renderTabs()}
          <p className="pano-embed__caption">
            {rankingCaption} — {activeLabel}
          </p>
          {renderMatrixHead()}
          <p className="pano-embed__state pano-embed__state--lead">{emptyRankingTitle}</p>
          {emptyRankingSubtitle && <p className="pano-embed__state">{emptyRankingSubtitle}</p>}
        </>
      );
    }

    return (
      <>
        {renderTabs()}
        <p className="pano-embed__caption">
          {rankingCaption} — {activeLabel}
        </p>
        {renderList(rankings[tab])}
      </>
    );
  };

  return (
    <div className="pano-embed">
      <div className="pano-embed__inner">
        <p className="pano-embed__eyebrow">{eyebrow}</p>
        <h1 className="pano-embed__title">{title}</h1>

        <div className="pano-embed__primary-nav">
          <nav className="pano-embed__nav" role="tablist" aria-label="Secciones">
            {SECTIONS.map((sec) => (
              <button
                key={sec.key}
                type="button"
                role="tab"
                aria-selected={section === sec.key}
                className="pano-embed__tab"
                onClick={() => setSection(sec.key)}
              >
                {sec.label}
              </button>
            ))}
          </nav>
          {rules && (
            <button
              type="button"
              className="pano-embed__regulation-link"
              aria-label={regulationAriaLabel ?? regulationLabel}
              onClick={() => setRulesOpen(true)}
            >
              {regulationLabel}
            </button>
          )}

        </div>


        <section
          id="pano-ranking-panel"
          role="tabpanel"
          aria-label={SECTIONS.find((sec) => sec.key === section)?.label}
          aria-live="polite"
        >
          <h2 className="pano-embed__sr">{SECTIONS.find((sec) => sec.key === section)?.label}</h2>
          {body()}
        </section>
      </div>

      <PlayerProfileDialog
        playerId={selectedPlayerId}
        open={!!selectedPlayerId}
        onOpenChange={(o) => !o && setSelectedPlayerId(null)}
        competitionData={competitionData}
        variant="panoramica"
      />

      {rules && (
        <CompetitionRulesDialog
          open={rulesOpen}
          onOpenChange={setRulesOpen}
          rules={rules}
          officialPdfUrl={officialPdfUrl}
        />
      )}
    </div>

  );
};

export default EmbedCompetitionView;
