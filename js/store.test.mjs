import test from 'node:test';
import assert from 'node:assert/strict';
import { getDefaultCatalogSnapshot, PRODUCTS, VOUCHERS } from './data.js';
import {
  DEFAULT_UTILITY_CONFIG,
  MAX_HISTORY_LOGS,
  addToCart,
  appendCatalogHistory,
  applyOpenGraphToHtml,
  buildWhatsAppOrderCaption,
  buildWhatsAppOrderMessage,
  calculateCartTotals,
  collectOrphanedUploadLogos,
  createOrderSnapshot,
  deleteBannerFromCatalog,
  deleteCategoryFromCatalog,
  deleteFaqFromCatalog,
  deleteSocialFromCatalog,
  describeCatalogChanges,
  evaluateVoucher,
  extractManagedUploadLogoPath,
  filterProducts,
  formatRupiah,
  getProductCardTone,
  getStartingPrice,
  moveBannerInCatalog,
  moveProductInCatalog,
  normalizeBanners,
  normalizeBrandConfig,
  normalizeOpenGraphConfig,
  normalizeUtilityConfig,
  pruneCatalogHistory,
  removeFromCart,
  reorderProductToIndex,
  summarizeCatalogDiff,
  toggleProductStockInCatalog,
  updateCartQty,
  upsertBannerInCatalog,
  upsertCategoryInCatalog,
  upsertFaqInCatalog,
  upsertProductInCatalog,
  upsertSocialInCatalog,
  upsertUtilityItemInCatalog,
  validateOrderForm,
} from './store.js';
import {
  MIN_FULL_TRACK_SECONDS,
  MUSIC_LIBRARY_STORAGE_KEY,
  addTrackToPlaylist,
  clampMusicFabPosition,
  computeSafeResumeSeconds,
  createUserPlaylist,
  dedupeMatchingAltTracks,
  deleteUserPlaylist,
  extractYouTubeVideoId,
  extractStreamExpiryMs,
  filterFullLengthTracks,
  formatAudioTime,
  getPopoverAnchorClasses,
  getValidCachedStreamUrl,
  hasPendingSeekSettled,
  isBlockedAudioWrapperUrl,
  isInstantAudioPreviewUrl,
  isStrictAudioMatch,
  isStrictSongMetadataMatch,
  isTrackInWatchLater,
  needsCorsAnonymousAudio,
  normalizeItunesTrack,
  normalizeMusicLibraryState,
  normalizeMusicMode,
  normalizeRepeatMode,
  normalizeYtMusicTrack,
  parseDurationSeconds,
  parseSavedVolume,
  pickPrewarmQueueCandidates,
  pickShuffledViralTrack,
  pruneAndSerializeStreamCache,
  rankSearchResults,
  removeTrackFromPlaylist,
  renameUserPlaylist,
  resolvePipHeadsetStateTransition,
  scoreSearchRelevance,
  selectUmmyAudioStreamCandidates,
  shouldAutoSkipOnPlaybackError,
  shouldIgnoreTimeUpdateDuringPendingSeek,
  shouldStopSilentHoldAndPauseNotification,
  shuffleTracksFisherYates,
  toggleTrackInWatchLater,
} from './music-logic.js';
import {
  decryptVault,
  encryptVault,
  verifyGitHubTokenAccess,
} from './vault.js';
import {
  COMPRESSION_METHODS,
  COMPRESSION_PLATFORM_PRESETS,
  WORLD_LOCATIONS,
  calculatePingStats,
  computeMbps,
  computeSustainedAverageMbps,
  convertWorldTime,
  describeCloudflareColo,
  describeWeatherCode,
  detectDownloaderContentType,
  detectDownloaderPlatform,
  evaluateConnectionQuality,
  findNearestLocationOnGlobe,
  formatBytes,
  formatDetailedLocationLabel,
  getNextPrayerInfo,
  inverseOrthographic,
  isBlockedRedirectDownloadUrl,
  isIndonesiaLocation,
  matchIndonesianCityQuery,
  normalizeDownloaderResult,
  parseDeviceTelemetry,
  parseIndonesianAddressHierarchy,
  parseYouTubeVideoId,
  planMediaCompression,
  projectOrthographic,
  resolveAccurateWeatherCondition,
  speedToGaugeRatio,
  wrapCorsMediaProxyIfNeeded,
} from './tools-logic.js';
import {
  stripJpegExifLossless,
  stripMp4AtomsLossless,
  stripPngChunksLossless,
} from './compressor.js';

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
  assert.equal(unknown.status, 'invalid');
  assert.equal(unknown.discount, 0);
  assert.equal(unknown.message.includes('tidak valid'), true);

  // Configurable voucher usage limits: once, limited (N times), and unlimited
  const limitVouchers = [
    { code: 'SATUKALI', type: 'fixed', value: 2000, minSubtotal: 10000, usageMode: 'once', maxUses: 1 },
    { code: 'TIGAKALI', type: 'fixed', value: 2500, minSubtotal: 10000, usageMode: 'limited', maxUses: 3 },
    { code: 'UNLIMITED', type: 'percent', value: 10, minSubtotal: 10000, usageMode: 'unlimited', maxUses: 0 },
  ];
  assert.equal(evaluateVoucher('SATUKALI', 25000, limitVouchers, { SATUKALI: 1 }).status, 'used');
  const limit2of3 = evaluateVoucher('TIGAKALI', 25000, limitVouchers, { TIGAKALI: 2 });
  assert.equal(limit2of3.status, 'applied');
  assert.equal(limit2of3.message.includes('Sisa 1x pakai'), true);
  assert.equal(evaluateVoucher('TIGAKALI', 25000, limitVouchers, { TIGAKALI: 3 }).status, 'used');
  assert.equal(evaluateVoucher('UNLIMITED', 25000, limitVouchers, { UNLIMITED: 99 }).status, 'applied');

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

  // Invalid voucher must NOT appear as "Menunggu Cek Admin" in WhatsApp caption
  const invalidTotals = calculateCartTotals(cart, {
    voucherCode: 'ASALASALAN99',
    vouchers: VOUCHERS,
    paymentOption: 'Bayar Sekarang',
  });
  assert.equal(invalidTotals.voucherStatus, 'invalid');
  assert.equal(invalidTotals.voucherDiscount, 0);
  const cleanWa = buildWhatsAppOrderCaption({
    orderCode: 'MS-261116-100000',
    customerName: 'Budi',
    paymentOption: 'Bayar Sekarang',
    cart,
    totals: invalidTotals,
  });
  assert.equal(cleanWa.includes('ASALASALAN99'), false);
  assert.equal(cleanWa.includes('Cek Admin'), false);
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

test('catalog history records snapshots, summarizes diffs, and auto-prunes old logs past MAX_HISTORY_LOGS', () => {
  const base = getDefaultCatalogSnapshot();
  const modified = structuredClone(base);
  modified.products[0].name = 'Netflix UHD Pro';

  const summary = summarizeCatalogDiff(base, modified);
  assert.equal(summary.includes('Mengubah nama produk Netflix Premium menjadi Netflix UHD Pro'), true);

  let logs = [];
  for (let i = 0; i < MAX_HISTORY_LOGS + 5; i += 1) {
    const snap = structuredClone(base);
    snap.products[0].name = `Version ${i + 1}`;
    logs = appendCatalogHistory(
      logs,
      {
        id: `log-${i + 1}`,
        createdAt: new Date(2026, 10, 15, 10, i, 0).toISOString(),
        action: 'publish',
        summary: `Update ${i + 1}`,
        details: [`Mengubah versi ke ${i + 1}`],
        snapshot: snap,
      },
      MAX_HISTORY_LOGS
    );
  }

  assert.equal(logs.length, MAX_HISTORY_LOGS);
  assert.equal(logs[0].id, `log-${MAX_HISTORY_LOGS + 5}`);
  assert.equal(Array.isArray(logs[0].details), true);
  assert.equal(logs.some((l) => l.id === 'log-1'), false);

  const customPruned = pruneCatalogHistory(logs, 3);
  assert.equal(customPruned.length, 3);
  assert.equal(getProductCardTone(0) !== getProductCardTone(1), true);
  assert.equal(getProductCardTone(6), 0);
});

test('YT Music player picks purely shuffled tracks prioritizing Viral Indonesia without search-history bias', () => {
  const mixedCatalog = [
    normalizeYtMusicTrack({
      videoId: 'En-EHqRk8yg',
      title: 'Garam & Madu (Sakit Dadaku)',
      artist: 'Tenxi - Topic',
      duration: 185,
      isIndonesianViral: true,
    }),
    normalizeYtMusicTrack({
      videoId: 'hc-8aB0Dkkw',
      title: 'Untungnya, Hidup Harus Tetap Berjalan',
      artist: 'Bernadya - Topic',
      duration: 183,
      isIndonesianViral: true,
    }),
    normalizeYtMusicTrack({
      videoId: 'Zq1Jg0H5fzc',
      title: 'everything u are',
      artist: 'Hindia - Topic',
      duration: 237,
      isIndonesianViral: true,
    }),
    normalizeYtMusicTrack({
      videoId: 'dQw4w9WgXcQ',
      title: 'Global Pop Song',
      artist: 'Artist Global',
      duration: 213,
      isIndonesianViral: false,
    }),
  ];

  // Artist suffix "- Topic" is cleaned cleanly and IDs extracted properly
  assert.equal(mixedCatalog[0].artist, 'Tenxi');
  assert.equal(mixedCatalog[0].id, 'yt-En-EHqRk8yg');

  // Even over multiple deterministic RNG slices, Indonesian Viral tracks are always prioritized over non-viral tracks
  for (let i = 0; i < 6; i += 1) {
    const pick = pickShuffledViralTrack(mixedCatalog, {
      currentTrackId: 'yt-En-EHqRk8yg',
      prioritizeIndonesianViral: true,
      rng: () => i / 6,
    });
    assert.ok(pick);
    assert.notEqual(pick.id, 'yt-En-EHqRk8yg');
    assert.equal(pick.isIndonesianViral, true);
  }

  // Recent track IDs are avoided while other viral tracks exist
  const freshPick = pickShuffledViralTrack(mixedCatalog, {
    currentTrackId: 'yt-En-EHqRk8yg',
    recentTrackIds: ['yt-hc-8aB0Dkkw'],
    prioritizeIndonesianViral: true,
    rng: () => 0.1,
  });
  assert.equal(freshPick?.id, 'yt-Zq1Jg0H5fzc');

  // Uniform Fisher-Yates shuffle produces all unique elements without dropping any
  const shuffled = shuffleTracksFisherYates(mixedCatalog, () => 0.35);
  assert.equal(shuffled.length, mixedCatalog.length);
  assert.equal(formatAudioTime(125), '02:05');
});

