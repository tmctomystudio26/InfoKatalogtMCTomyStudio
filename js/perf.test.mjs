import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  computeBannerHydrationWindow,
  computeProgressiveRenderLimit,
  detectLowEndDevice,
  resolveBannerTransition,
  shouldAllowAutoMusicTrigger,
  shouldEnableDualVideoPreload,
  shouldUseNativeDomFullscreen,
} from './perf-guard.js';
import {
  CURATED_DRACIN_CATALOG,
  DRACIN_GENRES,
  extractNunoWatchPayload,
  filterDracinCatalog,
  formatShortQualityBadge,
  isIndonesianShortDrama,
  mergeParallelDracinFeeds,
  parseServerResolutionHeight,
  parseSubtitleText,
  pickBestPlaybackServer,
  unwrapNunoSubtitleUrl,
} from './dracin-logic.js';
import { normalizeBanners, normalizeUtilityConfig } from './store.js';

test('detectLowEndDevice identifies budget Android/low-RAM/saveData devices vs desktop workstations', () => {
  assert.equal(
    detectLowEndDevice({
      hardwareConcurrency: 4,
      deviceMemory: 2,
      userAgent: 'Mozilla/5.0 (Linux; Android 11; Redmi 9A) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile',
      maxTouchPoints: 5,
    }),
    true
  );

  assert.equal(
    detectLowEndDevice({
      hardwareConcurrency: 8,
      deviceMemory: 8,
      saveData: true,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
      maxTouchPoints: 0,
    }),
    true
  );

  assert.equal(
    detectLowEndDevice({
      hardwareConcurrency: 8,
      deviceMemory: 16,
      saveData: false,
      effectiveType: '4g',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/125.0.0.0',
      maxTouchPoints: 0,
      prefersReducedMotion: false,
    }),
    false
  );
});

test('computeBannerHydrationWindow keeps only active and adjacent slides hydrated across wrap boundaries', () => {
  assert.deepEqual(computeBannerHydrationWindow(0, 16, 1).sort((a, b) => a - b), [0, 1, 15]);
  assert.deepEqual(computeBannerHydrationWindow(15, 16, 1).sort((a, b) => a - b), [0, 14, 15]);
  assert.deepEqual(computeBannerHydrationWindow(7, 16, 1).sort((a, b) => a - b), [6, 7, 8]);
  assert.equal(computeBannerHydrationWindow(5, 16, 1).length, 3);
});

test('resolveBannerTransition wraps 16 -> 1 and 1 -> 16 in 1 crisp directional step', () => {
  const wrapForward = resolveBannerTransition(15, 16, 16);
  assert.deepEqual(wrapForward, { from: 15, to: 0, direction: 1, isWrap: true });

  const wrapBackward = resolveBannerTransition(0, -1, 16);
  assert.deepEqual(wrapBackward, { from: 0, to: 15, direction: -1, isWrap: true });

  const normalNext = resolveBannerTransition(4, 5, 16);
  assert.deepEqual(normalNext, { from: 4, to: 5, direction: 1, isWrap: false });
});

test('computeProgressiveRenderLimit slices large catalogs cleanly for lite and standard devices', () => {
  const lite = computeProgressiveRenderLimit(120, 0, { isLowEnd: true });
  assert.equal(lite.visible, 18);
  assert.equal(lite.remaining, 102);
  assert.equal(lite.hasMore, true);
  assert.equal(lite.nextLimit, 36);

  const std = computeProgressiveRenderLimit(120, 0, { isLowEnd: false });
  assert.equal(std.visible, 24);
  assert.equal(std.nextLimit, 48);

  const small = computeProgressiveRenderLimit(10, 0, { isLowEnd: true });
  assert.equal(small.visible, 10);
  assert.equal(small.hasMore, false);
});

