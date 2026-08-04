/**
 * Estado compartido de "modal público abierto" para los embeds de Panorámica.
 * Cuenta cuántos diálogos públicos (ficha de jugador, ficha de pareja,
 * reglamento) están abiertos y avisa al padre con:
 *   { type: 'panoramica-embed-modal-state', open: boolean }
 * El puente de scroll consulta este estado para no reenviar la rueda.
 * Los diálogos administrativos no usan este hook.
 */
import { useEffect } from 'react';

export const PANORAMICA_EMBED_MODAL_STATE_MESSAGE = 'panoramica-embed-modal-state' as const;

export type PanoramicaEmbedModalStateMessage = {
  type: typeof PANORAMICA_EMBED_MODAL_STATE_MESSAGE;
  open: boolean;
};

let openCount = 0;
const listeners = new Set<(open: boolean) => void>();

/** ¿Hay algún modal público abierto ahora mismo? */
export function isPanoramicaPublicModalOpen(): boolean {
  return openCount > 0;
}

export function subscribePanoramicaPublicModal(listener: (open: boolean) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(open: boolean): void {
  for (const listener of listeners) listener(open);
  if (typeof window === 'undefined' || window.parent === window) return;
  const message: PanoramicaEmbedModalStateMessage = {
    type: PANORAMICA_EMBED_MODAL_STATE_MESSAGE,
    open,
  };
  window.parent.postMessage(message, '*');
}

/** Registra un modal público abierto; devuelve la función de liberación. */
export function registerPanoramicaPublicModal(): () => void {
  openCount += 1;
  if (openCount === 1) notify(true);

  let released = false;
  return () => {
    if (released) return;
    released = true;
    openCount = Math.max(0, openCount - 1);
    if (openCount === 0) notify(false);
  };
}

/** Marca el diálogo como modal público mientras `open` sea true. */
export function usePanoramicaPublicModal(open: boolean): void {
  useEffect(() => {
    if (!open) return;
    return registerPanoramicaPublicModal();
  }, [open]);
}

export default usePanoramicaPublicModal;
