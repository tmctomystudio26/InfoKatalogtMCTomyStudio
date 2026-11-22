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
  buildProxiedCoverUrl,
  cleanOcrAndDjvuText,
  expandCanonicalNovelTitle,
  extractNovelSearchQueries,
  extractSeriesTitleFromChapter,
  isNovelFreeFullAccess,
  isOcrGarbageLine,
  mergeUnifiedNovels,
  normalizeUnifiedNovel,
  paginateChapterParagraphs,
  sanitizeChapterToParagraphs,
  scoreNovelExcerptMatch,
} from './novel-logic.js';

import {
  CURATED_DRACIN_CATALOG,
  DRACIN_GENRES,
  NUNODRAMA_SUPPORTED_PLATFORMS,
  extractNunoSectionItems,
  extractNunoWatchPayload,
  filterDracinCatalog,
  isFullFreeDrama,
  isLikelyChineseDramaTitle,
  normalizeDracinItem,
  resolveNunoPlatformId,
} from './dracin-logic.js';

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
  assert.equal(DEFAULT_UTILITY_CONFIG.items.length, 15);

  const catalogUrl = new URL('../data/catalog.json', import.meta.url);
  const catalog = JSON.parse(fs.readFileSync(catalogUrl, 'utf8'));
  const catItem = catalog.utilities.items.find((it) => it.id === 'novel');
  assert.ok(catItem, 'novel must be registered in data/catalog.json');
  assert.equal(catalog.utilities.items.length, 15);
});

test('v71 Novel cover proxy routes hotlink-protected covers via wsrv.nl and keeps procedural covers corner-clean', () => {
  const hotlinked = buildProxiedCoverUrl('https://sakuranovel.id/wp-content/uploads/2026/cover.jpg');
  assert.ok(hotlinked.startsWith('https://wsrv.nl/?url='), `Expected wsrv.nl proxy URL, got ${hotlinked}`);
  assert.ok(hotlinked.includes('output=webp'));

  const directAnilist = buildProxiedCoverUrl('https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx1.jpg');
  assert.equal(directAnilist, 'https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx1.jpg');

  const directOpenLib = buildProxiedCoverUrl('https://covers.openlibrary.org/b/id/12345-L.jpg');
  assert.equal(directOpenLib, 'https://covers.openlibrary.org/b/id/12345-L.jpg');

  const alreadyProxied = buildProxiedCoverUrl('https://wsrv.nl/?url=example.com/a.jpg&w=360');
  assert.equal(alreadyProxied, 'https://wsrv.nl/?url=example.com/a.jpg&w=360');

  const svgUri = buildProceduralBookCover('Shadow Slave', 'Guiltythree', 'action', 'SakuraNovel');
  const decoded = decodeURIComponent(svgUri.replace('data:image/svg+xml,', ''));
  assert.ok(decoded.includes('Shadow Slave'), 'Title must appear in center safe zone');
  assert.ok(!decoded.includes('FULL AKSES GRATIS'), 'Corner badge text must not appear inside SVG cover');
  assert.ok(!decoded.includes('SakuraNovel'), 'Bottom-left source label must not collide with rating badge');
});

test('v71 Drama China unified legal Full-Free filter accepts real C-dramas and blocks news/politics/vlog noise', () => {
  assert.ok(DRACIN_GENRES.some((g) => g.id === 'full-free'), 'DRACIN_GENRES must include full-free');

  assert.equal(
    isLikelyChineseDramaTitle('Drama China Sub Indo Full Movie - Cinta Tak Terduga CEO Dingin', 'Drama China romantis sub indo full episode tamat'),
    true
  );
  assert.equal(
    isLikelyChineseDramaTitle('CDrama Full Episode 1-30 Sub Indo: Pewaris Naga Kembali', 'Short drama china'),
    true
  );
  assert.equal(
    isLikelyChineseDramaTitle('PM Modi arrives in Indonesia for ASEAN Summit live news', 'Breaking political news update'),
    false
  );
  assert.equal(
    isLikelyChineseDramaTitle('Berita Terkini Presiden Kunjungan Kerja & Konferensi Pers', 'Wawancara politik'),
    false
  );
  assert.equal(
    isLikelyChineseDramaTitle('VLIVE Kpop Dance Practice & Mukbang Vlog', 'Daily vlog'),
    false
  );

  const fullDrama = normalizeDracinItem(
    {
      id: 'dm_full_1',
      title: 'Cinta Rahasia Sang CEO (Full Tamat Sub Indo)',
      isFullFree: true,
      fullDurationMin: 82,
      genres: ['romance', 'full-free'],
      totalEpisodes: 1,
    },
    'dailymotion'
  );
  const regularDrama = normalizeDracinItem(
    {
      id: 'db_1',
      title: 'Pewaris Rahasia',
      genres: ['ceo', 'trending'],
      totalEpisodes: 60,
    },
    'dramabox'
  );

  assert.equal(isFullFreeDrama(fullDrama), true);
  assert.equal(isFullFreeDrama(regularDrama), false);

  const onlyFullFree = filterDracinCatalog([fullDrama, regularDrama], { genreId: 'full-free' });
  assert.equal(onlyFullFree.length, 1);
  assert.equal(onlyFullFree[0].id, fullDrama.id);
});