test('music player clamps draggable FAB position & popover viewport offsets cleanly', () => {
  const clampedTopLeft = clampMusicFabPosition({
    x: -50,
    y: -25,
    viewportWidth: 390,
    viewportHeight: 844,
    fabSize: 40,
    margin: 10,
  });
  assert.deepEqual(clampedTopLeft, { x: 10, y: 10 });

  const clampedBottomRight = clampMusicFabPosition({
    x: 9999,
    y: 9999,
    viewportWidth: 1440,
    viewportHeight: 900,
    fabSize: 44,
    margin: 10,
  });
  assert.deepEqual(clampedBottomRight, { x: 1386, y: 846 });

  const topRightAnchor = getPopoverAnchorClasses({
    x: 1386,
    y: 12,
    viewportWidth: 1440,
    viewportHeight: 900,
    fabSize: 44,
  });
  assert.equal(topRightAnchor.horizontal, 'align-right');
  assert.equal(topRightAnchor.vertical, 'open-down');
  assert.ok(1386 + topRightAnchor.offsetX + 316 <= 1440 - 16);

  const mobileCenterAnchor = getPopoverAnchorClasses({
    x: 175,
    y: 700,
    viewportWidth: 390,
    viewportHeight: 844,
    fabSize: 40,
  });
  assert.equal(mobileCenterAnchor.vertical, 'open-up');
  const popLeft = 175 + mobileCenterAnchor.offsetX;
  const popWidth = Math.min(316, 390 - 32);
  assert.ok(popLeft >= 16);
  assert.ok(popLeft + popWidth <= 390 - 16);
});

test('YT Music normalizer extracts video IDs, parses MM:SS durations, and enforces full-length tracks (>=75s)', () => {
  assert.equal(extractYouTubeVideoId('/watch?v=En-EHqRk8yg'), 'En-EHqRk8yg');
  assert.equal(extractYouTubeVideoId('https://music.youtube.com/watch?v=mGVLxyJwDYk&si=xyz'), 'mGVLxyJwDYk');
  assert.equal(extractYouTubeVideoId('https://youtu.be/Zq1Jg0H5fzc'), 'Zq1Jg0H5fzc');
  assert.equal(parseDurationSeconds('03:45'), 225);
  assert.equal(parseDurationSeconds('1:02:03'), 3723);

  const mixed = [
    normalizeYtMusicTrack({ videoId: 'short000001', title: 'Clip 30s', artist: 'Preview', duration: 30 }),
    normalizeYtMusicTrack({ videoId: 'En-EHqRk8yg', title: 'Garam & Madu', artist: 'Tenxi', duration: 185, isIndonesianViral: true }),
    normalizeYtMusicTrack({ videoId: 'hc-8aB0Dkkw', title: 'Untungnya', artist: 'Bernadya', duration: 183, isIndonesianViral: true }),
  ];

  const fullOnly = filterFullLengthTracks(mixed, MIN_FULL_TRACK_SECONDS);
  assert.equal(fullOnly.length, 2);
  assert.equal(fullOnly.some((t) => t.videoId === 'short000001'), false);

  for (let i = 0; i < 6; i += 1) {
    const pick = pickShuffledViralTrack(mixed, { rng: () => i / 10 });
    assert.notEqual(pick?.videoId, 'short000001');
    assert.ok((pick?.duration || 0) >= MIN_FULL_TRACK_SECONDS);
  }

  assert.equal(normalizeMusicMode('unknown'), 'yt-music');
  assert.equal(normalizeRepeatMode('ONE'), 'one');
  assert.equal(normalizeRepeatMode('invalid'), 'all');
});

