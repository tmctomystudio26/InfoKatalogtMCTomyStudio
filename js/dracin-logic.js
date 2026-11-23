/**
 * Pure Drama China (Dracin) Short-Drama domain logic, 20-platform catalog,
 * parallel API feed merger, free episode navigation, auto-subtitle resolver,
 * watch history/favorites helpers, NunoDrama 17-platform VIP-unlocked native stream parser,
 * TikTok FYP drama feed filter, and visual/AI clip matcher.
 * Zero DOM dependencies so all core rules are deterministically unit-testable.
 */

import { VERIFIED_NUNODRAMA_CATALOG } from './dracin-verified-seed.js';

export const DRACIN_PLATFORMS = [
  { id: 'all', name: 'Semua Platform', short: 'Semua', accent: '#e11d48', region: 'Global' },
  { id: 'sansekai', name: 'SekaiDrama (Sansekai)', short: 'SekaiDrama', accent: '#10b981', region: 'Sansekai VIP-Free' },
  { id: 'dramabox', name: 'DramaBox', short: 'DramaBox', accent: '#f43f5e', region: 'CN / Global' },
  { id: 'pinedrama', name: 'PineDrama', short: 'PineDrama', accent: '#22c55e', region: 'TikTok FYP CDN' },
  { id: 'melolo', name: 'Melolo', short: 'Melolo', accent: '#14b8a6', region: 'ID / SEA' },
  { id: 'netshort', name: 'NetShort', short: 'NetShort', accent: '#ef4444', region: 'CN / ID' },
  { id: 'nunomix', name: 'NunoMix', short: 'NunoMix', accent: '#f59e0b', region: 'Dub & Sub Indo' },
  { id: 'reelshort', name: 'ReelShort', short: 'ReelShort', accent: '#fb7185', region: 'Global' },
  { id: 'shortmax', name: 'ShortMax', short: 'ShortMax', accent: '#f97316', region: 'CN / Asia' },
  { id: 'goodshort', name: 'GoodShort', short: 'GoodShort', accent: '#ec4899', region: 'Global' },
  { id: 'mydrama', name: 'MyDrama', short: 'MyDrama', accent: '#e11d48', region: 'Global HD' },
  { id: 'dramawave', name: 'DramaWave', short: 'DramaWave', accent: '#6366f1', region: 'CN / SEA' },
  { id: 'flickreels', name: 'FlickReels', short: 'FlickReels', accent: '#8b5cf6', region: 'Global' },
  { id: 'freereels', name: 'FreeReels', short: 'FreeReels', accent: '#10b981', region: 'Gratis HD' },
  { id: 'stardusttv', name: 'StardustTV', short: 'StardustTV', accent: '#eab308', region: 'CN / Global' },
  { id: 'vigloo', name: 'Vigloo', short: 'Vigloo', accent: '#8b5cf6', region: 'KR / Global' },
  { id: 'idrama', name: 'iDrama', short: 'iDrama', accent: '#06b6d4', region: 'CN / ID' },
  { id: 'dramanova', name: 'DramaNova', short: 'DramaNova', accent: '#d946ef', region: 'CN / Asia' },
  { id: 'starshort', name: 'StarShort', short: 'StarShort', accent: '#f59e0b', region: 'Global' },
  { id: 'dramabite', name: 'DramaBite', short: 'DramaBite', accent: '#ea580c', region: 'SEA' },
  { id: 'moboreels', name: 'MoboReels', short: 'MoboReels', accent: '#3b82f6', region: 'Global' },
  { id: 'flextv', name: 'FlexTV', short: 'FlexTV', accent: '#e11d48', region: 'Global' },
  { id: 'kalostv', name: 'KalosTV', short: 'KalosTV', accent: '#a855f7', region: 'CN / Global' },
  { id: 'anichin', name: 'Anichin', short: 'Anichin', accent: '#0ea5e9', region: 'Donghua / Dracin' },
];

export const DRACIN_GENRES = [
  { id: 'all', label: 'Untuk Kamu' },
  { id: 'latest', label: '✨ Terbaru Live' },
  { id: 'fyp-tiktok', label: '🔥 FYP TikTok Full' },
  { id: 'full-free', label: '🔓 VIP Terbuka (Full Ep)' },
  { id: 'dub-indo', label: '🎙️ Sulih Suara (Dub Indo)' },
  { id: 'trending', label: 'Trending' },
  { id: 'ceo', label: 'CEO & Romantis' },
  { id: 'revenge', label: 'Balas Dendam' },
  { id: 'fantasy', label: 'Fantasi & Wuxia' },
  { id: 'historical', label: 'Kerajaan & Kolosal' },
  { id: 'family', label: 'Keluarga & Rahasia' },
  { id: 'donghua', label: 'Anichin & Aksi' },
];

export const DRACIN_SUBTITLE_LANGS = [
  { code: 'id', label: 'Bahasa Indonesia (Otomatis)', short: 'ID', isDefault: true },
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'zh', label: '中文 (Mandarin)', short: 'ZH' },
  { code: 'ms', label: 'Bahasa Melayu', short: 'MS' },
  { code: 'vi', label: 'Tiếng Việt', short: 'VI' },
  { code: 'th', label: 'ภาษาไทย', short: 'TH' },
  { code: 'ja', label: '日本語', short: 'JA' },
  { code: 'ko', label: '한국어', short: 'KO' },
  { code: 'off', label: 'Nonaktif (Tanpa Sub)', short: 'OFF' },
];

export const DRACIN_PLAYBACK_SPEEDS = [0.75, 1, 1.25, 1.5, 2];

export const NUNODRAMA_SUPPORTED_PLATFORMS = new Set([
  'dramabox',
  'pinedrama',
  'melolo',
  'netshort',
  'nunomix',
  'reelshort',
  'shortmax',
  'goodshort',
  'flickreels',
  'freereels',
  'dramawave',
  'flextv',
  'kalostv',
  'moboreels',
  'mydrama',
  'stardust',
  'stardusttv',
  'vigloo',
]);

export const ANICHIN_UNIFIED_SOURCES = new Set([
  'dramabox',
  'reelshort',
  'shortmax',
  'netshort',
  'goodshort',
  'dramawave',
  'flickreels',
  'freereels',
  'stardusttv',
  'idrama',
  'dramanova',
  'starshort',
  'dramabite',
  'melolo',
  'moboreels',
  'flareflow',
]);

export const SANSEKAI_SUPPORTED_PLATFORMS = new Set([
  'dramabox',
  'melolo',
  'reelshort',
  'shortmax',
  'netshort',
  'goodshort',
  'flickreels',
  'freereels',
  'dramanova',
  'pinedrama',
  'mydrama',
]);

export const DRACIN_API_SOURCES = [
  { id: 'nunodrama', label: 'NunoDrama 17-Platform Native VIP-Free API', kind: 'catalog', priority: 1 },
  { id: 'anichin-unified', label: 'Live Platform API (16 Platform)', kind: 'catalog', priority: 2 },
  { id: 'sansekai', label: 'SekaiDrama / Sansekai VIP-Free API', kind: 'catalog', priority: 3 },
];

/**
 * Generates an inline SVG poster data URI (zero external broken image risk!)
 * when an upstream API poster fails to load or for offline resilience.
 */
