import { DEFAULT_UTILITY_CONFIG, normalizeUtilityConfig } from './store.js?v=50';

export const BRAND = {
  name: 'Manifestudio',
  tagline: 'by Tomy',
  logo: './assets/icons/brand-icon.svg',
  footerText: 'Dikelola oleh Manifestudio by Tomy © 2026',
  whatsappNumber: '6285122936027',
  tiktokUrl: 'https://www.tiktok.com/@tmctomystudio',
  tiktokHandle: '@tmctomystudio',
  instagramUrl: 'https://www.instagram.com/tmctomystudio',
  instagramHandle: '@tmctomystudio',
  discountThreshold: 50000,
  discountAmount: 2000,
  payLaterSurchargeRate: 0.1,
  serviceFeeFlat: 0,
  serviceFeeLabel: 'Biaya Layanan',
  openGraph: {
    title: 'Manifestudio — Katalog Akun Premium & Menu Utilitas Digital',
    description:
      'Pesan Netflix, Canva Pro, YouTube, Spotify, Viu, Vidio, Alight Motion, WeTV & Prime Video instan. Dilengkapi Jadwal Sholat Kemenag RI, Prakiraan Cuaca, Jam Dunia UTC, Speedtest, Downloader & Kompres Media HD.',
    tagline: 'Premium Account & Utilitas Digital by Tomy',
    image: './assets/og-manifestudio.jpg',
    imageAlt: 'Manifestudio — Katalog Akun Premium & Layanan Digital Terpercaya',
    siteName: 'Manifestudio',
  },
  socials: [
    {
      id: 'social-whatsapp',
      platform: 'WhatsApp',
      label: 'WhatsApp Admin',
      handle: '+62 851-2293-6027',
      url: 'https://wa.me/6285122936027',
      logo: './assets/icons/social-whatsapp.svg',
    },
    {
      id: 'social-tiktok',
      platform: 'TikTok',
      label: 'TikTok @tmctomystudio',
      handle: '@tmctomystudio',
      url: 'https://www.tiktok.com/@tmctomystudio',
      logo: './assets/icons/social-tiktok.svg',
    },
    {
      id: 'social-instagram',
      platform: 'Instagram',
      label: 'Instagram @tmctomystudio',
      handle: '@tmctomystudio',
      url: 'https://www.instagram.com/tmctomystudio',
      logo: './assets/icons/social-instagram.svg',
    },
  ],
};

export const BANNERS = [
  {
    id: 'banner-katalog',
    kicker: 'Katalog Akun Premium · Harga Pelajar',
    heading: 'Langganan Aplikasi Favorit, Aktif Dalam Hitungan Menit.',
    sub: 'Pilih paket Sharing atau Privat bergaransi jelas. Checkout praktis langsung ke WhatsApp Admin.',
    ctaLabel: 'Lihat Katalog',
    href: '#katalog',
    image: './assets/hero-banner.jpg',
    scrim: 'default',
  },
  {
    id: 'banner-prayer',
    kicker: 'Menu Utilitas · Jadwal Sholat',
    heading: 'Waktu Imsak & Sholat 5 Waktu Resmi Kemenag RI',
    sub: 'Deteksi otomatis lokasi GPS/kecamatan kamu lengkap dengan hitung mundur waktu sholat berikutnya.',
    ctaLabel: 'Buka Jadwal Sholat',
    href: './tools.html?tab=prayer',
    image: './assets/banner-prayer.jpg',
    scrim: 'prayer',
  },
  {
    id: 'banner-weather',
    kicker: 'Menu Utilitas · Prakiraan Cuaca',
    heading: 'Pantau Cuaca Real-Time & Prakiraan 7 Hari',
    sub: 'Cek suhu, curah hujan aktual per jam, hembusan angin, dan prakiraan mingguan di kotamu.',
    ctaLabel: 'Cek Cuaca',
    href: './tools.html?tab=weather',
    image: './assets/banner-weather.jpg',
    scrim: 'weather',
  },
  {
    id: 'banner-worldclock',
    kicker: 'Menu Utilitas · Standar UTC',
    heading: 'Putar Bola Dunia & Konversi WIB/WITA/WIT',
    sub: 'Klik negara di globe interaktif untuk cek zona waktu & selisih jam Indonesia.',
    ctaLabel: 'Putar Bola Dunia',
    href: './tools.html?tab=worldclock',
    image: './assets/banner-worldclock.jpg',
    scrim: 'world',
  },
  {
    id: 'banner-speedtest',
    kicker: 'Menu Utilitas · Speedtest',
    heading: 'Uji Kecepatan Internet & Ping Real-Time',
    sub: 'Cek rata-rata download, upload, latensi, server, ISP, dan info perangkat dalam satu klik.',
    ctaLabel: 'Mulai Speedtest',
    href: './tools.html?tab=speedtest',
    image: './assets/banner-speedtest.jpg',
    scrim: 'weather',
  },
  {
    id: 'banner-downloader',
    kicker: 'Menu Utilitas · Downloader',
    heading: 'Download Video, Foto, Story & Caption Sosmed Tanpa Watermark',
    sub: 'Unduh video MP4 HD, slide foto TikTok/IG, Story, MP3, & salin caption otomatis.',
    ctaLabel: 'Buka Downloader',
    href: './tools.html?tab=downloader',
    image: '',
    scrim: 'downloader',
  },
  {
    id: 'banner-compressor',
    kicker: 'Menu Utilitas · Kompresor HD',
    heading: 'Kompres Foto & Video Anti-Pecah untuk TikTok, IG & WA',
    sub: 'Optimasi ukuran file tanpa mengurangi kualitas visual agar tidak dikompres ulang oleh sosmed.',
    ctaLabel: 'Kompres Media HD',
    href: './tools.html?tab=compressor',
    image: '',
    scrim: 'world',
  },
];

