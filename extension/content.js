(() => {
  'use strict';

  const CONFIG = {
    sourceLang: 'en',
    targetLang: 'ru',
    hoverDelayMs: 350,
    hideDelayMs: 250,
    maxTextLength: 12000,
    translateChunkSize: 1400,
    longTextThreshold: 1200,
    minTextLength: 2,
    tooltipId: 'cor3-ru-hover-translator-tooltip',
    tooltipBodyClass: 'cor3-ru-hover-translator-tooltip-body',
    tooltipCloseClass: 'cor3-ru-hover-translator-tooltip-close',
    textHitPaddingPx: 3,
    debug: false
  };

  let isEnabled = true;
  let isPointerOverTooltip = false;
  let isLongTooltipMode = false;
  const cache = new Map();
  let hoverTimer = null;
  let hideTimer = null;
  let lastText = '';
  let lastTarget = null;
  let activeController = null;
  let lastMouseX = 0;
  let lastMouseY = 0;

  const tooltip = document.createElement('div');
  tooltip.id = CONFIG.tooltipId;
  tooltip.setAttribute('role', 'tooltip');
  tooltip.style.display = 'none';

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = CONFIG.tooltipCloseClass;
  closeButton.textContent = '×';
  closeButton.title = 'Close translation';

  const tooltipBody = document.createElement('div');
  tooltipBody.className = CONFIG.tooltipBodyClass;

  tooltip.appendChild(closeButton);
  tooltip.appendChild(tooltipBody);
  document.documentElement.appendChild(tooltip);

  closeButton.addEventListener('click', (event) => {
    event.stopPropagation();
    hideTooltip(true);
  });

  tooltip.addEventListener('mouseenter', () => {
    if (!isLongTooltipMode) return;
    isPointerOverTooltip = true;
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
  });

  tooltip.addEventListener('mouseleave', () => {
    if (!isLongTooltipMode) return;
    isPointerOverTooltip = false;
    scheduleHideTooltip();
  });

  function log(...args) {
    if (CONFIG.debug) console.log('[COR3 RU Hover Translator]', ...args);
  }

  function loadEnabledState() {
    if (!chrome?.storage?.local) return;
    chrome.storage.local.get({ cor3TranslatorEnabled: true }, (result) => {
      isEnabled = result.cor3TranslatorEnabled !== false;
      if (!isEnabled) hideTooltip(true);
    });
  }

  loadEnabledState();

  if (chrome?.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'local') return;
      if (!changes.cor3TranslatorEnabled) return;
      isEnabled = changes.cor3TranslatorEnabled.newValue !== false;
      if (!isEnabled) hideTooltip(true);
    });
  }

  function clearTimers() {
    if (hoverTimer) {
      clearTimeout(hoverTimer);
      hoverTimer = null;
    }
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
  }

  function scheduleHideTooltip() {
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (!isPointerOverTooltip) hideTooltip(false);
    }, CONFIG.hideDelayMs);
  }

  function hideTooltip(force = false) {
    if (isPointerOverTooltip && !force) return;

    tooltip.style.display = 'none';
    tooltip.classList.remove('is-long');
    isLongTooltipMode = false;
    tooltipBody.textContent = '';
    lastText = '';
    lastTarget = null;

    if (hoverTimer) {
      clearTimeout(hoverTimer);
      hoverTimer = null;
    }

    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }

    if (activeController) {
      activeController.abort();
      activeController = null;
    }
  }

  function normalizeText(text) {
    return (text || '').replace(/\s+/g, ' ').trim();
  }

  function looksLikeEnglish(text) {
    if (!text) return false;
    if (text.length < CONFIG.minTextLength) return false;

    const latinLetters = text.match(/[A-Za-z]/g) || [];
    const cyrillicLetters = text.match(/[А-Яа-яЁё]/g) || [];

    if (latinLetters.length < 2) return false;
    if (cyrillicLetters.length > latinLetters.length) return false;

    return /[A-Za-z]{2,}/.test(text);
  }

  function isOurTooltip(el) {
    return el && (el.id === CONFIG.tooltipId || el.closest?.(`#${CONFIG.tooltipId}`));
  }

  function isVisibleElement(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;

    const style = window.getComputedStyle(el);
    if (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      Number(style.opacity) === 0 ||
      style.pointerEvents === 'none'
    ) {
      return false;
    }

    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function pointInsideRect(x, y, rect, padding = 0) {
    return (
      x >= rect.left - padding &&
      x <= rect.right + padding &&
      y >= rect.top - padding &&
      y <= rect.bottom + padding
    );
  }

  function getDirectTextNodes(el) {
    if (!el) return [];
    return Array.from(el.childNodes).filter(
      node => node.nodeType === Node.TEXT_NODE && normalizeText(node.nodeValue)
    );
  }

  function getDirectRenderedTextAtPoint(el, x, y) {
    if (!isVisibleElement(el) || isOurTooltip(el)) return '';

    const textNodes = getDirectTextNodes(el);
    if (!textNodes.length) return '';

    const parts = [];

    for (const node of textNodes) {
      const range = document.createRange();
      range.selectNodeContents(node);

      const rects = Array.from(range.getClientRects()).filter(
        rect => rect.width > 0 && rect.height > 0
      );

      const hit = rects.some(rect => pointInsideRect(x, y, rect, CONFIG.textHitPaddingPx));
      range.detach?.();

      if (hit) parts.push(normalizeText(node.nodeValue));
    }

    return normalizeText(parts.join(' '));
  }

  function getTopElementAtPoint(x, y) {
    const el = document.elementFromPoint(x, y);
    if (!el || isOurTooltip(el)) return null;
    if (!isVisibleElement(el)) return null;
    return el;
  }

  function getTextUnderCursor(event) {
    const x = event.clientX;
    const y = event.clientY;

    const topEl = getTopElementAtPoint(x, y);
    if (!topEl) return { element: null, text: '' };

    let text = getDirectRenderedTextAtPoint(topEl, x, y);

    if (!text) {
      const tag = (topEl.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea') {
        text = normalizeText(topEl.value || topEl.placeholder || '');
      }
    }

    if (!looksLikeEnglish(text)) return { element: null, text: '' };

    return {
      element: topEl,
      text: text.slice(0, CONFIG.maxTextLength)
    };
  }

  function splitTextForTranslation(text) {
    const clean = normalizeText(text);
    if (clean.length <= CONFIG.translateChunkSize) return [clean];

    const paragraphs = text
      .split(/\n{2,}/)
      .map(part => normalizeText(part))
      .filter(Boolean);

    const chunks = [];
    let current = '';

    function pushCurrent() {
      if (current) {
        chunks.push(current);
        current = '';
      }
    }

    for (const paragraph of paragraphs.length ? paragraphs : [clean]) {
      if (paragraph.length > CONFIG.translateChunkSize) {
        pushCurrent();

        const sentences = paragraph
          .split(/(?<=[.!?])\s+/)
          .map(part => normalizeText(part))
          .filter(Boolean);

        for (const sentence of sentences) {
          if (sentence.length > CONFIG.translateChunkSize) {
            pushCurrent();

            for (let i = 0; i < sentence.length; i += CONFIG.translateChunkSize) {
              chunks.push(sentence.slice(i, i + CONFIG.translateChunkSize));
            }
          } else if ((current + ' ' + sentence).trim().length <= CONFIG.translateChunkSize) {
            current = (current + ' ' + sentence).trim();
          } else {
            pushCurrent();
            current = sentence;
          }
        }
      } else if ((current + '\n\n' + paragraph).trim().length <= CONFIG.translateChunkSize) {
        current = current ? current + '\n\n' + paragraph : paragraph;
      } else {
        pushCurrent();
        current = paragraph;
      }
    }

    pushCurrent();
    return chunks;
  }

  async function translateSingleChunk(text, signal) {
    const url =
      'https://translate.googleapis.com/translate_a/single?client=gtx' +
      `&sl=${encodeURIComponent(CONFIG.sourceLang)}` +
      `&tl=${encodeURIComponent(CONFIG.targetLang)}` +
      '&dt=t&q=' + encodeURIComponent(text);

    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error(`Translation request failed: ${response.status}`);

    const data = await response.json();
    return normalizeText((data?.[0] || []).map(part => part?.[0] || '').join(' '));
  }

  async function translateText(text, signal) {
    if (cache.has(text)) return cache.get(text);

    const chunks = splitTextForTranslation(text);
    const translatedChunks = [];

    for (const chunk of chunks) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

      const translated = await translateSingleChunk(chunk, signal);
      if (translated) translatedChunks.push(translated);
    }

    const translated = translatedChunks.join('\n\n').trim();

    if (translated) cache.set(text, translated);
    return translated;
  }

  function positionTooltipNearElement(el) {
    const margin = 12;
    const rect = el.getBoundingClientRect();

    tooltip.style.display = 'block';
    tooltip.style.left = '0px';
    tooltip.style.top = '0px';

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Force CSS constraints to apply before measuring.
    tooltip.style.maxWidth = `${Math.max(260, Math.min(560, vw - margin * 2))}px`;
    tooltip.style.maxHeight = `${Math.max(180, Math.min(620, Math.floor(vh * 0.72)))}px`;

    const tipRect = tooltip.getBoundingClientRect();

    const positions = [
      { left: rect.right + margin, top: rect.top },
      { left: rect.left - tipRect.width - margin, top: rect.top },
      { left: rect.left, top: rect.bottom + margin },
      { left: rect.left, top: rect.top - tipRect.height - margin }
    ];

    let chosen = positions.find(pos =>
      pos.left >= margin &&
      pos.top >= margin &&
      pos.left + tipRect.width <= vw - margin &&
      pos.top + tipRect.height <= vh - margin
    );

    if (!chosen) {
      chosen = {
        left: Math.min(Math.max(margin, rect.right + margin), vw - tipRect.width - margin),
        top: Math.min(Math.max(margin, rect.top), vh - tipRect.height - margin)
      };
    }

    tooltip.style.left = `${Math.round(chosen.left)}px`;
    tooltip.style.top = `${Math.round(chosen.top)}px`;
  }

  function showTooltip(el, translatedText, sourceText = '') {
    if (!isEnabled || !el || !translatedText) {
      hideTooltip(true);
      return;
    }

    isLongTooltipMode = sourceText.length > CONFIG.longTextThreshold;
    tooltip.classList.toggle('is-long', isLongTooltipMode);

    tooltipBody.textContent = translatedText;
    positionTooltipNearElement(el);
  }

  document.addEventListener('mousemove' , (event) => {
    if (!isEnabled) {
      hideTooltip(true);
      return;
    }

    if (isOurTooltip(event.target)) {
      if (isLongTooltipMode) isPointerOverTooltip = true;
      return;
    }

    isPointerOverTooltip = false;
    lastMouseX = event.clientX;
    lastMouseY = event.clientY;

    const { element, text } = getTextUnderCursor(event);

    if (!element || !text) {
      scheduleHideTooltip();
      return;
    }

    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }

    if (text === lastText && element === lastTarget && tooltip.style.display !== 'none') {
      positionTooltipNearElement(element);
      return;
    }

    if (hoverTimer) clearTimeout(hoverTimer);
    if (activeController) {
      activeController.abort();
      activeController = null;
    }

    lastText = text;
    lastTarget = element;

    hoverTimer = setTimeout(async () => {
      try {
        if (!isEnabled) {
          hideTooltip(true);
          return;
        }

        activeController = new AbortController();
        const translated = await translateText(text, activeController.signal);

        if (!isPointerOverTooltip) {
          const current = getTextUnderCursor({ clientX: lastMouseX, clientY: lastMouseY });
          if (!current.element || current.element !== element || current.text !== text) {
            log('Cursor left exact text target, ignoring stale translation');
            scheduleHideTooltip();
            return;
          }
        }

        showTooltip(element, translated, text);
      } catch (error) {
        if (error.name !== 'AbortError') {
          log(error);
          hideTooltip(true);
        }
      } finally {
        activeController = null;
      }
    }, CONFIG.hoverDelayMs);
  }, true);

  document.addEventListener('scroll', (event) => {
    if (isOurTooltip(event.target)) return;
    hideTooltip(true);
  }, true);

  window.addEventListener('blur', () => hideTooltip(true));
  window.addEventListener('resize', () => hideTooltip(true));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') hideTooltip(true);
  }, true);
})();
