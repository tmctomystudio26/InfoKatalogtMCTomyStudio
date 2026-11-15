import test from 'node:test';
import assert from 'node:assert/strict';
import { getDefaultCatalogSnapshot, PRODUCTS, VOUCHERS } from './data.js';
import {
  addToCart,
  buildWhatsAppOrderCaption,
  buildWhatsAppOrderMessage,
  calculateCartTotals,
  collectOrphanedUploadLogos,
  createOrderSnapshot,
  evaluateVoucher,
  extractManagedUploadLogoPath,
  filterProducts,
  formatRupiah,
  getStartingPrice,
  moveProductInCatalog,
  removeFromCart,
  reorderProductToIndex,
  toggleProductStockInCatalog,
  updateCartQty,
  upsertProductInCatalog,
  validateOrderForm,
} from './store.js';
import {
  decryptVault,
  encryptVault,
  verifyGitHubTokenAccess,
} from './vault.js';
import {
  WORLD_LOCATIONS,
  calculatePingStats,
  computeMbps,
  convertWorldTime,
  describeCloudflareColo,
  describeWeatherCode,
  evaluateConnectionQuality,
  findNearestLocationOnGlobe,
  getNextPrayerInfo,
  inverseOrthographic,
  matchIndonesianCityQuery,
  parseDeviceTelemetry,
  projectOrthographic,
  speedToGaugeRatio,
} from './tools-logic.js';

test('formatRupiah formats Indonesian currency accurately', () => {
  assert.equal(formatRupiah(22500), 'Rp22.500');
  assert.equal(formatRupiah(0), 'Rp0');
  assert.equal(formatRupiah(-500), 'Rp0');
});

test('getStartingPrice ignores zero-priced custom items unless all zero', () => {
  const netflix = PRODUCTS.find((p) => p.id === 'netflix-premium');
  const custom = PRODUCTS.find((p) => p.id === 'request-custom');
  assert.equal(getStartingPrice(netflix), 22500);
  assert.equal(getStartingPrice(custom), 0);
});

test('filterProducts filters by category, search query, and stock availability', () => {
  const streamingOnly = filterProducts(PRODUCTS, { category: 'streaming' });
  assert.equal(streamingOnly.every((p) => p.category === 'streaming'), true);

  const canvaSearch = filterProducts(PRODUCTS, { query: 'canva' });
  assert.equal(canvaSearch.length, 1);
  assert.equal(canvaSearch[0].id, 'canva-pro');

  const inStock = filterProducts(PRODUCTS, { inStockOnly: true });
  assert.equal(inStock.some((p) => p.outOfStock), false);
});

test('cart operations add, increment, decrement, remove, and compute auto discount', () => {
  let cart = [];
  cart = addToCart(cart, {
    productId: 'netflix-premium',
    productName: 'Netflix Premium',
    variantId: 'nf-1p1u',
    variantName: '1 Bulan - Sharing 1P1U',
    price: 30000,
  });
  cart = addToCart(cart, {
    productId: 'netflix-premium',
    productName: 'Netflix Premium',
    variantId: 'nf-1p1u',
    variantName: '1 Bulan - Sharing 1P1U',
    price: 30000,
  });
  assert.equal(cart.length, 1);
  assert.equal(cart[0].quantity, 2);

  const totals = calculateCartTotals(cart);
  assert.equal(totals.itemCount, 2);
  assert.equal(totals.subtotal, 60000);
  assert.equal(totals.qualifiesDiscount, true);
  assert.equal(totals.discount, 2000);
  assert.equal(totals.total, 58000);

  cart = updateCartQty(cart, 'netflix-premium', 'nf-1p1u', -1);
  assert.equal(cart[0].quantity, 1);
  const belowThreshold = calculateCartTotals(cart);
  assert.equal(belowThreshold.qualifiesDiscount, false);
  assert.equal(belowThreshold.discount, 0);
  assert.equal(belowThreshold.remainingForDiscount, 20000);

  cart = removeFromCart(cart, 'netflix-premium', 'nf-1p1u');
  assert.equal(cart.length, 0);
});

