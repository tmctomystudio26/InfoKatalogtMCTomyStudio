/**
 * Manifestudio Novel Hub — 120+ Reader Themes Catalog, Illustrated SVG Art,
 * Live Canvas Particle Animations, External Palette API, Custom Upload & AI Theme Studio (v70).
 * Pure ES module (works in both Browser and Node unit tests).
 */

export const THEME_CATEGORIES = [
  { id: 'all', label: 'Semua Tema' },
  { id: 'classic', label: 'Nyaman Mata' },
  { id: 'modern', label: 'Visual Modern' },
  { id: 'illustrated', label: 'Bergambar & Tekstur' },
  { id: 'animated', label: 'Animasi Bergerak' },
  { id: 'genre', label: 'Genre Populer' },
  { id: 'custom', label: 'AI & Kustom' },
];

export const READER_FONTS = [
  { id: 'lora', label: 'Lora (Editorial Serif)', stack: 'Georgia, "Palatino Linotype", "Book Antiqua", serif' },
  { id: 'jakarta', label: 'Plus Jakarta Sans', stack: '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, sans-serif' },
  { id: 'merriweather', label: 'Book Serif Klasik', stack: '"Times New Roman", "Liberation Serif", Georgia, serif' },
  { id: 'clean-sans', label: 'Modern Clean Sans', stack: '"Segoe UI", system-ui, -apple-system, sans-serif' },
  { id: 'mono-story', label: 'Typewriter Novel', stack: '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace' },
];

function svgDataUri(svgMarkup) {
  return `url("data:image/svg+xml,${encodeURIComponent(svgMarkup.replace(/\s+/g, ' ').trim())}")`;
}

/**
 * Generates crisp, lightweight, offline-safe vector artwork / textures for Illustrated & Genre themes.
 */
export function buildIllustrationSvgUri(motif = 'paper', c1 = '#cbd5e1', c2 = '#94a3b8') {
  const safe1 = String(c1 || '#cbd5e1');
  const safe2 = String(c2 || '#94a3b8');
  switch (motif) {
    case 'mountains':
      return svgDataUri(
        `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 500' preserveAspectRatio='none'>
          <path d='M0 360 L150 220 L290 310 L460 170 L640 290 L800 200 L800 500 L0 500 Z' fill='${safe1}' fill-opacity='0.22'/>
          <path d='M0 420 L190 290 L380 390 L570 250 L800 370 L800 500 L0 500 Z' fill='${safe2}' fill-opacity='0.28'/>
          <circle cx='660' cy='110' r='44' fill='${safe1}' fill-opacity='0.18'/>
        </svg>`
      );
    case 'waves':
      return svgDataUri(
        `<svg xmlns='http://www.w3.org/2000/svg' width='220' height='110' viewBox='0 0 220 110'>
          <path d='M0 55 Q55 15 110 55 T220 55' fill='none' stroke='${safe1}' stroke-opacity='0.22' stroke-width='2'/>
          <path d='M0 80 Q55 40 110 80 T220 80' fill='none' stroke='${safe2}' stroke-opacity='0.18' stroke-width='1.5'/>
          <path d='M0 30 Q55 -10 110 30 T220 30' fill='none' stroke='${safe1}' stroke-opacity='0.14' stroke-width='1.2'/>
        </svg>`
      );
    case 'constellation':
      return svgDataUri(
        `<svg xmlns='http://www.w3.org/2000/svg' width='360' height='360' viewBox='0 0 360 360'>
          <g stroke='${safe1}' stroke-opacity='0.18' stroke-width='1'>
            <line x1='40' y1='60' x2='130' y2='110'/><line x1='130' y1='110' x2='240' y2='75'/>
            <line x1='240' y1='75' x2='310' y2='170'/><line x1='130' y1='110' x2='170' y2='250'/>
            <line x1='170' y1='250' x2='290' y2='290'/><line x1='55' y1='260' x2='170' y2='250'/>
          </g>
          <g fill='${safe2}' fill-opacity='0.45'>
            <circle cx='40' cy='60' r='2.5'/><circle cx='130' cy='110' r='3'/><circle cx='240' cy='75' r='2'/>
            <circle cx='310' cy='170' r='2.5'/><circle cx='170' cy='250' r='3'/><circle cx='290' cy='290' r='2'/>
            <circle cx='55' cy='260' r='2'/><circle cx='200' cy='175' r='1.5'/><circle cx='90' cy='190' r='1.5'/>
          </g>
        </svg>`
      );
    case 'botanical':
      return svgDataUri(
        `<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240' viewBox='0 0 240 240'>
          <path d='M30 210 Q80 140 120 40' fill='none' stroke='${safe1}' stroke-opacity='0.22' stroke-width='2'/>
          <ellipse cx='96' cy='105' rx='26' ry='10' transform='rotate(-32 96 105)' fill='${safe2}' fill-opacity='0.16'/>
          <ellipse cx='126' cy='130' rx='24' ry='9' transform='rotate(24 126 130)' fill='${safe1}' fill-opacity='0.16'/>
          <ellipse cx='76' cy='155' rx='22' ry='9' transform='rotate(-25 76 155)' fill='${safe2}' fill-opacity='0.14'/>
          <circle cx='190' cy='65' r='18' fill='none' stroke='${safe1}' stroke-opacity='0.16' stroke-width='1.5'/>
        </svg>`
      );
    case 'sakura':
      return svgDataUri(
        `<svg xmlns='http://www.w3.org/2000/svg' width='260' height='260' viewBox='0 0 260 260'>
          <path d='M0 70 Q95 55 190 105' fill='none' stroke='${safe2}' stroke-opacity='0.2' stroke-width='3'/>
          <g fill='${safe1}' fill-opacity='0.22'>
            <ellipse cx='72' cy='58' rx='10' ry='6' transform='rotate(-20 72 58)'/>
            <ellipse cx='128' cy='76' rx='12' ry='6.5' transform='rotate(28 128 76)'/>
            <ellipse cx='182' cy='102' rx='9' ry='5.5' transform='rotate(-15 182 102)'/>
            <ellipse cx='65' cy='190' rx='8' ry='4.5' transform='rotate(40 65 190)'/>
            <ellipse cx='215' cy='185' rx='10' ry='5' transform='rotate(-35 215 185)'/>
          </g>
        </svg>`
      );
    case 'batik':
      return svgDataUri(
        `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'>
          <path d='M0 60 L60 0 L120 60 L60 120 Z' fill='none' stroke='${safe1}' stroke-opacity='0.16' stroke-width='1.2'/>
          <circle cx='60' cy='60' r='18' fill='none' stroke='${safe2}' stroke-opacity='0.16' stroke-width='1.2'/>
          <circle cx='60' cy='60' r='4' fill='${safe1}' fill-opacity='0.2'/>
        </svg>`
      );
    case 'library':
      return svgDataUri(
        `<svg xmlns='http://www.w3.org/2000/svg' width='240' height='160' viewBox='0 0 240 160'>
          <line x1='0' y1='150' x2='240' y2='150' stroke='${safe1}' stroke-opacity='0.22' stroke-width='3'/>
          <rect x='18' y='74' width='18' height='74' rx='2' fill='${safe1}' fill-opacity='0.14'/>
          <rect x='40' y='88' width='14' height='60' rx='2' fill='${safe2}' fill-opacity='0.14'/>
          <rect x='58' y='66' width='22' height='82' rx='2' fill='${safe1}' fill-opacity='0.12'/>
          <rect x='164' y='78' width='16' height='70' rx='2' fill='${safe2}' fill-opacity='0.14'/>
          <rect x='186' y='62' width='20' height='86' rx='2' fill='${safe1}' fill-opacity='0.12'/>
        </svg>`
      );
    case 'castle':
      return svgDataUri(
        `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 500' preserveAspectRatio='none'>
          <circle cx='640' cy='115' r='55' fill='${safe1}' fill-opacity='0.16'/>
          <path d='M0 430 L120 350 L210 380 L240 270 L265 215 L290 270 L325 270 L345 190 L365 270 L410 340 L540 310 L690 385 L800 340 L800 500 L0 500 Z' fill='${safe2}' fill-opacity='0.22'/>
        </svg>`
      );
    case 'grid':
      return svgDataUri(
        `<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48'>
          <path d='M48 0H0V48' fill='none' stroke='${safe1}' stroke-opacity='0.15' stroke-width='1'/>
        </svg>`
      );
    case 'linen':
    default:
      return svgDataUri(
        `<svg xmlns='http://www.w3.org/2000/svg' width='36' height='36' viewBox='0 0 36 36'>
          <path d='M0 18H36M18 0V36' stroke='${safe1}' stroke-opacity='0.09' stroke-width='0.8'/>
          <circle cx='9' cy='9' r='0.9' fill='${safe2}' fill-opacity='0.12'/>
          <circle cx='27' cy='27' r='0.9' fill='${safe2}' fill-opacity='0.12'/>
        </svg>`
      );
  }
}