test('social video downloader detects TikTok/YouTube/Instagram/Facebook URLs and normalizes no-watermark links', () => {
  assert.equal(detectDownloaderPlatform('https://vt.tiktok.com/ZSY123abc/'), 'tiktok');
  assert.equal(detectDownloaderPlatform('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'youtube');
  assert.equal(detectDownloaderPlatform('https://youtu.be/dQw4w9WgXcQ'), 'youtube');
  assert.equal(detectDownloaderPlatform('https://www.instagram.com/reel/C9abc123/'), 'instagram');
  assert.equal(detectDownloaderPlatform('https://fb.watch/abcd1234/'), 'facebook');
  assert.equal(detectDownloaderPlatform('https://example.com/file.mp4'), null);

  const tikwmNormalized = normalizeDownloaderResult(
    {
      code: 0,
      data: {
        title: 'Konten Viral 2026',
        duration: 42,
        cover: 'https://cdn.example/cover.jpg',
        author: { nickname: 'CreatorID' },
        hdplay: 'https://cdn.example/hd-nowm.mp4',
        play: 'https://cdn.example/sd-nowm.mp4',
        wmplay: 'https://cdn.example/watermarked.mp4',
        music: 'https://cdn.example/sound.mp3',
      },
    },
    'tiktok'
  );
  assert.equal(tikwmNormalized.platform, 'tiktok');
  assert.equal(tikwmNormalized.links.length, 3);
  assert.equal(
    tikwmNormalized.links.some((l) => l.url.includes('watermarked')),
    false
  );

  const ytNormalized = normalizeDownloaderResult(
    {
      mp4: {
        result: {
          title: 'Lagu Full Indo',
          thumbnail: 'https://i.ytimg.com/vi/abc/hq.jpg',
          quality: '720p',
          download_url: 'https://cdn.yt/video.mp4',
        },
      },
      mp3: {
        result: {
          title: 'Lagu Full Indo',
          quality: '128kbps',
          download_url: 'https://cdn.yt/audio.mp3',
        },
      },
    },
    'youtube'
  );
  assert.equal(ytNormalized.platform, 'youtube');
  assert.equal(ytNormalized.links.length, 2);
  assert.equal(ytNormalized.links[0].ext, 'mp4');
  assert.equal(ytNormalized.links[1].ext, 'mp3');

  const fbNormalized = normalizeDownloaderResult(
    {
      result: {
        title: 'Clip FB',
        thumbnail: 'https://cdn.fb/thumb.jpg',
        downloads: {
          hd: { url: 'https://cdn.fb/hd.mp4' },
          sd: { url: 'https://cdn.fb/sd.mp4' },
        },
      },
    },
    'facebook'
  );
  assert.equal(fbNormalized.links.length, 2);

  const igNormalized = normalizeDownloaderResult(
    {
      result: [
        { downloadUrl: 'https://cdn.ig/reel.mp4', thumbnail: 'https://cdn.ig/t.jpg', type: 'video' },
      ],
    },
    'instagram'
  );
  assert.equal(igNormalized.links.length, 1);
  assert.equal(igNormalized.links[0].ext, 'mp4');
});

test('Indonesian sub-district parser extracts Kelurahan, Kecamatan, Kota, and formats labels cleanly', () => {
  const parsed = parseIndonesianAddressHierarchy({
    nominatim: {
      address: {
        village: 'Braga',
        district: 'Sumur Bandung',
        city: 'Kota Bandung',
        state: 'Jawa Barat',
        country: 'Indonesia',
      },
    },
    bigdatacloud: {
      locality: 'Sumur Bandung',
      city: 'Kota Bandung',
      principalSubdivision: 'Jawa Barat',
      countryName: 'Indonesia',
    },
  });

  assert.equal(parsed.kelurahan, 'Braga');
  assert.equal(parsed.kecamatan, 'Sumur Bandung');
  assert.equal(parsed.city, 'Kota Bandung');
  assert.equal(parsed.region, 'Jawa Barat');
  assert.equal(
    formatDetailedLocationLabel(parsed),
    'Kel. Braga, Kec. Sumur Bandung, Kota Bandung'
  );

  // Deduplicates when kelurahan === kecamatan and skips RT/RW noise
  const deduped = parseIndonesianAddressHierarchy({
    nominatim: {
      address: {
        neighbourhood: 'RW 04',
        suburb: 'Gambir',
        district: 'Gambir',
        city: 'Jakarta Pusat',
        state: 'DKI Jakarta',
      },
    },
  });
  assert.equal(deduped.kelurahan, '');
  assert.equal(deduped.kecamatan, 'Gambir');
  assert.equal(formatDetailedLocationLabel(deduped), 'Kec. Gambir, Jakarta Pusat');

  assert.equal(isIndonesiaLocation({ country: 'Indonesia' }), true);
  assert.equal(isIndonesiaLocation({ lat: -6.9175, lon: 107.6191 }), true);
  assert.equal(isIndonesiaLocation({ country: 'Japan', lat: 35.68, lon: 139.69 }), false);
});

test('computeSustainedAverageMbps discards warmup burst and returns byte-weighted sustained average rather than peak', () => {
  // Stage 0 warmup burst: 100 Mbps tiny payload; Stage 1 & 2 steady sustained: 20 Mbps total
  const avg = computeSustainedAverageMbps({
    stages: [
      { bytes: 250_000, durationMs: 20, mbps: 100 }, // tiny warmup burst = 100 Mbps
      { bytes: 2_500_000, durationMs: 1000, mbps: 20 },
      { bytes: 5_000_000, durationMs: 2000, mbps: 20 },
    ],
  });
  // Must reflect sustained average (20 Mbps), NOT peak burst (100 Mbps)
  assert.equal(avg, 20);

  // Sample-based trimmed mean when stages unavailable
  const sampleAvg = computeSustainedAverageMbps({
    samples: [5, 22, 24, 25, 23, 21, 95],
  });
  assert.ok(sampleAvg > 20 && sampleAvg < 26);
});

test('downloader blocks redirect landing pages and normalizes Cobalt & Tioo direct streams', () => {
  assert.equal(isBlockedRedirectDownloadUrl('https://ytshortdown.com/download?v=123'), true);
  assert.equal(isBlockedRedirectDownloadUrl('https://cdn402.savetube.vip/dl'), true);
  assert.equal(isBlockedRedirectDownloadUrl('https://example.com/landing.html'), true);
  assert.equal(isBlockedRedirectDownloadUrl('https://cobaltapi.cjs.nz/tunnel?id=abc'), false);

  const ytWithBlockedMp3 = normalizeDownloaderResult(
    {
      oembed: {
        title: 'Hindia - Evaluasi',
        author_name: 'Hindia',
        thumbnail_url: 'https://i.ytimg.com/vi/abc/hq.jpg',
      },
      cobaltVideo: {
        status: 'tunnel',
        url: 'https://cobaltapi.cjs.nz/tunnel?id=vid1',
        filename: 'Hindia - Evaluasi (720p).mp4',
      },
      cobaltAudio: {
        status: 'tunnel',
        url: 'https://cobaltapi.cjs.nz/tunnel?id=aud1',
        filename: 'Hindia - Evaluasi.mp3',
      },
      mp3: {
        result: {
          download_url: 'https://cdn401.savetube.vip/media/fake-redirect',
        },
      },
    },
    'youtube'
  );
  assert.equal(ytWithBlockedMp3.links.length, 2);
  assert.equal(ytWithBlockedMp3.links[0].url, 'https://cobaltapi.cjs.nz/tunnel?id=vid1');
  assert.equal(ytWithBlockedMp3.links[1].url, 'https://cobaltapi.cjs.nz/tunnel?id=aud1');
  assert.equal(ytWithBlockedMp3.links[1].isAudio, true);
  assert.equal(ytWithBlockedMp3.links[1].ext, 'mp3');

  // When only blocked redirect URL exists, should filter it out completely
  const ytOnlyBlocked = normalizeDownloaderResult(
    {
      mp3: { result: { download_url: 'https://ytshortdown.com/abc' } },
    },
    'youtube'
  );
  assert.equal(ytOnlyBlocked, null);

  // Cobalt IG picker carousel & Tioo IG payload
  const igCobalt = normalizeDownloaderResult(
    {
      status: 'picker',
      picker: [
        { type: 'video', url: 'https://cobaltapi.cjs.nz/tunnel?id=ig1', thumb: 'https://t.jpg' },
        { type: 'photo', url: 'https://cobaltapi.cjs.nz/tunnel?id=ig2' },
      ],
    },
    'instagram'
  );
  assert.equal(igCobalt.links.length, 2);
  assert.equal(igCobalt.links[0].ext, 'mp4');
  assert.equal(igCobalt.links[1].ext, 'jpg');
});

test('music search relevance ranking puts genuine title/artist matches first and rejects unrelated random songs', () => {
  const catalog = [
    {
      id: 'unrelated-viral',
      title: 'DJ Jedag Jedug Viral 2026',
      artist: 'DJ Remix Indo',
      genre: 'Indo Viral',
      isIndonesianViral: true,
      duration: 210,
      streamUrl: 'https://cdn.example/viral.mp3',
    },
    {
      id: 'bernadya-short',
      title: 'Satu Bulan Parody Shorts',
      artist: 'Someone',
      duration: 35,
      streamUrl: 'https://cdn.example/short.mp3',
    },
    {
      id: 'bernadya-exact',
      title: 'Satu Bulan',
      artist: 'Bernadya',
      genre: 'Pop Indo',
      duration: 204,
      streamUrl: 'https://cdn.example/satubulan.mp3',
    },
    {
      id: 'bernadya-cover',
      title: 'Satu Bulan (Acoustic Cover)',
      artist: 'Acoustic ID',
      genre: 'Acoustic',
      duration: 195,
      streamUrl: 'https://cdn.example/cover.mp3',
    },
  ];

  const ranked = rankSearchResults(catalog, 'Bernadya Satu Bulan');
  assert.equal(ranked.length, 2);
  assert.equal(ranked[0].id, 'bernadya-exact');
  assert.equal(ranked.some((t) => t.id === 'unrelated-viral'), false);

  // Completely unmatched query must return empty instead of hallucinating a viral track
  const noMatch = rankSearchResults(catalog, 'xyznonexistentsong999');
  assert.deepEqual(noMatch, []);

  assert.equal(scoreSearchRelevance(catalog[0], 'Bernadya Satu Bulan'), 0);
  const exactScore = scoreSearchRelevance(catalog[2], 'Bernadya Satu Bulan');
  const coverScore = scoreSearchRelevance(catalog[3], 'Bernadya Satu Bulan');
  assert.ok(exactScore > 40 && exactScore > coverScore);
});

test('describeCatalogChanges records itemized sub-product, price, logo, fee, category, social, and FAQ actions', () => {
  const prev = getDefaultCatalogSnapshot();
  const next = structuredClone(prev);

  // 1. Delete a sub-product on Spotify
  const spotify = next.products.find((p) => p.id === 'spotify-premium');
  spotify.variants = spotify.variants.filter((v) => v.id !== 'sp-3m-ng');

  // 2. Change price of Canva Pro 1 Bulan from 3000 to 7000
  const canva = next.products.find((p) => p.id === 'canva-pro');
  canva.variants[0].price = 7000;

  // 3. Change logo of Netflix Premium
  const netflix = next.products.find((p) => p.id === 'netflix-premium');
  netflix.logo = './assets/logos/uploads/netflix-custom.png';

  // 4. Add a sub-product to Netflix Premium
  netflix.variants.push({
    id: 'nf-3m',
    name: '3 Bulan - Private',
    price: 350000,
    outOfStock: false,
  });

  // 5. Change service fee
  next.brand.payLaterSurchargeRate = 0.05;
  next.brand.serviceFeeFlat = 1500;

  // 6. Change tagline via Admin Panel
  next.brand.tagline = 'Official Store by Tomy';

  const details = describeCatalogChanges(prev, next);
  assert.equal(prev.brand.tagline, 'by Tomy');
  assert.equal(normalizeBrandConfig(next.brand).tagline, 'Official Store by Tomy');
  assert.equal(
    details.includes('Mengubah tulisan tagline header menjadi "Official Store by Tomy"'),
    true
  );
  assert.equal(
    details.some((d) => d.includes('Menghapus sub produk Spotify Premium')),
    true
  );
  assert.equal(
    details.some((d) =>
      d.includes('Mengubah harga Canva Pro (1 Bulan) dari Rp3.000 menjadi Rp7.000')
    ),
    true
  );
  assert.equal(details.includes('Mengubah logo Netflix Premium'), true);
  assert.equal(
    details.some((d) =>
      d.includes('Menambah sub produk Netflix Premium — 3 Bulan - Private (Rp350.000)')
    ),
    true
  );
  assert.equal(
    details.includes('Mengubah biaya layanan Bayar Nanti dari 10% menjadi 5%'),
    true
  );
  assert.equal(
    details.some((d) => d.toLowerCase().includes('tetap dari rp0 menjadi rp1.500')),
    true
  );
});

test('custom service fee, custom categories, social media logos, and FAQ helpers work end-to-end', () => {
  const cart = [
    {
      productId: 'canva-pro',
      productName: 'Canva Pro',
      variantId: 'canva-1m',
      variantName: '1 Bulan',
      price: 10000,
      quantity: 1,
    },
  ];
  const totals = calculateCartTotals(cart, {
    paymentOption: 'Bayar Belakangan (+5%)',
    payLaterRate: 0.05,
    serviceFeeFlat: 1500,
    serviceFeeLabel: 'Biaya Admin',
  });
  assert.equal(totals.serviceFeeFlat, 1500);
  assert.equal(totals.serviceFeeLabel, 'Biaya Admin');
  assert.equal(totals.payLaterPercent, 5);
  assert.equal(totals.payLaterFee, 500);
  assert.equal(totals.total, 12000);

  const caption = buildWhatsAppOrderCaption({
    orderCode: 'MS-261116-010000',
    customerName: 'Tomy',
    paymentOption: 'Bayar Belakangan (+5%)',
    cart,
    totals,
  });
  assert.equal(caption.includes('Biaya Admin: +Rp1.500'), true);
  assert.equal(caption.includes('Biaya Bayar Nanti (+5%): +Rp500'), true);

  let catalog = getDefaultCatalogSnapshot();
  catalog = upsertCategoryInCatalog(catalog, { label: 'AI & Produktivitas' });
  assert.equal(
    catalog.categories.some((c) => c.id === 'ai-produktivitas' && c.label === 'AI & Produktivitas'),
    true
  );
  catalog = deleteCategoryFromCatalog(catalog, 'ai-produktivitas');
  assert.equal(catalog.categories.some((c) => c.id === 'ai-produktivitas'), false);

  catalog = upsertFaqInCatalog(catalog, {
    question: 'Apakah ada garansi penuh?',
    answer: 'Ya, garansi penuh sesuai durasi paket.',
  });
  const addedFaqIdx = catalog.faqItems.findIndex((f) => f.question === 'Apakah ada garansi penuh?');
  assert.ok(addedFaqIdx >= 0);
  catalog = deleteFaqFromCatalog(catalog, addedFaqIdx);
  assert.equal(catalog.faqItems.some((f) => f.question === 'Apakah ada garansi penuh?'), false);

  catalog = upsertSocialInCatalog(catalog, {
    platform: 'telegram',
    label: 'Telegram Official',
    handle: '@manifestudio',
    url: 'https://t.me/manifestudio',
    logo: './assets/icons/social-telegram.svg',
  });
  const addedSoc = catalog.brand.socials.find((s) => s.label === 'Telegram Official');
  assert.ok(addedSoc);
  assert.equal(addedSoc.logo, './assets/icons/social-telegram.svg');
  catalog = deleteSocialFromCatalog(catalog, addedSoc.id);
  assert.equal(catalog.brand.socials.some((s) => s.id === addedSoc.id), false);
});

test('OpenGraph config normalizes and applyOpenGraphToHtml updates title, og:image, og:description, and JSON-LD', () => {
  const og = normalizeOpenGraphConfig({
    openGraph: {
      title: 'Manifestudio Official Store',
      tagline: 'Premium Account by Tomy',
      description: 'Beli akun Netflix, Canva, dan Spotify bergaransi penuh.',
      image: './assets/logos/uploads/og-custom.jpg',
      imageAlt: 'Banner OG Manifestudio',
      siteName: 'Manifestudio ID',
    },
  });
  assert.equal(og.title, 'Manifestudio Official Store');
  assert.equal(og.tagline, 'Premium Account by Tomy');

  const sampleHtml = `<!doctype html>
<html>
<head>
  <title>Old Title</title>
  <meta name="description" content="Old desc" />
  <meta property="og:title" content="Old OG Title" />
  <meta property="og:description" content="Old OG Desc" />
  <meta property="og:image" content="https://manifestudio.my.id/assets/og-manifestudio.jpg?v=3" />
  <meta property="og:image:secure_url" content="https://manifestudio.my.id/assets/og-manifestudio.jpg?v=3" />
  <meta property="og:image:alt" content="Old Alt" />
  <meta property="og:site_name" content="Manifestudio" />
  <meta name="twitter:title" content="Old Tw" />
  <meta name="twitter:description" content="Old Tw Desc" />
  <meta name="twitter:image" content="https://manifestudio.my.id/assets/og-manifestudio.jpg?v=3" />
  <script type="application/ld+json">{"description": "Old", "image": "https://old"}</script>
</head>
</html>`;

  const updatedHtml = applyOpenGraphToHtml(sampleHtml, og, { name: 'Manifestudio' });
  assert.equal(
    updatedHtml.includes('<title>Manifestudio Official Store (Premium Account by Tomy)</title>'),
    true
  );
  assert.equal(
    updatedHtml.includes('https://manifestudio.my.id/assets/logos/uploads/og-custom.jpg'),
    true
  );
  assert.equal(
    updatedHtml.includes('Beli akun Netflix, Canva, dan Spotify bergaransi penuh.'),
    true
  );
  assert.equal(updatedHtml.includes('content="Manifestudio ID"'), true);
});

test('Multi-banner carousel CRUD adds, edits, reorders, deletes, and logs banner & OpenGraph changes', () => {
  let catalog = getDefaultCatalogSnapshot();
  const initialCount = catalog.banners.length;
  assert.ok(initialCount >= 6);

  catalog = upsertBannerInCatalog(catalog, {
    kicker: 'Promo Spesial',
    heading: 'Diskon Bundling Streaming',
    sub: 'Hemat hingga Rp10.000 untuk pembelian paket bundling.',
    ctaLabel: 'Lihat Promo',
    href: '#katalog',
    image: './assets/logos/uploads/banner-promo.jpg',
    scrim: 'scrim-katalog',
  });
  assert.equal(catalog.banners.length, initialCount + 1);
  const addedBanner = catalog.banners[catalog.banners.length - 1];
  assert.equal(addedBanner.heading, 'Diskon Bundling Streaming');

  catalog = moveBannerInCatalog(catalog, addedBanner.id, 'up');
  assert.equal(catalog.banners[catalog.banners.length - 2].id, addedBanner.id);

  const prev = getDefaultCatalogSnapshot();
  const diffDetails = describeCatalogChanges(prev, catalog);
  assert.equal(
    diffDetails.some((d) => d.includes('Menambah banner baru "Diskon Bundling Streaming"')),
    true
  );

  catalog = deleteBannerFromCatalog(catalog, addedBanner.id);
  assert.equal(catalog.banners.length, initialCount);
  assert.ok(normalizeBanners([]).length >= 6);
});

test('resolveAccurateWeatherCondition detects heavy rain downpours, station rain, and manual calibration accurately', () => {
  // Scenario 1: Open-Meteo weather_code says 61 (Hujan Ringan), but convective showers/hourly peak is 8.5 mm/h
  const downpour = resolveAccurateWeatherCondition({
    current: {
      weather_code: 61,
      is_day: 1,
      precipitation: 1.2,
      rain: 1.2,
      showers: 6.8,
      wind_speed_10m: 22,
      wind_gusts_10m: 38,
    },
    hourly: {
      time: ['2026-11-16T07:00', '2026-11-16T08:00'],
      precipitation: [8.5, 4.2],
      precipitation_probability: [92, 85],
      weather_code: [65, 63],
    },
    nowIso: '2026-11-16T07:15',
  });
  assert.equal(downpour.code >= 65, true);
  assert.equal(downpour.label.includes('Hujan Lebat'), true);
  assert.equal(downpour.effectiveRainMm, 8.5);

  // Scenario 2: Live nearby weather station reports heavy rain (16 mm) even if grid model was cloudy
  const stationHeavy = resolveAccurateWeatherCondition({
    current: { weather_code: 3, is_day: 1, precipitation: 0.4 },
    stationObs: { precipMM: 16.2, weatherDesc: 'Heavy rain shower' },
  });
  assert.equal(stationHeavy.label.includes('Sangat Lebat'), true);

  // Scenario 3: Manual user calibration override
  const calibrated = resolveAccurateWeatherCondition({
    current: { weather_code: 2, is_day: 1, precipitation: 0 },
    manualCalibration: 'heavy-rain',
  });
  assert.equal(calibrated.isCalibrated, true);
  assert.equal(calibrated.label.includes('Hujan Lebat'), true);
});

test('social media downloader normalizes single-photo posts, multi-photo carousels, stories, and captions', () => {
  const storyType = detectDownloaderContentType('https://www.instagram.com/stories/tmctomystudio/35019283/');
  assert.equal(storyType.platform, 'instagram');
  assert.equal(storyType.isStory, true);

  // TikTok Photo Mode Carousel (d.images) + Caption
  const tiktokCarousel = normalizeDownloaderResult(
    {
      data: {
        title: 'Slide Promo Akun Premium 2026 #manifestudio #fyp',
        author: { nickname: 'tmctomystudio' },
        images: [
          'https://cdn.tikwm.com/photo1.jpeg',
          'https://cdn.tikwm.com/photo2.jpeg',
          'https://cdn.tikwm.com/photo3.jpeg',
        ],
        music: 'https://cdn.tikwm.com/bgm.mp3',
      },
    },
    'tiktok',
    'https://www.tiktok.com/@tmctomystudio/photo/74123456789'
  );
  assert.equal(tiktokCarousel.mediaType, 'carousel');
  assert.equal(tiktokCarousel.photos.length, 3);
  assert.equal(
    tiktokCarousel.caption,
    'Slide Promo Akun Premium 2026 #manifestudio #fyp'
  );
  assert.equal(
    tiktokCarousel.links.some((l) => l.isImage && l.ext === 'jpg'),
    true
  );

  // Instagram Story with photo & video
  const igStory = normalizeDownloaderResult(
    {
      caption: 'Story Promo Hari Ini!',
      username: 'tmctomystudio',
      result: [
        { url: 'https://scontent.cdninstagram.com/story-photo.jpg?stp=dst-jpg', type: 'image' },
      ],
    },
    'instagram',
    'https://www.instagram.com/stories/tmctomystudio/123456/'
  );
  assert.equal(igStory.isStory, true);
  assert.equal(igStory.photos.length, 1);
  assert.equal(igStory.caption, 'Story Promo Hari Ini!');
});

test('HD media compression planner & binary lossless strippers preserve bitstreams and plan optimal dimensions', () => {
  assert.equal(COMPRESSION_METHODS.length, 4);
  assert.equal(COMPRESSION_PLATFORM_PRESETS.length, 4);
  assert.equal(formatBytes(1572864), '1.5 MB');

  const plan = planMediaCompression({
    mediaKind: 'image',
    methodId: 'social-shield',
    presetId: 'tiktok-hd',
    originalWidth: 4000,
    originalHeight: 3000,
    originalBytes: 5_200_000,
  });
  assert.equal(plan.zeroVisualLoss, true);
  assert.equal(plan.targetWidth, 1080);
  assert.equal(plan.targetHeight, 810);
  assert.equal(plan.resized, true);
  assert.ok(plan.estimatedOutputBytes < 5_200_000);

  // Binary JPEG EXIF stripper strips APP1 (0xFFE1) while keeping SOI (0xFFD8), APP0 (0xFFE0), and SOS (0xFFDA)
  const fakeJpeg = new Uint8Array([
    0xff, 0xd8, // SOI
    0xff, 0xe0, 0x00, 0x04, 0x4a, 0x46, // APP0 (keep, 6 bytes)
    0xff, 0xe1, 0x00, 0x06, 0x45, 0x78, 0x69, 0x66, // APP1 EXIF (strip, 8 bytes)
    0xff, 0xda, 0x00, 0x04, 0x01, 0x02, 0xaa, 0xbb, 0xff, 0xd9, // SOS + entropy + EOI
  ]);
  const strippedJpeg = new Uint8Array(stripJpegExifLossless(fakeJpeg.buffer));
  assert.equal(strippedJpeg.byteLength, fakeJpeg.byteLength - 8);
  assert.equal(strippedJpeg[0], 0xff);
  assert.equal(strippedJpeg[1], 0xd8);

  // Binary MP4 `free` padding box stripper keeps `ftyp` and `mdat` untouched
  const fakeMp4 = new Uint8Array([
    0x00, 0x00, 0x00, 0x08, 0x66, 0x74, 0x79, 0x70, // ftyp (8 bytes)
    0x00, 0x00, 0x00, 0x08, 0x66, 0x72, 0x65, 0x65, // free (8 bytes - stripped)
    0x00, 0x00, 0x00, 0x18, 0x6d, 0x64, 0x61, 0x74, // mdat (24 bytes)
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
  ]);
  const strippedMp4 = new Uint8Array(stripMp4AtomsLossless(fakeMp4.buffer));
  assert.equal(strippedMp4.byteLength, fakeMp4.byteLength - 8);

  // Binary PNG `tEXt` chunk stripper preserves PNG signature + IHDR + IEND
  const fakePng = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // sig
    0x00, 0x00, 0x00, 0x00, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x00, // IHDR
    0x00, 0x00, 0x00, 0x00, 0x74, 0x45, 0x58, 0x74, 0x00, 0x00, 0x00, 0x00, // tEXt (stripped)
    0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0x00, 0x00, 0x00, 0x00, // IEND
  ]);
  const strippedPng = new Uint8Array(stripPngChunksLossless(fakePng.buffer));
  assert.equal(strippedPng.byteLength, fakePng.byteLength - 12);
});

