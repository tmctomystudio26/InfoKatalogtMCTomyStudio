import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  DOMAIN_CONFIG,
  STORE_VAULT_API,
  buildStoreUrl,
  buildStorefrontBannersForSiteMode,
  buildUtilitiesUrl,
  generateRandomStoreAccessKey,
  normalizeOriginUrl,
  normalizeStoreAccessConfig,
  resolveBannerHrefForContext,
  resolveDisplayBrand,
  resolveEdgeRoute,
  resolveSiteContext,
} from './domain-router.js';
import {
  buildWhatsAppOrderCaption,
  createOrderSnapshot,
  inferBannerUtilityId,
  normalizeBrandConfig,
} from './store.js';
import { onRequest } from '../functions/_middleware.js';

test('Zero-secret client policy: domain-router & catalog.json contain zero store keys or client-side bypass helpers', () => {
  // normalizeStoreAccessConfig strips any legacy secret/key/storeOrigin fields
  const cfg = normalizeStoreAccessConfig({
    enabled: true,
    accessKey: 'SHOULD_NOT_SURVIVE',
    accessKeyEncoded: 'mskey:v1:deadbeef',
    storeOrigin: 'https://secret.example.com',
    promptTitle: 'Akses Khusus Store',
  });
  assert.equal(cfg.enabled, true);
  assert.equal('accessKey' in cfg, false);
  assert.equal('accessKeyEncoded' in cfg, false);
  assert.equal('storeOrigin' in cfg, false);
  assert.equal(STORE_VAULT_API.verifyUrl, '/api/store-access/verify');
  assert.equal(STORE_VAULT_API.goUrl, '/api/store-access/go');

  // Cryptographic random key generator produces strong MF-XXXX-XXXX format
  const randomKey = generateRandomStoreAccessKey();
  assert.match(randomKey, /^MF-[A-Z2-9]{4}-[A-Z2-9]{4}$/);

  // Live catalog.json must NOT contain any key or storeOrigin
  const catalogRaw = fs.readFileSync(
    path.resolve(process.cwd(), '.repos/InfoKatalogtMCTomyStudio/data/catalog.json'),
    'utf8'
  );
  assert.equal(/MFSTORE26|accessKeyEncoded|mskey:v1:/i.test(catalogRaw), false);
  const catalog = JSON.parse(catalogRaw);
  assert.equal(catalog.brand?.storeAccess?.accessKeyEncoded, undefined);
  assert.equal(catalog.brand?.storeAccess?.storeOrigin, undefined);
});

test('resolveSiteContext enforces asymmetric access policy (open on Store host, server-gated on Manifestudio)', () => {
  const storeCtx = resolveSiteContext({ hostname: 'manifestore.my.id', pathname: '/' });
  assert.equal(storeCtx.mode, 'store');
  assert.equal(storeCtx.isSplitDomain, true);
  assert.equal(storeCtx.isProductionDomain, true);
  assert.equal(storeCtx.requiresStoreGate, false);
  assert.equal(storeCtx.brandName, 'Manifestore');
  assert.equal(storeCtx.manifestHref, './manifest-store.webmanifest');
  assert.equal(buildUtilitiesUrl(storeCtx), 'https://manifestudio.my.id/');
  assert.equal(buildUtilitiesUrl(storeCtx, 'dracin'), 'https://manifestudio.my.id/?tab=dracin');

  const utilCtx = resolveSiteContext({ hostname: 'manifestudio.my.id', pathname: '/' });
  assert.equal(utilCtx.mode, 'utilities');
  assert.equal(utilCtx.isSplitDomain, true);
  assert.equal(utilCtx.isProductionDomain, true);
  assert.equal(utilCtx.requiresStoreGate, true);
  assert.equal(utilCtx.brandName, 'Manifestudio');
  assert.equal(utilCtx.manifestHref, './manifest-utilities.webmanifest');
  // Never leaks storeOrigin on Manifestudio — always routes via server-verified /api/store-access/go
  assert.equal(utilCtx.storeOrigin, '');
  assert.equal(buildStoreUrl(utilCtx), '/api/store-access/go');

  // Preview query overrides on localhost
  const localStore = resolveSiteContext({ hostname: 'localhost', search: '?site=store' });
  assert.equal(localStore.mode, 'store');
  assert.equal(localStore.isSplitDomain, true);
  assert.equal(localStore.isProductionDomain, false);
  assert.equal(localStore.requiresStoreGate, false);
  assert.equal(buildUtilitiesUrl(localStore), './tools.html?site=utilities');

  const localUtil = resolveSiteContext({ hostname: 'localhost', search: '?site=utilities' });
  assert.equal(localUtil.mode, 'utilities');
  assert.equal(localUtil.isSplitDomain, true);
  assert.equal(localUtil.requiresStoreGate, true);
  assert.equal(buildStoreUrl(localUtil), '/api/store-access/go');
});

