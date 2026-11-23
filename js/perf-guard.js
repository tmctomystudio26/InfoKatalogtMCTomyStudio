/**
 * Manifestudio Adaptive Performance Guard (v76).
 * Pure helpers + lightweight runtime class detection so low-spec mobile devices
 * ("HP kentang") get smooth 60fps UI, zero wrap-around freezes, and fast first paint
 * without removing features or degrading visual craft.
 */

export function detectLowEndDevice(env = {}) {
  const nav =
    env && typeof env === 'object' && Object.keys(env).length > 0
      ? env
      : typeof navigator !== 'undefined'
        ? {
            hardwareConcurrency: navigator.hardwareConcurrency,
            deviceMemory: navigator.deviceMemory,
            saveData: navigator.connection?.saveData,
            effectiveType: navigator.connection?.effectiveType,
            userAgent: navigator.userAgent,
            maxTouchPoints: navigator.maxTouchPoints,
          }
        : {};

  const cores = Number(nav.hardwareConcurrency);
  const ramGb = Number(nav.deviceMemory);
  const saveData = Boolean(nav.saveData);
  const netType = String(nav.effectiveType || '').toLowerCase();
  const ua = String(nav.userAgent || '').toLowerCase();
  const isMobileUa = /android|iphone|ipad|ipod|mobile|xiaomi|redmi|oppo|vivo|realme|infinix|tecno|itel|samsung/i.test(ua);
  const isTouch = Number(nav.maxTouchPoints || 0) > 0;

  const prefersReducedMotion =
    typeof env.prefersReducedMotion === 'boolean'
      ? env.prefersReducedMotion
      : typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
        : false;

  if (prefersReducedMotion || saveData) return true;
  if (netType === 'slow-2g' || netType === '2g') return true;
  if (Number.isFinite(ramGb) && ramGb > 0 && ramGb <= 4) return true;
  if (Number.isFinite(cores) && cores > 0 && cores <= 4 && (isMobileUa || isTouch)) return true;
  if (isMobileUa && (!Number.isFinite(ramGb) || ramGb <= 6)) return true;
  return false;
}

/**
 * Returns the small set of slide indices whose banner images should be actively
 * hydrated in GPU memory (active slide + immediate prev/next neighbors).
 */
export function computeBannerHydrationWindow(activeIndex = 0, totalSlides = 1, radius = 1) {
  const total = Math.max(0, Math.floor(Number(totalSlides) || 0));
  if (total === 0) return [];
  const safeIdx = ((Math.floor(Number(activeIndex) || 0) % total) + total) % total;
  const safeRadius = Math.max(0, Math.min(2, Math.floor(Number(radius) || 1)));
  const set = new Set([safeIdx]);
  for (let d = 1; d <= safeRadius; d += 1) {
    set.add((safeIdx + d) % total);
    set.add((safeIdx - d + total) % total);
  }
  return Array.from(set);
}

/**
 * Resolves banner transition target & constant-distance 1-step direction.
 * Wrapping 15 -> 0 moves forward (+1), wrapping 0 -> 15 moves backward (-1),
 * never traversing all intermediate slides across GPU compositor tiles.
 */
export function resolveBannerTransition(prevIndex = 0, targetIndex = 0, totalSlides = 1) {
  const total = Math.max(1, Math.floor(Number(totalSlides) || 1));
  const from = ((Math.floor(Number(prevIndex) || 0) % total) + total) % total;
  const rawTarget = Math.floor(Number(targetIndex) || 0);
  const to = ((rawTarget % total) + total) % total;

  if (from === to) {
    return { from, to, direction: 0, isWrap: false };
  }

  let direction = rawTarget > from ? 1 : -1;
  let isWrap = false;
  if (rawTarget >= total || (from === total - 1 && to === 0 && rawTarget !== 0)) {
    direction = 1;
    isWrap = true;
  } else if (rawTarget < 0 || (from === 0 && to === total - 1 && rawTarget !== total - 1)) {
    direction = -1;
    isWrap = true;
  } else if (from === total - 1 && to === 0) {
    direction = 1;
    isWrap = true;
  } else if (from === 0 && to === total - 1) {
    direction = -1;
    isWrap = true;
  }

  return { from, to, direction, isWrap };
}

