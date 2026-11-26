/**
 * Dual-Domain Router, Branding & Server-Vault Gate Config Module (v83)
 *
 * Powers 1 GitHub Repository + Cloudflare Pages across two distinct domains:
 *  - https://manifestudio.my.id -> Hub Utilitas (15 Fitur Gratis)
 *  - Storefront Domain          -> Manifestore (Katalog Akun Premium & Layanan Digital)
 *
 * Zero-Secret Policy (v83):
 *  - ZERO access keys, hashes, salts, or Store destination URLs exist in client-side code
 *    or `data/catalog.json`.
 *  - All Store Access verification, PBKDF2-SHA256 hashing, rate limiting, HttpOnly HMAC
 *    pass cookies, and protected 302 redirects run exclusively on Cloudflare Pages Edge
 *    Functions (`/api/store-access/*`) backed by Cloudflare KV (`STORE_ACCESS_KV`).
 */

export const DOMAIN_CONFIG = Object.freeze({
  utilitiesDomain: 'manifestudio.my.id',
  utilitiesOrigin: 'https://manifestudio.my.id',
  storeBrandName: 'Manifestore',
  utilitiesBrandName: 'Manifestudio',
  storeManifestPath: './manifest-store.webmanifest',
  utilitiesManifestPath: './manifest-utilities.webmanifest',
});

export const STORE_VAULT_API = Object.freeze({
  statusUrl: '/api/store-access/status',
  verifyUrl: '/api/store-access/verify',
  goUrl: '/api/store-access/go',
  adminUrl: '/api/store-access/admin',
  csrfHeaderName: 'X-Requested-With',
  csrfHeaderValue: 'Manifestudio-Vault',
});

const UTILITIES_HOSTS = new Set([
  'manifestudio.my.id',
  'www.manifestudio.my.id',
  'tools.manifestudio.my.id',
  'utilitas.manifestudio.my.id',
]);

function isLocalOrPreviewHost(host) {
  if (!host) return true;
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host === '[::1]' ||
    host.endsWith('.local') ||
    host.endsWith('.pages.dev') ||
    host.endsWith('.run.app')
  ) {
    return true;
  }
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
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
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return fallbackOrigin;
    }
    return parsed.origin;
  } catch {
    return fallbackOrigin;
  }
}

/**
 * Normalize public non-sensitive Store Access UI config from catalog.brand.storeAccess.
 * Intentionally strips any legacy secret/key fields so they can never leak into catalog.json.
 * @param {object} raw
 */
export function normalizeStoreAccessConfig(raw = {}) {
  const safe = raw && typeof raw === 'object' ? raw : {};
  const utilitiesOrigin = normalizeOriginUrl(safe.utilitiesOrigin, DOMAIN_CONFIG.utilitiesOrigin);

  return {
    enabled: safe.enabled !== false,
    promptTitle:
      String(safe.promptTitle || 'Akses Khusus Store').trim() || 'Akses Khusus Store',
    promptDescription:
      String(
        safe.promptDescription ||
          'Masukkan kunci akses untuk melanjutkan ke halaman Store.'
      ).trim(),
    contactPromptTitle:
      String(safe.contactPromptTitle || 'Akses Kontak Resmi').trim() || 'Akses Kontak Resmi',
    contactPromptDescription:
      String(
        safe.contactPromptDescription ||
          'Masukkan kunci akses untuk membuka tautan kontak resmi.'
      ).trim(),
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
 * Generate a cryptographically strong, human-readable random access key for Admin Panel "Acak Kunci".
 * Uses Web Crypto `crypto.getRandomValues` (no Math.random bias).
 * @returns {string}
 */
export function generateRandomStoreAccessKey() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(8);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  let raw = '';
  for (let i = 0; i < bytes.length; i += 1) {
    raw += alphabet[bytes[i] % alphabet.length];
  }
  return `MF-${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
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
 * Never embeds or exposes the Store domain URL on Manifestudio clients.
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
  const currentOrigin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : host
        ? `https://${host}`
        : '';
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

  let utilHostFromCfg = '';
  try {
    utilHostFromCfg = normalizeHostname(new URL(accessCfg.utilitiesOrigin).hostname);
  } catch {
    // Ignore
  }

  const isUtilProdHost =
    UTILITIES_HOSTS.has(host) || (Boolean(utilHostFromCfg) && host === utilHostFromCfg);
  const isStoreProdHost = !isUtilProdHost && !isLocalOrPreviewHost(host) && !isToolsPage;
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
      storeOrigin: isStoreProdHost ? currentOrigin : '',
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
      storeOrigin: '',
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
      storeOrigin: currentOrigin || `https://${host}`,
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
      storeOrigin: '',
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
    storeOrigin: '',
    utilitiesOrigin: accessCfg.utilitiesOrigin,
    requiresStoreGate: false,
  };
}