test('shouldAllowAutoMusicTrigger & shouldEnableDualVideoPreload guard against lag & codec deadlocks', () => {
  assert.equal(shouldAllowAutoMusicTrigger({ isBannerControl: true }), false);
  assert.equal(shouldAllowAutoMusicTrigger({ activeToolTab: 'dracin' }), false);
  assert.equal(shouldAllowAutoMusicTrigger({ activeToolTab: 'audioeditor' }), false);
  assert.equal(shouldAllowAutoMusicTrigger({ activeToolTab: 'prayer' }), true);

  assert.equal(shouldEnableDualVideoPreload({ isLowEnd: true, isMobile: true }), false);
  assert.equal(shouldEnableDualVideoPreload({ isLowEnd: false, isMobile: true }), false);
  assert.equal(shouldEnableDualVideoPreload({ isLowEnd: false, isMobile: false }), true);

  // Android / mobile touch & low-spec devices must avoid Chromium Top-Layer div.requestFullscreen() freezes
  assert.equal(
    shouldUseNativeDomFullscreen({
      userAgent: 'Mozilla/5.0 (Linux; Android 13; CPH2477) AppleWebKit/537.36 Chrome/126.0.0.0 Mobile Safari/537.36',
      hardwareConcurrency: 8,
      deviceMemory: 8,
      maxTouchPoints: 5,
      innerWidth: 390,
    }),
    false
  );
  assert.equal(
    shouldUseNativeDomFullscreen({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile',
      maxTouchPoints: 5,
      innerWidth: 390,
    }),
    false
  );
  assert.equal(
    shouldUseNativeDomFullscreen({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0.0.0',
      hardwareConcurrency: 8,
      deviceMemory: 16,
      maxTouchPoints: 0,
      innerWidth: 1440,
      prefersReducedMotion: false,
    }),
    true
  );
});

