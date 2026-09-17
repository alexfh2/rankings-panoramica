/**
 * Vista pública per iframe — Orden del Mérito Individual 2026 (Panorámica).
 * Tota la lògica i el disseny viuen a EmbedCompetitionView (contenidor compartit).
 */
import EmbedCompetitionView from '@/components/embed/EmbedCompetitionView';
import { individual2026Rules } from '@/data/competitionRules';

const EmbedIndividual2026 = () => (
  <EmbedCompetitionView
    slug="individual-2026"
    eyebrow="Panorámica Golf · Temporada 2026"
    title="Orden del Mérito Individual"
    rankingLabel="Orden del mérito"
    rankingCaption="Orden del mérito individual"
    showScratch
    rules={individual2026Rules}
    officialPdfUrl={{
      es: '/reglamentos/reglamento-om-individual-2026-es-v20260917b.pdf',
      en: '/reglamentos/competition-rules-individual-order-of-merit-2026-en-v20260917b.pdf',
    }}
    showPlayersTab
    playersTabLabel="Jugadores"
    regulationLabel={{ es: 'REGLAMENTO', en: 'COMPETITION RULES' }}
    regulationAriaLabel={{
      es: 'Abrir reglamento de la Orden del Mérito Individual 2026',
      en: 'Open the Individual Order of Merit 2026 competition rules',
    }}
  />
);

export default EmbedIndividual2026;
