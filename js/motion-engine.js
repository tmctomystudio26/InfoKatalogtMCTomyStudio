/**
 * Manifestudio Unified Motion Engine (v106)
 *
 * Orchestrates three complementary libraries with device-friendly graceful degradation:
 *  1. Lenis (lenis.dev)        — Butter-smooth wheel inertia synced to GSAP ticker + ScrollTrigger
 *  2. GSAP + ScrollTrigger     — Word-by-word masked scroll reveals for headings & hero titles
 *  3. Motion (motion.dev)      — Spring-physics card entrances (inView + animate) & tactile hover/press
 *
 * Strictly honors `prefers-reduced-motion: reduce`, native mobile touch scrolling,
 * low-end device budgets (`data-perf="lite"`), and modal/drawer scroll isolation.
 */

import {
  computeStaggerDelay,
  resolveMotionProfile,
  shouldSplitHeadingElement,
  splitHeadlineIntoWords,
} from './motion-helpers.js?v=106';

const WORD_HEADING_SELECTOR = [
  '.section-title',
  '.promo-heading',
  '.donate-heading',
  '.donate-section-title',
  '.admin-title',
  '.admin-section-title',
  '[data-word-reveal]',
].join(', ');

const CARD_GROUP_CONFIGS = [
  { container: '.studio-feat-grid', item: '.studio-app-tile' },
  { container: '.studio-pillars-grid', item: '.studio-pillar-item' },
  { container: '.product-grid', item: '.product-tile' },
  { container: '.faq-list', item: '.faq-item' },
  { container: '.donate-kpi-strip', item: '.donate-kpi-cell' },
  { container: '.donate-podium-grid', item: '.donate-podium-card' },
  { container: '.admin-sync-grid', item: '.admin-sync-item' },
];

const STANDALONE_CARD_SELECTOR = [
  '.utilities-callout-card',
  '.pwa-install-card',
  '.donate-hero-card',
  '.admin-lock-card',
  '.admin-control-card',
].join(', ');

const HOVER_CARD_SELECTOR = [
  '.studio-app-tile',
  '.product-tile',
  '.studio-pillar-item',
  '.donate-podium-card:not(.is-skeleton):not(.is-open-slot)',
  '.utilities-callout-card',
  '.pwa-install-card',
].join(', ');

const LENIS_PREVENT_SELECTOR = [
  '.studio-picker-list',
  '.drawer-body',
  '.modal-dialog',
  '.fcs-messages',
  '.manifestai-messages',
  '.novel-reader-body',
  '.header-nav',
  '.category-tabs',
  'pre',
  'textarea',
].join(', ');

const OVERLAY_LOCK_IDS = [
  'studio-switcher-sheet-root',
  'store-access-modal-root',
  'product-modal-overlay',
  'cart-drawer-root',
];

const state = {
  initialized: false,
  page: 'tools',
  profile: null,
  lenis: null,
  gsapTickerFn: null,
  scrollProgressEl: null,
  overlayObserver: null,
  refreshRaf: 0,
  inViewStops: new Set(),
  hoverCleanups: new WeakMap(),
  wordTriggers: new WeakMap(),
};

function getLibs() {
  const gsap = typeof window !== 'undefined' ? window.gsap || null : null;
  const ScrollTrigger = typeof window !== 'undefined' ? window.ScrollTrigger || null : null;
  const Lenis = typeof window !== 'undefined' ? window.Lenis || null : null;
  const Motion = typeof window !== 'undefined' ? window.Motion || null : null;
  return { gsap, ScrollTrigger, Lenis, Motion };
}

function detectEnvironmentProfile() {
  if (typeof window === 'undefined') {
    return resolveMotionProfile({ prefersReducedMotion: true });
  }
  const prefersReducedMotion = Boolean(
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );
  const isTouch = Boolean(
    window.matchMedia?.('(hover: none), (pointer: coarse)').matches ||
      (navigator.maxTouchPoints > 0 && window.innerWidth < 1024)
  );
  const isLowEnd = document.documentElement?.dataset?.perf === 'lite';
  return resolveMotionProfile({
    prefersReducedMotion,
    isTouch,
    isLowEnd,
    viewportWidth: window.innerWidth || 1280,
  });
}

