/**
 * Reenvía el scroll vertical del embed a la ventana padre mediante postMessage.
 * Mensaje: { type: 'panoramica-embed-scroll', deltaY: number }
 * - Agrupa los eventos wheel: acumula deltaY y envía como máximo un mensaje
 *   por requestAnimationFrame.
 * - Normaliza deltaMode (píxeles / líneas / páginas).
 * - Se desactiva por completo mientras hay un modal público abierto, para que
 *   el cuerpo del modal gestione su propio scroll y el fondo no se mueva.
 * Sin polling ni intervalos.
 */
import { useEffect } from 'react';
import { isPanoramicaPublicModalOpen } from '@/hooks/usePanoramicaPublicModalState';

export const PANORAMICA_EMBED_SCROLL_MESSAGE = 'panoramica-embed-scroll' as const;

export type PanoramicaEmbedScrollMessage = {
  type: typeof PANORAMICA_EMBED_SCROLL_MESSAGE;
  deltaY: number;
};

const EPSILON = 1;
const LINE_HEIGHT_PX = 16;

/** Convierte deltaY a píxeles según deltaMode. */
function normalizeDeltaY(event: WheelEvent): number {
  const visibleHeight = window.innerHeight || 800;
  if (event.deltaMode === 1) return event.deltaY * LINE_HEIGHT_PX; // líneas
  if (event.deltaMode === 2) return event.deltaY * visibleHeight; // páginas
  return event.deltaY; // píxeles
}

/** ¿El gesto ocurre dentro de un modal público (o su cuerpo con scroll)? */
function isInsideModal(start: EventTarget | null): boolean {
  const node = start instanceof Element ? start : null;
  if (!node) return false;
  return !!node.closest(
    '[role="dialog"], [role="alertdialog"], .pano-embed-dialog, .pano-embed-dialog__body'
  );
}

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

    let pendingDelta = 0;
    let frame: number | null = null;

    const flush = () => {
      frame = null;
      const deltaY = pendingDelta;
      pendingDelta = 0;
      if (!deltaY) return;
      // Un modal pudo abrirse entre el gesto y el frame: no mover el fondo.
      if (isPanoramicaPublicModalOpen()) return;
      const message: PanoramicaEmbedScrollMessage = {
        type: PANORAMICA_EMBED_SCROLL_MESSAGE,
        deltaY,
      };
      window.parent.postMessage(message, '*');
    };

    const onWheel = (event: WheelEvent) => {
      // Modal público abierto: el bridge queda inactivo por completo.
      if (isPanoramicaPublicModalOpen() || isInsideModal(event.target)) {
        pendingDelta = 0;
        return;
      }
      // Zoom con Ctrl/Cmd: nunca interceptar.
      if (event.ctrlKey || event.metaKey) return;
      if (!event.deltaY) return;
      // Scroll horizontal predominante: lo gestiona el contenido interno.
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      // Zonas con scroll interno aún utilizable (modales, tablas, diálogos).
      if (hasUsableVerticalScroll(event.target, event.deltaY)) return;

      if (event.cancelable) event.preventDefault();

      pendingDelta += normalizeDeltaY(event);
      if (frame === null) frame = window.requestAnimationFrame(flush);
    };

    window.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      window.removeEventListener('wheel', onWheel);
      if (frame !== null) window.cancelAnimationFrame(frame);
      pendingDelta = 0;
    };
  }, []);
}

export default usePanoramicaEmbedScrollBridge;
