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
  assert.match(dracinUiSrc, /shouldUseNativeDomFullscreen\(/, 'dracin-ui.js must guard requestFullscreen with shouldUseNativeDomFullscreen');
  assert.match(dracinUiSrc, /window\.addEventListener\('popstate'/, 'dracin-ui.js must handle Android Back button via popstate in Cinema Fullscreen');
  assert.match(novelUiSrc, /shouldUseNativeDomFullscreen\(/, 'novel-ui.js must guard requestFullscreen with shouldUseNativeDomFullscreen');
});
