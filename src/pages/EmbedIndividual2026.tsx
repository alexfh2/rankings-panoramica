/**
 * Vista pública per iframe — Orden del Mérito Individual 2026 (Panorámica).
 * Reutilitza íntegrament useCompetitionIndividualRanking; cap lògica nova.
 */
import { useState } from 'react';
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

const EmbedIndividual2026 = () => {
  const { rounds, results, rankings, categoryThreshold, isLoading, error, competitionNotFound } =
    useCompetitionIndividualRanking(SLUG);
  const [section, setSection] = useState<SectionKey>('ranking');
  const [tab, setTab] = useState<TabKey>('hcpLow');

  const state = (msg: string) => <p className="pano-embed__state">{msg}</p>;

  const renderList = (players: CompetitionRankedPlayer[]) => {
    if (!players.length) return state('Todavía no hay clasificación en esta categoría.');
    return (
      <ol className="pano-embed__list">
        {players.map((p, i) => (
          <li key={p.id} className="pano-embed__row">
            <span className="pano-embed__pos">{String(i + 1).padStart(2, '0')}</span>
            <span className="pano-embed__name">{p.name}</span>
            {p.roundsPlayed > 0 && (
              <span className="pano-embed__rounds">{p.roundsPlayed} pruebas</span>
            )}
            <span className="pano-embed__points">{p.total} pts</span>
          </li>
        ))}
      </ol>
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
        <CompetitionRounds rounds={rounds} results={results} categoryThreshold={categoryThreshold} />
      );
    }

    const activeLabel = TABS.find((t) => t.key === tab)?.label ?? '';

    return (
      <>
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