export const CATEGORIES = [
  { id: 'all', label: 'Semua Layanan' },
  { id: 'streaming', label: 'Streaming Film' },
  { id: 'music', label: 'Musik & Hiburan' },
  { id: 'creative', label: 'Desain & Editing' },
  { id: 'custom', label: 'Request & Custom' },
];

export const UTILITIES = DEFAULT_UTILITY_CONFIG;

export const PAY_LATER_SURCHARGE_RATE = 0.1;

export const PAYMENT_OPTIONS = [
  {
    id: 'Bayar Sekarang',
    label: 'Bayar Sekarang (QRIS / E-Wallet / Bank)',
    badge: '0% Biaya',
    note: 'Tanpa biaya tambahan · Diproses prioritas setelah konfirmasi.',
    surchargeRate: 0,
  },
  {
    id: 'Bayar Belakangan (Setelah Akun Diterima)',
    label: 'Bayar Nanti (Setelah Akun Diterima)',
    badge: '+10% Biaya Layanan',
    note: 'Biaya +10% karena pembayaran setelah akun aktif.',
    surchargeRate: 0.1,
  },
];

export const VOUCHERS = [
  {
    code: 'HEMAT2K',
    type: 'fixed',
    value: 2000,
    minSubtotal: 15000,
    usageMode: 'once',
    maxUses: 1,
    label: 'Potongan Rp2.000 (min. Rp15.000)',
  },
  {
    code: 'MANIFEST5',
    type: 'fixed',
    value: 5000,
    minSubtotal: 40000,
    usageMode: 'once',
    maxUses: 1,
    label: 'Potongan Rp5.000 (min. Rp40.000)',
  },
  {
    code: 'PROMO10',
    type: 'percent',
    value: 10,
    maxDiscount: 10000,
    minSubtotal: 25000,
    usageMode: 'once',
    maxUses: 1,
    label: 'Diskon 10% maks. Rp10.000 (min. Rp25.000)',
  },
];