function isElementVisiblyRendered(el) {
  if (!el || !el.isConnected) return false;
  if (el.hidden) return false;
  if (el.closest?.('[hidden]')) return false;
  const slide = el.closest?.('.banner-slide');
  if (slide && !slide.classList.contains('is-active')) return false;
  const rect = el.getBoundingClientRect?.();
  if (!rect) return false;
  return rect.width > 0 || rect.height > 0;
}

function isElementNearViewport(el, marginRatio = 0.96) {
  const rect = el.getBoundingClientRect?.();
  if (!rect) return false;
  const vh = window.innerHeight || 800;
  return rect.top < vh * marginRatio && rect.bottom > -40;
}

function ensureScrollProgressBar() {
  const header = document.querySelector('.site-header');
  if (!header) return null;
  let bar = header.querySelector('.ms-scroll-progress');
  if (!bar) {
    bar = document.createElement('div');
    bar.className = 'ms-scroll-progress';
    bar.setAttribute('aria-hidden', 'true');
    header.appendChild(bar);
  }
  state.scrollProgressEl = bar;
  return bar;
}

function updateScrollChrome() {
  const scrollY = state.lenis ? state.lenis.scroll : window.scrollY || window.pageYOffset || 0;
  const header = document.querySelector('.site-header');
  if (header) {
    header.classList.toggle('is-scrolled', scrollY > 14);
  }
  const bar = state.scrollProgressEl || ensureScrollProgressBar();
  if (bar) {
    const docEl = document.documentElement;
    const maxScroll = Math.max(0, (docEl.scrollHeight || 0) - (window.innerHeight || 0));
    const ratio = maxScroll > 40 ? Math.min(1, Math.max(0, scrollY / maxScroll)) : 0;
    bar.style.transform = `scaleX(${ratio.toFixed(4)})`;
    bar.style.opacity = ratio > 0.004 ? '1' : '0';
  }
}

function markLenisPreventContainers(root = document) {
  if (!root?.querySelectorAll) return;
  root.querySelectorAll(LENIS_PREVENT_SELECTOR).forEach((el) => {
    if (!el.hasAttribute('data-lenis-prevent')) {
      el.setAttribute('data-lenis-prevent', '');
    }
  });
}

function syncOverlayScrollLock() {
  if (!state.lenis) return;
  const anyOverlayOpen = OVERLAY_LOCK_IDS.some((id) => {
    const el = document.getElementById(id);
    return Boolean(el && !el.hidden);
  });
  if (anyOverlayOpen) {
    state.lenis.stop();
  } else {
    state.lenis.start();
  }
}

function setupOverlayObserver() {
  if (typeof MutationObserver === 'undefined' || state.overlayObserver) return;
  const targets = OVERLAY_LOCK_IDS.map((id) => document.getElementById(id)).filter(Boolean);
  if (targets.length === 0) return;

  state.overlayObserver = new MutationObserver(() => {
    syncOverlayScrollLock();
    markLenisPreventContainers(document);
  });
  targets.forEach((node) => {
    state.overlayObserver.observe(node, { attributes: true, attributeFilter: ['hidden'] });
  });
}

function setupLenisSmoothScroll() {
  const { gsap, ScrollTrigger, Lenis } = getLibs();
  if (!state.profile?.lenis?.enabled || !Lenis) {
    document.documentElement.classList.remove('lenis', 'lenis-smooth');
    return;
  }

  if (state.lenis) return;

  try {
    const lenis = new Lenis({
      duration: state.profile.lenis.duration,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      syncTouch: false,
      wheelMultiplier: state.profile.lenis.wheelMultiplier,
      touchMultiplier: state.profile.lenis.touchMultiplier,
      autoRaf: false,
    });

    state.lenis = lenis;
    document.documentElement.classList.add('lenis', 'lenis-smooth');

    lenis.on('scroll', () => {
      if (ScrollTrigger) ScrollTrigger.update();
      updateScrollChrome();
    });

    if (gsap?.ticker) {
      state.gsapTickerFn = (time) => {
        lenis.raf(time * 1000);
      };
      gsap.ticker.add(state.gsapTickerFn);
      gsap.ticker.lagSmoothing(0);
    } else {
      const rafLoop = (time) => {
        if (!state.lenis) return;
        lenis.raf(time);
        requestAnimationFrame(rafLoop);
      };
      requestAnimationFrame(rafLoop);
    }
  } catch {
    state.lenis = null;
  }
}

