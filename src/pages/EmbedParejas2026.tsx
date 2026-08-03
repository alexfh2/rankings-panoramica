/**
 * Vista pública por iframe — Orden del Mérito de Parejas 2026 (Panorámica).
 * Solo jornadas publicadas: nunca muestra draft, imported, review ni validated.
 */
import EmbedPairsCompetitionView from '@/components/embed/EmbedPairsCompetitionView';

const EmbedParejas2026 = () => (
  <EmbedPairsCompetitionView competitionSlug="parejas-2026" />
);

export default EmbedParejas2026;
