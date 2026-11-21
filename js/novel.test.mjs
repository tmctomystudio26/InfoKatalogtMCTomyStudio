import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  BUILTIN_NOVEL_THEMES,
  TOTAL_BUILTIN_THEMES,
  THEME_CATEGORIES,
  READER_FONTS,
  buildCustomUploadedTheme,
  buildIllustrationSvgUri,
  compileThemeFromPrompt,
  contrastRatio,
} from './novel-themes.js';

import {
  NOVEL_GENRES,
  buildProceduralBookCover,
  extractNovelSearchQueries,
  extractSeriesTitleFromChapter,
  isNovelFreeFullAccess,
  mergeUnifiedNovels,
  normalizeUnifiedNovel,
  paginateChapterParagraphs,
  sanitizeChapterToParagraphs,
  scoreNovelExcerptMatch,
} from './novel-logic.js';

import { DEFAULT_UTILITY_CONFIG } from './store.js';

test('Novel Theme Studio ships 120+ built-in unique themes with WCAG-AA readable contrast', () => {
  assert.ok(TOTAL_BUILTIN_THEMES >= 120, `Expected >= 120 built-in themes, got ${TOTAL_BUILTIN_THEMES}`);
  assert.equal(BUILTIN_NOVEL_THEMES.length, TOTAL_BUILTIN_THEMES);

  const ids = new Set();
  const categoryCounts = new Map();
  let animatedCount = 0;
  let illustratedCount = 0;

  for (const theme of BUILTIN_NOVEL_THEMES) {
    assert.ok(theme.id && !ids.has(theme.id), `Duplicate or missing theme id: ${theme.id}`);
    ids.add(theme.id);
    assert.ok(theme.name && theme.name.length >= 3);
    assert.match(theme.bg, /^#[0-9a-f]{6}$/i);
    assert.match(theme.surface, /^(#[0-9a-f]{6}|rgba?\([^)]+\))$/i);
    assert.match(theme.text, /^#[0-9a-f]{6}$/i);
    const ratio = contrastRatio(theme.surface, theme.text);
    assert.ok(
      ratio >= 4.5,
      `Theme "${theme.id}" (${theme.surface} vs ${theme.text}) has insufficient WCAG-AA contrast: ${ratio.toFixed(2)}`
    );
    categoryCounts.set(theme.category, (categoryCounts.get(theme.category) || 0) + 1);
    if (theme.animation && theme.animation !== 'none') animatedCount += 1;
    if (theme.patternSvg) illustratedCount += 1;
  }

  assert.ok(animatedCount >= 20, `Expected >= 20 animated themes, got ${animatedCount}`);
  assert.ok(illustratedCount >= 20, `Expected >= 20 illustrated/textured themes, got ${illustratedCount}`);
  assert.ok(THEME_CATEGORIES.length >= 6);
  assert.ok(READER_FONTS.length >= 5);
});

test('AI Theme Compiler & Custom Theme Upload guarantee readable WCAG-AA themes with animation & motif detection', () => {
  const sakuraRain = compileThemeFromPrompt('Malam hujan tenang di Kyoto dengan bunga sakura pink lembut');
  assert.equal(sakuraRain.category, 'custom');
  assert.equal(sakuraRain.isDark, true);
  assert.ok(['sakura', 'rain'].includes(sakuraRain.animation));
  assert.ok(contrastRatio(sakuraRain.surface, sakuraRain.text) >= 4.5);

  const lowContrastAiOverride = compileThemeFromPrompt('Kertas putih bersih', {
    name: 'Putih Bersih AI',
    bg: '#ffffff',
    surface: '#ffffff',
    text: '#fefefe', // Intentionally unreadable -> compiler MUST auto-correct!
    accent: '#2563eb',
    isDark: false,
  });
  assert.ok(
    contrastRatio(lowContrastAiOverride.surface, lowContrastAiOverride.text) >= 7.0,
    'AI theme compiler must auto-repair unreadable low-contrast text colors'
  );

  const customImg = buildCustomUploadedTheme({
    fileName: 'hutan-senja.jpg',
    imageDataUrl: 'data:image/jpeg;base64,/9j/4AAQ',
    isDark: true,
  });
  assert.equal(customImg.category, 'custom');
  assert.equal(customImg.customImage, 'data:image/jpeg;base64,/9j/4AAQ');
  assert.ok(contrastRatio(customImg.surface, customImg.text) >= 4.5);

  const svgUri = buildIllustrationSvgUri('mountains', '#3b82f6', '#94a3b8');
  assert.ok(svgUri.includes('data:image/svg+xml,'));
});

test('Strict Free Full-Access guard blocks VIP, coin-locked, and paywalled stories', () => {
  assert.equal(isNovelFreeFullAccess({ title: 'Shadow Slave', isPaywalled: false, paid: false }), true);
  assert.equal(isNovelFreeFullAccess({ title: 'Paid Story', isPaywalled: true }), false);
  assert.equal(isNovelFreeFullAccess({ title: 'Coin Story', paid: true }), false);
  assert.equal(isNovelFreeFullAccess({ title: 'Locked Story', coins: 25 }), false);
  assert.equal(isNovelFreeFullAccess({ title: 'VIP Story', isVip: true }), false);
});

test('Unified multi-platform merge interleaves sources seamlessly, deduplicates, and filters genres', () => {
  const b1 = [
    normalizeUnifiedNovel({
      id: 'sakuranovel:1',
      sourceId: 'sakuranovel',
      sourceName: 'SakuraNovel',
      title: 'Shadow Slave',
      tags: ['Fantasy', 'Action'],
      chapterCount: 3000,
      reads: 900000,
    }),
    normalizeUnifiedNovel({
      id: 'sakuranovel:2',
      sourceId: 'sakuranovel',
      sourceName: 'SakuraNovel',
      title: 'Cinta di Musim Semi',
      tags: ['Romance'],
      chapterCount: 85,
      reads: 50000,
    }),
  ];
  const b2 = [
    normalizeUnifiedNovel({
      id: 'indowebnovel:1',
      sourceId: 'indowebnovel',
      sourceName: 'IndoWebNovel',
      title: 'Shadow Slave', // Duplicate title -> should merge cleanly without duplication!
      tags: ['Fantasy'],
      chapterCount: 3068,
      reads: 1200000,
    }),
    normalizeUnifiedNovel({
      id: 'wattpad:99',
      sourceId: 'wattpad',
      sourceName: 'Wattpad Gratis',
      title: 'Misteri Rumah Tua',
      tags: ['Horror', 'Mystery'],
      chapterCount: 42,
      reads: 320000,
    }),
  ];

  const merged = mergeUnifiedNovels([b1, b2], { sortBy: 'trending', genre: 'all' });
  assert.equal(merged.length, 3, 'Duplicate title across platforms should deduplicate into 1 unified entry');
  const shadow = merged.find((n) => n.title === 'Shadow Slave');
  assert.equal(shadow.chapterCount, 3068, 'Deduped entry keeps highest chapter count');

  const horrorOnly = mergeUnifiedNovels([b1, b2], { genre: 'horror' });
  assert.equal(horrorOnly.length, 1);
  assert.equal(horrorOnly[0].title, 'Misteri Rumah Tua');
  assert.ok(NOVEL_GENRES.length >= 6);
  assert.ok(buildProceduralBookCover('Shadow Slave', 'Guiltythree', 'fantasy').startsWith('data:image/svg+xml,'));
  assert.equal(extractSeriesTitleFromChapter('Shadow Slave Chapter 3068 Bahasa Indonesia'), 'Shadow Slave');
});

test('Chapter sanitization strips ads/scripts and pagination splits chapters accurately for Page Jump', () => {
  const dirtyHtml = `
    <script>alert('xss')</script>
    <p>Langit di atas pelabuhan mulai berubah jingga ketika kapal layar terakhir merapat di dermaga batu tua.</p>
    <p>Baca novel terbaru hanya di situs kami.</p>
    <p>Arka menggenggam kompas perunggu warisan ayahnya erat-erat sambil menatap cakrawala barat yang berkabut.</p>
  `;
  const paras = sanitizeChapterToParagraphs(dirtyHtml);
  assert.equal(paras.length, 2, 'Ad/promo line and script must be removed');
  assert.ok(!paras.join(' ').includes('alert'));
  assert.ok(!paras.join(' ').includes('Baca novel terbaru hanya di'));

  const longParas = Array.from(
    { length: 18 },
    (_, i) => `Paragraf ${i + 1}: ` + 'Kalimat petualangan panjang penuh misteri dan strategi kultivasi kuno. '.repeat(5)
  );
  const pages = paginateChapterParagraphs(longParas, 1100);
  assert.ok(pages.length >= 4, `Expected multi-page split, got ${pages.length}`);
  assert.equal(
    pages.flatMap((p) => p.paragraphs).length,
    longParas.length,
    'Pagination must preserve every paragraph without loss'
  );
});

test('Novel Excerpt / OCR Matcher achieves 100% on verbatim match and handles OCR typos accurately', () => {
  const chapterBody =
    'Di balik gerbang kabut Kerajaan Aethelgard, Sunny mengangkat pedang bayangannya. Angin malam berhembus kencang melewati menara batu hitam yang telah runtuh selama seribu tahun.';
  const exactScore = scoreNovelExcerptMatch(
    'Di balik gerbang kabut Kerajaan Aethelgard, Sunny mengangkat pedang bayangannya.',
    chapterBody,
    'Shadow Slave'
  );
  assert.equal(exactScore.scorePct, 100, 'Exact verbatim excerpt must score 100%');

  const ocrTypoScore = scoreNovelExcerptMatch(
    'Di balik gerbng kabut Kerajan Aethelgard Sunny mengngkat pedang bayanganya',
    chapterBody,
    'Shadow Slave'
  );
  assert.ok(ocrTypoScore.scorePct >= 60, `OCR noisy excerpt should still rank high, got ${ocrTypoScore.scorePct}%`);

  const unrelatedScore = scoreNovelExcerptMatch(
    'Resep nasi goreng kampung pedas dengan terasi dan telur mata sapi',
    chapterBody,
    'Shadow Slave'
  );
  assert.ok(unrelatedScore.scorePct < 20, `Unrelated text must score low, got ${unrelatedScore.scorePct}%`);

  const queries = extractNovelSearchQueries(
    'Di balik gerbang kabut Kerajaan Aethelgard, Sunny mengangkat pedang bayangannya.'
  );
  assert.ok(queries.length >= 1);
});

test('Utility #14 (novel) is registered cleanly in store.js and data/catalog.json', () => {
  const storeItem = DEFAULT_UTILITY_CONFIG.items.find((it) => it.id === 'novel');
  assert.ok(storeItem, 'novel must be registered in DEFAULT_UTILITY_CONFIG.items');
  assert.equal(DEFAULT_UTILITY_CONFIG.items.length, 14);

  const catalogUrl = new URL('../data/catalog.json', import.meta.url);
  const catalog = JSON.parse(fs.readFileSync(catalogUrl, 'utf8'));
  const catItem = catalog.utilities.items.find((it) => it.id === 'novel');
  assert.ok(catItem, 'novel must be registered in data/catalog.json');
  assert.equal(catalog.utilities.items.length, 14);
});
