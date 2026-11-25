import test from 'node:test';
import assert from 'node:assert/strict';

import {
  WEBPROXY_THEMES,
  WEBPROXY_THEME_CATEGORIES,
  filterWebProxyThemes,
  getWebProxyThemeById,
} from './webproxy-themes.js';
import {
  BROWSER_AI_MODELS,
  DEFAULT_SPEED_DIAL_SITES,
  PRIVACY_SEARCH_ENGINES,
  PROXY_ROUTING_MODES,
  appendPrivateHistoryRecord,
  buildBrowserAiSystemPrompt,
  canTabGoBack,
  canTabGoForward,
  createBrowserTab,
  evaluateProxySiteSecurity,
  isSocialVideoPlatformUrl,
  mergeDetectedMediaLists,
  normalizeProxyInput,
  pushTabHistoryEntry,
} from './webproxy-logic.js';
import {
  cleanWaybackHtml,
  extractMediaFromHtml,
  sanitizeAndRewriteHtml,
  validatePublicProxyUrl,
} from '../functions/api/web-proxy.js';

test('v91 Web Proxy: provides 108 unique curated themes across all categories with search & filtering', () => {
  assert.ok(WEBPROXY_THEMES.length >= 105, `Expected 105+ themes, got ${WEBPROXY_THEMES.length}`);
  assert.equal(WEBPROXY_THEMES.length, 108);

  const uniqueIds = new Set(WEBPROXY_THEMES.map((t) => t.id));
  assert.equal(uniqueIds.size, WEBPROXY_THEMES.length, 'Every theme ID must be unique');

  assert.ok(WEBPROXY_THEME_CATEGORIES.length >= 7);
  for (const cat of WEBPROXY_THEME_CATEGORIES) {
    if (cat.id === 'all') continue;
    const matched = filterWebProxyThemes({ category: cat.id });
    assert.ok(matched.length >= 15, `Category ${cat.id} should have at least 15 themes`);
  }

  const cyberHits = filterWebProxyThemes({ query: 'cyber' });
  assert.ok(cyberHits.length >= 1);

  const fallbackTheme = getWebProxyThemeById('nonexistent-theme-xyz');
  assert.equal(fallbackTheme.id, WEBPROXY_THEMES[0].id);

  for (const theme of WEBPROXY_THEMES) {
    assert.ok(theme.id && theme.name && theme.category);
    assert.equal(typeof theme.isDark, 'boolean');
    assert.ok(theme.chromeBg && theme.toolbarBg && theme.surfaceBg && theme.textColor && theme.accentColor && theme.borderColor);
  }
});

test('v91 Web Proxy: normalizeProxyInput parses URLs, strips trackers, routes queries, and blocks SSRF/dangerous schemes', () => {
  const bare = normalizeProxyInput('example.com/news?utm_source=ads&fbclid=123&id=7');
  assert.equal(bare.type, 'url');
  assert.equal(bare.url, 'https://example.com/news?id=7');
  assert.deepEqual(bare.strippedTrackers.sort(), ['fbclid', 'utm_source']);

  const search = normalizeProxyInput('tutorial belajar javascript gratis');
  assert.equal(search.type, 'search');
  assert.equal(search.query, 'tutorial belajar javascript gratis');

  const blockedSamples = [
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'file:///etc/passwd',
    'http://127.0.0.1:3000/admin',
    'http://localhost/secret',
    'http://169.254.169.254/latest/meta-data/',
    'http://10.0.0.1/',
    'http://192.168.1.1/',
    'http://172.16.0.1/',
    'http://0x7f000001/',
    'http://2130706433/',
    'https://user:pass@example.com/',
  ];
  for (const sample of blockedSamples) {
    const res = normalizeProxyInput(sample);
    assert.equal(res.type, 'blocked', `Expected "${sample}" to be blocked, got ${JSON.stringify(res)}`);
  }
});

test('v91 Web Proxy Backend: validatePublicProxyUrl enforces strict SSRF & malware/scheme hygiene', () => {
  const valid = validatePublicProxyUrl('https://id.wikipedia.org/wiki/Indonesia?utm_medium=social&gclid=abc');
  assert.equal(valid.ok, true);
  assert.equal(valid.url, 'https://id.wikipedia.org/wiki/Indonesia');
  assert.deepEqual(valid.strippedTrackers.sort(), ['gclid', 'utm_medium']);

  const ssrfTargets = [
    'http://127.0.0.1/',
    'http://169.254.169.254/latest/meta-data/',
    'http://100.64.0.1/',
    'http://[::1]/',
    'http://[fc00::1]/',
    'http://[::ffff:127.0.0.1]/',
    'http://metadata.google.internal/',
    'http://0177.0.0.1/',
    'http://0x7f000001/',
    'http://2130706433/',
    'http://admin:1234@example.com/',
    'ftp://example.com/file.zip',
  ];
  for (const target of ssrfTargets) {
    const check = validatePublicProxyUrl(target);
    assert.equal(check.ok, false, `Backend SSRF guard must block ${target}`);
  }
});