function bindSmoothAnchorNavigation() {
  document.addEventListener('click', (e) => {
    const link = e.target?.closest?.('a[href^="#"]');
    if (!link) return;
    const href = link.getAttribute('href') || '';
    if (href.length < 2 || href === '#custom-request') return;
    const target = document.querySelector(href);
    if (!target || target.hidden) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;

    e.preventDefault();
    scrollToTarget(target, { offset: -78 });
  });
}

/* ============================================================================
 * 1. GSAP + ScrollTrigger — Word-by-Word Heading Reveal
 * ============================================================================ */
function splitHeadingDomIntoWords(heading) {
  const hasInteractiveChildren = Boolean(
    heading.querySelector('input, button, select, textarea, a, svg, img')
  );
  const previousSource = heading.dataset.msWordSource || '';
  const currentText = previousSource && heading.querySelector('.ms-word-inner')
    ? heading.textContent || ''
    : heading.textContent || '';

  if (
    !shouldSplitHeadingElement({
      text: currentText,
      previousSource,
      hasComplexChildren: hasInteractiveChildren,
      isHidden: !isElementVisiblyRendered(heading),
    })
  ) {
    return Array.from(heading.querySelectorAll('.ms-word-inner'));
  }

  const normalizedText = String(currentText).replace(/\s+/g, ' ').trim();
  const tokens = splitHeadlineIntoWords(normalizedText);
  if (tokens.length === 0) return [];

  heading.setAttribute('aria-label', normalizedText);
  heading.dataset.msWordSource = normalizedText;
  heading.classList.add('ms-word-heading');

  const frag = document.createDocumentFragment();
  const wordInners = [];

  for (const token of tokens) {
    if (token.type === 'space') {
      frag.appendChild(document.createTextNode(' '));
      continue;
    }
    const mask = document.createElement('span');
    mask.className = 'ms-word-mask';
    mask.setAttribute('aria-hidden', 'true');

    const inner = document.createElement('span');
    inner.className = 'ms-word-inner';
    inner.textContent = token.value;

    mask.appendChild(inner);
    frag.appendChild(mask);
    wordInners.push(inner);
  }

  heading.textContent = '';
  heading.appendChild(frag);
  return wordInners;
}

export function animateHeadingWords(heading, { immediate = false, force = false } = {}) {
  const { gsap, ScrollTrigger } = getLibs();
  if (!heading || !isElementVisiblyRendered(heading)) return;

  const previousTrigger = state.wordTriggers.get(heading);
  const alreadyRevealed = heading.dataset.msWordRevealed === 'true';
  const words = splitHeadingDomIntoWords(heading);
  if (words.length === 0) return;

  if (!state.profile?.gsap?.enabled || !gsap) {
    words.forEach((w) => {
      w.style.opacity = '1';
      w.style.transform = 'none';
    });
    heading.dataset.msWordRevealed = 'true';
    return;
  }

  // If already bound for this exact text and not forced, don't reset visible headings
  if (!force && alreadyRevealed && heading.dataset.msWordBound === heading.dataset.msWordSource) {
    return;
  }

  if (previousTrigger && typeof previousTrigger.kill === 'function') {
    previousTrigger.kill();
    state.wordTriggers.delete(heading);
  }
  gsap.killTweensOf(words);

  heading.dataset.msWordBound = heading.dataset.msWordSource || '';

  const isAboveFold = immediate || isElementNearViewport(heading, 0.92);
  const { wordDuration, wordStagger, yPercent, start } = state.profile.gsap;

  const fromVars = {
    yPercent,
    opacity: 0,
    rotateZ: 1.1,
  };

  const toVars = {
    yPercent: 0,
    opacity: 1,
    rotateZ: 0,
    duration: wordDuration,
    ease: 'power3.out',
    stagger: wordStagger,
    clearProps: 'transform,opacity',
    onComplete: () => {
      heading.dataset.msWordRevealed = 'true';
    },
  };

  if (isAboveFold || !ScrollTrigger) {
    gsap.fromTo(words, fromVars, {
      ...toVars,
      delay: immediate ? 0.04 : 0.08,
    });
    return;
  }

  const tween = gsap.fromTo(words, fromVars, {
    ...toVars,
    scrollTrigger: {
      trigger: heading,
      start,
      once: true,
      fastScrollEnd: true,
      onEnter: () => {
        heading.dataset.msWordRevealed = 'true';
      },
    },
  });

  if (tween?.scrollTrigger) {
    state.wordTriggers.set(heading, tween.scrollTrigger);
  }
}