test('Upgraded Manifestore banners (Option 3A) replace 15 utility banners with Store features + 1 Manifestudio slide', () => {
  const storeCtx = resolveSiteContext({ hostname: 'manifestore.my.id', pathname: '/' });
  const inputBanners = [
    {
      id: 'banner-katalog',
      kicker: 'Katalog Utama',
      heading: 'Layanan Digital Siap Pakai dalam Hitungan Menit',
      href: '#katalog',
      enabled: true,
    },
    {
      id: 'banner-dracin',
      kicker: 'Drama Pendek',
      heading: 'Nonton Drama Pendek',
      href: './tools.html?tab=dracin',
      enabled: true,
    },
    {
      id: 'banner-prayer',
      kicker: 'Jadwal Sholat',
      heading: 'Jadwal Sholat Kemenag RI',
      href: './tools.html?tab=prayer',
      enabled: true,
    },
  ];

  const upgraded = buildStorefrontBannersForSiteMode(inputBanners, storeCtx, inferBannerUtilityId, {
    enabledUtilityCount: 15,
    productCount: 19,
    brand: { discountThreshold: 50000, discountAmount: 2000, payLaterSurchargeRate: 0.1 },
  });

  assert.equal(upgraded.length, 5);
  assert.ok(upgraded[0].kicker.includes('Manifestore'));
  assert.ok(upgraded.some((b) => b.id === 'banner-manifestore-promo-voucher'));
  assert.ok(upgraded.some((b) => b.id === 'banner-manifestore-paylater-wa'));
  assert.ok(upgraded.some((b) => b.href === '#custom-request'));
  const crossPromo = upgraded.find((b) => b.id === 'banner-manifestore-to-manifestudio');
  assert.ok(crossPromo);
  assert.equal(crossPromo.href, 'https://manifestudio.my.id/');
  assert.equal(upgraded.some((b) => b.id === 'banner-dracin'), false);
  assert.equal(upgraded.some((b) => b.id === 'banner-prayer'), false);
});

test('Dual branding (Option 2A) updates brand display, WhatsApp caption, and order snapshot for Manifestore', () => {
  const brand = normalizeBrandConfig({
    name: 'Manifestudio',
    tagline: 'by Tomy',
    footerText: 'Dikelola oleh Manifestudio by Tomy © 2026',
  });
  assert.ok(brand.storeAccess);
  assert.equal(brand.storeAccess.storeBrandName, 'Manifestore');

  const storeCtx = resolveSiteContext({ hostname: 'manifestore.my.id', pathname: '/' });
  const display = resolveDisplayBrand(brand, storeCtx);
  assert.equal(display.name, 'Manifestore');
  assert.equal(display.receiptBrandUpper, 'MANIFESTORE');
  assert.equal(display.receiptSlug, 'manifestore');
  assert.ok(display.footerText.includes('Manifestore'));

  const caption = buildWhatsAppOrderCaption({
    orderCode: 'MS-202601-1234',
    brandName: display.name,
    customerName: 'Budi',
    paymentOption: 'Bayar Sekarang',
    cart: [{ productName: 'Netflix', variantName: '1P1U 1 Bulan', price: 30000, quantity: 1 }],
    totals: { subtotal: 30000, discount: 0, voucherDiscount: 0, serviceFee: 0, payLaterFee: 0, total: 30000 },
  });
  assert.ok(caption.includes('*PESANAN BARU — MANIFESTORE*'));

  const snap = createOrderSnapshot({
    orderCode: 'MS-202601-1234',
    whatsappNumber: '6285122936027',
    brandName: 'Manifestore',
    customerName: 'Budi',
    paymentOption: 'Bayar Sekarang',
    cart: [{ productName: 'Netflix', variantName: '1P1U 1 Bulan', price: 30000, quantity: 1 }],
    totals: { subtotal: 30000, discount: 0, voucherDiscount: 0, serviceFee: 0, payLaterFee: 0, total: 30000 },
  });
  assert.equal(snap.brandName, 'Manifestore');
  assert.ok(snap.caption.includes('MANIFESTORE'));
});

