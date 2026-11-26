/**
 * Pure helper functions for Manifestudio's GSAP + Motion + Lenis engine.
 * Kept DOM-free so every edge case is verified deterministically via node:test.
 */

/**
 * Splits a heading string into alternating word and single-space tokens.
 * Preserves punctuation attached to words so line-wrapping stays natural.
 *
 * @param {string} rawText
 * @returns {Array<{ type: 'word' | 'space', value: string }>}
 */
export function splitHeadlineIntoWords(rawText) {
  const normalized = String(rawText ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return [];

  const words = normalized.split(' ');
  const tokens = [];
  for (let i = 0; i < words.length; i += 1) {
    tokens.push({ type: 'word', value: words[i] });
    if (i < words.length - 1) {
      tokens.push({ type: 'space', value: ' ' });
    }
  }
  return tokens;
}

/**
 * Resolves device-friendly motion parameters for Lenis, GSAP ScrollTrigger,
 * and Motion.dev spring physics across desktop, mobile touch, low-end phones,
 * and prefers-reduced-motion environments.
 *
 * @param {object} [env]
 * @param {boolean} [env.prefersReducedMotion=false]
 * @param {boolean} [env.isTouch=false]
 * @param {boolean} [env.isLowEnd=false]
 * @param {number} [env.viewportWidth=1280]
 */
export function resolveMotionProfile({
  prefersReducedMotion = false,
  isTouch = false,
  isLowEnd = false,
  viewportWidth = 1280,
} = {}) {
  const safeWidth = Number.isFinite(Number(viewportWidth)) ? Number(viewportWidth) : 1280;
  const isCompactViewport = safeWidth < 768;

  if (prefersReducedMotion) {
    return {
      reduced: true,
      lenis: {
        enabled: false,
        duration: 0,
        smoothWheel: false,
        syncTouch: false,
        wheelMultiplier: 1,
        touchMultiplier: 1,
      },
      gsap: {
        enabled: false,
        wordDuration: 0,
        wordStagger: 0,
        yPercent: 0,
        start: 'top 95%',
      },
      motion: {
        enabled: false,
        cardDuration: 0,
        cardStagger: 0,
        maxStaggerDelay: 0,
        enableHoverSpring: false,
        hoverLiftY: 0,
        hoverScale: 1,
        pressScale: 1,
        springStiffness: 400,
        springDamping: 30,
      },
    };
  }

  // Enable Lenis smooth wheel inertia on non-touch or large viewports;
  // keep native OS momentum on mobile touch so phones never feel sluggish or sticky.
  const enableLenis = !isTouch && !isLowEnd;

  return {
    reduced: false,
    lenis: {
      enabled: enableLenis,
      duration: isLowEnd ? 0.85 : 1.08,
      smoothWheel: enableLenis,
      syncTouch: false,
      wheelMultiplier: 0.96,
      touchMultiplier: 1.4,
    },
    gsap: {
      enabled: true,
      wordDuration: isLowEnd ? 0.45 : isCompactViewport ? 0.56 : 0.68,
      wordStagger: isLowEnd ? 0.025 : isCompactViewport ? 0.032 : 0.044,
      yPercent: isLowEnd ? 65 : 108,
      start: isCompactViewport ? 'top 94%' : 'top 89%',
    },
    motion: {
      enabled: true,
      cardDuration: isLowEnd ? 0.34 : 0.52,
      cardStagger: isLowEnd ? 0.022 : isCompactViewport ? 0.03 : 0.042,
      maxStaggerDelay: isLowEnd ? 0.2 : 0.46,
      enableHoverSpring: !isTouch && !isLowEnd,
      hoverLiftY: -5,
      hoverScale: 1.018,
      pressScale: 0.974,
      springStiffness: 430,
      springDamping: 28,
    },
  };
}

/**
 * Computes a capped stagger delay in seconds so large grids (e.g. 17–20 cards)
 * feel crisp and responsive instead of keeping trailing cards invisible.
 *
 * @param {number} index
 * @param {object} [opts]
 * @param {number} [opts.step=0.04]
 * @param {number} [opts.maxDelay=0.45]
 * @returns {number}
 */
export function computeStaggerDelay(index, { step = 0.04, maxDelay = 0.45 } = {}) {
  const safeIdx = Math.max(0, Math.floor(Number(index) || 0));
  const safeStep = Math.max(0, Number(step) || 0);
  const safeMax = Math.max(0, Number(maxDelay) || 0);
  if (safeStep === 0 || safeMax === 0) return 0;
  return Number(Math.min(safeIdx * safeStep, safeMax).toFixed(4));
}

/**
 * Determines whether a heading element should be freshly split into word spans.
 * Prevents redundant DOM churn while still allowing dynamic titles (e.g. tool switching)
 * to re-split cleanly whenever their text changes.
 *
 * @param {object} meta
 * @param {string} meta.text
 * @param {string} [meta.previousSource='']
 * @param {boolean} [meta.hasComplexChildren=false]
 * @param {boolean} [meta.isHidden=false]
 * @returns {boolean}
 */
export function shouldSplitHeadingElement({
  text = '',
  previousSource = '',
  hasComplexChildren = false,
  isHidden = false,
} = {}) {
  if (isHidden || hasComplexChildren) return false;
  const normalized = String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return false;
  return normalized !== String(previousSource ?? '').trim();
}
