import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STUDIO_CATEGORIES,
  STUDIO_FAQ_ITEMS,
  STUDIO_VALUE_PILLARS,
  buildStudioFeatureDirectory,
  buildStudioHeroBanners,
  filterStudioFeatures,
} from './studio-home.js';
import {
  DEFAULT_BANNERS,
  DEFAULT_UTILITY_CONFIG,
  inferBannerUtilityId,
  normalizeUtilityConfig,
} from './store.js';

test('buildStudioHeroBanners produces Flagship slide + all enabled utility mascot slides without Store-only banners', () => {
  const utilities = normalizeUtilityConfig(DEFAULT_UTILITY_CONFIG);
  const slides = buildStudioHeroBanners(DEFAULT_BANNERS, utilities, inferBannerUtilityId, {
    brandName: 'Manifestudio',
  });

  // 1 flagship hero + 15 utility banners = 16 slides
  assert.equal(slides.length, 16);
  assert.equal(slides[0].isFlagship, true);
  assert.equal(slides[0].href, '#fitur');
  assert.equal(slides[0].utilityId, null);
  assert.ok(slides[0].kicker.includes('Manifestudio'));

  // No Store catalog banner should leak into Manifestudio hero
  assert.equal(slides.some((s) => s.id === 'banner-katalog'), false);

  // Every subsequent slide maps directly to an active utilityId
  const utilSlides = slides.slice(1);
  assert.equal(utilSlides.length, 15);
  assert.ok(utilSlides.every((s) => Boolean(s.utilityId)));
  assert.ok(utilSlides.some((s) => s.utilityId === 'dracin'));
  assert.ok(utilSlides.some((s) => s.utilityId === 'manifestai'));

  // Respects disabled utility toggle from Admin
  const withDisabled = normalizeUtilityConfig({
    ...DEFAULT_UTILITY_CONFIG,
    items: DEFAULT_UTILITY_CONFIG.items.map((it) =>
      it.id === 'speedtest' ? { ...it, enabled: false } : it
    ),
  });
  const filteredSlides = buildStudioHeroBanners(DEFAULT_BANNERS, withDisabled, inferBannerUtilityId);
  assert.equal(filteredSlides.length, 15);
  assert.equal(filteredSlides.some((s) => s.utilityId === 'speedtest'), false);
});

test('buildStudioFeatureDirectory & filterStudioFeatures support category tabs and keyword search', () => {
  const utilities = normalizeUtilityConfig(DEFAULT_UTILITY_CONFIG);
  const dir = buildStudioFeatureDirectory(utilities);
  assert.equal(dir.length, 15);
  assert.ok(dir.every((f) => f.id && f.label && f.summary && f.icon && f.category));

  // Category filter
  const aiDocs = filterStudioFeatures(dir, { category: 'ai-docs' });
  assert.deepEqual(
    aiDocs.map((f) => f.id).sort(),
    ['manifestai', 'novel', 'plagiarism']
  );

  const mediaFiles = filterStudioFeatures(dir, { category: 'media-files' });
  assert.deepEqual(
    mediaFiles.map((f) => f.id).sort(),
    ['compressor', 'converter', 'downloader']
  );

  // Keyword search
  const dramaHits = filterStudioFeatures(dir, { query: 'subtitle' });
  assert.equal(dramaHits.length, 1);
  assert.equal(dramaHits[0].id, 'dracin');

  const pdfHits = filterStudioFeatures(dir, { query: 'pdf' });
  assert.ok(pdfHits.some((f) => f.id === 'plagiarism'));
  assert.ok(pdfHits.some((f) => f.id === 'converter'));

  // Combined category + search
  const emptyHits = filterStudioFeatures(dir, { category: 'entertainment', query: 'kemenag' });
  assert.equal(emptyHits.length, 0);

  // Editorial content sanity checks
  assert.equal(STUDIO_CATEGORIES.length, 5);
  assert.equal(STUDIO_VALUE_PILLARS.length, 4);
  assert.ok(STUDIO_FAQ_ITEMS.length >= 4);
});
