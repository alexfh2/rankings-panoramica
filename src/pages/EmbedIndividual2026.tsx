/**
 * Vista pública per iframe — Orden del Mérito Individual 2026 (Panorámica).
 * Tota la lògica i el disseny viuen a EmbedCompetitionView (contenidor compartit).
 */
import EmbedCompetitionView from '@/components/embed/EmbedCompetitionView';

const EmbedIndividual2026 = () => (
  <EmbedCompetitionView
    slug="individual-2026"
    eyebrow="Panorámica Golf · Temporada 2026"
    title="Orden del Mérito Individual"
    rankingLabel="Orden del mérito"
    rankingCaption="Orden del mérito individual"
    showScratch
  />
);

export default EmbedIndividual2026;
