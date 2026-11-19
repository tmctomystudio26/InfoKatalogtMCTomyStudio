import test from 'node:test';
import assert from 'node:assert/strict';
import { getDefaultCatalogSnapshot, PRODUCTS, VOUCHERS } from './data.js';
import {
  ANICHIN_UNIFIED_SOURCES,
  CURATED_DRACIN_CATALOG,
  DEFAULT_DRACIN_ENDPOINT_CONFIG,
  DRACIN_PLATFORMS,
  DRACIN_SUBTITLE_LANGS,
  SANSEKAI_SUPPORTED_PLATFORMS,
  buildDailymotionEmbedUrl,
  buildDailymotionWatchUrl,
  buildEpisodeList,
  buildEpisodeRanges,
  buildEpisodeSubtitleCues,
  buildSansekaiDirectWatchUrl,
  buildSansekaiWebUrl,
  buildWebVttFromCues,
  computePreloadEpisodeTargets,
  computeTokenJaccardSimilarity,
  computeVisualProfileSimilarity,
  extractAdaptiveEpisodePayload,
  extractSansekaiApiBaseCandidates,
  extractSansekaiEpisodeStreams,
  extractSansekaiFeedItems,
  extractSansekaiMeloloVideoId,
  extractSynopsisKeywords,
  filterDracinCatalog,
  filterDracinPlatforms,
  formatDracinUserError,
  getActiveSubtitleCue,
  getNextPrevEpisode,
  getSansekaiCooldownRemainingSec,
  isSansekaiCooldownActive,
  mergeParallelDracinFeeds,
  normalizeAnichinDramaItem,
  normalizeDramaMatchText,
  normalizeSansekaiUrl,
  parseAiDramaIdentification,
  parseSubtitleText,
  parseSubtitleTimestamp,
  pickBestPlaybackServer,
  rankClipIdentifierCandidates,
  rankCrossPlatformDramaMatches,
  rankHealthyApiMirrors,
  recordMirrorHealth,
  recordSansekaiOutcome,
  resolveAnichinMediaUrl,
  resolveAutoSubtitleLang,
  resolveCleanScreenState,
  resolveNextMuteState,
  scoreCrossPlatformDramaMatch,
  scoreDailymotionAutoMatch,
  shouldPreserveFullscreenOnEpisodeChange,
  toggleFavoriteDramaId,
  unwrapHlsJsonPayload,
  upsertWatchHistory,
} from './dracin-logic.js';
import {
  bytesToBase64Url,
  hexToBytes,
  parseMp4Boxes,
} from './dracin-cenc.js';
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
  buildAudiusLookupQueries,
  buildCleanAudioLookupQuery,
  clampMusicFabPosition,
  computeSafeResumeSeconds,
  createUserPlaylist,
  dedupeMatchingAltTracks,
  deleteUserPlaylist,
  extractYouTubeVideoId,
  extractStreamExpiryMs,
  filterFullLengthTracks,
  filterPresetCategoryTracks,
  formatAudioTime,
  getLoadingProgressMeta,
  getPopoverAnchorClasses,
  getSilentHoldPcmSample,
  getValidCachedStreamUrl,
  hasPendingSeekSettled,
  isBlockedAudioWrapperUrl,
  isInstantAudioPreviewUrl,
  isMobileTouchPlatform,
  isStrictAudioMatch,
  isStrictSongMetadataMatch,
  isTrackInWatchLater,
  mergeRealtimeTrendCategories,
  needsCorsAnonymousAudio,
  normalizeItunesTrack,
  normalizeMusicLibraryState,
  normalizeMusicMode,
  normalizeRepeatMode,
  normalizeYtMusicTrack,
  parseDurationSeconds,
  parseSavedVolume,
  pickBackgroundSafeNextTrack,
  pickPrewarmQueueCandidates,
  pickShuffledViralTrack,
  pruneAndSerializeStreamCache,
  rankSearchResults,
  removeTrackFromPlaylist,
  renameUserPlaylist,
  resolvePipHeadsetStateTransition,
  scoreSearchRelevance,
  selectTiooAudioStreamCandidates,
  selectUmmyAudioStreamCandidates,
  shouldAutoSkipOnPlaybackError,
  shouldIgnoreTimeUpdateDuringPendingSeek,
  shouldKeepSilentHoldBridgeActive,
  shouldPoisonExactYoutubeIdOnError,
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
  computeLocalPerceptualAiRecipe,
  computeMbps,
  computeRgbaPsnrDb,
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
  parseAndSanitizeAiCompressionRecipe,
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
  buildOpenSourceWeservCompressUrl,
  quantizeRgbaBufferOpenSource,
  stripJpegExifLossless,
  stripMp4AtomsLossless,
  stripPngChunksLossless,
} from './compressor.js';
import {
  buildFfmpegTranscodeArgs,
  buildFfmpegVideoCompressArgs,
} from './media-engine.js';
import {
  CONVERTER_CATEGORIES,
  CONVERTER_PRESETS,
  buildPdfDocumentBuffer,
  convertAnyFile,
  createSampleDocxBuffer,
  createSampleFileForConversion,
  createSampleXlsxBuffer,
  createZipArchive,
  detectSourceFormat,
  encodePcmToWavBuffer,
  encodeRgbaToPngBuffer,
  extractTextFromPdfBuffer,
  extractZipEntries,
  getAvailableTargetFormats,
  parseDocxBuffer,
  parseExcelBuffer,
  verifyConvertedBinarySignature,
} from './converter.js';
import {
  REFERENCE_SONG_FINGERPRINTS,
  buildCrossPlatformMusicAndVideoLinks,
  computeAcousticFingerprintFromPcm,
  computeAcousticSimilarity,
  computeLyricMatchScore,
  computeShazamConstellationHash,
  detectMediaFileKind,
  encodePcmToWavBytes,
  extractEmbeddedMediaTags,
  parseSongQueryFromFilenameAndTags,
  rankSongCandidates,
} from './song-finder.js';

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
  assert.equal(COMPRESSION_METHODS.length, 6);
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
  assert.equal(util.items.length, 10);
  assert.equal(util.items.some((i) => i.id === 'downloader' && i.label === 'Downloader'), true);
  assert.equal(util.items.some((i) => i.id === 'converter' && i.label === 'Konversi File'), true);
  assert.equal(util.items.some((i) => i.id === 'songfinder' && i.label === 'Cari Judul Lagu'), true);
  assert.equal(util.items.some((i) => i.id === 'dracin' && i.label === 'Drama China'), true);
  assert.equal(util.musicHero.icon, './assets/icons/tool-music.svg');
  assert.ok(DEFAULT_UTILITY_CONFIG.items.length === 10);

  let next = upsertUtilityItemInCatalog(base, {
    id: 'downloader',
    label: 'Unduh Sosmed',
    icon: './assets/logos/uploads/util-downloader-custom.png',
    pageTitle: 'Downloader All-in-One Pro',
    pageSubtitle: 'Unduh video TikTok, IG, YT & FB lebih cepat.',
    heroKicker: 'Caption Baru Downloader',
    heroTitle: 'Judul Kartu Downloader Baru',
    heroDescription: 'Deskripsi kartu downloader tersinkron dari Panel Admin.',
  });
  next.utilities.musicHero.title = 'YouTube Music Pro — Lagu Viral Indonesia';
  next.utilities.musicHero.icon = './assets/logos/uploads/util-music-hero.png';

  const dlItem = next.utilities.items.find((i) => i.id === 'downloader');
  assert.equal(dlItem.label, 'Unduh Sosmed');
  assert.equal(dlItem.pageTitle, 'Downloader All-in-One Pro');
  assert.equal(dlItem.heroKicker, 'Caption Baru Downloader');
  assert.equal(dlItem.heroTitle, 'Judul Kartu Downloader Baru');
  assert.equal(dlItem.heroDescription, 'Deskripsi kartu downloader tersinkron dari Panel Admin.');

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
    diff.some((d) => d.includes('Memperbarui caption kartu utilitas "Unduh Sosmed"')),
    true
  );
  assert.equal(
    diff.some((d) => d.includes('Mengubah judul kartu fitur "Unduh Sosmed" menjadi "Judul Kartu Downloader Baru"')),
    true
  );
  assert.equal(
    diff.some((d) => d.includes('Memperbarui deskripsi kartu fitur "Unduh Sosmed"')),
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

test('music v35 blocks and strips 30-second Apple iTunes preview URLs, enforces full-length (>=75s) streams, prioritizes non-gcr=id Ummy streams, and manages PiP + Headset mode state transitions', () => {
  const previewUrl =
    'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/bc/89/94/mzaf_17584604111107113811.plus.aac.p.m4a';
  const fullAudiusUrl = 'https://api.audius.co/v1/tracks/Nlzyaxp/stream?app_name=Manifestudio';

  assert.equal(isInstantAudioPreviewUrl(previewUrl), true);
  assert.equal(isBlockedAudioWrapperUrl(previewUrl), true);
  assert.equal(isInstantAudioPreviewUrl(fullAudiusUrl), false);
  assert.equal(isBlockedAudioWrapperUrl(fullAudiusUrl), false);

  // Standalone 30-second iTunes preview without a full-length YouTube videoId is rejected
  const standaloneItunes = normalizeItunesTrack({
    trackId: 1581234567,
    trackName: 'Tanpa Cinta',
    artistName: 'Yovie Widianto & Tiara Andini',
    trackTimeMillis: 251000,
    previewUrl,
  });
  assert.equal(standaloneItunes, null);

  // If a saved track in localStorage had a 30s preview streamUrl alongside a valid videoId,
  // normalizeYtMusicTrack strips the 30s preview URL so full-length YouTube/Audius resolution takes over
  const sanitizedTrack = normalizeYtMusicTrack({
    videoId: '2e0BMACvymo',
    title: 'Stecu Stecu',
    artist: 'Faris Adam',
    duration: 229,
    streamUrl: previewUrl,
  });
  assert.ok(sanitizedTrack);
  assert.equal(sanitizedTrack.videoId, '2e0BMACvymo');
  assert.equal(sanitizedTrack.streamUrl, '');

  // Stream cache sanitizer drops 30-second preview URLs while keeping full-length streams
  const prunedCache = pruneAndSerializeStreamCache({
    '2e0BMACvymo': { url: previewUrl, savedAt: Date.now() },
    'En-EHqRk8yg': { url: fullAudiusUrl, savedAt: Date.now() },
  });
  assert.equal(Boolean(prunedCache['2e0BMACvymo']), false);
  assert.equal(prunedCache['En-EHqRk8yg']?.url, fullAudiusUrl);
  assert.equal(
    getValidCachedStreamUrl({ '2e0BMACvymo': { url: previewUrl, savedAt: Date.now() } }, '2e0BMACvymo'),
    ''
  );

  // Strict audio match rejects 30s preview candidates and accepts full-length Audius candidates
  const targetTrack = normalizeYtMusicTrack({
    videoId: 'En-EHqRk8yg',
    title: 'Garam & Madu (Sakit Dadaku)',
    artist: 'Tenxi, Naykilla & Jemsii',
    duration: 251,
  });
  const fakePreviewCand = {
    id: 'itn-1',
    title: 'Garam & Madu (Sakit Dadaku)',
    artist: 'Tenxi, Naykilla & Jemsii',
    duration: 251,
    streamUrl: previewUrl,
  };
  const validAudiusCand = normalizeYtMusicTrack({
    id: 'aud-Nlzyaxp',
    title: 'Garam & Madu (Sakit Dadaku)',
    artist: 'Tenxi, Naykilla & Jemsii',
    duration: 251,
    streamUrl: fullAudiusUrl,
  });
  assert.equal(isStrictAudioMatch(targetTrack, fakePreviewCand), false);
  assert.equal(isStrictAudioMatch(targetTrack, validAudiusCand), true);

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

  // Toggling Headset mode off and on when PiP is closed works cleanly
  const toggledOff = resolvePipHeadsetStateTransition({
    isPipOpen: false,
    pipHeadsetMode: true,
    isPlaying: true,
    action: 'toggle-headset',
  });
  assert.equal(toggledOff.pipHeadsetMode, false);
  assert.equal(toggledOff.isPipOpen, false);
  const toggledOn = resolvePipHeadsetStateTransition({
    isPipOpen: false,
    pipHeadsetMode: false,
    isPlaying: true,
    action: 'toggle-headset',
  });
  assert.equal(toggledOn.pipHeadsetMode, true);
  assert.equal(toggledOn.isPipOpen, false);
});

test('normalizeYtMusicTrack parses nested Siputzx duration objects and rankSearchResults preserves all YouTube search hits (Indonesian, international & translated titles)', () => {
  // Siputzx /api/s/youtube returns duration: { seconds: 248, timestamp: '4:08' }
  const alGhazaliRaw = {
    type: 'video',
    videoId: 'PlK_crOqt64',
    title: 'Al Ghazali - Lagu Galau (Official Music Video) | Soundtrack Anak Jalanan',
    author: { name: 'Pelangi Records' },
    duration: { seconds: 248, timestamp: '4:08' },
    timestamp: '4:08',
  };
  const normAl = normalizeYtMusicTrack(alGhazaliRaw, { fromYtSearch: true });
  assert.ok(normAl);
  assert.equal(normAl.duration, 248);
  assert.equal(normAl.fromYtSearch, true);
  assert.equal(normAl.artworkFallback, './assets/icons/brand-icon.svg');

  // Skip Mix / Playlist items that have no duration
  const mixRow = normalizeYtMusicTrack({
    type: 'mix',
    videoId: 'PlK_crOqt64',
    title: 'Mix - Al Ghazali - Lagu Galau',
  });
  assert.equal(mixRow, null);

  // Test "Hati butuh kepastian" where YouTube auto-translates titles or matches via lyrics
  const hatiCandidates = [
    normalizeYtMusicTrack(
      {
        videoId: 'hK9LzAhg75Y',
        title: 'DJ HEART NEEDS CERTAINTY X MY HEART MY HEART - FALLING IN LOVE VIRAL TIKTOK LATEST 2026',
        author: { name: 'Ratu Stecu' },
        duration: { seconds: 514, timestamp: '8:34' },
      },
      { fromYtSearch: true }
    ),
    normalizeYtMusicTrack(
      {
        videoId: 'fXwBsUdnmCk',
        title: 'Lirik lagu “aku jatuh cinta” Raden Rakha feat Basmalah Gralind',
        author: { name: '_liriklagu' },
        duration: { seconds: 280, timestamp: '4:40' },
      },
      { fromYtSearch: true }
    ),
    normalizeYtMusicTrack(
      {
        videoId: '58KVjo_9M_E',
        title: 'DJ HATI BUTUH KEPASTIAN X MY HEART - DJ JATUH CINTA ( BOOTLEG )',
        author: { name: 'djprincefvnky' },
        duration: { seconds: 511, timestamp: '8:31' },
      },
      { fromYtSearch: true }
    ),
  ];
  const rankedHati = rankSearchResults(hatiCandidates, 'Hati butuh kepastian', 75, {
    allowYoutubeSearchOrder: true,
  });
  assert.equal(rankedHati.length, 3);
  // Exact Indonesian title match ranks #1, while translated/lyric YouTube matches are still preserved!
  assert.equal(rankedHati[0].videoId, '58KVjo_9M_E');

  // Test "Dua cincin", "Lagu galau al ghazali", "Last child duka", and international "Bruno Mars Die With A Smile"
  const duaCincin = normalizeYtMusicTrack(
    {
      videoId: 'QrupIQIGIqI',
      title: 'Hello - Dua Cincin (Official Music Video NAGASWARA) #music',
      author: { name: 'NAGASWARA Official Video Indonesian Music Channel' },
      duration: { seconds: 276, timestamp: '4:36' },
    },
    { fromYtSearch: true }
  );
  assert.equal(rankSearchResults([duaCincin], 'Dua cincin', 75, { allowYoutubeSearchOrder: true }).length, 1);
  assert.equal(rankSearchResults([normAl], 'Lagu galau al ghazali', 75, { allowYoutubeSearchOrder: true }).length, 1);

  const bruno = normalizeYtMusicTrack(
    {
      videoId: 'kPa7bsKwL-c',
      title: 'Lady Gaga, Bruno Mars - Die With A Smile (Official Music Video)',
      author: { name: 'Lady Gaga' },
      duration: { seconds: 253, timestamp: '4:13' },
    },
    { fromYtSearch: true, isIndonesianViral: false }
  );
  assert.equal(
    rankSearchResults([bruno], 'Bruno Mars Die With A Smile', 75, { allowYoutubeSearchOrder: true }).length,
    1
  );
  // Previous search tracks merged into pool must NOT leak into an unrelated subsequent query when allowYoutubeSearchOrder is false
  assert.equal(
    rankSearchResults([bruno, normAl], 'Last child duka', 75, { allowYoutubeSearchOrder: false }).length,
    0
  );
});

test('background audio persistence helpers: clean lookup query, Safari m4a/mp4 codec priority, silent-hold bridge state, and non-poisoning of YouTube IDs on 3P stream failure', () => {
  // 1. buildCleanAudioLookupQuery strips parentheticals, pipes, and duplicate artist prefixes
  const cleanQ = buildCleanAudioLookupQuery({
    title: 'Al Ghazali - Lagu Galau (Official Music Video) | Soundtrack Anak Jalanan',
    artist: 'Al Ghazali',
  });
  assert.equal(cleanQ, 'Al Ghazali Lagu Galau');

  const cleanDuka = buildCleanAudioLookupQuery({
    title: 'Last Child - Duka (Official Lyric Video)',
    artist: 'LAST CHILD',
  });
  assert.equal(cleanDuka, 'Last Child Duka');

  // 2. selectUmmyAudioStreamCandidates prioritizes mp4 over opus when canPlayOpus === false (e.g. iOS Safari)
  const ummyPayload = {
    data: {
      url: [
        {
          url: 'https://vidsnap.app/proxy?url=https%3A%2F%2Frr1.googlevideo.com%2Fvideoplayback%3Fitag%3D251%26mime%3Daudio%252Fwebm',
          ext: 'opus',
          type: 'opus (160 Kbps)',
          no_audio: false,
        },
        {
          url: 'https://vidsnap.app/proxy?url=https%3A%2F%2Frr1.googlevideo.com%2Fvideoplayback%3Fitag%3D18%26mime%3Dvideo%252Fmp4',
          ext: 'mp4',
          type: 'mp4 (360p)',
          no_audio: false,
        },
      ],
    },
  };
  const chromeOrder = selectUmmyAudioStreamCandidates(ummyPayload, { canPlayOpus: true });
  const safariOrder = selectUmmyAudioStreamCandidates(ummyPayload, { canPlayOpus: false });
  assert.equal(chromeOrder[0].includes('itag%3D251'), true);
  assert.equal(safariOrder[0].includes('itag%3D18'), true);

  // 3. shouldKeepSilentHoldBridgeActive keeps #music-audio-el unlocked while resolving or while yt-iframe plays
  assert.equal(
    shouldKeepSilentHoldBridgeActive({
      activeEngine: 'audio-el',
      isPlaying: true,
      isLoading: true,
      explicitPaused: false,
      hasActiveRealAudioStream: false,
    }),
    true
  );
  assert.equal(
    shouldKeepSilentHoldBridgeActive({
      activeEngine: 'yt-iframe',
      isPlaying: true,
      isLoading: false,
      explicitPaused: false,
      hasActiveRealAudioStream: false,
    }),
    true
  );
  assert.equal(
    shouldKeepSilentHoldBridgeActive({
      activeEngine: 'audio-el',
      isPlaying: true,
      isLoading: false,
      explicitPaused: false,
      hasActiveRealAudioStream: true,
    }),
    false
  );
  assert.equal(
    shouldKeepSilentHoldBridgeActive({
      activeEngine: 'yt-iframe',
      isPlaying: false,
      isLoading: false,
      explicitPaused: true,
      hasActiveRealAudioStream: false,
    }),
    false
  );

  // 4. shouldPoisonExactYoutubeIdOnError never poisons YouTube videoId when a 3P Audius stream fails
  assert.equal(
    shouldPoisonExactYoutubeIdOnError({
      videoId: 'fKRtnMYMW08',
      failedStreamUrl: 'https://api.audius.co/v1/tracks/WEjzjgB/stream?app_name=manifestudio_katalog',
    }),
    false
  );
  assert.equal(
    shouldPoisonExactYoutubeIdOnError({
      videoId: 'fKRtnMYMW08',
      failedStreamUrl:
        'https://vidsnap.app/proxy?url=https%3A%2F%2Frr2.googlevideo.com%2Fvideoplayback%3Fitag%3D18',
    }),
    true
  );
});

test('music v39 helpers: Tioo stream priority, silent-hold PCM micro-dither, real-time YT Music category trends, and loading progress normalization', () => {
  // 1. selectTiooAudioStreamCandidates prioritizes non-gcr=id and mp3/audio over mp4
  const tiooRanked = selectTiooAudioStreamCandidates({
    mp4: 'https://rr1.googlevideo.com/videoplayback?itag=18&gcr=id',
    mp3: 'https://cdn.tioo.eu.org/dl/song-global.mp3',
    audio: 'https://rr2.googlevideo.com/videoplayback?itag=251',
    result: {
      mp3: 'https://ytshortdown.com/redirect', // blocked wrapper filtered out
    },
  });
  assert.equal(tiooRanked.length, 3);
  assert.equal(tiooRanked[0], 'https://cdn.tioo.eu.org/dl/song-global.mp3');
  assert.equal(tiooRanked.some((u) => u.includes('ytshortdown.com')), false);
  // Raw googlevideo URL is wrapped via vidsnap proxy and non-gcr=id beats gcr=id
  assert.equal(tiooRanked[1].includes('vidsnap.app/proxy'), true);
  assert.equal(decodeURIComponent(tiooRanked[1]).includes('gcr=id'), false);
  assert.equal(decodeURIComponent(tiooRanked[2]).includes('gcr=id'), true);

  // 2. getSilentHoldPcmSample stays within [127, 129] around 128 midpoint while oscillating (not flat silence)
  const samples = Array.from({ length: 200 }, (_, i) => getSilentHoldPcmSample(i, 8000));
  assert.equal(samples.every((s) => s >= 127 && s <= 129), true);
  assert.equal(samples.some((s) => s === 129), true);
  assert.equal(samples.some((s) => s === 127), true);

  // 3. mergeRealtimeTrendCategories updates live trend queries, hot badges, and trendChips
  const baseCats = [
    { id: 'trending-live', label: 'Trending Live', iconKey: 'flame', queries: ['top hits indo'], keywords: ['viral'] },
    { id: 'dj-remix', label: 'DJ Remix TikTok', iconKey: 'disc', queries: ['dj remix'], keywords: ['dj', 'jedag'] },
    { id: 'lofi-focus', label: 'Lo-Fi & Fokus', iconKey: 'coffee', queries: ['lofi'], keywords: ['lofi', 'study'] },
  ];
  const merged = mergeRealtimeTrendCategories(baseCats, {
    ytTrendItems: [
      { title: 'DJ Garam & Madu (Remix Viral)', artist: 'Tenxi - Topic' },
      { title: 'Bernadya - Satu Bulan (Live)', artist: 'Bernadya' },
    ],
    audiusTrending: [{ title: 'Midnight Drive', artist: 'Kairo', genre: 'Electronic' }],
    syncedAt: 1731900000000,
  });
  const liveCat = merged.categories.find((c) => c.id === 'trending-live');
  const djCat = merged.categories.find((c) => c.id === 'dj-remix');
  const lofiCat = merged.categories.find((c) => c.id === 'lofi-focus');
  assert.equal(liveCat?.isLiveTrend, true);
  assert.equal(liveCat?.queries[0].includes('Tenxi'), true);
  assert.equal(djCat?.isHot, true);
  assert.equal(Boolean(lofiCat?.isHot), false);
  assert.ok(merged.trendChips.length >= 3);
  assert.equal(merged.updatedAt, 1731900000000);

  // 4. getLoadingProgressMeta normalizes active phases and clamps percentages to [8, 99]
  const idleMeta = getLoadingProgressMeta({ isSearching: false, isLoading: false, isSyncingTrends: false });
  assert.equal(idleMeta.active, false);
  assert.equal(idleMeta.percent, 0);

  const searchMeta = getLoadingProgressMeta({ isSearching: true, phase: 'searching', progress: 140 });
  assert.equal(searchMeta.active, true);
  assert.equal(searchMeta.phase, 'searching');
  assert.equal(searchMeta.percent, 99);

  const catMeta = getLoadingProgressMeta({ isSearching: true, phase: 'category', progress: 2 });
  assert.equal(catMeta.active, true);
  assert.equal(catMeta.phase, 'category');
  assert.equal(catMeta.percent, 8);
});

test('50. filterPresetCategoryTracks, buildAudiusLookupQueries, and pickBackgroundSafeNextTrack prevent 2-hour mixes & background stalls', () => {
  const tracks = [
    { id: 'mix-1', videoId: 'vid-mix', title: 'Lagu Galau Indonesia Terbaru 2 Jam Nonstop', artist: 'Kompilasi Channel', duration: 6828 },
    { id: 'short-1', videoId: 'vid-short', title: 'Teaser 30s', artist: 'Artist', duration: 30 },
    { id: 'song-1', videoId: 'vid-1', title: 'Satu Bulan', artist: 'Bernadya', duration: 205 },
    { id: 'song-2', videoId: 'vid-2', title: 'Sial', artist: 'Mahalini', duration: 243 },
    { id: 'song-3', videoId: 'vid-3', title: 'Garam & Madu', artist: 'Tenxi', duration: 190 },
    { id: 'song-4', videoId: 'vid-4', title: 'Untungnya Hidup Harus Tetap Berjalan', artist: 'Bernadya', duration: 184 },
  ];
  const filtered = filterPresetCategoryTracks(tracks, { minSeconds: MIN_FULL_TRACK_SECONDS, maxSeconds: 900 });
  assert.equal(filtered.length, 4);
  assert.equal(filtered.some((t) => t.id === 'mix-1'), false);
  assert.equal(filtered.some((t) => t.id === 'short-1'), false);

  const queries = buildAudiusLookupQueries({
    title: 'Duka (Official Music Video) | Live Session',
    artist: 'Last Child Official Records',
  });
  assert.ok(queries.length >= 1 && queries.length <= 2);
  assert.equal(queries.some((q) => /duka/i.test(q)), true);
  assert.equal(queries.some((q) => /records|official/i.test(q)), false);

  const bgQueue = [
    { id: 'bg-cur', videoId: 'v-cur', title: 'Lagu 1', artist: 'Artis 1', duration: 200, streamUrl: 'https://api.audius.co/v1/tracks/cur/stream?app_name=Manifestudio' },
    { id: 'bg-no-stream', videoId: 'v-ns', title: 'Lagu 2 (Iframe Only)', artist: 'Artis 2', duration: 210, streamUrl: null },
    { id: 'bg-ready', videoId: 'v-ready', title: 'Lagu 3 (Native Audio)', artist: 'Artis 3', duration: 225, streamUrl: 'https://api.audius.co/v1/tracks/ready/stream?app_name=Manifestudio' },
  ];
  const hiddenPick = pickBackgroundSafeNextTrack({
    currentTrack: bgQueue[0],
    queue: bgQueue,
    isHidden: true,
    shuffle: false,
    repeatMode: 'all',
  });
  assert.equal(hiddenPick?.id, 'bg-ready');
});

test('51. isMobileTouchPlatform & shouldStopSilentHoldAndPauseNotification never pause desktop/laptop background playback', () => {
  assert.equal(
    isMobileTouchPlatform(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36',
      'Win32',
      0
    ),
    false
  );
  assert.equal(
    isMobileTouchPlatform(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36',
      'MacIntel',
      0
    ),
    false
  );
  assert.equal(
    isMobileTouchPlatform(
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36',
      'Linux armv8l',
      5
    ),
    true
  );
  assert.equal(
    isMobileTouchPlatform(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15',
      'MacIntel',
      5
    ),
    true
  );

  // Desktop/laptop browsers MUST keep yt-iframe playing across tab switches & minimize
  assert.equal(
    shouldStopSilentHoldAndPauseNotification({
      activeEngine: 'yt-iframe',
      isSilentHold: true,
      resolvedStreamUrl: '',
      isHidden: true,
      explicitPaused: false,
      timedOutOrFailed: true,
      isDesktopBrowser: true,
      ytPlayerState: 1,
    }),
    false
  );
  assert.equal(
    shouldStopSilentHoldAndPauseNotification({
      activeEngine: 'yt-iframe',
      isSilentHold: true,
      resolvedStreamUrl: '',
      isHidden: true,
      explicitPaused: false,
      timedOutOrFailed: true,
      isDesktopBrowser: true,
      ytPlayerState: -1,
    }),
    false
  );

  // Active YT player (state 1 or 3) should never be killed; stalled mobile yt-iframe cleanly stops silent hold
  assert.equal(
    shouldStopSilentHoldAndPauseNotification({
      activeEngine: 'yt-iframe',
      isSilentHold: true,
      resolvedStreamUrl: '',
      isHidden: true,
      explicitPaused: false,
      timedOutOrFailed: true,
      isDesktopBrowser: false,
      ytPlayerState: 1,
    }),
    false
  );
  assert.equal(
    shouldStopSilentHoldAndPauseNotification({
      activeEngine: 'yt-iframe',
      isSilentHold: true,
      resolvedStreamUrl: '',
      isHidden: true,
      explicitPaused: false,
      timedOutOrFailed: true,
      isDesktopBrowser: false,
      ytPlayerState: 2,
    }),
    true
  );
});

test('52. Real Open-Source Media Compressor & FFmpeg Transcode/Compress Argument Builders produce valid args and lossless MP4 atom cleanup', () => {
  const weservUrl = buildOpenSourceWeservCompressUrl('https://manifestudio.my.id/assets/hero-banner.jpg', {
    width: 1080,
    height: 1080,
    quality: 74,
    output: 'webp',
  });
  assert.ok(weservUrl.startsWith('https://wsrv.nl/?'));
  assert.ok(weservUrl.includes('q=74'));
  assert.ok(weservUrl.includes('output=webp'));

  // UPNG-inspired RGBA palette quantization reduces entropy and detects alpha accurately
  const opaquePixels = new Uint8Array([123, 211, 89, 255, 125, 213, 91, 255]);
  const qOpaque = quantizeRgbaBufferOpenSource(opaquePixels, 5);
  assert.equal(qOpaque.hasAlpha, false);
  assert.equal(qOpaque.quantized[0], qOpaque.quantized[4]);

  const alphaPixels = new Uint8Array([123, 211, 89, 128, 125, 213, 91, 255]);
  const qAlpha = quantizeRgbaBufferOpenSource(alphaPixels, 5);
  assert.equal(qAlpha.hasAlpha, true);

  // Lossless MP4 atom stripping removes padding ('free') without corrupting mdat media samples
  const mdatPayload = new Uint8Array(200).fill(0x55);
  const sampleMp4 = new Uint8Array(8 + 8 + 8 + mdatPayload.length);
  const dv = new DataView(sampleMp4.buffer);
  dv.setUint32(0, 8, false);
  sampleMp4.set([0x66, 0x74, 0x79, 0x70], 4);
  dv.setUint32(8, 8, false);
  sampleMp4.set([0x66, 0x72, 0x65, 0x65], 12);
  dv.setUint32(16, 8 + mdatPayload.length, false);
  sampleMp4.set([0x6d, 0x64, 0x61, 0x74], 20);
  sampleMp4.set(mdatPayload, 24);

  const strippedMp4 = new Uint8Array(stripMp4AtomsLossless(sampleMp4.buffer));
  assert.equal(strippedMp4.byteLength, 8 + 8 + mdatPayload.length);
  assert.equal(String.fromCharCode(strippedMp4[4], strippedMp4[5], strippedMp4[6], strippedMp4[7]), 'ftyp');
  assert.equal(String.fromCharCode(strippedMp4[12], strippedMp4[13], strippedMp4[14], strippedMp4[15]), 'mdat');

  // Verify real FFmpeg WebAssembly CLI transcoding arguments for audio, video, and frame extraction
  assert.deepEqual(buildFfmpegTranscodeArgs('in.mp4', 'out.mp3', 'mp3'), [
    '-i', 'in.mp4', '-vn', '-c:a', 'libmp3lame', '-b:a', '192k', '-ar', '44100', '-ac', '2', '-y', 'out.mp3',
  ]);
  const m4aArgs = buildFfmpegTranscodeArgs('in.mp4', 'out.m4a', 'm4a');
  assert.ok(m4aArgs.includes('aac') && m4aArgs.includes('+faststart') && m4aArgs.includes('ipod'));
  const mp4aArgs = buildFfmpegTranscodeArgs('in.mp4', 'out.m4a', 'mp4a');
  assert.deepEqual(mp4aArgs, m4aArgs);
  assert.ok(buildFfmpegTranscodeArgs('in.mp4', 'out.aac', 'aac').includes('adts'));
  assert.ok(buildFfmpegTranscodeArgs('in.mp4', 'out.wav', 'wav').includes('pcm_s16le'));
  assert.ok(buildFfmpegTranscodeArgs('in.mp4', 'out.ogg', 'ogg').includes('libvorbis'));
  assert.ok(buildFfmpegTranscodeArgs('in.mp4', 'out.flac', 'flac').includes('flac'));
  assert.ok(buildFfmpegTranscodeArgs('in.mov', 'out.mp4', 'mp4').includes('libx264'));
  assert.ok(buildFfmpegTranscodeArgs('in.mp4', 'out.webm', 'webm').includes('libvpx'));
  assert.ok(buildFfmpegTranscodeArgs('in.mp4', 'out.gif', 'gif').some((a) => a.includes('lanczos')));
  assert.ok(buildFfmpegTranscodeArgs('in.mp4', 'out.jpg', 'jpg').includes('-frames:v'));

  // Verify real FFmpeg H.264/AAC video compression arguments ensure even dimensions & +faststart
  const vArgs = buildFfmpegVideoCompressArgs('src.mp4', 'cmp.mp4', {
    methodId: 'social-shield',
    targetWidth: 1081,
    targetHeight: 1921,
    targetVideoMbps: 4.5,
    tighterPass: false,
  });
  assert.ok(vArgs.includes('libx264'));
  assert.ok(vArgs.includes('yuv420p'));
  assert.ok(vArgs.includes('aac'));
  assert.ok(vArgs.includes('+faststart'));
  const vfVal = vArgs[vArgs.indexOf('-vf') + 1];
  assert.ok(vfVal.includes('1082') && vfVal.includes('1922') && vfVal.includes('trunc(iw/2)*2'));
  const vArgsPass2 = buildFfmpegVideoCompressArgs('src.mp4', 'cmp2.mp4', {
    methodId: 'aggressive-slim',
    targetWidth: 720,
    targetHeight: 1280,
    targetVideoMbps: 2.0,
    tighterPass: true,
  });
  assert.equal(vArgsPass2[vArgsPass2.indexOf('-crf') + 1], '33');
});

test('53. Universal File Converter (converter.js) converts DOCX->PDF, Excel->PDF/CSV/JSON, PDF->JPG/PNG/TXT, JPG->PNG/ZIP, and MP4->M4A/WAV with verified binary signatures', async () => {
  assert.ok(CONVERTER_CATEGORIES.length >= 5);
  assert.ok(CONVERTER_PRESETS.length >= 12);

  // 1. DOCX -> PDF
  const docxFile = await createSampleFileForConversion('docx-to-pdf');
  const parsedDocx = await parseDocxBuffer(await docxFile.arrayBuffer());
  assert.ok(parsedDocx.paragraphs.length >= 3);
  assert.ok(parsedDocx.tables.length >= 1);

  const docxToPdf = await convertAnyFile(docxFile, { targetFormat: 'pdf' });
  assert.equal(docxToPdf.verified, true);
  assert.equal(docxToPdf.targetFormat, 'PDF');
  assert.ok(docxToPdf.outputBytes > 250);
  assert.ok(docxToPdf.signatureLabel.includes('%PDF-1.4'));

  // 2. Excel (.xlsx) -> PDF, CSV, and JSON
  const excelFile = await createSampleFileForConversion('excel-to-pdf');
  const parsedRows = await parseExcelBuffer(await excelFile.arrayBuffer(), excelFile.name);
  assert.equal(parsedRows.length, 5);
  assert.equal(parsedRows[1][1], 'Canva Pro 1 Tahun Full Garansi');

  const excelToPdf = await convertAnyFile(excelFile, { targetFormat: 'pdf' });
  assert.equal(excelToPdf.verified, true);
  assert.equal(excelToPdf.targetFormat, 'PDF');
  assert.ok(excelToPdf.signatureLabel.includes('%PDF-1.4'));

  const excelToCsv = await convertAnyFile(excelFile, { targetFormat: 'csv' });
  const csvText = await excelToCsv.blob.text();
  assert.ok(csvText.includes('Canva Pro 1 Tahun Full Garansi'));

  const excelToJson = await convertAnyFile(excelFile, { targetFormat: 'json' });
  const jsonRecords = JSON.parse(await excelToJson.blob.text());
  assert.equal(jsonRecords.length, 4);
  assert.equal(jsonRecords[0]['ID Produk'], 'MF-01');

  // 3. PDF -> JPG, PNG, and TXT
  const pdfFile = await createSampleFileForConversion('pdf-to-jpg');
  const pdfLines = extractTextFromPdfBuffer(await pdfFile.arrayBuffer());
  assert.ok(pdfLines.some((l) => l.includes('Manifestudio')));

  const pdfToJpg = await convertAnyFile(pdfFile, { targetFormat: 'jpg' });
  assert.equal(pdfToJpg.verified, true);
  assert.equal(pdfToJpg.targetFormat, 'JPG');

  const pdfToPng = await convertAnyFile(pdfFile, { targetFormat: 'png' });
  assert.equal(pdfToPng.verified, true);
  assert.equal(pdfToPng.targetFormat, 'PNG');

  // 4. Image -> PNG, JPEG, ICO, PDF, and ZIP (with PKZIP roundtrip extraction!)
  const sampleImg = await createSampleFileForConversion('jpg-to-png');
  const imgToPng = await convertAnyFile(sampleImg, { targetFormat: 'png' });
  assert.equal(imgToPng.verified, true);
  assert.equal(imgToPng.targetFormat, 'PNG');

  const imgToIco = await convertAnyFile(sampleImg, { targetFormat: 'ico' });
  assert.equal(imgToIco.verified, true);
  assert.equal(imgToIco.targetFormat, 'ICO');

  const imgToZip = await convertAnyFile(sampleImg, { targetFormat: 'zip' });
  assert.equal(imgToZip.verified, true);
  assert.equal(imgToZip.targetFormat, 'ZIP');
  const extractedEntries = await extractZipEntries(await imgToZip.blob.arrayBuffer());
  assert.equal(extractedEntries.has(sampleImg.name), true);
  assert.equal(extractedEntries.get(sampleImg.name).byteLength, sampleImg.size);

  // 5. MP4 -> M4A (MP4A) and MP4 -> WAV
  const mp4File = await createSampleFileForConversion('mp4-to-m4a');
  const mp4ToM4a = await convertAnyFile(mp4File, { targetFormat: 'm4a' });
  assert.equal(mp4ToM4a.verified, true);
  assert.equal(mp4ToM4a.targetFormat, 'M4A');
  assert.ok(mp4ToM4a.signatureLabel.includes('ftypM4A'));

  const mp4ToWav = await convertAnyFile(mp4File, { targetFormat: 'wav' });
  assert.equal(mp4ToWav.verified, true);
  assert.equal(mp4ToWav.targetFormat, 'WAV');
  assert.ok(mp4ToWav.signatureLabel.includes('RIFF WAVE'));
});

test('54. Expanded Multi-Format Converter supports RTF/MD/HTML/TSV/XML/YAML/BMP/GIF/SVG/MP3/AAC/OGG/FLAC/WEBM, ZIP inspection, magic-byte auto-detect, and percentage onProgress', async () => {
  // 1. Magic-byte auto-detection even when file extension is missing
  const pdfBuf = buildPdfDocumentBuffer({ title: 'Magic Check', paragraphs: ['Baris Uji PDF'] });
  const detectedPdf = detectSourceFormat('lampiran_tanpa_ekstensi', '', new Uint8Array(pdfBuf.slice(0, 16)));
  assert.equal(detectedPdf.ext, 'pdf');
  assert.equal(detectedPdf.family, 'pdf');

  // Verify dropdown targets exclude source format itself and include expanded formats
  const imgTargets = getAvailableTargetFormats({ ext: 'jpg', family: 'image' }).map((t) => t.id);
  assert.equal(imgTargets.includes('jpg'), false);
  for (const expected of ['png', 'jpeg', 'webp', 'bmp', 'gif', 'ico', 'svg', 'pdf', 'html', 'txt', 'zip']) {
    assert.equal(imgTargets.includes(expected), true, `Expected image target ${expected}`);
  }

  // 2. DOCX -> RTF, MD, HTML, XML, YAML + Progress callback verification
  const progressEvents = [];
  const docxFile = await createSampleFileForConversion('docx-to-pdf');
  const docxToRtf = await convertAnyFile(docxFile, {
    targetFormat: 'rtf',
    onProgress: (p) => progressEvents.push(p.percent),
  });
  assert.equal(docxToRtf.verified, true);
  assert.equal(docxToRtf.targetFormat, 'RTF');
  assert.ok((await docxToRtf.blob.text()).startsWith('{\\rtf1'));
  assert.ok(progressEvents.length >= 3);
  assert.equal(progressEvents[progressEvents.length - 1], 100);

  const docxToMd = await convertAnyFile(docxFile, { targetFormat: 'md' });
  assert.equal(docxToMd.verified, true);
  assert.ok((await docxToMd.blob.text()).includes('# proposal-katalog-manifestudio.docx'));

  const docxToHtml = await convertAnyFile(docxFile, { targetFormat: 'html' });
  assert.equal(docxToHtml.verified, true);
  assert.ok((await docxToHtml.blob.text()).includes('<!DOCTYPE html>'));

  // 3. Excel -> TSV, XML, YAML, and roundtrip XML/YAML -> XLSX/JSON
  const excelFile = await createSampleFileForConversion('excel-to-pdf');
  const excelToTsv = await convertAnyFile(excelFile, { targetFormat: 'tsv' });
  assert.equal(excelToTsv.verified, true);
  assert.ok((await excelToTsv.blob.text()).includes('\t'));

  const excelToXml = await convertAnyFile(excelFile, { targetFormat: 'xml' });
  const xmlText = await excelToXml.blob.text();
  assert.ok(xmlText.includes('<dataset'));
  assert.ok(xmlText.includes('<record>'));

  const xmlFile = new File([xmlText], 'data-produk.xml', { type: 'application/xml' });
  const xmlToJson = await convertAnyFile(xmlFile, { targetFormat: 'json' });
  const xmlJsonParsed = JSON.parse(await xmlToJson.blob.text());
  assert.equal(xmlJsonParsed.length, 4);
  assert.equal(xmlJsonParsed[0].ID_Produk, 'MF-01');

  const excelToYaml = await convertAnyFile(excelFile, { targetFormat: 'yaml' });
  const yamlText = await excelToYaml.blob.text();
  assert.ok(yamlText.includes('items:'));
  const yamlFile = new File([yamlText], 'config-produk.yaml', { type: 'application/x-yaml' });
  const yamlToXlsx = await convertAnyFile(yamlFile, { targetFormat: 'xlsx' });
  assert.equal(yamlToXlsx.verified, true);
  const parsedYamlRows = await parseExcelBuffer(await yamlToXlsx.blob.arrayBuffer(), 'out.xlsx');
  assert.equal(parsedYamlRows.length, 5);

  // 4. Image -> BMP, GIF, SVG, PDF, HTML, TXT
  const sampleImg = await createSampleFileForConversion('jpg-to-png');
  for (const target of ['bmp', 'gif', 'svg', 'pdf', 'html', 'txt']) {
    const out = await convertAnyFile(sampleImg, { targetFormat: target });
    assert.equal(out.verified, true, `Image conversion to ${target} must verify`);
    assert.equal(out.targetFormat, target.toUpperCase());
  }

  // 5. MP4 -> MP3, AAC, OGG, FLAC, WEBM, MP4A
  const mp4File = await createSampleFileForConversion('mp4-to-m4a');
  for (const target of ['mp3', 'aac', 'ogg', 'flac', 'webm', 'mp4a']) {
    const out = await convertAnyFile(mp4File, { targetFormat: target });
    assert.equal(out.verified, true, `Media conversion to ${target} must verify`);
    assert.equal(out.targetFormat, target.toUpperCase());
  }

  // 6. ZIP archive -> PDF / JSON / CSV inspection
  const zipBuf = createZipArchive([
    { name: 'catatan.txt', data: 'Halo Manifestudio Converter' },
    { name: 'info.json', data: '{"ok":true}' },
  ]);
  const zipFile = new File([zipBuf], 'arsip-uji.zip', { type: 'application/zip' });
  const zipToJson = await convertAnyFile(zipFile, { targetFormat: 'json' });
  const zipRecords = JSON.parse(await zipToJson.blob.text());
  assert.equal(zipRecords.length, 2);
  assert.equal(zipRecords[0]['Nama Berkas di Dalam ZIP'], 'catatan.txt');

  const zipToPdf = await convertAnyFile(zipFile, { targetFormat: 'pdf' });
  assert.equal(zipToPdf.verified, true);
  assert.ok(zipToPdf.signatureLabel.includes('%PDF-1.4'));
});

test('55. Multi-Engine Song & Video Identifier (song-finder.js) auto-detects audio vs video, parses ID3/MP4 tags, computes acoustic fingerprints, ranks song matches, and generates music + social video similarity links', () => {
  // 1. Magic-byte auto-detection between Audio (MP3/M4A/WAV) and Video (MP4/WebM)
  const mp3Header = new Uint8Array([0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
  const detectedMp3 = detectMediaFileKind('clip_misterius.bin', '', mp3Header);
  assert.equal(detectedMp3.mediaKind, 'audio');
  assert.equal(detectedMp3.ext, 'mp3');

  const mp4VideoHeader = new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);
  const detectedMp4 = detectMediaFileKind('tren-tiktok-viral.mp4', 'video/mp4', mp4VideoHeader);
  assert.equal(detectedMp4.mediaKind, 'video');
  assert.equal(detectedMp4.ext, 'mp4');

  const m4aAudioHeader = new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x4d, 0x34, 0x41, 0x20]);
  const detectedM4a = detectMediaFileKind('rekaman-suara.m4a', 'audio/mp4', m4aAudioHeader);
  assert.equal(detectedM4a.mediaKind, 'audio');
  assert.equal(detectedM4a.ext, 'm4a');

  // 2. Binary ID3v2 Tag Extractor (TIT2 + TPE1 + TALB)
  const enc = new TextEncoder();
  const buildId3Frame = (id, text) => {
    const strBytes = enc.encode(text);
    const len = strBytes.length + 1;
    const frame = new Uint8Array(10 + len);
    frame.set(enc.encode(id), 0);
    frame[7] = len;
    frame[10] = 3; // UTF-8
    frame.set(strBytes, 11);
    return frame;
  };
  const fTitle = buildId3Frame('TIT2', 'Garam & Madu (Sakit Dadaku)');
  const fArtist = buildId3Frame('TPE1', 'Tenxi, Naykilla & Jemsii');
  const fAlbum = buildId3Frame('TALB', 'Garam & Madu - Single');
  const totalTagPayload = fTitle.length + fArtist.length + fAlbum.length;
  const id3Buf = new Uint8Array(10 + totalTagPayload + 32);
  id3Buf.set([0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, totalTagPayload], 0);
  id3Buf.set(fTitle, 10);
  id3Buf.set(fArtist, 10 + fTitle.length);
  id3Buf.set(fAlbum, 10 + fTitle.length + fArtist.length);

  const tags = extractEmbeddedMediaTags(id3Buf.buffer);
  assert.equal(tags.title, 'Garam & Madu (Sakit Dadaku)');
  assert.equal(tags.artist, 'Tenxi, Naykilla & Jemsii');
  assert.equal(tags.album, 'Garam & Madu - Single');

  // 3. Filename & social caption tokenizer strips platform noise & NEVER invents fake 'Lagu Viral Indonesia'
  const parsedQ = parseSongQueryFromFilenameAndTags(
    'ssstik.io_bernadya_untungnya_hidup_harus_tetap_berjalan_7391827391823_tiktok_hd_1080p.mp4',
    {},
    ''
  );
  assert.ok(parsedQ.primaryQuery.toLowerCase().includes('bernadya'));
  assert.ok(parsedQ.primaryQuery.toLowerCase().includes('untungnya'));
  assert.equal(parsedQ.primaryQuery.toLowerCase().includes('ssstik'), false);
  assert.equal(parsedQ.hasTextClue, true);

  const blankClueQ = parseSongQueryFromFilenameAndTags('audio_wa_20261119_123456.mp3', {}, '');
  assert.equal(blankClueQ.hasTextClue, false);
  assert.equal(blankClueQ.primaryQuery, '');

  // 4. Acoustic Chromagram, BPM, & Shazam Constellation Hash analyzer on synthetic 440Hz (A4) sine wave
  const sr = 22050;
  const pcm = new Float32Array(sr * 3);
  for (let i = 0; i < pcm.length; i += 1) {
    const t = i / sr;
    const beatPulse = 0.5 + 0.5 * Math.sin(2 * Math.PI * 2.0 * t); // 2 Hz = 120 BPM
    pcm[i] = Math.sin(2 * Math.PI * 440 * t) * beatPulse * 0.7;
  }
  const acoustic = computeAcousticFingerprintFromPcm(pcm, sr);
  assert.equal(acoustic.dominantPitch, 'A');
  assert.ok(acoustic.bpm >= 76 && acoustic.bpm <= 176);
  assert.ok(acoustic.fingerprintHex.startsWith('FP-'));
  assert.ok(acoustic.shazamHash.startsWith('SHZ-'));

  const wavBytes = encodePcmToWavBytes(pcm, sr, 16000);
  assert.equal(String.fromCharCode(...wavBytes.slice(0, 4)), 'RIFF');
  assert.equal(String.fromCharCode(...wavBytes.slice(8, 12)), 'WAVE');

  // 4b. Cosine Acoustic Similarity + Lyric Match Scorer
  const sameSim = computeAcousticSimilarity(acoustic, acoustic);
  assert.ok(sameSim >= 98);
  const diffAcoustic = {
    bpm: 170,
    spectralCentroidHz: 4800,
    chromaVector: acoustic.chromaVector.map((_, idx) => (idx === 1 ? 1 : 0)),
  };
  assert.ok(computeAcousticSimilarity(acoustic, diffAcoustic) < 60);

  const lyricScore = computeLyricMatchScore(
    'belum ada satu bulan ku yakin masih ada sisa wangiku di bajumu',
    'Belum ada satu bulan Ku yakin masih ada sisa wangiku di bajumu Namun kau tampak baik saja'
  );
  assert.ok(lyricScore >= 85);

  // 5. Candidate scorer ranks exact AudD / tag / lyric matches accurately
  const ranked = rankSongCandidates(REFERENCE_SONG_FINGERPRINTS, {
    embeddedTags: tags,
    parsedQuery: parseSongQueryFromFilenameAndTags('tenxi-garam-madu.mp3', tags, ''),
    detectedLyrics: 'sakit dadaku ku mulai merindu',
    durationSec: 184,
    acoustic: { bpm: 132, dominantPitch: 'C#' },
  });
  assert.equal(ranked[0].title, 'Garam & Madu (Sakit Dadaku)');
  assert.ok(ranked[0].similarityPercent >= 96);

  // 6. Cross-platform link builder outputs music sources (incl. Shazam) for audio AND social video similarity sources for video
  const audioLinks = buildCrossPlatformMusicAndVideoLinks({
    title: ranked[0].title,
    artist: ranked[0].artist,
    mediaKind: 'audio',
  });
  assert.ok(audioLinks.musicSources.length >= 7);
  assert.ok(audioLinks.musicSources.some((m) => m.platform === 'Shazam'));
  assert.equal(audioLinks.videoSources.length, 0);

  const videoLinks = buildCrossPlatformMusicAndVideoLinks({
    title: ranked[0].title,
    artist: ranked[0].artist,
    mediaKind: 'video',
  });
  assert.ok(videoLinks.musicSources.length >= 7);
  assert.ok(videoLinks.videoSources.length >= 4);
  assert.ok(videoLinks.videoSources.some((v) => v.platform.includes('TikTok')));
  assert.ok(videoLinks.videoSources.some((v) => v.platform.includes('Instagram')));
  assert.ok(videoLinks.videoSources.some((v) => v.platform.includes('YouTube')));
});

