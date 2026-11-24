/**
 * Dual-Domain Router, Branding & Store Access Gate Module (v80)
 *
 * Powers 1 GitHub Repository + Cloudflare Pages across two distinct domains:
 *  - https://manifestudio.my.id  -> Hub Utilitas (15 Fitur Gratis)
 *  - https://manifestore.my.id   -> Manifestore (Katalog Akun Premium & Layanan Digital)
 *
 * Access Policy:
 *  - Direct visits to manifestore.my.id -> Full open Store access (no key required) + free jump to Manifestudio.
 *  - Visits on manifestudio.my.id       -> Hub Utilitas only; clicking Store triggers the customizable Access Key Gate.
 *  - Localhost / *.pages.dev preview    -> Supports ?site=store and ?site=utilities for instant testing.
 */

export const DOMAIN_CONFIG = Object.freeze({
  utilitiesDomain: 'manifestudio.my.id',
  utilitiesOrigin: 'https://manifestudio.my.id',
  storeDomain: 'manifestore.my.id',
  storeOrigin: 'https://manifestore.my.id',
  storeBrandName: 'Manifestore',
  utilitiesBrandName: 'Manifestudio',
  storeManifestPath: './manifest-store.webmanifest',
  utilitiesManifestPath: './manifest-utilities.webmanifest',
  defaultStoreAccessKey: 'MFSTORE26',
  storeGateSessionKey: 'manifestudio_store_gate_unlocked_v1',
});

const STORE_HOSTS = new Set([
  'manifestore.my.id',
  'www.manifestore.my.id',
  'store.manifestudio.my.id',
  'toko.manifestudio.my.id',
]);

const UTILITIES_HOSTS = new Set([
  'manifestudio.my.id',
  'www.manifestudio.my.id',
  'tools.manifestudio.my.id',
  'utilitas.manifestudio.my.id',
]);

const KEY_MASK_PREFIX = 'mskey:v1:';
const KEY_MASK_SALT = 'MF_T0MY_2026_GATE';

/**
 * Lightweight reversible obfuscation so the access key is not casually readable
 * as plaintext in JSON while remaining freely editable in the Admin Panel.
 * @param {string} plainKey
 * @returns {string}
 */
export function encodeStoreAccessKey(plainKey = '') {
  const clean = String(plainKey || '').trim();
  if (!clean) return '';
  let hex = '';
  for (let i = 0; i < clean.length; i += 1) {
    const xored = clean.charCodeAt(i) ^ KEY_MASK_SALT.charCodeAt(i % KEY_MASK_SALT.length);
    hex += xored.toString(16).padStart(2, '0');
  }
  return `${KEY_MASK_PREFIX}${hex}`;
}

/**
 * Decode an obfuscated access key back to plain text (also accepts plain text transparently).
 * @param {string} raw
 * @returns {string}
 */
export function decodeStoreAccessKey(raw = '') {
  const str = String(raw || '').trim();
  if (!str) return '';
  if (!str.startsWith(KEY_MASK_PREFIX)) {
    return str;
  }
  const hex = str.slice(KEY_MASK_PREFIX.length);
  if (!hex || hex.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(hex)) {
    return '';
  }
  let out = '';
  for (let i = 0; i < hex.length; i += 2) {
    const byte = parseInt(hex.slice(i, i + 2), 16);
    const saltCode = KEY_MASK_SALT.charCodeAt((i / 2) % KEY_MASK_SALT.length);
    out += String.fromCharCode(byte ^ saltCode);
  }
  return out.trim();
}

/**
 * Normalize origin URL safely (defaults to fallbackOrigin).
 * @param {string} rawUrl
 * @param {string} fallbackOrigin
 */