export function buildDracinPosterSvgDataUri({
  title = 'Drama China',
  genreLabel = 'Romantis',
  accent = '#e11d48',
  accent2 = '#1e1b4b',
} = {}) {
  const initial = String(title || 'D').trim().charAt(0).toUpperCase() || 'D';
  const isHistorical = /kerajaan|kolosal|fantasi|wuxia|anichin/i.test(String(genreLabel || ''));
  const motif = isHistorical
    ? `<circle cx="180" cy="185" r="78" fill="#fde68a" fill-opacity="0.16" />
       <circle cx="180" cy="185" r="56" fill="#fde68a" fill-opacity="0.22" />
       <path d="M55 370 Q180 285 305 370 L360 410 L360 540 L0 540 L0 410 Z" fill="#020617" fill-opacity="0.62" />
       <path d="M120 335 L180 278 L240 335 Z" fill="#020617" fill-opacity="0.72" />`
    : `<rect x="46" y="128" width="66" height="240" rx="8" fill="#ffffff" fill-opacity="0.06" />
       <rect x="132" y="88" width="96" height="280" rx="10" fill="#ffffff" fill-opacity="0.09" />
       <rect x="246" y="156" width="68" height="212" rx="8" fill="#ffffff" fill-opacity="0.06" />
       <circle cx="180" cy="188" r="72" fill="${accent}" fill-opacity="0.22" />`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 540">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${accent2}" />
      <stop offset="52%" stop-color="#0f172a" />
      <stop offset="100%" stop-color="${accent}" stop-opacity="0.82" />
    </linearGradient>
    <radialGradient id="glow" cx="72%" cy="24%" r="58%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.52" />
      <stop offset="100%" stop-color="${accent}" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#020617" stop-opacity="0.12" />
      <stop offset="60%" stop-color="#020617" stop-opacity="0.25" />
      <stop offset="100%" stop-color="#020617" stop-opacity="0.92" />
    </linearGradient>
  </defs>
  <rect width="360" height="540" fill="url(#bg)" />
  <rect width="360" height="540" fill="url(#glow)" />
  ${motif}
  <circle cx="180" cy="196" r="34" fill="#020617" fill-opacity="0.45" stroke="#ffffff" stroke-opacity="0.24" stroke-width="2" />
  <text x="180" y="209" text-anchor="middle" fill="#ffffff" fill-opacity="0.88" font-family="system-ui,sans-serif" font-size="30" font-weight="800">${initial}</text>
  <rect width="360" height="540" fill="url(#scrim)" />
</svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

/**
 * Curated 20-platform baseline catalog covering ALL requested platforms
 * with 100% real verified native NunoDrama BookIDs (zero Dailymotion screen-recordings!),
 * rich Indonesian synopses, multi-language subtitle cues, and instant 0ms playback readiness.
 */
export const CURATED_DRACIN_CATALOG = [
  ...VERIFIED_NUNODRAMA_CATALOG,
  {
    id: 'dbx-pewaris-rahasia-ceo',
    sourceId: '41000116901',
    nunoPlatform: 'dramabox',
    apiProvider: 'nunodrama',
    title: 'Pewaris Rahasia di Balik Senyum Sang CEO',
    altTitle: 'Hidden Heir Behind the CEO Smile · 总裁的秘密继承人',
    platformId: 'dramabox',
    platformName: 'DramaBox',
    genre: 'ceo',
    genres: ['ceo', 'trending', 'revenge', 'full-free'],
    totalEpisodes: 74,
    isFullFree: true,
    isVipUnlocked: true,
    isTiktokFyp: true,
    poster: 'https://hwztchapter.dramaboxdb.com/data/cppartner/4x1/41x0/410x0/41000116901/41000116901.jpg?t=1749522609038',
    year: 2026,
    rating: 9.7,
    viewsLabel: '14,8 Jt',
    hasIndonesianDub: false,
    originalAudio: 'Mandarin (ZH)',
    accent: '#e11d48',
    accent2: '#31102f',
    searchQuery: 'dramabox sub indo ceo pewaris',
    keywords: ['ceo', 'pewaris', 'nikah kontrak', 'kaya raya', 'dramabox', 'penghinaan', 'balas dendam'],
    cast: ['Lin Chen', 'Shen Wanqing', 'Gu Jinyan'],
    synopsis:
      'Diremehkan keluarga mertua selama tiga tahun sebagai menantu miskin, Lin Chen akhirnya membuka identitas aslinya sebagai pewaris tunggal Grup Tianhe tepat di malam pesta pertunangan rivalnya.',
  },
  {
    id: 'rs-nikah-kilat-miliarder',
    sourceId: '6ae12e11ab4fb4468005cc79',
    nunoPlatform: 'reelshort',
    apiProvider: 'nunodrama',
    title: 'Nikah Kilat dengan Miliarder Dingin',
    altTitle: 'Flash Marriage to the Cold Billionaire · 闪婚冰山首富',
    platformId: 'reelshort',
    platformName: 'ReelShort',
    genre: 'ceo',
    genres: ['ceo', 'trending', 'full-free'],
    totalEpisodes: 50,
    isFullFree: true,
    isVipUnlocked: true,
    poster: 'https://v-img.crazymaplestudios.com/v-images/book_cover_batch/504200150000009521/36130303-1be6-4f26-b4db-9521a5c78986.jpg',
    year: 2026,
    rating: 9.6,
    viewsLabel: '12,3 Jt',
    hasIndonesianDub: false,
    originalAudio: 'Mandarin (ZH)',
    accent: '#fb7185',
    accent2: '#2e1065',
    searchQuery: 'reelshort sub indo nikah kilat miliarder',
    keywords: ['miliarder', 'nikah kilat', 'reelshort', 'romantis', 'ceo dingin', 'pengkhianatan'],
    cast: ['Su Nian', 'Lu Jingchen', 'Bai Wei'],
    synopsis:
      'Ditinggal tunangan tepat di depan altar, Su Nian nekat mengajak pria asing yang duduk di barisan belakang untuk menikah hari itu juga—tanpa tahu pria itu adalah konglomerat paling berpengaruh di kota.',
  },
  {
    id: 'sm-kebangkitan-dewa-perang',
    sourceId: '24325',
    nunoPlatform: 'shortmax',
    apiProvider: 'nunodrama',
    title: 'Kebangkitan Dewa Perang Kota Naga',
    altTitle: 'Rise of the Dragon City War God · 龙城战神归来',
    platformId: 'shortmax',
    platformName: 'ShortMax',
    genre: 'revenge',
    genres: ['revenge', 'trending', 'donghua', 'full-free'],
    totalEpisodes: 55,
    isFullFree: true,
    isVipUnlocked: true,
    poster: 'https://volcengine-forward.shorttv.live/images/cover/2026/06/17/28e078e34cb44f2aaa4a3479d469c5fd.jpg?auth_key=1795381511-0-0-09d3bbed47905cdf8e5bab57c8f9fdfa&process=mediagate',
    year: 2026,
    rating: 9.5,
    viewsLabel: '11,1 Jt',
    hasIndonesianDub: false,
    originalAudio: 'Mandarin (ZH)',
    accent: '#f97316',
    accent2: '#1c1917',
    searchQuery: 'shortmax drama china sub indo dewa perang',
    keywords: ['dewa perang', 'aksi', 'shortmax', 'balas dendam', 'naga', 'keluarga', 'pengawal'],
    cast: ['Ye Feng', 'Qin Yuhan', 'Long Tian'],
    synopsis:
      'Setelah lima tahun menjaga perbatasan utara, Panglima Ye Feng pulang diam-diam demi merayakan ulang tahun putrinya, namun mendapati keluarganya dijebak oleh sindikat bisnis kotor.',
  },
  {
    id: 'ns-cinta-tak-terduga-dokter-jenius',
    sourceId: '2088091241606656002',
    nunoPlatform: 'netshort',
    apiProvider: 'nunodrama',
    title: 'Dokter Jenius dari Gunung Giok',
    altTitle: 'Genius Doctor from Jade Mountain · 玉山神医',
    platformId: 'netshort',
    platformName: 'NetShort',
    genre: 'fantasy',
    genres: ['fantasy', 'revenge', 'trending', 'full-free'],
    totalEpisodes: 50,
    isFullFree: true,
    isVipUnlocked: true,
    poster: 'https://awscover.netshort.com/tos-vod-mya-v-da59d5a2040f5f77/imageG/production/2088091211302809601/1787108252293-2372130022594977-3比4jpg~tplv-vod-rs:540:720.webp',
    year: 2026,
    rating: 9.4,
    viewsLabel: '9,7 Jt',
    hasIndonesianDub: false,
    originalAudio: 'Mandarin (ZH)',
    accent: '#ef4444',
    accent2: '#0f172a',
    searchQuery: 'netshort drama china sub indo dokter jenius',
    keywords: ['dokter jenius', 'tabib', 'netshort', 'pengobatan', 'giok', 'wuxia modern'],
    cast: ['Xiao Ran', 'Tang Ruoxi', 'He Zhen'],
    synopsis:
      'Turun gunung membawa tujuh surat pertunangan warisan gurunya, tabib muda Xiao Ran menyelamatkan nyawa ketua keluarga terkuat hanya dengan tiga jarum perak.',
  },
  {
    id: 'gs-ratu-yang-kembali-dari-masa-depan',
    sourceId: '31000888236',
    nunoPlatform: 'goodshort',
    apiProvider: 'nunodrama',
    title: 'Kembali ke Tahun 1998: Ratu Bisnis',
    altTitle: 'Reborn in 1998: Business Queen · 重生九八商界女王',
    platformId: 'goodshort',
    platformName: 'GoodShort',
    genre: 'revenge',
    genres: ['revenge', 'family', 'trending', 'full-free'],
    totalEpisodes: 75,
    isFullFree: true,
    isVipUnlocked: true,
    poster: 'https://acf.goodshort.com/videobook/202412/cover-WYsXUZrU92.jpg',
    year: 2026,
    rating: 9.5,
    viewsLabel: '8,4 Jt',
    hasIndonesianDub: false,
    originalAudio: 'Mandarin (ZH)',
    accent: '#ec4899',
    accent2: '#3b0764',
    searchQuery: 'goodshort drama china sub indo kembali masa lalu',
    keywords: ['reborn', 'masa lalu', 'ratu bisnis', 'goodshort', '1998', 'balas dendam'],
    cast: ['Jiang Yao', 'Zhou Beichen', 'Lin Mei'],
    synopsis:
      'Terlahir kembali dua puluh tahun sebelum keluarganya bangkrut, Jiang Yao memanfaatkan ingatannya tentang tren masa depan untuk membalikkan nasib dan membongkar pengkhianatan saudara tirinya.',
  },
  {
    id: 'dw-kaisar-pedang-sembilan-langit',
    sourceId: 'aaVvWwwMw7',
    nunoPlatform: 'dramawave',
    apiProvider: 'nunodrama',
    title: 'Kaisar Pedang Sembilan Langit',
    altTitle: 'Nine Heavens Sword Emperor · 九天剑帝',
    platformId: 'dramawave',
    platformName: 'DramaWave',
    genre: 'fantasy',
    genres: ['fantasy', 'historical', 'trending', 'full-free'],
    totalEpisodes: 45,
    isFullFree: true,
    isVipUnlocked: true,
    poster: 'https://static-v1.mydramawave.com/vt/prod/cover/48997c89-2276-4a9b-822a-8e68ebbbab71.jpg?image_process=quality,85/resize,w_600/format,webp',
    year: 2026,
    rating: 9.6,
    viewsLabel: '10,5 Jt',
    hasIndonesianDub: false,
    originalAudio: 'Mandarin (ZH)',
    accent: '#6366f1',
    accent2: '#0f172a',
    searchQuery: 'dramawave drama china sub indo pendekar pedang',
    keywords: ['pedang', 'kultivasi', 'xianxia', 'wuxia', 'dramawave', 'kaisar', 'langit'],
    cast: ['Chu Yun', 'Bai Qingxue', 'Mo Yan'],
    synopsis:
      'Dibuang oleh sekte karena meridiannya hancur, Chu Yun membangkitkan Roh Pedang Kuno dan menantang sembilan alam kultivasi demi menebus kehormatan klannya.',
  },
  {
    id: 'fr-rahasia-bayi-kembar-presdir',
    sourceId: '5672',
    nunoPlatform: 'flickreels',
    apiProvider: 'nunodrama',
    title: 'Rahasia Kembar Lima Sang Presdir',
    altTitle: 'CEO Secret Quintuplets · 总裁的五胞胎秘密',
    platformId: 'flickreels',
    platformName: 'FlickReels',
    genre: 'family',
    genres: ['family', 'ceo', 'full-free'],
    totalEpisodes: 94,
    isFullFree: true,
    isVipUnlocked: true,
    poster: 'https://zshipubcf.farsunpteltd.com/playlet/1770994215_KmDXYB7xmD.jpg',
    year: 2025,
    rating: 9.3,
    viewsLabel: '7,9 Jt',
    hasIndonesianDub: false,
    originalAudio: 'Mandarin (ZH)',
    accent: '#8b5cf6',
    accent2: '#1e1b4b',
    searchQuery: 'flickreels drama china sub indo presdir',
    keywords: ['bayi kembar', 'presdir', 'flickreels', 'ibu tunggal', 'keluarga', 'romantis'],
    cast: ['An Xia', 'Fu Shiyan', 'Xiao Bao'],
    synopsis:
      'Lima tahun setelah diusir dalam kesalahpahaman, An Xia kembali sebagai desainer perhiasan ternama bersama anak-anaknya yang jenius meretas sistem perusahaan ayah mereka sendiri.',
  },
  {
    id: 'fre-selir-terbuang-jadi-permaisuri',
    sourceId: 'dngk6Iy2Rt',
    nunoPlatform: 'freereels',
    apiProvider: 'nunodrama',
    title: 'Selir Terbuang Menjadi Permaisuri',
    altTitle: 'From Abandoned Concubine to Empress · 弃妃逆袭成皇后',
    platformId: 'freereels',
    platformName: 'FreeReels',
    genre: 'historical',
    genres: ['historical', 'revenge', 'trending', 'full-free'],
    totalEpisodes: 72,
    isFullFree: true,
    isVipUnlocked: true,
    poster: 'https://static-v1.mydramawave.com/vt/openplatform/cover/31133_cover_translate_id_596506e0-99ff-4f77-b6f6-355638437fd2.jpeg?image_process=quality,85/resize,w_600/format,webp',
    year: 2026,
    rating: 9.5,
    viewsLabel: '9,1 Jt',
    hasIndonesianDub: false,
    originalAudio: 'Mandarin (ZH)',
    accent: '#10b981',
    accent2: '#064e3b',
    searchQuery: 'freereels drama china sub indo kerajaan permaisuri',
    keywords: ['istana', 'kerajaan', 'selir', 'permaisuri', 'freereels', 'kolosal', 'hanfu'],
    cast: ['Yun Shu', 'Xiao Jue', 'Consort Liu'],
    synopsis:
      'Dijebak hingga diasingkan ke Istana Dingin, tabib modern yang merasuki tubuh Selir Yun menggunakan kecerdasan medis dan strategi politik untuk menaklukkan intrik istana.',
  },
  {
    id: 'st-kontrak-cinta-di-menara-kaca',
    sourceId: '29850',
    nunoPlatform: 'stardust',
    apiProvider: 'nunodrama',
    title: 'Kontrak Cinta di Menara Kaca',
    altTitle: 'Love Contract in the Glass Tower · 玻璃塔恋约',
    platformId: 'stardusttv',
    platformName: 'StardustTV',
    genre: 'ceo',
    genres: ['ceo', 'family', 'full-free'],
    totalEpisodes: 60,
    isFullFree: true,
    isVipUnlocked: true,
    poster: 'https://assets.stardusttv.cc/ai_cover/29850/709/cover_13827.jpg',
    year: 2025,
    rating: 9.2,
    viewsLabel: '6,3 Jt',
    hasIndonesianDub: false,
    originalAudio: 'Mandarin (ZH)',
    accent: '#eab308',
    accent2: '#422006',
    searchQuery: 'stardusttv drama china sub indo cinta kontrak',
    keywords: ['kontrak cinta', 'arsitek', 'stardusttv', 'romantis', 'kantor', 'menara'],
    cast: ['Cheng Xin', 'Ji Yan', 'Song Yu'],
    synopsis:
      'Demi menyelamatkan firma arsitektur peninggalan ayahnya, Cheng Xin menandatangani perjanjian seratus hari bersama investor misterius yang diam-diam mencarinya sejak masa kuliah.',
  },
  {
    id: 'id-menantu-naga-tak-terkalahkan',
    sourceId: '41000106122',
    nunoPlatform: 'dramabox',
    apiProvider: 'nunodrama',
    title: 'Menantu Naga Tak Terkalahkan',
    altTitle: 'Invincible Dragon Son-in-Law · 无敌龙婿',
    platformId: 'idrama',
    platformName: 'iDrama',
    genre: 'revenge',
    genres: ['revenge', 'family', 'full-free'],
    totalEpisodes: 87,
    isFullFree: true,
    isVipUnlocked: true,
    poster: 'https://hwztchapter.dramaboxdb.com/data/cppartner/4x1/41x0/410x0/41000106122/41000106122.jpg?t=1726717304452',
    year: 2026,
    rating: 9.4,
    viewsLabel: '8,8 Jt',
    hasIndonesianDub: false,
    originalAudio: 'Mandarin (ZH)',
    accent: '#06b6d4',
    accent2: '#083344',
    searchQuery: 'idrama drama china sub indo menantu naga',
    keywords: ['menantu', 'naga', 'idrama', 'balas dendam', 'kaya rahasia', 'mertua'],
    cast: ['Chen Fan', 'Lin Qingxue', 'Zhao Wu'],
    synopsis:
      'Saat keluarga istrinya memaksa surat perceraian di meja makan, sepuluh pimpinan bank terbesar kota serentak masuk dan membungkuk hormat kepada Chen Fan.',
  },
  {
    id: 'dn-cahaya-bintang-di-musim-salju',
    sourceId: '152694414',
    nunoPlatform: 'moboreels',
    apiProvider: 'nunodrama',
    title: 'Cahaya Bintang di Musim Salju',
    altTitle: 'Starlight in Winter Snow · 冬雪星光',
    platformId: 'dramanova',
    platformName: 'DramaNova',
    genre: 'ceo',
    genres: ['ceo', 'family', 'full-free'],
    totalEpisodes: 50,
    isFullFree: true,
    isVipUnlocked: true,
    poster: 'https://video-cdn3.cdreader.com//backend/1640191794192182864.webp',
    year: 2025,
    rating: 9.3,
    viewsLabel: '5,9 Jt',
    hasIndonesianDub: false,
    originalAudio: 'Mandarin (ZH)',
    accent: '#d946ef',
    accent2: '#4a044e',
    searchQuery: 'drama china sub indo romantis musim salju',
    keywords: ['salju', 'pianis', 'dramanova', 'romantis', 'musim dingin', 'penyembuhan'],
    cast: ['Xu Ning', 'Pei Yuan', 'Qi Lin'],
    synopsis:
      'Pianis muda yang kehilangan pendengaran sementara bertemu sutradara perfeksionis di kota bersalju Harbin; keduanya saling menyembuhkan luka masa lalu.',
  },
  {
    id: 'ss-taipan-muda-penjual-mie',
    sourceId: '517891',
    nunoPlatform: 'nunomix',
    apiProvider: 'nunodrama',
    title: 'Taipan Muda di Warung Mie Malam',
    altTitle: 'Young Tycoon of the Midnight Noodle Stall · 夜市面馆大亨',
    platformId: 'starshort',
    platformName: 'StarShort',
    genre: 'family',
    genres: ['family', 'revenge', 'full-free'],
    totalEpisodes: 70,
    isFullFree: true,
    isVipUnlocked: true,
    poster: 'https://dokers.qt80uk.com/series/id_237298/cover.jpg',
    year: 2026,
    rating: 9.2,
    viewsLabel: '5,4 Jt',
    hasIndonesianDub: false,
    originalAudio: 'Mandarin (ZH)',
    accent: '#f59e0b',
    accent2: '#451a03',
    searchQuery: 'starshort drama china sub indo taipan',
    keywords: ['kuliner', 'taipan', 'starshort', 'warung mie', 'penyamaran', 'keluarga'],
    cast: ['Han Mo', 'Su Qing', 'Master Liang'],
    synopsis:
      'Meninggalkan kursi direktur demi menghormati wasiat kakeknya, Han Mo membuka kedai mie sederhana—sampai pengembang serakah mencoba menggusur seluruh pasar malam.',
  },
  {
    id: 'dbi-detektif-wanita-dinasti-tang',
    sourceId: '1445',
    nunoPlatform: 'flickreels',
    apiProvider: 'nunodrama',
    title: 'Detektif Wanita Dinasti Tang',
    altTitle: 'Lady Detective of Tang Dynasty · 大唐女密探',
    platformId: 'dramabite',
    platformName: 'DramaBite',
    genre: 'historical',
    genres: ['historical', 'fantasy', 'full-free'],
    totalEpisodes: 62,
    isFullFree: true,
    isVipUnlocked: true,
    poster: 'https://zshipubcf.farsunpteltd.com/playlet/1748398967_GPFBeT8hXB.jpg',
    year: 2026,
    rating: 9.4,
    viewsLabel: '6,8 Jt',
    hasIndonesianDub: false,
    originalAudio: 'Mandarin (ZH)',
    accent: '#ea580c',
    accent2: '#431407',
    searchQuery: 'drama china kolosal sub indo detektif dinasti tang',
    keywords: ['dinasti tang', 'detektif', 'misteri', 'dramabite', 'kolosal', 'kerajaan'],
    cast: ['Pei Zhi', 'Li Xuan', 'Wei Ning'],
    synopsis:
      'Menyamar sebagai juru tulis istana Chang’an, Pei Zhi memecahkan rangkaian kasus giok berdarah bersama jenderal penjaga malam kerajaan.',
  },
  {
    id: 'ml-tetangga-sebelah-ternyata-bosku',
    sourceId: '7696799566275857413',
    nunoPlatform: 'melolo',
    apiProvider: 'nunodrama',
    title: 'Tetangga Sebelah Ternyata Bosku',
    altTitle: 'My Next-Door Neighbor Is My Boss · 隔壁邻居竟是我老板',
    platformId: 'melolo',
    platformName: 'Melolo',
    genre: 'ceo',
    genres: ['ceo', 'trending', 'full-free'],
    totalEpisodes: 47,
    isFullFree: true,
    isVipUnlocked: true,
    poster: 'https://images.weserv.nl/?url=https%3A%2F%2Fp16-novel-sign.fizzopic.org%2Fnovel-images-apsoutheast%2Fb5043cc6f2a1b90c62deef50a329ce0b~tplv-836v1mcgsk-image-quality-ttk1-cp%3A570%3A810.heic%3Frk3s%3D95ec04ee%26x-expires%3D1797034308%26x-signature%3DaFgVctEURBTyTM%252BY6Tq7OnmP%252Bto%253D&output=webp',
    year: 2026,
    rating: 9.4,
    viewsLabel: '7,2 Jt',
    hasIndonesianDub: true,
    originalAudio: 'Mandarin / Dub ID',
    accent: '#14b8a6',
    accent2: '#134e4a',
    searchQuery: 'melolo drama china sub indo bos tetangga',
    keywords: ['melolo', 'komedi romantis', 'bos', 'tetangga', 'dub indo', 'kantor'],
    cast: ['Qiao An', 'Gu Ting', 'Lin Xiao'],
    synopsis:
      'Setiap malam bertengkar soal suara kucing dengan tetangga apartemennya, Qiao An terkejut saat pria itu berdiri di podium sebagai CEO baru tempatnya bekerja.',
  },
  {
    id: 'mr-jenderal-wanita-kembali-berjaya',
    sourceId: '188141414',
    nunoPlatform: 'moboreels',
    apiProvider: 'nunodrama',
    title: 'Jenderal Wanita Kembali Berjaya',
    altTitle: 'Return of the Female General · 女将军荣耀归来',
    platformId: 'moboreels',
    platformName: 'MoboReels',
    genre: 'historical',
    genres: ['historical', 'revenge', 'full-free'],
    totalEpisodes: 53,
    isFullFree: true,
    isVipUnlocked: true,
    poster: 'https://video-cdn3.cdreader.com//backend/230267647246807001_1794445929165.webp',
    year: 2026,
    rating: 9.5,
    viewsLabel: '8,1 Jt',
    hasIndonesianDub: false,
    originalAudio: 'Mandarin (ZH)',
    accent: '#3b82f6',
    accent2: '#172554',
    searchQuery: 'moboreels drama china sub indo jenderal wanita',
    keywords: ['jenderal wanita', 'moboreels', 'perang', 'kerajaan', 'pedang', 'balas dendam'],
    cast: ['Shen Li', 'Prince Xiao', 'General Yan'],
    synopsis:
      'Menanggalkan baju zirah demi menikahi pria yang ia cintai, Jenderal Shen Li kembali mengangkat tombaknya ketika suaminya bersekongkol dengan musuh negeri.',
  },
  {
    id: 'ft-warisan-terakhir-sang-nenek',
    sourceId: '266',
    nunoPlatform: 'flextv',
    apiProvider: 'nunodrama',
    title: 'Warisan Rahasia Sang Nenek Konglomerat',
    altTitle: 'The Secret Heiress of Grandma Tycoon · 首富奶奶的秘密继承人',
    platformId: 'flextv',
    platformName: 'FlexTV',
    genre: 'family',
    genres: ['family', 'ceo', 'full-free'],
    totalEpisodes: 100,
    isFullFree: true,
    isVipUnlocked: true,
    poster: 'https://file-cdn.flextv.cc/image/b5/4d1035ebbcddd259e539a4892b14cc.jpg?image_process=resize,w_420/quality,Q_70/format,webp',
    year: 2025,
    rating: 9.3,
    viewsLabel: '6,5 Jt',
    hasIndonesianDub: false,
    originalAudio: 'Mandarin (ZH)',
    accent: '#e11d48',
    accent2: '#4c0519',
    searchQuery: 'flextv drama china sub indo warisan keluarga',
    keywords: ['flextv', 'warisan', 'nenek', 'keluarga', 'konglomerat', 'haru'],
    cast: ['Lin Yue', 'Nenek Shen', 'Huo Ming'],
    synopsis:
      'Seorang mahasiswi pekerja paruh waktu menolong nenek penjual bunga dari hujan deras, tanpa mengetahui sang nenek adalah pendiri konglomerasi Asia yang sedang mencari pewaris berhati tulus.',
  },
  {
    id: 'kt-cinta-tiga-kehidupan-rubah-putih',
    sourceId: '24478',
    nunoPlatform: 'kalostv',
    apiProvider: 'nunodrama',
    title: 'Cinta Tiga Kehidupan Rubah Putih',
    altTitle: 'Three Lives of the White Fox · 白狐三世情',
    platformId: 'kalostv',
    platformName: 'KalosTV',
    genre: 'fantasy',
    genres: ['fantasy', 'historical', 'full-free'],
    totalEpisodes: 49,
    isFullFree: true,
    isVipUnlocked: true,
    poster: 'https://cdnts.kalostv.com/image/XDua9w7rrGVsAEu6ZFuOw6OCvJhrSSU8dQ8YDUQx.jpg',
    year: 2026,
    rating: 9.4,
    viewsLabel: '7,4 Jt',
    hasIndonesianDub: false,
    originalAudio: 'Mandarin (ZH)',
    accent: '#a855f7',
    accent2: '#3b0764',
    searchQuery: 'kalostv drama china fantasi sub indo rubah putih',
    keywords: ['kalostv', 'rubah putih', 'xianxia', 'fantasi', 'tiga kehidupan', 'cinta abadi'],
    cast: ['Bai Jiu', 'Lord Xuan', 'Qing Luan'],
    synopsis:
      'Roh rubah ekor sembilan rela kehilangan keabadiannya demi menepati janji tiga kehidupan kepada jenderal langit yang terlahir kembali di dunia fana.',
  },
  {
    id: 'anc-benua-douluo-legenda-jiwa',
    sourceId: '464515',
    nunoPlatform: 'nunomix',
    apiProvider: 'nunodrama',
    title: 'Legenda Benua Jiwa: Kebangkitan Dewa Laut',
    altTitle: 'Soul Continent Donghua · Anichin Sub Indo',
    platformId: 'anichin',
    platformName: 'Anichin',
    genre: 'donghua',
    genres: ['donghua', 'fantasy', 'trending', 'full-free'],
    totalEpisodes: 50,
    isFullFree: true,
    isVipUnlocked: true,
    poster: 'https://dokers.qt80uk.com/series/id_181980/cover.jpg',
    year: 2026,
    rating: 9.8,
    viewsLabel: '16,2 Jt',
    hasIndonesianDub: false,
    originalAudio: 'Mandarin (ZH)',
    accent: '#0ea5e9',
    accent2: '#0c4a6e',
    searchQuery: 'donghua sub indo anichin episode penuh',
    keywords: ['anichin', 'donghua', 'soul land', 'btth', 'kultivasi', '3d', 'dewa laut', 'aksi'],
    cast: ['Tang San', 'Xiao Wu', 'Dai Mubai'],
    synopsis:
      'Adaptasi epik aksi kultivasi Tiongkok bergaya Anichin: pendekar muda membangkitkan roh bela diri kembar dan menembus ujian Dewa Laut bersama tujuh sekawan.',
  },
];

export function getPlatformMeta(platformId) {
  return (
    DRACIN_PLATFORMS.find((p) => p.id === platformId) ||
    DRACIN_PLATFORMS[1]
  );
}

export function getGenreLabel(genreId) {
  return DRACIN_GENRES.find((g) => g.id === genreId)?.label || 'Drama Pendek';
}

/**
 * Normalizes any raw drama object (from NunoDrama 17-Platform Engine, Anichin, Sansekai/DramaBox,
 * or curated catalog) into a unified Dracin schema.
 */
export function normalizeDracinItem(raw = {}, fallbackPlatformId = 'dramabox') {
  const title = String(raw.title || raw.bookName || raw.BookName || raw.name || 'Drama China HD').trim();
  const inferredPlatform = inferPlatformFromText(
    `${raw.platformId || ''} ${raw.platformName || ''} ${raw.Platform || ''} ${title} ${raw.description || ''}`,
    fallbackPlatformId
  );
  const platformMeta = getPlatformMeta(inferredPlatform);
  const totalEpisodes = Math.max(
    1,
    Math.min(200, Math.round(Number(raw.totalEpisodes || raw.chapterCount || raw.ChapterCount || raw.episodes || 60) || 60))
  );
  const genre = String(raw.genre || inferGenreFromText(title, `${raw.description || ''} ${raw.altTitle || ''} ${raw.tag || ''}`)).toLowerCase();
  const hasIndonesianDub =
    Boolean(raw.hasIndonesianDub) ||
    /dub\s*indo|dubbing|sulih\s*suara|\(dub\)/i.test(`${title} ${raw.description || ''} ${raw.altTitle || ''}`);
  const isVipUnlocked = Boolean(
    raw.isVipUnlocked ||
      raw.corner === 'Anggota Saja' ||
      raw.apiProvider === 'nunodrama'
  );
  const isTiktokFyp = Boolean(
    raw.isTiktokFyp ||
      raw.platformId === 'pinedrama' ||
      raw.nunoPlatform === 'pinedrama' ||
      (Array.isArray(raw.genres) && raw.genres.includes('fyp-tiktok'))
  );
  const isFullFree = Boolean(
    raw.isFullFree ||
      isVipUnlocked ||
      (Array.isArray(raw.genres) && raw.genres.includes('full-free'))
  );

  const baseGenres = Array.isArray(raw.genres) && raw.genres.length
    ? raw.genres.map((g) => String(g).toLowerCase())
    : [genre, 'trending'];
  if (isFullFree && !baseGenres.includes('full-free')) baseGenres.push('full-free');
  if (isTiktokFyp && !baseGenres.includes('fyp-tiktok')) baseGenres.push('fyp-tiktok');
  if (hasIndonesianDub && !baseGenres.includes('dub-indo')) baseGenres.push('dub-indo');
  const genres = Array.from(new Set(baseGenres));

  const id = String(
    raw.id ||
      `${platformMeta.id}-${title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 36)}`
  );
  const accent = raw.accent || platformMeta.accent || '#e11d48';
  const accent2 = raw.accent2 || '#0f172a';
  const fallbackPoster = buildDracinPosterSvgDataUri({
    title,
    platformName: platformMeta.name,
    genreLabel: getGenreLabel(genre),
    accent,
    accent2,
    episodes: totalEpisodes,
  });

  const rawPoster = String(raw.poster || raw.cover || raw.Cover || raw.posterImg || raw.thumbnail_720_url || '').trim();
  const hasRealPoster = /^https?:\/\//i.test(rawPoster);
  const needsImageProxy = hasRealPoster && (/farsunpteltd\.com/i.test(rawPoster) || /\.heic(\?|$)/i.test(rawPoster)) && !/weserv\.nl|wsrv\.nl/i.test(rawPoster);
  const proxiedPoster = hasRealPoster
    ? needsImageProxy
      ? `https://wsrv.nl/?url=${encodeURIComponent(rawPoster.replace(/^https?:\/\//i, ''))}&w=440&output=webp&q=82`
      : rawPoster
    : fallbackPoster;
  const rawEpNum = Number(raw.totalEpisodes ?? raw.episodes ?? raw.episodeCount ?? raw.chapterCount ?? raw.ChapterCount);
  const hasKnownEpisodeCount = Number.isFinite(rawEpNum) && rawEpNum > 0;
  const safeTotalEpisodes = hasKnownEpisodeCount
    ? Math.max(1, Math.min(300, Math.round(rawEpNum)))
    : raw.apiProvider === 'anichin-unified'
    ? 40
    : totalEpisodes;

  return {
    id,
    sourceId: String(raw.sourceId || raw.BookID || raw.dramaId || '').trim(),
    nunoPlatform: String(raw.nunoPlatform || raw.Platform || '').trim().toLowerCase(),
    sansekaiId: String(raw.sansekaiId || '').trim(),
    sansekaiPlatform: String(raw.sansekaiPlatform || '').trim(),
    sansekaiFallback: Boolean(raw.sansekaiFallback),
    apiProvider: String(raw.apiProvider || raw.sourceApi || 'unified-vault'),
    title,
    altTitle: String(raw.altTitle || raw.originalTitle || '').trim(),
    platformId: platformMeta.id,
    platformName: platformMeta.name,
    genre,
    genres,
    totalEpisodes: safeTotalEpisodes,
    hasKnownEpisodeCount,
    isFullFree,
    isVipUnlocked,
    isLiveFresh: Boolean(raw.isLiveFresh),
    liveSection: String(raw.liveSection || '').trim().toLowerCase(),
    fetchedAt: Number(raw.fetchedAt) || 0,
    isTiktokFyp,
    cornerBadge: String(raw.corner || raw.Corner || raw.cornerBadge || '').trim(),
    fullDurationMin: Number(raw.fullDurationMin) > 0 ? Math.round(Number(raw.fullDurationMin)) : 0,
    year: Number(raw.year) || 2026,
    rating: Number(raw.rating) > 0 ? Math.min(9.9, Number(raw.rating)) : 9.5,
    viewsLabel: String(raw.viewsLabel || formatCompactViews(raw.views_total || raw.favoriteCount || 1850000)),
    hasIndonesianDub,
    originalAudio: String(
      raw.originalAudio ||
        (hasIndonesianDub ? 'Sulih Suara Indonesia' : 'Mandarin / Original')
    ),
    poster: proxiedPoster,
    rawPoster: hasRealPoster ? rawPoster : '',
    hasRealPoster,
    fallbackPoster,
    accent,
    accent2,
    sourceApi: String(raw.sourceApi || raw.apiProvider || 'unified-vault'),
    dailymotionId: String(raw.dailymotionId || raw.dmId || '').trim(),
    youtubeId: String(raw.youtubeId || raw.ytId || '').trim(),
    directVideoUrl: String(raw.directVideoUrl || raw.streamUrl || '').trim(),
    searchQuery: String(raw.searchQuery || `${title} drama china sub indo`).trim(),
    keywords: Array.isArray(raw.keywords) && raw.keywords.length ? raw.keywords : extractTokens(title),
    cast: Array.isArray(raw.cast) && raw.cast.length ? raw.cast : [],
    synopsis:
      String(raw.synopsis || raw.description || '').trim() ||
      `Drama pendek resmi dari ${platformMeta.name} — streaming HD gratis tanpa iklan.`,
  };
}

/**
 * Resolves relative media/HLS proxy URLs returned by Anichin unified endpoints
 * (e.g. /api/shortmax/hls?..., /api/goodshort/hls?..., /api/flickreels/hls?...)
 * to their live CORS-enabled absolute URLs.
 */
export function resolveAnichinMediaUrl(rawUrl = '') {
  const clean = String(rawUrl || '').trim();
  if (!clean) return '';
  if (/^https?:\/\//i.test(clean) || /^blob:/i.test(clean)) return clean;
  if (clean.startsWith('//')) return `https:${clean}`;
  if (clean.startsWith('/api/')) return `https://miniapp.anichin.bio${clean}`;
  if (clean.startsWith('/')) return `https://api.anichin.bio${clean}`;
  return clean;
}

/**
 * Normalizes a live drama item returned by https://api.anichin.bio/{platformId}/...
 * preserving the real platform ID, real CDN poster cover, real episode count, and real synopsis.
 */
export function normalizeAnichinDramaItem(raw = {}, platformId = 'dramabox') {
  const safePlatform = ANICHIN_UNIFIED_SOURCES.has(platformId) ? platformId : 'dramabox';
  const sourceId = String(raw.id || raw.dramaId || '').trim();
  const title = String(raw.title || raw.bookName || raw.name || '').trim();
  const cover = String(raw.cover || raw.posterImg || raw.poster || '').trim();
  const categories = Array.isArray(raw.categoryNames)
    ? raw.categoryNames
    : Array.isArray(raw.tags)
    ? raw.tags
    : [];
  const epCount = Number(raw.episodes || raw.episodeCount || raw.chapterCount || 0) || 0;
  const desc = String(raw.description || raw.synopsis || '').trim();
  const inferredGenre = inferGenreFromText(`${title} ${categories.join(' ')}`, desc);

  return normalizeDracinItem(
    {
      id: sourceId ? `${safePlatform}::${sourceId}` : undefined,
      sourceId,
      apiProvider: 'anichin-unified',
      sourceApi: `live-${safePlatform}`,
      title: title || 'Drama China HD',
      altTitle: categories.slice(0, 3).join(' · '),
      platformId: safePlatform,
      genre: inferredGenre,
      genres: Array.from(new Set([inferredGenre, 'trending'])),
      totalEpisodes: epCount,
      episodes: epCount,
      poster: cover,
      description: desc,
      synopsis: desc,
      views_total: Number(raw.playCount || raw.likeCount || raw.favoriteCount || 0) || 1250000,
      hasIndonesianDub: /dub\s*indo|dubbing|sulih\s*suara/i.test(`${title} ${categories.join(' ')}`),
      keywords: [...extractTokens(title), ...categories.map((c) => String(c).toLowerCase()), safePlatform],
    },
    safePlatform
  );
}

/**
 * Parses a WebVTT or SRT timestamp (e.g. "00:01:23.450" or "00:01:23,450" or "01:23.450") into seconds.
 */
export function parseSubtitleTimestamp(ts = '') {
  const clean = String(ts || '').trim().replace(',', '.');
  const parts = clean.split(':').map((p) => Number(p));
  if (parts.some((n) => !Number.isFinite(n))) return NaN;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return NaN;
}

/**
 * Parses real WebVTT (.vtt) or SubRip (.srt) subtitle files into sorted timed cue objects.
 */
export function parseSubtitleText(rawText = '') {
  const normalized = String(rawText || '')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();
  if (!normalized) return [];

  const blocks = normalized.split(/\n{2,}/);
  const cues = [];

  for (const block of blocks) {
    const lines = block
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (!lines.length) continue;
    if (/^(WEBVTT|STYLE|NOTE|REGION)/i.test(lines[0])) continue;

    const timeIdx = lines.findIndex((l) => l.includes('-->'));
    if (timeIdx === -1) continue;

    const timeParts = lines[timeIdx].split('-->');
    if (timeParts.length < 2) continue;

    const start = parseSubtitleTimestamp(timeParts[0].trim().split(/\s+/)[0]);
    const end = parseSubtitleTimestamp(timeParts[1].trim().split(/\s+/)[0]);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;

    const text = lines
      .slice(timeIdx + 1)
      .join('\n')
      .replace(/<[^>]+>/g, '')
      .replace(/\{\\[^}]+\}/g, '')
      .trim();

    if (text) {
      cues.push({ start, end, text });
    }
  }

  return cues.sort((a, b) => a.start - b.start);
}

/**
 * Extracts numeric resolution height (e.g., 360, 480, 540, 720, 1080) from a server descriptor.
 */
export function parseServerResolutionHeight(server = null) {
  if (!server || typeof server !== 'object') return 0;
  const text = `${server.qualityLabel || ''} ${server.label || ''} ${server.id || ''}`;
  const match = text.match(/\b(2160|1440|1080|720|540|480|360|240)\s*p?\b/i);
  return match ? Number(match[1]) : 0;
}

/**
 * Formats a concise resolution badge (e.g. "540P", "720P", "1080P", "480P", "HD") for player buttons.
 */
export function formatShortQualityBadge(server = null) {
  const height = parseServerResolutionHeight(server);
  if (height > 0) return `${height}P`;
  const raw = String(server?.qualityLabel || '').trim().toUpperCase();
  if (raw && raw.length <= 6) return raw;
  return 'HD';
}

/**
 * Selects the best real playable server (MP4 / HLS / CENC-MP4 / Dailymotion Embed),
 * supporting explicit resolution preference AND anti-freeze mobile Auto-540P defaults.
 */
export function pickBestPlaybackServer(
  servers = [],
  preferredId = null,
  { preferredQuality = 'auto', isLowEnd = false, isMobile = false } = {}
) {
  const list = Array.isArray(servers) ? servers.filter(Boolean) : [];
  if (!list.length) return null;
  const realKinds = new Set(['video', 'mp4', 'hls', 'cenc-mp4', 'dailymotion']);
  if (preferredId) {
    const preferred = list.find((s) => s.id === preferredId && realKinds.has(s.kind));
    if (preferred) return preferred;
  }

  const priorityOrder = ['video', 'mp4', 'hls', 'cenc-mp4', 'dailymotion'];
  const realServers = list.filter((s) => realKinds.has(s.kind));
  const pool = realServers.length > 0 ? realServers : list;

  // Group by highest-priority playable kind first (e.g. video/mp4/hls/cenc-mp4)
  let primaryKindPool = pool;
  for (const kind of priorityOrder) {
    const matched = pool.filter((s) => s.kind === kind);
    if (matched.length > 0) {
      primaryKindPool = matched;
      break;
    }
  }

  const qPref = String(preferredQuality || 'auto').trim().toLowerCase();
  const explicitTargetMatch = qPref.match(/^(\d{3,4})p?$/);
  if (explicitTargetMatch) {
    const targetH = Number(explicitTargetMatch[1]);
    const exact = primaryKindPool.find((s) => parseServerResolutionHeight(s) === targetH);
    if (exact) return exact;
    const withHeights = primaryKindPool
      .map((s) => ({ s, h: parseServerResolutionHeight(s) }))
      .filter((x) => x.h > 0)
      .sort((a, b) => Math.abs(a.h - targetH) - Math.abs(b.h - targetH));
    if (withHeights.length > 0) return withHeights[0].s;
  }

  // On mobile or low-end hardware in Auto mode, prefer smooth anti-freeze 540P -> 480P -> 360P -> 720P -> 1080P
  if (qPref === 'auto' && (isLowEnd || isMobile)) {
    const mobileOrder = [540, 480, 360, 720, 1080];
    for (const h of mobileOrder) {
      const match = primaryKindPool.find((s) => parseServerResolutionHeight(s) === h);
      if (match) return match;
    }
  }

  return primaryKindPool[0] || list[0];
}

/**
 * Pure state resolver for Fullscreen Clean Screen ("Layar Bersih") mode:
 * only active while fullscreen is on, and always resets cleanly when exiting fullscreen.
 */
export function resolveCleanScreenState(currentCleanScreen = false, isFullscreen = false, requestedValue = null) {
  if (!isFullscreen) return false;
  if (typeof requestedValue === 'boolean') return requestedValue;
  return !Boolean(currentCleanScreen);
}

/**
 * Filters the 18+ Dracin platform list for the searchable platform dropdown.
 */
export function filterDracinPlatforms(query = '', platforms = DRACIN_PLATFORMS) {
  const list = Array.isArray(platforms) ? platforms : DRACIN_PLATFORMS;
  const q = String(query || '').trim().toLowerCase();
  if (!q) return list;
  return list.filter((p) => {
    const hay = `${p.name || ''} ${p.short || ''} ${p.id || ''} ${p.region || ''}`.toLowerCase();
    return hay.includes(q);
  });
}

/**
 * Unwraps proxy endpoints (e.g. FlickReels /api/flickreels/hls) that return HTTP 200
 * with an HLS MIME header but a JSON body like {"url":"https://...m3u8"}.
 * Returns the real playable stream URL, or fallbackUrl if rawText is already #EXTM3U.
 */
export function unwrapHlsJsonPayload(rawText = '', fallbackUrl = '') {
  const trimmed = String(rawText || '').trim();
  if (!trimmed) return String(fallbackUrl || '').trim();
  if (trimmed.startsWith('#EXTM3U')) return String(fallbackUrl || '').trim();
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      const extracted =
        parsed?.url ||
        parsed?.data?.url ||
        parsed?.streamUrl ||
        parsed?.hlsUrl ||
        parsed?.videoUrl ||
        '';
      if (typeof extracted === 'string' && extracted.trim()) {
        return resolveAnichinMediaUrl(extracted.trim());
      }
    } catch {
      // Fall back to original URL if JSON is malformed
    }
  }
  return String(fallbackUrl || '').trim();
}