test('v49 AI Hybrid Super-Compressor & Ultra Perceptual AVIF/WebP planner, PSNR guard, keyless AI sanitizer, and Lanczos FFmpeg args work accurately', () => {
  const aiMethod = COMPRESSION_METHODS.find((m) => m.id === 'ai-hybrid-super');
  const ultraMethod = COMPRESSION_METHODS.find((m) => m.id === 'ultra-perceptual-avif');
  assert.ok(aiMethod && aiMethod.isAiPowered);
  assert.ok(ultraMethod);

  // 1. Planning for AI Hybrid & Ultra Perceptual
  const aiPlan = planMediaCompression({
    mediaKind: 'image',
    methodId: 'ai-hybrid-super',
    presetId: 'wa-status-hd',
    originalWidth: 3120,
    originalHeight: 4160,
    originalBytes: 2_960_000,
  });
  assert.equal(aiPlan.usesAiAdvisor, true);
  assert.equal(aiPlan.enableMultiCodecRace, true);
  assert.equal(aiPlan.enableUnsharpRestore, true);
  assert.equal(aiPlan.targetWidth, 1200);
  assert.equal(aiPlan.targetHeight, 1600);
  assert.ok(aiPlan.minPsnrDb >= 35.5);

  const ultraPlan = planMediaCompression({
    mediaKind: 'image',
    methodId: 'ultra-perceptual-avif',
    presetId: 'tiktok-hd',
    originalWidth: 2160,
    originalHeight: 3840,
    originalBytes: 4_200_000,
  });
  assert.equal(ultraPlan.usesAiAdvisor, false);
  assert.equal(ultraPlan.enableMultiCodecRace, true);
  assert.equal(ultraPlan.targetHeight, 1080);

  // 2. Real PSNR calculation
  const identicalA = new Uint8Array([100, 120, 140, 255, 200, 180, 160, 255]);
  const identicalB = new Uint8Array([100, 120, 140, 255, 200, 180, 160, 255]);
  assert.equal(computeRgbaPsnrDb(identicalA, identicalB), 99.9);

  const slightlyDiff = new Uint8Array([102, 119, 141, 255, 198, 181, 159, 255]);
  const psnrVal = computeRgbaPsnrDb(identicalA, slightlyDiff);
  assert.ok(psnrVal > 40 && psnrVal < 60, `Expected high PSNR dB, got ${psnrVal}`);

  // 3. Deterministic local perceptual AI recipe
  const localRecipe = computeLocalPerceptualAiRecipe(
    { edgeDensity: 44, colorEntropy: 6.9, hasAlpha: false, bytesPerMp: 720000 },
    COMPRESSION_PLATFORM_PRESETS[0],
    'image'
  );
  assert.equal(localRecipe.codecPreference, 'avif');
  assert.ok(localRecipe.sharpenAmount >= 0.2);
  assert.ok(localRecipe.minPsnrDb >= 37);

  // 4. Remote AI JSON sanitizer handles markdown fences, percentage quality, and clamping
  const sanitized = parseAndSanitizeAiCompressionRecipe(
    '```json\n{"codecPreference":"avif","quality":68,"sharpenAmount":22,"minPsnrDb":38.2,"videoCrf":24,"maxVideoMbps":6.4,"summary":"Detail tepi tinggi cocok dengan AVIF q=68 dan sharpening ringan."}\n```',
    localRecipe
  );
  assert.equal(sanitized.fromRemoteAi, true);
  assert.equal(sanitized.recipe.codecPreference, 'avif');
  assert.equal(sanitized.recipe.quality, 0.68);
  assert.equal(sanitized.recipe.sharpenAmount, 0.22);
  assert.equal(sanitized.recipe.videoCrf, 24);

  // Malformed AI output safely falls back to local deterministic recipe
  const fallbackParsed = parseAndSanitizeAiCompressionRecipe('Rate limited or non-JSON text', localRecipe);
  assert.equal(fallbackParsed.fromRemoteAi, false);
  assert.equal(fallbackParsed.recipe.codecPreference, localRecipe.codecPreference);

  // 5. Video FFmpeg args use AI override CRF & Lanczos filter
  const ffArgs = buildFfmpegVideoCompressArgs('in.mp4', 'out.mp4', {
    methodId: 'ai-hybrid-super',
    targetWidth: 1080,
    targetHeight: 1920,
    targetVideoMbps: 6.4,
    overrideCrf: 24,
  });
  const crfIdx = ffArgs.indexOf('-crf');
  assert.equal(ffArgs[crfIdx + 1], '24');
  assert.ok(ffArgs.some((arg) => arg.includes('flags=lanczos')));
});