export function normalizeOriginUrl(rawUrl, fallbackOrigin) {
  const clean = String(rawUrl || '').trim();
  if (!clean) return fallbackOrigin;
  try {
    const parsed = new URL(/^https?:\/\//i.test(clean) ? clean : `https://${clean}`);
    return parsed.origin;
  } catch {
    return fallbackOrigin;
  }
}

/**
 * Normalize Store Access Gate & Dual-Domain config from catalog.brand.storeAccess.
 * @param {object} raw
 */
export function normalizeStoreAccessConfig(raw = {}) {
  const safe = raw && typeof raw === 'object' ? raw : {};
  const decodedFromEncoded = decodeStoreAccessKey(safe.accessKeyEncoded || '');
  const plainCandidate = String(safe.accessKey || '').trim();
  const effectiveKey =
    plainCandidate || decodedFromEncoded || DOMAIN_CONFIG.defaultStoreAccessKey;

  const storeOrigin = normalizeOriginUrl(safe.storeOrigin, DOMAIN_CONFIG.storeOrigin);
  const utilitiesOrigin = normalizeOriginUrl(safe.utilitiesOrigin, DOMAIN_CONFIG.utilitiesOrigin);

  return {
    enabled: safe.enabled !== false,
    accessKeyEncoded: encodeStoreAccessKey(effectiveKey),
    accessKeyPreviewLength: effectiveKey.length,
    promptTitle:
      String(safe.promptTitle || 'Akses Khusus Manifestore').trim() || 'Akses Khusus Manifestore',
    promptDescription:
      String(
        safe.promptDescription ||
          'Masukkan kunci akses khusus dari Admin untuk berpindah dari Manifestudio ke halaman Store.'
      ).trim(),
    storeOrigin,
    utilitiesOrigin,
    storeBrandName:
      String(safe.storeBrandName || DOMAIN_CONFIG.storeBrandName).trim() ||
      DOMAIN_CONFIG.storeBrandName,
    utilitiesBrandName:
      String(safe.utilitiesBrandName || DOMAIN_CONFIG.utilitiesBrandName).trim() ||
      DOMAIN_CONFIG.utilitiesBrandName,
  };
}

/**
 * Extract plain editable access key for the authenticated Admin Panel.
 * @param {object} raw
 * @returns {string}
 */
export function getEditableStoreAccessKey(raw = {}) {
  const safe = raw && typeof raw === 'object' ? raw : {};
  const plain = String(safe.accessKey || '').trim();
  if (plain) return plain;
  const decoded = decodeStoreAccessKey(safe.accessKeyEncoded || '');
  return decoded || DOMAIN_CONFIG.defaultStoreAccessKey;
}

/**
 * Verify a user-entered store access key against the configured storeAccess object.
 * Case-insensitive & whitespace-trimmed comparison for smooth mobile typing.
 * @param {string} enteredKey
 * @param {object} storeAccessRaw
 * @returns {{ ok: boolean, reason: string }}
 */
export function verifyStoreAccessKey(enteredKey, storeAccessRaw = {}) {
  const cfg = normalizeStoreAccessConfig(storeAccessRaw);
  if (!cfg.enabled) {
    return { ok: true, reason: 'gate_disabled' };
  }
  const expected = decodeStoreAccessKey(cfg.accessKeyEncoded).trim().toLowerCase();
  const actual = String(enteredKey || '').trim().toLowerCase();
  if (!actual) {
    return { ok: false, reason: 'empty' };
  }
  if (!expected) {
    return { ok: false, reason: 'unconfigured' };
  }
  // Constant-length XOR check
  if (actual.length !== expected.length) {
    return { ok: false, reason: 'mismatch' };
  }
  let diff = 0;
  for (let i = 0; i < actual.length; i += 1) {
    diff |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0 ? { ok: true, reason: 'matched' } : { ok: false, reason: 'mismatch' };
}

/**
 * Generate a clean, human-readable random access key for Admin Panel "Acak Kunci" button.
 * @returns {string}
 */
export function generateRandomStoreAccessKey() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 6; i += 1) {
    suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `MF-${suffix}`;
}

/**
 * Normalize hostname string safely.
 * @param {string} hostname
 * @returns {string}
 */
export function normalizeHostname(hostname = '') {
  return String(hostname || '')
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, '');
}