test('tools-ui.js uses dynamic lazy imports instead of eager static imports for heavy utilities', () => {
  const repoDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
  const toolsUiSrc = fs.readFileSync(path.join(repoDir, 'js/tools-ui.js'), 'utf8');
  const eagerForbidden = [
    './dracin-ui.js',
    './audio-editor-ui.js',
    './manifest-ai-ui.js',
    './plagiarism-ui.js',
    './novel-ui.js',
    './callerid-ui.js',
    './shortlink-ui.js',
    './converter.js',
    './compressor.js',
    './song-finder.js',
    './speedtest.js',
    './globe.js',
    './downloader.js',
    './music.js',
  ];
  for (const mod of eagerForbidden) {
    const staticImportRe = new RegExp(`^import\\s+[\\s\\S]*?from\\s+['"]${mod.replace('.', '\\.')}`, 'm');
    assert.equal(staticImportRe.test(toolsUiSrc), false, `Expected ${mod} to be dynamically lazy-imported, not statically imported`);
  }

  // Verify Service Worker precache stays lean (< 30 core shell assets) so first visit is never bandwidth-starved
  const swSrc = fs.readFileSync(path.join(repoDir, 'sw.js'), 'utf8');
  const precacheMatch = swSrc.match(/const PRECACHE_ASSETS\s*=\s*\[([\s\S]*?)\];/);
  assert.ok(precacheMatch, 'PRECACHE_ASSETS must exist in sw.js');
  const items = precacheMatch[1].match(/'\.\/[^']+'/g) || [];
  assert.ok(items.length > 5 && items.length <= 30, `PRECACHE_ASSETS should stay lean (got ${items.length})`);

  // Verify Dracin & Novel fullscreen callers guard requestFullscreen via shouldUseNativeDomFullscreen
  const dracinUiSrc = fs.readFileSync(path.join(repoDir, 'js/dracin-ui.js'), 'utf8');
  const novelUiSrc = fs.readFileSync(path.join(repoDir, 'js/novel-ui.js'), 'utf8');
  assert.match(dracinUiSrc, /shouldUseNativeDomFullscreen\(/, 'dracin-ui.js must guard requestFullscreen fallback with shouldUseNativeDomFullscreen');
  assert.match(dracinUiSrc, /navigationUI:\s*'hide'/, 'dracin-ui.js must request true fullscreen with navigationUI: hide');
  assert.match(dracinUiSrc, /dracin-rail-quality-btn/, 'dracin-ui.js must provide an in-fullscreen resolution switcher button');
  assert.match(dracinUiSrc, /window\.addEventListener\('popstate'/, 'dracin-ui.js must handle Android Back button via popstate in Cinema Fullscreen');
  assert.match(novelUiSrc, /shouldUseNativeDomFullscreen\(/, 'novel-ui.js must guard requestFullscreen with shouldUseNativeDomFullscreen');

  // Verify CENC decryptor supports AbortSignal & micro-batch yielding to avoid 720P+ mobile freeze
  const cencSrc = fs.readFileSync(path.join(repoDir, 'js/dracin-cenc.js'), 'utf8');
  assert.match(cencSrc, /BATCH_SIZE\s*=\s*16/, 'dracin-cenc.js must batch sample decryption');
  assert.match(cencSrc, /signal\?\.aborted/, 'dracin-cenc.js must honor AbortSignal during decryption');

  // Verify live feed engine supports cache busting & unlimited keyword waves
  const dracinSrc = fs.readFileSync(path.join(repoDir, 'js/dracin.js'), 'utf8');
  assert.match(dracinSrc, /X-No-Cache/, 'dracin.js must bypass proxy cache on forceRefresh');
  assert.match(dracinSrc, /LIVE_DISCOVERY_KEYWORDS/, 'dracin.js must support unlimited multi-keyword discovery waves');
});

test('v78 resolution helpers & mobile anti-freeze Auto-540P selector work accurately', () => {
  const servers = [
    { id: 's-1080', kind: 'cenc-mp4', qualityLabel: '1080P', label: 'Melolo Original 1080P (CENC HD)' },
    { id: 's-720', kind: 'cenc-mp4', qualityLabel: '720P', label: 'Melolo Original 720P (CENC HD)' },
    { id: 's-540', kind: 'cenc-mp4', qualityLabel: '540P', label: 'Melolo Original 540P (CENC HD)' },
    { id: 's-480', kind: 'cenc-mp4', qualityLabel: '480P', label: 'Melolo Original 480P (CENC HD)' },
  ];

  assert.equal(parseServerResolutionHeight(servers[0]), 1080);
  assert.equal(parseServerResolutionHeight(servers[2]), 540);
  assert.equal(formatShortQualityBadge(servers[2]), '540P');
  assert.equal(formatShortQualityBadge({ qualityLabel: '' }), 'HD');

  // Mobile/low-end Auto defaults to smooth anti-freeze 540P instead of heavy 1080P/720P
  assert.equal(
    pickBestPlaybackServer(servers, null, { preferredQuality: 'auto', isMobile: true, isLowEnd: true })?.id,
    's-540'
  );
  // Desktop Auto preserves highest default server (1080P / first entry)
  assert.equal(
    pickBestPlaybackServer(servers, null, { preferredQuality: 'auto', isMobile: false, isLowEnd: false })?.id,
    's-1080'
  );
  // Explicit user selection always overrides mobile default (e.g. user chooses 720P or 480P in fullscreen)
  assert.equal(
    pickBestPlaybackServer(servers, null, { preferredQuality: '720p', isMobile: true, isLowEnd: true })?.id,
    's-720'
  );
  assert.equal(
    pickBestPlaybackServer(servers, null, { preferredQuality: '480p', isMobile: false, isLowEnd: false })?.id,
    's-480'
  );
});

test('v78 mergeParallelDracinFeeds liveFirst places fresh daily releases ahead of static baseline & latest filter works', () => {
  const baseline = [
    { id: 'old-1', title: 'Drama Lama Statis', platformId: 'dramabox', isLiveFresh: false },
  ];
  const liveBuckets = [
    {
      sourceId: 'nuno-dramabox-latest',
      fallbackPlatformId: 'dramabox',
      items: [
        { id: 'new-1', title: 'Rilis Hari Ini CEO Pewaris', platformId: 'dramabox', liveSection: 'latest' },
      ],
    },
  ];

  const liveFirstList = mergeParallelDracinFeeds(liveBuckets, baseline, { liveFirst: true });
  assert.equal(liveFirstList[0].title, 'Rilis Hari Ini CEO Pewaris');
  assert.equal(liveFirstList[0].isLiveFresh, true);
  assert.equal(liveFirstList[1].title, 'Drama Lama Statis');

  const latestOnly = filterDracinCatalog(liveFirstList, { genreId: 'latest' });
  assert.equal(latestOnly.length, 1);
  assert.equal(latestOnly[0].title, 'Rilis Hari Ini CEO Pewaris');
});

test('v79 unwrapNunoSubtitleUrl, multi-format parseSubtitleText (VTT/SRT/ASS/JSON/Jina), and extractNunoWatchPayload subtitle extraction', () => {
  const proxiedNetShort =
    '/api/proxy/video?url=https%3A%2F%2Fns-aws-cdn.netshort.com%2Fsub%2Fep1_id.vtt&sub=1';
  assert.equal(
    unwrapNunoSubtitleUrl(proxiedNetShort),
    'https://ns-aws-cdn.netshort.com/sub/ep1_id.vtt'
  );
  const proxiedDramaWave =
    'https://nunodrama.my.id/api/proxy/video?url=https%3A%2F%2Fvideo-v81.mydramawave.com%2Fvt%2F1.srt';
  assert.equal(
    unwrapNunoSubtitleUrl(proxiedDramaWave),
    'https://video-v81.mydramawave.com/vt/1.srt'
  );

  // Extract unwrapped CORS CDN URL from watch page HTML while preserving proxyUrl fallback
  const fakeHtml = `
    <video id="player" data-src="https://cdn.example.com/v.mp4" data-kind="mp4"></video>
    <button data-sub-option data-lang="off" data-url=""></button>
    <button data-sub-option data-lang="id_ID" data-label="Indonesia" data-url="/api/proxy/video?url=https%3A%2F%2Fns-aws-cdn.netshort.com%2Fid.vtt&amp;sub=1"></button>
  `;
  const payload = extractNunoWatchPayload(fakeHtml, 'netshort', 1);
  assert.equal(payload.subtitles.length, 1);
  assert.equal(payload.subtitles[0].url, 'https://ns-aws-cdn.netshort.com/id.vtt');
  assert.ok(payload.subtitles[0].proxyUrl.includes('nunodrama.my.id/api/proxy/video'));

  // Parse r.jina.ai-wrapped WebVTT
  const jinaVtt = `Title: sub\nURL Source: https://ns-aws-cdn.netshort.com/id.vtt\n\nMarkdown Content:\nWEBVTT\n\n00:00:02.750 --> 00:00:03.875\nTerlalu lambat, Nak!\n\n00:00:04.100 --> 00:00:06.000\nAyo cepat!`;
  const vttCues = parseSubtitleText(jinaVtt);
  assert.equal(vttCues.length, 2);
  assert.equal(vttCues[0].text, 'Terlalu lambat, Nak!');

  // Parse SRT
  const srt = `1\n00:00:01,000 --> 00:00:03,500\nHalo Indonesia!\n\n2\n00:00:04,000 --> 00:00:06,200\nDrama pendek gratis.`;
  const srtCues = parseSubtitleText(srt);
  assert.equal(srtCues.length, 2);
  assert.equal(srtCues[1].text, 'Drama pendek gratis.');

  // Parse ASS/SSA
  const ass = `[Events]\nDialogue: 0,0:00:01.20,0:00:04.50,Default,,0,0,0,,{\\an8}Selamat datang\\Ndi Jakarta`;
  const assCues = parseSubtitleText(ass);
  assert.equal(assCues.length, 1);
  assert.equal(assCues[0].text, 'Selamat datang\ndi Jakarta');

  // Parse JSON cues
  const jsonCues = parseSubtitleText(JSON.stringify([{ start: 1.5, end: 4.0, text: 'Baris JSON' }]));
  assert.equal(jsonCues.length, 1);
  assert.equal(jsonCues[0].text, 'Baris JSON');
});

test('v79 Indonesian short dramas (100% free Ep 1-Finale), scroll-to-player guard, subtitle drawer, and Drama Pendek global sync', () => {
  assert.ok(DRACIN_GENRES.some((g) => g.id === 'indonesia'), 'DRACIN_GENRES must include indonesia filter');
  const indoSeed = CURATED_DRACIN_CATALOG.filter((d) => isIndonesianShortDrama(d));
  assert.ok(indoSeed.length >= 16, `Expected >= 16 verified Indonesian short dramas, got ${indoSeed.length}`);
  assert.ok(
    indoSeed.every((d) => d.isFullFree === true && d.isVipUnlocked === true && d.totalEpisodes >= 40),
    'All seeded Indonesian short dramas must be 100% free Ep 1 to Finale'
  );

  const normalizedPool = mergeParallelDracinFeeds([], CURATED_DRACIN_CATALOG);
  const filteredIndo = filterDracinCatalog(normalizedPool, { genreId: 'indonesia' });
  assert.ok(filteredIndo.length >= 16, `Expected >= 16 filtered Indonesian short dramas, got ${filteredIndo.length}`);

  // Legacy localStorage migration: Drama China -> Drama Pendek
  const migratedUtil = normalizeUtilityConfig({
    items: [
      {
        id: 'dracin',
        label: 'Drama China',
        pageTitle: 'Drama China (Dracin) Gratis Tanpa Iklan — 20+ Platform',
        heroTitle: 'Nonton Drama China Pendek Gratis Tanpa Iklan',
      },
    ],
  });
  const migratedDracin = migratedUtil.items.find((i) => i.id === 'dracin');
  assert.equal(migratedDracin?.label, 'Drama Pendek');
  assert.match(migratedDracin?.heroTitle || '', /Drama Pendek/);

  const migratedBanners = normalizeBanners([
    {
      id: 'banner-dracin',
      utilityId: 'dracin',
      heading: 'Nonton Drama China Full Episode Gratis',
      ctaLabel: 'Tonton Dracin →',
      href: './tools.html?tab=dracin',
    },
  ]);
  assert.equal(migratedBanners[0].heading, 'Nonton Drama Pendek Full Episode Gratis');
  assert.equal(migratedBanners[0].ctaLabel, 'Tonton Drama →');

  // Verify static UI guards for bottom-scroll fix, subtitle drawer, and Drama Pendek rename
  const repoDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
  const dracinUiSrc = fs.readFileSync(path.join(repoDir, 'js/dracin-ui.js'), 'utf8');
  assert.match(dracinUiSrc, /function scrollPlayerStageToTop\(/, 'dracin-ui.js must implement scrollPlayerStageToTop');
  assert.match(dracinUiSrc, /function toggleFullscreenSubtitleDrawer\(/, 'dracin-ui.js must implement in-stage Subtitle Drawer');
  assert.match(dracinUiSrc, /Asisten AI Drama Pendek/, 'dracin-ui.js must rename Asisten AI Dracin to Asisten AI Drama Pendek');

  const indexHtml = fs.readFileSync(path.join(repoDir, 'index.html'), 'utf8');
  const toolsHtml = fs.readFileSync(path.join(repoDir, 'tools.html'), 'utf8');
  assert.equal(indexHtml.includes('>Drama China<'), false, 'index.html must not contain stale Drama China nav label');
  assert.equal(toolsHtml.includes('>Drama China<'), false, 'tools.html must not contain stale Drama China tab label');
});