function t(id, name, category, bg, surface, text, muted, accent, extra = {}) {
  const isDark = extra.isDark ?? isHexDark(bg);
  return {
    id,
    name,
    category,
    bg,
    surface,
    text,
    muted,
    accent,
    isDark,
    bgCss: extra.bgCss || bg,
    patternSvg: extra.motif ? buildIllustrationSvgUri(extra.motif, extra.motifC1 || accent, extra.motifC2 || muted) : extra.patternSvg || '',
    patternSize: extra.patternSize || (extra.motif === 'mountains' || extra.motif === 'castle' ? 'cover' : '220px'),
    animation: extra.animation || 'none',
    animColor: extra.animColor || accent,
    animColor2: extra.animColor2 || muted,
    fontId: extra.fontId || '',
    customImage: extra.customImage || '',
    source: extra.source || 'builtin',
  };
}

export function hexToRgb(hex = '#ffffff') {
  const raw = String(hex || '').trim();
  const rgbaMatch = raw.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i);
  if (rgbaMatch) {
    return [
      Math.min(255, Number(rgbaMatch[1]) || 0),
      Math.min(255, Number(rgbaMatch[2]) || 0),
      Math.min(255, Number(rgbaMatch[3]) || 0),
    ];
  }
  const clean = raw.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return [255, 255, 255];
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
}