test('Edge routing & Cloudflare Pages _middleware.js parity including /api/* pass-through', async () => {
  assert.deepEqual(resolveEdgeRoute('https://manifestudio.my.id/api/store-access/status'), {
    action: 'next',
  });
  assert.deepEqual(resolveEdgeRoute('https://manifestudio.my.id/api/store-access/go'), {
    action: 'next',
  });
  assert.deepEqual(resolveEdgeRoute('https://manifestudio.my.id/'), {
    action: 'rewrite',
    target: '/tools.html',
  });
  assert.deepEqual(resolveEdgeRoute('https://manifestudio.my.id/?tab=dracin'), {
    action: 'rewrite',
    target: '/tools.html?tab=dracin',
  });
  assert.deepEqual(resolveEdgeRoute('https://manifestudio.my.id/manifest.webmanifest'), {
    action: 'rewrite',
    target: '/manifest-utilities.webmanifest',
  });
  const studioOrder = resolveEdgeRoute('https://manifestudio.my.id/order.html');
  assert.equal(studioOrder.action, 'redirect');
  assert.equal(studioOrder.target, 'https://manifestudio.my.id/');

  assert.deepEqual(resolveEdgeRoute('https://manifestore.my.id/'), { action: 'next' });
  assert.deepEqual(resolveEdgeRoute('https://manifestore.my.id/manifest.webmanifest'), {
    action: 'rewrite',
    target: '/manifest-store.webmanifest',
  });
  assert.deepEqual(resolveEdgeRoute('https://manifestore.my.id/tools.html?tab=prayer'), {
    action: 'redirect',
    status: 302,
    target: 'https://manifestudio.my.id/?tab=prayer',
  });

  // Middleware runtime check
  let fetchedUrl = '';
  const fakeEnv = {
    ASSETS: {
      fetch: async (req) => {
        fetchedUrl = req.url;
        return new Response('ok', { status: 200 });
      },
    },
  };
  let nextCalled = false;
  const fakeNext = async () => {
    nextCalled = true;
    return new Response('next', { status: 200 });
  };

  await onRequest({
    request: new Request('https://manifestudio.my.id/api/store-access/go'),
    env: fakeEnv,
    next: fakeNext,
  });
  assert.equal(nextCalled, true);

  nextCalled = false;
  await onRequest({
    request: new Request('https://manifestudio.my.id/?tab=music'),
    env: fakeEnv,
    next: fakeNext,
  });
  assert.equal(fetchedUrl, 'https://manifestudio.my.id/tools.html?tab=music');
  assert.equal(nextCalled, false);

  const redirectRes = await onRequest({
    request: new Request('https://manifestore.my.id/tools.html?tab=dracin'),
    env: fakeEnv,
    next: fakeNext,
  });
  assert.equal(redirectRes.status, 302);
  assert.equal(redirectRes.headers.get('location'), 'https://manifestudio.my.id/?tab=dracin');

  assert.equal(
    normalizeOriginUrl('manifestudio.my.id/', DOMAIN_CONFIG.utilitiesOrigin),
    'https://manifestudio.my.id'
  );
  assert.equal(
    resolveBannerHrefForContext('./tools.html?tab=novel', {
      isSplitDomain: true,
      isProductionDomain: true,
      utilitiesOrigin: 'https://manifestudio.my.id',
    }),
    'https://manifestudio.my.id/?tab=novel'
  );
});