test('v51 Drama China (Dracin) unifies 15+ short-drama platforms, parallel APIs, free episode jump, auto-ID subtitles, history, and AI clip matcher', () => {
  // 1. Utility registration (10 free utilities including dracin)
  const utilCfg = normalizeUtilityConfig();
  assert.equal(utilCfg.items.length, 10);
  const dracinTool = utilCfg.items.find((it) => it.id === 'dracin');
  assert.ok(dracinTool);
  assert.equal(dracinTool.label, 'Drama China');

  // 2. 15+ named short-drama platforms (excluding 'all' = 18 platforms!)
  const realPlatforms = DRACIN_PLATFORMS.filter((p) => p.id !== 'all');
  assert.ok(realPlatforms.length >= 15, `Expected >= 15 platforms, got ${realPlatforms.length}`);
  const requiredPlatformNames = [
    'DramaBox',
    'ReelShort',
    'ShortMax',
    'NetShort',
    'GoodShort',
    'DramaWave',
    'FlickReels',
    'FreeReels',
    'StardustTV',
    'iDrama',
    'DramaNova',
    'StarShort',
    'DramaBite',
    'Melolo',
    'MoboReels',
    'Anichin',
  ];
  for (const name of requiredPlatformNames) {
    assert.ok(
      realPlatforms.some((p) => p.name === name),
      `Missing required platform ${name}`
    );
  }

  // 3. Parallel multi-API feed merging & deduplication
  const merged = mergeParallelDracinFeeds(
    [
      {
        sourceId: 'dailymotion',
        items: [
          { title: 'Pewaris Rahasia di Balik Senyum Sang CEO', platformId: 'dramabox' }, // duplicate
          { title: 'Cinta Terlarang Sang Panglima Naga', platformId: 'shortmax', totalEpisodes: 65 },
        ],
      },
      {
        sourceId: 'anichin-api',
        fallbackPlatformId: 'anichin',
        items: [{ title: 'Battle Through The Heavens Special', totalEpisodes: 52 }],
      },
    ],
    CURATED_DRACIN_CATALOG
  );
  assert.equal(merged.length, CURATED_DRACIN_CATALOG.length + 2);
  assert.ok(merged.some((d) => d.title === 'Cinta Terlarang Sang Panglima Naga' && d.platformId === 'shortmax'));
  assert.ok(merged.some((d) => d.title === 'Battle Through The Heavens Special' && d.platformId === 'anichin'));

  // 4. Platform & title search filtering
  const anichinOnly = filterDracinCatalog(merged, { platformId: 'anichin' });
  assert.ok(anichinOnly.length >= 2);
  assert.ok(anichinOnly.every((d) => d.platformId === 'anichin'));
  const ceoSearch = filterDracinCatalog(merged, { query: 'miliarder' });
  assert.ok(ceoSearch.some((d) => d.platformId === 'reelshort'));

  // 5. Free unlimited episode jumping & range grouping (zero locked episodes)
  const flagship = merged[0];
  const episodes = buildEpisodeList(flagship);
  assert.equal(episodes.length, flagship.totalEpisodes);
  assert.ok(episodes.every((ep) => ep.free === true && ep.locked === false));
  const ranges = buildEpisodeRanges(82, 20);
  assert.equal(ranges.length, 5);
  assert.equal(ranges[4].label, '81–82');
  const navMid = getNextPrevEpisode(15, 82);
  assert.equal(navMid.prev, 14);
  assert.equal(navMid.next, 16);
  const navLast = getNextPrevEpisode(82, 82);
  assert.equal(navLast.hasNext, false);

  // 6. Auto-enable Indonesian subtitles when dubbing is unavailable + multi-lang WebVTT
  const noDubDrama = merged.find((d) => !d.hasIndonesianDub);
  const autoSub = resolveAutoSubtitleLang(noDubDrama, null);
  assert.equal(autoSub.lang, 'id');
  assert.equal(autoSub.autoActivated, true);
  assert.ok(DRACIN_SUBTITLE_LANGS.length >= 8);
  const idCues = buildEpisodeSubtitleCues(noDubDrama, 15, 'id');
  assert.ok(idCues.length >= 5);
  assert.ok(idCues[0].text.includes('Ep 15'));
  const vtt = buildWebVttFromCues(idCues);
  assert.ok(vtt.startsWith('WEBVTT'));
  const cueAt10 = getActiveSubtitleCue(idCues, 10);
  assert.ok(cueAt10 && cueAt10.text.length > 5);

  // 7. Watch history & favorites persistence helpers
  let hist = upsertWatchHistory([], {
    dramaId: flagship.id,
    title: flagship.title,
    platformId: flagship.platformId,
    platformName: flagship.platformName,
    episode: 15,
    totalEpisodes: flagship.totalEpisodes,
  });
  assert.equal(hist.length, 1);
  assert.equal(hist[0].episode, 15);
  hist = upsertWatchHistory(hist, {
    dramaId: flagship.id,
    title: flagship.title,
    platformId: flagship.platformId,
    platformName: flagship.platformName,
    episode: 22,
    totalEpisodes: flagship.totalEpisodes,
  });
  assert.equal(hist.length, 1);
  assert.equal(hist[0].episode, 22);

  let favs = toggleFavoriteDramaId([], flagship.id);
  assert.deepEqual(favs, [flagship.id]);
  favs = toggleFavoriteDramaId(favs, flagship.id);
  assert.deepEqual(favs, []);

  // 8. Smart Clip/Screenshot + Multi-AI drama identifier ranking & parser
  const parsedAi = parseAiDramaIdentification(
    '```json\n{"summary":"Cuplikan tabib muda gunung giok","genre":"fantasy","keywords":["dokter","giok","netshort"]}\n```'
  );
  assert.equal(parsedAi.suggestedGenre, 'fantasy');
  assert.ok(parsedAi.hints.includes('giok'));

  const ranked = rankClipIdentifierCandidates(merged, {
    fileName: 'cuplikan_dokter_giok_netshort.png',
    userClue: 'tabib gunung giok tiga jarum perak',
    aiHints: parsedAi.hints,
    visualProfile: { aspectRatio: 0.56, warmth: 0.42, brightness: 0.45 },
    limit: 3,
  });
  assert.equal(ranked.length, 3);
  assert.equal(ranked[0].drama.id, 'ns-cinta-tak-terduga-dokter-jenius');
  assert.ok(ranked[0].confidence >= 70);
});

