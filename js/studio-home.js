/**
 * Standalone Manifestudio Homepage Data & Pure Logic Module (v81)
 *
 * Powers the standalone platform experience on https://manifestudio.my.id/:
 *  - Multi-banner hero showcase (Flagship Slide + all active utility mascot banners)
 *  - Categorized & searchable 17-Feature Directory
 *  - Editorial platform value pillars & Manifestudio-specific FAQ
 */

export const STUDIO_CATEGORIES = Object.freeze([
  { id: 'all', label: 'Semua Fitur' },
  { id: 'ai-docs', label: 'AI & Dokumen' },
  { id: 'entertainment', label: 'Hiburan & Media' },
  { id: 'media-files', label: 'Downloader & File' },
  { id: 'daily-security', label: 'Harian & Keamanan' },
]);

export const STUDIO_FEATURE_META = Object.freeze({
  manifestai: {
    category: 'ai-docs',
    categoryLabel: 'AI & Dokumen',
    summary: 'Asisten chat AI multi-model dengan streaming cepat, riset web real-time, tabel rapi, dan mode suara natural.',
    highlights: 'Multi-Model Gratis · Streaming Instan · Mode Suara',
    keywords: 'ai chat gpt gemini claude deepseek asisten suara riset',
  },
  plagiarism: {
    category: 'ai-docs',
    categoryLabel: 'AI & Dokumen',
    summary: 'Pindai kemiripan naskah PDF, Word, hingga gambar scan OCR dengan penampil halaman asli & laporan PDF siap unduh.',
    highlights: 'No Repository · Halaman Asli · Laporan PDF',
    keywords: 'plagiarisme plagiat turnitin skripsi pdf docx ocr cek kemiripan',
  },
  novel: {
    category: 'ai-docs',
    categoryLabel: 'AI & Dokumen',
    summary: 'Baca 200+ novel lintas platform dengan pembersih teks OCR, 122+ tema halaman, mode layar penuh, dan audiobook.',
    highlights: '14+ Sumber · 122+ Tema · Mode Audiobook',
    keywords: 'novel baca buku cerita audiobook epub tema gratis',
  },
  dracin: {
    category: 'entertainment',
    categoryLabel: 'Hiburan & Media',
    summary: 'Nonton ribuan episode drama pendek Indonesia, China, dan global dalam pemutar vertikal HD dengan subtitle Indonesia.',
    highlights: '17 Platform · Subtitle Indonesia · Mode FYP',
    keywords: 'drama pendek dracin nonton video film subtitle indonesia fyp',
  },
  music: {
    category: 'entertainment',
    categoryLabel: 'Hiburan & Media',
    summary: 'Dengarkan lagu viral Indonesia & mancanegara bebas iklan dengan pemutar melayang dan audio latar anti-mati.',
    highlights: 'Tanpa Iklan · Audio Latar · Tren Real-Time',
    keywords: 'musik yt youtube lagu mp3 player streaming viral playlist',
  },
  audioeditor: {
    category: 'entertainment',
    categoryLabel: 'Hiburan & Media',
    summary: 'Potong audio presisi, pisahkan vokal karaoke, atur 10-band equalizer, bass boost, hingga ekspor MP3/WAV/FLAC.',
    highlights: 'Potong Tengah · 10-Band EQ · Stem Vokal',
    keywords: 'audio editor potong lagu mp3 wav eq bass karaoke stem mixer',
  },
  songfinder: {
    category: 'entertainment',
    categoryLabel: 'Hiburan & Media',
    summary: 'Temukan judul lagu atau sumber video sosial media dari potongan audio, rekaman mikrofon, maupun file video.',
    highlights: 'Identifikasi Audio & Video · Pencocokan Cepat',
    keywords: 'cari judul lagu shazam deteksi musik suara sumber video',
  },
  downloader: {
    category: 'media-files',
    categoryLabel: 'Downloader & File',
    summary: 'Unduh video MP4, audio MP3, foto carousel, dan story dari TikTok, YouTube, Instagram, dan Facebook tanpa watermark.',
    highlights: 'Tanpa Watermark · Video HD & MP3 · Multi-Platform',
    keywords: 'download unduh tiktok youtube instagram facebook reels mp4 mp3 watermark',
  },
  shortlink: {
    category: 'media-files',
    categoryLabel: 'Downloader & File',
    summary: 'Lewati tautan shortlink & safelink penuh iklan, hapus pelacak UTM, dan periksa potensi phishing/malware dengan Multi-API & Multi-AI.',
    highlights: 'Multi-API + Multi-AI · Anti-Malware · Mode Batch',
    keywords: 'shortlink bypass safelink anti iklan malware phishing bitly ouo linkvertise unshorten link',
  },
  compressor: {
    category: 'media-files',
    categoryLabel: 'Downloader & File',
    summary: 'Perkecil ukuran foto dan video tanpa pecah dengan preset khusus TikTok HD, Instagram Reels, dan WhatsApp HD.',
    highlights: 'Preset Sosmed HD · Proses Lokal · Anti Pecah',
    keywords: 'kompres foto video gambar ukuran kecil hd whatsapp tiktok instagram',
  },
  converter: {
    category: 'media-files',
    categoryLabel: 'Downloader & File',
    summary: 'Ubah format dokumen Word, Excel, PDF, gambar, audio, hingga video lintas 85+ kombinasi format langsung di browser.',
    highlights: '85+ Kombinasi Format · Tanpa Upload Server',
    keywords: 'konversi convert pdf docx word excel jpg png mp4 mp3 zip format file',
  },
  prayer: {
    category: 'daily-security',
    categoryLabel: 'Harian & Keamanan',
    summary: 'Pantau waktu Imsak, Subuh hingga Isya resmi Kemenag RI se-Indonesia lengkap dengan hitung mundur adzan.',
    highlights: 'Standar Kemenag RI · GPS Otomatis · Hitung Mundur',
    keywords: 'jadwal sholat imsak adzan maghrib subuh kiblat kemenag islam',
  },
  weather: {
    category: 'daily-security',
    categoryLabel: 'Harian & Keamanan',
    summary: 'Cek suhu aktual, radar curah hujan per jam, indeks UV, kecepatan angin, dan prakiraan cuaca 7 hari ke depan.',
    highlights: 'Radar Hujan Per Jam · Indeks UV · 7 Hari',
    keywords: 'cuaca hujan suhu angin uv prakiraan bmkg radar',
  },
  worldclock: {
    category: 'daily-security',
    categoryLabel: 'Harian & Keamanan',
    summary: 'Bandingkan zona waktu kota-kota dunia secara langsung menggunakan globe 3D interaktif yang dapat diputar.',
    highlights: 'Globe 3D Interaktif · Konversi Zona Waktu UTC',
    keywords: 'jam dunia waktu negara utc zona globe 3d wib wita wit',
  },
  speedtest: {
    category: 'daily-security',
    categoryLabel: 'Harian & Keamanan',
    summary: 'Ukur kecepatan unduh, unggah, ping, dan jitter koneksi internet Anda melalui jaringan Cloudflare CDN real-time.',
    highlights: 'Cloudflare CDN · Ping & Jitter · Speedometer Live',
    keywords: 'speedtest kecepatan internet wifi ping jitter download upload jaringan',
  },
  callerid: {
    category: 'daily-security',
    categoryLabel: 'Harian & Keamanan',
    summary: 'Periksa identitas operator, area, hotline resmi, hingga indikasi spam & skrip penipuan dari nomor tak dikenal.',
    highlights: '5 Engine Open-Source · Anti-Spam · Direktori Resmi',
    keywords: 'cek nomor telepon hp spam penipuan caller id getcontact operator',
  },
  webproxy: {
    category: 'daily-security',
    categoryLabel: 'Harian & Keamanan',
    summary: 'Jelajah web 100% privat dengan Mode Proxy & VPN Relay gratis, pemblokir iklan & malware, layar penuh, 108+ tema, Multi-AI, & unduh media otomatis.',
    highlights: 'Proxy & VPN Gratis · 108+ Tema · Unduh Media Otomatis',
    keywords: 'proxy web proxy vpn peramban browser privat incognito anti iklan vidmate unduh video tema multi ai',
  },
});