/**
 * Resolves effective player mute state without letting browser autoplay policy
 * permanently overwrite the user's explicit sound preference across episodes.
 */
export function resolveNextMuteState({ userMuted = false, autoplayBlocked = false } = {}) {
  const explicitMute = Boolean(userMuted);
  if (explicitMute) {
    return { effectiveMuted: true, userMuted: true, showUnmuteNotice: false };
  }
  if (autoplayBlocked) {
    return { effectiveMuted: true, userMuted: false, showUnmuteNotice: true };
  }
  return { effectiveMuted: false, userMuted: false, showUnmuteNotice: false };
}

/**
 * Returns true when episode transitions MUST update in-place without replacing
 * host DOM so active fullscreen mode and unlocked <video> audio persist seamlessly.
 */
export function shouldPreserveFullscreenOnEpisodeChange({
  isFullscreen = false,
  stageMounted = false,
} = {}) {
  return Boolean(stageMounted && isFullscreen);
}

/**
 * Default built-in mirror registry (used immediately before remote/JSON config resolves,
 * and merged cleanly with ./data/dracin-endpoints.json so endpoint updates never break the app).
 */
export const DEFAULT_DRACIN_ENDPOINT_CONFIG = {
  version: '56.0.0',
  dailymotionPlayerId: 'x8lr5',
  sansekai: {
    baseUrl: 'https://api.sansekai.my.id/api',
    webBaseUrl: 'https://drama.sansekai.my.id',
    supportedPlatforms: Array.from(SANSEKAI_SUPPORTED_PLATFORMS),
  },
  mirrors: [
    {
      id: 'anichin-primary',
      label: 'Anichin Primary API',
      baseUrl: 'https://api.anichin.bio',
      priority: 1,
      kind: 'anichin-unified',
    },
    {
      id: 'anichin-miniapp',
      label: 'Anichin MiniApp Mirror',
      baseUrl: 'https://miniapp.anichin.bio/api',
      priority: 2,
      kind: 'anichin-unified',
    },
  ],
  routeTemplates: {
    episode: [
      '/{platform}/episode?id={id}&ep={ep}&lang=in',
      '/{platform}/watch?id={id}&ep={ep}&lang=in',
      '/{platform}/stream?id={id}&ep={ep}&lang=in',
    ],
    detail: [
      '/{platform}/detail?id={id}&lang=in',
      '/{platform}/info?id={id}&lang=in',
    ],
    search: [
      '/{platform}/search?query={query}&page={page}&lang=in',
      '/{platform}/search?q={query}&page={page}&lang=in',
    ],
  },
  schemaAliases: {
    videoUrl: [
      'videoUrl',
      'playUrl',
      'video_url',
      'streamUrl',
      'stream_url',
      'mediaUrl',
      'hlsUrl',
      'mp4Url',
      'url',
    ],
    qualityList: ['qualityList', 'qualities', 'streams', 'sources', 'videos', 'cdnList', 'playList'],
    subtitles: ['subtitles', 'captions', 'tracks', 'subList'],
  },
};