test('v52 Drama China real-time API normalization, VTT/SRT parsing, real server priority, Clean Screen state, and Melolo CENC helpers work accurately', () => {
  // 1. Live unified source registry covers Melolo, DramaBox, NetShort, ReelShort, ShortMax, GoodShort, etc.
  assert.equal(ANICHIN_UNIFIED_SOURCES.has('melolo'), true);
  assert.equal(ANICHIN_UNIFIED_SOURCES.has('dramabox'), true);
  assert.equal(ANICHIN_UNIFIED_SOURCES.has('reelshort'), true);
  assert.equal(ANICHIN_UNIFIED_SOURCES.has('shortmax'), true);
  assert.equal(ANICHIN_UNIFIED_SOURCES.has('goodshort'), true);

  // 2. Relative HLS proxy paths resolve against miniapp.anichin.bio (NOT api.anichin.bio)
  assert.equal(
    resolveAnichinMediaUrl('/api/shortmax/hls?url=abc'),
    'https://miniapp.anichin.bio/api/shortmax/hls?url=abc'
  );
  assert.equal(
    resolveAnichinMediaUrl('https://cdn.example.com/stream.mp4'),
    'https://cdn.example.com/stream.mp4'
  );
  assert.equal(resolveAnichinMediaUrl('//cdn.example.com/poster.jpg'), 'https://cdn.example.com/poster.jpg');

  // 3. Real-time platform drama normalization keeps real CDN poster & platform sourceId
  const meloloNorm = normalizeAnichinDramaItem(
    {
      id: '7491234567890',
      title: 'Cinta Tersembunyi Sang Pewaris',
      cover: 'https://p16-melolo.byteimg.com/cover.jpg',
      episodes: 72,
      tags: ['Romantis', 'CEO'],
      synopsis: 'Kisah nyata pewaris rahasia.',
    },
    'melolo'
  );
  assert.equal(meloloNorm.id, 'melolo::7491234567890');
  assert.equal(meloloNorm.sourceId, '7491234567890');
  assert.equal(meloloNorm.platformId, 'melolo');
  assert.equal(meloloNorm.apiProvider, 'anichin-unified');
  assert.equal(meloloNorm.poster, 'https://p16-melolo.byteimg.com/cover.jpg');
  assert.equal(meloloNorm.hasRealPoster, true);
  assert.equal(meloloNorm.totalEpisodes, 72);

  // 4. WebVTT & SRT subtitle parser extracts accurate timed cues
  assert.equal(parseSubtitleTimestamp('00:01:02,500'), 62.5);
  assert.equal(parseSubtitleTimestamp('01:15.250'), 75.25);

  const srtSample = `1\n00:00:01,000 --> 00:00:04,500\nHalo, ini subtitle SRT asli.\n\n2\n00:00:05,000 --> 00:00:08,000\n<i>Baris kedua</i>`;
  const srtCues = parseSubtitleText(srtSample);
  assert.equal(srtCues.length, 2);
  assert.equal(srtCues[0].text, 'Halo, ini subtitle SRT asli.');
  assert.equal(srtCues[1].text, 'Baris kedua');
  assert.equal(getActiveSubtitleCue(srtCues, 2.5, { loop: false })?.text, 'Halo, ini subtitle SRT asli.');
  assert.equal(getActiveSubtitleCue(srtCues, 20, { loop: false }), null);

  const vttSample = `WEBVTT\n\n00:00:02.000 --> 00:00:05.000\nSubtitle WebVTT real-time`;
  const vttCues = parseSubtitleText(vttSample);
  assert.equal(vttCues.length, 1);
  assert.equal(vttCues[0].start, 2);

  // 5. Playback server picker prioritizes real MP4/HLS/CENC over embeds (zero fake cinema-sub)
  const picked = pickBestPlaybackServer([
    { id: 'dm-1', kind: 'dailymotion', embedUrl: 'https://geo.dailymotion.com/player.html?video=x1' },
    { id: 'hls-540', kind: 'hls', quality: 540, url: 'https://cdn/540.m3u8' },
    { id: 'mp4-720', kind: 'mp4', quality: 720, url: 'https://cdn/720.mp4' },
  ]);
  assert.equal(picked?.id, 'mp4-720');

  // 6. Fullscreen Clean Screen ("Layar Bersih") state transitions
  assert.equal(resolveCleanScreenState(false, false, true), false); // disabled outside fullscreen
  assert.equal(resolveCleanScreenState(false, true, null), true); // toggles ON in fullscreen
  assert.equal(resolveCleanScreenState(true, true, null), false); // toggles OFF in fullscreen
  assert.equal(resolveCleanScreenState(true, false, null), false); // resets when exiting fullscreen

  // 7. Melolo CENC-AES-CTR key hex/base64url & MP4 box parser
  const keyBytes = hexToBytes('00112233445566778899aabbccddeeff');
  assert.equal(keyBytes.length, 16);
  assert.equal(bytesToBase64Url(keyBytes), 'ABEiM0RVZneImaq7zN3u_w');
  const fakeBox = new Uint8Array([0, 0, 0, 8, 0x66, 0x74, 0x79, 0x70]); // 8-byte 'ftyp' box
  const parsedBoxes = parseMp4Boxes(fakeBox, 0, fakeBox.length);
  assert.equal(parsedBoxes.length, 1);
  assert.equal(parsedBoxes[0].type, 'ftyp');
  assert.equal(parsedBoxes[0].size, 8);
});