test('downloader detects truncated YouTube URLs, normalizes TikTok Tioo response, and merges dual MP4+MP3 streams', () => {
  const truncatedYt = parseYouTubeVideoId('https://youtu.be/tOUxfW_E');
  assert.equal(truncatedYt.truncated, true);
  assert.equal(truncatedYt.valid, false);
  assert.equal(truncatedYt.videoId, 'tOUxfW_E');

  const validYt = parseYouTubeVideoId('https://youtu.be/dQw4w9WgXcQ');
  assert.equal(validYt.truncated, false);
  assert.equal(validYt.valid, true);
  assert.equal(validYt.videoId, 'dQw4w9WgXcQ');

  // TikTok Tioo /ttdl shape with video[] and audio[]
  const tiooTiktok = normalizeDownloaderResult(
    {
      status: true,
      title: 'Video Viral Tanpa Watermark',
      thumbnail: 'https://cdn.tioo.example/thumb.jpg',
      video: ['https://cdn.tioo.example/video-nowm.mp4'],
      audio: ['https://cdn.tioo.example/sound.mp3'],
      creator: 'BotcahX',
    },
    'tiktok',
    'https://vt.tiktok.com/ZSppk1234/'
  );
  assert.ok(tiooTiktok);
  assert.equal(tiooTiktok.links.some((l) => !l.isAudio && l.ext === 'mp4'), true);
  assert.equal(tiooTiktok.links.some((l) => l.isAudio && l.ext === 'mp3'), true);

  // YouTube dual MP4 (cobaltVideo) + MP3 (davidcyril mp3) + Tioo merged cleanly without missing either format
  const ytDual = normalizeDownloaderResult(
    {
      oembed: { title: 'Manifestudio Track', author_name: 'Tomy', thumbnail_url: 'https://i.ytimg.com/vi/abc/hq.jpg' },
      cobaltVideo: { status: 'tunnel', url: 'https://cobaltapi.cjs.nz/tunnel?id=v1' },
      tioo: { status: true, mp4: 'https://cdn.tioo.example/yt.mp4', mp3: 'https://cdn.tioo.example/yt.webm' },
      mp3: { result: { download_url: 'https://cdn.davidcyril.example/yt.mp3' } },
    },
    'youtube'
  );
  assert.ok(ytDual);
  const mp4Links = ytDual.links.filter((l) => !l.isAudio && l.ext === 'mp4');
  const mp3Links = ytDual.links.filter((l) => l.isAudio && l.ext === 'mp3');
  assert.ok(mp4Links.length >= 1);
  assert.ok(mp3Links.length >= 1);

  // Double-encoded proxy audio URL (tioo.mp3 via vidsnap) when Cobalt returns error.api.youtube.login and Savetube redirects are blocked
  const ytDoubleEncodedProxy = normalizeDownloaderResult(
    {
      cobaltVideo: { status: 'error', error: { code: 'error.api.youtube.login' } },
      cobaltAudio: { status: 'error', error: { code: 'error.api.youtube.login' } },
      tioo: {
        status: true,
        title: 'DJ BERSAMAMU AKU BAHAGIA AKU',
        author: 'Dj vizi Fvnky',
        mp4: 'https://api.vidsnap.app/proxy?u=https%3A%2F%2Frr3.googlevideo.com%2Fvideoplayback%3Fmime%3Dvideo%252Fmp4',
        mp3: 'https://api.vidsnap.app/proxy?u=https%3A%2F%2Frr3.googlevideo.com%2Fvideoplayback%3Fmime%3Daudio%252Fmp4',
      },
      mp3: { result: { download_url: 'https://cdn401.savetube.vip/file/blocked-redirect.mp3' } },
    },
    'youtube'
  );
  assert.ok(ytDoubleEncodedProxy);
  const videoRes = ytDoubleEncodedProxy.links.filter((l) => !l.isAudio && !l.isImage && l.ext === 'mp4');
  const audioRes = ytDoubleEncodedProxy.links.filter((l) => l.isAudio);
  assert.equal(videoRes.length, 1);
  assert.equal(audioRes.length, 1);
  assert.equal(audioRes[0].ext, 'm4a');
  assert.equal(audioRes[0].isAudio, true);
  assert.equal(audioRes[0].label.includes('Musik / Audio YouTube'), true);
});