/**
 * Computes progressive render batch count for large media grids (Dracin, Novel)
 * so low-end phones never mount 150+ image cards in a single main-thread frame.
 */
export function computeProgressiveRenderLimit(totalItems = 0, currentLimit = 0, { isLowEnd = false, pageSize = null } = {}) {
  const total = Math.max(0, Math.floor(Number(totalItems) || 0));
  const step = Math.max(8, Number(pageSize) || (isLowEnd ? 18 : 24));
  const baseline = Math.max(step, Math.floor(Number(currentLimit) || 0));
  const visible = Math.min(total, baseline);
  return {
    visible,
    remaining: Math.max(0, total - visible),
    hasMore: visible < total,
    nextLimit: Math.min(total, visible + step),
    step,
  };
}

/**
 * Prevents background auto-click-play music from firing simultaneously during
 * banner navigation, media/video/drama controls, or audio-intensive tabs.
 */
export function shouldAllowAutoMusicTrigger({
  isBannerControl = false,
  isMediaElement = false,
  isVideoOrAudioTool = false,
  activeToolTab = '',
} = {}) {
  if (isBannerControl || isMediaElement || isVideoOrAudioTool) return false;
  const tab = String(activeToolTab || '').toLowerCase();
  if (tab === 'dracin' || tab === 'audioeditor' || tab === 'songfinder' || tab === 'downloader') {
    return false;
  }
  return true;
}

/**
 * Dual simultaneous HTML5 <video> + HLS.js decoding starves MediaCodec slots on
 * mobile / low-end Android phones and causes system-wide freezes.
 * Keep metadata-only prefetch everywhere; enable dual active video decoding only on desktop high-spec.
 */
export function shouldEnableDualVideoPreload({ isLowEnd = false, isMobile = false } = {}) {
  return !isLowEnd && !isMobile;
}

/**
 * Android Chrome / WebView mobile GPUs frequently deadlock or freeze the SurfaceFlinger
 * compositor when calling Element.requestFullscreen() on a complex <div> wrapping an actively
 * playing hardware-decoded <video> + floating HUD overlays (recovering only on OS Back press).
 * On mobile/touch or low-end devices, use zero-freeze fixed-viewport Cinema Fullscreen +
 * History popstate Back-button integration; reserve native DOM Fullscreen API for desktop.
 */
export function shouldUseNativeDomFullscreen(env = {}) {
  const nav =
    env && typeof env === 'object' && Object.keys(env).length > 0
      ? env
      : typeof navigator !== 'undefined'
        ? {
            hardwareConcurrency: navigator.hardwareConcurrency,
            deviceMemory: navigator.deviceMemory,
            saveData: navigator.connection?.saveData,
            effectiveType: navigator.connection?.effectiveType,
            userAgent: navigator.userAgent,
            maxTouchPoints: navigator.maxTouchPoints,
            innerWidth: typeof window !== 'undefined' ? window.innerWidth : undefined,
          }
        : {};

  const ua = String(nav.userAgent || '').toLowerCase();
  const isMobileUa =
    /android|iphone|ipad|ipod|mobile|xiaomi|redmi|oppo|vivo|realme|infinix|tecno|itel|samsung|wv\b/i.test(ua);
  const isTouch = Number(nav.maxTouchPoints || 0) > 0;
  const innerWidth = Number(nav.innerWidth);
  const isNarrowTouch = isTouch && Number.isFinite(innerWidth) && innerWidth > 0 && innerWidth <= 1024;

  if (isMobileUa || isNarrowTouch) return false;
  if (detectLowEndDevice(nav)) return false;
  return true;
}

export function initPerformanceClass() {
  if (typeof document === 'undefined') return 'standard';
  const lowEnd = detectLowEndDevice();
  const mode = lowEnd ? 'lite' : 'standard';
  document.documentElement.dataset.perf = mode;
  return mode;
}

export function scheduleIdleTask(fn, timeoutMs = 1800) {
  if (typeof fn !== 'function') return () => {};
  if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(() => fn(), { timeout: timeoutMs });
    return () => window.cancelIdleCallback?.(id);
  }
  const timer = setTimeout(() => fn(), Math.min(900, Math.max(120, Math.floor(timeoutMs / 2))));
  return () => clearTimeout(timer);
}