test('v53 Drama China searchable platform dropdown, FlickReels JSON-HLS unwrapper, non-sticky mute state, and persistent fullscreen transitions work accurately', () => {
  // 1. Searchable platform dropdown filtering
  assert.equal(filterDracinPlatforms('').length, DRACIN_PLATFORMS.length);
  const meloMatches = filterDracinPlatforms('melo');
  assert.equal(meloMatches.length, 1);
  assert.equal(meloMatches[0].id, 'melolo');
  const shortMatches = filterDracinPlatforms('short');
  assert.ok(shortMatches.some((p) => p.id === 'shortmax'));
  assert.ok(shortMatches.some((p) => p.id === 'goodshort'));
  assert.ok(shortMatches.some((p) => p.id === 'reelshort'));
  assert.equal(filterDracinPlatforms('tidak-ada-platform-xyz').length, 0);

  // 2. JSON-wrapped HLS proxy unwrapping (FlickReels /api/flickreels/hls)
  const flickJson = JSON.stringify({
    url: 'https://zshipricf.farsunpteltd.net/playlet-hls/hls_demo.m3u8?verify=123',
  });
  assert.equal(
    unwrapHlsJsonPayload(flickJson, 'https://miniapp.anichin.bio/api/flickreels/hls?id=1'),
    'https://zshipricf.farsunpteltd.net/playlet-hls/hls_demo.m3u8?verify=123'
  );
  // Real #EXTM3U playlists remain untouched
  assert.equal(
    unwrapHlsJsonPayload('#EXTM3U\n#EXT-X-VERSION:3\n', 'https://miniapp.anichin.bio/api/shortmax/hls?id=1'),
    'https://miniapp.anichin.bio/api/shortmax/hls?id=1'
  );

  // 3. Non-sticky autoplay mute resolution (never overwrites userMuted!)
  const blockedState = resolveNextMuteState({ userMuted: false, autoplayBlocked: true });
  assert.equal(blockedState.effectiveMuted, true);
  assert.equal(blockedState.userMuted, false);
  assert.equal(blockedState.showUnmuteNotice, true);

  // Next episode starts UNMUTED because userMuted stayed false!
  const nextEpState = resolveNextMuteState({ userMuted: blockedState.userMuted, autoplayBlocked: false });
  assert.equal(nextEpState.effectiveMuted, false);
  assert.equal(nextEpState.showUnmuteNotice, false);

  // Explicit user mute is respected without showing autoplay banner
  const explicitMuted = resolveNextMuteState({ userMuted: true, autoplayBlocked: false });
  assert.equal(explicitMuted.effectiveMuted, true);
  assert.equal(explicitMuted.userMuted, true);
  assert.equal(explicitMuted.showUnmuteNotice, false);

  // 4. Persistent fullscreen guard across episode transitions
  assert.equal(shouldPreserveFullscreenOnEpisodeChange({ isFullscreen: true, stageMounted: true }), true);
  assert.equal(shouldPreserveFullscreenOnEpisodeChange({ isFullscreen: true, stageMounted: false }), false);
  assert.equal(shouldPreserveFullscreenOnEpisodeChange({ isFullscreen: false, stageMounted: true }), false);
});