/**
 * Resolve current site mode ('store' | 'utilities') and whether dual-domain split is active.
 * @param {{ hostname?: string, pathname?: string, search?: string, isToolsPage?: boolean, storeAccess?: object }} input
 */
export function resolveSiteContext(input = {}) {
  const accessCfg = normalizeStoreAccessConfig(input.storeAccess || {});
  const host = normalizeHostname(
    input.hostname !== undefined
      ? input.hostname
      : typeof window !== 'undefined'
        ? window.location.hostname
        : ''
  );
  const pathname = String(
    input.pathname !== undefined
      ? input.pathname
      : typeof window !== 'undefined'
        ? window.location.pathname
        : '/'
  ).toLowerCase();
  const search = String(
    input.search !== undefined
      ? input.search
      : typeof window !== 'undefined'
        ? window.location.search
        : ''
  );
  const isToolsPage =
    typeof input.isToolsPage === 'boolean'
      ? input.isToolsPage
      : pathname.endsWith('/tools.html') || pathname === '/tools' || pathname.endsWith('/tools');

  const params = new URLSearchParams(search);
  const siteOverride = (params.get('site') || params.get('mode') || '').trim().toLowerCase();

  let storeHostFromCfg = '';
  let utilHostFromCfg = '';
  try {
    storeHostFromCfg = normalizeHostname(new URL(accessCfg.storeOrigin).hostname);
    utilHostFromCfg = normalizeHostname(new URL(accessCfg.utilitiesOrigin).hostname);
  } catch {
    // Ignore
  }

  const isStoreProdHost =
    STORE_HOSTS.has(host) || (Boolean(storeHostFromCfg) && host === storeHostFromCfg);
  const isUtilProdHost =
    UTILITIES_HOSTS.has(host) || (Boolean(utilHostFromCfg) && host === utilHostFromCfg);
  const isProductionDomain = isStoreProdHost || isUtilProdHost;

  if (siteOverride === 'store' || siteOverride === 'toko' || siteOverride === 'katalog') {
    return {
      mode: 'store',
      isSplitDomain: true,
      isProductionDomain,
      source: 'query',
      host,
      siteQueryParam: 'store',
      brandName: accessCfg.storeBrandName,
      manifestHref: DOMAIN_CONFIG.storeManifestPath,
      storeOrigin: accessCfg.storeOrigin,
      utilitiesOrigin: accessCfg.utilitiesOrigin,
      requiresStoreGate: false,
    };
  }

  if (siteOverride === 'utilities' || siteOverride === 'utilitas' || siteOverride === 'tools') {
    return {
      mode: 'utilities',
      isSplitDomain: true,
      isProductionDomain,
      source: 'query',
      host,
      siteQueryParam: 'utilities',
      brandName: accessCfg.utilitiesBrandName,
      manifestHref: DOMAIN_CONFIG.utilitiesManifestPath,
      storeOrigin: accessCfg.storeOrigin,
      utilitiesOrigin: accessCfg.utilitiesOrigin,
      requiresStoreGate: accessCfg.enabled !== false,
    };
  }

  if (isStoreProdHost) {
    return {
      mode: 'store',
      isSplitDomain: true,
      isProductionDomain: true,
      source: 'hostname',
      host,
      siteQueryParam: '',
      brandName: accessCfg.storeBrandName,
      manifestHref: DOMAIN_CONFIG.storeManifestPath,
      storeOrigin: accessCfg.storeOrigin,
      utilitiesOrigin: accessCfg.utilitiesOrigin,
      requiresStoreGate: false,
    };
  }

  if (isUtilProdHost) {
    return {
      mode: 'utilities',
      isSplitDomain: true,
      isProductionDomain: true,
      source: 'hostname',
      host,
      siteQueryParam: '',
      brandName: accessCfg.utilitiesBrandName,
      manifestHref: DOMAIN_CONFIG.utilitiesManifestPath,
      storeOrigin: accessCfg.storeOrigin,
      utilitiesOrigin: accessCfg.utilitiesOrigin,
      requiresStoreGate: accessCfg.enabled !== false,
    };
  }

  // Localhost / *.pages.dev preview without ?site= -> unified dev mode
  return {
    mode: isToolsPage ? 'utilities' : 'store',
    isSplitDomain: false,
    isProductionDomain: false,
    source: 'default',
    host,
    siteQueryParam: '',
    brandName: isToolsPage ? accessCfg.utilitiesBrandName : DOMAIN_CONFIG.utilitiesBrandName,
    manifestHref: isToolsPage
      ? DOMAIN_CONFIG.utilitiesManifestPath
      : DOMAIN_CONFIG.storeManifestPath,
    storeOrigin: accessCfg.storeOrigin,
    utilitiesOrigin: accessCfg.utilitiesOrigin,
    requiresStoreGate: false,
  };
}