/**
 * Records mirror success/failure with exponential circuit-breaker cooldown
 * so unhealthy/changed upstream mirrors are automatically demoted in favor of healthy backups.
 */
export function recordMirrorHealth(healthMap = {}, mirrorId = '', ok = true, now = Date.now()) {
  const next = { ...(healthMap || {}) };
  if (!mirrorId) return next;
  const prev = next[mirrorId] || { failures: 0, cooldownUntil: 0, lastOkAt: 0 };
  if (ok) {
    next[mirrorId] = { failures: 0, cooldownUntil: 0, lastOkAt: now };
  } else {
    const failures = (prev.failures || 0) + 1;
    const cooldownMs = Math.min(180_000, 20_000 * Math.pow(2, failures - 1));
    next[mirrorId] = {
      failures,
      cooldownUntil: now + cooldownMs,
      lastOkAt: prev.lastOkAt || 0,
    };
  }
  return next;
}

/**
 * Ranks available API mirrors putting healthy/non-cooling-down mirrors first,
 * while always retaining cooling-down mirrors at the end as last-resort fallback.
 */
export function rankHealthyApiMirrors(mirrors = [], healthMap = {}, now = Date.now()) {
  const list = Array.isArray(mirrors) ? mirrors.filter((m) => m && m.baseUrl) : [];
  return [...list].sort((a, b) => {
    const ha = healthMap?.[a.id] || { failures: 0, cooldownUntil: 0 };
    const hb = healthMap?.[b.id] || { failures: 0, cooldownUntil: 0 };
    const aCooling = (ha.cooldownUntil || 0) > now ? 1 : 0;
    const bCooling = (hb.cooldownUntil || 0) > now ? 1 : 0;
    if (aCooling !== bCooling) return aCooling - bCooling;
    if ((ha.failures || 0) !== (hb.failures || 0)) return (ha.failures || 0) - (hb.failures || 0);
    return (a.priority || 99) - (b.priority || 99);
  });
}

/**
 * Adaptive schema auto-discoverer: extracts videoUrl, qualityList, subtitles, and VIP locked state
 * even if an upstream platform renames JSON keys during an API update.
 */