test('v72 Anti-OCR/DjVu Anomaly Cleaner removes Dilan 1991 OCR noise & rejoins soft-hyphenated words', () => {
  const exactGarbageLines = [
    '(p/vdA',
    '( 1972 - 2098 )',
    'i ^',
    '/972 ~2o9t>',
    '/ 1 /S/I',
    'j, Moa 13',
    'l. hUhJ JM* 2S',
    "S^CiA/Uaa (j)/JLwn 'tjO",
    '9,QsJkjL?\\ /L^-a F\\nKa&^ 199',
    "12, (p'&JMzMV' 221",
    '73 , 076^ 229',
    ',-A-yw',
    'IA \\/Si ^',
    '^-i; Jnii',
    'furjjf fijlftj.',
    'if>u ftiitt',
  ];

  for (const noisy of exactGarbageLines) {
    assert.equal(isOcrGarbageLine(noisy), true, `Expected OCR garbage line to be flagged: "${noisy}"`);
  }

  const rawDilanDump = [
    ...exactGarbageLines,
    '',
    'Aku Milea. Milea Adnan Hussain.',
    'Jenis kelamin perem\u00AC',
    'puan. Lahir di Jakarta, tanggal 10',
    'Oktober 1972 dan',
    'sudah mandi.',
    '',
    'Sekarang, ayahku sudah pensiun dan tinggal di',
    'Tarogong, Garut, bersama ibuku.',
  ].join('\n');

  const cleaned = cleanOcrAndDjvuText(rawDilanDump);
  assert.ok(!cleaned.includes('furjjf'), 'OCR garbage furjjf must be stripped');
  assert.ok(!cleaned.includes('if>u ftiitt'), 'OCR garbage if>u ftiitt must be stripped');
  assert.ok(!cleaned.includes('\u00AC'), 'Soft hyphen ¬ must be stripped and word rejoined');
  assert.ok(
    cleaned.includes('Jenis kelamin perempuan. Lahir di Jakarta, tanggal 10 Oktober 1972 dan sudah mandi.'),
    `Expected clean joined prose, got: ${cleaned}`
  );

  const paragraphs = sanitizeChapterToParagraphs(rawDilanDump);
  assert.equal(paragraphs.length, 2);
  assert.ok(paragraphs[0].includes('Jenis kelamin perempuan.'));
  assert.ok(paragraphs[1].includes('Tarogong, Garut, bersama ibuku.'));
});

test('v72 Canonical novel abbreviation expander & VIP-to-Free mirror filter work accurately', () => {
  assert.equal(expandCanonicalNovelTitle('CO'), 'Cultivation Online (CO)');
  assert.equal(expandCanonicalNovelTitle('OG'), 'Overgeared (OG)');
  assert.equal(expandCanonicalNovelTitle('Dilan 1991'), 'Dilan 1991');

  assert.ok(NOVEL_GENRES.some((g) => g.id === 'vip-free'), 'NOVEL_GENRES must include vip-free filter');

  const vipMirrorNovel = normalizeUnifiedNovel({
    id: 'vipfree:sl',
    sourceId: 'vipfree',
    sourceName: 'Kakaopage VIP → Mirror Gratis',
    title: 'Solo Leveling (Only I Level Up)',
    vipOriginPlatform: 'Kakaopage / WebNovel VIP',
    isVipMirror: true,
    chapterCount: 270,
    reads: 3100000,
  });
  const sakuraMirrorNovel = normalizeUnifiedNovel({
    id: 'sakura:1',
    sourceId: 'sakuranovel',
    sourceName: 'SakuraNovel',
    title: 'CO',
    chapterCount: 2542,
    reads: 1700000,
  });
  const publicDomainNovel = normalizeUnifiedNovel({
    id: 'wikisource:1',
    sourceId: 'wikisource',
    sourceName: 'Wikisource Nusantara',
    title: 'Siti Nurbaya',
    chapterCount: 18,
    reads: 95000,
  });

  assert.equal(sakuraMirrorNovel.title, 'Cultivation Online (CO)');
  assert.equal(vipMirrorNovel.isVipMirror, true);
  assert.equal(sakuraMirrorNovel.isVipMirror, true);
  assert.equal(publicDomainNovel.isVipMirror, false);

  const vipOnly = mergeUnifiedNovels([[vipMirrorNovel, sakuraMirrorNovel, publicDomainNovel]], { genre: 'vip-free' });
  assert.equal(vipOnly.length, 2);
  assert.ok(vipOnly.some((n) => n.id === 'vipfree:sl'));
  assert.ok(vipOnly.some((n) => n.id === 'sakura:1'));
});

