import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DOMAIN_CONFIG,
  buildStoreUrl,
  buildStorefrontBannersForSiteMode,
  buildUtilitiesUrl,
  decodeStoreAccessKey,
  encodeStoreAccessKey,
  generateRandomStoreAccessKey,
  getEditableStoreAccessKey,
  normalizeOriginUrl,
  normalizeStoreAccessConfig,
  resolveBannerHrefForContext,
  resolveDisplayBrand,
  resolveEdgeRoute,
  resolveSiteContext,
  verifyStoreAccessKey,
} from './domain-router.js';
import {
  buildWhatsAppOrderCaption,
  createOrderSnapshot,
  inferBannerUtilityId,
  normalizeBrandConfig,
} from './store.js';
import { onRequest } from '../functions/_middleware.js';

test('Store Access Key obfuscation round-trip and verification', () => {
  const encoded = encodeStoreAccessKey('MFSTORE26');
  assert.ok(encoded.startsWith('mskey:v1:'));
  assert.notEqual(encoded, 'MFSTORE26');
  assert.equal(decodeStoreAccessKey(encoded), 'MFSTORE26');

  const cfg = normalizeStoreAccessConfig();
  assert.equal(cfg.enabled, true);
  assert.equal(getEditableStoreAccessKey(cfg), 'MFSTORE26');

  // Case-insensitive and whitespace-tolerant matching
  assert.equal(verifyStoreAccessKey('MFSTORE26', cfg).ok, true);
  assert.equal(verifyStoreAccessKey('  mfstore26  ', cfg).ok, true);
  assert.equal(verifyStoreAccessKey('WRONGKEY', cfg).ok, false);
  assert.equal(verifyStoreAccessKey('', cfg).reason, 'empty');

  // Admin custom key override
  const customCfg = normalizeStoreAccessConfig({
    enabled: true,
    accessKeyEncoded: encodeStoreAccessKey('VIP-TOMY-99'),
  });
  assert.equal(getEditableStoreAccessKey(customCfg), 'VIP-TOMY-99');
  assert.equal(verifyStoreAccessKey('vip-tomy-99', customCfg).ok, true);
  assert.equal(verifyStoreAccessKey('MFSTORE26', customCfg).ok, false);

  // Disabled gate passes automatically
  const openCfg = normalizeStoreAccessConfig({ enabled: false });
  assert.equal(verifyStoreAccessKey('', openCfg).ok, true);

  // Random generator produces valid non-empty key
  const randomKey = generateRandomStoreAccessKey();
  assert.match(randomKey, /^MF-[A-Z2-9]{6}$/);
});

test('resolveSiteContext enforces asymmetric access policy (open on Manifestore, gated on Manifestudio)', () => {
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
  assert.equal(buildStoreUrl(utilCtx), 'https://manifestore.my.id/');

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
  assert.equal(buildStoreUrl(localUtil), './index.html?site=store');
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

  // 1 store main banner + 3 Manifestore feature slides + 1 Manifestudio cross-promo slide = 5 slides
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

test('Edge routing & Cloudflare Pages _middleware.js parity', async () => {
  // Pure planner checks
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
  // Must NOT leak manifestore.my.id when someone hits /order.html on manifestudio.my.id
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

  // Static assets and admin pass straight through
  assert.deepEqual(resolveEdgeRoute('https://manifestudio.my.id/admin.html'), { action: 'next' });
  assert.deepEqual(resolveEdgeRoute('https://manifestudio.my.id/js/app.js'), { action: 'next' });

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

  const originNorm = normalizeOriginUrl('manifestore.my.id/', DOMAIN_CONFIG.storeOrigin);
  assert.equal(originNorm, 'https://manifestore.my.id');
  assert.equal(
    resolveBannerHrefForContext('./tools.html?tab=novel', {
      isSplitDomain: true,
      isProductionDomain: true,
      utilitiesOrigin: 'https://manifestudio.my.id',
    }),
    'https://manifestudio.my.id/?tab=novel'
  );
});