export const STUDIO_VALUE_PILLARS = Object.freeze([
  {
    index: '01',
    title: 'Gratis Penuh Tanpa Login',
    description:
      'Semua 17 alat digital, hiburan, dan AI dapat dipakai langsung tanpa registrasi akun, tanpa paywall, dan tanpa iklan mengganggu.',
  },
  {
    index: '02',
    title: 'Privasi Terjaga di Perangkat',
    description:
      'Kompresor HD, Konversi File, Audio Editor, dan Cek Plagiarisme memproses berkas langsung di peramban Anda tanpa menyimpan naskah ke server.',
  },
  {
    index: '03',
    title: 'Muat Instan & Ringan',
    description:
      'Setiap modul dimuat sesuai fitur yang Anda buka agar hemat kuota, cepat dibuka di jaringan seluler, dan tetap halus di semua perangkat.',
  },
  {
    index: '04',
    title: 'Siap Aplikasi Mandiri (PWA)',
    description:
      'Instal Manifestudio langsung ke layar utama Android, iPhone, maupun desktop untuk akses cepat satu ketukan seperti aplikasi native.',
  },
]);

export const STUDIO_FAQ_ITEMS = Object.freeze([
  {
    question: 'Apakah seluruh 17 fitur di Manifestudio benar-benar gratis dan tanpa login?',
    answer:
      'Ya. Seluruh 17 fitur utilitas, hiburan, dan AI di Manifestudio dapat langsung Anda gunakan secara gratis tanpa perlu membuat akun atau masuk terlebih dahulu.',
  },
  {
    question: 'Apakah file saya aman saat menggunakan Kompresor HD, Konversi File, Audio Editor, atau Cek Plagiarisme?',
    answer:
      'Aman. Pemrosesan kompresi media, konversi format, editing audio, hingga ekstraksi dokumen berjalan lokal di perangkat Anda, dan fitur Cek Plagiarisme menerapkan prinsip No Repository sehingga naskah Anda tidak disimpan ke database mana pun.',
  },
  {
    question: 'Bagaimana cara memasang Manifestudio sebagai aplikasi di HP atau laptop?',
    answer:
      'Klik tombol Install di bagian atas atau bawah halaman. Di Chrome/Edge Android & Desktop akan muncul jendela pasang instan; di Safari iPhone/iPad cukup ketuk ikon Bagikan (Share) lalu pilih Tambah ke Layar Utama.',
  },
  {
    question: 'Bagaimana cara mencari panduan atau mengatasi kendala pada salah satu fitur?',
    answer:
      'Gunakan tombol Tanya Fitur di pojok kanan bawah layar kapan saja. Asisten fitur kami siap menjelaskan fungsi, langkah penggunaan, hingga solusi teknis untuk seluruh 17 fitur Manifestudio.',
  },
  {
    question: 'Apakah fitur-fitur di Manifestudio bisa dibuka dengan cepat di HP maupun laptop?',
    answer:
      'Bisa. Tampilan Manifestudio menyesuaikan layar ponsel maupun desktop secara otomatis, dan setiap alat dimuat terpisah agar tetap ringan serta hemat kuota.',
  },
]);