test('downloader v23 normalizes Siputzx ummy YouTube (dual MP4+M4A via CORS proxy), blocks sf-converter redirects, and parses IG sssinstagram/carousel', () => {
  assert.equal(isBlockedRedirectDownloadUrl('https://du.sf-converter.com/go?file=abc'), true);
  assert.equal(isBlockedRedirectDownloadUrl('https://sf-converter.com/download'), true);

  const wrappedGv = wrapCorsMediaProxyIfNeeded(
    'https://rr3---sn-abc.googlevideo.com/videoplayback?mime=audio%2Fmp4'
  );
  assert.equal(wrappedGv.startsWith('https://api.vidsnap.app/proxy?u='), true);
  assert.equal(wrapCorsMediaProxyIfNeeded('https://media.sssinstagram.com/get?token=1'), 'https://media.sssinstagram.com/get?token=1');

  const ytUmmy = normalizeDownloaderResult(
    {
      ummy: {
        status: true,
        data: {
          meta: {
            title: 'DJ BERSAMAMU FULL REMIX',
            duration: '03:45',
            source: 'https://youtu.be/tOUxfW_BWtM',
          },
          thumb: 'https://i.ytimg.com/vi/tOUxfW_BWtM/hqdefault.jpg',
          url: [
            {
              url: 'https://rr1---sn-xyz.googlevideo.com/videoplayback?mime=video%2Fmp4',
              ext: 'mp4',
              quality: '360',
              no_audio: false,
            },
            {
              url: 'https://du.sf-converter.com/go?payload=redirect-html',
              ext: 'mp3',
              type: 'audio',
            },
            {
              url: 'https://rr1---sn-xyz.googlevideo.com/videoplayback?mime=audio%2Fmp4',
              ext: 'm4a',
              type: 'audio',
              audio: true,
              bitrate: '131kbps',
            },
          ],
        },
      },
    },
    'youtube',
    'https://youtu.be/tOUxfW_BWtM'
  );
  assert.ok(ytUmmy);
  const ytVid = ytUmmy.links.filter((l) => !l.isAudio && l.ext === 'mp4');
  const ytAud = ytUmmy.links.filter((l) => l.isAudio);
  assert.equal(ytVid.length, 1);
  assert.equal(ytAud.length, 1);
  assert.equal(ytAud[0].ext, 'm4a');
  assert.equal(ytAud[0].url.startsWith('https://api.vidsnap.app/proxy?u='), true);
  assert.equal(ytUmmy.links.some((l) => l.url.includes('sf-converter.com')), false);

  // Siputzx sssinstagram Reels + long caption
  const igSssReel = normalizeDownloaderResult(
    {
      status: true,
      data: {
        meta: { title: 'Robot Arm Showcase\n#robotics #viral' },
        thumb: 'https://media.sssinstagram.com/get?uri=https%3A%2F%2Fscontent.cdninstagram.com%2Fthumb.jpg',
        url: [
          {
            url: 'https://media.sssinstagram.com/get?token=eyJ1cmwiOiJodHRwIn0',
            name: 'MP4',
            type: 'mp4',
            ext: 'mp4',
            quality: '360',
          },
        ],
      },
    },
    'instagram',
    'https://www.instagram.com/reel/DZwKgQVBQtv/'
  );
  assert.ok(igSssReel);
  assert.equal(igSssReel.mediaType, 'video');
  assert.equal(igSssReel.caption, 'Robot Arm Showcase\n#robotics #viral');
  assert.equal(igSssReel.links.length, 1);
  assert.equal(igSssReel.links[0].ext, 'mp4');
  assert.equal(igSssReel.links[0].isImage, false);

  // Siputzx sssinstagram multi-photo Carousel with wrapped proxy URI
  const igCarousel = normalizeDownloaderResult(
    {
      status: true,
      data: {
        meta: { title: 'Carousel Foto Produk' },
        url: [
          {
            url: 'https://media.sssinstagram.com/get?token=a&uri=https%3A%2F%2Fcdn.ig%2Fslide1.jpeg%3Fstp%3Ddst-jpg',
            ext: 'jpeg',
            type: 'jpg',
          },
          {
            url: 'https://scontent.cdninstagram.com/v/slide2.jpg',
            ext: 'jpg',
            type: 'image',
          },
        ],
      },
    },
    'instagram',
    'https://www.instagram.com/p/C9slide123/'
  );
  assert.ok(igCarousel);
  assert.equal(igCarousel.mediaType, 'carousel');
  assert.equal(igCarousel.photos.length, 2);
  assert.equal(igCarousel.links.every((l) => l.isImage && l.ext === 'jpg'), true);

  // Legacy Menu Lainnya banner kickers auto-migrate to Menu Utilitas
  const migratedBanners = normalizeBanners([
    {
      id: 'banner-weather',
      kicker: 'Menu Lainnya · Prakiraan Cuaca',
      heading: 'Pantau Cuaca',
      href: './tools.html?tab=weather',
    },
  ]);
  assert.equal(migratedBanners[0].kicker, 'Menu Utilitas · Prakiraan Cuaca');
});

test('parseSavedVolume handles null storage, empty strings, and out-of-range bounds safely', () => {
  assert.equal(parseSavedVolume(null), 0.72);
  assert.equal(parseSavedVolume(undefined), 0.72);
  assert.equal(parseSavedVolume(''), 0.72);
  assert.equal(parseSavedVolume('   '), 0.72);
  assert.equal(parseSavedVolume('invalid'), 0.72);
  assert.equal(parseSavedVolume(-0.5), 0.72);
  assert.equal(parseSavedVolume(1.5), 0.72);
  assert.equal(parseSavedVolume('0'), 0);
  assert.equal(parseSavedVolume(0), 0);
  assert.equal(parseSavedVolume('0.5'), 0.5);
  assert.equal(parseSavedVolume(0.85), 0.85);
  assert.equal(parseSavedVolume('1'), 1);
  assert.equal(parseSavedVolume(null, 0.5), 0.5);
});