export const PRODUCTS = [
  {
    id: 'netflix-premium',
    name: 'Netflix Premium',
    category: 'streaming',
    logo: './assets/logos/netflix.svg',
    isBestSeller: true,
    outOfStock: false,
    tag: 'Paling Laris',
    summary: '4K Ultra HD · Profil terkelola · Anti-hold',
    notice:
      'Harga produk Netflix sedang mengalami penyesuaian ringan akibat tingginya permintaan dan keterbatasan stok akun.',
    variants: [
      { id: 'nf-1p2u', name: '1 Bulan - Sharing 1P2U', price: 22500, oldPrice: 21500, outOfStock: false },
      { id: 'nf-1p1u', name: '1 Bulan - Sharing 1P1U', price: 30000, oldPrice: 27500, outOfStock: false },
      { id: 'nf-privat', name: '1 Bulan - Privat', price: 125000, oldPrice: 120000, outOfStock: false },
    ],
  },
  {
    id: 'canva-pro',
    name: 'Canva Pro',
    category: 'creative',
    logo: './assets/logos/canva.svg',
    isBestSeller: true,
    outOfStock: false,
    tag: 'Populer Kreator',
    summary: 'Akses template Pro, Brand Kit & hapus background',
    variants: [
      { id: 'canva-1m', name: '1 Bulan', price: 3000, outOfStock: false },
      { id: 'canva-2m', name: '2 Bulan', price: 4500, outOfStock: false },
      { id: 'canva-3m', name: '3 Bulan', price: 6500, outOfStock: false },
      { id: 'canva-6m', name: '6 Bulan', price: 8500, outOfStock: false },
      {
        id: 'canva-1y',
        name: '1 Tahun (Garansi 8 bulan)',
        price: 10000,
        outOfStock: true,
        restockMessage: 'Akan segera restock',
      },
    ],
  },
  {
    id: 'youtube-premium',
    name: 'YouTube Premium',
    category: 'music',
    logo: './assets/logos/youtube.svg',
    isBestSeller: false,
    outOfStock: true,
    restockMessage: 'Akan segera restock',
    tag: 'Segera Restock',
    summary: 'Bebas iklan · Putar di latar belakang · YouTube Music',
    variants: [
      { id: 'yt-3m-ng', name: '3 Bulan - No Garansi', price: 15000, outOfStock: true },
      { id: 'yt-3m-1r', name: '3 Bulan - Garansi 1x Replace', price: 20000, outOfStock: true },
      { id: 'yt-3m-2r', name: '3 Bulan - Garansi 2x Replace', price: 25000, outOfStock: true },
      { id: 'yt-3m-full', name: '3 Bulan - Garansi Full', price: 30000, outOfStock: true },
    ],
  },
  {
    id: 'spotify-premium',
    name: 'Spotify Premium',
    category: 'music',
    logo: './assets/logos/spotify.svg',
    isBestSeller: false,
    outOfStock: true,
    restockMessage: 'Akan segera restock',
    tag: 'Segera Restock',
    summary: 'Audio kualitas tinggi · Unduh offline tanpa iklan',
    variants: [
      { id: 'sp-3m-ng', name: '3 Bulan - No Garansi', price: 15000, outOfStock: true },
      { id: 'sp-3m-1r', name: '3 Bulan - Garansi 1x Replace', price: 20000, outOfStock: true },
      { id: 'sp-3m-2r', name: '3 Bulan - Garansi 2x Replace', price: 25000, outOfStock: true },
      { id: 'sp-3m-full', name: '3 Bulan - Garansi Full', price: 40000, outOfStock: true },
    ],
  },
  {
    id: 'viu-premium',
    name: 'Viu Premium',
    category: 'streaming',
    logo: './assets/logos/viu.svg',
    isBestSeller: false,
    outOfStock: false,
    tag: 'Tersedia',
    summary: 'Drama Asia & simulcast terbaru bebas iklan',
    variants: [
      { id: 'viu-1m', name: '1 Bulan Privat', price: 7000, outOfStock: false },
      { id: 'viu-3m', name: '3 Bulan Privat', price: 15000, outOfStock: false },
      { id: 'viu-6m', name: '6 Bulan Privat', price: 27000, outOfStock: false },
    ],
  },
  {
    id: 'vidio-platinum',
    name: 'Vidio Premier Platinum',
    category: 'streaming',
    logo: './assets/logos/vidio.svg',
    isBestSeller: false,
    outOfStock: false,
    tag: 'Tersedia',
    summary: 'Liga olahraga, serial original & tayangan lokal',
    variants: [
      { id: 'vidio-tv', name: '3-12 Bulan (Khusus TV)', price: 15000, outOfStock: false },
      { id: 'vidio-hp', name: '1 Bulan - Khusus HP', price: 20000, outOfStock: false },
      { id: 'vidio-all', name: '1 Bulan - All Device', price: 28000, outOfStock: false },
    ],
  },
  {
    id: 'alight-motion',
    name: 'Alight Motion Premium',
    category: 'creative',
    logo: './assets/logos/alight-motion.svg',
    isBestSeller: false,
    outOfStock: false,
    tag: 'Favorit Editor',
    summary: 'Preset XML terbuka · Ekspor tanpa watermark',
    variants: [
      { id: 'am-1y-ng', name: '1 Tahun - No Garansi', price: 15000, outOfStock: false },
      { id: 'am-1y-6m', name: '1 Tahun - Garansi 6 Bulan', price: 25000, outOfStock: false },
      { id: 'am-1y-full', name: '1 Tahun - Garansi Full', price: 30000, outOfStock: false },
    ],
  },
  {
    id: 'wetv-vip',
    name: 'WeTV',
    category: 'streaming',
    logo: './assets/logos/wetv.svg',
    isBestSeller: false,
    outOfStock: false,
    tag: 'Tersedia',
    summary: 'Akses episode cepat & kualitas Blu-ray 1080p',
    variants: [
      { id: 'wetv-1m-6u', name: '1 Bulan Sharing 6u', price: 8500, outOfStock: false },
      { id: 'wetv-1m-privat', name: '1 Bulan Privat', price: 35000, outOfStock: false },
    ],
  },
  {
    id: 'prime-video',
    name: 'Prime Video',
    category: 'streaming',
    logo: './assets/logos/prime-video.svg',
    isBestSeller: false,
    outOfStock: false,
    tag: 'Tersedia',
    summary: 'Film & serial Amazon Originals resmi',
    variants: [
      { id: 'prime-1m-share', name: '1 Bulan Sharing', price: 8000, outOfStock: false },
      { id: 'prime-1m-privat', name: '1 Bulan Privat', price: 15000, outOfStock: false },
    ],
  },
  {
    id: 'request-custom',
    name: 'Request dan Custom Produk',
    category: 'custom',
    logo: './assets/logos/custom-request.svg',
    isBestSeller: false,
    outOfStock: false,
    tag: 'Layanan Custom',
    summary: 'Pesan aplikasi khusus atau paket kombinasi durasi',
    variants: [
      {
        id: 'req-custom-app',
        name: 'Request Produk',
        price: 0,
        outOfStock: false,
        description: 'Tidak menemukan produk yang Anda cari di katalog? Ajukan request langsung ke admin.',
      },
      {
        id: 'req-custom-durasi',
        name: 'Custom Produk',
        price: 0,
        outOfStock: false,
        description: 'Ingin menggabungkan beberapa aplikasi atau mengatur durasi paket khusus.',
      },
    ],
  },
];

