/**
 * Cloudflare Pages Edge Middleware — Dual-Domain 1-Repo Router & Privacy Filter (v85)
 *
 * Powers two distinct domains & standalone PWAs from 1 GitHub repository:
 *  - https://manifestudio.my.id  -> Utilities Hub (rewrites `/` & `/index.html` -> `/tools.html` at the edge)
 *  - https://manifestore.my.id   -> Manifestore Storefront (serves `/index.html`, redirects `/tools.html` -> manifestudio.my.id)
 *
 * Zero-Leak Edge Privacy Guard (v85):
 *  - On manifestudio.my.id, requests to `/data/catalog.json` (except from `/admin.html`) are sanitized
 *    at the Cloudflare Edge to strip Store catalog products, pricing, vouchers, payment methods, and
 *    raw WhatsApp/Instagram/TikTok contacts so they never appear in browser DevTools or AI context.
 *  - On manifestudio.my.id, `/order.html` redirects back to `/` without exposing manifestore.my.id.
 */

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

const UTILITIES_ORIGIN = 'https://manifestudio.my.id';

function sanitizeCatalogForUtilitiesHost(rawCatalog) {
  if (!rawCatalog || typeof rawCatalog !== 'object') return rawCatalog;
  const brand = rawCatalog.brand && typeof rawCatalog.brand === 'object' ? rawCatalog.brand : {};
  const rawAccess =
    brand.storeAccess && typeof brand.storeAccess === 'object' ? brand.storeAccess : {};
  const utilBanners = Array.isArray(rawCatalog.banners)
    ? rawCatalog.banners.filter((b) => {
        if (!b || b.enabled === false) return false;
        const href = String(b.href || '').toLowerCase();
        const id = String(b.id || '').toLowerCase();
        return (
          href.includes('tools.html') ||
          href.includes('?tab=') ||
          id.startsWith('banner-tool-') ||
          id.startsWith('banner-util-') ||
          /prayer|weather|worldclock|speedtest|downloader|compressor|converter|songfinder|music|dracin|audioeditor|manifestai|plagiarism|novel|callerid/i.test(
            `${id} ${href}`
          )
        );
      })
    : [];

  return {
    version: rawCatalog.version || 1,
    updatedAt: rawCatalog.updatedAt || null,
    brand: {
      name: String(rawAccess.utilitiesBrandName || brand.name || 'Manifestudio'),
      tagline: String(brand.tagline || 'by Tomy'),
      logo: brand.logo || './assets/icons/brand-icon.svg',
      footerText: String(brand.footerText || 'Dikelola oleh Manifestudio by Tomy © 2026').replace(
        /Manifestore/gi,
        'Manifestudio'
      ),
      socials: [],
      storeAccess: {
        enabled: rawAccess.enabled !== false,
        utilitiesBrandName: String(rawAccess.utilitiesBrandName || 'Manifestudio'),
        utilitiesOrigin: String(rawAccess.utilitiesOrigin || UTILITIES_ORIGIN),
        promptTitle: String(rawAccess.promptTitle || 'Akses Khusus Store'),
        promptDescription: String(
          rawAccess.promptDescription || 'Masukkan kunci akses yang valid untuk melanjutkan.'
        ),
        contactPromptTitle: String(rawAccess.contactPromptTitle || 'Akses Kontak Resmi'),
        contactPromptDescription: String(
          rawAccess.contactPromptDescription ||
            'Masukkan kunci akses untuk membuka tautan kontak resmi.'
        ),
      },
    },
    categories: [],
    products: [],
    vouchers: [],
    paymentOptions: [],
    faq: [],
    banners: utilBanners,
    utilities: rawCatalog.utilities || {},
  };
}

export async function onRequest(context) {
  const { request, env, next } = context;

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return next();
  }

  const url = new URL(request.url);
  const host = url.hostname.toLowerCase();
  const lowerPath = url.pathname.toLowerCase();

  // Edge Privacy Filter for /data/catalog.json on Manifestudio public pages (preserve full catalog for /admin.html)
  if (UTILITIES_HOSTS.has(host) && lowerPath === '/data/catalog.json') {
    const referer = String(request.headers.get('referer') || '').toLowerCase();
    const isAdminReferer = referer.includes('/admin.html') || referer.endsWith('/admin');
    if (!isAdminReferer) {
      const originRes = await next();
      if (!originRes.ok) return originRes;
      try {
        const rawJson = await originRes.json();
        const sanitized = sanitizeCatalogForUtilitiesHost(rawJson);
        return new Response(JSON.stringify(sanitized), {
          status: 200,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store, private',
            'X-Content-Type-Options': 'nosniff',
          },
        });
      } catch {
        return originRes;
      }
    }
    return next();
  }

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
    return next();
  }

  const siteOverride = (url.searchParams.get('site') || '').trim().toLowerCase();
  if (siteOverride === 'store' || siteOverride === 'utilities') {
    return next();
  }

  if (UTILITIES_HOSTS.has(host)) {
    if (lowerPath === '/' || lowerPath === '/index.html') {
      const targetUrl = new URL(`/tools.html${url.search}`, url.origin);
      return env.ASSETS.fetch(new Request(targetUrl.toString(), request));
    }
    if (lowerPath === '/manifest.webmanifest') {
      const targetUrl = new URL('/manifest-utilities.webmanifest', url.origin);
      return env.ASSETS.fetch(new Request(targetUrl.toString(), request));
    }
    if (lowerPath === '/order.html' || lowerPath === '/order') {
      return Response.redirect(`${UTILITIES_ORIGIN}/`, 302);
    }
    return next();
  }

  if (STORE_HOSTS.has(host)) {
    if (lowerPath === '/manifest.webmanifest') {
      const targetUrl = new URL('/manifest-store.webmanifest', url.origin);
      return env.ASSETS.fetch(new Request(targetUrl.toString(), request));
    }
    if (lowerPath === '/tools.html' || lowerPath === '/tools') {
      const tab = url.searchParams.get('tab') || url.searchParams.get('tool') || '';
      const qs = tab ? `?tab=${encodeURIComponent(tab)}` : '';
      return Response.redirect(`${UTILITIES_ORIGIN}/${qs}`, 302);
    }
    return next();
  }

  return next();
}