test('evaluateVoucher and Pay Later 10% surcharge compute accurately', () => {
  const validFixed = evaluateVoucher(' hemat2k ', 22500, VOUCHERS);
  assert.equal(validFixed.status, 'applied');
  assert.equal(validFixed.code, 'HEMAT2K');
  assert.equal(validFixed.discount, 2000);

  const usedResult = evaluateVoucher('HEMAT2K', 22500, VOUCHERS, ['HEMAT2K']);
  assert.equal(usedResult.status, 'used');
  assert.equal(usedResult.discount, 0);

  const ineligible = evaluateVoucher('MANIFEST5', 20000, VOUCHERS);
  assert.equal(ineligible.status, 'ineligible');
  assert.equal(ineligible.discount, 0);

  const unknown = evaluateVoucher('VIPADMIN', 30000, VOUCHERS);
  assert.equal(unknown.status, 'pending_admin');
  assert.equal(unknown.discount, 0);

  const cart = [
    {
      productId: 'netflix-premium',
      productName: 'Netflix Premium',
      variantId: 'nf-1p1u',
      variantName: '1 Bulan - Sharing 1P1U',
      price: 30000,
      quantity: 1,
    },
  ];
  const payLaterTotals = calculateCartTotals(cart, {
    voucherCode: 'HEMAT2K',
    vouchers: VOUCHERS,
    paymentOption: 'Bayar Belakangan (Setelah Akun Diterima)',
    payLaterRate: 0.1,
  });
  assert.equal(payLaterTotals.voucherDiscount, 2000);
  assert.equal(payLaterTotals.isPayLater, true);
  assert.equal(payLaterTotals.payLaterFee, 2800);
  assert.equal(payLaterTotals.total, 30800);
});

test('validateOrderForm and clean WhatsApp order template encode properly', () => {
  const emptyCheck = validateOrderForm({
    customerName: 'Tomi',
    paymentOption: 'Bayar Sekarang',
    cart: [],
  });
  assert.equal(emptyCheck.valid, false);

  const missingName = validateOrderForm({
    customerName: '  ',
    paymentOption: 'Bayar Sekarang',
    cart: [{ productId: 'a', variantId: 'b', price: 3000, quantity: 1 }],
  });
  assert.equal(missingName.valid, false);

  const cart = [
    {
      productId: 'canva-pro',
      productName: 'Canva Pro',
      variantId: 'canva-6m',
      variantName: '6 Bulan',
      price: 20000,
      quantity: 1,
    },
  ];
  const totals = calculateCartTotals(cart, {
    voucherCode: 'HEMAT2K',
    vouchers: VOUCHERS,
    paymentOption: 'Bayar Belakangan (Setelah Akun Diterima)',
    payLaterRate: 0.1,
  });
  const ok = validateOrderForm({
    customerName: 'Andi',
    paymentOption: 'Bayar Belakangan (Setelah Akun Diterima)',
    cart,
  });
  assert.equal(ok.valid, true);

  const caption = buildWhatsAppOrderCaption({
    orderCode: 'MS-261115-120000',
    customerName: 'Andi',
    whatsappNote: 'Email akun: andi@mail.com',
    paymentOption: 'Bayar Belakangan (Setelah Akun Diterima)',
    cart,
    totals,
  });
  assert.equal(caption.includes('*PESANAN BARU — MANIFESTUDIO*'), true);
  assert.equal(caption.includes('MS-261115-120000'), true);
  assert.equal(caption.includes('1. Canva Pro — 6 Bulan'), true);
  assert.equal(caption.includes('HEMAT2K'), true);
  assert.equal(caption.includes('Biaya Bayar Nanti (+10%)'), true);
  assert.equal(caption.includes('Diskon Belanja: -Rp0'), false);

  const encoded = buildWhatsAppOrderMessage({
    orderCode: 'MS-261115-120000',
    customerName: 'Andi',
    whatsappNote: 'Email akun: andi@mail.com',
    paymentOption: 'Bayar Belakangan (Setelah Akun Diterima)',
    cart,
    totals,
  });
  const decoded = decodeURIComponent(encoded);
  assert.equal(decoded.includes('Rp19.800'), true);
});

test('admin catalog helpers toggle stock and add or update products', () => {
  const base = getDefaultCatalogSnapshot();
  const toggled = toggleProductStockInCatalog(base, 'netflix-premium', true, 'Stok habis');
  const nf = toggled.products.find((p) => p.id === 'netflix-premium');
  assert.equal(nf.outOfStock, true);
  assert.equal(nf.variants.every((v) => v.outOfStock), true);

  const added = upsertProductInCatalog(toggled, {
    name: 'CapCut Pro',
    category: 'creative',
    summary: 'Editing video tanpa watermark',
    variants: [{ name: '1 Bulan Privat', price: 18000, outOfStock: false }],
  });
  const capcut = added.products.find((p) => p.id === 'capcut-pro');
  assert.ok(capcut);
  assert.equal(capcut.variants[0].price, 18000);
});