/**
 * Build a URL to the Storefront for Store-context internal links (e.g. order.html -> index.html).
 * On Manifestudio Utilities mode, always routes through the server-verified gateway `/api/store-access/go`.
 * @param {ReturnType<typeof resolveSiteContext>} ctx
 * @param {{ hash?: string, path?: string }} [opts]
 */
export function buildStoreUrl(ctx, opts = {}) {
  if (ctx?.mode === 'utilities' && ctx?.isSplitDomain) {
    return STORE_VAULT_API.goUrl;
  }
  const hash = opts.hash ? (opts.hash.startsWith('#') ? opts.hash : `#${opts.hash}`) : '';
  const path = opts.path || '';
  if (ctx?.isSplitDomain) {
    if (ctx.isProductionDomain && ctx.storeOrigin) {
      const cleanPath = path ? `/${path.replace(/^\/+/, '')}` : '/';
      return `${ctx.storeOrigin}${cleanPath}${hash}`;
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

  const storeCustomBanners = list
    .filter((b) => {
      if (b.enabled === false) return false;
      const uid = typeof inferUtilityIdFn === 'function' ? inferUtilityIdFn(b) : null;
      return !uid;
    })
    .map((b, idx) => {
      const isDefaultSlide1 = idx === 0 && /Layanan Digital Siap Pakai/i.test(String(b.heading || ''));
      return {
        ...b,
        kicker: isDefaultSlide1
          ? `${storeName} · ${prodCount} Layanan Digital Bergaransi`
          : b.kicker,
        href: resolveBannerHrefForContext(b.href, ctx),
      };
    });

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

  const existingIds = new Set(storeCustomBanners.map((b) => b.id));
  return [
    ...storeCustomBanners,
    ...featureSlides.filter((s) => !existingIds.has(s.id)),
  ];
}

/**
 * Derive domain-appropriate display brand name, meta tags, and receipt branding (Option 2A).
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
    utilitiesTitle: `${accessCfg.utilitiesBrandName} — 17 Utilitas Gratis Terpadu`,
    utilitiesDescription:
      '17 fitur utilitas gratis tanpa login: Jadwal Sholat Kemenag RI, Prakiraan Cuaca, Jam Dunia, Speedtest, Downloader, Shortlink Bypass, SSH & VPN, Kompresor HD, Konversi File, YT Music, Drama Pendek, Audio Editor, Manifest AI, Plagiarisme, Novel & Cek Nomor.',
  };
}

/**
 * Sync <link rel="manifest">, <link rel="canonical">, og:url, and apple-mobile-web-app-title.
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
        ? ctx.storeOrigin || window.location.origin
        : ctx.utilitiesOrigin || DOMAIN_CONFIG.utilitiesOrigin;
    if (canonical && targetOrigin) {
      canonical.setAttribute('href', `${targetOrigin}/`);
    }
    const ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl && targetOrigin) {
      ogUrl.setAttribute('content', `${targetOrigin}/`);
    }
  }
}

/**
 * Pure edge-routing planner mirroring functions/_middleware.js for Cloudflare Pages.
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
    lowerPath.startsWith('/api/') ||
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
  const isStoreHost = !isUtilitiesHost && !isLocalOrPreviewHost(host);

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
      return {
        action: 'redirect',
        status: 302,
        target: `${DOMAIN_CONFIG.utilitiesOrigin}/`,
      };
    }
    return { action: 'next' };
  }

  // Production Store host
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