test('v91 Web Proxy Backend: extractMediaFromHtml detects VidMate-style video/audio streams & deduplicates', () => {
  const sampleHtml = `
    <html>
      <head>
        <meta property="og:video" content="https://cdn.example.com/media/trailer-hd.mp4" />
        <script type="application/ld+json">
          {"@type":"VideoObject","name":"Demo Clip","contentUrl":"https://cdn.example.com/media/live.m3u8"}
        </script>
      </head>
      <body>
        <video src="/clips/intro.mp4" poster="/clips/thumb.jpg">
          <source src="https://cdn.example.com/media/trailer-hd.mp4" type="video/mp4" />
          <source src="https://cdn.example.com/media/alt-720p.webm" type="video/webm" />
        </video>
        <audio src="https://cdn.example.com/audio/podcast.mp3"></audio>
      </body>
    </html>
  `;
  const media = extractMediaFromHtml(sampleHtml, 'https://media.example.com/watch/1', 'Demo Video');
  const urls = media.map((m) => m.url);

  assert.ok(urls.includes('https://cdn.example.com/media/trailer-hd.mp4'));
  assert.ok(urls.includes('https://cdn.example.com/media/live.m3u8'));
  assert.ok(urls.includes('https://media.example.com/clips/intro.mp4'));
  assert.ok(urls.includes('https://cdn.example.com/media/alt-720p.webm'));
  assert.ok(urls.includes('https://cdn.example.com/audio/podcast.mp3'));
  // Deduplicated trailer-hd.mp4
  assert.equal(urls.filter((u) => u === 'https://cdn.example.com/media/trailer-hd.mp4').length, 1);
});