test('vault encrypts and decrypts credentials via AES-256-GCM and verifies GitHub permissions', async () => {
  const payload = {
    owner: 'owner-demo',
    repo: 'repo-demo',
    branch: 'main',
    token: 'ghp_CaseSensitiveToken123',
  };
  const encrypted = await encryptVault(payload, 'SandiRahasia99');
  assert.equal(encrypted.alg, 'AES-GCM-256');
  assert.equal(JSON.stringify(encrypted).includes('ghp_CaseSensitiveToken123'), false);

  const decrypted = await decryptVault(encrypted, 'SandiRahasia99');
  assert.deepEqual(decrypted, payload);

  await assert.rejects(() => decryptVault(encrypted, 'SandiSalah'), /Password brankas salah/);

  const readOnlyCheck = await verifyGitHubTokenAccess({
    owner: 'owner-demo',
    repo: 'repo-demo',
    token: 'tok-readonly',
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({ permissions: { push: false, pull: true } }),
    }),
  });
  assert.equal(readOnlyCheck.ok, false);

  const pushCheck = await verifyGitHubTokenAccess({
    owner: 'owner-demo',
    repo: 'repo-demo',
    token: 'tok-push',
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({ full_name: 'owner-demo/repo-demo', permissions: { push: true } }),
    }),
  });
  assert.equal(pushCheck.ok, true);
});

test('createOrderSnapshot produces serializable handoff payload for dedicated order page', () => {
  const cart = [
    {
      productId: 'canva-pro',
      productName: 'Canva Pro',
      variantId: 'canva-1m',
      variantName: '1 Bulan',
      price: 3000,
      quantity: 4,
    },
  ];
  const totals = calculateCartTotals(cart, {
    paymentOption: 'Bayar Belakangan (Setelah Akun Diterima)',
    payLaterRate: 0.1,
  });
  const snapshot = createOrderSnapshot({
    orderCode: 'MS-261115-210207',
    whatsappNumber: '6285122936027',
    customerName: 'Hhbb',
    whatsappNote: 'andi@mail.com',
    paymentOption: 'Bayar Belakangan (Setelah Akun Diterima)',
    cart,
    totals,
  });

  assert.equal(snapshot.orderCode, 'MS-261115-210207');
  assert.equal(snapshot.totals.total, 13200);
  assert.equal(snapshot.whatsappUrl.startsWith('https://wa.me/6285122936027?text='), true);
  const roundTrip = JSON.parse(JSON.stringify(snapshot));
  assert.equal(roundTrip.cart.length, 1);
  assert.equal(roundTrip.customerName, 'Hhbb');
});

test('product reordering moves items up, down, and to target index accurately', () => {
  const base = getDefaultCatalogSnapshot();
  const initialIds = base.products.map((p) => p.id);

  const movedDown = moveProductInCatalog(base, initialIds[0], 'down');
  assert.equal(movedDown.products[0].id, initialIds[1]);
  assert.equal(movedDown.products[1].id, initialIds[0]);

  const movedUp = moveProductInCatalog(movedDown, initialIds[0], 'up');
  assert.deepEqual(movedUp.products.map((p) => p.id), initialIds);

  const reordered = reorderProductToIndex(base, initialIds[0], 3);
  assert.equal(reordered.products[3].id, initialIds[0]);
  assert.equal(reordered.products[0].id, initialIds[1]);
});

test('extractManagedUploadLogoPath and collectOrphanedUploadLogos detect replaced uploaded files safely', () => {
  assert.equal(extractManagedUploadLogoPath('./assets/logos/netflix.svg'), null);
  assert.equal(extractManagedUploadLogoPath('https://example.com/logo.png'), null);
  assert.equal(
    extractManagedUploadLogoPath('./assets/logos/uploads/netflix-123.png'),
    'assets/logos/uploads/netflix-123.png'
  );

  const prev = [
    { id: 'a', logo: './assets/logos/uploads/a-old.png' },
    { id: 'b', logo: './assets/logos/uploads/shared.png' },
    { id: 'c', logo: './assets/logos/netflix.svg' },
  ];
  const next = [
    { id: 'a', logo: './assets/logos/uploads/a-new.png' },
    { id: 'b', logo: './assets/logos/uploads/shared.png' },
    { id: 'c', logo: './assets/logos/netflix.svg' },
  ];

  const orphaned = collectOrphanedUploadLogos(prev, next);
  assert.deepEqual(orphaned, ['assets/logos/uploads/a-old.png']);
});

test('getNextPrayerInfo and matchIndonesianCityQuery compute Kemenag schedule countdown and city matches', () => {
  const timings = {
    imsak: '04:05',
    subuh: '04:15',
    dzuhur: '11:45',
    ashar: '15:05',
    maghrib: '17:52',
    isya: '19:03',
  };
  const morning = new Date(2026, 10, 15, 10, 15, 0);
  const nextMorning = getNextPrayerInfo(timings, morning);
  assert.equal(nextMorning.key, 'dzuhur');
  assert.equal(nextMorning.countdownText, '01:30:00');
  assert.equal(nextMorning.allPassedToday, false);

  const lateNight = new Date(2026, 10, 15, 22, 0, 0);
  const nextTomorrow = getNextPrayerInfo(timings, lateNight);
  assert.equal(nextTomorrow.key, 'imsak');
  assert.equal(nextTomorrow.allPassedToday, true);

  const cities = [
    { id: '1301', lokasi: 'KOTA JAKARTA' },
    { id: '1219', lokasi: 'KOTA BANDUNG' },
    { id: '1414', lokasi: 'KAB. SLEMAN' },
  ];
  assert.equal(matchIndonesianCityQuery(cities, 'Kota Bandung')?.id, '1219');
  assert.equal(matchIndonesianCityQuery(cities, 'Sleman')?.id, '1414');
});

