/**
 * Vista pública por iframe — Orden del Mérito de Parejas 2026 (Panorámica).
 * Solo jornadas publicadas: nunca muestra draft, imported, review ni validated.
 */
import EmbedPairsCompetitionView from '@/components/embed/EmbedPairsCompetitionView';
import { pairs2026Rules } from '@/data/competitionRules';

const EmbedParejas2026 = () => (
  <EmbedPairsCompetitionView
    competitionSlug="parejas-2026"
    rules={pairs2026Rules}
    officialPdfUrl={{
      es: '/reglamentos/reglamento-orden-merito-parejas-2026-es-v20260917.pdf',
      en: '/reglamentos/competition-rules-pairs-order-of-merit-2026-en-v20260917.pdf',
    }}
    regulationLabel={{ es: 'REGLAMENTO', en: 'COMPETITION RULES' }}
    regulationAriaLabel={{
      es: 'Abrir reglamento de la Orden del Mérito de Parejas 2026',
      en: 'Open the Pairs Order of Merit 2026 competition rules',
    }}
  />
);

export default EmbedParejas2026;