test('v54 self-healing mirror circuit-breaker, adaptive JSON schema extractor, friendly error formatter, and preload target planner work accurately', () => {
  // 1. Multi-mirror circuit-breaker failover & recovery
  const now = 1_700_000_000_000;
  let health = {};
  const initialRank = rankHealthyApiMirrors(DEFAULT_DRACIN_ENDPOINT_CONFIG.mirrors, health, now);
  assert.equal(initialRank[0].id, 'anichin-primary');
  assert.equal(initialRank[1].id, 'anichin-miniapp');

  // Primary fails -> demoted during cooldown, miniapp becomes #1
  health = recordMirrorHealth(health, 'anichin-primary', false, now);
  const failoverRank = rankHealthyApiMirrors(DEFAULT_DRACIN_ENDPOINT_CONFIG.mirrors, health, now + 5000);
  assert.equal(failoverRank[0].id, 'anichin-miniapp');
  assert.equal(failoverRank[1].id, 'anichin-primary');

  // Primary recovers -> restored to #1 priority
  health = recordMirrorHealth(health, 'anichin-primary', true, now + 30_000);
  const recoveredRank = rankHealthyApiMirrors(DEFAULT_DRACIN_ENDPOINT_CONFIG.mirrors, health, now + 30_000);
  assert.equal(recoveredRank[0].id, 'anichin-primary');

  // 2. Adaptive JSON schema extractor handles standard, renamed keys, deeply nested URLs, and VIP lock
  const vipLocked = extractAdaptiveEpisodePayload({
    code: 200,
    episodeNumber: 6,
    locked: true,
    qualityList: [],
    videoUrl: '',
  });
  assert.equal(vipLocked.locked, true);
  assert.equal(vipLocked.videoUrl, '');
  assert.equal(vipLocked.qualityList.length, 0);

  const renamedSchema = extractAdaptiveEpisodePayload({
    data: {
      playUrl: 'https://cdn.future.example/ep2.mp4',
      streams: [
        { quality: '720p', stream_url: 'https://cdn.future.example/ep2_720.mp4' },
      ],
      captions: [
        { langName: 'Indonesia', code: 'id', vttUrl: 'https://cdn.future.example/id.vtt' },
      ],
    },
  });
  assert.equal(renamedSchema.locked, false);
  assert.equal(renamedSchema.videoUrl, 'https://cdn.future.example/ep2.mp4');
  assert.equal(renamedSchema.qualityList.length, 1);
  assert.equal(renamedSchema.qualityList[0].url, 'https://cdn.future.example/ep2_720.mp4');
  assert.equal(renamedSchema.subtitles.length, 1);
  assert.equal(renamedSchema.subtitles[0].url, 'https://cdn.future.example/id.vtt');

  const deeplyNested = extractAdaptiveEpisodePayload({
    payload: {
      unknownWrapper: {
        brandNewField: 'https://cdn.deep.example/hls/master.m3u8?token=abc',
      },
    },
  });
  assert.equal(deeplyNested.videoUrl, 'https://cdn.deep.example/hls/master.m3u8?token=abc');

  // 3. Friendly error sanitizer removes Chrome raw "signal is aborted without reason"
  const abortMsg = formatDracinUserError(new Error('signal is aborted without reason'), {
    platformName: 'Melolo',
    episode: 14,
  });
  assert.equal(abortMsg.toLowerCase().includes('signal is aborted'), false);
  assert.ok(abortMsg.includes('Melolo') && abortMsg.includes('Ep 14'));

  const netMsg = formatDracinUserError(new Error('Failed to fetch'), {
    platformName: 'DramaBox',
    episode: 3,
  });
  assert.ok(netMsg.includes('Jaringan') && netMsg.includes('DramaBox'));

  // 4. Episode background preload target planner clamps safely at end of series
  assert.deepEqual(computePreloadEpisodeTargets(1, 30, 2), [2, 3]);
  assert.deepEqual(computePreloadEpisodeTargets(29, 30, 2), [30]);
  assert.deepEqual(computePreloadEpisodeTargets(30, 30, 2), []);
});

