/**
 * Panorámica — controlador ÚNICO de integración del iframe de rankings.
 *
 * Uso en la web padre:
 *   <iframe id="panoramica-embed"
 *           src="https://rankingspanoramica.fairwaystudio.ai/embed/individual-2026"
 *           style="width:100%;border:0;height:600px"></iframe>
 *   <script src="https://rankingspanoramica.fairwaystudio.ai/embed/panoramica-embed-parent.js"
 *           data-iframe-id="panoramica-embed"></script>
 *
 * Un solo listener de 'message'. Sin wheel, sin requestAnimationFrame,
 * sin smooth, sin intervalos, sin doble body-lock.
 */
(function () {
  'use strict';

  var ORIGIN = 'https://rankingspanoramica.fairwaystudio.ai';

  var script = document.currentScript;
  var iframeId = (script && script.getAttribute('data-iframe-id')) || 'panoramica-embed';

  function getIframe() {
    var el = document.getElementById(iframeId);
    if (el && el.tagName === 'IFRAME') return el;
    return document.querySelector('iframe[src*="rankingspanoramica"]');
  }

  var iframe = getIframe();
  if (!iframe) return;

  // Evita dos instancias del controlador sobre el mismo iframe.
  if (iframe.dataset.panoramicaController === 'true') return;
  iframe.dataset.panoramicaController = 'true';

  var modalOpen = false;
  var savedScrollY = 0;
  var savedIframeStyle = '';
  var savedBodyStyle = '';
  var lastHeight = null;

  function post(message) {
    var target = iframe.contentWindow;
    if (!target) return;
    target.postMessage(message, ORIGIN);
  }

  /* ---------------------------------------------- viewport normal */
  function sendViewport() {
    if (modalOpen) return;
    var rect = iframe.getBoundingClientRect();
    var visibleTop = Math.max(0, -rect.top);
    var visibleBottom = Math.min(rect.height, window.innerHeight - rect.top);
    var visibleHeight = Math.max(0, visibleBottom - visibleTop);
    post({
      type: 'panoramica-parent-viewport',
      visibleTop: visibleTop,
      visibleHeight: visibleHeight,
    });
  }

  /* ---------------------------------------------- altura normal */
  function applyHeight(height) {
    iframe.style.height = Math.ceil(height) + 'px';
    sendViewport();
  }

  /* ---------------------------------------------- modal abierto */
  function openFullscreen() {
    if (modalOpen) return;
    modalOpen = true;

    savedScrollY = window.scrollY || window.pageYOffset || 0;
    savedIframeStyle = iframe.getAttribute('style') || '';
    savedBodyStyle = document.body.getAttribute('style') || '';

    iframe.style.position = 'fixed';
    iframe.style.inset = '0';
    iframe.style.top = '0';
    iframe.style.left = '0';
    iframe.style.width = '100vw';
    iframe.style.height = '100dvh';
    iframe.style.zIndex = '99999';
    iframe.style.border = '0';
    iframe.style.margin = '0';

    document.body.style.position = 'fixed';
    document.body.style.top = -savedScrollY + 'px';
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';

    // El diálogo se centra respecto a la pantalla real.
    post({
      type: 'panoramica-parent-viewport',
      visibleTop: 0,
      visibleHeight: window.innerHeight,
    });
  }

  /* ---------------------------------------------- modal cerrado */
  function closeFullscreen() {
    if (!modalOpen) return;

    if (savedIframeStyle) iframe.setAttribute('style', savedIframeStyle);
    else iframe.removeAttribute('style');

    if (savedBodyStyle) document.body.setAttribute('style', savedBodyStyle);
    else document.body.removeAttribute('style');

    if (lastHeight != null) iframe.style.height = Math.ceil(lastHeight) + 'px';

    window.scrollTo(0, savedScrollY);

    modalOpen = false;
    sendViewport();
  }

  /* ---------------------------------------------- único listener */
  window.addEventListener('message', function (event) {
    if (event.origin !== ORIGIN) return;
    if (event.source !== iframe.contentWindow) return;

    var data = event.data;
    if (!data || typeof data !== 'object') return;

    switch (data.type) {
      case 'panoramica-embed-scroll':
        if (modalOpen) return;
        if (typeof data.deltaY !== 'number' || !isFinite(data.deltaY)) return;
        window.scrollBy({ top: data.deltaY, left: 0, behavior: 'auto' });
        return;

      case 'panoramica-embed-height':
        if (typeof data.height !== 'number' || !isFinite(data.height) || data.height <= 0) return;
        lastHeight = data.height;
        if (modalOpen) return; // no sustituir el 100dvh
        applyHeight(data.height);
        return;

      case 'panoramica-embed-modal-state':
        if (data.open === true) openFullscreen();
        else closeFullscreen();
        return;

      case 'panoramica-embed-request-viewport':
        if (modalOpen) {
          post({
            type: 'panoramica-parent-viewport',
            visibleTop: 0,
            visibleHeight: window.innerHeight,
          });
        } else {
          sendViewport();
        }
        return;

      default:
        return;
    }
  });

  window.addEventListener('scroll', sendViewport, { passive: true });
  window.addEventListener('resize', function () {
    if (modalOpen) {
      post({
        type: 'panoramica-parent-viewport',
        visibleTop: 0,
        visibleHeight: window.innerHeight,
      });
    } else {
      sendViewport();
    }
  });
  iframe.addEventListener('load', sendViewport);
  sendViewport();
})();
