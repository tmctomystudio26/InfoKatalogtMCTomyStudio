import test from 'node:test';
import assert from 'node:assert/strict';

import {
  computeStaggerDelay,
  resolveMotionProfile,
  shouldSplitHeadingElement,
  splitHeadlineIntoWords,
} from './motion-helpers.js';

test('splitHeadlineIntoWords tokenizes Indonesian headings cleanly with spacing preserved', () => {
  const tokens = splitHeadlineIntoWords('  Dirancang Ringan, Cepat & Menjaga Privasi  ');
  assert.deepEqual(
    tokens.filter((t) => t.type === 'word').map((t) => t.value),
    ['Dirancang', 'Ringan,', 'Cepat', '&', 'Menjaga', 'Privasi']
  );
  assert.equal(tokens.filter((t) => t.type === 'space').length, 5);
  assert.equal(tokens.map((t) => t.value).join(''), 'Dirancang Ringan, Cepat & Menjaga Privasi');
});

test('splitHeadlineIntoWords handles empty, whitespace-only, and single-word inputs', () => {
  assert.deepEqual(splitHeadlineIntoWords(''), []);
  assert.deepEqual(splitHeadlineIntoWords('   \n\t  '), []);
  assert.deepEqual(splitHeadlineIntoWords('Manifestudio'), [{ type: 'word', value: 'Manifestudio' }]);
});

test('resolveMotionProfile disables animations & Lenis when prefersReducedMotion is true', () => {
  const profile = resolveMotionProfile({
    prefersReducedMotion: true,
    isTouch: false,
    isLowEnd: false,
    viewportWidth: 1440,
  });
  assert.equal(profile.reduced, true);
  assert.equal(profile.lenis.enabled, false);
  assert.equal(profile.gsap.enabled, false);
  assert.equal(profile.motion.enabled, false);
  assert.equal(profile.motion.enableHoverSpring, false);
});

test('resolveMotionProfile enables full Lenis + GSAP + Motion spring physics on desktop', () => {
  const profile = resolveMotionProfile({
    prefersReducedMotion: false,
    isTouch: false,
    isLowEnd: false,
    viewportWidth: 1440,
  });
  assert.equal(profile.reduced, false);
  assert.equal(profile.lenis.enabled, true);
  assert.equal(profile.lenis.smoothWheel, true);
  assert.equal(profile.lenis.syncTouch, false);
  assert.equal(profile.gsap.enabled, true);
  assert.equal(profile.motion.enabled, true);
  assert.equal(profile.motion.enableHoverSpring, true);
  assert.ok(profile.motion.hoverLiftY < 0);
});

test('resolveMotionProfile keeps touch scrolling native while preserving GSAP & Motion reveals on mobile', () => {
  const profile = resolveMotionProfile({
    prefersReducedMotion: false,
    isTouch: true,
    isLowEnd: false,
    viewportWidth: 390,
  });
  assert.equal(profile.lenis.enabled, false);
  assert.equal(profile.gsap.enabled, true);
  assert.equal(profile.motion.enabled, true);
  assert.equal(profile.motion.enableHoverSpring, false);
  assert.ok(profile.gsap.wordDuration < 0.65);
});

test('resolveMotionProfile shortens durations and caps stagger on low-end devices', () => {
  const lowEnd = resolveMotionProfile({
    prefersReducedMotion: false,
    isTouch: false,
    isLowEnd: true,
    viewportWidth: 1280,
  });
  const desktop = resolveMotionProfile({
    prefersReducedMotion: false,
    isTouch: false,
    isLowEnd: false,
    viewportWidth: 1280,
  });
  assert.equal(lowEnd.lenis.enabled, false);
  assert.ok(lowEnd.gsap.wordDuration < desktop.gsap.wordDuration);
  assert.ok(lowEnd.motion.maxStaggerDelay < desktop.motion.maxStaggerDelay);
});

test('computeStaggerDelay clamps trailing card delays cleanly', () => {
  assert.equal(computeStaggerDelay(0, { step: 0.04, maxDelay: 0.4 }), 0);
  assert.equal(computeStaggerDelay(3, { step: 0.04, maxDelay: 0.4 }), 0.12);
  assert.equal(computeStaggerDelay(18, { step: 0.04, maxDelay: 0.4 }), 0.4);
  assert.equal(computeStaggerDelay(-2, { step: 0.04, maxDelay: 0.4 }), 0);
});

test('shouldSplitHeadingElement avoids redundant re-splits and skips hidden/complex nodes', () => {
  assert.equal(
    shouldSplitHeadingElement({
      text: 'Pilih Fitur Manifestudio',
      previousSource: '',
      hasComplexChildren: false,
      isHidden: false,
    }),
    true
  );
  assert.equal(
    shouldSplitHeadingElement({
      text: 'Pilih Fitur Manifestudio',
      previousSource: 'Pilih Fitur Manifestudio',
      hasComplexChildren: false,
      isHidden: false,
    }),
    false
  );
  assert.equal(
    shouldSplitHeadingElement({
      text: 'Please Donate — Leaderboard',
      previousSource: 'Manifest AI',
      hasComplexChildren: false,
      isHidden: false,
    }),
    true
  );
  assert.equal(
    shouldSplitHeadingElement({
      text: 'Judul Tersembunyi',
      previousSource: '',
      hasComplexChildren: false,
      isHidden: true,
    }),
    false
  );
  assert.equal(
    shouldSplitHeadingElement({
      text: 'Judul dengan input',
      previousSource: '',
      hasComplexChildren: true,
      isHidden: false,
    }),
    false
  );
});