export function animateBannerHeadline(slideEl) {
  if (!slideEl || !state.profile?.gsap?.enabled) return;
  const heading = slideEl.querySelector('.promo-heading');
  if (!heading) return;
  // Re-trigger clean word-by-word reveal for newly active slide
  animateHeadingWords(heading, { immediate: true, force: true });
}

function scanWordHeadings(root = document) {
  if (!root?.querySelectorAll) return;
  const nodes = [];
  if (root instanceof Element && root.matches?.(WORD_HEADING_SELECTOR)) {
    nodes.push(root);
  }
  root.querySelectorAll(WORD_HEADING_SELECTOR).forEach((el) => nodes.push(el));
  nodes.forEach((heading) => {
    if (!isElementVisiblyRendered(heading)) return;
    const isHero = Boolean(heading.closest('.promo-banner-section, .studio-tool-head'));
    animateHeadingWords(heading, { immediate: isHero });
  });
}

/* ============================================================================
 * 2. Motion (motion.dev) — Card Entrances & Spring Hover/Press Micro-Physics
 * ============================================================================ */
function animateCardListWithMotion(cards, { immediate = false } = {}) {
  const { Motion } = getLibs();
  const visibleCards = cards.filter((c) => isElementVisiblyRendered(c));
  if (visibleCards.length === 0) return;

  if (!state.profile?.motion?.enabled || !Motion?.animate) {
    visibleCards.forEach((c) => {
      c.style.opacity = '1';
      c.style.transform = 'none';
      c.dataset.motionEntered = 'true';
    });
    return;
  }

  const { cardDuration, cardStagger, maxStaggerDelay } = state.profile.motion;

  visibleCards.forEach((card, idx) => {
    const delay = computeStaggerDelay(idx, {
      step: cardStagger,
      maxDelay: maxStaggerDelay,
    });
    card.dataset.motionEntered = 'true';
    Motion.animate(
      card,
      {
        opacity: [0, 1],
        y: [immediate ? 16 : 24, 0],
        scale: [0.968, 1],
      },
      {
        duration: cardDuration,
        delay,
        easing: [0.22, 1, 0.36, 1],
      }
    );
  });
}