/**
 * Build the flagship Multi-Banner Carousel slides for standalone Manifestudio.
 * Slide 1 is always the flagship Manifestudio platform hero, followed by all
 * active utility mascot banners synced from catalog.json (excluding Store-only banners).
 *
 * @param {Array<object>} catalogBanners
 * @param {object} utilitiesConfig
 * @param {(banner: object) => string | null} inferUtilityIdFn
 * @param {{ brandName?: string }} [opts]
 * @returns {Array<object>}
 */
export function buildStudioHeroBanners(
  catalogBanners,
  utilitiesConfig,
  inferUtilityIdFn,
  opts = {}
) {
  const brandName = String(opts.brandName || 'Manifestudio').trim() || 'Manifestudio';
  const enabledItems = (utilitiesConfig?.items || []).filter((it) => it && it.enabled !== false);
  const enabledMap = new Map(enabledItems.map((it) => [it.id, it]));
  const enabledCount = enabledItems.length || 17;

  const flagshipSlide = {
    id: 'studio-hero-flagship',
    utilityId: null,
    kicker: `${brandName} · ${enabledCount} Fitur Digital Gratis`,
    heading: 'Satu Platform Ringan untuk AI, Hiburan & Alat Harian Tanpa Login',
    sub: 'Akses Manifest AI, Peramban Proxy, Drama Pendek, YT Music, Downloader, Shortlink Bypass, Kompresor HD, Cek Plagiarisme, hingga Cek Nomor dalam satu tempat yang cepat dan rapi.',
    ctaLabel: `Jelajahi ${enabledCount} Fitur →`,
    href: '#fitur',
    image: './assets/banners/banner-manifestai.jpg',
    scrim: 'violet',
    isFlagship: true,
  };

  const rawBanners = Array.isArray(catalogBanners) ? catalogBanners : [];
  const utilitySlides = [];
  const seenUtilIds = new Set();

  for (const b of rawBanners) {
    if (!b || b.enabled === false) continue;
    const uid = typeof inferUtilityIdFn === 'function' ? inferUtilityIdFn(b) : null;
    if (!uid || !enabledMap.has(uid) || seenUtilIds.has(uid)) continue;
    seenUtilIds.add(uid);
    const utilItem = enabledMap.get(uid);
    utilitySlides.push({
      id: b.id || `studio-banner-${uid}`,
      utilityId: uid,
      kicker: b.kicker || `${brandName} · ${utilItem.label}`,
      heading: b.heading || utilItem.heroTitle || utilItem.pageTitle || utilItem.label,
      sub: b.sub || utilItem.pageSubtitle || '',
      ctaLabel: b.ctaLabel || `Buka ${utilItem.label} →`,
      href: `#workspace?tab=${encodeURIComponent(uid)}`,
      image: b.image || `./assets/banners/banner-${uid}.jpg`,
      scrim: b.scrim || 'default',
      isFlagship: false,
    });
  }

  return [flagshipSlide, ...utilitySlides];
}