/**
 * Build a URL to the Storefront (manifestore.my.id on production or ?site=store on preview).
 * @param {ReturnType<typeof resolveSiteContext>} ctx
 * @param {{ hash?: string, path?: string }} [opts]
 */
export function buildStoreUrl(ctx, opts = {}) {
  const hash = opts.hash ? (opts.hash.startsWith('#') ? opts.hash : `#${opts.hash}`) : '';
  const path = opts.path || '';
  if (ctx?.isSplitDomain) {
    if (ctx.isProductionDomain) {
      const origin = ctx.storeOrigin || DOMAIN_CONFIG.storeOrigin;
      const cleanPath = path ? `/${path.replace(/^\/+/, '')}` : '/';
      return `${origin}${cleanPath}${hash}`;
    }
    const targetFile = path ? `./${path.replace(/^\/+/, '')}` : './index.html';
    return `${targetFile}?site=store${hash}`;
  }
  const targetFile = path ? `./${path.replace(/^\/+/, '')}` : './index.html';
  return `${targetFile}${hash}`;
}

/**
 * Build a URL to the Utilities Hub (manifestudio.my.id on production or ?site=utilities on preview).
 * @param {ReturnType<typeof resolveSiteContext>} ctx
 * @param {string} [tabId]
 */
export function buildUtilitiesUrl(ctx, tabId = '') {
  const safeTab = String(tabId || '').trim();
  const tabQuery = safeTab ? `tab=${encodeURIComponent(safeTab)}` : '';
  if (ctx?.isSplitDomain) {
    if (ctx.isProductionDomain) {
      const origin = ctx.utilitiesOrigin || DOMAIN_CONFIG.utilitiesOrigin;
      return tabQuery ? `${origin}/?${tabQuery}` : `${origin}/`;
    }
    const qs = tabQuery ? `site=utilities&${tabQuery}` : 'site=utilities';
    return `./tools.html?${qs}`;
  }
  return tabQuery ? `./tools.html?${tabQuery}` : './tools.html';
}

/**
 * Rewrite an internal banner href (e.g. "./tools.html?tab=dracin") to the right domain when split.
 * @param {string} href
 * @param {ReturnType<typeof resolveSiteContext>} ctx
 */
