/**
 * Vista pública per iframe — Liga de Verano 2026 (Panorámica).
 * Reutilitza el contenidor compartit EmbedCompetitionView amb el slug verano-2026.
 * Sense categoria Scratch: 5 proves, millors 4, llindar de categoria des de rules_config.
 */
import EmbedCompetitionView from '@/components/embed/EmbedCompetitionView';

const EmbedVerano2026 = () => (
  <EmbedCompetitionView
    slug="verano-2026"
    eyebrow="Panorámica Golf · Temporada 2026"
    title="Liga de Verano 2026"
    rankingLabel="Clasificación"
    rankingCaption="Clasificación general"
    showScratch={false}
    emptyRankingTitle="La Liga de Verano comenzará el 10 de agosto."
    emptyRankingSubtitle="La clasificación se actualizará después de la publicación de la primera prueba."
    emptyStatsText="Las estadísticas estarán disponibles después de la primera prueba."
    regulationUrl="/reglamentos/reglamento-liga-verano-2026.pdf"
    regulationLabel="VER REGLAMENTO"
    regulationAriaLabel="Abrir reglamento de la Liga de Verano 2026"

  />
);

export default EmbedVerano2026;