function bindCardGroupEntrances(root = document, { immediateCards = false } = {}) {
  const { Motion } = getLibs();
  if (!root?.querySelectorAll) return;

  const profile = state.profile?.motion;

  for (const cfg of CARD_GROUP_CONFIGS) {
    const containers = [];
    if (root instanceof Element && root.matches?.(cfg.container)) {
      containers.push(root);
    }
    root.querySelectorAll(cfg.container).forEach((c) => containers.push(c));

    for (const container of containers) {
      if (!isElementVisiblyRendered(container)) continue;
      const cards = Array.from(container.querySelectorAll(cfg.item)).filter(
        (el) => el.dataset.motionEntered !== 'true'
      );
      if (cards.length === 0) continue;

      if (!profile?.enabled || !Motion?.animate) {
        cards.forEach((c) => {
          c.style.opacity = '1';
          c.style.transform = 'none';
          c.dataset.motionEntered = 'true';
        });
        continue;
      }

      if (immediateCards || isElementNearViewport(container, 0.96) || !Motion.inView) {
        animateCardListWithMotion(cards, { immediate: immediateCards });
        continue;
      }

      // Prepare unobtrusive initial state right before Motion inView triggers
      cards.forEach((c) => {
        c.style.opacity = '0';
        c.style.transform = 'translateY(22px) scale(0.97)';
      });

      const stop = Motion.inView(
        container,
        () => {
          const pending = cards.filter((c) => c.isConnected && c.dataset.motionEntered !== 'true');
          animateCardListWithMotion(pending, { immediate: false });
        },
        { amount: 0.08, margin: '0px 0px -24px 0px' }
      );

      if (typeof stop === 'function') {
        state.inViewStops.add(stop);
      }
    }
  }

  // Standalone highlight cards (Utilities Callout, PWA Install Card, Donate Hero, Admin Lock)
  const standalones = [];
  if (root instanceof Element && root.matches?.(STANDALONE_CARD_SELECTOR)) {
    standalones.push(root);
  }
  root.querySelectorAll(STANDALONE_CARD_SELECTOR).forEach((el) => standalones.push(el));

  standalones.forEach((card) => {
    if (!isElementVisiblyRendered(card) || card.dataset.motionEntered === 'true') return;
    if (!profile?.enabled || !Motion?.animate) {
      card.dataset.motionEntered = 'true';
      return;
    }

    if (immediateCards || isElementNearViewport(card, 0.95) || !Motion.inView) {
      animateCardListWithMotion([card], { immediate: immediateCards });
      return;
    }

    card.style.opacity = '0';
    card.style.transform = 'translateY(20px) scale(0.98)';

    const stop = Motion.inView(
      card,
      () => {
        if (card.isConnected && card.dataset.motionEntered !== 'true') {
          animateCardListWithMotion([card], { immediate: false });
        }
      },
      { amount: 0.12 }
    );
    if (typeof stop === 'function') {
      state.inViewStops.add(stop);
    }
  });
}

function bindCardHoverPhysics(root = document) {
  const { Motion } = getLibs();
  if (!state.profile?.motion?.enableHoverSpring || !Motion?.hover || !Motion?.animate) {
    return;
  }
  if (!root?.querySelectorAll) return;

  const { hoverLiftY, hoverScale, pressScale, springStiffness, springDamping } = state.profile.motion;
  const springTransition = Motion.spring
    ? { type: 'spring', stiffness: springStiffness, damping: springDamping, mass: 0.72 }
    : { duration: 0.24, easing: [0.22, 1, 0.36, 1] };

  const cards = [];
  if (root instanceof Element && root.matches?.(HOVER_CARD_SELECTOR)) {
    cards.push(root);
  }
  root.querySelectorAll(HOVER_CARD_SELECTOR).forEach((el) => cards.push(el));

  cards.forEach((card) => {
    if (card.dataset.motionHoverBound === 'true') return;
    card.dataset.motionHoverBound = 'true';

    const iconTarget = card.querySelector(
      '.studio-app-icon-wrap, .tile-stage img, .utilities-callout-icon, .donate-avatar, .studio-pillar-num'
    );

    const stopHover = Motion.hover(card, () => {
      Motion.animate(
        card,
        { y: hoverLiftY, scale: hoverScale },
        springTransition
      );
      if (iconTarget) {
        Motion.animate(
          iconTarget,
          { scale: 1.08, y: -2 },
          springTransition
        );
      }

      return () => {
        Motion.animate(card, { y: 0, scale: 1 }, springTransition);
        if (iconTarget) {
          Motion.animate(iconTarget, { scale: 1, y: 0 }, springTransition);
        }
      };
    });

    let stopPress = null;
    if (typeof Motion.press === 'function') {
      stopPress = Motion.press(card, () => {
        Motion.animate(
          card,
          { scale: pressScale, y: -1 },
          { duration: 0.12, easing: [0.22, 1, 0.36, 1] }
        );
        return () => {
          Motion.animate(card, { scale: 1, y: 0 }, springTransition);
        };
      });
    }

    state.hoverCleanups.set(card, () => {
      if (typeof stopHover === 'function') stopHover();
      if (typeof stopPress === 'function') stopPress();
    });
  });
}