test('v55 Dailymotion canonical embed URLs and multi-signal cross-platform drama matcher (title + synopsis + visual + metadata)', () => {
  // 1. Canonical Dailymotion embed & watch URLs (includes required playerId path to avoid HTTP 403)
  assert.equal(
    buildDailymotionEmbedUrl('xbxu08u'),
    'https://geo.dailymotion.com/player/x8lr5.html?video=xbxu08u'
  );
  assert.equal(
    buildDailymotionEmbedUrl('xbxu08u', 'x9abc'),
    'https://geo.dailymotion.com/player/x9abc.html?video=xbxu08u'
  );
  assert.equal(buildDailymotionWatchUrl('xbxu08u'), 'https://www.dailymotion.com/video/xbxu08u');
  assert.equal(buildDailymotionEmbedUrl(''), '');

  // 2. Stopword & platform tag stripping
  const norm = normalizeDramaMatchText('[Dubbing] Hidup Demi Balas Dendam (Sub Indo)');
  assert.deepEqual(norm, ['hidup', 'balas', 'dendam']);
  assert.ok(computeTokenJaccardSimilarity('Hidup Demi Balas Dendam', '【Indo Sub】 Balas Dendam Hidup') > 0.5);

  // 3. Visual poster similarity comparison
  const warmRedA = { r: 190, g: 52, b: 48, brightness: 0.38, warmth: 0.78, aspectRatio: 0.67 };
  const warmRedB = { r: 182, g: 58, b: 54, brightness: 0.4, warmth: 0.75, aspectRatio: 0.66 };
  const coolBlue = { r: 22, g: 140, b: 230, brightness: 0.45, warmth: 0.1, aspectRatio: 1.78 };
  assert.ok(computeVisualProfileSimilarity(warmRedA, warmRedB) > 0.9);
  assert.ok(computeVisualProfileSimilarity(warmRedA, coolBlue) < 0.55);
  assert.equal(computeVisualProfileSimilarity(warmRedA, null), null);

  // 4. Cross-platform matching catches SAME drama even when renamed on another platform via synopsis + ep count + visual!
  const sourceMelolo = {
    id: 'melolo::1001',
    sourceId: '1001',
    platformId: 'melolo',
    platformName: 'Melolo',
    title: 'Hidup Demi Balas Dendam',
    altTitle: 'Pembalasan',
    genre: 'revenge',
    genres: ['revenge', 'trending'],
    totalEpisodes: 30,
    hasKnownEpisodeCount: true,
    synopsis:
      'Lin Fan dikhianati tunangannya dan keluarga konglomerat tepat di malam pernikahan, lalu bangkit sebagai pewaris rahasia untuk membalas dendam.',
    cast: ['Lin Fan', 'Su Yan'],
  };

  const renamedSameOnDramabox = {
    id: 'dramabox::8899',
    sourceId: '8899',
    platformId: 'dramabox',
    platformName: 'DramaBox',
    title: 'Kebangkitan Pewaris Rahasia Malam Pernikahan',
    altTitle: 'Secret Heir',
    genre: 'revenge',
    genres: ['revenge'],
    totalEpisodes: 30,
    hasKnownEpisodeCount: true,
    synopsis:
      'Setelah dikhianati tunangannya serta keluarga konglomerat pada malam pernikahan, Lin Fan bangkit menjadi pewaris rahasia untuk membalas dendam.',
    cast: ['Lin Fan'],
  };

  const unrelatedComedy = {
    id: 'reelshort::5555',
    sourceId: '5555',
    platformId: 'reelshort',
    platformName: 'ReelShort',
    title: 'Koki Lucu di Istana Kucing',
    altTitle: 'Cat Chef',
    genre: 'family',
    genres: ['family'],
    totalEpisodes: 85,
    hasKnownEpisodeCount: true,
    synopsis: 'Kisah ceria seorang koki muda yang memasak hidangan lezat untuk kucing kerajaan.',
    cast: ['Mei'],
  };

  const keywords = extractSynopsisKeywords(sourceMelolo, 4);
  assert.ok(keywords.length >= 3);

  const directEval = scoreCrossPlatformDramaMatch(sourceMelolo, renamedSameOnDramabox, {
    sourceVisual: warmRedA,
    candidateVisual: warmRedB,
  });
  assert.ok(directEval.score >= 55, `Expected renamed same drama score >= 55, got ${directEval.score}`);
  assert.ok(directEval.signals.synopsisPct >= 40);
  assert.ok(directEval.reasons.some((r) => r.includes('Sinopsis')));
  assert.ok(directEval.reasons.some((r) => r.includes('Jumlah episode identik')));

  const ranked = rankCrossPlatformDramaMatches(
    sourceMelolo,
    [sourceMelolo, unrelatedComedy, renamedSameOnDramabox],
    {
      sourceVisual: warmRedA,
      visualMap: {
        'dramabox::8899': warmRedB,
        'reelshort::5555': coolBlue,
      },
      minScore: 22,
      limit: 5,
    }
  );
  assert.equal(ranked.length, 1);
  assert.equal(ranked[0].drama.id, 'dramabox::8899');
  assert.equal(ranked[0].isDifferentPlatform, true);
});