test('v91 Web Proxy Backend: sanitizeAndRewriteHtml blocks ads/trackers, removes XSS handlers, and injects safe nav bridge', () => {
  const dirtyHtml = `
    <!doctype html>
    <html>
      <head>
        <title>Test Portal</title>
        <script src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"></script>
        <script src="https://www.googletagmanager.com/gtag/js?id=G-123"></script>
      </head>
      <body>
        <ins class="adsbygoogle" data-ad-slot="123"></ins>
        <iframe src="https://doubleclick.net/ad/banner"></iframe>
        <img src="https://www.google-analytics.com/collect?v=1" width="1" height="1" />
        <a href="/artikel/1" onclick="evil()">Baca Artikel</a>
        <a href="javascript:alert(1)">Link Berbahaya</a>
      </body>
    </html>
  `;
  const res = sanitizeAndRewriteHtml(dirtyHtml, 'https://portal.example.com/home', {
    adBlock: true,
    antiTrack: true,
    darkTheme: false,
  });

  assert.ok(res.blockedAds >= 2, `Expected >=2 blocked ads, got ${res.blockedAds}`);
  assert.ok(res.blockedTrackers >= 1, `Expected >=1 blocked tracker, got ${res.blockedTrackers}`);
  assert.equal(res.sanitizedHtml.includes('adsbygoogle.js'), false);
  assert.equal(res.sanitizedHtml.includes('doubleclick.net'), false);
  assert.equal(res.sanitizedHtml.includes('onclick="evil()"'), false);
  assert.equal(/href\s*=\s*["']javascript:/i.test(res.sanitizedHtml), false);
  assert.ok(res.sanitizedHtml.includes('MANIFEST_PROXY_NAV'));
});

test('v92 Web Proxy Backend: preserves async preload CSS, removes crossorigin blocks, restores Wayback URLs, promotes lazy images, and never forces dark color-scheme', () => {
  const waybackDirty = `
    <!-- BEGIN WAYBACK TOOLBAR INSERT --><div id="wm-ipp">Wayback Bar</div><!-- END WAYBACK TOOLBAR INSERT -->
    <html><head>
      <link rel="preload" as="style" href="/web/20260322101500cs_/https://cdn.liputan6.com/app.css" onload="this.rel='stylesheet'" crossorigin="anonymous" integrity="sha384-abc">
      <link rel="stylesheet" href="https://web.archive.org/web/20260322cs_/https://cdn.liputan6.com/icons.css" crossorigin="anonymous">
    </head><body>
      <img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" data-src="/web/20260322im_/https://cdn.liputan6.com/photo.jpg" alt="News">
    </body></html>
  `;
  const cleanedWb = cleanWaybackHtml(waybackDirty);
  assert.equal(cleanedWb.includes('Wayback Bar'), false);
  assert.ok(cleanedWb.includes('https://cdn.liputan6.com/app.css'));
  assert.ok(cleanedWb.includes('https://cdn.liputan6.com/icons.css'));
  assert.equal(cleanedWb.includes('/web/20260322'), false);

  const sanitized = sanitizeAndRewriteHtml(waybackDirty, 'https://www.liputan6.com/', {
    adBlock: true,
    antiTrack: true,
    darkTheme: true,
  });
  // Async preload stylesheet must become active rel="stylesheet" without crossorigin/integrity
  assert.match(sanitized.sanitizedHtml, /rel="stylesheet"[^>]*https:\/\/cdn\.liputan6\.com\/app\.css/);
  assert.equal(sanitized.sanitizedHtml.includes('crossorigin='), false);
  assert.equal(sanitized.sanitizedHtml.includes('integrity='), false);
  // Lazy data-src image must be promoted to real src
  assert.match(sanitized.sanitizedHtml, /src="https:\/\/cdn\.liputan6\.com\/photo\.jpg"/);
  // Must NOT force dark color-scheme onto external light-designed websites
  assert.equal(sanitized.sanitizedHtml.includes('color-scheme: dark'), false);
});

test('v91 Web Proxy: security audit, multi-tab history, Incognito zero-history guarantee, and Multi-AI context', () => {
  assert.equal(PROXY_ROUTING_MODES.length, 4);
  assert.equal(PRIVACY_SEARCH_ENGINES.length, 3);
  assert.ok(BROWSER_AI_MODELS.length >= 6);
  assert.ok(DEFAULT_SPEED_DIAL_SITES.length >= 8);

  const safeSec = evaluateProxySiteSecurity('https://id.wikipedia.org/wiki/Indonesia');
  assert.equal(safeSec.level, 'safe');

  const httpSec = evaluateProxySiteSecurity('http://legacy.example.com/');
  assert.equal(httpSec.level, 'caution');

  const malwareSec = evaluateProxySiteSecurity('https://hadiah-gratis.example.com/unduh/app.apk');
  assert.equal(malwareSec.level, 'danger');

  assert.equal(isSocialVideoPlatformUrl('https://www.tiktok.com/@user/video/123456'), true);
  assert.equal(isSocialVideoPlatformUrl('https://youtu.be/dQw4w9WgXcQ'), true);
  assert.equal(isSocialVideoPlatformUrl('https://example.com/'), false);

  let tab = createBrowserTab('t1');
  assert.equal(canTabGoBack(tab), false);
  tab = pushTabHistoryEntry(tab, { type: 'url', value: 'https://example.com/', title: 'Example' });
  tab = pushTabHistoryEntry(tab, { type: 'url', value: 'https://id.wikipedia.org/', title: 'Wikipedia' });
  assert.equal(canTabGoBack(tab), true);
  assert.equal(canTabGoForward(tab), false);

  // Incognito ON (default): ZERO history stored!
  const incognitoHistory = appendPrivateHistoryRecord(
    [{ url: 'https://old.example.com', title: 'Old' }],
    { url: 'https://secret.example.com', title: 'Secret' },
    { incognitoMode: true }
  );
  assert.deepEqual(incognitoHistory, []);

  // Incognito OFF (opt-in local only): stores and deduplicates cleanly
  const optIn1 = appendPrivateHistoryRecord([], { url: 'https://example.com/', title: 'Example' }, { incognitoMode: false });
  assert.equal(optIn1.length, 1);
  const optIn2 = appendPrivateHistoryRecord(optIn1, { url: 'https://example.com/', title: 'Example Updated' }, { incognitoMode: false });
  assert.equal(optIn2.length, 1);
  assert.equal(optIn2[0].title, 'Example Updated');

  const mergedMedia = mergeDetectedMediaLists(
    [{ url: 'https://a.com/v.mp4', label: 'Page Video' }],
    [{ url: 'https://a.com/v.mp4', label: 'Social Video' }, { url: 'https://a.com/hd.mp4', label: 'HD' }]
  );
  assert.equal(mergedMedia.length, 2);
  assert.equal(mergedMedia[0].label, 'Social Video');

  const aiPrompt = buildBrowserAiSystemPrompt({
    title: 'Wikipedia Indonesia',
    url: 'https://id.wikipedia.org/',
    textSnippet: 'Ensiklopedia bebas berbahasa Indonesia.',
    media: mergedMedia,
    security: safeSec,
  });
  assert.match(aiPrompt, /Gemini, ChatGPT, DeepSeek, Grok, dan Meta Llama/);
  assert.match(aiPrompt, /Wikipedia Indonesia/);
  assert.match(aiPrompt, /2 file/);
});