export function resolveBannerHrefForContext(href, ctx) {
  const raw = String(href || '#katalog').trim();
  if (!ctx?.isSplitDomain) return raw;
  if (raw.startsWith('#') || /^https?:\/\//i.test(raw)) return raw;

  const toolsMatch = raw.match(/tools\.html(?:\?([^#]*))?/i);
  if (toolsMatch) {
    const params = new URLSearchParams(toolsMatch[1] || '');
    const tab = params.get('tab') || params.get('tool') || '';
    return buildUtilitiesUrl(ctx, tab);
  }
  if (/index\.html/i.test(raw)) {
    return buildStoreUrl(ctx);
  }
  return raw;
}

/**
 * Build upgraded Manifestore-specific feature banners + 1 Manifestudio Utilities cross-promo slide (3A).
 * Preserves any custom non-utility store banners created by Admin in catalog.banners.
 * @param {Array<object>} banners
 * @param {ReturnType<typeof resolveSiteContext>} ctx
 * @param {(banner: object) => string | null} inferUtilityIdFn
 * @param {{ enabledUtilityCount?: number, brand?: object, productCount?: number }} [meta]
 */
export function buildStorefrontBannersForSiteMode(
  banners,
  ctx,
  inferUtilityIdFn,
  meta = {}
) {
  const list = Array.isArray(banners) ? banners : [];
  if (!ctx?.isSplitDomain || ctx.mode !== 'store') {
    return list.map((b) => ({
      ...b,
      href: resolveBannerHrefForContext(b.href, ctx),
    }));
  }

  const brand = meta.brand || {};
  const storeName = ctx.brandName || DOMAIN_CONFIG.storeBrandName;
  const threshold = Number(brand.discountThreshold ?? 50000);
  const discAmt = Number(brand.discountAmount ?? 2000);
  const payLaterPct = Math.round(Number(brand.payLaterSurchargeRate ?? 0.1) * 1000) / 10;
  const utilCount = Math.max(1, Number(meta.enabledUtilityCount) || 15);
  const prodCount = Math.max(1, Number(meta.productCount) || 19);

  const fmtRp = (n) => `Rp${Math.round(Number(n) || 0).toLocaleString('id-ID')}`;

  // Keep any Store-only banners (non-utility) from Admin catalog
  const storeCustomBanners = list
    .filter((b) => {
      if (b.enabled === false) return false;
      const uid = typeof inferUtilityIdFn === 'function' ? inferUtilityIdFn(b) : null;
      return !uid;
    })
    .map((b, idx) => {
      // Enhance Slide 1 copy subtly for Manifestore identity while preserving custom Admin edits
      const isDefaultSlide1 = idx === 0 && /Layanan Digital Siap Pakai/i.test(String(b.heading || ''));
      return {
        ...b,
        kicker: isDefaultSlide1
          ? `${storeName} · ${prodCount} Layanan Digital Bergaransi`
          : b.kicker,
        href: resolveBannerHrefForContext(b.href, ctx),
      };
    });

  // Rich Manifestore feature showcase slides (Option 3A)
  const featureSlides = [
    {
      id: 'banner-manifestore-promo-voucher',
      kicker: `${storeName} · Promo & Kode Voucher`,
      heading: `Diskon Otomatis ${fmtRp(discAmt)} & Dukungan Kode Voucher`,
      sub: `Belanja mulai ${fmtRp(threshold)} langsung dapat potongan otomatis — bisa digabung voucher aktif & struk faktur digital instan.`,
      ctaLabel: 'Belanja Hemat →',
      href: '#katalog',
      image: './assets/banners/banner-katalog.jpg',
      theme: 'dark',
      enabled: true,
    },
    {
      id: 'banner-manifestore-paylater-wa',
      kicker: `${storeName} · Proses Cepat 3–10 Menit`,
      heading: 'Fleksibel: Bayar Sekarang 0% atau Bayar Nanti Setelah Aktif',
      sub: `Tersedia QRIS/E-Wallet/Bank tanpa biaya tambahan, atau opsi Bayar Belakangan (+${payLaterPct}%) setelah akun Anda aktif & terverifikasi.`,
      ctaLabel: 'Lihat Paket & Garansi →',
      href: '#faq',
      image: './assets/banners/banner-katalog.jpg',
      theme: 'dark',
      enabled: true,
    },
    {
      id: 'banner-manifestore-custom-request',
      kicker: `${storeName} · Request & Custom Layanan`,
      heading: 'Butuh Aplikasi Khusus, Durasi Custom, atau Cek Turnitin / GPTZero?',
      sub: 'Kirim kebutuhan akun, durasi khusus, atau cek dokumen satuan langsung ke WhatsApp Admin dengan estimasi transparan.',
      ctaLabel: 'Request Custom →',
      href: '#custom-request',
      image: './assets/banners/banner-plagiarism.jpg',
      theme: 'dark',
      enabled: true,
    },
    {
      id: 'banner-manifestore-to-manifestudio',
      kicker: `Manifestudio · ${utilCount} Fitur Utilitas Gratis`,
      heading: 'Nonton Drama Pendek, Sholat, YT Music, AI & Cek Nomor 100% Gratis',
      sub: `Kunjungi hub utilitas resmi kami di ${DOMAIN_CONFIG.utilitiesDomain} — akses bebas tanpa login, tanpa biaya, dan tanpa iklan.`,
      ctaLabel: 'Buka Manifestudio ↗',
      href: buildUtilitiesUrl(ctx),
      image: './assets/banners/banner-dracin.jpg',
      theme: 'dark',
      enabled: true,
      isExternalCrossLink: true,
    },
  ];

  // If Admin already added multiple custom store banners, put them first and avoid duplicates
  const existingIds = new Set(storeCustomBanners.map((b) => b.id));
  const merged = [
    ...storeCustomBanners,
    ...featureSlides.filter((s) => !existingIds.has(s.id)),
  ];

  return merged;
}

/**
 * Derive domain-appropriate display brand name, meta tags, and receipt branding (Option 2A).
 * @param {object} brand
 * @param {ReturnType<typeof resolveSiteContext>} ctx
 */
export function resolveDisplayBrand(brand = {}, ctx = {}) {
  const accessCfg = normalizeStoreAccessConfig(brand?.storeAccess || {});
  const rawName = String(brand?.name || 'Manifestudio').trim() || 'Manifestudio';
  const isDefaultManifestudio = /^manifestudio$/i.test(rawName);
  const isStoreSplit = Boolean(ctx?.isSplitDomain && ctx.mode === 'store');

  const displayName =
    isStoreSplit && isDefaultManifestudio
      ? accessCfg.storeBrandName || DOMAIN_CONFIG.storeBrandName
      : isStoreSplit
        ? accessCfg.storeBrandName || rawName
        : rawName;

  const rawFooter = String(brand?.footerText || `Dikelola oleh ${rawName} by Tomy © 2026`).trim();
  const footerText = isStoreSplit
    ? rawFooter.replace(/Manifestudio/gi, displayName)
    : rawFooter;

  const tagline = String(brand?.tagline || 'by Tomy').trim() || 'by Tomy';

  return {
    name: displayName,
    tagline,
    footerText,
    receiptBrandUpper: displayName.toUpperCase(),
    receiptSlug: displayName.toLowerCase().replace(/[^a-z0-9]+/g, '') || 'manifestore',
    storeTitle: `${displayName} ${tagline} — Akun Premium & Layanan Digital Bergaransi`,
    storeDescription:
      'Katalog akun premium & layanan digital bergaransi dengan proses cepat 3–10 menit via WhatsApp, potongan otomatis, kode voucher, dan opsi Bayar Nanti.',
    utilitiesTitle: `${accessCfg.utilitiesBrandName} — 15 Utilitas Gratis Terpadu`,
    utilitiesDescription:
      '15 fitur utilitas gratis tanpa login: Jadwal Sholat Kemenag RI, Prakiraan Cuaca, Jam Dunia, Speedtest, Downloader, Kompresor HD, Konversi File, YT Music, Drama Pendek, Audio Editor, Manifest AI, Plagiarisme, Novel & Cek Nomor.',
  };
}

/**
 * Sync <link rel="manifest">, <link rel="canonical">, og:url, and apple-mobile-web-app-title
 * so Manifestore and Manifestudio each install as their own standalone PWA.
 * @param {ReturnType<typeof resolveSiteContext>} ctx
 */
export function applyDomainPwaMeta(ctx) {
  if (typeof document === 'undefined' || !ctx) return;

  const manifestLink = document.querySelector('link[rel="manifest"]');
  if (manifestLink && ctx.manifestHref) {
    manifestLink.setAttribute('href', ctx.manifestHref);
  }

  const appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
  if (appleTitle && ctx.brandName) {
    appleTitle.setAttribute('content', ctx.brandName);
  }

  if (ctx.isProductionDomain) {
    const canonical = document.querySelector('link[rel="canonical"]');
    const targetOrigin =
      ctx.mode === 'store'
        ? ctx.storeOrigin || DOMAIN_CONFIG.storeOrigin
        : ctx.utilitiesOrigin || DOMAIN_CONFIG.utilitiesOrigin;
    if (canonical) {
      canonical.setAttribute('href', `${targetOrigin}/`);
    }
    const ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl) {
      ogUrl.setAttribute('content', `${targetOrigin}/`);
    }
  }
}

/**
 * Pure edge-routing planner mirroring functions/_middleware.js for Cloudflare Pages.
 * Note: On manifestudio.my.id, NEVER redirect /order.html to manifestore.my.id so unauthorized
 * Studio visitors cannot discover the Store domain without the Access Key.
 * @param {string} requestUrl
 * @returns {{ action: 'next' | 'rewrite' | 'redirect', target?: string, status?: number }}
 */
export function resolveEdgeRoute(requestUrl) {
  let url;
  try {
    url = new URL(requestUrl);
  } catch {
    return { action: 'next' };
  }

  const host = normalizeHostname(url.hostname);
  const lowerPath = url.pathname.toLowerCase();

  if (
    lowerPath.startsWith('/assets/') ||
    lowerPath.startsWith('/css/') ||
    lowerPath.startsWith('/js/') ||
    lowerPath.startsWith('/data/') ||
    lowerPath === '/sw.js' ||
    lowerPath === '/admin.html' ||
    lowerPath === '/admin'
  ) {
    return { action: 'next' };
  }

  const isUtilitiesHost = UTILITIES_HOSTS.has(host);
  const isStoreHost = STORE_HOSTS.has(host);

  if (!isUtilitiesHost && !isStoreHost) {
    return { action: 'next' };
  }

  const siteOverride = (url.searchParams.get('site') || '').trim().toLowerCase();
  if (siteOverride === 'store' || siteOverride === 'utilities') {
    return { action: 'next' };
  }

  if (isUtilitiesHost) {
    if (lowerPath === '/' || lowerPath === '/index.html') {
      return {
        action: 'rewrite',
        target: `/tools.html${url.search}`,
      };
    }
    if (lowerPath === '/manifest.webmanifest') {
      return {
        action: 'rewrite',
        target: '/manifest-utilities.webmanifest',
      };
    }
    if (lowerPath === '/order.html' || lowerPath === '/order') {
      // Keep Store domain private from Studio-only visitors
      return {
        action: 'redirect',
        status: 302,
        target: `${DOMAIN_CONFIG.utilitiesOrigin}/`,
      };
    }
    return { action: 'next' };
  }

  // Store host (manifestore.my.id)
  if (lowerPath === '/manifest.webmanifest') {
    return {
      action: 'rewrite',
      target: '/manifest-store.webmanifest',
    };
  }
  if (lowerPath === '/tools.html' || lowerPath === '/tools') {
    const tab = url.searchParams.get('tab') || url.searchParams.get('tool') || '';
    const qs = tab ? `?tab=${encodeURIComponent(tab)}` : '';
    return {
      action: 'redirect',
      status: 302,
      target: `${DOMAIN_CONFIG.utilitiesOrigin}/${qs}`,
    };
  }

  return { action: 'next' };
}