/**
 * Build the complete 15-feature directory list from active utilities config + curated metadata.
 * @param {object} utilitiesConfig
 * @returns {Array<object>}
 */
export function buildStudioFeatureDirectory(utilitiesConfig) {
  const enabledItems = (utilitiesConfig?.items || []).filter((it) => it && it.enabled !== false);
  return enabledItems.map((item) => {
    const meta = STUDIO_FEATURE_META[item.id] || {
      category: 'daily-security',
      categoryLabel: 'Utilitas',
      summary: item.pageSubtitle || item.heroDescription || 'Alat digital gratis siap pakai.',
      highlights: 'Gratis · Tanpa Login',
      keywords: '',
    };
    return {
      id: item.id,
      label: item.label || item.pageTitle || item.id,
      pageTitle: item.pageTitle || item.label || item.id,
      icon: item.icon || './assets/icons/menu-utilitas.svg',
      category: meta.category,
      categoryLabel: meta.categoryLabel,
      summary: meta.summary || item.pageSubtitle || '',
      highlights: meta.highlights,
      keywords: `${item.id} ${item.label || ''} ${item.pageTitle || ''} ${meta.summary || ''} ${meta.keywords || ''}`.toLowerCase(),
    };
  });
}

/**
 * Filter directory features by category id and search query.
 * @param {Array<object>} features
 * @param {{ category?: string, query?: string }} [filters]
 */
export function filterStudioFeatures(features, filters = {}) {
  const list = Array.isArray(features) ? features : [];
  const category = String(filters.category || 'all').trim();
  const query = String(filters.query || '').trim().toLowerCase();

  return list.filter((feat) => {
    if (category && category !== 'all' && feat.category !== category) {
      return false;
    }
    if (query) {
      const haystack = `${feat.label} ${feat.pageTitle} ${feat.categoryLabel} ${feat.summary} ${feat.highlights} ${feat.keywords}`.toLowerCase();
      return haystack.includes(query);
    }
    return true;
  });
}

/**
 * Parse URL query string to decide whether Manifestudio should render the
 * clean Home Hub (`mode: 'home'`) or a dedicated single-feature page (`mode: 'tool'`).
 *
 * @param {string} search
 * @param {Array<string>} enabledIds
 * @returns {{ mode: 'home' | 'tool', tabId: string | null }}
 */
export function parseStudioRoute(search = '', enabledIds = []) {
  const params = new URLSearchParams(String(search || '').replace(/^\?/, ''));
  const rawTab = String(params.get('tab') || params.get('tool') || '').trim().toLowerCase();
  if (!rawTab) {
    return { mode: 'home', tabId: null };
  }
  const allowed = new Set(
    (Array.isArray(enabledIds) ? enabledIds : []).map((id) => String(id || '').trim().toLowerCase())
  );
  if (allowed.size > 0 && !allowed.has(rawTab)) {
    return { mode: 'home', tabId: null };
  }
  return { mode: 'tool', tabId: rawTab };
}

/**
 * Build a clean URL for navigating between Manifestudio Home Hub (`tabId = null`)
 * and a dedicated feature page (`tabId = 'manifestai'`, etc.), preserving `?site=` preview params.
 *
 * @param {string} currentHref
 * @param {string | null} [tabId]
 * @param {{ hash?: string }} [opts]
 * @returns {string}
 */
export function buildStudioRouteUrl(currentHref, tabId = null, opts = {}) {
  const url = new URL(currentHref || 'https://manifestudio.my.id/');
  url.searchParams.delete('tool');
  const cleanTab = String(tabId || '').trim().toLowerCase();
  if (cleanTab) {
    url.searchParams.set('tab', cleanTab);
    url.hash = '';
  } else {
    url.searchParams.delete('tab');
    url.hash = opts.hash ? (opts.hash.startsWith('#') ? opts.hash : `#${opts.hash}`) : '';
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

/**
 * Group directory features by curated category order for clean Quick-Switch optgroups.
 * @param {Array<object>} features
 * @returns {Array<{ id: string, label: string, items: Array<object> }>}
 */
export function groupStudioFeaturesByCategory(features) {
  const list = Array.isArray(features) ? features : [];
  const groups = [];
  for (const cat of STUDIO_CATEGORIES) {
    if (cat.id === 'all') continue;
    const items = list.filter((f) => f.category === cat.id);
    if (items.length > 0) {
      groups.push({ id: cat.id, label: cat.label, items });
    }
  }
  const knownIds = new Set(groups.flatMap((g) => g.items.map((i) => i.id)));
  const extras = list.filter((f) => !knownIds.has(f.id));
  if (extras.length > 0) {
    groups.push({ id: 'other', label: 'Utilitas Lainnya', items: extras });
  }
  return groups;
}