test('applyOpenGraphToHtml deduplicates repeated tagline in <title> and syncs JSON-LD image & description', () => {
  const og = normalizeOpenGraphConfig({
    openGraph: {
      title: 'Manifestudio by Tomy — Akun Premium Murah Berkualitas dan Utilitas',
      tagline: 'by Tomy · Katalog Layanan Digital & Utilitas Terpadu',
      description: 'Platform Akun Premium Murah Berkualitas.\nDilengkapi Jadwal Sholat & Cuaca.',
      image: 'https://raw.githubusercontent.com/tmctomystudio26/Source/refs/heads/main/1794840032-picsay.jpg',
      imageAlt: 'Banner Katalog Manifestudio',
      siteName: 'Manifestudio',
    },
  });

  const sampleHtml = `<!doctype html><html><head>
  <title>Old Title</title>
  <meta name="description" content="Old" />
  <meta property="og:title" content="Old" />
  <meta property="og:description" content="Old" />
  <meta property="og:image" content="https://old" />
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "OldName",
    "description": "OldDesc",
    "image": "https://manifestudio.my.id/assets/og-manifestudio.jpg?v=3"
  }
  </script>
</head></html>`;

  const updated = applyOpenGraphToHtml(sampleHtml, og, { name: 'Manifestudio' });
  assert.equal(
    updated.includes('<title>Manifestudio by Tomy — Akun Premium Murah Berkualitas dan Utilitas</title>'),
    true
  );
  assert.equal(updated.includes('(by Tomy'), false);
  assert.equal(
    updated.includes('"image": "https://raw.githubusercontent.com/tmctomystudio26/Source/refs/heads/main/1794840032-picsay.jpg"'),
    true
  );
  assert.equal(
    updated.includes('"description": "Platform Akun Premium Murah Berkualitas. Dilengkapi Jadwal Sholat & Cuaca."'),
    true
  );
});

test('normalizeYtMusicTrack supports hybrid tracks with both videoId and background-safe streamUrl or direct streamUrl', () => {
  const hybrid = normalizeYtMusicTrack({
    videoId: 'En-EHqRk8yg',
    title: 'Garam & Madu (Sakit Dadaku)',
    artist: 'Tenxi, Naykilla & Jemsii',
    duration: 251,
    streamUrl: 'https://api.audius.co/v1/tracks/Nlzyaxp/stream?app_name=Manifestudio',
  });
  assert.ok(hybrid);
  assert.equal(hybrid.id, 'yt-En-EHqRk8yg');
  assert.equal(hybrid.videoId, 'En-EHqRk8yg');
  assert.equal(hybrid.streamUrl, 'https://api.audius.co/v1/tracks/Nlzyaxp/stream?app_name=Manifestudio');

  const directOnly = normalizeYtMusicTrack({
    id: 'aud-WEjzjgB',
    title: 'Satu Bulan',
    artist: 'Bernadya',
    duration: 200,
    streamUrl: 'https://api.audius.co/v1/tracks/WEjzjgB/stream?app_name=Manifestudio',
  });
  assert.ok(directOnly);
  assert.equal(directOnly.id, 'aud-WEjzjgB');
  assert.equal(directOnly.videoId, '');
  assert.equal(directOnly.streamUrl, 'https://api.audius.co/v1/tracks/WEjzjgB/stream?app_name=Manifestudio');
});

test('normalizeUtilityConfig, upsertUtilityItemInCatalog, and describeCatalogChanges manage utility icons, labels, page headers, and YT Music hero card', () => {
  const base = getDefaultCatalogSnapshot();
  const util = normalizeUtilityConfig(base.utilities);
  assert.equal(util.items.length, 7);
  assert.equal(util.items.some((i) => i.id === 'downloader' && i.label === 'Downloader'), true);
  assert.equal(util.musicHero.icon, './assets/icons/tool-music.svg');
  assert.ok(DEFAULT_UTILITY_CONFIG.items.length === 7);

  let next = upsertUtilityItemInCatalog(base, {
    id: 'downloader',
    label: 'Unduh Sosmed',
    icon: './assets/logos/uploads/util-downloader-custom.png',
    pageTitle: 'Downloader All-in-One Pro',
    pageSubtitle: 'Unduh video TikTok, IG, YT & FB lebih cepat.',
  });
  next.utilities.musicHero.title = 'YouTube Music Pro — Lagu Viral Indonesia';
  next.utilities.musicHero.icon = './assets/logos/uploads/util-music-hero.png';

  const dlItem = next.utilities.items.find((i) => i.id === 'downloader');
  assert.equal(dlItem.label, 'Unduh Sosmed');
  assert.equal(dlItem.pageTitle, 'Downloader All-in-One Pro');

  const diff = describeCatalogChanges(base, next);
  assert.equal(
    diff.some((d) => d.includes('Mengubah nama menu utilitas "Downloader" menjadi "Unduh Sosmed"')),
    true
  );
  assert.equal(
    diff.some((d) => d.includes('Mengubah ikon menu utilitas "Unduh Sosmed"')),
    true
  );
  assert.equal(
    diff.some((d) => d.includes('Mengubah judul halaman utilitas "Unduh Sosmed" menjadi "Downloader All-in-One Pro"')),
    true
  );
  assert.equal(
    diff.some((d) => d.includes('Mengubah judul kartu YT Music Hub menjadi "YouTube Music Pro — Lagu Viral Indonesia"')),
    true
  );
  assert.equal(
    diff.some((d) => d.includes('Mengubah ikon kartu YT Music Hub')),
    true
  );
});

test('strict audio matcher prevents playing unrelated songs under another song title', () => {
  const stecuYt = normalizeYtMusicTrack({
    videoId: 'sc5w6h6fI7w',
    title: 'Stecu Stecu',
    artist: 'Faris Adаm', // includes Cyrillic homoglyph а
    duration: 229,
  });
  const unrelatedWestern = normalizeYtMusicTrack({
    id: 'aud-yya2E',
    title: 'Speculation (Instrumental)',
    artist: 'Arkatech Beatz',
    duration: 286,
    streamUrl: 'https://api.audius.co/v1/tracks/yya2E/stream?app_name=Manifestudio',
  });
  const unrelatedPrefix = normalizeYtMusicTrack({
    id: 'aud-l4pdK',
    title: 'Xiuhtecuhtli',
    artist: 'Eluterio',
    duration: 182,
    streamUrl: 'https://api.audius.co/v1/tracks/l4pdK/stream?app_name=Manifestudio',
  });

  // Unrelated songs must NEVER match Stecu Stecu or rank in Stecu search results
  assert.equal(isStrictAudioMatch(stecuYt, unrelatedWestern), false);
  assert.equal(isStrictAudioMatch(stecuYt, unrelatedPrefix), false);
  assert.equal(scoreSearchRelevance(unrelatedWestern, 'Stecu'), 0);
  assert.equal(scoreSearchRelevance(unrelatedPrefix, 'Stecu'), 0);
  assert.ok(scoreSearchRelevance(stecuYt, 'Stecu') > 0);

  // Genuine Indonesian track match (Mangu - Fourtwnty) MUST succeed
  const manguYt = normalizeYtMusicTrack({
    videoId: 'abc12345678',
    title: 'Mangu (Official Lyric Video)',
    artist: 'Fourtwnty - Topic',
    duration: 260,
  });
  const manguAudius = normalizeYtMusicTrack({
    id: 'aud-7O8YZgj',
    title: 'Mangu',
    artist: 'fourtwnty',
    duration: 262,
    streamUrl: 'https://api.audius.co/v1/tracks/7O8YZgj/stream?app_name=Manifestudio',
  });
  assert.equal(isStrictAudioMatch(manguYt, manguAudius), true);

  // Reject huge 50-min compilation mixes when searching for a single track
  const fiftyMinCompilation = normalizeYtMusicTrack({
    id: 'aud-O75plov',
    title: 'BERNADYA FULL ALBUM lagu santai',
    artist: 'bigdig',
    duration: 3055,
    streamUrl: 'https://api.audius.co/v1/tracks/O75plov/stream?app_name=Manifestudio',
  });
  assert.equal(scoreSearchRelevance(fiftyMinCompilation, 'Bernadya Satu Bulan'), 0);
  assert.equal(isStrictAudioMatch(manguYt, fiftyMinCompilation), false);
});