/* ============================================================================
 * Public Lifecycle API
 * ============================================================================ */
export function scrollToTarget(target, { offset = -78, immediate = false } = {}) {
  if (typeof window === 'undefined') return;
  const el =
    typeof target === 'string'
      ? target === 'top' || target === '#top'
        ? 0
        : document.querySelector(target.startsWith('#') ? target : `#${target}`)
      : target;

  if (state.lenis && !state.profile?.reduced) {
    if (el === 0 || el === null || el === undefined) {
      state.lenis.scrollTo(0, { immediate });
    } else {
      state.lenis.scrollTo(el, { offset, immediate });
    }
    return;
  }

  if (el === 0 || el === null || el === undefined) {
    window.scrollTo({ top: 0, behavior: immediate || state.profile?.reduced ? 'auto' : 'smooth' });
  } else if (typeof el.scrollIntoView === 'function') {
    el.scrollIntoView({
      behavior: immediate || state.profile?.reduced ? 'auto' : 'smooth',
      block: 'start',
    });
  }
}

export function pauseSmoothScroll() {
  state.lenis?.stop?.();
}

export function resumeSmoothScroll() {
  state.lenis?.start?.();
}

export function refreshMotionEngine(root = document, { immediateCards = false } = {}) {
  if (typeof window === 'undefined') return;
  if (!state.initialized) {
    initMotionEngine({ page: state.page });
  }

  const targetRoot = root || document;
  markLenisPreventContainers(targetRoot);
  scanWordHeadings(targetRoot);
  bindCardGroupEntrances(targetRoot, { immediateCards });
  bindCardHoverPhysics(targetRoot);

  const { ScrollTrigger } = getLibs();
  if (ScrollTrigger && typeof ScrollTrigger.refresh === 'function') {
    cancelAnimationFrame(state.refreshRaf);
    state.refreshRaf = requestAnimationFrame(() => {
      ScrollTrigger.refresh();
      updateScrollChrome();
    });
  } else {
    updateScrollChrome();
  }
}

export function getMotionState() {
  const { gsap, ScrollTrigger, Lenis, Motion } = getLibs();
  return {
    initialized: state.initialized,
    page: state.page,
    profile: state.profile,
    lenisActive: Boolean(state.lenis),
    libs: {
      gsap: Boolean(gsap),
      scrollTrigger: Boolean(ScrollTrigger),
      lenis: Boolean(Lenis),
      motion: Boolean(Motion),
    },
  };
}

export function initMotionEngine({ page = 'tools' } = {}) {
  if (typeof window === 'undefined') return getMotionState();
  state.page = page;

  if (state.initialized) {
    refreshMotionEngine(document);
    return getMotionState();
  }

  state.initialized = true;
  state.profile = detectEnvironmentProfile();

  const { gsap, ScrollTrigger } = getLibs();
  if (gsap && ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);
  }

  document.documentElement.dataset.motionReady = 'true';
  ensureScrollProgressBar();
  setupLenisSmoothScroll();
  markLenisPreventContainers(document);
  setupOverlayObserver();
  bindSmoothAnchorNavigation();

  window.addEventListener('scroll', updateScrollChrome, { passive: true });
  window.addEventListener(
    'resize',
    () => {
      const { ScrollTrigger: ST } = getLibs();
      if (ST) ST.refresh();
      updateScrollChrome();
    },
    { passive: true }
  );

  // Initial scan on next frame so initial layout metrics are settled
  requestAnimationFrame(() => {
    refreshMotionEngine(document);
    updateScrollChrome();
  });

  window.__MANIFESTUDIO_MOTION__ = {
    getState: getMotionState,
    refresh: refreshMotionEngine,
    scrollToTarget,
  };

  return getMotionState();
}
