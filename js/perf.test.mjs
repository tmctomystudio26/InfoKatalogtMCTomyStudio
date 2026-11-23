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
  filterDracinCatalog,
  formatShortQualityBadge,
  mergeParallelDracinFeeds,
  parseServerResolutionHeight,
  pickBestPlaybackServer,
} from './dracin-logic.js';

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