test('Watch Later (Tonton Nanti) and user playlists create, rename, add/remove tracks, deduplicate, and persist cleanly', () => {
  assert.equal(MUSIC_LIBRARY_STORAGE_KEY, 'manifestudio_music_library_v1');

  const trackA = normalizeYtMusicTrack({
    id: 'aud-7O8YZgj',
    title: 'Mangu',
    artist: 'Fourtwnty',
    duration: 262,
    streamUrl: 'https://api.audius.co/v1/tracks/7O8YZgj/stream?app_name=Manifestudio',
  });
  const trackB = normalizeYtMusicTrack({
    videoId: 'sc5w6h6fI7w',
    title: 'Stecu Stecu',
    artist: 'Faris Adam',
    duration: 229,
  });

  let lib = normalizeMusicLibraryState({});
  assert.deepEqual(lib.watchLater, []);
  assert.deepEqual(lib.playlists, []);

  // Watch Later toggle on & off
  const wl1 = toggleTrackInWatchLater(lib, trackA, '2026-11-17T01:00:00.000Z');
  assert.equal(wl1.added, true);
  lib = wl1.library;
  assert.equal(isTrackInWatchLater(lib, trackA), true);
  assert.equal(isTrackInWatchLater(lib, trackB), false);

  const wlDup = toggleTrackInWatchLater(lib, trackA);
  assert.equal(wlDup.added, false);
  assert.equal(isTrackInWatchLater(wlDup.library, trackA), false);

  // Add both to Watch Later and keep Track B saved
  lib = toggleTrackInWatchLater(lib, trackB, '2026-11-17T01:02:00.000Z').library;
  assert.equal(lib.watchLater.length, 2);

  // Create custom playlist with initial track, rename, add duplicate & second track, remove one, delete
  const created = createUserPlaylist(lib, 'Favorit Malam', trackB, '2026-11-17T01:05:00.000Z', 'pl-custom-1');
  assert.ok(created.playlist);
  assert.equal(created.playlist.id, 'pl-custom-1');
  assert.equal(created.playlist.tracks.length, 1);
  lib = created.library;

  // Empty name is rejected safely
  const emptyCreated = createUserPlaylist(lib, '   ');
  assert.equal(emptyCreated.playlist, null);

  // Duplicate track should not be added twice
  const addDup = addTrackToPlaylist(lib, 'pl-custom-1', trackB);
  assert.equal(addDup.added, false);
  const addNew = addTrackToPlaylist(addDup.library, 'pl-custom-1', trackA, '2026-11-17T01:06:00.000Z');
  assert.equal(addNew.added, true);
  lib = addNew.library;
  assert.equal(lib.playlists[0].tracks.length, 2);

  lib = renameUserPlaylist(lib, 'pl-custom-1', 'Lagu Indo Santai', '2026-11-17T01:07:00.000Z');
  assert.equal(lib.playlists[0].name, 'Lagu Indo Santai');

  // Survives JSON serialization / reload normalization cleanly
  const reloaded = normalizeMusicLibraryState(JSON.parse(JSON.stringify(lib)));
  assert.equal(reloaded.watchLater.length, 2);
  assert.equal(reloaded.playlists.length, 1);
  assert.equal(reloaded.playlists[0].name, 'Lagu Indo Santai');
  assert.equal(reloaded.playlists[0].tracks.length, 2);
  assert.equal(reloaded.playlists[0].tracks[0].title, 'Stecu Stecu');

  const removed = removeTrackFromPlaylist(reloaded, 'pl-custom-1', trackB.id);
  assert.equal(removed.removed, true);
  assert.equal(removed.library.playlists[0].tracks.length, 1);

  const deleted = deleteUserPlaylist(removed.library, 'pl-custom-1');
  assert.equal(deleted.playlists.length, 0);
});

test('selectUmmyAudioStreamCandidates filters redirect wrappers, wraps googlevideo proxy, and prioritizes M4A > Opus > MP4 with audio', () => {
  assert.equal(isBlockedAudioWrapperUrl('https://du.sf-converter.com/download/123'), true);
  assert.equal(isBlockedAudioWrapperUrl('https://cdn402.savetube.vip/song'), true);
  assert.equal(isBlockedAudioWrapperUrl('https://cobaltapi.cjs.nz/tunnel?id=abc'), false);

  const candidates = selectUmmyAudioStreamCandidates({
    status: true,
    data: {
      url: [
        { url: 'https://du.sf-converter.com/a.mp3', ext: 'mp3', bitrate: 320 },
        { url: 'https://rr2.googlevideo.com/videoplayback?itag=137', ext: 'mp4', no_audio: true, bitrate: 1500 },
        { url: 'https://rr2.googlevideo.com/videoplayback?itag=18', ext: 'mp4', no_audio: false, bitrate: 500 },
        { url: 'https://rr2.googlevideo.com/videoplayback?itag=251', ext: 'opus', no_audio: false, bitrate: 160 },
        { url: 'https://rr2.googlevideo.com/videoplayback?itag=140', ext: 'm4a', no_audio: false, bitrate: 128 },
      ],
    },
  });

  assert.equal(candidates.length, 3);
  assert.equal(candidates.some((u) => u.includes('sf-converter')), false);
  assert.equal(candidates.some((u) => u.includes('itag%3D137')), false);
  assert.equal(candidates[0].startsWith('https://api.vidsnap.app/proxy?u='), true);
  assert.equal(decodeURIComponent(candidates[0]).includes('itag=140'), true);
  assert.equal(decodeURIComponent(candidates[1]).includes('itag=251'), true);
  assert.equal(decodeURIComponent(candidates[2]).includes('itag=18'), true);
});

test('isStrictSongMetadataMatch aligns alternate YT uploads for the same song and user tracks never auto-skip', () => {
  const picked = normalizeYtMusicTrack({
    videoId: 'sc5w6h6fI7w',
    title: 'Stecu Stecu',
    artist: 'Faris Adаm',
    duration: 224,
  });
  const officialMv = normalizeYtMusicTrack({
    videoId: '2e0BMACvymo',
    title: 'FARIS ADAM - STECU STECU (Official Music Video)',
    artist: 'Faris Adam Official',
    duration: 229,
  });
  const unrelatedSong = normalizeYtMusicTrack({
    videoId: 'dQw4w9WgXcQ',
    title: 'Never Gonna Give You Up',
    artist: 'Rick Astley',
    duration: 213,
  });

  assert.equal(isStrictSongMetadataMatch(picked, officialMv), true);
  assert.equal(isStrictSongMetadataMatch(picked, unrelatedSong), false);

  assert.equal(
    shouldAutoSkipOnPlaybackError({ trackSelectionSource: 'user', consecutiveErrors: 1 }),
    false
  );
  assert.equal(
    shouldAutoSkipOnPlaybackError({ trackSelectionSource: 'auto', consecutiveErrors: 1 }),
    true
  );
  assert.equal(
    shouldAutoSkipOnPlaybackError({ trackSelectionSource: 'auto', consecutiveErrors: 6 }),
    false
  );
});

test('needsCorsAnonymousAudio detects vidsnap proxy URLs while leaving third-party streams untouched', () => {
  assert.equal(needsCorsAnonymousAudio('https://api.vidsnap.app/proxy?u=abc'), true);
  assert.equal(needsCorsAnonymousAudio('http://vidsnap.app/proxy?u=abc'), true);
  assert.equal(needsCorsAnonymousAudio('https://api.audius.co/v1/tracks/Nlzyaxp/stream'), false);
  assert.equal(needsCorsAnonymousAudio(''), false);
});

test('computeSafeResumeSeconds & pending seek guards preserve timestamp across NaN duration and foreground return', () => {
  // Different track always resets cleanly to 0
  assert.equal(
    computeSafeResumeSeconds({ currentTime: 48, sessionTime: 52, lastGoodTime: 50, sameTrack: false, duration: 220 }),
    0
  );

  // Handles NaN / Infinity duration during initial audio metadata load without dropping resume timestamp
  assert.equal(
    computeSafeResumeSeconds({ currentTime: 0, sessionTime: 42.5, lastGoodTime: 44, sameTrack: true, duration: Number.NaN }),
    44
  );
  assert.equal(
    computeSafeResumeSeconds({ currentTime: 18, sessionTime: 0, lastGoodTime: 0, sameTrack: true, duration: Infinity }),
    18
  );

  // Clamps within finite duration minus end margin
  assert.equal(
    computeSafeResumeSeconds({ currentTime: 229, sessionTime: 225, lastGoodTime: 228, sameTrack: true, duration: 230 }),
    228.5
  );

  // Pending seek guard ignores initial 0-clobber timeupdate events until seek settles within tolerance
  assert.equal(shouldIgnoreTimeUpdateDuringPendingSeek({ pendingSeekSeconds: 45, reportedTime: 0.2 }), true);
  assert.equal(shouldIgnoreTimeUpdateDuringPendingSeek({ pendingSeekSeconds: 45, reportedTime: 44.1 }), false);
  assert.equal(hasPendingSeekSettled({ pendingSeekSeconds: 45, reportedTime: 0.2 }), false);
  assert.equal(hasPendingSeekSettled({ pendingSeekSeconds: 45, reportedTime: 44.1 }), true);
  assert.equal(hasPendingSeekSettled({ pendingSeekSeconds: 0, reportedTime: 0 }), true);
});

test('persistent stream cache validates googlevideo expiry, TTL, and prioritizes background pre-warm targets cleanly', () => {
  const now = 1_794_900_000_000; // ~2026-11-17
  const validExpSec = Math.floor((now + 3_600_000) / 1000); // +60m
  const soonExpSec = Math.floor((now + 60_000) / 1000); // +1m (<3m safety margin)

  const proxiedValidUrl = `https://api.vidsnap.app/proxy?u=${encodeURIComponent(
    `https://rr2.googlevideo.com/videoplayback?expire=${validExpSec}&itag=140`
  )}`;
  const proxiedSoonUrl = `https://api.vidsnap.app/proxy?u=${encodeURIComponent(
    `https://rr2.googlevideo.com/videoplayback?expire=${soonExpSec}&itag=140`
  )}`;
  const rawExpSec = Math.floor((now + 7_200_000) / 1000);
  const directRawUrl = `https://rr3.googlevideo.com/videoplayback?expire=${rawExpSec}&itag=251`;

  assert.equal(extractStreamExpiryMs(proxiedValidUrl), validExpSec * 1000);
  assert.equal(extractStreamExpiryMs(directRawUrl), rawExpSec * 1000);
  assert.equal(extractStreamExpiryMs('https://api.audius.co/v1/tracks/abc/stream'), 0);

  const cache = pruneAndSerializeStreamCache(
    [
      { videoId: 'nhRLD-9XJJs', url: proxiedValidUrl, savedAt: now - 300_000 },
      { videoId: 'soonExpired1', url: proxiedSoonUrl, savedAt: now - 10_000 },
      { videoId: 'staleTtl0001', url: directRawUrl, savedAt: now - 6_000_000 },
      { videoId: 'blockedWrap1', url: 'https://du.sf-converter.com/dl/abc', savedAt: now },
      { videoId: 'audiusKeep11', url: directRawUrl, savedAt: now - 5_000 },
    ],
    { now, maxEntries: 60, ttlMs: 5_400_000 }
  );

  assert.equal(getValidCachedStreamUrl(cache, 'nhRLD-9XJJs', { now }), proxiedValidUrl);
  assert.equal(getValidCachedStreamUrl(cache, 'audiusKeep11', { now }), directRawUrl);
  assert.equal(getValidCachedStreamUrl(cache, 'soonExpired1', { now }), '');
  assert.equal(getValidCachedStreamUrl(cache, 'staleTtl0001', { now }), '');
  assert.equal(getValidCachedStreamUrl(cache, 'blockedWrap1', { now }), '');

  const currentTrack = { id: 'yt-cur1', videoId: 'cur10000001', title: 'Lagu Sekarang', streamUrl: '' };
  const qNext = { id: 'yt-qnxt', videoId: 'qnxt0000002', title: 'Antrean Berikutnya', streamUrl: '' };
  const qAlreadyReady = { id: 'yt-qok', videoId: 'qok00000003', title: 'Sudah Siap', streamUrl: directRawUrl };
  const searchHit = { id: 'yt-srch', videoId: 'srch0000004', title: 'Hasil Pencarian', streamUrl: '' };
  const wlTrack = { id: 'yt-wl01', videoId: 'wl010000005', title: 'Tonton Nanti', streamUrl: '' };
  const plTrack = { id: 'yt-pl01', videoId: 'pl010000006', title: 'Playlist User', streamUrl: '' };
  const failedTrack = { id: 'yt-fail', videoId: 'fail0000007', title: 'Gagal Sebelumnya', streamUrl: '' };

  const ordered = pickPrewarmQueueCandidates({
    currentTrack,
    activeQueue: [currentTrack, qNext, qAlreadyReady],
    searchResults: [searchHit, failedTrack],
    watchLater: [wlTrack],
    playlists: [{ id: 'pl-1', name: 'P1', tracks: [plTrack] }],
    seedTracks: [qAlreadyReady],
    failedIds: new Set(['fail0000007']),
    failedUrls: new Set(),
    limit: 10,
  });

  assert.deepEqual(
    ordered.map((t) => t.id),
    ['yt-cur1', 'yt-qnxt', 'yt-srch', 'yt-wl01', 'yt-pl01']
  );
});