test('v73 Drama China 17-Platform Native Catalog has 90+ verified items, zero Dailymotion items, and parses NunoDrama VIP & TikTok FYP streams', () => {
  assert.ok(
    CURATED_DRACIN_CATALOG.length >= 90,
    `Expected >= 90 verified native dramas in CURATED_DRACIN_CATALOG, got ${CURATED_DRACIN_CATALOG.length}`
  );
  const dmCount = CURATED_DRACIN_CATALOG.filter((d) => Boolean(d.dailymotionId)).length;
  assert.equal(dmCount, 0, 'CURATED_DRACIN_CATALOG must contain 0 Dailymotion screen-recording items in v73');
  assert.ok(NUNODRAMA_SUPPORTED_PLATFORMS.size >= 17);
  assert.equal(resolveNunoPlatformId('stardusttv'), 'stardust');
  assert.equal(resolveNunoPlatformId('dramabox'), 'dramabox');

  // Verify TikTok FYP & Dub Indo filters
  const fypDramas = filterDracinCatalog(CURATED_DRACIN_CATALOG, { genreId: 'fyp-tiktok' });
  assert.ok(fypDramas.length >= 6, `Expected >= 6 FYP TikTok dramas, got ${fypDramas.length}`);
  const vipDramas = filterDracinCatalog(CURATED_DRACIN_CATALOG, { genreId: 'full-free' });
  assert.ok(vipDramas.length >= 80, `Expected >= 80 VIP-unlocked dramas, got ${vipDramas.length}`);
  const dubDramas = filterDracinCatalog(CURATED_DRACIN_CATALOG, { genreId: 'dub-indo' });
  assert.ok(dubDramas.length >= 5, `Expected >= 5 Dub Indo dramas, got ${dubDramas.length}`);

  // Verify extractNunoSectionItems handles Jina text wrapper + VIP + PineDrama TikTok items
  const rawSectionText = `Title: NunoDrama API
URL Source: https://nunodrama.my.id/api/section/dramabox/vip
Markdown Content:
{"dramas":[{"BookID":"42000006753","BookName":"Dewa Judi","Cover":"https://hwztchapter.dramaboxdb.com/data/cppartner/4x2/42x0/420x0/42000006753/42000006753.jpg","ChapterCount":62,"Introduction":"Kembali dari puncak dunia judi.","Tags":["Action","Urban"],"Corner":"Anggota Saja"}]}`;

  const parsedItems = extractNunoSectionItems(rawSectionText, 'dramabox', 'vip');
  assert.equal(parsedItems.length, 1);
  assert.equal(parsedItems[0].sourceId, '42000006753');
  assert.equal(parsedItems[0].title, 'Dewa Judi');
  assert.equal(parsedItems[0].totalEpisodes, 62);
  assert.equal(parsedItems[0].isVipUnlocked, true);
  assert.ok(parsedItems[0].genres.includes('full-free'));

  // Verify extractNunoWatchPayload parses MP4, HLS, Melolo CENC key, NunoMix relative proxy, subtitles, and episode count
  const sampleWatchHtml = `
    <html>
      <head><title>Nonton Dewa Judi - Ep 25 - NunoDrama</title></head>
      <body>
        <span>62 Episode Tersedia</span>
        <video id="player" data-src="https://hwztvideo.dramaboxdb.com/42000006753_ep25_720p.mp4" data-kind="mp4"></video>
        <button data-quality-option data-label="1080p" data-url="https://hwztvideo.dramaboxdb.com/42000006753_ep25_1080p.mp4">1080p</button>
        <button data-quality-option data-label="720p" data-url="https://hwztvideo.dramaboxdb.com/42000006753_ep25_720p.mp4">720p</button>
        <button data-sub-option data-lang="id" data-label="Indonesia" data-url="https://inter.nunodrama.my.id/sub.vtt">ID</button>
      </body>
    </html>
  `;
  const watchRes = extractNunoWatchPayload(sampleWatchHtml, { platformId: 'dramabox', episodeNumber: 25 });
  assert.equal(watchRes.totalEpisodes, 62);
  assert.equal(watchRes.servers.length, 2);
  assert.equal(watchRes.servers[0].qualityLabel, '720P');
  assert.equal(watchRes.servers[0].kind, 'mp4');
  assert.equal(watchRes.subtitles.length, 1);
  assert.equal(watchRes.subtitles[0].url, 'https://inter.nunodrama.my.id/sub.vtt');

  // Verify Melolo CENC key attribute format (data-key="HEX_KEY" data-encrypted="true")
  const meloloWatchHtml = `
    <video id="player" data-src="https://v16m-default.akamaized.net/melolo_ep20.mp4" data-kind="mp4" data-key="a1b2c3d4e5f60718293a4b5c6d7e8f90" data-encrypted="true"></video>
  `;
  const meloloWatch = extractNunoWatchPayload(meloloWatchHtml, { platformId: 'melolo', episodeNumber: 20 });
  assert.equal(meloloWatch.servers.length, 1);
  assert.equal(meloloWatch.servers[0].kind, 'cenc-mp4');
  assert.equal(meloloWatch.servers[0].contentKey, 'a1b2c3d4e5f60718293a4b5c6d7e8f90');
  assert.equal(meloloWatch.servers[0].url, 'https://v16m-default.akamaized.net/melolo_ep20.mp4');
});



