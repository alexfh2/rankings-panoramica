/**
 * Shell de los embeds de Panorámica (modelo simple).
 * - Marca <html data-pano-embed-route> mientras una ruta embed está montada,
 *   para activar el layout de viewport propio con scroll interno nativo.
 * - Devuelve la ref del único contenedor scrollable y un scrollToTop instantáneo.
 * No envía ni escucha postMessage: el único mensaje de la integración es
 * 'panoramica-embed-modal-state' (gestionado por usePanoramicaPublicModalState).
 */
import { useCallback, useRef, useEffect } from 'react';

export function usePanoramicaEmbedShell() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-pano-embed-route', 'true');
    return () => root.removeAttribute('data-pano-embed-route');
  }, []);

  const scrollToTop = useCallback(() => {
    ref.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  return { ref, scrollToTop };
}

export default usePanoramicaEmbedShell;