test('Artist - Title parser matches genuine alternate uploads for same song while rejecting different songs', () => {
  const targetOfficialMv = normalizeYtMusicTrack({
    videoId: '93YDqv3KBUs',
    title: 'Yovie Widianto, Tiara Andini - Tanpa Cinta (Official Music Video)',
    artist: 'Yovie Widianto',
    duration: 288,
  });
  const altLyricsTbl = normalizeYtMusicTrack({
    videoId: 'mn7CK4ND3rU',
    title: 'Yovie & Nuno - Tanpa Cinta (Lyrics)',
    artist: 'TBL',
    duration: 259,
  });
  const altReversedIndolirik = normalizeYtMusicTrack({
    videoId: 'URTVIX6Q-2g',
    title: 'Tanpa Cinta - Tiara Andini, Yovie Widianto | Lirik Lagu',
    artist: 'Indolirik',
    duration: 256,
  });
  const altTopic = normalizeYtMusicTrack({
    videoId: 'SSNa3pW_Ht0',
    title: 'Tanpa Cinta',
    artist: 'Yovie Widianto',
    duration: 251,
  });
  const wrongSongSameTitleDiffArtist = normalizeYtMusicTrack({
    videoId: 'terry123456',
    title: 'Tanpa Cinta - Terry',
    artist: 'Sony Music',
    duration: 245,
  });
  const wrongSongSameArtist = normalizeYtMusicTrack({
    videoId: 'other000001',
    title: 'Yovie Widianto - Tak Sebebas Merpati',
    artist: 'Yovie Widianto',
    duration: 260,
  });

  // Matches lyric / reupload / topic versions of the EXACT same song
  assert.equal(isStrictSongMetadataMatch(targetOfficialMv, altLyricsTbl), true);
  assert.equal(isStrictSongMetadataMatch(targetOfficialMv, altReversedIndolirik), true);
  assert.equal(isStrictSongMetadataMatch(targetOfficialMv, altTopic), true);
  assert.equal(isStrictSongMetadataMatch(altReversedIndolirik, targetOfficialMv), true);

  // Strictly rejects different songs (same title by Terry, or different song by Yovie Widianto)
  assert.equal(isStrictSongMetadataMatch(targetOfficialMv, wrongSongSameTitleDiffArtist), false);
  assert.equal(isStrictSongMetadataMatch(targetOfficialMv, wrongSongSameArtist), false);

  // Dedupe skips primary videoId and failedIds and caps cleanly at maxAlts=4
  const alts = dedupeMatchingAltTracks(
    targetOfficialMv,
    [
      targetOfficialMv,
      altTopic,
      altLyricsTbl,
      altReversedIndolirik,
      wrongSongSameTitleDiffArtist,
      normalizeYtMusicTrack({ videoId: 'oVGH5liPPZM', title: 'Yovie & Nuno - Tanpa Cinta (Official Audio)', artist: 'Sony Music Entertainment Indonesia', duration: 258 }),
      normalizeYtMusicTrack({ videoId: 'Q_EtDfSfWp8', title: 'Yovie Widianto, Tiara Andini - Tanpa Cinta (Official Lyric Video)', artist: 'Yovie Widianto', duration: 251 }),
    ],
    { failedIds: new Set(['SSNa3pW_Ht0']), maxAlts: 4 }
  );
  assert.equal(alts.length, 4);
  assert.equal(alts.some((t) => t.videoId === 'SSNa3pW_Ht0'), false);
  assert.equal(alts.some((t) => t.videoId === 'terry123456'), false);
  assert.equal(alts.some((t) => t.videoId === 'mn7CK4ND3rU'), true);

  // SilentHold notification guard flips playbackState to paused cleanly when hidden background resolve fails
  assert.equal(
    shouldStopSilentHoldAndPauseNotification({
      activeEngine: 'yt-iframe',
      isSilentHold: true,
      resolvedStreamUrl: '',
      isHidden: true,
      explicitPaused: false,
      timedOutOrFailed: true,
    }),
    true
  );
  assert.equal(
    shouldStopSilentHoldAndPauseNotification({
      activeEngine: 'yt-iframe',
      isSilentHold: true,
      resolvedStreamUrl: 'https://api.vidsnap.app/proxy?u=abc',
      isHidden: true,
      explicitPaused: false,
      timedOutOrFailed: true,
    }),
    false
  );
  assert.equal(
    shouldStopSilentHoldAndPauseNotification({
      activeEngine: 'yt-iframe',
      isSilentHold: true,
      resolvedStreamUrl: '',
      isHidden: false,
      explicitPaused: false,
      timedOutOrFailed: true,
    }),
    false
  );
});

test('music v34 normalizes instant Apple Music/iTunes direct streams, prioritizes non-gcr=id Ummy streams, and manages PiP + Headset mode state transitions', () => {
  const itunesTrack = normalizeItunesTrack({
    trackId: 1581234567,
    trackName: 'Tanpa Cinta',
    artistName: 'Yovie Widianto & Tiara Andini',
    trackTimeMillis: 251000,
    artworkUrl100: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/ab/cd/ef/cover/100x100bb.jpg',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/bc/89/94/mzaf_17584604111107113811.plus.aac.p.m4a',
    primaryGenreName: 'Indo Pop',
  });
  assert.ok(itunesTrack);
  assert.equal(itunesTrack.id, 'itn-1581234567');
  assert.equal(itunesTrack.title, 'Tanpa Cinta');
  assert.equal(itunesTrack.artist, 'Yovie Widianto & Tiara Andini');
  assert.equal(itunesTrack.duration, 251);
  assert.equal(itunesTrack.artwork.includes('480x480bb'), true);
  assert.equal(isInstantAudioPreviewUrl(itunesTrack.streamUrl), true);
  assert.equal(isInstantAudioPreviewUrl('https://api.audius.co/v1/tracks/Nlzyaxp/stream'), false);

  // Strict audio match between YT search item and normalized iTunes track
  const ytTanpaCinta = normalizeYtMusicTrack({
    videoId: 'SSNa3pW_Ht0',
    title: 'Yovie Widianto, Tiara Andini - Tanpa Cinta (Official Music Video)',
    artist: 'Yovie Widianto',
    duration: 256,
  });
  assert.equal(isStrictAudioMatch(ytTanpaCinta, itunesTrack), true);

  // Non-gcr=id Ummy candidate wins over gcr=id candidate
  const ummyCands = selectUmmyAudioStreamCandidates({
    data: {
      url: [
        {
          url: 'https://rr1---sn-id.googlevideo.com/videoplayback?itag=18&gcr=id&mime=video%2Fmp4',
          ext: 'mp4',
          no_audio: false,
        },
        {
          url: 'https://rr2---sn-us.googlevideo.com/videoplayback?itag=18&mime=video%2Fmp4',
          ext: 'mp4',
          no_audio: false,
        },
      ],
    },
  });
  assert.equal(ummyCands.length, 2);
  assert.equal(decodeURIComponent(ummyCands[0]).includes('gcr=id'), false);

  // Picture-in-Picture & Headset mode state machine
  const enteredPip = resolvePipHeadsetStateTransition({
    isPipOpen: false,
    pipHeadsetMode: false,
    isPlaying: true,
    action: 'enter-pip',
  });
  assert.equal(enteredPip.isPipOpen, true);
  assert.equal(enteredPip.pipHeadsetMode, false);
  assert.equal(enteredPip.shouldKeepPlaying, true);

  // Clicking Headset icon inside PiP hides PiP while keeping music playing uninterrupted
  const headsetFromPip = resolvePipHeadsetStateTransition({
    isPipOpen: enteredPip.isPipOpen,
    pipHeadsetMode: enteredPip.pipHeadsetMode,
    isPlaying: true,
    action: 'activate-headset',
  });
  assert.equal(headsetFromPip.isPipOpen, false);
  assert.equal(headsetFromPip.pipHeadsetMode, true);
  assert.equal(headsetFromPip.shouldExitNativePip, true);
  assert.equal(headsetFromPip.shouldKeepPlaying, true);

  // Auto-PiP on background respects Headset mode when active
  const bgWhenHeadset = resolvePipHeadsetStateTransition({
    isPipOpen: headsetFromPip.isPipOpen,
    pipHeadsetMode: headsetFromPip.pipHeadsetMode,
    isPlaying: true,
    action: 'auto-pip-background',
  });
  assert.equal(bgWhenHeadset.isPipOpen, false);
  assert.equal(bgWhenHeadset.pipHeadsetMode, true);
  assert.equal(bgWhenHeadset.shouldKeepPlaying, true);
});