export const FAQ_ITEMS = [
  {
    question: 'Berapa lama proses aktivasi pesanan?',
    answer:
      'Pesanan diproses 3–10 menit via WhatsApp pada jam operasional setelah pembayaran dikonfirmasi.',
  },
  {
    question: 'Apa beda paket Sharing dan Privat?',
    answer:
      'Sharing memakai satu akun bersama sesuai kuota profil (misal 1P1U atau 1P2U). Privat memberi kendali penuh atas seluruh akun.',
  },
  {
    question: 'Bagaimana cara klaim garansi akun?',
    answer:
      'Paket bergaransi mendapat penggantian akun baru selama masa aktif jika kendala bukan karena pelanggaran aturan pemakaian.',
  },
  {
    question: 'Apa ketentuan Bayar Sekarang dan Bayar Nanti?',
    answer:
      'Bayar Sekarang bebas biaya (0%). Bayar Nanti (setelah akun diterima) dikenakan biaya layanan +10% yang dihitung otomatis saat checkout.',
  },
  {
    question: 'Bagaimana memakai voucher dan struk digital?',
    answer:
      'Masukkan kode voucher di keranjang sebelum checkout. Setelah pesanan dibuat, struk PNG siap diunduh dan dikirim ke WhatsApp admin.',
  },
  {
    question: 'Bagaimana kerja Jadwal Sholat, Cuaca, Jam Dunia, dan Speedtest?',
    answer:
      'Buka Menu Utilitas untuk mengakses semua utilitas di halaman terpisah. Lokasi memakai izin GPS browser terlebih dahulu, lalu otomatis fallback ke IP atau pencarian kota manual.',
  },
  {
    question: 'Bisakah request aplikasi atau paket durasi khusus?',
    answer:
      'Bisa. Pilih Request & Custom di katalog untuk memesan aplikasi atau durasi paket sesuai kebutuhan.',
  },
];

