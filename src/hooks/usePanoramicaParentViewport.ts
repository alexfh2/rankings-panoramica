/**
 * Recibe del padre la zona visible del iframe y la publica como variables CSS
 * (--pano-parent-visible-top / --pano-parent-visible-height) en <html>.
 * Mensaje esperado: { type: 'panoramica-parent-viewport', visibleTop, visibleHeight }
 * Visita directa (sin iframe): fallback a window.innerHeight, sin errores.
 */
import { useEffect, useState } from 'react';

export const PANORAMICA_PARENT_VIEWPORT_MESSAGE = 'panoramica-parent-viewport' as const;
export const PANORAMICA_REQUEST_VIEWPORT_MESSAGE = 'panoramica-embed-request-viewport' as const;

export type PanoramicaParentViewport = {
  visibleTop: number;
  visibleHeight: number;
};

type ParentViewportMessage = {
  type: typeof PANORAMICA_PARENT_VIEWPORT_MESSAGE;
  visibleTop: number;
  visibleHeight: number;
};

const isEmbedded = (): boolean => typeof window !== 'undefined' && window.parent !== window;

const isParentViewportMessage = (data: unknown): data is ParentViewportMessage => {
  if (typeof data !== 'object' || data === null) return false;
  const d = data as Record<string, unknown>;
  if (d.type !== PANORAMICA_PARENT_VIEWPORT_MESSAGE) return false;
  const top = d.visibleTop;
  const height = d.visibleHeight;
  return (
    typeof top === 'number' &&
    Number.isFinite(top) &&
    top >= 0 &&
    typeof height === 'number' &&
    Number.isFinite(height) &&
    height > 0
  );
};

/** Pide al padre una medición de la zona visible (al montar y al abrir un modal). */
export function requestPanoramicaParentViewport(): void {
  if (!isEmbedded()) return;
  window.parent.postMessage({ type: PANORAMICA_REQUEST_VIEWPORT_MESSAGE }, '*');
}

const applyVars = (v: PanoramicaParentViewport): void => {
  const root = document.documentElement;
  root.style.setProperty('--pano-parent-visible-top', `${Math.round(v.visibleTop)}px`);
  root.style.setProperty('--pano-parent-visible-height', `${Math.round(v.visibleHeight)}px`);
};

export function usePanoramicaParentViewport(): PanoramicaParentViewport | null {
  const [viewport, setViewport] = useState<PanoramicaParentViewport | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const root = document.documentElement;

    if (!isEmbedded()) {
      // Visita directa: comportamiento clásico centrado en el viewport.
      root.removeAttribute('data-pano-embedded');
      const fallback = () => {
        const v = { visibleTop: window.scrollY, visibleHeight: window.innerHeight };
        setViewport(v);
        applyVars(v);
      };
      fallback();
      window.addEventListener('resize', fallback);
      return () => window.removeEventListener('resize', fallback);
    }

    root.setAttribute('data-pano-embedded', 'true');

    const onMessage = (event: MessageEvent) => {
      if (!isParentViewportMessage(event.data)) return;
      const next: PanoramicaParentViewport = {
        visibleTop: event.data.visibleTop,
        visibleHeight: event.data.visibleHeight,
      };
      setViewport(next);
      applyVars(next);
    };

    window.addEventListener('message', onMessage);
    requestPanoramicaParentViewport();

    return () => {
      window.removeEventListener('message', onMessage);
      root.removeAttribute('data-pano-embedded');
    };
  }, []);

  return viewport;
}

export default usePanoramicaParentViewport;