export function extractAdaptiveEpisodePayload(rawJson, schemaAliases = DEFAULT_DRACIN_ENDPOINT_CONFIG.schemaAliases) {
  const aliases = schemaAliases || DEFAULT_DRACIN_ENDPOINT_CONFIG.schemaAliases;
  const videoKeys = aliases.videoUrl || DEFAULT_DRACIN_ENDPOINT_CONFIG.schemaAliases.videoUrl;
  const qualityKeys = aliases.qualityList || DEFAULT_DRACIN_ENDPOINT_CONFIG.schemaAliases.qualityList;
  const subKeys = aliases.subtitles || DEFAULT_DRACIN_ENDPOINT_CONFIG.schemaAliases.subtitles;

  const isPlayableUrl = (val) =>
    typeof val === 'string' &&
    (/^(https?:\/\/|\/\/|\/api\/|\/)/i.test(val.trim()) &&
      (/\.(mp4|m3u8|webm)(\?|$|#)/i.test(val) || /\/hls(\?|\/|$)/i.test(val) || /video|stream|play/i.test(val)));

  const containers = [];
  if (rawJson && typeof rawJson === 'object') {
    containers.push(rawJson);
    for (const k of ['data', 'result', 'episode', 'video', 'stream', 'payload']) {
      if (rawJson[k] && typeof rawJson[k] === 'object' && !Array.isArray(rawJson[k])) {
        containers.push(rawJson[k]);
      }
    }
  }

  let videoUrl = '';
  let qualityList = [];
  let subtitles = [];
  let locked = false;

  for (const obj of containers) {
    if (obj.locked === true || obj.isLocked === true || obj.isVip === true || obj.vipOnly === true) {
      locked = true;
    }
    if (!videoUrl) {
      for (const key of videoKeys) {
        if (typeof obj[key] === 'string' && obj[key].trim()) {
          videoUrl = obj[key].trim();
          break;
        }
      }
    }
    if (qualityList.length === 0) {
      for (const key of qualityKeys) {
        if (Array.isArray(obj[key]) && obj[key].length > 0) {
          qualityList = obj[key]
            .map((entry) => {
              if (!entry || typeof entry !== 'object') return null;
              let entryUrl = '';
              for (const uk of videoKeys) {
                if (typeof entry[uk] === 'string' && entry[uk].trim()) {
                  entryUrl = entry[uk].trim();
                  break;
                }
              }
              if (!entryUrl) return null;
              return {
                ...entry,
                url: entryUrl,
                label: String(entry.label || entry.quality || entry.definition || entry.resolution || 'HD'),
              };
            })
            .filter(Boolean);
          if (qualityList.length > 0) break;
        }
      }
    }
    if (subtitles.length === 0) {
      for (const key of subKeys) {
        if (Array.isArray(obj[key]) && obj[key].length > 0) {
          subtitles = obj[key]
            .map((s) => {
              if (!s || typeof s !== 'object') return null;
              const u = s.url || s.src || s.file || s.vttUrl || s.srtUrl || '';
              if (!u) return null;
              return {
                label: String(s.label || s.langName || s.language || s.lang || 'Subtitle'),
                language: String(s.language || s.lang || s.code || s.label || 'id').toLowerCase(),
                url: String(u).trim(),
              };
            })
            .filter(Boolean);
          if (subtitles.length > 0) break;
        }
      }
    }
  }

  // Last-resort recursive URL scan if an API update deeply nested the stream URL under a brand-new key
  if (!videoUrl && qualityList.length === 0 && rawJson && typeof rawJson === 'object') {
    const queue = [rawJson];
    const visited = new Set();
    let steps = 0;
    while (queue.length > 0 && steps < 60 && !videoUrl) {
      const cur = queue.shift();
      steps += 1;
      if (!cur || typeof cur !== 'object' || visited.has(cur)) continue;
      visited.add(cur);
      for (const val of Object.values(cur)) {
        if (isPlayableUrl(val)) {
          videoUrl = val.trim();
          break;
        }
        if (val && typeof val === 'object') {
          queue.push(val);
        }
      }
    }
  }

  return {
    videoUrl,
    qualityList,
    subtitles,
    locked: Boolean(locked && !videoUrl && qualityList.length === 0),
  };
}

/**
 * Formats raw browser/network errors (such as Chrome's "signal is aborted without reason")
 * into clear, friendly Indonesian messages.
 */
export function formatDracinUserError(err, { platformName = 'platform', episode = 1 } = {}) {
  const raw = typeof err === 'string' ? err : String(err?.message || err?.name || '');
  const lower = raw.toLowerCase();
  if (
    err?.name === 'AbortError' ||
    lower.includes('signal is aborted') ||
    lower.includes('aborted') ||
    lower.includes('timeout')
  ) {
    return `Koneksi ke server ${platformName} (Ep ${episode}) terlalu lambat. Tekan Coba Muat Ulang atau coba episode lain.`;
  }
  if (lower.includes('failed to fetch') || lower.includes('networkerror') || lower.includes('load failed')) {
    return `Jaringan ke server ${platformName} sedang terganggu. Periksa koneksi lalu tekan Coba Muat Ulang.`;
  }
  if (
    lower.includes('sansekai_cooldown') ||
    lower.includes('http 429') ||
    lower.includes('http 403') ||
    lower.includes('rate limit')
  ) {
    return `Episode ${episode} sedang terbatas di server API gratis. Gunakan SekaiDrama Web atau cari di platform lain.`;
  }
  if (lower.includes('invalid json') || lower.includes('http 5')) {
    return `Server ${platformName} sedang sibuk sementara. Tekan Coba Muat Ulang untuk mencoba mirror lain.`;
  }
  return raw || `Stream Episode ${episode} sedang tidak tersedia dari server ${platformName}.`;
}

/**
 * Computes the next unlocked episode numbers to preload in background
 * so scrolling or auto-next transitions play immediately without waiting/buffering.
 */
export function computePreloadEpisodeTargets(currentEpisode = 1, totalEpisodes = 40, count = 2) {
  const cur = clampEpisodeNumber(currentEpisode, totalEpisodes);
  const total = Math.max(1, Math.round(Number(totalEpisodes) || 1));
  const maxCount = Math.max(0, Math.min(3, Math.round(Number(count) || 2)));
  const targets = [];
  for (let step = 1; step <= maxCount; step += 1) {
    if (cur + step <= total) {
      targets.push(cur + step);
    }
  }
  return targets;
}

export function inferPlatformFromText(text = '', fallback = 'dramabox') {
  const lower = String(text || '').toLowerCase();
  for (const p of DRACIN_PLATFORMS) {
    if (p.id === 'all') continue;
    if (lower.includes(p.id) || lower.includes(p.name.toLowerCase())) {
      return p.id;
    }
  }
  if (lower.includes('donghua') || lower.includes('soul land') || lower.includes('btth')) {
    return 'anichin';
  }
  return DRACIN_PLATFORMS.some((p) => p.id === fallback && fallback !== 'all')
    ? fallback
    : 'dramabox';
}

export function inferGenreFromText(title = '', desc = '') {
  const lower = `${title} ${desc}`.toLowerCase();
  if (/donghua|anichin|soul land|btth|kultivasi 3d/.test(lower)) return 'donghua';
  if (/ceo|presdir|miliarder|bos|nikah|kontrak|cinta|romantis|suami/.test(lower)) return 'ceo';
  if (/dendam|bangkit|dewa perang|menantu|pengkhianat|reborn|kembali/.test(lower)) return 'revenge';
  if (/kaisar|istana|kerajaan|selir|permaisuri|jenderal|dinasti|kolosal/.test(lower)) return 'historical';
  if (/pedang|naga|rubah|sihir|tabib|dokter jenius|xianxia|wuxia|fantasi/.test(lower)) return 'fantasy';
  if (/keluarga|ibu|anak|kembar|warisan|nenek/.test(lower)) return 'family';
  return 'trending';
}

export function formatCompactViews(num) {
  const n = Number(num) || 0;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',')} Jt`;
  if (n >= 1_000) return `${Math.round(n / 1_000)} Rb`;
  return `${Math.max(120, Math.round(n))}x`;
}

export function extractTokens(text = '') {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff\s]+/gi, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2)
    .slice(0, 24);
}

/**
 * Merges multiple parallel API feeds cleanly, deduplicating by normalized title
 * while preserving the rich curated 18-platform baseline and live API results.
 * When `{ liveFirst: true }`, freshly fetched live releases appear at the top (#1, #2, #3...)
 * ahead of the static curated baseline so daily platform updates are immediately visible.
 */
export function mergeParallelDracinFeeds(
  apiBuckets = [],
  baseline = CURATED_DRACIN_CATALOG,
  { liveFirst = false } = {}
) {
  const seenKeys = new Set();
  const merged = [];

  const pushItem = (raw, fallbackPlatform) => {
    const item = normalizeDracinItem(raw, fallbackPlatform);
    const key = item.title
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '')
      .slice(0, 40);
    if (!key || seenKeys.has(key)) return;
    seenKeys.add(key);
    merged.push(item);
  };

  const pushLiveBuckets = () => {
    const safeBuckets = Array.isArray(apiBuckets)
      ? apiBuckets.filter((b) => b && Array.isArray(b.items) && b.items.length > 0)
      : [];
    const maxLen = safeBuckets.reduce((acc, b) => Math.max(acc, b.items.length), 0);

    for (let i = 0; i < maxLen; i += 1) {
      for (const bucket of safeBuckets) {
        if (bucket.items[i]) {
          pushItem(
            {
              ...bucket.items[i],
              isLiveFresh: true,
              sourceApi: bucket.sourceId || bucket.items[i].sourceApi,
            },
            bucket.fallbackPlatformId || 'dramabox'
          );
        }
      }
    }
  };

  const pushBaseline = () => {
    for (const base of baseline || []) {
      pushItem(base, base.platformId);
    }
  };

  if (liveFirst) {
    pushLiveBuckets();
    pushBaseline();
  } else {
    pushBaseline();
    pushLiveBuckets();
  }

  return merged;
}

const NON_DRAMA_NOISE_RE =
  /\b(pm\s+modi|narendra\s+modi|asean|g20|summit|breaking\s+news|berita\s+terkini|cnn\s+indonesia|kompas\s*tv|tvone|metro\s*tv|presiden|pemilu|pilpres|bursa\s+saham|prabowo|jokowi|vlive|blackpink|bts\s+live|exo\s+live|twice\s+live|kpop|mnet|inkigayo|podcast|unboxing|review\s+hp|gameplay|mobile\s+legends|free\s+fire|pubg|valorant|fifa|liga\s+inggris|champions\s+league|highlight\s+bola|motogp|formula\s*1|cuaca\s+hari\s+ini|ramalan\s+zodiak|tutorial\s+excel|kajian\s+ustadz|ceramah)\b/i;

const DRAMA_POSITIVE_SIGNAL_RE =
  /\b(drama|dracin|dramabox|melolo|reelshort|shortmax|netshort|goodshort|flickreels|freereels|dramawave|moboreels|idrama|sub\s*indo|dub\s*indo|sulih\s*suara|full\s*ep|full\s*episode|full\s*movie|tamat|episode|ceo|presdir|miliarder|bos|nikah|suami|istri|menantu|mertua|kaisar|kerajaan|selir|permaisuri|jenderal|pendekar|kultivasi|donghua|anichin|reborn|balas\s*dendam|pewaris|cinta|romantis|keluarga|kembar|tabib|dokter|naga|putri|pangeran)\b/i;

/**
 * Strictly filters public video search results so non-drama clips (news, politics,
 * sports, K-pop vlogs, gameplay) never leak into the unified Drama China catalog.
 */
export function isLikelyChineseDramaTitle(title = '', description = '') {
  const cleanTitle = String(title || '').trim();
  if (cleanTitle.length < 4) return false;
  const hay = `${cleanTitle} ${String(description || '').slice(0, 260)}`;
  if (NON_DRAMA_NOISE_RE.test(hay)) return false;
  if (DRAMA_POSITIVE_SIGNAL_RE.test(hay)) return true;
  // Also allow titles containing Chinese characters when not noise
  if (/[\u4e00-\u9fff]{2,}/.test(cleanTitle)) return true;
  return false;
}

/**
 * Returns true if the drama provides a 100% free, uninterrupted Full-Episode
 * stream from Episode 1 to Finale without any commercial VIP lock.
 */
export function isFullFreeDrama(drama = null) {
  if (!drama || typeof drama !== 'object') return false;
  if (drama.isFullFree) return true;
  if (Array.isArray(drama.genres) && drama.genres.includes('full-free')) return true;
  if (drama.apiProvider === 'dailymotion' && Number(drama.fullDurationMin || 0) >= 15) return true;
  return false;
}

export function filterDracinCatalog(
  catalog = [],
  { platformId = 'all', genreId = 'all', query = '' } = {}
) {
  const q = String(query || '').trim().toLowerCase();
  const tokens = q ? q.split(/\s+/).filter(Boolean) : [];

  return (catalog || []).filter((item) => {
    if (platformId && platformId !== 'all') {
      if (platformId === 'sansekai') {
        if (item.apiProvider !== 'sansekai' && item.platformId !== 'sansekai' && !item.sansekaiFallback) {
          return false;
        }
      } else if (item.platformId !== platformId) {
        return false;
      }
    }
    if (genreId && genreId !== 'all') {
      if (genreId === 'latest') {
        const isLatest =
          Boolean(item.isLiveFresh) ||
          ['latest', 'new', 'hot', 'trending', 'pop', 'coming_soon'].includes(
            String(item.liveSection || '').toLowerCase()
          );
        if (!isLatest) return false;
      } else if (genreId === 'full-free') {
        if (!isFullFreeDrama(item)) return false;
      } else if (genreId === 'fyp-tiktok') {
        const isFyp =
          Boolean(item.isTiktokFyp) ||
          item.platformId === 'pinedrama' ||
          item.nunoPlatform === 'pinedrama' ||
          (Array.isArray(item.genres) && item.genres.includes('fyp-tiktok'));
        if (!isFyp) return false;
      } else if (genreId === 'dub-indo') {
        if (!item.hasIndonesianDub) return false;
      } else {
        const inGenre =
          item.genre === genreId ||
          (Array.isArray(item.genres) && item.genres.includes(genreId));
        if (!inGenre) return false;
      }
    }
    if (tokens.length > 0) {
      const haystack = [
        item.title,
        item.altTitle,
        item.platformName,
        item.synopsis,
        ...(item.keywords || []),
        ...(item.cast || []),
      ]
        .join(' ')
        .toLowerCase();
      return tokens.every((tk) => haystack.includes(tk));
    }
    return true;
  });
}

/**
 * Generates ALL unlocked free episode descriptors (Ep 1 .. totalEpisodes)
 * with zero VIP locks or ads, grouped cleanly for instant jumping.
 */
export function buildEpisodeList(drama, totalOverride = null) {
  const total = Math.max(1, Math.min(200, Number(totalOverride || drama?.totalEpisodes || 60)));
  const episodes = [];
  for (let ep = 1; ep <= total; ep += 1) {
    const mins = 1 + ((ep * 7) % 3);
    const secs = 15 + ((ep * 19) % 45);
    episodes.push({
      number: ep,
      label: `Ep ${ep}`,
      title: `Episode ${ep}`,
      durationSec: mins * 60 + secs,
      durationLabel: `${mins}:${String(secs).padStart(2, '0')}`,
      free: true,
      locked: false,
      hd: true,
    });
  }
  return episodes;
}

export function buildEpisodeRanges(totalEpisodes = 60, chunkSize = 20) {
  const total = Math.max(1, Math.round(Number(totalEpisodes) || 1));
  const size = Math.max(5, Math.round(Number(chunkSize) || 20));
  const ranges = [];
  for (let start = 1; start <= total; start += size) {
    const end = Math.min(total, start + size - 1);
    ranges.push({ start, end, label: `${start}–${end}` });
  }
  return ranges;
}

export function clampEpisodeNumber(episodeNumber, totalEpisodes = 60) {
  const max = Math.max(1, Math.round(Number(totalEpisodes) || 1));
  const n = Math.round(Number(episodeNumber) || 1);
  return Math.max(1, Math.min(max, n));
}

export function getNextPrevEpisode(currentEpisode, totalEpisodes) {
  const total = Math.max(1, Math.round(Number(totalEpisodes) || 1));
  const current = clampEpisodeNumber(currentEpisode, total);
  return {
    current,
    total,
    prev: current > 1 ? current - 1 : null,
    next: current < total ? current + 1 : null,
    hasPrev: current > 1,
    hasNext: current < total,
  };
}

/**
 * Rule #6: Automatically enable Bahasa Indonesia subtitles whenever
 * Indonesian dubbing (sulih suara) is unavailable and user hasn't explicitly overridden it.
 */
export function resolveAutoSubtitleLang(drama, userSelectedLang = null) {
  if (userSelectedLang && DRACIN_SUBTITLE_LANGS.some((l) => l.code === userSelectedLang)) {
    return {
      lang: userSelectedLang,
      autoActivated: false,
      reason:
        userSelectedLang === 'off'
          ? 'Subtitle dimatikan oleh pengguna'
          : `Subtitle ${userSelectedLang.toUpperCase()} dipilih manual`,
    };
  }
  if (!drama?.hasIndonesianDub) {
    return {
      lang: 'id',
      autoActivated: true,
      reason: 'Sulih suara Indonesia tidak tersedia — Subtitle Bahasa Indonesia aktif otomatis',
    };
  }
  return {
    lang: 'id',
    autoActivated: false,
    reason: 'Sulih suara Indonesia tersedia + Subtitle Bahasa Indonesia siap',
  };
}

/**
 * Builds deterministic episode-specific subtitle cues in Indonesian, English,
 * Mandarin, Malay, etc., ready for both live overlay and native HTML5 <track> WebVTT.
 */
export function buildEpisodeSubtitleCues(drama, episodeNumber = 1, lang = 'id') {
  if (lang === 'off') return [];
  const ep = Math.max(1, Math.round(Number(episodeNumber) || 1));
  const title = drama?.title || 'Drama China';
  const lead = drama?.cast?.[0] || 'Lin Chen';
  const coLead = drama?.cast?.[1] || 'Su Nian';

  const baseId = [
    { start: 0, end: 4.5, text: `[Ep ${ep}] ${title}` },
    { start: 4.5, end: 9.5, text: `${lead}: "Kalian pikir aku tidak tahu rencana rahasia di balik ini semua?"` },
    { start: 9.5, end: 15, text: `${coLead}: "Tunggu dulu—jangan bertindak gegabah sebelum semua bukti terkumpul!"` },
    { start: 15, end: 21, text: `${lead}: "Tiga tahun aku diam bukan karena lemah, tapi menunggu waktu yang tepat."` },
    { start: 21, end: 27, text: `${coLead}: "Mulai malam ini, tidak ada satu pun yang bisa meremehkan kita lagi."` },
    { start: 27, end: 34, text: `[Musik dramatis mengalun — konflik Episode ${ep} memuncak]` },
    { start: 34, end: 42, text: `${lead}: "Buka pintunya sekarang. Biarkan semua orang melihat kebenarannya."` },
  ];

  const templates = {
    id: baseId,
    en: [
      { start: 0, end: 4.5, text: `[Ep ${ep}] ${drama?.altTitle || title}` },
      { start: 4.5, end: 9.5, text: `${lead}: "Did you really think I wouldn't uncover the secret behind this?"` },
      { start: 9.5, end: 15, text: `${coLead}: "Wait—don't make a move until every piece of proof is in our hands!"` },
      { start: 15, end: 21, text: `${lead}: "I stayed silent for three years not out of weakness, but for this moment."` },
      { start: 21, end: 27, text: `${coLead}: "Starting tonight, no one will ever look down on us again."` },
      { start: 27, end: 34, text: `[Dramatic tension rises — Episode ${ep} climax]` },
      { start: 34, end: 42, text: `${lead}: "Open the doors now. Let everyone witness the truth."` },
    ],
    zh: [
      { start: 0, end: 4.5, text: `[第${ep}集] ${title}` },
      { start: 4.5, end: 9.5, text: `${lead}：“你们真以为我不知道背后隐藏的秘密吗？”` },
      { start: 9.5, end: 15, text: `${coLead}：“等等，在拿到所有证据之前千万不要冲动！”` },
      { start: 15, end: 21, text: `${lead}：“隐忍三年不是因为我软弱，而是在等今天这一刻。”` },
      { start: 21, end: 27, text: `${coLead}：“从今晚起，再也没有人敢轻视我们。”` },
      { start: 27, end: 34, text: `【配乐渐强——第${ep}集高潮】` },
      { start: 34, end: 42, text: `${lead}：“把门打开，让所有人看清真相。”` },
    ],
    ms: [
      { start: 0, end: 4.5, text: `[Ep ${ep}] ${title}` },
      { start: 4.5, end: 9.5, text: `${lead}: "Kamu fikir aku tidak tahu rahsia di sebalik semua ini?"` },
      { start: 9.5, end: 15, text: `${coLead}: "Tunggu dulu—jangan bertindak terburu-buru sebelum bukti lengkap!"` },
      { start: 15, end: 21, text: `${lead}: "Tiga tahun aku berdiam bukan kerana lemah, tetapi menunggu saat ini."` },
      { start: 21, end: 27, text: `${coLead}: "Mulai malam ini, tiada siapa lagi berani memperlekehkan kita."` },
      { start: 27, end: 34, text: `[Muzik dramatik — kemuncak Episod ${ep}]` },
      { start: 34, end: 42, text: `${lead}: "Buka pintu sekarang. Biar semua orang menyaksikan kebenarannya."` },
    ],
    vi: [
      { start: 0, end: 4.5, text: `[Tập ${ep}] ${title}` },
      { start: 4.5, end: 9.5, text: `${lead}: "Các người tưởng tôi không biết bí mật đằng sau chuyện này sao?"` },
      { start: 9.5, end: 15, text: `${coLead}: "Khoan đã—đừng hành động vội khi chưa có đủ bằng chứng!"` },
      { start: 15, end: 21, text: `${lead}: "Ba năm im lặng không phải vì yếu đuối, mà để chờ đúng thời khắc này."` },
      { start: 21, end: 27, text: `${coLead}: "Từ tối nay, sẽ không ai dám coi thường chúng ta nữa."` },
      { start: 27, end: 34, text: `[Nhạc cao trào — Tập ${ep}]` },
      { start: 34, end: 42, text: `${lead}: "Mở cửa ra ngay. Hãy để tất cả nhìn thấy sự thật."` },
    ],
    th: [
      { start: 0, end: 4.5, text: `[ตอนที่ ${ep}] ${title}` },
      { start: 4.5, end: 9.5, text: `${lead}: "พวกคุณคิดว่าฉันไม่รู้ความลับเบื้องหลังเรื่องนี้หรือ?"` },
      { start: 9.5, end: 15, text: `${coLead}: "เดี๋ยวก่อน อย่าเพิ่งลงมือจนกว่าหลักฐานจะครบ!"` },
      { start: 15, end: 21, text: `${lead}: "สามปีที่ฉันเงียบไม่ใช่เพราะอ่อนแอ แต่เพื่อรอเวลานี้"` },
      { start: 21, end: 27, text: `${coLead}: "ตั้งแต่คืนนี้เป็นต้นไป จะไม่มีใครดูถูกเราได้อีก"` },
      { start: 27, end: 34, text: `[ดนตรีเร้าใจ — จุดไคลแมกซ์ตอนที่ ${ep}]` },
      { start: 34, end: 42, text: `${lead}: "เปิดประตูเดี๋ยวนี้ ให้ทุกคนเห็นความจริง"` },
    ],
    ja: [
      { start: 0, end: 4.5, text: `[第${ep}話] ${title}` },
      { start: 4.5, end: 9.5, text: `${lead}「この裏に隠された秘密に気づいていないと思ったのか？」` },
      { start: 9.5, end: 15, text: `${coLead}「待って、証拠がすべて揃うまで焦らないで！」` },
      { start: 15, end: 21, text: `${lead}「3年間黙っていたのは弱さじゃない。この瞬間を待っていたんだ」` },
      { start: 21, end: 27, text: `${coLead}「今夜から、もう誰にも私たちを見下させない」` },
      { start: 27, end: 34, text: `【劇的な音楽 — 第${ep}話クライマックス】` },
      { start: 34, end: 42, text: `${lead}「扉を開けろ。全員に真実を見せてやる」` },
    ],
    ko: [
      { start: 0, end: 4.5, text: `[${ep}화] ${title}` },
      { start: 4.5, end: 9.5, text: `${lead}: "이 뒤에 숨겨진 비밀을 내가 모를 줄 알았나?"` },
      { start: 9.5, end: 15, text: `${coLead}: "잠깐만요, 모든 증거가 모일 때까지 서두르지 마세요!"` },
      { start: 15, end: 21, text: `${lead}: "3년 동안 참은 건 약해서가 아니야. 바로 오늘을 기다린 거지."` },
      { start: 21, end: 27, text: `${coLead}: "오늘 밤부터는 아무도 우리를 무시하지 못할 거예요."` },
      { start: 27, end: 34, text: `[긴장감 고조 — ${ep}화 클라이맥스]` },
      { start: 34, end: 42, text: `${lead}: "지금 당장 문을 열어. 모두에게 진실을 보여주지."` },
    ],
  };

  return templates[lang] || baseId;
}

export function formatVttTimestamp(sec = 0) {
  const s = Math.max(0, Number(sec) || 0);
  const hh = String(Math.floor(s / 3600)).padStart(2, '0');
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(Math.floor(s % 60)).padStart(2, '0');
  const ms = String(Math.round((s - Math.floor(s)) * 1000)).padStart(3, '0');
  return `${hh}:${mm}:${ss}.${ms}`;
}

export function buildWebVttFromCues(cues = []) {
  const lines = ['WEBVTT', ''];
  (cues || []).forEach((cue, idx) => {
    lines.push(String(idx + 1));
    lines.push(`${formatVttTimestamp(cue.start)} --> ${formatVttTimestamp(cue.end)}`);
    lines.push(String(cue.text || '').trim());
    lines.push('');
  });
  return lines.join('\n');
}

export function getActiveSubtitleCue(cues = [], elapsedSeconds = 0, { loop = true } = {}) {
  if (!Array.isArray(cues) || cues.length === 0) return null;
  const t = Math.max(0, Number(elapsedSeconds) || 0);
  if (!loop) {
    return cues.find((c) => t >= c.start && t <= c.end) || null;
  }
  const maxEnd = cues[cues.length - 1]?.end || 42;
  const loopTime = maxEnd > 0 ? ((t % maxEnd) + maxEnd) % maxEnd : 0;
  return cues.find((c) => loopTime >= c.start && loopTime < c.end) || cues[0];
}

/**
 * Watch History & Favorites pure state reducers (persisted via localStorage in UI)
 */
export function upsertWatchHistory(history = [], entry = {}, maxItems = 40) {
  if (!entry || !entry.dramaId) return Array.isArray(history) ? history : [];
  const nextItem = {
    dramaId: String(entry.dramaId),
    title: String(entry.title || 'Drama China'),
    platformId: String(entry.platformId || 'dramabox'),
    platformName: String(entry.platformName || 'DramaBox'),
    poster: String(entry.poster || ''),
    episode: Math.max(1, Math.round(Number(entry.episode) || 1)),
    totalEpisodes: Math.max(1, Math.round(Number(entry.totalEpisodes) || 60)),
    progressPercent: Math.max(0, Math.min(100, Math.round(Number(entry.progressPercent) || 0))),
    subtitleLang: String(entry.subtitleLang || 'id'),
    updatedAt: Number(entry.updatedAt) || Date.now(),
  };

  const filtered = (Array.isArray(history) ? history : []).filter(
    (h) => h && h.dramaId !== nextItem.dramaId
  );
  return [nextItem, ...filtered].slice(0, Math.max(1, maxItems));
}

export function toggleFavoriteDramaId(favorites = [], dramaId = '') {
  const id = String(dramaId || '').trim();
  if (!id) return Array.isArray(favorites) ? [...favorites] : [];
  const set = new Set((Array.isArray(favorites) ? favorites : []).map(String));
  if (set.has(id)) {
    set.delete(id);
  } else {
    set.add(id);
  }
  return Array.from(set);
}

/**
 * Ranks catalog + live API candidates against visual fingerprint (aspect ratio,
 * brightness/warmth/hue palette), filename cues, user scene notes, and AI hints.
 */
export function rankClipIdentifierCandidates(
  catalog = [],
  {
    fileName = '',
    userClue = '',
    aiHints = [],
    visualProfile = null,
    limit = 5,
  } = {}
) {
  const queryTokens = extractTokens(`${fileName} ${userClue} ${(aiHints || []).join(' ')}`);
  const isPortrait = visualProfile ? Number(visualProfile.aspectRatio || 0.56) < 0.85 : true;
  const warmth = Number(visualProfile?.warmth ?? 0.5);
  const brightness = Number(visualProfile?.brightness ?? 0.5);

  const scored = (catalog || []).map((drama, idx) => {
    let score = 46; // Base vertical short-drama affinity
    const reasons = [];
    const corpus = [
      drama.title,
      drama.altTitle,
      drama.platformName,
      drama.genre,
      ...(drama.genres || []),
      ...(drama.keywords || []),
      ...(drama.cast || []),
      drama.synopsis,
    ]
      .join(' ')
      .toLowerCase();

    let tokenHits = 0;
    for (const tk of queryTokens) {
      if (corpus.includes(tk)) {
        tokenHits += 1;
        score += tk.length >= 5 ? 11 : 7;
      }
    }
    if (tokenHits > 0) {
      reasons.push(`Cocok ${tokenHits} kata kunci cuplikan/AI`);
    }

    // Visual tone affinity (warm gold/crimson -> historical/CEO glamour, cool blue/dark -> fantasy/donghua/revenge)
    if (visualProfile) {
      if (isPortrait) {
        score += 6;
        reasons.push('Rasio vertikal 9:16 khas short drama');
      }
      if (warmth > 0.55 && (drama.genre === 'ceo' || drama.genre === 'historical')) {
        score += 8;
        reasons.push('Palet warna hangat sinematografi CEO/Kolosal');
      } else if (warmth <= 0.55 && (drama.genre === 'fantasy' || drama.genre === 'donghua' || drama.genre === 'revenge')) {
        score += 8;
        reasons.push('Palet kontras gelap khas aksi/fantasi');
      }
      if (brightness < 0.42 && (drama.genre === 'revenge' || drama.genre === 'donghua')) {
        score += 5;
      }
    }

    // Subtle deterministic tie-breaker favoring popular multi-episode hits
    score += Math.max(0, 4 - idx * 0.12);
    const confidence = Math.max(52, Math.min(98, Math.round(score)));
    const estimatedEp = Math.max(
      1,
      Math.min(
        drama.totalEpisodes || 60,
        ((queryTokens.length * 7 + Math.round(warmth * 20) + idx * 3) % Math.min(25, drama.totalEpisodes || 25)) + 1
      )
    );

    return {
      drama,
      confidence,
      estimatedEpisode: estimatedEp,
      reasons: reasons.length ? reasons : ['Kecocokan profil visual & katalog multi-platform'],
    };
  });

  return scored
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, Math.max(1, limit));
}

export function parseAiDramaIdentification(rawText = '') {
  const clean = String(rawText || '').trim();
  if (!clean) return { summary: '', hints: [], suggestedGenre: '' };

  // Try JSON extraction first if AI responded in JSON
  const jsonMatch = clean.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      const hints = Array.isArray(parsed.keywords)
        ? parsed.keywords.map(String)
        : Array.isArray(parsed.titles)
        ? parsed.titles.map(String)
        : extractTokens(`${parsed.title || ''} ${parsed.platform || ''} ${parsed.genre || ''}`);
      return {
        summary: String(parsed.summary || parsed.analysis || clean.slice(0, 260)).trim(),
        hints,
        suggestedGenre: String(parsed.genre || '').toLowerCase(),
      };
    } catch {
      // Fall through to prose extraction
    }
  }

  return {
    summary: clean.replace(/\s+/g, ' ').slice(0, 280),
    hints: extractTokens(clean),
    suggestedGenre: inferGenreFromText(clean),
  };
}

/**
 * Builds the canonical Dailymotion player embed URL (geo.dailymotion.com/player/{playerId}.html)
 * required by Dailymotion's traffic control policy (omitting playerId returns HTTP 403 blank screen).
 */
export function buildDailymotionEmbedUrl(
  videoId = '',
  playerId = DEFAULT_DRACIN_ENDPOINT_CONFIG.dailymotionPlayerId
) {
  const id = String(videoId || '').trim();
  if (!id) return '';
  const pid = String(playerId || DEFAULT_DRACIN_ENDPOINT_CONFIG.dailymotionPlayerId || 'x8lr5')
    .trim()
    .replace(/[^a-z0-9_-]/gi, '');
  const safePid = pid || 'x8lr5';
  return `https://geo.dailymotion.com/player/${encodeURIComponent(safePid)}.html?video=${encodeURIComponent(id)}`;
}

export function buildDailymotionWatchUrl(videoId = '') {
  const id = String(videoId || '').trim();
  if (!id) return '';
  return `https://www.dailymotion.com/video/${encodeURIComponent(id)}`;
}

const DRAMA_MATCH_STOPWORDS = new Set([
  'yang', 'dan', 'di', 'ke', 'dari', 'untuk', 'dengan', 'pada', 'adalah', 'ini', 'itu',
  'atau', 'oleh', 'akan', 'juga', 'sudah', 'telah', 'tidak', 'tak', 'bukan', 'dalam',
  'saat', 'ketika', 'karena', 'agar', 'setelah', 'sebelum', 'lebih', 'sangat', 'harus',
  'bisa', 'dapat', 'hanya', 'semua', 'mereka', 'kami', 'kita', 'kamu', 'anda', 'dia',
  'sang', 'para', 'seorang', 'sebuah', 'tentang', 'tanpa', 'secara', 'demi', 'hingga',
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'into', 'over', 'after', 'before',
  'sub', 'indo', 'indonesia', 'dub', 'dubbing', 'sulih', 'suara', 'full', 'episode', 'eps',
  'drama', 'china', 'dracin', 'pendek', 'short', 'resmi', 'gratis', 'iklan', 'streaming',
  'hd', 'live', 'platform', 'video', 'terbaru', 'viral',
]);

/**
 * Normalizes drama titles/synopses into stopword-filtered matching tokens,
 * removing platform prefixes like [Dubbing], (Sub Indo), 【Indo Sub】, etc.
 */
export function normalizeDramaMatchText(text = '') {
  const cleaned = String(text || '')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/【[^】]*】/g, ' ')
    .replace(/\((?:dub|dubbing|sulih\s*suara|sub\s*indo|indo\s*sub|full\s*ep[^)]*)\)/gi, ' ')
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff\s]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return [];
  return cleaned
    .split(' ')
    .filter((tok) => {
      if (!tok) return false;
      if (/[\u4e00-\u9fff]/.test(tok)) return true;
      return tok.length >= 3 && !DRAMA_MATCH_STOPWORDS.has(tok);
    });
}