export function relativeLuminance(hex = '#ffffff') {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function isHexDark(hex = '#ffffff') {
  return relativeLuminance(hex) < 0.34;
}

export function contrastRatio(hexA, hexB) {
  const l1 = relativeLuminance(hexA);
  const l2 = relativeLuminance(hexB);
  const bright = Math.max(l1, l2);
  const dark = Math.min(l1, l2);
  return (bright + 0.05) / (dark + 0.05);
}

/**
 * Guarantees readable >= 4.5:1 text color on any surface hex (critical for AI & external API themes).
 */
export function ensureReadableText(surfaceHex, preferredText = '') {
  if (preferredText && /^#[0-9a-fA-F]{3,6}$/.test(preferredText) && contrastRatio(surfaceHex, preferredText) >= 4.5) {
    return preferredText;
  }
  return isHexDark(surfaceHex) ? '#f1f5f9' : '#18181b';
}

// ==================== 122 CURATED BUILT-IN NOVEL READER THEMES ====================
export const BUILTIN_NOVEL_THEMES = [
  // ---------- 1. KLASIK & NYAMAN MATA (22 TEMA) ----------
  t('classic-ivory', 'Kertas Gading', 'classic', '#faf8f3', '#ffffff', '#1e293b', '#64748b', '#c2410c'),
  t('classic-sepia', 'Sepia Hangat', 'classic', '#f4ecd8', '#fbf6e9', '#3b2f20', '#7c674c', '#b45309'),
  t('classic-eink', 'E-Ink Kindle', 'classic', '#ecece7', '#f5f5f0', '#1a1a1a', '#575752', '#334155'),
  t('classic-amoled', 'AMOLED Malam Pekat', 'classic', '#000000', '#0b0c10', '#e5e7eb', '#9ca3af', '#38bdf8'),
  t('classic-slate', 'Midnight Slate', 'classic', '#0f172a', '#162033', '#e2e8f0', '#94a3b8', '#60a5fa'),
  t('classic-charcoal', 'Arang Lembut', 'classic', '#18181b', '#222227', '#f4f4f5', '#a1a1aa', '#f59e0b'),
  t('classic-matcha', 'Matcha Teduh', 'classic', '#e9f2e6', '#f4f9f2', '#1d3124', '#4f6d59', '#15803d'),
  t('classic-sage', 'Daun Sage', 'classic', '#e4ece8', '#f1f6f3', '#1f2e28', '#526860', '#0f766e'),
  t('classic-cream', 'Krem Buku Saku', 'classic', '#fdf6e3', '#fffbeb', '#382c1e', '#786652', '#d97706'),
  t('classic-parchment', 'Perkamen Kuno', 'classic', '#ede0c8', '#f7efe0', '#332515', '#70583c', '#9a3412'),
  t('classic-oat', 'Oatmilk Lembut', 'classic', '#f3eee8', '#faf7f3', '#27231f', '#6e655c', '#92400e'),
  t('classic-sky', 'Langit Pagi', 'classic', '#eef6fb', '#f8fcff', '#172a3a', '#526b80', '#0284c7'),
  t('classic-lavender', 'Lavender Kalem', 'classic', '#f3effa', '#faf8ff', '#271e3b', '#665b80', '#7c3aed'),
  t('classic-blush', 'Mawar Lembut', 'classic', '#fbf0f3', '#fff8fa', '#381e28', '#7d5665', '#be123c'),
  t('classic-espresso', 'Kopi Espresso', 'classic', '#1c1512', '#261d18', '#f0e6dd', '#b5a191', '#d97706'),
  t('classic-forest-night', 'Hutan Malam', 'classic', '#0d1a14', '#13241c', '#e2efe7', '#8fb09d', '#34d399'),
  t('classic-navy-ink', 'Tinta Laut Dalam', 'classic', '#0b1526', '#112038', '#e3ebf7', '#90a4c2', '#38bdf8'),
  t('classic-plum-dark', 'Plum Senja', 'classic', '#1b1224', '#261933', '#efe7f8', '#b19dc7', '#c084fc'),
  t('classic-stone', 'Batu Kertas', 'classic', '#e7e5e4', '#f5f5f4', '#1c1917', '#57534e', '#44403c'),
  t('classic-newsprint', 'Koran Editorial', 'classic', '#f2f1ec', '#faf9f5', '#171717', '#525252', '#b91c1c'),
  t('classic-warm-gray', 'Abu Hangat', 'classic', '#272624', '#312f2c', '#f0ede9', '#aba59c', '#eab308'),
  t('classic-pure-white', 'Putih Kristal', 'classic', '#ffffff', '#ffffff', '#0f172a', '#64748b', '#2563eb'),

  // ---------- 2. VISUAL MODERN & EDITORIAL (22 TEMA) ----------
  t('modern-nordic', 'Nordic Frost', 'modern', '#eaf1f8', '#ffffff', '#102033', '#52667a', '#0284c7', { bgCss: 'linear-gradient(155deg,#e2eef8 0%,#f7fbff 100%)' }),
  t('modern-peach', 'Pastel Peach', 'modern', '#fff1e6', '#fffaf5', '#362015', '#7c5a48', '#ea580c', { bgCss: 'linear-gradient(150deg,#ffe4d0 0%,#fff6ee 100%)' }),
  t('modern-mint', 'Mint Studio', 'modern', '#e6fbf4', '#f6fffc', '#103028', '#467367', '#059669', { bgCss: 'linear-gradient(155deg,#d3f8eb 0%,#f4fffb 100%)' }),
  t('modern-sunrise', 'Mentari Pagi', 'modern', '#fef3c7', '#fffdf5', '#3b240b', '#7a5930', '#d97706', { bgCss: 'linear-gradient(155deg,#fde68a 0%,#fffbeb 65%,#ffedd5 100%)' }),
  t('modern-sakura-glass', 'Sakura Glass', 'modern', '#fce7f3', '#fff7fb', '#3d142b', '#824b69', '#db2777', { bgCss: 'linear-gradient(145deg,#fbcfe8 0%,#fdf2f8 65%,#eef2ff 100%)' }),
  t('modern-obsidian', 'Obsidian Gold', 'modern', '#0c0d10', '#14161c', '#f3f4f6', '#9ca3af', '#eab308', { bgCss: 'linear-gradient(160deg,#090a0d 0%,#161822 100%)' }),
  t('modern-cobalt', 'Cobalt Velvet', 'modern', '#0c1a3a', '#132652', '#eef4ff', '#9db5e0', '#38bdf8', { bgCss: 'linear-gradient(155deg,#08122b 0%,#162d63 100%)' }),
  t('modern-emerald', 'Emerald Luxe', 'modern', '#07221b', '#0d3127', '#e8fbf4', '#8cc7b5', '#10b981', { bgCss: 'linear-gradient(155deg,#051a14 0%,#0f3a2e 100%)' }),
  t('modern-burgundy', 'Burgundy Wine', 'modern', '#260b14', '#36111d', '#fcebf0', '#d49aab', '#fb7185', { bgCss: 'linear-gradient(155deg,#1d070e 0%,#3a1220 100%)' }),
  t('modern-indigo-dusk', 'Indigo Senja', 'modern', '#17153b', '#221f52', '#eef0ff', '#a8ace0', '#818cf8', { bgCss: 'linear-gradient(155deg,#121030 0%,#26225e 100%)' }),
  t('modern-terracotta', 'Terracotta Warm', 'modern', '#f7ebe4', '#fff9f5', '#3b1f16', '#7a5347', '#c2410c', { bgCss: 'linear-gradient(155deg,#f3dfd3 0%,#fdf6f0 100%)' }),
  t('modern-sand-dune', 'Gurun Pasir', 'modern', '#efe7d6', '#faf6ec', '#2f2718', '#6f6249', '#b45309', { bgCss: 'linear-gradient(155deg,#e6d9be 0%,#faf5e8 100%)' }),
  t('modern-glacier', 'Gletser Biru', 'modern', '#e0f2fe', '#f5fbff', '#0c2740', '#486c8c', '#0284c7', { bgCss: 'linear-gradient(150deg,#bae6fd 0%,#f0f9ff 100%)' }),
  t('modern-lilac-mist', 'Kabut Lilac', 'modern', '#f3e8ff', '#fcf9ff', '#2c1347', '#6c4d8c', '#9333ea', { bgCss: 'linear-gradient(150deg,#e9d5ff 0%,#faf5ff 100%)' }),
  t('modern-carbon', 'Carbon Studio', 'modern', '#121316', '#1b1d22', '#eceef2', '#959ba8', '#22d3ee', { bgCss: 'linear-gradient(160deg,#0f1013 0%,#1f2229 100%)' }),
  t('modern-tokyo', 'Tokyo Minimal', 'modern', '#f4f4f5', '#ffffff', '#18181b', '#71717a', '#e11d48', { bgCss: 'linear-gradient(180deg,#f4f4f5 0%,#fafafa 100%)' }),
  t('modern-matcha-dark', 'Matcha Espresso', 'modern', '#141e18', '#1d2b22', '#e8f3eb', '#95b09f', '#4ade80', { bgCss: 'linear-gradient(155deg,#0f1813 0%,#1f3025 100%)' }),
  t('modern-twilight', 'Twilight Horizon', 'modern', '#1a1b2e', '#242640', '#eef1ff', '#9fa6cf', '#f472b6', { bgCss: 'linear-gradient(150deg,#151629 0%,#2d244a 100%)' }),
  t('modern-apricot', 'Aprikot Manis', 'modern', '#ffedd5', '#fffaf2', '#3d220d', '#825a3a', '#ea580c', { bgCss: 'linear-gradient(145deg,#fed7aa 0%,#fff7ed 100%)' }),
  t('modern-seafoam', 'Buih Samudra', 'modern', '#ccfbf1', '#f2fffd', '#113330', '#457570', '#0d9488', { bgCss: 'linear-gradient(155deg,#99f6e4 0%,#f0fdfa 100%)' }),
  t('modern-bronze', 'Perunggu Klasik', 'modern', '#211913', '#2e231b', '#f5eadf', '#ba9f86', '#f59e0b', { bgCss: 'linear-gradient(160deg,#1a130e 0%,#33261c 100%)' }),
  t('modern-swiss', 'Swiss Editorial', 'modern', '#f8fafc', '#ffffff', '#0f172a', '#475569', '#dc2626', { bgCss: 'linear-gradient(180deg,#f1f5f9 0%,#ffffff 100%)' }),

  // ---------- 3. BERGAMBAR & TEKSTUR ARTISTIK SVG (26 TEMA) ----------
  t('ill-linen-cream', 'Kanvas Linen Krem', 'illustrated', '#f6f1e6', 'rgba(255,253,248,0.92)', '#2b2217', '#6d5d48', '#b45309', { motif: 'linen', motifC1: '#92400e', motifC2: '#b45309', patternSize: '42px' }),
  t('ill-washi-sakura', 'Kertas Washi Sakura', 'illustrated', '#fdf2f6', 'rgba(255,250,252,0.90)', '#381827', '#7a4d63', '#db2777', { motif: 'sakura', motifC1: '#f472b6', motifC2: '#9d174d', patternSize: '260px' }),
  t('ill-mist-mountain', 'Gunung Kabut Pagi', 'illustrated', '#eaf2f7', 'rgba(255,255,255,0.88)', '#142636', '#4c657a', '#0369a1', { motif: 'mountains', motifC1: '#0284c7', motifC2: '#334155', bgCss: 'linear-gradient(180deg,#dbeafe 0%,#f8fafc 100%)' }),
  t('ill-night-peaks', 'Puncak Gunung Malam', 'illustrated', '#0d1626', 'rgba(17,27,46,0.88)', '#e5eefc', '#93a8c7', '#38bdf8', { motif: 'mountains', motifC1: '#38bdf8', motifC2: '#1e3a8a', bgCss: 'linear-gradient(180deg,#09101d 0%,#172540 100%)' }),
  t('ill-ukiyoe-wave', 'Gelombang Ukiyo-e', 'illustrated', '#edf5fa', 'rgba(252,254,255,0.90)', '#10253b', '#4d6a85', '#1d4ed8', { motif: 'waves', motifC1: '#1d4ed8', motifC2: '#0284c7', patternSize: '220px' }),
  t('ill-deep-wave', 'Ombak Laut Malam', 'illustrated', '#091826', 'rgba(12,28,44,0.88)', '#e2f1fc', '#87acc7', '#22d3ee', { motif: 'waves', motifC1: '#22d3ee', motifC2: '#0284c7', patternSize: '220px' }),
  t('ill-star-atlas', 'Peta Konstelasi Bintang', 'illustrated', '#0b1024', 'rgba(16,22,48,0.88)', '#eaefff', '#99a5d4', '#818cf8', { motif: 'constellation', motifC1: '#818cf8', motifC2: '#fde047', patternSize: '340px' }),
  t('ill-celestial-ivory', 'Astronomi Gading', 'illustrated', '#f8f5ec', 'rgba(255,253,247,0.90)', '#231f16', '#695f4a', '#b45309', { motif: 'constellation', motifC1: '#b45309', motifC2: '#d97706', patternSize: '340px' }),
  t('ill-botanical-sage', 'Herbarium Daun Sage', 'illustrated', '#eaf3ec', 'rgba(250,255,251,0.90)', '#183022', '#4c6e59', '#15803d', { motif: 'botanical', motifC1: '#15803d', motifC2: '#10b981', patternSize: '240px' }),
  t('ill-botanical-dark', 'Taman Malam Zamrud', 'illustrated', '#0c1c16', 'rgba(15,34,27,0.88)', '#e5f5ec', '#8eb8a0', '#34d399', { motif: 'botanical', motifC1: '#34d399', motifC2: '#059669', patternSize: '240px' }),
  t('ill-batik-sogan', 'Batik Parang Sogan', 'illustrated', '#f3eadc', 'rgba(252,247,238,0.91)', '#332212', '#705538', '#9a3412', { motif: 'batik', motifC1: '#9a3412', motifC2: '#b45309', patternSize: '120px' }),
  t('ill-batik-keraton', 'Batik Malam Keraton', 'illustrated', '#1a130e', 'rgba(31,23,17,0.89)', '#f6ecdf', '#bda58c', '#f59e0b', { motif: 'batik', motifC1: '#f59e0b', motifC2: '#d97706', patternSize: '120px' }),
  t('ill-old-library', 'Perpustakaan Klasik', 'illustrated', '#f2e8d5', 'rgba(252,247,236,0.91)', '#2e2114', '#6d573e', '#92400e', { motif: 'library', motifC1: '#92400e', motifC2: '#78350f', patternSize: '240px' }),
  t('ill-midnight-lib', 'Perpustakaan Tengah Malam', 'illustrated', '#161210', 'rgba(27,22,19,0.89)', '#f2e9e1', '#b09d8d', '#f59e0b', { motif: 'library', motifC1: '#f59e0b', motifC2: '#b45309', patternSize: '240px' }),
  t('ill-fantasy-castle', 'Kastil Fantasi Senja', 'illustrated', '#1b1429', 'rgba(30,22,46,0.88)', '#f2ebff', '#b2a1d1', '#c084fc', { motif: 'castle', motifC1: '#fde047', motifC2: '#7c3aed', bgCss: 'linear-gradient(180deg,#140e24 0%,#2b1d45 100%)' }),
  t('ill-dawn-citadel', 'Benteng Fajar', 'illustrated', '#f7efe8', 'rgba(255,252,248,0.89)', '#2d1c16', '#6e5248', '#c2410c', { motif: 'castle', motifC1: '#f97316', motifC2: '#9a3412', bgCss: 'linear-gradient(180deg,#ffedd5 0%,#fffaf5 100%)' }),
  t('ill-sakura-night', 'Sakura Bulan Purnama', 'illustrated', '#191121', 'rgba(30,20,40,0.88)', '#faeef7', '#c7a1bc', '#f472b6', { motif: 'sakura', motifC1: '#f472b6', motifC2: '#db2777', patternSize: '260px' }),
  t('ill-journal-grid', 'Buku Catatan Grid', 'illustrated', '#f8fafc', 'rgba(255,255,255,0.92)', '#1e293b', '#64748b', '#2563eb', { motif: 'grid', motifC1: '#64748b', motifC2: '#94a3b8', patternSize: '42px' }),
  t('ill-blueprint', 'Blueprint Arsitek', 'illustrated', '#0a1f3d', 'rgba(13,35,68,0.90)', '#eaf4ff', '#8fb4e0', '#38bdf8', { motif: 'grid', motifC1: '#38bdf8', motifC2: '#60a5fa', patternSize: '42px' }),
  t('ill-sunset-peaks', 'Pegunungan Senja', 'illustrated', '#261522', 'rgba(42,23,37,0.88)', '#fdeef5', '#cca1b6', '#fb7185', { motif: 'mountains', motifC1: '#fb7185', motifC2: '#9f1239', bgCss: 'linear-gradient(180deg,#2d142c 0%,#511845 100%)' }),
  t('ill-jade-waves', 'Gelombang Giok', 'illustrated', '#0b2220', 'rgba(14,40,38,0.88)', '#e6fbf8', '#8cc2bc', '#2dd4bf', { motif: 'waves', motifC1: '#2dd4bf', motifC2: '#0f766e', patternSize: '220px' }),
  t('ill-royal-batik', 'Batik Biru Pesisir', 'illustrated', '#edf3fa', 'rgba(252,254,255,0.91)', '#132540', '#506887', '#1d4ed8', { motif: 'batik', motifC1: '#1d4ed8', motifC2: '#0369a1', patternSize: '120px' }),
  t('ill-dark-linen', 'Linen Hitam Elegan', 'illustrated', '#141519', 'rgba(24,26,31,0.91)', '#eef0f4', '#9aa1b0', '#a78bfa', { motif: 'linen', motifC1: '#94a3b8', motifC2: '#64748b', patternSize: '38px' }),
  t('ill-autumn-leaf', 'Daun Musim Gugur', 'illustrated', '#f8efe6', 'rgba(255,252,248,0.90)', '#331d10', '#785640', '#d97706', { motif: 'botanical', motifC1: '#d97706', motifC2: '#b45309', patternSize: '240px' }),
  t('ill-rose-grid', 'Diari Mawar', 'illustrated', '#fff3f6', 'rgba(255,250,252,0.92)', '#381724', '#7d4d60', '#e11d48', { motif: 'grid', motifC1: '#f43f5e', motifC2: '#fb7185', patternSize: '42px' }),
  t('ill-gold-constellation', 'Bintang Emas Kerajaan', 'illustrated', '#14110b', 'rgba(28,24,15,0.89)', '#faf2e1', '#bfa97e', '#fbbf24', { motif: 'constellation', motifC1: '#fbbf24', motifC2: '#f59e0b', patternSize: '340px' }),

  // ---------- 4. ANIMASI BERGERAK HALUS (26 TEMA LIVE CANVAS PARTICLES) ----------
  t('anim-sakura-day', 'Sakura Gugur (Animasi)', 'animated', '#fdf2f8', 'rgba(255,252,254,0.88)', '#381529', '#7d4b67', '#db2777', { animation: 'sakura', animColor: '#f472b6', animColor2: '#fbcfe8', bgCss: 'linear-gradient(160deg,#fce7f3 0%,#fff5f9 100%)' }),
  t('anim-sakura-night', 'Sakura Malam (Animasi)', 'animated', '#181024', 'rgba(28,19,43,0.86)', '#faeef7', '#c4a3bd', '#f472b6', { animation: 'sakura', animColor: '#f472b6', animColor2: '#f9a8d4', bgCss: 'linear-gradient(160deg,#120c1d 0%,#261838 100%)' }),
  t('anim-snow-night', 'Salju Musim Dingin (Animasi)', 'animated', '#0c1829', 'rgba(15,28,48,0.86)', '#eef5ff', '#9ab4d6', '#38bdf8', { animation: 'snow', animColor: '#ffffff', animColor2: '#bae6fd', bgCss: 'linear-gradient(180deg,#081220 0%,#162c4d 100%)' }),
  t('anim-snow-frost', 'Salju Pagi Cerah (Animasi)', 'animated', '#e6f1fa', 'rgba(255,255,255,0.88)', '#13263a', '#526d87', '#0284c7', { animation: 'snow', animColor: '#60a5fa', animColor2: '#93c5fd', bgCss: 'linear-gradient(180deg,#dbeafe 0%,#f8fbff 100%)' }),
  t('anim-rain-cafe', 'Hujan Malam Kafe (Animasi)', 'animated', '#12161f', 'rgba(22,27,38,0.87)', '#edf2fa', '#99a7bd', '#f59e0b', { animation: 'rain', animColor: '#93c5fd', animColor2: '#60a5fa', bgCss: 'linear-gradient(180deg,#0e121a 0%,#1e2636 100%)' }),
  t('anim-rain-window', 'Hujan Gerimis Kaca (Animasi)', 'animated', '#e7eef4', 'rgba(252,254,255,0.89)', '#1b2836', '#566b80', '#0369a1', { animation: 'rain', animColor: '#38bdf8', animColor2: '#0284c7', bgCss: 'linear-gradient(180deg,#d8e6f2 0%,#f4f8fb 100%)' }),
  t('anim-fireflies-forest', 'Kunang-Kunang Hutan (Animasi)', 'animated', '#091712', 'rgba(14,31,24,0.86)', '#e8f7ee', '#91b8a1', '#facc15', { animation: 'fireflies', animColor: '#fde047', animColor2: '#4ade80', bgCss: 'linear-gradient(160deg,#06110d 0%,#112b21 100%)' }),
  t('anim-fireflies-fairy', 'Hutan Peri Ungu (Animasi)', 'animated', '#140f26', 'rgba(24,18,46,0.86)', '#f3eeff', '#b2a1db', '#c084fc', { animation: 'fireflies', animColor: '#e879f9', animColor2: '#fde047', bgCss: 'linear-gradient(160deg,#0f0a1f 0%,#261a4a 100%)' }),
  t('anim-galaxy-stars', 'Galaksi Bintang Jatuh (Animasi)', 'animated', '#070a18', 'rgba(13,18,40,0.86)', '#eef2ff', '#9aa6d1', '#60a5fa', { animation: 'stars', animColor: '#ffffff', animColor2: '#93c5fd', bgCss: 'linear-gradient(160deg,#050712 0%,#121a3d 100%)' }),
  t('anim-nebula-violet', 'Nebula Kosmik (Animasi)', 'animated', '#130b24', 'rgba(23,14,44,0.86)', '#f4edff', '#b59fd6', '#a855f7', { animation: 'stars', animColor: '#e9d5ff', animColor2: '#38bdf8', bgCss: 'linear-gradient(155deg,#0f071c 0%,#271347 100%)' }),
  t('anim-embers-phoenix', 'Bara Api Phoenix (Animasi)', 'animated', '#1a0c0a', 'rgba(32,16,13,0.87)', '#fceee8', '#c99f91', '#f97316', { animation: 'embers', animColor: '#fb923c', animColor2: '#fde047', bgCss: 'linear-gradient(180deg,#120706 0%,#2e1410 100%)' }),
  t('anim-lantern-warm', 'Lentera Malam Emas (Animasi)', 'animated', '#1c150c', 'rgba(34,26,15,0.87)', '#faf1e2', '#c4ae8d', '#f59e0b', { animation: 'embers', animColor: '#fbbf24', animColor2: '#f97316', bgCss: 'linear-gradient(180deg,#140f08 0%,#2f2212 100%)' }),
  t('anim-ocean-bubbles', 'Samudra Dalam (Animasi)', 'animated', '#061c2c', 'rgba(10,34,52,0.86)', '#e4f6ff', '#8ab8cf', '#22d3ee', { animation: 'bubbles', animColor: '#67e8f9', animColor2: '#38bdf8', bgCss: 'linear-gradient(180deg,#041521 0%,#0b324d 100%)' }),
  t('anim-aqua-pearl', 'Mutiara Laut Cerah (Animasi)', 'animated', '#e6f9fc', 'rgba(255,255,255,0.88)', '#0f2f38', '#4b7480', '#0891b2', { animation: 'bubbles', animColor: '#06b6d4', animColor2: '#38bdf8', bgCss: 'linear-gradient(180deg,#cffafe 0%,#f4fdff 100%)' }),
  t('anim-autumn-drift', 'Musim Gugur Kyoto (Animasi)', 'animated', '#faf0e6', 'rgba(255,252,248,0.88)', '#361d0f', '#7a5540', '#c2410c', { animation: 'autumn', animColor: '#ea580c', animColor2: '#d97706', bgCss: 'linear-gradient(160deg,#fed7aa 0%,#fff7ed 100%)' }),
  t('anim-autumn-dusk', 'Senja Maple (Animasi)', 'animated', '#21120e', 'rgba(38,21,17,0.87)', '#fbeee8', '#c49d8f', '#f97316', { animation: 'autumn', animColor: '#f97316', animColor2: '#fbbf24', bgCss: 'linear-gradient(160deg,#1a0d0a 0%,#361c15 100%)' }),
  t('anim-aurora-borealis', 'Aurora Borealis (Animasi)', 'animated', '#07141f', 'rgba(11,26,40,0.86)', '#eafaf6', '#8ec2ba', '#2dd4bf', { animation: 'aurora', animColor: '#2dd4bf', animColor2: '#818cf8', bgCss: 'linear-gradient(155deg,#05101a 0%,#0f2938 60%,#1e1b4b 100%)' }),
  t('anim-aurora-rose', 'Aurora Mawar Utara (Animasi)', 'animated', '#160d21', 'rgba(27,16,40,0.86)', '#f9eefc', '#c1a1cc', '#f472b6', { animation: 'aurora', animColor: '#f472b6', animColor2: '#38bdf8', bgCss: 'linear-gradient(155deg,#120a1c 0%,#2c1640 100%)' }),
  t('anim-rose-petals', 'Kelopak Mawar Romansa (Animasi)', 'animated', '#fff0f3', 'rgba(255,251,252,0.89)', '#3b1120', '#80485c', '#e11d48', { animation: 'sakura', animColor: '#fb7185', animColor2: '#fda4af', bgCss: 'linear-gradient(155deg,#ffe4e6 0%,#fff8f9 100%)' }),
  t('anim-golden-dust', 'Debu Sihir Emas (Animasi)', 'animated', '#16130b', 'rgba(28,24,14,0.87)', '#fbf4e4', '#c4b189', '#eab308', { animation: 'fireflies', animColor: '#fde047', animColor2: '#f59e0b', bgCss: 'linear-gradient(160deg,#120f08 0%,#292211 100%)' }),
  t('anim-matrix-cyber', 'Aliran Kode Cyber (Animasi)', 'animated', '#06130d', 'rgba(10,24,17,0.88)', '#e2fced', '#7db899', '#22c55e', { animation: 'matrix', animColor: '#22c55e', animColor2: '#4ade80', bgCss: 'linear-gradient(180deg,#040e09 0%,#0b2116 100%)' }),
  t('anim-cyber-neon', 'Hujan Neon Tokyo (Animasi)', 'animated', '#0c0b1d', 'rgba(18,16,40,0.87)', '#eef0ff', '#9ea3d1', '#ec4899', { animation: 'rain', animColor: '#38bdf8', animColor2: '#ec4899', bgCss: 'linear-gradient(160deg,#080716 0%,#1d1338 100%)' }),
  t('anim-mist-xianxia', 'Kabut Awan Xianxia (Animasi)', 'animated', '#edf4f7', 'rgba(255,255,255,0.88)', '#142733', '#516c7d', '#0f766e', { animation: 'aurora', animColor: '#5eead4', animColor2: '#93c5fd', bgCss: 'linear-gradient(180deg,#e0f2fe 0%,#f0fdfa 100%)' }),
  t('anim-moon-stars', 'Bulan Sabit Tenang (Animasi)', 'animated', '#0f1629', 'rgba(20,28,50,0.87)', '#edf2fc', '#97a8c9', '#fbbf24', { animation: 'stars', animColor: '#fef08a', animColor2: '#ffffff', bgCss: 'linear-gradient(180deg,#0b1020 0%,#1b2645 100%)' }),
  t('anim-lavender-firefly', 'Kunang Lavender (Animasi)', 'animated', '#f5effc', 'rgba(255,254,255,0.89)', '#291a40', '#695585', '#7c3aed', { animation: 'fireflies', animColor: '#a855f7', animColor2: '#ec4899', bgCss: 'linear-gradient(160deg,#ede9fe 0%,#faf5ff 100%)' }),
  t('anim-emerald-rain', 'Hujan Hutan Tropis (Animasi)', 'animated', '#0b1c17', 'rgba(15,34,28,0.87)', '#e7f7f0', '#8bb8a6', '#10b981', { animation: 'rain', animColor: '#34d399', animColor2: '#6ee7b7', bgCss: 'linear-gradient(180deg,#071410 0%,#123026 100%)' }),

  // ---------- 5. GENRE SIGNATURE & POPULER PLAY STORE (26 TEMA) ----------
  t('genre-romance-paris', 'Romansa Senja Paris', 'genre', '#fdf0f2', 'rgba(255,252,253,0.92)', '#3b1521', '#7d4d5d', '#e11d48', { motif: 'sakura', motifC1: '#fb7185', motifC2: '#e11d48' }),
  t('genre-ceo-marble', 'CEO Marmer Mewah', 'genre', '#f4f4f6', '#ffffff', '#14151a', '#5f6370', '#b45309', { motif: 'linen', motifC1: '#94a3b8', motifC2: '#d97706' }),
  t('genre-ceo-obsidian', 'CEO Penthouse Malam', 'genre', '#0d0f14', '#161922', '#f1f4f9', '#99a2b5', '#f59e0b', { motif: 'grid', motifC1: '#f59e0b', motifC2: '#94a3b8' }),
  t('genre-xianxia-jade', 'Kultivasi Giok Putih', 'genre', '#eaf5f2', 'rgba(252,255,254,0.91)', '#132e2a', '#496e68', '#0f766e', { motif: 'mountains', motifC1: '#14b8a6', motifC2: '#0f766e' }),
  t('genre-xianxia-ink', 'Tinta Pedang Wuxia', 'genre', '#14171a', 'rgba(24,28,33,0.90)', '#edf1f5', '#96a1ad', '#2dd4bf', { motif: 'mountains', motifC1: '#2dd4bf', motifC2: '#475569' }),
  t('genre-isekai-guild', 'Isekai Guild Perkamen', 'genre', '#f3e7d0', 'rgba(253,248,238,0.92)', '#332210', '#70583b', '#b45309', { motif: 'castle', motifC1: '#d97706', motifC2: '#92400e' }),
  t('genre-royal-crown', 'Kerajaan Mahkota Emas', 'genre', '#1a1426', 'rgba(30,24,44,0.90)', '#f7f1ff', '#b7a6d1', '#fbbf24', { motif: 'castle', motifC1: '#fbbf24', motifC2: '#7c3aed' }),
  t('genre-system-hud', 'Sistem Leveling Biru', 'genre', '#081326', 'rgba(13,26,50,0.90)', '#e6f1ff', '#8fb0db', '#38bdf8', { motif: 'grid', motifC1: '#38bdf8', motifC2: '#6366f1' }),
  t('genre-horror-gothic', 'Horor Gotik Kabut', 'genre', '#120d10', 'rgba(24,17,21,0.91)', '#f2e8ec', '#a8929b', '#dc2626', { motif: 'castle', motifC1: '#dc2626', motifC2: '#450a0a' }),
  t('genre-horror-bloodmoon', 'Bulan Merah Misteri', 'genre', '#170a0d', 'rgba(31,13,18,0.90)', '#fae9ed', '#bd929d', '#ef4444', { animation: 'stars', animColor: '#fca5a5', animColor2: '#ef4444' }),
  t('genre-mystery-noir', 'Detektif Noir 1940', 'genre', '#161614', 'rgba(28,28,25,0.92)', '#efeee9', '#a3a196', '#eab308', { motif: 'linen', motifC1: '#eab308', motifC2: '#71717a' }),
  t('genre-scifi-orbital', 'Sci-Fi Stasiun Orbit', 'genre', '#09111f', 'rgba(14,23,41,0.90)', '#e6f0ff', '#8da4c7', '#22d3ee', { motif: 'constellation', motifC1: '#22d3ee', motifC2: '#818cf8' }),
  t('genre-teen-notebook', 'Remaja Sekolah Pastel', 'genre', '#fff9eb', 'rgba(255,254,250,0.93)', '#292218', '#6e614d', '#f59e0b', { motif: 'grid', motifC1: '#f59e0b', motifC2: '#fb923c' }),
  t('genre-campus-blue', 'Kampus Musim Semi', 'genre', '#eef5ff', 'rgba(255,255,255,0.92)', '#162540', '#546b91', '#2563eb', { motif: 'botanical', motifC1: '#3b82f6', motifC2: '#60a5fa' }),
  t('genre-comedy-pop', 'Komedi Ceria Pop', 'genre', '#fefce8', '#ffffff', '#2b250e', '#706538', '#ea580c', { bgCss: 'linear-gradient(155deg,#fef08a 0%,#fffbeb 100%)' }),
  t('genre-historical-id', 'Sastra Nusantara', 'genre', '#f4ead8', 'rgba(253,249,240,0.92)', '#2f2012', '#6e543a', '#9a3412', { motif: 'batik', motifC1: '#9a3412', motifC2: '#b45309' }),
  t('genre-adventure-map', 'Petualangan Peta Laut', 'genre', '#efe4ce', 'rgba(251,246,236,0.91)', '#2d2113', '#6c563d', '#0369a1', { motif: 'waves', motifC1: '#0369a1', motifC2: '#b45309' }),
  t('genre-slice-coffee', 'Slice of Life Kopi Susu', 'genre', '#f5ede4', '#fdf9f5', '#2e2118', '#735b4b', '#9a3412'),
  t('genre-vampire-velvet', 'Vampir Beludru Ungu', 'genre', '#1a0c18', 'rgba(33,15,31,0.90)', '#faebf7', '#bf9ab8', '#e11d48'),
  t('genre-mecha-steel', 'Mecha Baja Titanium', 'genre', '#13171f', 'rgba(23,28,38,0.91)', '#e8eef7', '#94a3b8', '#38bdf8', { motif: 'grid', motifC1: '#64748b', motifC2: '#38bdf8' }),
  t('genre-elf-glade', 'Lembah Elf Cahaya', 'genre', '#eaf7ee', 'rgba(252,255,253,0.90)', '#16301e', '#4c7058', '#16a34a', { animation: 'fireflies', animColor: '#4ade80', animColor2: '#facc15' }),
  t('genre-villainess', 'Villainess Bangsawan', 'genre', '#21101d', 'rgba(38,18,34,0.90)', '#fceef8', '#c79ebc', '#f43f5e', { motif: 'sakura', motifC1: '#f43f5e', motifC2: '#fbbf24' }),
  t('genre-apocalypse', 'Apokalips Abu Baja', 'genre', '#1a1c1e', 'rgba(31,34,37,0.91)', '#e7ebee', '#99a1a8', '#f97316', { motif: 'linen', motifC1: '#f97316', motifC2: '#64748b' }),
  t('genre-fanfic-dream', 'Fanfiksi Langit Impian', 'genre', '#f0f4ff', 'rgba(255,255,255,0.90)', '#1c2340', '#5b6691', '#6366f1', { animation: 'stars', animColor: '#6366f1', animColor2: '#ec4899' }),
  t('genre-martial-gold', 'Pendekar Naga Emas', 'genre', '#1c150c', 'rgba(34,26,14,0.90)', '#faf2e1', '#c4ae86', '#f59e0b', { motif: 'batik', motifC1: '#f59e0b', motifC2: '#ea580c' }),
  t('genre-drama-autumn', 'Melodrama Senja', 'genre', '#f7ece6', 'rgba(255,251,249,0.91)', '#331c15', '#78564b', '#be123c', { animation: 'autumn', animColor: '#e11d48', animColor2: '#f97316' }),
];

export const TOTAL_BUILTIN_THEMES = BUILTIN_NOVEL_THEMES.length; // 122 built-in themes!

/**
 * Deterministically compiles any user natural-language theme description into a complete,
 * WCAG-AA readable, animated/illustrated theme (used both as instant fallback & alongside AI).
 */
export function compileThemeFromPrompt(promptText = '', aiJson = null) {
  const raw = String(promptText || '').trim() || 'Tema Malam Nyaman';
  const low = raw.toLowerCase();

  // Start with AI JSON values if valid
  let bg = aiJson && /^#[0-9a-fA-F]{6}$/.test(aiJson.bg || '') ? aiJson.bg : '';
  let surface = aiJson && /^#[0-9a-fA-F]{6}$/.test(aiJson.surface || '') ? aiJson.surface : '';
  let accent = aiJson && /^#[0-9a-fA-F]{6}$/.test(aiJson.accent || '') ? aiJson.accent : '';
  let animation = aiJson && ['none', 'sakura', 'snow', 'rain', 'fireflies', 'stars', 'embers', 'bubbles', 'autumn', 'aurora', 'matrix'].includes(aiJson.animation)
    ? aiJson.animation
    : '';
  let motif = aiJson && ['none', 'mountains', 'waves', 'constellation', 'botanical', 'sakura', 'batik', 'library', 'castle', 'grid', 'linen'].includes(aiJson.motif)
    ? aiJson.motif
    : '';

  const wantsDark = /(malam|gelap|dark|night|hitam|amoled|neon|cyber|horor|gothic|galaksi|galaxy|bintang|space|hutan malam|vampir|noir)/.test(low);
  const wantsLight = /(terang|pagi|cerah|putih|pastel|krem|sepia|light|bright|kertas|siang|salju pagi)/.test(low);
  const isDarkTheme = wantsDark ? true : wantsLight ? false : bg ? isHexDark(bg) : true;

  if (!bg) {
    if (/(sakura|pink|mawar|romansa|rose)/.test(low)) bg = isDarkTheme ? '#1b1022' : '#fdf2f7';
    else if (/(hutan|hijau|daun|forest|matcha|emerald|alam|peri)/.test(low)) bg = isDarkTheme ? '#0a1c15' : '#eaf5ee';
    else if (/(laut|samudra|ocean|biru|hujan|langit|salju|es|glacier|blue)/.test(low)) bg = isDarkTheme ? '#091829' : '#eaf4fc';
    else if (/(ungu|violet|galaksi|nebula|magic|sihir|fantasi|purple)/.test(low)) bg = isDarkTheme ? '#140e26' : '#f4eefe';
    else if (/(api|senja|gugur|kafe|kopi|kayu|hangat|emas|gold|sunset|autumn|sepia)/.test(low)) bg = isDarkTheme ? '#1d140e' : '#f6ecd9';
    else if (/(merah|darah|horor|vampir|crimson|red)/.test(low)) bg = isDarkTheme ? '#1b0b0f' : '#fdf0f2';
    else bg = isDarkTheme ? '#111827' : '#faf7f0';
  }

  if (!surface) {
    const [r, g, b] = hexToRgb(bg);
    const shift = isDarkTheme ? 14 : 10;
    const clamp = (v) => Math.max(0, Math.min(255, v));
    surface = `rgba(${clamp(r + shift)}, ${clamp(g + shift)}, ${clamp(b + shift)}, ${isDarkTheme ? '0.88' : '0.91'})`;
  }

  if (!accent) {
    if (/(sakura|pink|mawar|romansa)/.test(low)) accent = '#ec4899';
    else if (/(hutan|hijau|matcha|emerald|matrix)/.test(low)) accent = '#10b981';
    else if (/(emas|kafe|kopi|kayu|api|senja|hangat|lentera)/.test(low)) accent = '#f59e0b';
    else if (/(ungu|violet|peri|sihir|fantasi)/.test(low)) accent = '#a855f7';
    else if (/(merah|horor|vampir)/.test(low)) accent = '#ef4444';
    else accent = '#38bdf8';
  }

  if (!animation) {
    if (/(sakura|kelopak|bunga|mawar)/.test(low)) animation = 'sakura';
    else if (/(salju|snow|dingin|winter)/.test(low)) animation = 'snow';
    else if (/(hujan|rain|gerimis|badai)/.test(low)) animation = 'rain';
    else if (/(kunang|firefl|peri|sihir|cahaya|lampu)/.test(low)) animation = 'fireflies';
    else if (/(bintang|galaksi|nebula|angkasa|star|bulan)/.test(low)) animation = 'stars';
    else if (/(api|bara|lentera|perapian|phoenix|ember)/.test(low)) animation = 'embers';
    else if (/(laut|samudra|gelembung|bubble|air|ocean)/.test(low)) animation = 'bubbles';
    else if (/(gugur|daun|autumn|maple)/.test(low)) animation = 'autumn';
    else if (/(aurora|kabut|awan|mist)/.test(low)) animation = 'aurora';
    else if (/(matrix|cyber|hacker|kode)/.test(low)) animation = 'matrix';
    else animation = 'none';
  }

  if (!motif) {
    if (/(gunung|pegunungan|mountain)/.test(low)) motif = 'mountains';
    else if (/(laut|ombak|wave)/.test(low)) motif = 'waves';
    else if (/(bintang|galaksi|constellation)/.test(low)) motif = 'constellation';
    else if (/(kastil|kerajaan|castle|fantasi|horor)/.test(low)) motif = 'castle';
    else if (/(perpustakaan|buku|kafe|library)/.test(low)) motif = 'library';
    else if (/(batik|nusantara|tradisional)/.test(low)) motif = 'batik';
    else if (/(hutan|daun|taman|botani)/.test(low)) motif = 'botanical';
    else if (/(sakura|bunga)/.test(low)) motif = 'sakura';
    else motif = 'linen';
  }

  const text = ensureReadableText(bg, aiJson?.text || '');
  const muted = isDarkTheme ? '#a3b3cc' : '#64748b';
  const cleanTitle =
    (aiJson?.name && String(aiJson.name).trim().slice(0, 36)) ||
    `AI: ${raw.replace(/\s+/g, ' ').slice(0, 28)}${raw.length > 28 ? '...' : ''}`;

  return {
    id: `ai-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: cleanTitle,
    category: 'custom',
    bg,
    bgCss: bg,
    surface,
    text,
    muted,
    accent,
    isDark: isDarkTheme,
    patternSvg: motif && motif !== 'none' ? buildIllustrationSvgUri(motif, accent, muted) : '',
    patternSize: motif === 'mountains' || motif === 'castle' ? 'cover' : '240px',
    animation,
    animColor: accent,
    animColor2: isDarkTheme ? '#ffffff' : muted,
    fontId: aiJson?.fontId || '',
    customImage: '',
    source: 'ai',
    prompt: raw,
  };
}

/**
 * Builds a custom uploaded theme from either a JSON theme file or an uploaded wallpaper image DataURL.
 */
export function buildCustomUploadedTheme({ fileName = 'Tema Kustom', jsonObj = null, imageDataUrl = '', isDark = true } = {}) {
  const baseName = String(fileName || 'Tema Kustom').replace(/\.[^.]+$/, '').slice(0, 34);
  if (jsonObj && typeof jsonObj === 'object') {
    const bg = /^#[0-9a-fA-F]{3,6}$/.test(jsonObj.bg || '') ? jsonObj.bg : '#111827';
    const dark = typeof jsonObj.isDark === 'boolean' ? jsonObj.isDark : isHexDark(bg);
    const accent = /^#[0-9a-fA-F]{3,6}$/.test(jsonObj.accent || '') ? jsonObj.accent : '#38bdf8';
    return {
      id: `upload-${Date.now().toString(36)}`,
      name: String(jsonObj.name || baseName).slice(0, 36),
      category: 'custom',
      bg,
      bgCss: String(jsonObj.bgCss || bg),
      surface: String(jsonObj.surface || (dark ? 'rgba(17,24,39,0.88)' : 'rgba(255,255,255,0.92)')),
      text: ensureReadableText(bg, jsonObj.text || ''),
      muted: String(jsonObj.muted || (dark ? '#94a3b8' : '#64748b')),
      accent,
      isDark: dark,
      patternSvg: '',
      patternSize: 'cover',
      animation: ['none', 'sakura', 'snow', 'rain', 'fireflies', 'stars', 'embers', 'bubbles', 'autumn', 'aurora', 'matrix'].includes(jsonObj.animation)
        ? jsonObj.animation
        : 'none',
      animColor: jsonObj.animColor || accent,
      animColor2: jsonObj.animColor2 || '#ffffff',
      fontId: jsonObj.fontId || '',
      customImage: typeof jsonObj.customImage === 'string' && jsonObj.customImage.startsWith('data:image/') ? jsonObj.customImage : '',
      source: 'upload',
    };
  }

  return {
    id: `upload-img-${Date.now().toString(36)}`,
    name: `Wallpaper: ${baseName}`,
    category: 'custom',
    bg: isDark ? '#0f172a' : '#f8fafc',
    bgCss: isDark ? '#0f172a' : '#f8fafc',
    surface: isDark ? 'rgba(15, 23, 42, 0.82)' : 'rgba(255, 255, 255, 0.86)',
    text: isDark ? '#f8fafc' : '#0f172a',
    muted: isDark ? '#cbd5e1' : '#475569',
    accent: isDark ? '#38bdf8' : '#2563eb',
    isDark,
    patternSvg: '',
    patternSize: 'cover',
    animation: 'none',
    animColor: '#38bdf8',
    animColor2: '#ffffff',
    fontId: '',
    customImage: imageDataUrl,
    source: 'upload-image',
  };
}

/**
 * Fetches a live harmonious color scheme from the open public CORS API `thecolorapi.com`
 * to generate unlimited fresh third-party API themes on demand.
 */
export async function fetchOpenApiPaletteTheme(seedHex = '', mode = 'analogic') {
  const cleanSeed = String(seedHex || '').replace('#', '').trim() ||
    Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
  const safeMode = ['analogic', 'monochrome-dark', 'monochrome-light', 'complement', 'quad'].includes(mode)
    ? mode
    : 'analogic';
  const url = `https://www.thecolorapi.com/scheme?hex=${cleanSeed}&mode=${safeMode}&count=5`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const data = await resp.json();
  const colors = Array.isArray(data?.colors) ? data.colors : [];
  if (colors.length < 3) throw new Error('Palet API kosong');

  const sorted = [...colors].sort((a, b) => relativeLuminance(a.hex.value) - relativeLuminance(b.hex.value));
  const useDark = safeMode === 'monochrome-dark' || Math.random() > 0.45;
  const bg = useDark ? sorted[0].hex.value : sorted[sorted.length - 1].hex.value;
  const accent = colors[Math.floor(colors.length / 2)].hex.value;
  const text = ensureReadableText(bg);
  const dark = isHexDark(bg);
  const label = colors[0]?.name?.value || `Palet #${cleanSeed.toUpperCase()}`;

  return {
    id: `api-${cleanSeed}-${Date.now().toString(36)}`,
    name: `API: ${label}`,
    category: 'custom',
    bg,
    bgCss: `linear-gradient(155deg, ${bg} 0%, ${useDark ? sorted[1].hex.value : sorted[sorted.length - 2].hex.value} 100%)`,
    surface: dark ? 'rgba(15, 23, 42, 0.86)' : 'rgba(255, 255, 255, 0.90)',
    text,
    muted: dark ? '#a5b4cc' : '#526071',
    accent,
    isDark: dark,
    patternSvg: buildIllustrationSvgUri('linen', accent, text),
    patternSize: '42px',
    animation: 'none',
    animColor: accent,
    animColor2: '#ffffff',
    fontId: '',
    customImage: '',
    source: 'open-api',
  };
}
