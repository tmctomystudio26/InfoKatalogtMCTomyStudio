/**
 * Cloudflare Pages Edge Middleware — Dual-Domain 1-Repo Router (v80)
 *
 * Powers two distinct domains & standalone PWAs from 1 GitHub repository:
 *  - https://manifestudio.my.id  -> Utilities Hub (rewrites `/` & `/index.html` -> `/tools.html` at the edge)
 *  - https://manifestore.my.id   -> Manifestore Storefront (serves `/index.html`, redirects `/tools.html` -> manifestudio.my.id)
 *
 * Privacy guard: On manifestudio.my.id, `/order.html` redirects back to `/` instead of exposing
 * manifestore.my.id so only visitors with the Admin-configured Access Key can switch from Studio to Store.
 *
 * Zero build step required on Cloudflare Pages (Framework: None, Build command: empty, Output dir: /).
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

export async function onRequest(context) {
  const { request, env, next } = context;

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return next();
  }

  const url = new URL(request.url);
  const host = url.hostname.toLowerCase();
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