test('v56 Sansekai/SekaiDrama platforms, URL normalizer, feed extractors, Melolo vid resolver, and multi-platform stream parsers', () => {
  // 1. Platform registry & dropdown search include SekaiDrama (Sansekai), PineDrama, MyDrama
  assert.ok(DRACIN_PLATFORMS.some((p) => p.id === 'sansekai' && p.name.includes('Sansekai')));
  assert.ok(DRACIN_PLATFORMS.some((p) => p.id === 'pinedrama'));
  assert.ok(DRACIN_PLATFORMS.some((p) => p.id === 'mydrama'));
  assert.equal(SANSEKAI_SUPPORTED_PLATFORMS.has('melolo'), true);
  assert.equal(SANSEKAI_SUPPORTED_PLATFORMS.has('pinedrama'), true);
  assert.equal(SANSEKAI_SUPPORTED_PLATFORMS.has('mydrama'), true);
  assert.ok(filterDracinPlatforms('sansekai').some((p) => p.id === 'sansekai'));
  assert.ok(filterDracinPlatforms('pine').some((p) => p.id === 'pinedrama'));
  assert.equal(buildSansekaiWebUrl(), 'https://drama.sansekai.my.id');

  // 2. HTTPS upgrade prevents Mixed Content blocking
  assert.equal(
    normalizeSansekaiUrl('http://api.sansekai.my.id/api/melolo/proxy?id=1'),
    'https://api.sansekai.my.id/api/melolo/proxy?id=1'
  );
  assert.equal(normalizeSansekaiUrl('//cdn.example.com/v.mp4'), 'https://cdn.example.com/v.mp4');
  assert.equal(normalizeSansekaiUrl(''), '');

  // 3. Feed extractors across Melolo nested cells, DramaBox flat array, PineDrama collections, ReelShort lists, GoodShort records
  const meloloItems = extractSansekaiFeedItems(
    {
      data: {
        cells: [
          {
            cell_data: [
              {
                books: [
                  {
                    book_id: '7697132515567422469',
                    book_name: 'Hidup Demi Balas Dendam',
                    thumb_url: 'https://cdn.melolo.example/poster.jpg',
                    abstract: 'Balas dendam epik',
                    serial_count: 30,
                  },
                ],
              },
            ],
          },
        ],
      },
    },
    'melolo'
  );
  assert.equal(meloloItems.length, 1);
  assert.equal(meloloItems[0].apiProvider, 'sansekai');
  assert.equal(meloloItems[0].sansekaiId, '7697132515567422469');
  assert.equal(meloloItems[0].platformId, 'melolo');
  assert.equal(meloloItems[0].totalEpisodes, 30);

  const dramaboxItems = extractSansekaiFeedItems(
    [
      {
        bookId: '410001122',
        bookName: 'Pewaris Rahasia CEO',
        coverWap: 'https://cdn.dbx.example/c.jpg',
        chapterCount: 82,
        introduction: 'Kisah pewaris rahasia',
      },
    ],
    'dramabox'
  );
  assert.equal(dramaboxItems.length, 1);
  assert.equal(dramaboxItems[0].sansekaiId, '410001122');

  const pineItems = extractSansekaiFeedItems(
    {
      has_more: true,
      collections: [
        {
          collection_id: 'pine-99',
          title: 'Secret Billionaire Bride',
          cover: 'https://cdn.pine.example/p.jpg',
          total_episodes: 65,
          description: 'Romantis',
        },
      ],
    },
    'pinedrama'
  );
  assert.equal(pineItems.length, 1);
  assert.equal(pineItems[0].platformId, 'pinedrama');
  assert.equal(pineItems[0].totalEpisodes, 65);

  const reelItems = extractSansekaiFeedItems(
    { data: { lists: [{ books: [{ book_id: 'rs-7', book_title: 'Nikah Kilat', book_pic: 'https://cdn.rs/1.jpg', chapter_count: 50 }] }] } },
    'reelshort'
  );
  assert.equal(reelItems.length, 1);
  assert.equal(reelItems[0].sansekaiId, 'rs-7');

  const goodItems = extractSansekaiFeedItems(
    { data: { records: [{ items: [{ bookId: 'gs-8', bookName: 'Ratu Bisnis', cover: 'https://cdn.gs/1.jpg', chapterCount: 70 }] }] } },
    'goodshort'
  );
  assert.equal(goodItems.length, 1);
  assert.equal(goodItems[0].sansekaiId, 'gs-8');

  // Filter catalog with platformId='sansekai' keeps all apiProvider==='sansekai' items across sub-platforms
  const sansekaiFiltered = filterDracinCatalog([...meloloItems, ...pineItems, { id: 'other', title: 'Other', platformId: 'dramabox', apiProvider: 'anichin-unified' }], {
    platformId: 'sansekai',
  });
  assert.equal(sansekaiFiltered.length, 2);

  // 4. Melolo detail video_list -> videoId extractor
  const meloloVid = extractSansekaiMeloloVideoId(
    {
      data: {
        video_data: {
          series_id_str: '7697132515567422469',
          video_list: [
            { vid: 'vid-ep-1', vid_index: 1 },
            { vid: 'vid-ep-6', vid_index: 6 },
          ],
        },
      },
    },
    6
  );
  assert.equal(meloloVid, 'vid-ep-6');

  // 5. Episode stream extractors across Melolo, DramaBox, ShortMax, NetShort, FlickReels
  const meloloStream = extractSansekaiEpisodeStreams(
    {
      streamUrl: 'http://api.sansekai.my.id/api/melolo/stream/720.mp4',
      qualities: [
        { label: '720p', streamUrl: 'http://api.sansekai.my.id/api/melolo/stream/720.mp4' },
        { label: '480p', streamUrl: 'https://cdn.melolo.example/480.mp4' },
      ],
      subtitles: [{ language: 'id', url: 'https://cdn.melolo.example/ep6.vtt' }],
    },
    { platformId: 'melolo', episodeNumber: 6 }
  );
  assert.equal(meloloStream.servers.length, 2);
  assert.equal(meloloStream.servers[0].provider, 'sansekai');
  assert.equal(meloloStream.servers[0].url, 'https://api.sansekai.my.id/api/melolo/stream/720.mp4');
  assert.equal(meloloStream.subtitles.length, 1);

  const dbxStream = extractSansekaiEpisodeStreams(
    [
      {
        chapterIndex: 5,
        chapterName: 'EP 6',
        cdnList: [
          {
            isDefault: 1,
            videoPathList: [
              { quality: 540, videoPath: 'https://cdn.dbx.example/ep6_540.mp4' },
              { quality: 720, videoPath: 'https://cdn.dbx.example/ep6_720.mp4' },
            ],
          },
        ],
      },
    ],
    { platformId: 'dramabox', episodeNumber: 6 }
  );
  assert.equal(dbxStream.servers.length, 2);
  assert.equal(dbxStream.servers[0].qualityLabel, '720P');

  const shortmaxStream = extractSansekaiEpisodeStreams(
    {
      episode: {
        episodeNum: 6,
        locked: false,
        videoUrl: {
          video_1080: 'https://cdn.sm.example/1080.mp4',
          video_720: 'https://cdn.sm.example/720.mp4',
        },
      },
    },
    { platformId: 'shortmax', episodeNumber: 6 }
  );
  assert.equal(shortmaxStream.servers.length, 2);
  assert.equal(shortmaxStream.servers[0].qualityLabel, '720P');

  const netshortStream = extractSansekaiEpisodeStreams(
    {
      videoUrl: 'https://cdn.ns.example/ep6.mp4',
      quality: '720p',
      subtitleUrl: 'https://cdn.ns.example/ep6.srt',
      subtitleLanguage: 'id_ID',
    },
    { platformId: 'netshort', episodeNumber: 6 }
  );
  assert.equal(netshortStream.servers.length, 1);
  assert.equal(netshortStream.subtitles.length, 1);

  const flickStream = extractSansekaiEpisodeStreams(
    { hlsUrl: 'https://cdn.fr.example/ep6/master.m3u8' },
    { platformId: 'flickreels', episodeNumber: 6 }
  );
  assert.equal(flickStream.servers.length, 1);
  assert.equal(flickStream.servers[0].kind, 'hls');

  // Melolo real Sansekai payload with base64 video_model + main_url
  const meloloVmStream = extractSansekaiEpisodeStreams(
    {
      data: {
        main_url: 'https://cdn.melolo.example/ep6-main.mp4',
        video_model: JSON.stringify({
          video_list: {
            video_1: {
              definition: '720p',
              main_url: Buffer.from('https://cdn.melolo.example/ep6-720.mp4').toString('base64'),
            },
          },
        }),
      },
    },
    { platformId: 'melolo', episodeNumber: 6 }
  );
  assert.equal(meloloVmStream.servers.length, 2);
  assert.equal(meloloVmStream.servers[0].url, 'https://cdn.melolo.example/ep6-720.mp4');
  assert.equal(meloloVmStream.servers[0].qualityLabel, '720P');
  assert.equal(meloloVmStream.servers[1].url, 'https://cdn.melolo.example/ep6-main.mp4');
});

test('v57 Sansekai anti-rate-limit circuit breaker, mirror rotation, direct SekaiDrama Web link & strict Dailymotion auto-matcher', () => {
  const t0 = 1_700_000_000_000;

  // 1. Cooldown circuit breaker trips cleanly on 403 and 429, escalates, and resets on 200
  assert.equal(isSansekaiCooldownActive(null, t0), false);
  assert.equal(getSansekaiCooldownRemainingSec(null, t0), 0);

  const after429 = recordSansekaiOutcome(null, { ok: false, statusCode: 429, now: t0, rateLimitCooldownMs: 90_000 });
  assert.equal(isSansekaiCooldownActive(after429, t0 + 10_000), true);
  assert.equal(getSansekaiCooldownRemainingSec(after429, t0 + 10_000), 80);
  assert.equal(isSansekaiCooldownActive(after429, t0 + 91_000), false);

  const after403 = recordSansekaiOutcome(after429, { ok: false, statusCode: 403, now: t0, forbiddenCooldownMs: 180_000 });
  assert.equal(after403.failures, 2);
  assert.ok(after403.cooldownUntil - t0 >= 180_000);

  const resetOk = recordSansekaiOutcome(after403, { ok: true, statusCode: 200, now: t0 + 200_000 });
  assert.equal(resetOk.failures, 0);
  assert.equal(isSansekaiCooldownActive(resetOk, t0 + 200_000), false);

  // 2. Multi-mirror Sansekai candidate ordering prioritizes custom mirror & healthy mirrors over cooled-down mirrors
  const cfg = {
    sansekai: {
      mirrors: [
        { id: 'sk-1', label: 'Primary', baseUrl: 'https://api.sansekai.my.id/api', priority: 1 },
        { id: 'sk-2', label: 'Backup', baseUrl: 'https://mirror.example.com/api', priority: 2 },
      ],
    },
  };
  const ordered = extractSansekaiApiBaseCandidates(
    cfg,
    { 'sk-1': after403 },
    { customBaseUrl: 'https://my-selfhost.example/api/', now: t0 + 5_000 }
  );
  assert.equal(ordered[0].id, 'sansekai-custom');
  assert.equal(ordered[0].baseUrl, 'https://my-selfhost.example/api');
  assert.equal(ordered[1].id, 'sk-2');
  assert.equal(ordered[1].inCooldown, false);
  assert.equal(ordered[2].id, 'sk-1');
  assert.equal(ordered[2].inCooldown, true);

  // 3. Direct SekaiDrama Web link strips brackets and encodes query cleanly
  assert.equal(
    buildSansekaiDirectWatchUrl({ title: '[Dubbing] Hidup Demi Balas Dendam (Indo)' }, 6),
    'https://drama.sansekai.my.id/?q=Hidup%20Demi%20Balas%20Dendam'
  );
  assert.equal(buildSansekaiDirectWatchUrl(null, 1), 'https://drama.sansekai.my.id');

  // 4. Friendly error formatter maps HTTP 403 / 429 / SANSEKAI_COOLDOWN without exposing raw HTTP errors
  const msg403 = formatDracinUserError(new Error('HTTP 403'), { platformName: 'Melolo', episode: 6 });
  assert.ok(msg403.includes('SekaiDrama Web'));
  assert.ok(!msg403.includes('403'));
  const msgCooldown = formatDracinUserError('SANSEKAI_COOLDOWN', { platformName: 'Melolo', episode: 6 });
  assert.ok(msgCooldown.includes('Episode 6'));

  // 5. Strict Dailymotion auto-matcher accepts genuine Chinese drama match & rejects unrelated news/FTV noise
  const sourceDrama = { title: 'Hidup Demi Balas Dendam', platformId: 'melolo' };
  const goodCand = {
    title: 'Hidup Demi Balas Dendam Episode 6 Sub Indo Drama China Full',
    synopsis: 'DramaBox Melolo sub indo',
  };
  const badCand = {
    title: 'Jet Tempur Israel Menuju Yaman Demi Balas Dendam',
    synopsis: 'Berita internasional hari ini',
  };
  const goodEval = scoreDailymotionAutoMatch(sourceDrama, goodCand, 6);
  const badEval = scoreDailymotionAutoMatch(sourceDrama, badCand, 6);
  assert.equal(goodEval.isStrongMatch, true);
  assert.equal(badEval.isStrongMatch, false);
});








