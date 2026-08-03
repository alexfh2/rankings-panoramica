/**
 * Envía la altura real del embed a la ventana padre mediante postMessage.
 * Mensaje: { type: 'panoramica-embed-height', height: <px entero> }
 * Automático vía ResizeObserver. Sin polling ni intervalos.
 */
import { useEffect, type RefObject } from 'react';

export const PANORAMICA_EMBED_HEIGHT_MESSAGE = 'panoramica-embed-height' as const;

export type PanoramicaEmbedHeightMessage = {
  type: typeof PANORAMICA_EMBED_HEIGHT_MESSAGE;
  height: number;
};

export function usePanoramicaEmbedHeight(
  containerRef: RefObject<HTMLElement>
): void {
  useEffect(() => {
    // Visita directa (sin iframe): no hacer nada, sin errores ni warnings.
    if (typeof window === 'undefined' || window.parent === window) return;

    const container = containerRef.current;
    if (!container) return;

    let lastSent = -1;
    let frame: number | null = null;
    let cancelled = false;

    const measure = (): number => {
      const rect = container.getBoundingClientRect().height;
      const candidates = [
        container.scrollHeight,
        rect,
        document.body?.scrollHeight ?? 0,
        document.documentElement?.scrollHeight ?? 0,
      ];
      return Math.ceil(Math.max(...candidates.filter((n) => Number.isFinite(n) && n > 0)));
    };

    const send = () => {
      frame = null;
      if (cancelled) return;
      const height = measure();
      if (!Number.isFinite(height) || height <= 0) return;
      if (height === lastSent) return;
      lastSent = height;
      const message: PanoramicaEmbedHeightMessage = {
        type: PANORAMICA_EMBED_HEIGHT_MESSAGE,
        height,
      };
      window.parent.postMessage(message, '*');
    };

    const schedule = () => {
      if (cancelled || frame !== null) return;
      frame = window.requestAnimationFrame(send);
    };

    schedule();

    const observer = new ResizeObserver(schedule);
    observer.observe(container);

    window.addEventListener('load', schedule);

    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    fonts?.ready.then(schedule).catch(() => undefined);

    return () => {
      cancelled = true;
      if (frame !== null) window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('load', schedule);
    };
  }, [containerRef]);
}

export default usePanoramicaEmbedHeight;