function buildBigrams(tokens = []) {
  const set = new Set();
  for (let i = 0; i < tokens.length - 1; i += 1) {
    set.add(`${tokens[i]}_${tokens[i + 1]}`);
  }
  return set;
}

/**
 * Computes combined unigram + bigram token similarity (0..1) resilient to word reordering
 * and partial translations across platforms.
 */
export function computeTokenJaccardSimilarity(textA = '', textB = '') {
  const toksA = normalizeDramaMatchText(textA);
  const toksB = normalizeDramaMatchText(textB);
  if (!toksA.length || !toksB.length) return 0;

  const setA = new Set(toksA);
  const setB = new Set(toksB);
  let exactInter = 0;
  let partialInter = 0;

  for (const a of setA) {
    if (setB.has(a)) {
      exactInter += 1;
    } else if (a.length >= 5) {
      for (const b of setB) {
        if (b.length >= 5 && (a.startsWith(b.slice(0, 5)) || b.startsWith(a.slice(0, 5)))) {
          partialInter += 0.6;
          break;
        }
      }
    }
  }

  const unionSize = setA.size + setB.size - exactInter;
  const uniJaccard = unionSize > 0 ? Math.min(1, (exactInter + partialInter) / unionSize) : 0;

  // Overlap coefficient rewards when a short title matches inside a longer translated title
  const minSize = Math.min(setA.size, setB.size);
  const overlapCoeff = minSize > 0 ? Math.min(1, (exactInter + partialInter * 0.7) / minSize) : 0;

  const biA = buildBigrams(toksA);
  const biB = buildBigrams(toksB);
  let biInter = 0;
  for (const bg of biA) {
    if (biB.has(bg)) biInter += 1;
  }
  const biUnion = biA.size + biB.size - biInter;
  const biJaccard = biUnion > 0 ? biInter / biUnion : 0;

  return Math.max(0, Math.min(1, uniJaccard * 0.5 + overlapCoeff * 0.25 + biJaccard * 0.25));
}

/**
 * Compares two poster visual color/tone/aspect profiles (0..1), returning null if unavailable.
 */
export function computeVisualProfileSimilarity(profileA = null, profileB = null) {
  if (!profileA || !profileB) return null;
  const rA = Number(profileA.r);
  const gA = Number(profileA.g);
  const bA = Number(profileA.b);
  const rB = Number(profileB.r);
  const gB = Number(profileB.g);
  const bB = Number(profileB.b);

  let rgbSim = 0.5;
  if ([rA, gA, bA, rB, gB, bB].every((n) => Number.isFinite(n))) {
    const dist = Math.sqrt((rA - rB) ** 2 + (gA - gB) ** 2 + (bA - bB) ** 2);
    rgbSim = Math.max(0, 1 - dist / 441.67);
  }

  const brightSim =
    Number.isFinite(Number(profileA.brightness)) && Number.isFinite(Number(profileB.brightness))
      ? Math.max(0, 1 - Math.abs(Number(profileA.brightness) - Number(profileB.brightness)) * 1.4)
      : 0.5;

  const warmSim =
    Number.isFinite(Number(profileA.warmth)) && Number.isFinite(Number(profileB.warmth))
      ? Math.max(0, 1 - Math.abs(Number(profileA.warmth) - Number(profileB.warmth)) * 1.4)
      : 0.5;

  const aspectSim =
    Number.isFinite(Number(profileA.aspectRatio)) && Number.isFinite(Number(profileB.aspectRatio))
      ? Math.max(0, 1 - Math.abs(Number(profileA.aspectRatio) - Number(profileB.aspectRatio)) * 1.2)
      : 0.85;

  return Math.max(0, Math.min(1, rgbSim * 0.45 + brightSim * 0.2 + warmSim * 0.2 + aspectSim * 0.15));
}

function isGenericSynopsis(text = '') {
  const s = String(text || '').trim().toLowerCase();
  return !s || s.startsWith('drama pendek resmi dari') || s.length < 18;
}

/**
 * Extracts top distinctive keywords from a drama's synopsis and title for cross-platform lookup
 * even when another platform publishes the same drama under a different title.
 */
export function extractSynopsisKeywords(drama = {}, maxKeywords = 5) {
  const synopsis = isGenericSynopsis(drama?.synopsis) ? '' : String(drama?.synopsis || '');
  const tokens = normalizeDramaMatchText(synopsis);
  if (!tokens.length) {
    return normalizeDramaMatchText(`${drama?.title || ''} ${drama?.altTitle || ''}`).slice(0, maxKeywords);
  }
  const freq = new Map();
  for (const tok of tokens) {
    freq.set(tok, (freq.get(tok) || 0) + (tok.length >= 6 ? 1.3 : 1));
  }
  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([tok]) => tok)
    .slice(0, Math.max(1, maxKeywords));
}

/**
 * Multi-signal cross-platform drama similarity scorer combining:
 * 1. Title & alternate title token/bigram match
 * 2. Synopsis / plot summary semantic token overlap (catches renamed dramas)
 * 3. Visual poster color/brightness/aspect fingerprint (when available)
 * 4. Structural metadata (episode count proximity, genre, cast, dub tags)
 */
export function scoreCrossPlatformDramaMatch(
  sourceDrama,
  candidateDrama,
  { sourceVisual = null, candidateVisual = null } = {}
) {
  if (!sourceDrama || !candidateDrama) {
    return { score: 0, confidence: 0, signals: { titlePct: 0, synopsisPct: 0, visualPct: null, metadataPct: 0 }, reasons: [] };
  }

  const srcTitleCorpus = `${sourceDrama.title || ''} ${sourceDrama.altTitle || ''}`;
  const candTitleCorpus = `${candidateDrama.title || ''} ${candidateDrama.altTitle || ''}`;
  const titleSim = computeTokenJaccardSimilarity(srcTitleCorpus, candTitleCorpus);

  const srcSyn = isGenericSynopsis(sourceDrama.synopsis) ? '' : sourceDrama.synopsis;
  const candSyn = isGenericSynopsis(candidateDrama.synopsis) ? '' : candidateDrama.synopsis;
  const synopsisSim = srcSyn && candSyn ? computeTokenJaccardSimilarity(srcSyn, candSyn) : 0;

  // Cross-field check: source title tokens appearing in candidate synopsis or vice versa
  const crossFieldSim = Math.max(
    candSyn ? computeTokenJaccardSimilarity(srcTitleCorpus, candSyn) : 0,
    srcSyn ? computeTokenJaccardSimilarity(candTitleCorpus, srcSyn) : 0
  );
  const effectiveSynopsisSim = Math.max(synopsisSim, crossFieldSim * 0.78);

  const visualSim = computeVisualProfileSimilarity(sourceVisual, candidateVisual);

  // Structural & metadata similarity (episode count proximity + genre + cast + dub)
  let metaPoints = 0;
  let metaMax = 14;
  const reasons = [];

  const srcEp = Number(sourceDrama.totalEpisodes) || 0;
  const candEp = Number(candidateDrama.totalEpisodes) || 0;
  const bothRealEp =
    Boolean(sourceDrama.hasKnownEpisodeCount) &&
    Boolean(candidateDrama.hasKnownEpisodeCount) &&
    srcEp > 0 &&
    candEp > 0;

  if (bothRealEp) {
    const diff = Math.abs(srcEp - candEp);
    if (diff === 0) {
      metaPoints += 7;
      reasons.push(`Jumlah episode identik (${candEp} Ep)`);
    } else if (diff <= 3) {
      metaPoints += 5.5;
      reasons.push(`Jumlah episode hampir sama (${candEp} Ep)`);
    } else if (diff <= 10) {
      metaPoints += 3;
    }
  }

  const srcGenres = new Set([sourceDrama.genre, ...(sourceDrama.genres || [])].filter((g) => g && g !== 'trending' && g !== 'all'));
  const candGenres = new Set([candidateDrama.genre, ...(candidateDrama.genres || [])].filter((g) => g && g !== 'trending' && g !== 'all'));
  let genreOverlap = false;
  for (const g of srcGenres) {
    if (candGenres.has(g)) {
      genreOverlap = true;
      break;
    }
  }
  if (genreOverlap) {
    metaPoints += 4;
  }

  const castSim = computeTokenJaccardSimilarity(
    [...(sourceDrama.cast || []), ...(sourceDrama.keywords || [])].join(' '),
    [...(candidateDrama.cast || []), ...(candidateDrama.keywords || [])].join(' ')
  );
  metaPoints += castSim * 3;
  const metadataSim = Math.min(1, metaPoints / metaMax);

  // Adaptive weights: if visual poster comparison is available use 34/36/16/14;
  // if CORS blocks poster pixels, redistribute visual weight into synopsis + title + metadata
  const hasVisual = visualSim !== null;
  const wTitle = hasVisual ? 34 : 40;
  const wSynopsis = hasVisual ? 36 : 44;
  const wVisual = hasVisual ? 16 : 0;
  const wMeta = hasVisual ? 14 : 16;

  let rawScore =
    titleSim * wTitle +
    effectiveSynopsisSim * wSynopsis +
    (hasVisual ? visualSim * wVisual : 0) +
    metadataSim * wMeta;

  // High-confidence boost when synopsis + metadata strongly agree despite different titles
  if (effectiveSynopsisSim >= 0.35 && (bothRealEp && Math.abs(srcEp - candEp) <= 5)) {
    rawScore += 14;
  } else if (titleSim >= 0.5 && effectiveSynopsisSim >= 0.25) {
    rawScore += 12;
  } else if (titleSim >= 0.65) {
    rawScore += 10;
  }

  const score = Math.max(0, Math.min(99, Math.round(rawScore)));
  const titlePct = Math.round(titleSim * 100);
  const synopsisPct = Math.round(effectiveSynopsisSim * 100);
  const visualPct = hasVisual ? Math.round(visualSim * 100) : null;
  const metadataPct = Math.round(metadataSim * 100);

  if (synopsisPct >= 22) {
    reasons.unshift(`Sinopsis & alur cocok (${synopsisPct}%)`);
  }
  if (titlePct >= 25) {
    reasons.unshift(`Judul mirip (${titlePct}%)`);
  }
  if (visualPct !== null && visualPct >= 65) {
    reasons.push(`Visual poster mirip (${visualPct}%)`);
  }
  if (genreOverlap && reasons.length < 3) {
    reasons.push('Genre & tema sama');
  }
  if (reasons.length === 0 && score >= 20) {
    reasons.push('Kemiripan kata kunci & katalog lintas platform');
  }

  return {
    score,
    confidence: score,
    signals: {
      titlePct,
      synopsisPct,
      visualPct,
      metadataPct,
    },
    reasons: reasons.slice(0, 4),
  };
}

/**
 * Ranks cross-platform candidate dramas against a source drama using combined
 * title, synopsis, visual poster, and metadata signals.
 */
export function rankCrossPlatformDramaMatches(
  sourceDrama,
  candidates = [],
  { sourceVisual = null, visualMap = {}, minScore = 22, limit = 5 } = {}
) {
  if (!sourceDrama || !Array.isArray(candidates)) return [];
  const seenIds = new Set();
  const ranked = [];

  for (const cand of candidates) {
    if (!cand || !cand.id) continue;
    if (cand.id === sourceDrama.id) continue;
    if (
      sourceDrama.sourceId &&
      cand.sourceId &&
      cand.sourceId === sourceDrama.sourceId &&
      cand.platformId === sourceDrama.platformId
    ) {
      continue;
    }
    if (seenIds.has(cand.id)) continue;
    seenIds.add(cand.id);

    const candVisual = visualMap?.[cand.id] || null;
    const evaluation = scoreCrossPlatformDramaMatch(sourceDrama, cand, {
      sourceVisual,
      candidateVisual: candVisual,
    });

    // Small bonus for candidates hosted on a different platform than the source
    const crossPlatformBonus = cand.platformId !== sourceDrama.platformId ? 4 : 0;
    const finalScore = Math.min(99, evaluation.score + crossPlatformBonus);

    // Require at least some textual or strong combined signal so unrelated items are rejected
    const hasMeaningfulSignal =
      evaluation.signals.titlePct >= 18 ||
      evaluation.signals.synopsisPct >= 18 ||
      (evaluation.signals.visualPct !== null && evaluation.signals.visualPct >= 75 && evaluation.signals.metadataPct >= 45);

    if (finalScore >= minScore && hasMeaningfulSignal) {
      ranked.push({
        drama: cand,
        score: finalScore,
        confidence: finalScore,
        signals: evaluation.signals,
        reasons: evaluation.reasons,
        isDifferentPlatform: cand.platformId !== sourceDrama.platformId,
      });
    }
  }

  return ranked
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return Number(b.isDifferentPlatform) - Number(a.isDifferentPlatform);
    })
    .slice(0, Math.max(1, limit));
}

/**
 * Normalizes Sansekai/SekaiDrama stream & poster URLs:
 * upgrades http://api.sansekai.my.id -> https://api.sansekai.my.id (prevents HTTPS Mixed Content blocking),
 * resolves protocol-relative URLs, and handles relative /api/... paths cleanly.
 */
