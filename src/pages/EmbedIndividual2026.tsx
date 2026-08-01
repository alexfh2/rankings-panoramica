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
    officialPdfUrl="/reglamentos/reglamento-omi-2026.pdf"
    regulationLabel="REGLAMENTO"
    regulationAriaLabel="Abrir reglamento de la Orden del Mérito Individual 2026"
  />
);

export default EmbedIndividual2026;