test('describeWeatherCode and convertWorldTime convert UTC, WIB, WITA, WIT, and international zones accurately', () => {
  assert.equal(describeWeatherCode(0, 1).label, 'Cerah');
  assert.equal(describeWeatherCode(95, 1).label, 'Hujan Disertai Petir');

  // 12:00 WIB (UTC+7) == 05:00 UTC == 13:00 WITA == 14:00 WIT == 14:00 Tokyo (UTC+9)
  const conv = convertWorldTime({
    dateStr: '2026-11-15',
    timeStr: '12:00',
    sourceTimeZone: 'Asia/Jakarta',
    targetTimeZone: 'Asia/Tokyo',
  });
  assert.equal(conv.utc.timeShort, '05:00');
  assert.equal(conv.wib.timeShort, '12:00');
  assert.equal(conv.wita.timeShort, '13:00');
  assert.equal(conv.wit.timeShort, '14:00');
  assert.equal(conv.target.timeShort, '14:00');
  assert.equal(conv.wib.offsetLabel, 'UTC+07:00');
});

test('orthographic globe projection and hit detection accurately project and locate target countries', () => {
  const proj = projectOrthographic(-6.21, 106.85, -6.21, 106.85, 150, 200, 200);
  assert.equal(proj.visible, true);
  assert.ok(Math.abs(proj.x - 200) < 1e-6);
  assert.ok(Math.abs(proj.y - 200) < 1e-6);

  const inv = inverseOrthographic(200, 200, -6.21, 106.85, 150, 200, 200);
  assert.ok(inv);
  assert.ok(Math.abs(inv.lat - -6.21) < 1e-4);
  assert.ok(Math.abs(inv.lon - 106.85) < 1e-4);

  const hit = findNearestLocationOnGlobe(200, 200, WORLD_LOCATIONS, -6.21, 106.85, 150, 200, 200, 24);
  assert.equal(hit?.location?.id, 'id-wib');
});

test('speedtest throughput, ping/jitter stats, gauge scaling, quality rating, and telemetry parser work accurately', () => {
  assert.equal(computeMbps(12_500_000, 1000), 100);
  assert.equal(computeMbps(0, 1000), 0);

  const pingStats = calculatePingStats([20, 26, 22, 24]);
  assert.equal(pingStats.minMs, 20);
  assert.equal(pingStats.maxMs, 26);
  assert.equal(pingStats.avgMs, 23);
  assert.equal(pingStats.jitterMs, 4);
  assert.equal(pingStats.sampleCount, 4);

  assert.equal(speedToGaugeRatio(0), 0);
  assert.equal(speedToGaugeRatio(1000), 1);
  assert.ok(speedToGaugeRatio(50) > 0.45 && speedToGaugeRatio(50) < 0.55);

  assert.equal(describeCloudflareColo('CGK'), 'Jakarta, Indonesia (CGK)');
  assert.equal(describeCloudflareColo('SIN'), 'Singapura (SIN)');

  const fast = evaluateConnectionQuality({ downloadMbps: 120, uploadMbps: 40, pingMs: 18, jitterMs: 4 });
  assert.equal(fast.grade, 'Sangat Cepat');
  assert.equal(fast.suitability.every((s) => s.ok), true);

  const slow = evaluateConnectionQuality({ downloadMbps: 4, uploadMbps: 1.5, pingMs: 140, jitterMs: 35 });
  assert.equal(slow.suitability.every((s) => !s.ok), true);

  const dev = parseDeviceTelemetry({
    userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/130.0 Mobile',
    hardwareConcurrency: 8,
    deviceMemory: 8,
    screenWidth: 390,
    screenHeight: 844,
    connection: { type: 'wifi', effectiveType: '4g', downlink: 42 },
  });
  assert.equal(dev.os, 'Android');
  assert.equal(dev.browser, 'Google Chrome');
  assert.equal(dev.deviceType, 'Mobile / HP');
  assert.equal(dev.cores, '8 Core');
  assert.equal(dev.memory, '8 GB RAM');
  assert.equal(dev.screenText, '390×844');
  assert.equal(dev.networkType, 'WIFI · 4G · ~42 Mbps');
});


