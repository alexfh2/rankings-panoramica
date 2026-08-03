/**
 * Vista previa protegida para administradores del Orden del Mérito de Parejas 2026.
 * Incluye jornadas no publicadas: solo accesible tras ProtectedRoute (usuario admin).
 */
import EmbedPairsCompetitionView from '@/components/embed/EmbedPairsCompetitionView';

const AdminPreviewParejas2026 = () => (
  <EmbedPairsCompetitionView competitionSlug="parejas-2026" includeUnpublished previewMode />
);

export default AdminPreviewParejas2026;