export function normalizeSansekaiUrl(rawUrl = '') {
  const clean = String(rawUrl || '').trim();
  if (!clean) return '';
  if (/^http:\/\/api\.sansekai\.my\.id\b/i.test(clean)) {
    return clean.replace(/^http:\/\//i, 'https://');
  }
  if (/^http:\/\/drama\.sansekai\.my\.id\b/i.test(clean)) {
    return clean.replace(/^http:\/\//i, 'https://');
  }
  if (clean.startsWith('//')) return `https:${clean}`;
  if (clean.startsWith('/api/')) return `https://api.sansekai.my.id${clean}`;
  if (clean.startsWith('/')) return `https://api.sansekai.my.id/api${clean}`;
  return clean;
}

export function buildSansekaiWebUrl() {
  return DEFAULT_DRACIN_ENDPOINT_CONFIG.sansekai?.webBaseUrl || 'https://drama.sansekai.my.id';
}

function classifySansekaiStreamKind(url = '') {
  const lower = String(url || '').toLowerCase();
  if (lower.includes('.m3u8') || lower.includes('/hls?') || lower.includes('/hls/') || lower.includes('m3u8')) {
    return 'hls';
  }
  return 'video';
}

/**
 * Extracts & normalizes raw feed / search items returned by any of the 11 Sansekai / SekaiDrama
 * platform endpoints (Melolo, DramaBox, PineDrama, MyDrama, ReelShort, ShortMax, NetShort,
 * GoodShort, FlickReels, FreeReels, DramaNova) into unified Dracin catalog objects.
 */
export function extractSansekaiFeedItems(rawJson, platformId = 'dramabox') {
  if (!rawJson || typeof rawJson !== 'object') return [];
  const safePlat = SANSEKAI_SUPPORTED_PLATFORMS.has(String(platformId || '').toLowerCase())
    ? String(platformId).toLowerCase()
    : 'dramabox';

  const rawList = [];
  const pushArr = (arr) => {
    if (!Array.isArray(arr)) return;
    for (const item of arr) {
      if (item && typeof item === 'object') rawList.push(item);
    }
  };

  if (Array.isArray(rawJson)) {
    pushArr(rawJson);
  } else {
    const d = rawJson.data ?? rawJson;
    if (Array.isArray(d)) {
      for (const entry of d) {
        if (entry && Array.isArray(entry.dramas)) pushArr(entry.dramas);
        else if (entry && Array.isArray(entry.books)) pushArr(entry.books);
        else if (entry && Array.isArray(entry.items)) pushArr(entry.items);
        else if (entry && typeof entry === 'object') rawList.push(entry);
      }
    } else if (d && typeof d === 'object') {
      // Melolo: data.cells[].cell_data[].books[] | data.cell.cell_data[].books[] | data.search_data[].books[] | data.books[]
      if (Array.isArray(d.cells)) {
        for (const cell of d.cells) {
          if (Array.isArray(cell?.cell_data)) {
            for (const cd of cell.cell_data) pushArr(cd?.books);
          }
          pushArr(cell?.books);
        }
      }
      if (d.cell && Array.isArray(d.cell.cell_data)) {
        for (const cd of d.cell.cell_data) pushArr(cd?.books);
      }
      if (Array.isArray(d.search_data)) {
        for (const sd of d.search_data) pushArr(sd?.books);
      }
      pushArr(d.books);
      // PineDrama: collections[] / results[]
      pushArr(d.collections);
      pushArr(d.results);
      // ReelShort: data.lists[].books[]
      if (Array.isArray(d.lists)) {
        for (const lst of d.lists) {
          pushArr(lst?.books);
          pushArr(lst?.items);
        }
      }
      // GoodShort: data.records[].items[] | data.records[]
      if (Array.isArray(d.records)) {
        for (const rec of d.records) {
          if (Array.isArray(rec?.items)) pushArr(rec.items);
          else if (rec && typeof rec === 'object') rawList.push(rec);
        }
      }
      // FreeReels / ShortMax / NetShort / MyDrama / DramaNova common shapes
      pushArr(d.items);
      pushArr(d.list);
      pushArr(d.dramas);
      pushArr(d.contentInfos);
      pushArr(d.shortPlayList);
    }
    // Top-level PineDrama/search shapes when not nested in data
    if (rawList.length === 0) {
      pushArr(rawJson.collections);
      pushArr(rawJson.results);
      pushArr(rawJson.items);
      pushArr(rawJson.books);
      pushArr(rawJson.dramas);
      pushArr(rawJson.list);
    }
  }

  const seen = new Set();
  const normalized = [];

  for (const item of rawList) {
    const sourceId = String(
      item.book_id ??
        item.bookId ??
        item.collection_id ??
        item.shortPlayId ??
        item.playletId ??
        item.playlet_id ??
        item.dramaId ??
        item.key ??
        item.series_id_str ??
        item.id ??
        ''
    ).trim();

    const title = String(
      item.book_name ??
        item.bookName ??
        item.book_title ??
        item.shortPlayName ??
        item.series_title ??
        item.title ??
        item.name ??
        ''
    ).trim();

    if (!title || !sourceId) continue;
    const dedupKey = `${safePlat}::${sourceId}`;
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);

    const rawCover = String(
      item.thumb_url ??
        item.coverWap ??
        item.cover ??
        item.book_pic ??
        item.shortPlayCover ??
        item.series_cover ??
        item.poster ??
        item.posterImg ??
        item.image ??
        ''
    ).trim();
    const cover = normalizeSansekaiUrl(rawCover);

    const desc = String(
      item.abstract ??
        item.introduction ??
        item.description ??
        item.summary ??
        item.desc ??
        item.series_intro ??
        item.intro ??
        ''
    ).trim();

    const epCount =
      Number(
        item.serial_count ??
          item.chapterCount ??
          item.chapter_count ??
          item.total_episodes ??
          item.totalEpisodes ??
          item.episode_count ??
          item.episodeCount ??
          item.episode_cnt ??
          item.episodes ??
          0
      ) || 0;

    const rawTags = [
      ...(Array.isArray(item.tags) ? item.tags : []),
      ...(Array.isArray(item.tagNames) ? item.tagNames : []),
      ...(Array.isArray(item.categories) ? item.categories : []),
      ...(Array.isArray(item.stat_infos) ? item.stat_infos : []),
      ...(Array.isArray(item.labelArray) ? item.labelArray : []),
    ]
      .map((t) => (typeof t === 'string' ? t : t?.name || t?.tagName || ''))
      .filter(Boolean);

    const inferredGenre = inferGenreFromText(`${title} ${rawTags.join(' ')}`, desc);

    normalized.push(
      normalizeDracinItem(
        {
          id: `sansekai::${safePlat}::${sourceId}`,
          sourceId,
          sansekaiId: sourceId,
          sansekaiPlatform: safePlat,
          apiProvider: 'sansekai',
          sourceApi: `sansekai-${safePlat}`,
          title,
          altTitle: rawTags.slice(0, 3).join(' · ') || `SekaiDrama · ${getPlatformMeta(safePlat).name}`,
          platformId: safePlat,
          genre: inferredGenre,
          genres: Array.from(new Set([inferredGenre, 'trending'])),
          totalEpisodes: epCount,
          episodes: epCount,
          poster: cover,
          description: desc,
          synopsis: desc,
          views_total: Number(item.views || item.playCount || item.heatScore || 0) || 1450000,
          hasIndonesianDub: /dub\s*indo|dubbing|sulih\s*suara/i.test(`${title} ${rawTags.join(' ')}`),
          keywords: [...extractTokens(title), ...rawTags.map((t) => t.toLowerCase()), safePlat, 'sansekai'],
        },
        safePlat
      )
    );
  }

  return normalized;
}

/**
 * Extracts the Melolo videoId (`vid`) for a target 1-based episode number from Sansekai's
 * `/melolo/detail?book_id=...` JSON payload.
 */
export function extractSansekaiMeloloVideoId(detailJson, episodeNumber = 1) {
  const ep = Math.max(1, Math.round(Number(episodeNumber) || 1));
  const vData = detailJson?.data?.video_data || detailJson?.video_data || detailJson?.data || detailJson;
  const list = Array.isArray(vData?.video_list)
    ? vData.video_list
    : Array.isArray(vData?.episodes)
    ? vData.episodes
    : [];
  if (!list.length) return '';

  const exact = list.find((item) => {
    const idx = Number(item?.vid_index ?? item?.episodeNumber ?? item?.episode ?? item?.index);
    return Number.isFinite(idx) && idx === ep;
  });
  const picked = exact || list[ep - 1] || null;
  if (!picked) return '';
  return String(picked.vid || picked.videoId || picked.video_id || picked.id || '').trim();
}

/**
 * Parses episode stream responses across ALL 11 Sansekai / SekaiDrama platform schemas
 * (Melolo, DramaBox, ShortMax, NetShort, FlickReels, ReelShort, GoodShort, FreeReels,
 * PineDrama, MyDrama, DramaNova) into unified playable server entries + subtitles.
 */
export function extractSansekaiEpisodeStreams(
  rawJson,
  { platformId = 'dramabox', episodeNumber = 1 } = {}
) {
  const safePlat = SANSEKAI_SUPPORTED_PLATFORMS.has(String(platformId || '').toLowerCase())
    ? String(platformId).toLowerCase()
    : 'dramabox';
  const platName = getPlatformMeta(safePlat).name;
  const ep = Math.max(1, Math.round(Number(episodeNumber) || 1));

  if (!rawJson || typeof rawJson !== 'object') {
    return { servers: [], subtitles: [], locked: false };
  }

  const servers = [];
  const subtitles = [];
  const seenUrls = new Set();
  const seenSubUrls = new Set();
  let locked = false;

  const addServer = (rawUrl, qualityLabel = 'HD', extra = {}) => {
    const url = normalizeSansekaiUrl(rawUrl);
    if (!url || !/^https?:\/\//i.test(url) || seenUrls.has(url)) return;
    seenUrls.add(url);
    const kind = classifySansekaiStreamKind(url);
    const q = String(qualityLabel || 'HD').toUpperCase();
    servers.push({
      id: `sansekai-${safePlat}-${q.toLowerCase().replace(/[^a-z0-9]/g, '')}-${servers.length}`,
      label: `Sansekai · ${platName} ${q}${kind === 'hls' ? ' (HLS)' : ' (MP4)'}`,
      provider: 'sansekai',
      sansekaiPlatform: safePlat,
      kind,
      url,
      qualityLabel: q,
      ...extra,
    });
  };

  const addSubtitle = (sub) => {
    if (!sub) return;
    const rawU = typeof sub === 'string' ? sub : sub.url || sub.src || sub.subtitleUrl || sub.vttUrl || sub.srtUrl || '';
    const url = normalizeSansekaiUrl(rawU);
    if (!url || !/^https?:\/\//i.test(url) || seenSubUrls.has(url)) return;
    seenSubUrls.add(url);
    const lang = String(
      (typeof sub === 'object' ? sub.language || sub.lang || sub.subtitleLanguage || sub.code : '') || 'id'
    ).toLowerCase();
    const label = String(
      (typeof sub === 'object' ? sub.label || sub.langName || sub.language || sub.subtitleLanguage : '') ||
        (lang.includes('id') || lang.includes('in') ? 'Indonesia' : lang.toUpperCase())
    );
    subtitles.push({ label, language: lang, url });
  };

  // Helper to inspect an individual episode node across schemas
  const inspectEpisodeNode = (node) => {
    if (!node || typeof node !== 'object') return;
    if (node.locked === true || node.isLocked === true || node.isVip === true) {
      locked = true;
    }

    // 1. Melolo / PineDrama / MyDrama / generic `qualities` / `videoList` / `streams` arrays
    const qualityArrays = [
      node.qualities,
      node.videoList,
      node.videoPathList,
      node.streams,
      node.sources,
      node.qualityList,
    ].filter(Array.isArray);

    for (const qArr of qualityArrays) {
      for (const q of qArr) {
        if (!q || typeof q !== 'object') continue;
        const u = q.streamUrl || q.videoPath || q.url || q.playUrl || q.videoUrl || q.hlsUrl || q.mp4 || '';
        const lbl = q.label || q.definition || q.quality || q.resolution || 'HD';
        if (u) addServer(u, typeof lbl === 'number' ? `${lbl}P` : String(lbl));
      }
    }

    // 2. DramaBox `cdnList[].videoPathList[]`
    if (Array.isArray(node.cdnList)) {
      const sortedCdns = [...node.cdnList].sort((a, b) => Number(Boolean(b?.isDefault)) - Number(Boolean(a?.isDefault)));
      for (const cdn of sortedCdns) {
        if (!Array.isArray(cdn?.videoPathList)) continue;
        const sortedPaths = [...cdn.videoPathList].sort((a, b) => {
          const qa = Number(a?.quality) || 0;
          const qb = Number(b?.quality) || 0;
          // Prefer 720p -> 540p -> 1080p -> others
          const rank = (v) => (v === 720 ? 0 : v === 540 ? 1 : v === 1080 ? 2 : v === 480 ? 3 : 4);
          return rank(qa) - rank(qb);
        });
        for (const vp of sortedPaths) {
          if (vp?.videoPath) {
            addServer(vp.videoPath, vp.quality ? `${vp.quality}P` : 'HD');
          }
        }
      }
    }

    // 3. ShortMax `videoUrl` as object `{ video_1080, video_720, video_480 }`
    if (node.videoUrl && typeof node.videoUrl === 'object' && !Array.isArray(node.videoUrl)) {
      const vo = node.videoUrl;
      if (vo.video_720) addServer(vo.video_720, '720P');
      if (vo.video_1080) addServer(vo.video_1080, '1080P');
      if (vo.video_540) addServer(vo.video_540, '540P');
      if (vo.video_480) addServer(vo.video_480, '480P');
      if (vo.video_360) addServer(vo.video_360, '360P');
      for (const [k, v] of Object.entries(vo)) {
        if (typeof v === 'string' && /^https?:\/\//i.test(v)) {
          addServer(v, k.replace(/^video_/i, '') + 'P');
        }
      }
    }

    // 3b. Melolo `video_model` JSON string/object with base64-encoded `video_list.video_N.main_url`
    if (node.video_model) {
      let vm = node.video_model;
      if (typeof vm === 'string') {
        try {
          vm = JSON.parse(vm);
        } catch {
          vm = null;
        }
      }
      const vListObj = vm && typeof vm === 'object' ? vm.video_list || vm.videoList : null;
      if (vListObj && typeof vListObj === 'object') {
        const entries = Array.isArray(vListObj) ? vListObj : Object.values(vListObj);
        for (const entry of entries) {
          if (!entry || typeof entry !== 'object') continue;
          const defLabel = String(entry.definition || entry.quality || entry.vtype || 'HD').toUpperCase();
          const rawUrls = [entry.main_url, entry.backup_url_1, entry.backup_url, entry.url].filter(
            (u) => typeof u === 'string' && u.trim()
          );
          for (const rawU of rawUrls) {
            let decoded = rawU.trim();
            if (!/^https?:\/\//i.test(decoded) && !decoded.startsWith('//')) {
              try {
                const candidate =
                  typeof atob === 'function'
                    ? atob(decoded)
                    : Buffer.from(decoded, 'base64').toString('utf8');
                if (/^https?:\/\//i.test(candidate.trim())) {
                  decoded = candidate.trim();
                }
              } catch {
                // Not valid base64
              }
            }
            if (/^https?:\/\//i.test(decoded) || decoded.startsWith('//')) {
              addServer(decoded, defLabel);
            }
          }
        }
      }
    }

    // 4. Direct top-level URLs (Melolo main_url/backup_url/streamUrl, FlickReels hlsUrl, NetShort videoUrl, ReelShort/GoodShort/FreeReels)
    const directCandidates = [
      { key: 'streamUrl', label: node.quality || 'HD' },
      { key: 'main_url', label: node.definition || node.quality || 'HD' },
      { key: 'backup_url', label: node.definition || node.quality || 'Backup' },
      { key: 'hlsUrl', label: node.quality || 'HD' },
      { key: 'm3u8Url', label: node.quality || 'HD' },
      { key: 'videoUrl', label: node.quality || 'HD' },
      { key: 'playUrl', label: node.quality || 'HD' },
      { key: 'mp4', label: node.quality || 'HD' },
      { key: 'mp4Url', label: node.quality || 'HD' },
      { key: 'external_audio_h264_m3u8', label: 'H264' },
      { key: 'm3u8_url', label: 'HD' },
      { key: 'video_url', label: 'HD' },
      { key: 'url', label: node.quality || 'HD' },
    ];
    for (const { key, label } of directCandidates) {
      if (typeof node[key] === 'string' && node[key].trim()) {
        let candidateUrl = node[key].trim();
        if (!/^https?:\/\//i.test(candidateUrl) && !candidateUrl.startsWith('//') && (key === 'main_url' || key === 'backup_url')) {
          try {
            const dec =
              typeof atob === 'function'
                ? atob(candidateUrl)
                : Buffer.from(candidateUrl, 'base64').toString('utf8');
            if (/^https?:\/\//i.test(dec.trim())) candidateUrl = dec.trim();
          } catch {
            // ignore
          }
        }
        addServer(candidateUrl, label);
      }
    }

    // 5. Subtitles (NetShort subtitleUrl, Melolo/FreeReels subtitles[] / subtitle_list[])
    if (node.subtitleUrl) {
      addSubtitle({
        url: node.subtitleUrl,
        language: node.subtitleLanguage || 'id',
        label: node.subtitleLanguage || 'Indonesia',
      });
    }
    const subArrays = [node.subtitles, node.subtitle_list, node.captions, node.tracks].filter(Array.isArray);
    for (const sArr of subArrays) {
      for (const s of sArr) addSubtitle(s);
    }
  };

  // Detect all-episode array responses (DramaBox /get-allepisode, GoodShort /get-allepisode, FreeReels /detailAndAllEpisode)
  const episodeList = Array.isArray(rawJson)
    ? rawJson
    : Array.isArray(rawJson?.data?.chapterList)
    ? rawJson.data.chapterList
    : Array.isArray(rawJson?.data?.episodes)
    ? rawJson.data.episodes
    : Array.isArray(rawJson?.data?.episode_list)
    ? rawJson.data.episode_list
    : Array.isArray(rawJson?.episodes)
    ? rawJson.episodes
    : Array.isArray(rawJson?.chapterList)
    ? rawJson.chapterList
    : Array.isArray(rawJson?.data)
    ? rawJson.data
    : null;

  if (episodeList && episodeList.length > 0) {
    // Match 1-based episodeNumber OR 0-based chapterIndex === ep - 1
    const matched =
      episodeList.find((item) => {
        const oneBased = Number(
          item?.episodeNumber ?? item?.episodeNum ?? item?.episode_num ?? item?.serial_number ?? item?.index
        );
        if (Number.isFinite(oneBased) && oneBased === ep && item?.chapterIndex === undefined) {
          return true;
        }
        if (item?.chapterIndex !== undefined && Number(item.chapterIndex) === ep - 1) {
          return true;
        }
        return false;
      }) || episodeList[ep - 1];

    if (matched) {
      inspectEpisodeNode(matched);
    }
  } else {
    // Single-episode object (may be nested under data / episode / data.episode)
    const nodes = [
      rawJson,
      rawJson?.data,
      rawJson?.episode,
      rawJson?.data?.episode,
      rawJson?.result,
    ].filter((n) => n && typeof n === 'object' && !Array.isArray(n));
    for (const node of nodes) {
      inspectEpisodeNode(node);
    }
  }

  return {
    servers,
    subtitles,
    locked: Boolean(locked && servers.length === 0),
  };
}

/**
 * Builds a clean SekaiDrama Web direct URL for a drama.
 */
export function buildSansekaiDirectWatchUrl(drama = null, episodeNumber = 1, webBaseUrl = '') {
  const base = String(webBaseUrl || buildSansekaiWebUrl())
    .trim()
    .replace(/\/+$/, '');
  const cleanTitle = String(drama?.title || '')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/【[^】]*】/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleanTitle) return base;
  return `${base}/?q=${encodeURIComponent(cleanTitle)}`;
}

/**
 * Pure circuit-breaker helpers for Sansekai public API.
 */
export function isSansekaiCooldownActive(state = null, now = Date.now()) {
  if (!state || typeof state !== 'object') return false;
  return Number(state.cooldownUntil || 0) > now;
}

export function getSansekaiCooldownRemainingSec(state = null, now = Date.now()) {
  if (!isSansekaiCooldownActive(state, now)) return 0;
  return Math.max(1, Math.ceil((Number(state.cooldownUntil) - now) / 1000));
}

export function recordSansekaiOutcome(
  state = null,
  {
    ok = true,
    statusCode = 200,
    now = Date.now(),
    rateLimitCooldownMs = 90_000,
    forbiddenCooldownMs = 180_000,
  } = {}
) {
  const prev = state && typeof state === 'object' ? state : {};
  if (ok) {
    return {
      failures: 0,
      lastStatus: 200,
      cooldownUntil: 0,
      lastOkAt: now,
    };
  }
  const code = Number(statusCode) || 0;
  const isHardLimit = code === 403 || code === 429;
  const failures = (Number(prev.failures) || 0) + 1;
  const baseMs =
    code === 403
      ? Math.max(30_000, Number(forbiddenCooldownMs) || 180_000)
      : code === 429
      ? Math.max(30_000, Number(rateLimitCooldownMs) || 90_000)
      : 25_000;
  const multiplier = isHardLimit ? Math.min(3, Math.pow(1.5, failures - 1)) : 1;
  const cooldownMs = Math.min(360_000, Math.round(baseMs * multiplier));
  return {
    failures,
    lastStatus: code,
    cooldownUntil: now + cooldownMs,
    lastOkAt: Number(prev.lastOkAt) || 0,
  };
}

export function extractSansekaiApiBaseCandidates(
  config = DEFAULT_DRACIN_ENDPOINT_CONFIG,
  mirrorStates = {},
  { customBaseUrl = '', now = Date.now() } = {}
) {
  const sk = config?.sansekai || DEFAULT_DRACIN_ENDPOINT_CONFIG.sansekai;
  const rawList = [];

  const cleanCustom = String(customBaseUrl || '')
    .trim()
    .replace(/\/+$/, '');
  if (cleanCustom && /^https?:\/\//i.test(cleanCustom)) {
    rawList.push({ id: 'sansekai-custom', label: 'Custom Sansekai Mirror', baseUrl: cleanCustom, priority: 0 });
  }

  if (Array.isArray(sk?.mirrors) && sk.mirrors.length > 0) {
    for (const m of sk.mirrors) {
      if (m && m.baseUrl) {
        rawList.push({
          id: String(m.id || m.baseUrl),
          label: String(m.label || 'Sansekai Mirror'),
          baseUrl: String(m.baseUrl).trim().replace(/\/+$/, ''),
          priority: Number.isFinite(Number(m.priority)) ? Number(m.priority) : 5,
        });
      }
    }
  } else if (sk?.baseUrl) {
    rawList.push({
      id: 'sansekai-primary',
      label: 'Sansekai Primary API',
      baseUrl: String(sk.baseUrl).trim().replace(/\/+$/, ''),
      priority: 1,
    });
  }

  const seen = new Set();
  const deduped = [];
  for (const entry of rawList) {
    if (!entry.baseUrl || seen.has(entry.baseUrl)) continue;
    seen.add(entry.baseUrl);
    const st = mirrorStates?.[entry.id] || null;
    const inCooldown = isSansekaiCooldownActive(st, now);
    deduped.push({ ...entry, inCooldown, cooldownRemainingSec: getSansekaiCooldownRemainingSec(st, now) });
  }

  return deduped.sort((a, b) => {
    if (a.inCooldown !== b.inCooldown) return a.inCooldown ? 1 : -1;
    return a.priority - b.priority;
  });
}

export function scoreDailymotionAutoMatch(drama = null, candidate = null, episodeNumber = 1) {
  if (!drama?.title || !candidate?.title) return { score: 0, matchedTokens: 0, isStrongMatch: false };
  const cleanTitle = String(drama.title)
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/【[^】]*】/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const titleTokens = normalizeDramaMatchText(cleanTitle);
  if (titleTokens.length === 0) return { score: 0, matchedTokens: 0, isStrongMatch: false };

  const candTitle = String(candidate.title || '').toLowerCase();
  const candHay = `${candTitle} ${String(candidate.synopsis || candidate.description || '').toLowerCase()}`;
  const normalizedClean = titleTokens.join(' ');
  const exactPhrase = normalizedClean.length >= 8 && candTitle.includes(normalizedClean);

  let titleHits = 0;
  let hayHits = 0;
  for (const tok of titleTokens) {
    if (candTitle.includes(tok)) titleHits += 1;
    if (candHay.includes(tok)) hayHits += 1;
  }

  const coverage = titleHits / titleTokens.length;
  const ep = Math.max(1, Math.round(Number(episodeNumber) || 1));
  const epMatch = new RegExp(`\\b(ep|eps|episode|part)\\s*0?${ep}\\b`, 'i').test(candHay);
  const hasDramaCue = /\b(drama|dracin|sub\s*indo|dub\s*indo|dramabox|melolo|reelshort|shortmax|netshort|goodshort|full\s*episode)\b/i.test(
    candHay
  );
  const hasOffTopicNoise = /\b(berita|news|jet\s*tempur|israel|yaman|palestina|politik|ftv\s*sctv|sinetron|musik|lagu|karaoke|podcast)\b/i.test(
    candTitle
  );

  let score = titleHits * 4 + (hayHits - titleHits) * 1.5;
  if (exactPhrase) score += 10;
  if (epMatch) score += 4;
  if (hasDramaCue) score += 3;
  if (hasOffTopicNoise) score -= 14;

  const minNeededHits = titleTokens.length <= 2 ? titleTokens.length : Math.max(2, Math.ceil(titleTokens.length * 0.6));
  const isStrongMatch =
    !hasOffTopicNoise &&
    (exactPhrase || (titleHits >= minNeededHits && coverage >= 0.55 && (hasDramaCue || epMatch || titleHits >= 3)));

  return {
    score: Math.max(0, Math.round(score)),
    matchedTokens: titleHits,
    coverage: Number(coverage.toFixed(2)),
    epMatch,
    isStrongMatch,
  };
}

/**
 * Maps internal platform IDs (like 'stardusttv', 'idrama', 'anichin') to NunoDrama upstream platform slugs.
 */
export function resolveNunoPlatformId(platformId = 'dramabox', nunoOverride = '') {
  const explicit = String(nunoOverride || '').trim().toLowerCase();
  if (explicit && NUNODRAMA_SUPPORTED_PLATFORMS.has(explicit)) {
    return explicit === 'stardusttv' ? 'stardust' : explicit;
  }
  const p = String(platformId || '').trim().toLowerCase();
  if (p === 'stardusttv') return 'stardust';
  if (p === 'idrama') return 'dramabox';
  if (p === 'dramanova') return 'moboreels';
  if (p === 'starshort' || p === 'anichin') return 'nunomix';
  if (p === 'dramabite') return 'flickreels';
  if (NUNODRAMA_SUPPORTED_PLATFORMS.has(p)) return p;
  return 'dramabox';
}

/**
 * Parses JSON or r.jina.ai text payload from `https://nunodrama.my.id/api/section/{platform}/{section}`
 * or `https://nunodrama.my.id/api/search/{platform}?q=...` into normalized Dracin catalog items.
 */
export function extractNunoSectionItems(rawTextOrJson, platformId = 'dramabox', section = 'foryou') {
  let parsed = rawTextOrJson;
  if (typeof rawTextOrJson === 'string') {
    const trimmed = rawTextOrJson.trim();
    if (!trimmed) return [];
    const idx = trimmed.indexOf('{');
    if (idx === -1) return [];
    try {
      parsed = JSON.parse(trimmed.slice(idx));
    } catch {
      return [];
    }
  }
  if (!parsed || typeof parsed !== 'object') return [];
  const rawArr = Array.isArray(parsed.dramas)
    ? parsed.dramas
    : Array.isArray(parsed.data)
    ? parsed.data
    : Array.isArray(parsed)
    ? parsed
    : [];
  if (!rawArr.length) return [];

  const nunoPlat = resolveNunoPlatformId(platformId);
  const catalogPlatId = nunoPlat === 'stardust' ? 'stardusttv' : nunoPlat;
  const seen = new Set();
  const items = [];

  for (const d of rawArr) {
    if (!d || typeof d !== 'object') continue;
    const bookId = String(d.BookID || d.bookId || d.id || '').trim();
    const title = String(d.BookName || d.bookName || d.title || '').trim();
    if (!bookId || !title) continue;
    const itemPlat = resolveNunoPlatformId(d.Platform || nunoPlat);
    const uiPlat = itemPlat === 'stardust' ? 'stardusttv' : itemPlat;
    const key = `${itemPlat}::${bookId}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const cover = String(d.Cover || d.cover || d.poster || '').trim();
    const epCount = Number(d.ChapterCount || d.chapterCount || d.totalEpisodes || 0) || 60;
    const corner = String(d.Corner || d.corner || '').trim();
    const tag = String(d.Tag || d.tag || '').trim();
    const tags = Array.isArray(d.Tags) ? d.Tags.map(String) : [];
    const intro = String(d.Introduction || d.introduction || d.synopsis || '').trim();
    const isTiktokFyp =
      itemPlat === 'pinedrama' ||
      section === 'vip' ||
      corner === 'Anggota Saja' ||
      corner === 'Terpopuler' ||
      corner === 'HOT';

    items.push(
      normalizeDracinItem(
        {
          id: key,
          sourceId: bookId,
          nunoPlatform: itemPlat,
          apiProvider: 'nunodrama',
          sourceApi: `nunodrama-${itemPlat}`,
          title,
          altTitle: [corner, tag, ...tags.slice(0, 2), d.PlatformName || getPlatformMeta(uiPlat).name]
            .filter(Boolean)
            .join(' · '),
          platformId: uiPlat,
          platformName: d.PlatformName || getPlatformMeta(uiPlat).name,
          totalEpisodes: epCount,
          poster: cover,
          corner,
          isFullFree: true,
          isVipUnlocked: true,
          isLiveFresh: true,
          liveSection: String(section || 'foryou').toLowerCase(),
          isTiktokFyp,
          hasIndonesianDub:
            itemPlat === 'nunomix' ||
            section === 'dubbing' ||
            /sulih\s*suara|dubbing|\(dub\)/i.test(`${title} ${corner} ${tag}`),
          synopsis:
            intro ||
            `${title} — Drama pendek original ${
              d.PlatformName || getPlatformMeta(uiPlat).name
            } (${epCount} Episode Full Terbuka Gratis Tanpa Kunci VIP).`,
          keywords: [
            ...extractTokens(title),
            ...(tag ? [tag.toLowerCase()] : []),
            ...tags.map((t) => t.toLowerCase()),
            uiPlat,
          ],
        },
        catalogPlatId
      )
    );
  }

  return items;
}

function readHtmlAttr(tagHtml = '', attrName = '') {
  const re = new RegExp(`\\b${attrName}=["']([^"']*)["']`, 'i');
  const m = String(tagHtml || '').match(re);
  if (!m) return '';
  return m[1]
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

/**
 * Extracts real native video stream URLs (MP4, HLS, CENC-MP4), quality variants (1080p/720p/540p),
 * subtitle tracks, and total episode count from `https://nunodrama.my.id/watch/{platform}/{bookId}?ep={ep}` HTML.
 */
export function extractNunoWatchPayload(
  rawHtml = '',
  { platformId = 'dramabox', episodeNumber = 1 } = {}
) {
  const html = String(rawHtml || '');
  if (!html) return { servers: [], subtitles: [], totalEpisodes: 0 };

  const nunoPlat = resolveNunoPlatformId(platformId);
  const uiPlatId = nunoPlat === 'stardust' ? 'stardusttv' : nunoPlat;
  const platName = getPlatformMeta(uiPlatId).name;
  const ep = Math.max(1, Math.round(Number(episodeNumber) || 1));

  const servers = [];
  const subtitles = [];
  const seenUrls = new Set();
  const seenSubUrls = new Set();

  const resolveNunoStreamUrl = (rawUrl) => {
    const u = String(rawUrl || '').trim();
    if (!u) return '';
    if (/^https?:\/\//i.test(u)) return u;
    if (u.startsWith('//')) return `https:${u}`;
    if (u.startsWith('/')) return `https://nunodrama.my.id${u}`;
    return u;
  };

  const pushServer = ({
    rawUrl,
    qualityLabel = '720P',
    dataKind = '',
    keyHex = '',
    encrypted = false,
  }) => {
    const url = resolveNunoStreamUrl(rawUrl);
    if (!url || !/^https?:\/\//i.test(url)) return;

    const cleanKey = String(keyHex || '').trim();
    const isCencMp4 =
      /^[0-9a-f]{32}$/i.test(cleanKey) &&
      (nunoPlat === 'melolo' || /\.mp4(\?|$)/i.test(url) || dataKind === 'mp4');
    const isHls =
      !isCencMp4 &&
      (dataKind === 'hls' ||
        /\.m3u8(\?|$)/i.test(url) ||
        /\/hls\?/i.test(url) ||
        /proxy5\.dramanuno\.workers\.dev/i.test(url));

    const kind = isCencMp4 ? 'cenc-mp4' : isHls ? 'hls' : 'mp4';
    const q = String(qualityLabel || 'HD').toUpperCase();

    // For NunoMix (dokers.qt80uk.com), add BOTH the CORS-enabled inter.nunodrama.my.id proxy AND direct no-referrer MP4
    if (nunoPlat === 'nunomix' && /dokers\.qt80uk\.com/i.test(url)) {
      const proxiedUrl = `https://inter.nunodrama.my.id/api/nunomix/proxy?url=${encodeURIComponent(url)}`;
      if (!seenUrls.has(proxiedUrl)) {
        seenUrls.add(proxiedUrl);
        servers.push({
          id: `nuno-${nunoPlat}-${q.toLowerCase()}-proxy-${servers.length}`,
          label: `${platName} Original ${q} (MP4)`,
          provider: 'nunodrama',
          nunoPlatform: nunoPlat,
          kind: 'mp4',
          url: proxiedUrl,
          qualityLabel: q,
        });
      }
    }

    if (seenUrls.has(url)) return;
    seenUrls.add(url);

    servers.push({
      id: `nuno-${nunoPlat}-${q.toLowerCase().replace(/[^a-z0-9]/g, '')}-${servers.length}`,
      label: `${platName} Original ${q}${kind === 'hls' ? ' (HLS)' : kind === 'cenc-mp4' ? ' (CENC HD)' : ' (MP4)'}`,
      provider: 'nunodrama',
      nunoPlatform: nunoPlat,
      kind,
      url,
      qualityLabel: q,
      contentKey: isCencMp4 ? cleanKey : '',
      cencKeyHex: isCencMp4 ? cleanKey : '',
      hlsKeyHex: !isCencMp4 && cleanKey ? cleanKey : '',
      encrypted: Boolean(encrypted || cleanKey),
    });
  };

  // 1. Inspect <video id="player" ...> attributes
  const videoTagMatch = html.match(/<video[^>]*\bid=["']player["'][^>]*>/i) || html.match(/<video[^>]*\bdata-src=["'][^"']+["'][^>]*>/i);
  const videoTag = videoTagMatch ? videoTagMatch[0] : '';
  const mainSrc = readHtmlAttr(videoTag, 'data-src');
  const mainKind = readHtmlAttr(videoTag, 'data-kind').toLowerCase();
  const mainKey = readHtmlAttr(videoTag, 'data-key');
  const mainEncrypted = readHtmlAttr(videoTag, 'data-encrypted') === 'true';

  // 2. Inspect <button ... data-quality-option ...> buttons (1080p, 720p, 540p)
  const qualityButtons = html.match(/<button[^>]*\bdata-quality-option\b[^>]*>/gi) || [];
  const parsedQualities = [];
  for (const btn of qualityButtons) {
    const qUrl = readHtmlAttr(btn, 'data-url');
    const qLabel = readHtmlAttr(btn, 'data-label') || readHtmlAttr(btn, 'data-id') || '720P';
    const qKey = readHtmlAttr(btn, 'data-key') || mainKey;
    const qEnc = readHtmlAttr(btn, 'data-encrypted') === 'true' || mainEncrypted;
    if (qUrl) {
      parsedQualities.push({ qUrl, qLabel, qKey, qEnc });
    }
  }

  // Sort qualities preferring 720p -> 1080p -> 540p -> others for fast startup + crisp HD
  parsedQualities.sort((a, b) => {
    const rank = (lbl) => {
      if (/720/i.test(lbl)) return 0;
      if (/1080/i.test(lbl)) return 1;
      if (/540/i.test(lbl)) return 2;
      if (/480/i.test(lbl)) return 3;
      return 4;
    };
    return rank(a.qLabel) - rank(b.qLabel);
  });

  for (const q of parsedQualities) {
    pushServer({
      rawUrl: q.qUrl,
      qualityLabel: q.qLabel,
      dataKind: mainKind,
      keyHex: q.qKey,
      encrypted: q.qEnc,
    });
  }

  if (mainSrc) {
    pushServer({
      rawUrl: mainSrc,
      qualityLabel: parsedQualities[0]?.qLabel || '720P',
      dataKind: mainKind,
      keyHex: mainKey,
      encrypted: mainEncrypted,
    });
  }

  // 3. Extract subtitle options (<button data-sub-option ...> & <track ...>)
  const subButtons = html.match(/<button[^>]*\bdata-sub-option\b[^>]*>/gi) || [];
  for (const btn of subButtons) {
    const sUrl = resolveNunoStreamUrl(readHtmlAttr(btn, 'data-url'));
    if (!sUrl || seenSubUrls.has(sUrl)) continue;
    seenSubUrls.add(sUrl);
    const lang = (readHtmlAttr(btn, 'data-lang') || 'id').toLowerCase();
    const label = readHtmlAttr(btn, 'data-label') || (lang === 'id' ? 'Indonesia' : lang.toUpperCase());
    subtitles.push({ label, language: lang, url: sUrl });
  }

  const trackTags = html.match(/<track[^>]*\bsrc=["'][^"']+["'][^>]*>/gi) || [];
  for (const tr of trackTags) {
    const sUrl = resolveNunoStreamUrl(readHtmlAttr(tr, 'src'));
    if (!sUrl || seenSubUrls.has(sUrl)) continue;
    seenSubUrls.add(sUrl);
    const lang = (readHtmlAttr(tr, 'srclang') || 'id').toLowerCase();
    const label = readHtmlAttr(tr, 'label') || (lang === 'id' ? 'Indonesia' : lang.toUpperCase());
    subtitles.push({ label, language: lang, url: sUrl });
  }

  // 4. Extract total episodes ("74 Episode Tersedia")
  const epCountMatch = html.match(/(\d+)\s+Episode\s+Tersedia/i);
  const totalEpisodes = epCountMatch ? Math.max(ep, Number(epCountMatch[1]) || 0) : 0;

  return {
    servers,
    subtitles,
    totalEpisodes,
  };
}



