/**
 * Reenvía el scroll vertical del embed a la ventana padre mediante postMessage.
 * Mensaje: { type: 'panoramica-embed-scroll', deltaY: number }
 * Solo cuando el gesto quedaría atrapado dentro del iframe (sin zona interna
 * con scroll vertical disponible en esa dirección). Sin polling ni intervalos.
 */
import { useEffect } from 'react';

export const PANORAMICA_EMBED_SCROLL_MESSAGE = 'panoramica-embed-scroll' as const;

export type PanoramicaEmbedScrollMessage = {
  type: typeof PANORAMICA_EMBED_SCROLL_MESSAGE;
  deltaY: number;
};

const EPSILON = 1;

/** ¿El elemento (o algún ancestro) puede aún desplazarse verticalmente en esa dirección? */
function hasUsableVerticalScroll(start: EventTarget | null, deltaY: number): boolean {
  let node: Node | null = start instanceof Node ? start : null;

  while (node) {
    if (node instanceof HTMLElement) {
      const style = window.getComputedStyle(node);
      const overflowY = style.overflowY;
      const scrollable =
        overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay';

      if (scrollable && node.scrollHeight - node.clientHeight > EPSILON) {
        const max = node.scrollHeight - node.clientHeight;
        if (deltaY > 0 && node.scrollTop < max - EPSILON) return true;
        if (deltaY < 0 && node.scrollTop > EPSILON) return true;
      }
    }
    node = node.parentNode ?? null;
  }

  return false;
}

export function usePanoramicaEmbedScrollBridge(): void {
  useEffect(() => {
    // Visita directa (sin iframe): no-op, sin errores ni warnings.
    if (typeof window === 'undefined' || window.parent === window) return;

    const onWheel = (event: WheelEvent) => {
      // Zoom con Ctrl/Cmd: nunca interceptar.
      if (event.ctrlKey || event.metaKey) return;
      if (!event.deltaY) return;
      // Scroll horizontal predominante: lo gestiona el contenido interno.
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      // Zonas con scroll interno aún utilizable (modales, tablas, diálogos).
      if (hasUsableVerticalScroll(event.target, event.deltaY)) return;

      if (event.cancelable) event.preventDefault();

      const message: PanoramicaEmbedScrollMessage = {
        type: PANORAMICA_EMBED_SCROLL_MESSAGE,
        deltaY: event.deltaY,
      };
      window.parent.postMessage(message, '*');
    };

    window.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      window.removeEventListener('wheel', onWheel);
    };
  }, []);
}

export default usePanoramicaEmbedScrollBridge;