export const CATALOG_PREVIEW_STORAGE_KEY = 'manifestudio_catalog_preview_v1';

function normalizeLoadedCatalog(fallback, rawCatalog = {}) {
  const mergedBrand = {
    ...fallback.brand,
    ...(rawCatalog.brand || {}),
    openGraph: {
      ...(fallback.brand.openGraph || {}),
      ...(rawCatalog.brand?.openGraph || {}),
    },
  };
  if (
    !mergedBrand.tagline ||
    mergedBrand.tagline === 'Katalog & Utilitas' ||
    mergedBrand.tagline === 'Akun Premium & Layanan Digital Terpercaya'
  ) {
    mergedBrand.tagline = 'by Tomy';
  }
  if (!mergedBrand.footerText || String(mergedBrand.footerText).includes('tMC Tomy Studio')) {
    mergedBrand.footerText = 'Dikelola oleh Manifestudio by Tomy © 2026';
  }
  if (!mergedBrand.logo) {
    mergedBrand.logo = './assets/icons/brand-icon.svg';
  }
  if (!Array.isArray(mergedBrand.socials) || mergedBrand.socials.length === 0) {
    mergedBrand.socials = (fallback.brand.socials || []).map((s) => ({ ...s }));
  }

  const mergedUtilities = normalizeUtilityConfig(rawCatalog.utilities || fallback.utilities || {});

  return {
    ...fallback,
    ...rawCatalog,
    brand: mergedBrand,
    utilities: mergedUtilities,
    banners:
      Array.isArray(rawCatalog.banners) && rawCatalog.banners.length > 0
        ? rawCatalog.banners.map((b) => ({ ...b }))
        : (fallback.banners || []).map((b) => ({ ...b })),
    categories:
      Array.isArray(rawCatalog.categories) && rawCatalog.categories.length > 0
        ? rawCatalog.categories
        : fallback.categories,
    faqItems:
      Array.isArray(rawCatalog.faqItems) && rawCatalog.faqItems.length > 0
        ? rawCatalog.faqItems
        : fallback.faqItems,
  };
}

export function getDefaultCatalogSnapshot() {
  return {
    brand: {
      ...BRAND,
      payLaterSurchargeRate: PAY_LATER_SURCHARGE_RATE,
      openGraph: { ...(BRAND.openGraph || {}) },
      socials: (BRAND.socials || []).map((s) => ({ ...s })),
    },
    utilities: {
      callout: { ...UTILITIES.callout },
      musicHero: { ...UTILITIES.musicHero },
      items: UTILITIES.items.map((it) => ({ ...it })),
    },
    banners: BANNERS.map((b) => ({ ...b })),
    categories: CATEGORIES.map((c) => ({ ...c })),
    paymentOptions: PAYMENT_OPTIONS.map((p) => ({ ...p })),
    vouchers: VOUCHERS.map((v) => ({ ...v })),
    products: PRODUCTS.map((p) => ({
      ...p,
      variants: (p.variants || []).map((v) => ({ ...v })),
    })),
    faqItems: FAQ_ITEMS.map((f) => ({ ...f })),
  };
}

export async function loadCatalogData({ allowLocalPreview = true } = {}) {
  const fallback = getDefaultCatalogSnapshot();

  if (allowLocalPreview && typeof window !== 'undefined') {
    try {
      const previewRaw = window.localStorage.getItem(CATALOG_PREVIEW_STORAGE_KEY);
      if (previewRaw) {
        const parsedPreview = JSON.parse(previewRaw);
        if (parsedPreview && Array.isArray(parsedPreview.products)) {
          return {
            source: 'preview',
            data: normalizeLoadedCatalog(fallback, parsedPreview),
          };
        }
      }
    } catch {
      // Ignore storage restrictions
    }
  }

  try {
    const res = await fetch(`./data/catalog.json?t=${Date.now()}`, { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      if (json && Array.isArray(json.products)) {
        return {
          source: 'remote',
          data: normalizeLoadedCatalog(fallback, json),
        };
      }
    }
  } catch {
    // Offline or file fallback
  }

  return { source: 'fallback', data: fallback };
}


