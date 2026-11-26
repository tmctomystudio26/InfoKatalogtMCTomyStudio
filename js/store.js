/**
 * Pure storefront state, filtering, pricing, voucher, 10% pay-later fee,
 * clean WhatsApp message template formatting, and admin catalog helpers.
 * Zero DOM dependencies so all business logic can be unit tested directly.
 */

import { normalizeStoreAccessConfig } from './domain-router.js';

export function formatRupiah(amount) {
  const safeAmount = Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : 0;
  return `Rp${safeAmount.toLocaleString('id-ID')}`;
}

export function getStartingPrice(product) {
  if (!product || !Array.isArray(product.variants) || product.variants.length === 0) {
    return 0;
  }
  const priced = product.variants.map((v) => v.price).filter((p) => p > 0);
  if (priced.length === 0) return 0;
  return Math.min(...priced);
}

export function filterProducts(products, { category = 'all', query = '', inStockOnly = false } = {}) {
  const normalizedQuery = query.trim().toLowerCase();

  return products.filter((product) => {
    if (category !== 'all' && product.category !== category) {
      return false;
    }
    if (inStockOnly && product.outOfStock) {
      return false;
    }
    if (!normalizedQuery) {
      return true;
    }
    const inName = product.name.toLowerCase().includes(normalizedQuery);
    const inSummary = (product.summary || '').toLowerCase().includes(normalizedQuery);
    const inVariants = (product.variants || []).some((v) =>
      v.name.toLowerCase().includes(normalizedQuery)
    );
    return inName || inSummary || inVariants;
  });
}

export function addToCart(cart, entry) {
  const next = cart.map((item) => ({ ...item }));
  const existing = next.find(
    (item) => item.productId === entry.productId && item.variantId === entry.variantId
  );
  if (existing) {
    existing.quantity += 1;
  } else {
    next.push({
      productId: entry.productId,
      productName: entry.productName,
      variantId: entry.variantId,
      variantName: entry.variantName,
      price: entry.price,
      logo: entry.logo || '',
      quantity: 1,
    });
  }
  return next;
}

export function updateCartQty(cart, productId, variantId, delta) {
  const next = [];
  for (const item of cart) {
    if (item.productId === productId && item.variantId === variantId) {
      const updatedQty = item.quantity + delta;
      if (updatedQty > 0) {
        next.push({ ...item, quantity: updatedQty });
      }
    } else {
      next.push({ ...item });
    }
  }
  return next;
}

export function removeFromCart(cart, productId, variantId) {
  return cart.filter(
    (item) => !(item.productId === productId && item.variantId === variantId)
  );
}

export function normalizeVoucherUsageConfig(voucher = {}) {
  const rawMode = String(voucher?.usageMode || '').trim().toLowerCase();
  const rawMax = Number(voucher?.maxUses);

  if (rawMode === 'unlimited' || (rawMax === 0 && rawMode !== 'once' && rawMode !== 'limited')) {
    return { usageMode: 'unlimited', maxUses: 0, usageLabel: 'Tak Terbatas' };
  }
  if (rawMode === 'limited' || (Number.isFinite(rawMax) && rawMax > 1)) {
    const count = Math.max(2, Math.round(Number.isFinite(rawMax) && rawMax > 1 ? rawMax : 2));
    return { usageMode: 'limited', maxUses: count, usageLabel: `Maks. ${count}x Pakai` };
  }
  return { usageMode: 'once', maxUses: 1, usageLabel: '1x Pakai (Sekali)' };
}

function getVoucherUsedCount(cleanCode, usedVouchers) {
  if (!cleanCode || !usedVouchers) return 0;
  if (Array.isArray(usedVouchers)) {
    return usedVouchers.filter(
      (v) => String(v || '').trim().toUpperCase() === cleanCode
    ).length;
  }
  if (typeof usedVouchers === 'object') {
    const val = usedVouchers[cleanCode] ?? usedVouchers[cleanCode.toLowerCase()];
    return Math.max(0, Math.floor(Number(val) || 0));
  }
  return 0;
}

export function evaluateVoucher(codeInput = '', subtotal = 0, vouchers = [], usedVouchers = []) {
  const cleanCode = String(codeInput || '').trim().toUpperCase();
  if (!cleanCode) {
    return {
      status: 'none',
      code: '',
      discount: 0,
      message: '',
    };
  }

  const matched = Array.isArray(vouchers)
    ? vouchers.find((v) => String(v.code || '').trim().toUpperCase() === cleanCode)
    : null;

  if (!matched) {
    return {
      status: 'invalid',
      code: cleanCode,
      discount: 0,
      message: `Kode voucher "${cleanCode}" tidak valid atau tidak terdaftar.`,
    };
  }

  const usageCfg = normalizeVoucherUsageConfig(matched);
  const usedCount = getVoucherUsedCount(cleanCode, usedVouchers);

  if (usageCfg.usageMode === 'once' && usedCount >= 1) {
    return {
      status: 'used',
      code: cleanCode,
      discount: 0,
      usageMode: usageCfg.usageMode,
      maxUses: 1,
      usedCount,
      message: `Kode voucher "${cleanCode}" sudah pernah digunakan (batas 1x pakai).`,
    };
  }

  if (usageCfg.usageMode === 'limited' && usedCount >= usageCfg.maxUses) {
    return {
      status: 'used',
      code: cleanCode,
      discount: 0,
      usageMode: usageCfg.usageMode,
      maxUses: usageCfg.maxUses,
      usedCount,
      message: `Kode voucher "${cleanCode}" telah mencapai batas pemakaian (${usageCfg.maxUses}x pakai).`,
    };
  }

  if (subtotal < (matched.minSubtotal || 0)) {
    return {
      status: 'ineligible',
      code: cleanCode,
      discount: 0,
      usageMode: usageCfg.usageMode,
      maxUses: usageCfg.maxUses,
      usedCount,
      message: `Kode ${cleanCode} aktif untuk minimal belanja ${formatRupiah(matched.minSubtotal)}.`,
    };
  }

  let rawDiscount = 0;
  if (matched.type === 'percent') {
    rawDiscount = Math.round((subtotal * matched.value) / 100);
    if (matched.maxDiscount > 0) {
      rawDiscount = Math.min(rawDiscount, matched.maxDiscount);
    }
  } else {
    rawDiscount = Math.round(matched.value || 0);
  }

  const discount = Math.max(0, Math.min(subtotal, rawDiscount));
  const remainingText =
    usageCfg.usageMode === 'unlimited'
      ? 'Tak terbatas'
      : usageCfg.usageMode === 'limited'
      ? `Sisa ${Math.max(0, usageCfg.maxUses - usedCount)}x pakai`
      : 'Sekali pakai';

  return {
    status: 'applied',
    code: cleanCode,
    discount,
    usageMode: usageCfg.usageMode,
    maxUses: usageCfg.maxUses,
    usedCount,
    message: `Voucher ${cleanCode} aktif (-${formatRupiah(discount)}) · ${remainingText}.`,
  };
}

export function calculateCartTotals(
  cart,
  {
    discountThreshold = 50000,
    discountAmount = 2000,
    voucherCode = '',
    vouchers = [],
    usedVouchers = [],
    paymentOption = 'Bayar Sekarang',
    payLaterRate = 0.1,
    serviceFeeFlat = 0,
    serviceFeeLabel = 'Biaya Layanan',
  } = {}
) {
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const qualifiesDiscount = subtotal >= discountThreshold && subtotal > 0;
  const discount = qualifiesDiscount ? discountAmount : 0;
  const afterAutoDiscount = Math.max(0, subtotal - discount);

  const voucherResult = evaluateVoucher(voucherCode, subtotal, vouchers, usedVouchers);
  const voucherDiscount = Math.min(afterAutoDiscount, voucherResult.discount);
  const afterDiscounts = Math.max(0, afterAutoDiscount - voucherDiscount);

  const safePayLaterRate = Number.isFinite(Number(payLaterRate))
    ? Math.max(0, Number(payLaterRate))
    : 0.1;
  const payLaterPercent = Math.round(safePayLaterRate * 1000) / 10;

  const serviceFee =
    itemCount > 0 ? Math.max(0, Math.round(Number(serviceFeeFlat) || 0)) : 0;

  const isPayLater =
    paymentOption === 'Bayar Belakangan (Setelah Akun Diterima)' ||
    String(paymentOption || '').toLowerCase().includes('belakangan') ||
    String(paymentOption || '').toLowerCase().includes('bayar nanti');
  const payLaterFee =
    isPayLater && afterDiscounts > 0
      ? Math.round(afterDiscounts * safePayLaterRate)
      : 0;

  const total = afterDiscounts + serviceFee + payLaterFee;
  const remainingForDiscount = Math.max(0, discountThreshold - subtotal);
  const progressPercent = Math.min(
    100,
    Math.round((subtotal / Math.max(1, discountThreshold)) * 100)
  );

  return {
    itemCount,
    subtotal,
    discount,
    voucherCode: voucherResult.code,
    voucherStatus: voucherResult.status,
    voucherDiscount,
    voucherMessage: voucherResult.message,
    afterDiscounts,
    serviceFee,
    serviceFeeFlat: serviceFee,
    serviceFeeLabel: String(serviceFeeLabel || 'Biaya Layanan').trim() || 'Biaya Layanan',
    isPayLater,
    payLaterRate: safePayLaterRate,
    payLaterPercent,
    payLaterFee,
    total,
    qualifiesDiscount,
    remainingForDiscount,
    progressPercent,
  };
}

export function validateOrderForm({ customerName, paymentOption, cart }) {
  if (!Array.isArray(cart) || cart.length === 0) {
    return { valid: false, error: 'Keranjang belanja masih kosong. Pilih minimal satu paket.' };
  }
  if (!customerName || !customerName.trim()) {
    return { valid: false, error: 'Masukkan nama panggilan Anda untuk identifikasi pesanan.' };
  }
  if (!paymentOption || !paymentOption.trim()) {
    return { valid: false, error: 'Pilih metode pembayaran terlebih dahulu.' };
  }
  return { valid: true, error: null };
}

export function generateOrderCode(now = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const yy = String(now.getFullYear()).slice(-2);
  const mm = pad(now.getMonth() + 1);
  const dd = pad(now.getDate());
  const hh = pad(now.getHours());
  const min = pad(now.getMinutes());
  const sec = pad(now.getSeconds());
  return `MS-${yy}${mm}${dd}-${hh}${min}${sec}`;
}

export function buildWhatsAppOrderCaption({
  orderCode = '',
  brandName = 'Manifestudio',
  customerName,
  whatsappNote = '',
  paymentOption,
  cart,
  totals,
}) {
  const payLaterPct =
    totals?.payLaterPercent !== undefined
      ? totals.payLaterPercent
      : Math.round(Number(totals?.payLaterRate ?? 0.1) * 1000) / 10;
  const headerBrand = String(brandName || 'Manifestudio').trim().toUpperCase() || 'MANIFESTUDIO';

  const lines = [
    `*PESANAN BARU — ${headerBrand}*`,
    ...(orderCode ? [`No. Pesanan: *${orderCode}*`] : []),
    `Pemesan: *${customerName.trim()}*`,
    '',
    '*Rincian Paket:*',
  ];

  cart.forEach((item, index) => {
    const lineTotal = item.price * item.quantity;
    const priceText = item.price === 0 ? 'Custom / Tanya Admin' : formatRupiah(lineTotal);
    lines.push(`${index + 1}. ${item.productName} — ${item.variantName}`);
    lines.push(`   Jumlah: ${item.quantity}x · Harga: ${priceText}`);
  });

  lines.push('');
  lines.push('*Ringkasan Tagihan:*');
  lines.push(`• Subtotal: ${formatRupiah(totals.subtotal)}`);
  if (totals.discount > 0) {
    lines.push(`• Diskon Belanja: -${formatRupiah(totals.discount)}`);
  }
  if (totals.voucherCode && totals.voucherDiscount > 0) {
    lines.push(`• Voucher (${totals.voucherCode}): -${formatRupiah(totals.voucherDiscount)}`);
  }
  if (totals.serviceFee > 0) {
    lines.push(
      `• ${totals.serviceFeeLabel || 'Biaya Layanan'}: +${formatRupiah(totals.serviceFee)}`
    );
  }
  if (totals.isPayLater) {
    if (totals.payLaterFee > 0) {
      lines.push(`• Biaya Bayar Nanti (+${payLaterPct}%): +${formatRupiah(totals.payLaterFee)}`);
    } else {
      lines.push(`• Biaya Bayar Nanti: +${payLaterPct}% dari harga final`);
    }
  }
  lines.push(`• *Total Bayar: ${formatRupiah(totals.total)}*`);

  lines.push('');
  lines.push('*Informasi Pembayaran:*');
  lines.push(`• Metode: ${paymentOption}`);
  if (whatsappNote.trim()) {
    lines.push(`• Catatan / Email: ${whatsappNote.trim()}`);
  }

  lines.push('');
  lines.push(
    '_Struk belanja otomatis sudah diunduh di perangkat saya (siap dilampirkan jika diperlukan). Mohon diproses ya Admin, terima kasih._'
  );

  return lines.join('\n');
}

export function buildWhatsAppOrderMessage(params) {
  return encodeURIComponent(buildWhatsAppOrderCaption(params));
}

export const PENDING_ORDER_STORAGE_KEY = 'manifestudio_pending_order_v1';

export function createOrderSnapshot({
  orderCode,
  brandName = 'Manifestudio',
  whatsappNumber = '6285122936027',
  customerName,
  whatsappNote = '',
  paymentOption,
  cart = [],
  totals,
  now = new Date(),
}) {
  const safeBrandName = String(brandName || 'Manifestudio').trim() || 'Manifestudio';
  const safeCart = (Array.isArray(cart) ? cart : []).map((item) => ({
    productId: item.productId,
    productName: item.productName,
    variantId: item.variantId,
    variantName: item.variantName,
    price: item.price,
    logo: item.logo || '',
    quantity: item.quantity,
  }));
  const caption = buildWhatsAppOrderCaption({
    orderCode,
    brandName: safeBrandName,
    customerName,
    whatsappNote,
    paymentOption,
    cart: safeCart,
    totals,
  });

  return {
    orderCode,
    brandName: safeBrandName,
    createdAt: now instanceof Date ? now.toISOString() : String(now),
    whatsappNumber: String(whatsappNumber || '6285122936027'),
    customerName: String(customerName || '').trim(),
    whatsappNote: String(whatsappNote || '').trim(),
    paymentOption,
    cart: safeCart,
    totals: { ...totals },
    caption,
    whatsappUrl: `https://wa.me/${String(whatsappNumber || '6285122936027')}?text=${encodeURIComponent(caption)}`,
  };
}

export function slugifyId(text) {
  return (
    String(text || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || `item-${Date.now()}`
  );
}

export function normalizeBrandSocials(brand = {}) {
  const waNum = String(brand?.whatsappNumber || '6285122936027').replace(/[^0-9]/g, '') || '6285122936027';
  if (Array.isArray(brand?.socials) && brand.socials.length > 0) {
    return brand.socials
      .filter((s) => s && (String(s.label || '').trim() || String(s.url || '').trim()))
      .map((s, idx) => ({
        id: String(s.id || `social-${idx + 1}`).trim(),
        platform: String(s.platform || s.label || 'Sosmed').trim(),
        label: String(s.label || s.platform || 'Sosmed').trim(),
        handle: String(s.handle || '').trim(),
        url: String(s.url || '#').trim(),
        logo: String(s.logo || './assets/icons/social-globe.svg').trim(),
      }));
  }

  const defaults = [
    {
      id: 'social-whatsapp',
      platform: 'WhatsApp',
      label: 'WhatsApp Admin',
      handle: `+${waNum}`,
      url: `https://wa.me/${waNum}`,
      logo: './assets/icons/social-whatsapp.svg',
    },
  ];
  if (brand?.tiktokUrl || brand?.tiktokHandle) {
    const handle = brand.tiktokHandle || '@tmctomystudio';
    defaults.push({
      id: 'social-tiktok',
      platform: 'TikTok',
      label: `TikTok ${handle}`,
      handle,
      url: brand.tiktokUrl || 'https://www.tiktok.com/@tmctomystudio',
      logo: './assets/icons/social-tiktok.svg',
    });
  }
  if (brand?.instagramUrl || brand?.instagramHandle) {
    const handle = brand.instagramHandle || '@tmctomystudio';
    defaults.push({
      id: 'social-instagram',
      platform: 'Instagram',
      label: `Instagram ${handle}`,
      handle,
      url: brand.instagramUrl || 'https://www.instagram.com/tmctomystudio',
      logo: './assets/icons/social-instagram.svg',
    });
  }
  return defaults;
}

export const DEFAULT_OPEN_GRAPH = {
  title: 'Manifestudio — Katalog Akun Premium & Menu Utilitas Digital',
  description:
    'Pesan Netflix, Canva Pro, YouTube, Spotify, Viu, Vidio, Alight Motion, WeTV & Prime Video instan. Dilengkapi Jadwal Sholat Kemenag RI, Prakiraan Cuaca, Jam Dunia UTC, Speedtest, Downloader & Kompres Media HD.',
  tagline: 'Premium Account & Utilitas Digital by Tomy',
  image: './assets/og-manifestudio.jpg',
  imageAlt: 'Manifestudio — Katalog Akun Premium & Layanan Digital Terpercaya',
  siteName: 'Manifestudio',
};

export const VALID_BANNER_SCRIMS = [
  'default',
  'prayer',
  'weather',
  'world',
  'downloader',
  'crimson',
  'emerald',
  'violet',
  'amber',
];

const LEGACY_SCRIM_MAP = {
  '': 'default',
  default: 'default',
  'is-emerald': 'emerald',
  'is-sky': 'weather',
  'is-indigo': 'world',
  'is-cyan': 'prayer',
  'is-violet': 'violet',
  'is-crimson': 'crimson',
  'is-amber': 'amber',
};

export function normalizeBannerScrim(rawScrim = 'default') {
  const key = String(rawScrim ?? '').trim();
  if (VALID_BANNER_SCRIMS.includes(key)) return key;
  if (Object.prototype.hasOwnProperty.call(LEGACY_SCRIM_MAP, key)) {
    return LEGACY_SCRIM_MAP[key];
  }
  return 'default';
}

export function inferBannerUtilityId(banner = {}) {
  const explicit = String(banner?.utilityId || '').trim();
  if (explicit) return explicit;
  const href = String(banner?.href || '').trim();
  const match = href.match(/[?&](?:tab|tool)=([a-z0-9_-]+)/i);
  if (match && match[1]) return match[1].toLowerCase();
  const idMatch = String(banner?.id || '').match(/^banner-(prayer|weather|worldclock|speedtest|downloader|shortlink|donate|compressor|converter|songfinder|music|dracin|audioeditor|manifestai|plagiarism|novel|callerid)$/i);
  return idMatch ? idMatch[1].toLowerCase() : '';
}

export const DEFAULT_BANNERS = [
  {
    id: 'banner-katalog',
    utilityId: '',
    kicker: 'Katalog Utama · Garansi Jelas',
    heading: 'Akun Premium Favorit, Aktif Dalam Hitungan Menit',
    sub: 'Netflix, Canva Pro, Spotify & 15+ layanan. Diskon otomatis mulai Rp50rb, voucher, & Bayar Nanti.',
    ctaLabel: 'Lihat Katalog →',
    href: '#katalog',
    image: './assets/banners/banner-katalog.jpg',
    scrim: 'default',
    enabled: true,
  },
  {
    id: 'banner-prayer',
    utilityId: 'prayer',
    kicker: 'Menu Utilitas · Kemenag RI',
    heading: 'Jadwal Sholat & Imsakiyah Presisi Lokasi',
    sub: 'Hitung mundur adzan otomatis sesuai GPS & kecamatan se-Indonesia lengkap waktu Imsak hingga Isya.',
    ctaLabel: 'Buka Jadwal Sholat →',
    href: './tools.html?tab=prayer',
    image: './assets/banners/banner-prayer.jpg',
    scrim: 'emerald',
    enabled: true,
  },
  {
    id: 'banner-weather',
    utilityId: 'weather',
    kicker: 'Menu Utilitas · Radar Live',
    heading: 'Pantau Cuaca Real-Time & Prakiraan 7 Hari',
    sub: 'Cek suhu aktual, curah hujan per jam, UV, angin, & kondisi langit sebelum beraktivitas.',
    ctaLabel: 'Cek Cuaca →',
    href: './tools.html?tab=weather',
    image: './assets/banners/banner-weather.jpg',
    scrim: 'weather',
    enabled: true,
  },
  {
    id: 'banner-worldclock',
    utilityId: 'worldclock',
    kicker: 'Menu Utilitas · Standar UTC',
    heading: 'Putar Globe 3D & Konversi WIB / WITA / WIT',
    sub: 'Klik negara di bola dunia interaktif untuk membandingkan zona waktu internasional secara instan.',
    ctaLabel: 'Buka Jam Dunia →',
    href: './tools.html?tab=worldclock',
    image: './assets/banners/banner-worldclock.jpg',
    scrim: 'world',
    enabled: true,
  },
  {
    id: 'banner-speedtest',
    utilityId: 'speedtest',
    kicker: 'Menu Utilitas · Edge Speed',
    heading: 'Uji Kecepatan Internet, Ping & Jitter Real-Time',
    sub: 'Cek download, upload, latensi gaming, info ISP, dan server terdekat cukup sekali klik.',
    ctaLabel: 'Mulai Speedtest →',
    href: './tools.html?tab=speedtest',
    image: './assets/banners/banner-speedtest.jpg',
    scrim: 'prayer',
    enabled: true,
  },
  {
    id: 'banner-downloader',
    utilityId: 'downloader',
    kicker: 'Menu Utilitas · Tanpa Watermark',
    heading: 'Downloader Video, Foto, Story & Audio Sosmed',
    sub: 'Simpan video HD TikTok, IG, YT, FB, slide carousel, & salin caption langsung tanpa watermark.',
    ctaLabel: 'Buka Downloader →',
    href: './tools.html?tab=downloader',
    image: './assets/banners/banner-downloader.jpg',
    scrim: 'downloader',
    enabled: true,
  },
  {
    id: 'banner-compressor',
    utilityId: 'compressor',
    kicker: 'Menu Utilitas · Anti-Pecah Sosmed',
    heading: 'Kompres Foto & Video HD Tanpa Turun Kualitas',
    sub: 'Perkecil ukuran file secara nyata dengan AVIF/WebP & FFmpeg agar unggahan TikTok, IG & WA tetap tajam.',
    ctaLabel: 'Kompres Media →',
    href: './tools.html?tab=compressor',
    image: './assets/banners/banner-compressor.jpg',
    scrim: 'emerald',
    enabled: true,
  },
  {
    id: 'banner-converter',
    utilityId: 'converter',
    kicker: 'Menu Utilitas · 85+ Format File',
    heading: 'Konversi DOCX, PDF, Excel, Foto, Video & Audio',
    sub: 'Deteksi format otomatis untuk ubah dokumen, gambar, arsip ZIP, hingga audio instan di browser.',
    ctaLabel: 'Konversi File →',
    href: './tools.html?tab=converter',
    image: './assets/banners/banner-converter.jpg',
    scrim: 'amber',
    enabled: true,
  },
  {
    id: 'banner-songfinder',
    utilityId: 'songfinder',
    kicker: 'Menu Utilitas · 9 Engine AI',
    heading: 'Cari Judul Lagu & Sumber Video dari Potongan',
    sub: 'Unggah rekaman audio atau klip video untuk lacak judul, lirik, & link resmi hingga ~100% akurat.',
    ctaLabel: 'Cari Lagu →',
    href: './tools.html?tab=songfinder',
    image: './assets/banners/banner-songfinder.jpg',
    scrim: 'violet',
    enabled: true,
  },
  {
    id: 'banner-music',
    utilityId: 'music',
    kicker: 'Menu Utilitas · Bebas Iklan',
    heading: 'YT Music Hub — Streaming Musik Gratis Full',
    sub: 'Putar lagu viral Indonesia & mancanegara tanpa iklan, lengkap pemutar mini mengambang.',
    ctaLabel: 'Putar Musik →',
    href: './tools.html?tab=music',
    image: './assets/banners/banner-music.jpg',
    scrim: 'crimson',
    enabled: true,
  },
  {
    id: 'banner-dracin',
    utilityId: 'dracin',
    kicker: 'Menu Utilitas · 20+ Platform Terpadu',
    heading: 'Nonton Drama Pendek Full Episode Gratis',
    sub: 'Satukan drama pendek Indonesia, China & global dalam satu player bebas iklan, lompat episode bebas, & subtitle Indonesia.',
    ctaLabel: 'Tonton Drama →',
    href: './tools.html?tab=dracin',
    image: './assets/banners/banner-dracin.jpg',
    scrim: 'crimson',
    enabled: true,
  },
  {
    id: 'banner-audioeditor',
    utilityId: 'audioeditor',
    kicker: 'Menu Utilitas · Studio DSP & AI',
    heading: 'Audio Editor — EQ 10-Band, Pisah Vokal & Mix',
    sub: 'Potong audio, hapus noise, ubah suara, pisah karaoke, & ekspor MP3/WAV/FLAC langsung di web.',
    ctaLabel: 'Buka Studio →',
    href: './tools.html?tab=audioeditor',
    image: './assets/banners/banner-audioeditor.jpg',
    scrim: 'violet',
    enabled: true,
  },
  {
    id: 'banner-manifestai',
    utilityId: 'manifestai',
    kicker: 'Menu Utilitas · Multi-Model AI',
    heading: 'Manifest AI — Gabungan Model Cerdas Gratis',
    sub: 'Ngobrol dengan ensemble AI modern, memori konsisten, failover otomatis, & dukung API Key pribadi.',
    ctaLabel: 'Chat Manifest AI →',
    href: './tools.html?tab=manifestai',
    image: './assets/banners/banner-manifestai.jpg',
    scrim: 'world',
    enabled: true,
  },
  {
    id: 'banner-plagiarism',
    utilityId: 'plagiarism',
    kicker: 'Menu Utilitas · Format Turnitin',
    heading: 'Cek Plagiarisme Dokumen Asli + Laporan PDF',
    sub: 'Pertahankan tata letak dokumen asli dengan sorotan warna sumber & unduh laporan ala Turnitin.',
    ctaLabel: 'Cek Plagiarisme →',
    href: './tools.html?tab=plagiarism',
    image: './assets/banners/banner-plagiarism.jpg',
    scrim: 'prayer',
    enabled: true,
  },
  {
    id: 'banner-novel',
    utilityId: 'novel',
    kicker: 'Menu Utilitas · 122+ Tema & Suara',
    heading: 'Baca Novel Terpadu Gratis Penuh Real-Time',
    sub: 'Katalog novel lintas platform bebas kunci VIP, cari dari cuplikan, tema animasi, & mode audiobook.',
    ctaLabel: 'Baca Novel →',
    href: './tools.html?tab=novel',
    image: './assets/banners/banner-novel.jpg',
    scrim: 'amber',
    enabled: true,
  },
  {
    id: 'banner-callerid',
    utilityId: 'callerid',
    kicker: 'Menu Utilitas · 5 API Open-Source',
    heading: 'Cek Nomor, Caller ID & Anti-Spam Gratis',
    sub: 'Lacak operator HLR, kode area, verifikasi hotline resmi Bank/OJK, & cek laporan spam tanpa login.',
    ctaLabel: 'Cek Nomor →',
    href: './tools.html?tab=callerid',
    image: './assets/banners/banner-callerid.jpg',
    scrim: 'emerald',
    enabled: true,
  },
  {
    id: 'banner-shortlink',
    utilityId: 'shortlink',
    kicker: 'Menu Utilitas · Multi-API & Multi-AI',
    heading: 'Shortlink Bypass — Anti-Iklan, Pop-Up & Malware',
    sub: 'Lewati tautan pemendek & safelink berulang dengan kolaborasi Multi-API & Multi-AI, bersihkan pelacak, & cek keamanan tujuan.',
    ctaLabel: 'Bypass Link →',
    href: './tools.html?tab=shortlink',
    image: './assets/banners/banner-shortlink.jpg',
    scrim: 'downloader',
    enabled: true,
  },
  {
    id: 'banner-donate',
    utilityId: 'donate',
    kicker: 'Menu Utilitas · Saweria & SociaBuzz Tribe',
    heading: 'Please Donate — Dukung Manifestudio & Masuk Top Donatur',
    sub: 'Kirim dukungan via Saweria atau SociaBuzz Tribe. Nama, pesan dukungan, dan peringkat Leaderboard terupdate otomatis real-time.',
    ctaLabel: 'Buka Please Donate →',
    href: './tools.html?tab=donate',
    image: './assets/banners/banner-donate.jpg',
    scrim: 'amber',
    enabled: true,
  },
];

export function normalizeOpenGraphConfig(brand = {}) {
  const rawOg =
    brand?.openGraph && typeof brand.openGraph === 'object' ? brand.openGraph : {};
  const brandName = String(brand?.name || 'Manifestudio').trim() || 'Manifestudio';
  return {
    title:
      String(rawOg.title || DEFAULT_OPEN_GRAPH.title).trim() || DEFAULT_OPEN_GRAPH.title,
    description:
      String(rawOg.description || DEFAULT_OPEN_GRAPH.description).trim() ||
      DEFAULT_OPEN_GRAPH.description,
    tagline:
      String(rawOg.tagline || DEFAULT_OPEN_GRAPH.tagline).trim() ||
      DEFAULT_OPEN_GRAPH.tagline,
    image:
      String(rawOg.image || DEFAULT_OPEN_GRAPH.image).trim() || DEFAULT_OPEN_GRAPH.image,
    imageAlt:
      String(rawOg.imageAlt || DEFAULT_OPEN_GRAPH.imageAlt).trim() ||
      DEFAULT_OPEN_GRAPH.imageAlt,
    siteName: String(rawOg.siteName || brandName).trim() || brandName,
  };
}

export function normalizeBanners(banners, fallbackBanners = DEFAULT_BANNERS) {
  const source =
    Array.isArray(banners) && banners.length > 0
      ? banners
      : Array.isArray(fallbackBanners) && fallbackBanners.length > 0
      ? fallbackBanners
      : DEFAULT_BANNERS;

  return source
    .filter((b) => b && (String(b.heading || '').trim() || String(b.kicker || '').trim()))
    .map((b, idx) => {
      const utilityId = inferBannerUtilityId(b);
      const rawHeading = String(b.heading || 'Manifestudio').trim();
      const rawCta = String(b.ctaLabel || 'Selengkapnya').trim() || 'Selengkapnya';
      const heading =
        utilityId === 'dracin' && /^Nonton Drama China Full Episode Gratis$/i.test(rawHeading)
          ? 'Nonton Drama Pendek Full Episode Gratis'
          : rawHeading;
      const ctaLabel =
        utilityId === 'dracin' && /^Tonton Dracin\s*→?$/i.test(rawCta)
          ? 'Tonton Drama →'
          : rawCta;
      return {
        id: String(b.id || `banner-${idx + 1}`).trim(),
        utilityId,
        kicker: String(b.kicker || 'Promo & Info')
          .trim()
          .replace(/^Menu Lainnya\b/i, 'Menu Utilitas'),
        heading,
        sub: String(b.sub || '').trim(),
        ctaLabel,
        href: String(b.href || '#katalog').trim() || '#katalog',
        image: String(b.image ?? '').trim(),
        scrim: normalizeBannerScrim(b.scrim),
        enabled: b.enabled !== false,
      };
    });
}

export const DEFAULT_UTILITY_CONFIG = {
  callout: {
    icon: './assets/icons/menu-utilitas.svg',
    title: 'Menu Utilitas',
    badge: '17 Fitur Gratis',
    description: '',
    autoCountBadge: true,
  },
  musicHero: {
    icon: './assets/icons/tool-music.svg',
    title: 'YT Music Hub — Viral Indonesia & Pencarian Lengkap',
    subtitle:
      'Sumber resmi YT Music API komunitas open-source. Pemutaran acak otomatis memprioritaskan lagu Indonesia viral setiap kali tombol apa saja ditekan, tanpa bergantung pada riwayat pencarian.',
  },
  items: [
    {
      id: 'prayer',
      label: 'Jadwal Sholat',
      icon: './assets/icons/tool-prayer.svg',
      pageTitle: 'Jadwal Sholat & Imsakiyah',
      pageSubtitle:
        'Waktu sholat resmi Kemenag RI (WIB/WITA/WIT) lengkap dengan hitung mundur waktu sholat berikutnya.',
      heroKicker: 'Kemenag RI · Waktu Sholat Resmi',
      heroTitle: 'Jadwal Sholat & Imsakiyah Harian',
      heroDescription:
        'Deteksi lokasi otomatis atau pilih Kelurahan, Kecamatan, dan Kab/Kota se-Indonesia lengkap dengan hitung mundur adzan.',
    },
    {
      id: 'weather',
      label: 'Prakiraan Cuaca',
      icon: './assets/icons/tool-weather.svg',
      pageTitle: 'Prakiraan Cuaca Real-Time',
      pageSubtitle:
        'Kondisi cuaca saat ini, curah hujan presisi per jam, kelembapan, UV, angin, & prakiraan 7 hari ke depan.',
      heroKicker: 'Multi-Sensor Radar Curah Hujan',
      heroTitle: 'Prakiraan Cuaca Presisi Real-Time',
      heroDescription:
        'Pantau suhu, kelembapan, indeks UV, kecepatan angin, hujan per jam, serta prakiraan 7 hari ke depan.',
    },
    {
      id: 'worldclock',
      label: 'Jam Dunia & Globe',
      icon: './assets/icons/tool-world.svg',
      pageTitle: 'Jam Dunia UTC & Bola Dunia',
      pageSubtitle:
        'Standar waktu internasional UTC/GMT, WIB, WITA, WIT, serta konversi waktu lintas negara.',
      heroKicker: 'Standar Internasional UTC/GMT · WIB · WITA · WIT',
      heroTitle: 'Bola Dunia Interaktif & Konverter Waktu',
      heroDescription:
        'Putar bola dunia interaktif untuk memilih negara dan konversi waktu lintas zona secara instan.',
    },
    {
      id: 'speedtest',
      label: 'Speedtest',
      icon: './assets/icons/tool-speed.svg',
      pageTitle: 'Speedtest Internet Real-Time',
      pageSubtitle:
        'Uji kecepatan rata-rata download, upload, ping, jitter, lokasi server, ISP, dan perangkat Anda.',
      heroKicker: 'Cloudflare Speed Edge',
      heroTitle: 'Tes Kecepatan Internet',
      heroDescription:
        'Uji kecepatan download, upload, ping, jitter, dan latensi beban koneksi internet Anda secara langsung.',
    },
    {
      id: 'downloader',
      label: 'Downloader',
      icon: './assets/icons/tool-downloader.svg',
      pageTitle: 'Downloader Video, Foto, Carousel & Story',
      pageSubtitle:
        'Unduh video HD, postingan foto, slide carousel, story, & salin caption dari TikTok, IG, YT, dan FB.',
      heroKicker: 'Video · Foto · Multi-Slide · Story · Salin Caption',
      heroTitle: 'Downloader Media Sosial All-in-One',
      heroDescription:
        'Unduh Video HD, Postingan Foto, Slide Carousel (Banyak Foto), Story Sosmed, & Salin Caption dari TikTok, Instagram, YouTube, dan Facebook.',
    },
    {
      id: 'compressor',
      label: 'Kompresor HD',
      icon: './assets/icons/tool-compressor.svg',
      pageTitle: 'Kompresor Foto & Video HD (Anti-Pecah Sosmed)',
      pageSubtitle:
        '6 metode kompresi AI & Open-Source (Multi-AI Tanpa Key, AVIF/WebP 2-Pass, & FFmpeg WASM) agar lolos kompresi ulang TikTok, IG, & WA.',
      heroKicker: 'AI Hybrid & Open-Source Engine · Multi-AI / AVIF / WebP / FFmpeg WASM',
      heroTitle: 'Kompres Foto & Video HD Nyata Tanpa Pecah di Sosmed',
      heroDescription:
        'Didukung Multi-AI Publik tanpa API key, codec generasi baru AVIF/WebP/MozJPEG, Unsharp Clarity, & FFmpeg WASM untuk memangkas ukuran file secara nyata sambil menjaga ketajaman HD.',
    },
    {
      id: 'converter',
      label: 'Konversi File',
      icon: './assets/icons/tool-converter.svg',
      pageTitle: 'Konversi Semua Format File (All-in-One Converter)',
      pageSubtitle:
        'Konversi DOCX ke PDF, Excel ke PDF/CSV, PDF ke JPG/PNG, JPG ke PNG/JPEG/WebP/ZIP, serta MP4 ke M4A/WAV/MP3 secara instan.',
      heroKicker: 'All-in-One File Converter · 85+ Konversi Multi-Format & OpenXML',
      heroTitle: 'Konversi Semua Format File (DOCX, Excel, PDF, Foto, Video, Audio & ZIP)',
      heroDescription:
        'Masukkan file apa saja di bawah ini — sistem otomatis mendeteksi format berkas asal Anda dan menampilkan pilihan format konversi tujuan dalam daftar dropdown ringkas.',
    },
    {
      id: 'songfinder',
      label: 'Cari Judul Lagu',
      icon: './assets/icons/tool-songfinder.svg',
      pageTitle: 'Cari Judul Lagu, Musik & Sumber Video (Multi-API & AI Identifier)',
      pageSubtitle:
        'Unggah file audio atau video untuk mendeteksi judul lagu dengan kemiripan hingga ~100%, lengkap dengan link YouTube, Spotify, Apple Music, TikTok, IG Reels & sumber video mirip.',
      heroKicker: 'AudD Shazam-Grade · Whisper Lirik AI · Multi-AI & Video Similarity (9 Engine)',
      heroTitle: 'Cari Judul Lagu, Lirik, Kemiripan Musik & Sumber Video (Otomatis Audio/Video)',
      heroDescription:
        'Masukkan file Audio (MP3, WAV, M4A, AAC, OGG, FLAC) maupun Video (MP4, MOV, WebM, MKV). Sistem membaca gelombang suara asli via AudD Fingerprinting, mentranskrip vokal via Whisper Large v3 Turbo, mencocokkan lirik di LRCLIB & Lyrics.ovh, menghitung Shazam Landmark Hash + Cosine Acoustic Similarity, dan menggabungkan Multi-AI Publik Gratis + Apple Music, Spotify, Shazam, YouTube & TikTok.',
    },
    {
      id: 'music',
      label: 'Musik YT',
      icon: './assets/icons/tool-music.svg',
      pageTitle: 'YT Music Player — Viral Indonesia',
      pageSubtitle:
        'Pemutar YT Music API bebas iklan dengan daftar putar acak otomatis lagu Indonesia viral, pencarian lengkap, & sinkron dengan ikon mengambang.',
      heroKicker: 'YT Music API · Bebas Iklan',
      heroTitle: 'Pemutar YT Music & Daftar Putar Viral',
      heroDescription:
        'Putar lagu Indonesia viral tanpa iklan, cari musik favorit, kelola daftar putar, & sinkron dengan tombol putar mengambang.',
    },
    {
      id: 'dracin',
      label: 'Drama Pendek',
      icon: './assets/icons/tool-dracin.svg',
      pageTitle: 'Drama Pendek Gratis Tanpa Iklan — Indonesia, China & Global (20+ Platform)',
      pageSubtitle:
        'Drama Pendek Indonesia, China & global dari DramaBox, Melolo, PineDrama, NetShort, GoodShort, FlickReels, ReelShort, ShortMax & 12+ platform lain bebas lompat episode 100% gratis & subtitle Indonesia.',
      heroKicker: '20+ Platform Drama Pendek · Indonesia, China & Global · Full Gratis',
      heroTitle: 'Nonton Drama Pendek Gratis Tanpa Iklan',
      heroDescription:
        'Satukan Drama Pendek Indonesia, DramaBox, Melolo, PineDrama, NetShort, GoodShort, FlickReels, FreeReels, ReelShort, ShortMax, DramaWave, MyDrama, StardustTV, FlexTV, KalosTV, Vigloo & Anichin full episode gratis tanpa VIP.',
    },
    {
      id: 'audioeditor',
      label: 'Audio Editor',
      icon: './assets/icons/tool-audioeditor.svg',
      pageTitle: 'Audio Editor Studio AI — Mastering, EQ & Pisah Vokal',
      pageSubtitle:
        'Pangkas, naikkan volume, ubah suara, Equalizer 10-band, penstabil noise, pemisah vokal & musik, perbaikan audio, edit identitas ID3/RIFF, mix multi-trek, Multi-AI, & ekspor MP3/WAV/M4A/OGG/FLAC.',
      heroKicker: 'Web Audio DSP · FFmpeg WASM · LAME MP3 · Multi-AI Studio',
      heroTitle: 'Studio Editor Audio Lengkap & Asisten Mastering AI',
      heroDescription:
        'Edit audio langsung di browser dengan pemotong presisi, 10-Band EQ, Voice Changer, penjernih & perbaikan audio, pemisah vokal/karaoke, mixer multi-trek, editor tag resmi iTunes/MusicBrainz, serta dukungan Multi-AI (ChatGPT, Claude, Gemini, DeepSeek, Grok).',
    },
    {
      id: 'manifestai',
      label: 'Manifest AI',
      icon: './assets/icons/tool-manifestai.svg',
      pageTitle: 'Manifest AI — Chat Multi-Model Gratis & API Key Pribadi',
      pageSubtitle:
        'Gabungkan Gemini, ChatGPT, DeepSeek, Claude, Grok, Meta, Qwen & Mistral secara terpadu dengan auto-update model terbaru real-time, failover anti-limit, memori konsisten, dan riwayat chat.',
      heroKicker: 'Multi-AI Ensemble · Auto-Update Model Real-Time · Gratis & Multi-BYOK',
      heroTitle: 'Manifest AI — Asisten Cerdas Gabungan Multi-Model',
      heroDescription:
        'Satukan kekuatan banyak model AI terkemuka dalam satu ruang obrolan yang konsisten memorinya, gratis tanpa API key dengan jalur failover otomatis per pengguna, atau kombinasikan beberapa API Key pribadi Anda secara paralel.',
    },
    {
      id: 'plagiarism',
      label: 'Cek Plagiarisme',
      icon: './assets/icons/tool-plagiarism.svg',
      pageTitle: 'Cek Plagiarisme Terpadu — Laporan Format Turnitin & Multi-AI',
      pageSubtitle:
        'Unggah semua jenis berkas (PDF, DOCX, PPTX, XLSX, ODT, EPUB, RTF, Gambar OCR) atau tempel naskah. Gabungan OpenAlex, Crossref, DOAJ, Wikipedia, Multi-AI & Turnitin API dengan unduh laporan PDF/HTML mirip Turnitin terbaru.',
      heroKicker: 'Turnitin-Style Report · OpenAlex 250M+ · Crossref · DOAJ · Multi-AI Ensemble',
      heroTitle: 'Cek Plagiarisme Multi-Mesin Terpadu & Laporan Turnitin',
      heroDescription:
        'Seluruh mesin deteksi berjalan serentak (OpenAlex, Crossref, DOAJ, Wikipedia ID/EN, Winnowing K-Gram, Multi-AI ChatGPT/Gemini/Claude/DeepSeek/Grok & konektor Turnitin Core API) lalu digabungkan menjadi laporan interaktif & PDF siap unduh.',
    },
    {
      id: 'novel',
      label: 'Novel Terpadu',
      icon: './assets/icons/tool-novel.svg',
      pageTitle: 'Novel Terpadu — Baca Full Gratis Real-Time, 122+ Tema & Audiobook',
      pageSubtitle:
        'Gabungkan banyak platform novel populer & open-source dalam satu katalog gratis penuh tanpa kunci VIP, update real-time, cari novel dari potongan teks/screenshot/file hingga 100%, 122+ tema halaman (animasi, upload & AI), layar penuh, dan mode suara.',
      heroKicker: '14+ Sumber & Mirror Eks-VIP Gratis · 200+ Novel Real-Time · 122+ Tema AI & Animasi · Mode Suara',
      heroTitle: 'Pembaca Novel Terpadu — Gratis Penuh Tanpa Kunci VIP',
      heroDescription:
        'Nikmati ribuan bab novel populer lintas platform yang terintegrasi dalam satu katalog, lengkap dengan mode layar penuh, loncat halaman & bab, pencocokan novel dari cuplikan/screenshot/file hingga 100%, riwayat baca, 122+ tema halaman termasuk tema bergerak & request AI, serta mode suara audiobook.',
    },
    {
      id: 'callerid',
      label: 'Cek Nomor',
      icon: './assets/icons/tool-callerid.svg',
      pageTitle: 'Cek Nomor & Caller ID Anti-Spam (Multi-API Open-Source)',
      pageSubtitle:
        'Gabungkan Google libphonenumber-js, HLR Operator Indonesia, Direktori Resmi Bank/OJK, CallShield GitHub Spam DB, GitHub/HN OSINT, Wikidata, & Tag Komunitas tanpa login.',
      heroKicker: '5 Mesin Open-Source Kolaboratif · Gratis Tanpa Login · Tag Komunitas',
      heroTitle: 'Cek Nomor Telepon, Operator, Verifikasi Resmi & Anti-Spam',
      heroDescription:
        'Analisis format E.164 & HLR operator, verifikasi nomor resmi Bank/OJK/Polri/Ekspedisi, cek laporan spam CallShield GitHub & OSINT publik, serta kelola tag komunitas dan daftar blokir pribadi langsung di browser.',
    },
    {
      id: 'shortlink',
      label: 'Shortlink Bypass',
      icon: './assets/icons/tool-shortlink.svg',
      pageTitle: 'Shortlink Bypass — Anti-Iklan, Pop-Up & Anti-Malware (Multi-API + Multi-AI)',
      pageSubtitle:
        'Bongkar tautan pendek & safelink menuju alamat tujuan langsung tanpa iklan pop-up, bersihkan pelacak UTM, dan audit keamanan phishing/malware bersama Multi-API & Multi-AI.',
      heroKicker: 'Multi-API Open-Source + Konsensus Multi-AI · Anti-Malware & Anti-Pop-Up',
      heroTitle: 'Shortlink Bypass & Audit Keamanan Tautan Langsung',
      heroDescription:
        'Gabungkan Dekoder Instan Lokal, Pelacak Redirect & Inspektor Safelink, Bypass.VIP, Bypass.PM, Unshorten.me, Unshorten.it, serta Konsensus Multi-AI (Gemini, ChatGPT, Claude, Grok, DeepSeek) untuk menuju link tujuan aman tanpa iklan berulang.',
    },
    {
      id: 'donate',
      label: 'Please Donate',
      icon: './assets/icons/tool-donate.svg',
      pageTitle: 'Please Donate — Dukung Manifestudio & Top Donatur Leaderboard',
      pageSubtitle:
        'Dukung pengembangan Manifestudio via Saweria & SociaBuzz Tribe. Nama, pesan, dan peringkat Top Donatur tercatat otomatis secara real-time.',
      heroKicker: 'Saweria · SociaBuzz Tribe · Live Top Donatur Leaderboard',
      heroTitle: 'Please Donate & Papan Peringkat Top Donatur',
      heroDescription:
        'Setiap dukungan melalui Saweria atau SociaBuzz Tribe otomatis masuk ke Leaderboard Top Donatur Sepanjang Waktu & Bulanan lengkap dengan akumulasi nama donatur dan konversi mata uang otomatis ke Rupiah (IDR).',
    },
  ],
};

export function normalizeUtilityConfig(utilities = {}) {
  const safe = utilities && typeof utilities === 'object' ? utilities : {};
  const rawCallout = safe.callout && typeof safe.callout === 'object' ? safe.callout : {};
  const rawMusicHero = safe.musicHero && typeof safe.musicHero === 'object' ? safe.musicHero : {};
  const rawItems = Array.isArray(safe.items) ? safe.items : [];
  const defaultMap = new Map(DEFAULT_UTILITY_CONFIG.items.map((d) => [d.id, d]));

  const buildItem = (defItem, custom = {}) => {
    const rawLabel = String(custom.label || defItem.label).trim() || defItem.label;
    const rawPageTitle = String(custom.pageTitle || defItem.pageTitle).trim() || defItem.pageTitle;
    const rawHeroTitle = String(custom.heroTitle || defItem.heroTitle || '').trim() || defItem.heroTitle || '';
    const isLegacyDracinDefault = defItem.id === 'dracin';
    return {
      id: defItem.id,
      enabled: custom.enabled !== false,
      label:
        isLegacyDracinDefault && /^Drama China$/i.test(rawLabel) ? defItem.label : rawLabel,
      icon: String(custom.icon || defItem.icon).trim() || defItem.icon,
      pageTitle:
        isLegacyDracinDefault && /^Drama China\s*\(Dracin\)/i.test(rawPageTitle)
          ? defItem.pageTitle
          : rawPageTitle,
      pageSubtitle: String(custom.pageSubtitle || defItem.pageSubtitle).trim() || defItem.pageSubtitle,
      heroKicker: String(custom.heroKicker || defItem.heroKicker || '').trim() || defItem.heroKicker || '',
      heroTitle:
        isLegacyDracinDefault && /^Nonton Drama China Pendek Gratis Tanpa Iklan$/i.test(rawHeroTitle)
          ? defItem.heroTitle
          : rawHeroTitle,
      heroDescription:
        String(custom.heroDescription || defItem.heroDescription || '').trim() || defItem.heroDescription || '',
    };
  };

  const seenIds = new Set();
  const items = [];
  for (const raw of rawItems) {
    if (!raw || typeof raw !== 'object' || !raw.id) continue;
    const id = String(raw.id).trim();
    const defItem = defaultMap.get(id);
    if (!defItem || seenIds.has(id)) continue;
    seenIds.add(id);
    items.push(buildItem(defItem, raw));
  }
  for (const defItem of DEFAULT_UTILITY_CONFIG.items) {
    if (seenIds.has(defItem.id)) continue;
    seenIds.add(defItem.id);
    items.push(buildItem(defItem, {}));
  }

  const enabledCount = items.filter((it) => it.enabled !== false).length;
  const autoCountBadge = rawCallout.autoCountBadge !== false;
  const computedBadge = `${enabledCount} Fitur Gratis`;
  const rawDesc =
    rawCallout.description !== undefined
      ? String(rawCallout.description).trim()
      : rawCallout.subtitle !== undefined
      ? String(rawCallout.subtitle).trim()
      : '';
  const isLegacyUtilityList = (rawDesc.match(/·/g) || []).length >= 5;
  const cleanDescription = isLegacyUtilityList ? '' : rawDesc;

  const rawFa = safe.featureAssistant && typeof safe.featureAssistant === 'object' ? safe.featureAssistant : {};

  return {
    callout: {
      icon:
        String(rawCallout.icon || DEFAULT_UTILITY_CONFIG.callout.icon).trim() ||
        DEFAULT_UTILITY_CONFIG.callout.icon,
      title:
        String(rawCallout.title || DEFAULT_UTILITY_CONFIG.callout.title).trim() ||
        DEFAULT_UTILITY_CONFIG.callout.title,
      badge: autoCountBadge
        ? computedBadge
        : String(rawCallout.badge || computedBadge).trim() || computedBadge,
      description: cleanDescription,
      autoCountBadge,
    },
    musicHero: {
      icon:
        String(rawMusicHero.icon || DEFAULT_UTILITY_CONFIG.musicHero.icon).trim() ||
        DEFAULT_UTILITY_CONFIG.musicHero.icon,
      title:
        String(rawMusicHero.title || DEFAULT_UTILITY_CONFIG.musicHero.title).trim() ||
        DEFAULT_UTILITY_CONFIG.musicHero.title,
      subtitle:
        String(rawMusicHero.subtitle || DEFAULT_UTILITY_CONFIG.musicHero.subtitle).trim() ||
        DEFAULT_UTILITY_CONFIG.musicHero.subtitle,
    },
    featureAssistant: {
      enabled: rawFa.enabled !== false,
      welcomeMessage: String(rawFa.welcomeMessage || '').trim(),
    },
    items,
  };
}

export function upsertUtilityItemInCatalog(catalog, itemInput = {}) {
  const cleanId = String(itemInput.id || '').trim();
  if (!cleanId) {
    throw new Error('ID item utilitas wajib diisi.');
  }
  const currentUtil = normalizeUtilityConfig(catalog?.utilities);
  const items = currentUtil.items.map((it) => {
    if (it.id !== cleanId) return it;
    return {
      ...it,
      enabled: itemInput.enabled !== undefined ? Boolean(itemInput.enabled) : it.enabled !== false,
      label: itemInput.label !== undefined ? String(itemInput.label).trim() || it.label : it.label,
      icon: itemInput.icon !== undefined ? String(itemInput.icon).trim() || it.icon : it.icon,
      pageTitle:
        itemInput.pageTitle !== undefined ? String(itemInput.pageTitle).trim() || it.pageTitle : it.pageTitle,
      pageSubtitle:
        itemInput.pageSubtitle !== undefined
          ? String(itemInput.pageSubtitle).trim() || it.pageSubtitle
          : it.pageSubtitle,
      heroKicker:
        itemInput.heroKicker !== undefined ? String(itemInput.heroKicker).trim() || it.heroKicker : it.heroKicker,
      heroTitle:
        itemInput.heroTitle !== undefined ? String(itemInput.heroTitle).trim() || it.heroTitle : it.heroTitle,
      heroDescription:
        itemInput.heroDescription !== undefined
          ? String(itemInput.heroDescription).trim() || it.heroDescription
          : it.heroDescription,
    };
  });
  const nextUtilities = normalizeUtilityConfig({
    ...currentUtil,
    items,
  });
  return {
    ...catalog,
    utilities: nextUtilities,
  };
}

export function moveUtilityItemInCatalog(catalog, itemId, direction) {
  const currentUtil = normalizeUtilityConfig(catalog?.utilities);
  const items = currentUtil.items.map((it) => ({ ...it }));
  const index = items.findIndex((it) => it.id === itemId);
  if (index < 0 || items.length <= 1) {
    return { ...catalog, utilities: currentUtil };
  }
  let targetIndex = index;
  if (direction === 'up') targetIndex = Math.max(0, index - 1);
  else if (direction === 'down') targetIndex = Math.min(items.length - 1, index + 1);
  if (targetIndex === index) {
    return { ...catalog, utilities: currentUtil };
  }
  const [moved] = items.splice(index, 1);
  items.splice(targetIndex, 0, moved);
  return {
    ...catalog,
    utilities: normalizeUtilityConfig({
      ...currentUtil,
      items,
    }),
  };
}

export function syncAllMenusAndBanners(catalog = {}) {
  const normBrand = normalizeBrandConfig(catalog?.brand || {});
  const normUtil = normalizeUtilityConfig(catalog?.utilities || {});
  const activeUtilItems = normUtil.items.filter((it) => it.enabled !== false);
  const activeUtilIds = new Set(activeUtilItems.map((it) => it.id));

  const cleanedCallout = {
    ...normUtil.callout,
    autoCountBadge: true,
    badge: `${activeUtilItems.length} Fitur Gratis`,
    description:
      (String(normUtil.callout.description || '').match(/·/g) || []).length >= 4
        ? ''
        : String(normUtil.callout.description || '').trim(),
  };

  const currentBanners = normalizeBanners(catalog?.banners);
  const defaultBannerByUtil = new Map(
    DEFAULT_BANNERS.filter((b) => b.utilityId).map((b) => [b.utilityId, b])
  );
  const defaultCatalogBanner = DEFAULT_BANNERS[0];

  const LEGACY_BANNER_IMAGES = new Set([
    '',
    './assets/hero-banner.jpg',
    './assets/banner-prayer.jpg',
    './assets/banner-weather.jpg',
    './assets/banner-worldclock.jpg',
    './assets/banner-speedtest.jpg',
  ]);

  const existingByUtil = new Map();
  const customNonUtilBanners = [];

  for (const ban of currentBanners) {
    const uid = inferBannerUtilityId(ban);
    if (uid) {
      if (!existingByUtil.has(uid)) {
        existingByUtil.set(uid, ban);
      }
    } else {
      const nextBan = { ...ban, utilityId: '', enabled: ban.enabled !== false };
      if (nextBan.id === 'banner-katalog' && LEGACY_BANNER_IMAGES.has(nextBan.image)) {
        nextBan.image = defaultCatalogBanner.image;
      }
      customNonUtilBanners.push(nextBan);
    }
  }

  if (customNonUtilBanners.length === 0) {
    customNonUtilBanners.push({ ...defaultCatalogBanner });
  }

  const syncedUtilityBanners = [];
  for (const utilItem of activeUtilItems) {
    if (!activeUtilIds.has(utilItem.id)) continue;
    const existing = existingByUtil.get(utilItem.id);
    const defBan = defaultBannerByUtil.get(utilItem.id);
    if (existing) {
      const upgradedImage =
        LEGACY_BANNER_IMAGES.has(existing.image) && defBan?.image ? defBan.image : existing.image;
      syncedUtilityBanners.push({
        ...existing,
        id: existing.id || `banner-${utilItem.id}`,
        utilityId: utilItem.id,
        href: `./tools.html?tab=${utilItem.id}`,
        image: upgradedImage,
        scrim: normalizeBannerScrim(existing.scrim || defBan?.scrim || 'default'),
        enabled: true,
      });
    } else if (defBan) {
      syncedUtilityBanners.push({
        ...defBan,
        utilityId: utilItem.id,
        href: `./tools.html?tab=${utilItem.id}`,
        enabled: true,
      });
    } else {
      syncedUtilityBanners.push({
        id: `banner-${utilItem.id}`,
        utilityId: utilItem.id,
        kicker: `Menu Utilitas · ${utilItem.label}`,
        heading: utilItem.heroTitle || utilItem.pageTitle || utilItem.label,
        sub: utilItem.pageSubtitle || '',
        ctaLabel: `Buka ${utilItem.label} →`,
        href: `./tools.html?tab=${utilItem.id}`,
        image: `./assets/banners/banner-${utilItem.id}.jpg`,
        scrim: 'default',
        enabled: true,
      });
    }
  }

  return {
    ...catalog,
    brand: normBrand,
    utilities: {
      ...normUtil,
      callout: cleanedCallout,
    },
    banners: [...customNonUtilBanners, ...syncedUtilityBanners],
    paymentOptions: syncPaymentOptionsWithBrand(catalog?.paymentOptions, normBrand),
  };
}

export function computeAdminSyncStatus(
  draftCatalog = {},
  liveCatalog = null,
  { source = 'remote', dirty = false, checkedAt = '' } = {}
) {
  const normUtil = normalizeUtilityConfig(draftCatalog?.utilities || {});
  const totalUtilities = normUtil.items.length;
  const activeUtilItems = normUtil.items.filter((it) => it.enabled !== false);
  const activeUtilities = activeUtilItems.length;
  const activeUtilIds = new Set(activeUtilItems.map((it) => it.id));

  const banners = normalizeBanners(draftCatalog?.banners);
  const activeBanners = banners.filter((b) => b.enabled !== false);
  const bannerUtilIds = new Set(activeBanners.map((b) => inferBannerUtilityId(b)).filter(Boolean));

  const missingUtilityBanners = activeUtilItems
    .filter((it) => !bannerUtilIds.has(it.id))
    .map((it) => it.label);
  const extraDisabledUtilityBanners = activeBanners
    .filter((b) => {
      const uid = inferBannerUtilityId(b);
      return uid && !activeUtilIds.has(uid);
    })
    .map((b) => b.heading || b.id);

  const expectedBadge = `${activeUtilities} Fitur Gratis`;
  const calloutBadgeSynced = normUtil.callout.badge === expectedBadge;
  const calloutHasLegacyList = (String(normUtil.callout.description || '').match(/·/g) || []).length >= 5;

  const products = Array.isArray(draftCatalog?.products) ? draftCatalog.products : [];
  const activeProducts = products.filter((p) => !p.outOfStock).length;
  const categories = Array.isArray(draftCatalog?.categories)
    ? draftCatalog.categories.filter((c) => c && c.id !== 'all')
    : [];

  let changedAreas = [];
  if (liveCatalog && typeof liveCatalog === 'object') {
    const compare = (key, a, b) => {
      if (JSON.stringify(a ?? null) !== JSON.stringify(b ?? null)) {
        changedAreas.push(key);
      }
    };
    compare('Produk', draftCatalog?.products, liveCatalog?.products);
    compare('Kategori', draftCatalog?.categories, liveCatalog?.categories);
    compare('Banner', banners, normalizeBanners(liveCatalog?.banners));
    compare('Menu Utilitas', normUtil, normalizeUtilityConfig(liveCatalog?.utilities || {}));
    compare('Brand', normalizeBrandConfig(draftCatalog?.brand || {}), normalizeBrandConfig(liveCatalog?.brand || {}));
    compare('Voucher', draftCatalog?.vouchers, liveCatalog?.vouchers);
    compare('FAQ', draftCatalog?.faqItems, liveCatalog?.faqItems);
  }

  const menuAndBannerNeedsSync =
    missingUtilityBanners.length > 0 ||
    extraDisabledUtilityBanners.length > 0 ||
    !calloutBadgeSynced ||
    calloutHasLegacyList;

  const hasUnpublishedChanges = Boolean(dirty || source === 'preview' || changedAreas.length > 0);

  let overallStatus = 'synced';
  let overallLabel = 'Tersinkron Penuh';
  if (menuAndBannerNeedsSync) {
    overallStatus = 'attention';
    overallLabel = 'Perlu Sinkronisasi Menu & Banner';
  } else if (hasUnpublishedChanges) {
    overallStatus = 'draft';
    overallLabel =
      changedAreas.length > 0
        ? `Draft Lokal (${changedAreas.length} bagian berubah)`
        : 'Ada Perubahan Belum Dipublikasikan';
  }

  const checks = [
    {
      id: 'catalog',
      label: 'Menu Utama & Katalog',
      status: calloutBadgeSynced && !calloutHasLegacyList ? 'ok' : 'warn',
      value: `${activeProducts}/${products.length} Produk · ${categories.length} Kategori`,
      detail: calloutBadgeSynced
        ? `Kartu pintasan sinkron (${normUtil.callout.badge})`
        : `Badge pintasan "${normUtil.callout.badge}" belum cocok (${expectedBadge})`,
    },
    {
      id: 'utilities',
      label: 'Menu Utilitas',
      status: activeUtilities > 0 ? 'ok' : 'warn',
      value: `${activeUtilities}/${totalUtilities} Menu Aktif`,
      detail:
        activeUtilities === totalUtilities
          ? 'Seluruh menu utilitas aktif & sinkron di Header & Tools'
          : `${totalUtilities - activeUtilities} menu dinonaktifkan sementara`,
    },
    {
      id: 'banners',
      label: 'Banner Carousel',
      status: missingUtilityBanners.length === 0 && extraDisabledUtilityBanners.length === 0 ? 'ok' : 'warn',
      value: `${activeBanners.length} Slide Aktif`,
      detail:
        missingUtilityBanners.length > 0
          ? `${missingUtilityBanners.length} menu utilitas belum memiliki banner`
          : extraDisabledUtilityBanners.length > 0
          ? `${extraDisabledUtilityBanners.length} banner mengarah ke menu nonaktif`
          : `100% terhubung ke Menu Utama & ${activeUtilities} Menu Utilitas`,
    },
    {
      id: 'publish',
      label: 'Status Publikasi',
      status: hasUnpublishedChanges ? 'draft' : 'ok',
      value: hasUnpublishedChanges
        ? source === 'preview'
          ? 'Pratinjau Lokal'
          : 'Draft Belum Publish'
        : source === 'github'
        ? 'Sinkron GitHub Live'
        : 'Sinkron catalog.json',
      detail:
        changedAreas.length > 0
          ? `Perubahan pada: ${changedAreas.join(', ')}`
          : 'Data Admin sama dengan katalog publik aktif',
    },
  ];

  return {
    overallStatus,
    overallLabel,
    checkedAt: checkedAt || new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    metrics: {
      totalProducts: products.length,
      activeProducts,
      totalCategories: categories.length,
      activeUtilities,
      totalUtilities,
      activeBanners: activeBanners.length,
      expectedBanners: activeUtilities + 1,
      calloutBadgeSynced,
      calloutHasLegacyList,
      missingUtilityBanners,
      extraDisabledUtilityBanners,
      pendingDiffCount: changedAreas.length,
      changedAreas,
    },
    checks,
  };
}

export function normalizeBrandConfig(brand = {}) {
  const safe = brand && typeof brand === 'object' ? brand : {};
  const waNum = String(safe.whatsappNumber || '6285122936027').replace(/[^0-9]/g, '') || '6285122936027';
  const rawTagline = String(safe.tagline || '').trim();
  const normalizedTagline =
    !rawTagline ||
    rawTagline === 'Katalog & Utilitas' ||
    rawTagline === 'Akun Premium & Layanan Digital Terpercaya'
      ? 'by Tomy'
      : rawTagline;

  const rawFooter = String(safe.footerText || '').trim();
  const normalizedFooter =
    !rawFooter || rawFooter.includes('tMC Tomy Studio')
      ? 'Dikelola oleh Manifestudio by Tomy © 2026'
      : rawFooter;

  return {
    ...safe,
    name: String(safe.name || 'Manifestudio').trim() || 'Manifestudio',
    tagline: normalizedTagline,
    logo: String(safe.logo || './assets/icons/brand-icon.svg').trim() || './assets/icons/brand-icon.svg',
    footerText: normalizedFooter,
    whatsappNumber: waNum,
    discountThreshold: Number.isFinite(Number(safe.discountThreshold))
      ? Math.max(0, Math.round(Number(safe.discountThreshold)))
      : 50000,
    discountAmount: Number.isFinite(Number(safe.discountAmount))
      ? Math.max(0, Math.round(Number(safe.discountAmount)))
      : 2000,
    payLaterSurchargeRate: Number.isFinite(Number(safe.payLaterSurchargeRate))
      ? Math.max(0, Number(safe.payLaterSurchargeRate))
      : 0.1,
    serviceFeeFlat: Number.isFinite(Number(safe.serviceFeeFlat))
      ? Math.max(0, Math.round(Number(safe.serviceFeeFlat)))
      : 0,
    serviceFeeLabel: String(safe.serviceFeeLabel || 'Biaya Layanan').trim() || 'Biaya Layanan',
    socials: normalizeBrandSocials({ ...safe, whatsappNumber: waNum }),
    openGraph: normalizeOpenGraphConfig(safe),
    storeAccess: normalizeStoreAccessConfig(safe.storeAccess),
  };
}

export function syncPaymentOptionsWithBrand(paymentOptions = [], brand = {}) {
  const normBrand = normalizeBrandConfig(brand);
  const payLaterPct = Math.round(normBrand.payLaterSurchargeRate * 1000) / 10;
  const flatFee = normBrand.serviceFeeFlat;
  const baseOptions =
    Array.isArray(paymentOptions) && paymentOptions.length > 0
      ? paymentOptions
      : [
          {
            id: 'Bayar Sekarang',
            label: 'Bayar Sekarang (QRIS / E-Wallet / Bank)',
            badge: '0% Biaya',
            note: 'Tanpa biaya tambahan · Proses prioritas instan setelah bukti transfer dikonfirmasi.',
            surchargeRate: 0,
          },
          {
            id: 'Bayar Belakangan (Setelah Akun Diterima)',
            label: 'Bayar Nanti (Setelah Akun Diterima)',
            badge: `+${payLaterPct}% Biaya Layanan`,
            note: `Dikenakan biaya tambahan ${payLaterPct}% dari total tagihan karena pembayaran dilakukan setelah akun aktif.`,
            surchargeRate: normBrand.payLaterSurchargeRate,
          },
        ];

  return baseOptions.map((opt) => {
    if (opt.id === 'Bayar Belakangan (Setelah Akun Diterima)') {
      return {
        ...opt,
        badge: `+${payLaterPct}% Biaya Layanan`,
        note: `Dikenakan biaya tambahan ${payLaterPct}% dari total tagihan karena pembayaran dilakukan setelah akun aktif.`,
        surchargeRate: normBrand.payLaterSurchargeRate,
      };
    }
    if (opt.id === 'Bayar Sekarang') {
      return {
        ...opt,
        badge: flatFee > 0 ? `+${formatRupiah(flatFee)} Biaya` : '0% Biaya',
        surchargeRate: 0,
      };
    }
    return { ...opt };
  });
}

export function upsertCategoryInCatalog(catalog, categoryInput = {}) {
  const cleanLabel = String(categoryInput.label || '').trim();
  if (!cleanLabel) {
    throw new Error('Nama kategori layanan wajib diisi.');
  }
  const cleanId = String(categoryInput.id || slugifyId(cleanLabel)).trim();
  if (!cleanId) {
    throw new Error('ID kategori tidak valid.');
  }

  const current = Array.isArray(catalog?.categories) ? [...catalog.categories] : [];
  const hasAll = current.some((c) => c.id === 'all');
  const nextCategories = hasAll
    ? current.map((c) => ({ ...c }))
    : [{ id: 'all', label: 'Semua Layanan' }, ...current.map((c) => ({ ...c }))];

  const existingIdx = nextCategories.findIndex((c) => c.id === cleanId);
  if (existingIdx >= 0) {
    nextCategories[existingIdx] = {
      ...nextCategories[existingIdx],
      label: cleanLabel,
    };
  } else {
    nextCategories.push({
      id: cleanId,
      label: cleanLabel,
    });
  }

  return { ...catalog, categories: nextCategories };
}

export function deleteCategoryFromCatalog(catalog, categoryId, fallbackCategoryId = 'custom') {
  const targetId = String(categoryId || '').trim();
  if (!targetId || targetId === 'all') {
    return catalog;
  }
  const nextCategories = (catalog?.categories || []).filter((c) => c.id !== targetId);
  const availableFallback =
    nextCategories.find((c) => c.id === fallbackCategoryId)?.id ||
    nextCategories.find((c) => c.id !== 'all')?.id ||
    'streaming';

  const nextProducts = (catalog?.products || []).map((prod) =>
    prod.category === targetId ? { ...prod, category: availableFallback } : prod
  );

  return {
    ...catalog,
    categories: nextCategories,
    products: nextProducts,
  };
}

export function upsertFaqInCatalog(catalog, { index = -1, question = '', answer = '' } = {}) {
  const cleanQ = String(question || '').trim();
  const cleanA = String(answer || '').trim();
  if (!cleanQ || !cleanA) {
    throw new Error('Pertanyaan dan jawaban FAQ wajib diisi.');
  }
  const nextFaq = Array.isArray(catalog?.faqItems)
    ? catalog.faqItems.map((item) => ({ ...item }))
    : [];

  if (index >= 0 && index < nextFaq.length) {
    nextFaq[index] = { question: cleanQ, answer: cleanA };
  } else {
    nextFaq.push({ question: cleanQ, answer: cleanA });
  }
  return { ...catalog, faqItems: nextFaq };
}

export function deleteFaqFromCatalog(catalog, index) {
  const idx = Number(index);
  const nextFaq = Array.isArray(catalog?.faqItems)
    ? catalog.faqItems.filter((_item, i) => i !== idx)
    : [];
  return { ...catalog, faqItems: nextFaq };
}

export function upsertSocialInCatalog(catalog, socialInput = {}) {
  const cleanLabel = String(socialInput.label || socialInput.platform || '').trim();
  const cleanUrl = String(socialInput.url || '').trim();
  if (!cleanLabel || !cleanUrl) {
    throw new Error('Nama sosmed/kontak dan link URL wajib diisi.');
  }
  const cleanId = String(socialInput.id || `social-${slugifyId(cleanLabel)}`).trim();
  const cleanPlatform = String(socialInput.platform || cleanLabel).trim();
  const cleanHandle = String(socialInput.handle || '').trim();
  const cleanLogo = String(socialInput.logo || './assets/icons/social-globe.svg').trim();

  const normBrand = normalizeBrandConfig(catalog?.brand || {});
  const socials = [...normBrand.socials];
  const existingIdx = socials.findIndex((s) => s.id === cleanId);
  const entry = {
    id: cleanId,
    platform: cleanPlatform,
    label: cleanLabel,
    handle: cleanHandle,
    url: cleanUrl,
    logo: cleanLogo,
  };

  if (existingIdx >= 0) {
    socials[existingIdx] = entry;
  } else {
    socials.push(entry);
  }

  return {
    ...catalog,
    brand: {
      ...normBrand,
      socials,
    },
  };
}

export function deleteSocialFromCatalog(catalog, socialId) {
  const normBrand = normalizeBrandConfig(catalog?.brand || {});
  const socials = normBrand.socials.filter((s) => s.id !== socialId);
  return {
    ...catalog,
    brand: {
      ...normBrand,
      socials,
    },
  };
}

export function upsertBannerInCatalog(catalog, bannerInput = {}) {
  const cleanHeading = String(bannerInput.heading || '').trim();
  if (!cleanHeading) {
    throw new Error('Judul utama (heading) banner wajib diisi.');
  }
  const cleanId = String(bannerInput.id || `banner-${slugifyId(cleanHeading)}`).trim();
  const cleanKicker = String(bannerInput.kicker || 'Promo & Info').trim() || 'Promo & Info';
  const cleanSub = String(bannerInput.sub || '').trim();
  const cleanCta = String(bannerInput.ctaLabel || 'Selengkapnya').trim() || 'Selengkapnya';
  const cleanHref = String(bannerInput.href || '#katalog').trim() || '#katalog';
  const cleanImage = String(bannerInput.image ?? '').trim();
  const cleanScrim = normalizeBannerScrim(bannerInput.scrim);
  const cleanUtilityId = inferBannerUtilityId({ ...bannerInput, id: cleanId, href: cleanHref });

  const currentBanners = normalizeBanners(catalog?.banners);
  const existingIdx = currentBanners.findIndex((b) => b.id === cleanId);
  const entry = {
    id: cleanId,
    utilityId: cleanUtilityId,
    kicker: cleanKicker,
    heading: cleanHeading,
    sub: cleanSub,
    ctaLabel: cleanCta,
    href: cleanHref,
    image: cleanImage,
    scrim: cleanScrim,
    enabled: bannerInput.enabled !== false,
  };

  if (existingIdx >= 0) {
    currentBanners[existingIdx] = entry;
  } else {
    currentBanners.push(entry);
  }

  return {
    ...catalog,
    banners: currentBanners,
  };
}

export function deleteBannerFromCatalog(catalog, bannerId) {
  const targetId = String(bannerId || '').trim();
  const currentBanners = normalizeBanners(catalog?.banners);
  if (currentBanners.length <= 1) {
    return { ...catalog, banners: currentBanners };
  }
  return {
    ...catalog,
    banners: currentBanners.filter((b) => b.id !== targetId),
  };
}

export function moveBannerInCatalog(catalog, bannerId, direction) {
  const banners = normalizeBanners(catalog?.banners);
  const index = banners.findIndex((b) => b.id === bannerId);
  if (index < 0 || banners.length <= 1) return { ...catalog, banners };

  let targetIndex = index;
  if (direction === 'up') targetIndex = Math.max(0, index - 1);
  else if (direction === 'down') targetIndex = Math.min(banners.length - 1, index + 1);
  else if (direction === 'top') targetIndex = 0;
  else if (direction === 'bottom') targetIndex = banners.length - 1;

  if (targetIndex === index) return { ...catalog, banners };

  const [moved] = banners.splice(index, 1);
  banners.splice(targetIndex, 0, moved);
  return { ...catalog, banners };
}

export function resolveAbsoluteOgImageUrl(imagePath, siteOrigin = 'https://manifestudio.my.id') {
  const raw = String(imagePath || DEFAULT_OPEN_GRAPH.image).trim() || DEFAULT_OPEN_GRAPH.image;
  if (/^https?:\/\//i.test(raw) || raw.startsWith('data:')) {
    return raw;
  }
  const cleanOrigin = String(siteOrigin || 'https://manifestudio.my.id').replace(/\/+$/, '');
  const cleanRel = raw.replace(/^\.\//, '').replace(/^\/+/, '');
  return `${cleanOrigin}/${cleanRel}`;
}

export function applyOpenGraphToHtml(htmlString = '', openGraphInput = {}, brandInput = {}) {
  const html = String(htmlString || '');
  if (!html) return '';
  const brand = normalizeBrandConfig({ ...brandInput, openGraph: openGraphInput });
  const og = brand.openGraph;
  const absImg = resolveAbsoluteOgImageUrl(og.image);

  const escapeAttr = (val) =>
    String(val ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('"', '&quot;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;');

  const titleLower = String(og.title || '').toLowerCase();
  const taglineRaw = String(og.tagline || '').trim();
  const taglineFirstPart = taglineRaw.split(/[·|—-]/)[0].trim().toLowerCase();
  const isTaglineDuplicate =
    !taglineRaw ||
    titleLower.includes(taglineRaw.toLowerCase()) ||
    (taglineFirstPart.length >= 4 && titleLower.includes(taglineFirstPart));
  const fullTitle = !isTaglineDuplicate ? `${og.title} (${taglineRaw})` : og.title;
  const safeTitle = escapeAttr(og.title);
  const safeDesc = escapeAttr(og.description);
  const safeAlt = escapeAttr(og.imageAlt || og.tagline || og.title);
  const safeSite = escapeAttr(og.siteName || brand.name || 'Manifestudio');
  const safeImg = escapeAttr(absImg);

  let out = html;
  out = out.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeAttr(fullTitle)}</title>`);

  const replaceMeta = (attrName, attrVal, newContent) => {
    const re1 = new RegExp(
      `(<meta\\s+[^>]*${attrName}=["']${attrVal}["'][^>]*content=["'])([^"']*)(["'][^>]*>)`,
      'i'
    );
    const re2 = new RegExp(
      `(<meta\\s+[^>]*content=["'])([^"']*)(["'][^>]*${attrName}=["']${attrVal}["'][^>]*>)`,
      'i'
    );
    if (re1.test(out)) {
      out = out.replace(re1, `$1${newContent}$3`);
    } else if (re2.test(out)) {
      out = out.replace(re2, `$1${newContent}$3`);
    }
  };

  replaceMeta('name', 'description', safeDesc);
  replaceMeta('property', 'og:title', safeTitle);
  replaceMeta('property', 'og:description', safeDesc);
  replaceMeta('property', 'og:image', safeImg);
  replaceMeta('property', 'og:image:secure_url', safeImg);
  replaceMeta('property', 'og:image:alt', safeAlt);
  replaceMeta('property', 'og:site_name', safeSite);
  replaceMeta('name', 'twitter:title', safeTitle);
  replaceMeta('name', 'twitter:description', safeDesc);
  replaceMeta('name', 'twitter:image', safeImg);
  replaceMeta('name', 'twitter:image:alt', safeAlt);

  out = out.replace(
    /(<script\s+type=["']application\/ld\+json["']>\s*)([\s\S]*?)(\s*<\/script>)/i,
    (match, openTag, jsonText, closeTag) => {
      try {
        const parsed = JSON.parse(jsonText);
        if (parsed && typeof parsed === 'object') {
          parsed.name = og.siteName || brand.name || parsed.name || 'Manifestudio';
          if (og.description) {
            parsed.description = String(og.description).replace(/\s+/g, ' ').trim();
          }
          parsed.image = absImg;
          return `${openTag}${JSON.stringify(parsed, null, 2)}${closeTag}`;
        }
      } catch {
        // Ignore malformed JSON-LD and keep original block
      }
      return match;
    }
  );

  return out;
}

export function toggleProductStockInCatalog(catalog, productId, outOfStock, restockMessage = 'Akan segera restock') {
  const nextProducts = (catalog.products || []).map((product) => {
    if (product.id !== productId) return product;
    return {
      ...product,
      outOfStock: Boolean(outOfStock),
      tag: outOfStock ? 'Segera Restock' : product.tag === 'Segera Restock' ? 'Tersedia' : product.tag || 'Tersedia',
      restockMessage: outOfStock ? restockMessage : undefined,
      variants: (product.variants || []).map((v) => ({
        ...v,
        outOfStock: Boolean(outOfStock),
      })),
    };
  });
  return { ...catalog, products: nextProducts };
}

export function upsertProductInCatalog(catalog, productInput) {
  const cleanName = String(productInput.name || '').trim();
  if (!cleanName) {
    throw new Error('Nama produk wajib diisi.');
  }

  const variants = Array.isArray(productInput.variants)
    ? productInput.variants
        .filter((v) => String(v.name || '').trim())
        .map((v, idx) => ({
          id: v.id ? String(v.id).trim() : `${slugifyId(cleanName)}-v${idx + 1}`,
          name: String(v.name).trim(),
          price: Math.max(0, Math.round(Number(v.price) || 0)),
          ...(Number(v.oldPrice) > 0 ? { oldPrice: Math.round(Number(v.oldPrice)) } : {}),
          outOfStock: Boolean(v.outOfStock),
          ...(v.description ? { description: String(v.description).trim() } : {}),
          ...(v.outOfStock && v.restockMessage ? { restockMessage: String(v.restockMessage).trim() } : {}),
        }))
    : [];

  if (variants.length === 0) {
    throw new Error('Produk harus memiliki minimal satu varian paket.');
  }

  const allOutOfStock = variants.every((v) => v.outOfStock);
  const normalizedProduct = {
    id: productInput.id ? String(productInput.id).trim() : slugifyId(cleanName),
    name: cleanName,
    category: productInput.category || 'streaming',
    logo: String(productInput.logo || './assets/logos/custom-request.svg').trim(),
    isBestSeller: Boolean(productInput.isBestSeller),
    outOfStock: productInput.outOfStock !== undefined ? Boolean(productInput.outOfStock) : allOutOfStock,
    tag: String(productInput.tag || (allOutOfStock ? 'Segera Restock' : 'Tersedia')).trim(),
    summary: String(productInput.summary || '').trim(),
    ...(productInput.notice ? { notice: String(productInput.notice).trim() } : {}),
    ...(allOutOfStock || productInput.outOfStock
      ? { restockMessage: String(productInput.restockMessage || 'Akan segera restock').trim() }
      : {}),
    variants,
  };

  const products = [...(catalog.products || [])];
  const existingIdx = products.findIndex((p) => p.id === normalizedProduct.id);
  if (existingIdx >= 0) {
    products[existingIdx] = normalizedProduct;
  } else {
    products.push(normalizedProduct);
  }

  return { ...catalog, products };
}

export function moveProductInCatalog(catalog, productId, direction) {
  const products = [...(catalog?.products || [])];
  const index = products.findIndex((p) => p.id === productId);
  if (index < 0 || products.length <= 1) return { ...catalog, products };

  let targetIndex = index;
  if (direction === 'up') targetIndex = Math.max(0, index - 1);
  else if (direction === 'down') targetIndex = Math.min(products.length - 1, index + 1);
  else if (direction === 'top') targetIndex = 0;
  else if (direction === 'bottom') targetIndex = products.length - 1;

  if (targetIndex === index) return { ...catalog, products };

  const [moved] = products.splice(index, 1);
  products.splice(targetIndex, 0, moved);
  return { ...catalog, products };
}

export function reorderProductToIndex(catalog, productId, targetIndex) {
  const products = [...(catalog?.products || [])];
  const index = products.findIndex((p) => p.id === productId);
  if (index < 0 || products.length <= 1) return { ...catalog, products };

  const clamped = Math.max(0, Math.min(products.length - 1, Math.round(Number(targetIndex) || 0)));
  if (clamped === index) return { ...catalog, products };

  const [moved] = products.splice(index, 1);
  products.splice(clamped, 0, moved);
  return { ...catalog, products };
}

export function extractManagedUploadLogoPath(logoUrl) {
  const raw = String(logoUrl || '').trim();
  if (!raw || raw.startsWith('data:') || /^https?:\/\//i.test(raw)) {
    return null;
  }
  const normalized = raw.replace(/^\.\//, '').replace(/^\/+/, '');
  if (!normalized.startsWith('assets/logos/uploads/')) {
    return null;
  }
  if (normalized.includes('..')) {
    return null;
  }
  return normalized;
}

export function collectAllActiveUploadLogoPaths(catalog = {}) {
  const paths = new Set();
  for (const prod of Array.isArray(catalog?.products) ? catalog.products : []) {
    const p = extractManagedUploadLogoPath(prod?.logo);
    if (p) paths.add(p);
  }
  const brandLogoPath = extractManagedUploadLogoPath(catalog?.brand?.logo);
  if (brandLogoPath) paths.add(brandLogoPath);
  const ogImgPath = extractManagedUploadLogoPath(catalog?.brand?.openGraph?.image);
  if (ogImgPath) paths.add(ogImgPath);
  for (const soc of Array.isArray(catalog?.brand?.socials) ? catalog.brand.socials : []) {
    const sp = extractManagedUploadLogoPath(soc?.logo);
    if (sp) paths.add(sp);
  }
  for (const ban of Array.isArray(catalog?.banners) ? catalog.banners : []) {
    const bp = extractManagedUploadLogoPath(ban?.image);
    if (bp) paths.add(bp);
  }
  const utilCalloutPath = extractManagedUploadLogoPath(catalog?.utilities?.callout?.icon);
  if (utilCalloutPath) paths.add(utilCalloutPath);
  const utilHeroPath = extractManagedUploadLogoPath(catalog?.utilities?.musicHero?.icon);
  if (utilHeroPath) paths.add(utilHeroPath);
  for (const uit of Array.isArray(catalog?.utilities?.items) ? catalog.utilities.items : []) {
    const up = extractManagedUploadLogoPath(uit?.icon);
    if (up) paths.add(up);
  }
  return paths;
}

export function collectOrphanedUploadLogos(previousProducts = [], nextProducts = [], nextCatalog = null) {
  const activeSet = new Set(
    (Array.isArray(nextProducts) ? nextProducts : [])
      .map((p) => extractManagedUploadLogoPath(p?.logo))
      .filter(Boolean)
  );
  if (nextCatalog) {
    for (const p of collectAllActiveUploadLogoPaths(nextCatalog)) {
      activeSet.add(p);
    }
  }
  const orphaned = [];
  const seen = new Set();
  for (const prev of Array.isArray(previousProducts) ? previousProducts : []) {
    const path = extractManagedUploadLogoPath(prev?.logo);
    if (path && !activeSet.has(path) && !seen.has(path)) {
      seen.add(path);
      orphaned.push(path);
    }
  }
  return orphaned;
}

export const MAX_HISTORY_LOGS = 12;

export function getProductCardTone(index = 0) {
  const safe = Math.abs(Math.trunc(Number(index) || 0));
  return safe % 6;
}

export function compactCatalogForHistory(catalog) {
  const safe = catalog && typeof catalog === 'object' ? catalog : {};
  const compactLogoStr = (raw) => {
    const str = String(raw || '');
    return str.startsWith('data:') && str.length > 4096
      ? './assets/logos/custom-request.svg'
      : str;
  };
  let compactBrand = safe.brand ? structuredClone(safe.brand) : undefined;
  if (compactBrand) {
    if (compactBrand.logo) compactBrand.logo = compactLogoStr(compactBrand.logo);
    if (compactBrand.openGraph?.image) {
      compactBrand.openGraph.image = compactLogoStr(compactBrand.openGraph.image);
    }
    if (Array.isArray(compactBrand.socials)) {
      compactBrand.socials = compactBrand.socials.map((s) => ({
        ...s,
        logo: compactLogoStr(s?.logo),
      }));
    }
  }
  let compactUtilities = safe.utilities ? normalizeUtilityConfig(safe.utilities) : undefined;
  if (compactUtilities) {
    compactUtilities = {
      callout: {
        ...compactUtilities.callout,
        icon: compactLogoStr(compactUtilities.callout.icon),
      },
      musicHero: {
        ...compactUtilities.musicHero,
        icon: compactLogoStr(compactUtilities.musicHero.icon),
      },
      items: compactUtilities.items.map((it) => ({
        ...it,
        icon: compactLogoStr(it.icon),
      })),
    };
  }
  return {
    ...(compactBrand ? { brand: compactBrand } : {}),
    ...(compactUtilities ? { utilities: compactUtilities } : {}),
    ...(Array.isArray(safe.banners)
      ? {
          banners: safe.banners.map((b) => ({
            ...structuredClone(b),
            image: compactLogoStr(b?.image),
          })),
        }
      : {}),
    ...(Array.isArray(safe.categories) ? { categories: structuredClone(safe.categories) } : {}),
    ...(Array.isArray(safe.paymentOptions) ? { paymentOptions: structuredClone(safe.paymentOptions) } : {}),
    ...(Array.isArray(safe.faqItems) ? { faqItems: structuredClone(safe.faqItems) } : {}),
    vouchers: Array.isArray(safe.vouchers) ? structuredClone(safe.vouchers) : [],
    products: (Array.isArray(safe.products) ? safe.products : []).map((p) => ({
      ...structuredClone(p),
      logo: compactLogoStr(p?.logo),
    })),
  };
}

export function describeCatalogChanges(prevCatalog, nextCatalog) {
  const prevProducts = Array.isArray(prevCatalog?.products) ? prevCatalog.products : [];
  const nextProducts = Array.isArray(nextCatalog?.products) ? nextCatalog.products : [];

  if (!prevCatalog || (prevProducts.length === 0 && !prevCatalog.brand && !prevCatalog.vouchers)) {
    return ['Sinkronisasi / penyimpanan snapshot katalog'];
  }

  const details = [];
  const catLabelMap = new Map();
  for (const c of [...(prevCatalog?.categories || []), ...(nextCatalog?.categories || [])]) {
    if (c?.id && c?.label) catLabelMap.set(c.id, c.label);
  }
  const getCatName = (id) => catLabelMap.get(id) || id || 'Lainnya';

  const prevProdMap = new Map(prevProducts.map((p, idx) => [p.id, { item: p, idx }]));
  const nextProdMap = new Map(nextProducts.map((p, idx) => [p.id, { item: p, idx }]));

  // 1. Deleted products
  for (const [id, prevWrap] of prevProdMap.entries()) {
    if (!nextProdMap.has(id)) {
      details.push(`Menghapus produk ${prevWrap.item.name || id}`);
    }
  }

  // 2. Added & Modified products + sub-products (variants)
  for (const [id, nextWrap] of nextProdMap.entries()) {
    const prevWrap = prevProdMap.get(id);
    const nextProd = nextWrap.item;

    if (!prevWrap) {
      const varCount = Array.isArray(nextProd.variants) ? nextProd.variants.length : 0;
      details.push(`Menambah produk baru ${nextProd.name} (${varCount} sub produk)`);
      continue;
    }

    const prevProd = prevWrap.item;
    const prodLabel = nextProd.name || prevProd.name || id;

    if (String(prevProd.name || '').trim() !== String(nextProd.name || '').trim()) {
      details.push(`Mengubah nama produk ${prevProd.name} menjadi ${nextProd.name}`);
    }

    if (String(prevProd.logo || '').trim() !== String(nextProd.logo || '').trim()) {
      details.push(`Mengubah logo ${prodLabel}`);
    }

    if (String(prevProd.category || '') !== String(nextProd.category || '')) {
      details.push(
        `Memindahkan kategori ${prodLabel} dari "${getCatName(prevProd.category)}" ke "${getCatName(nextProd.category)}"`
      );
    }

    const prevOut = Boolean(prevProd.outOfStock);
    const nextOut = Boolean(nextProd.outOfStock);
    if (prevOut !== nextOut) {
      details.push(
        nextOut
          ? `Menandai stok produk ${prodLabel} habis (Segera Restock)`
          : `Mengaktifkan kembali stok produk ${prodLabel}`
      );
    } else if (String(prevProd.tag || '').trim() !== String(nextProd.tag || '').trim()) {
      details.push(
        `Mengubah label tag ${prodLabel} dari "${prevProd.tag || '-'}" menjadi "${nextProd.tag || '-'}"`
      );
    }

    if (String(prevProd.summary || '').trim() !== String(nextProd.summary || '').trim()) {
      details.push(`Mengubah ringkasan produk ${prodLabel}`);
    }

    // Compare sub-products (variants)
    const prevVars = Array.isArray(prevProd.variants) ? prevProd.variants : [];
    const nextVars = Array.isArray(nextProd.variants) ? nextProd.variants : [];

    const matchedPrevIndices = new Set();
    const matchedNextIndices = new Set();
    const pairs = [];

    // First pass: match by variant ID
    nextVars.forEach((nv, nIdx) => {
      if (!nv?.id) return;
      const pIdx = prevVars.findIndex(
        (pv, idx) => !matchedPrevIndices.has(idx) && pv?.id && pv.id === nv.id
      );
      if (pIdx >= 0) {
        matchedPrevIndices.add(pIdx);
        matchedNextIndices.add(nIdx);
        pairs.push({ prevVar: prevVars[pIdx], nextVar: nv });
      }
    });

    // Second pass: match remaining by exact normalized variant name
    nextVars.forEach((nv, nIdx) => {
      if (matchedNextIndices.has(nIdx)) return;
      const normName = String(nv?.name || '').trim().toLowerCase();
      if (!normName) return;
      const pIdx = prevVars.findIndex(
        (pv, idx) =>
          !matchedPrevIndices.has(idx) &&
          String(pv?.name || '').trim().toLowerCase() === normName
      );
      if (pIdx >= 0) {
        matchedPrevIndices.add(pIdx);
        matchedNextIndices.add(nIdx);
        pairs.push({ prevVar: prevVars[pIdx], nextVar: nv });
      }
    });

    // Unmatched prevVars -> deleted sub-products
    prevVars.forEach((pv, pIdx) => {
      if (!matchedPrevIndices.has(pIdx)) {
        details.push(`Menghapus sub produk ${prodLabel} — ${pv.name}`);
      }
    });

    // Unmatched nextVars -> added sub-products
    nextVars.forEach((nv, nIdx) => {
      if (!matchedNextIndices.has(nIdx)) {
        details.push(
          `Menambah sub produk ${prodLabel} — ${nv.name} (${formatRupiah(nv.price || 0)})`
        );
      }
    });

    // Matched pairs -> check name, price, oldPrice, outOfStock changes
    for (const { prevVar, nextVar } of pairs) {
      const prevVarName = String(prevVar.name || '').trim();
      const nextVarName = String(nextVar.name || '').trim();
      if (prevVarName !== nextVarName) {
        details.push(
          `Mengubah nama sub produk ${prodLabel} dari "${prevVarName}" menjadi "${nextVarName}"`
        );
      }
      const prevPrice = Math.round(Number(prevVar.price || 0));
      const nextPrice = Math.round(Number(nextVar.price || 0));
      if (prevPrice !== nextPrice) {
        details.push(
          `Mengubah harga ${prodLabel} (${nextVarName}) dari ${formatRupiah(prevPrice)} menjadi ${formatRupiah(nextPrice)}`
        );
      }
      const prevOld = Math.round(Number(prevVar.oldPrice || 0));
      const nextOld = Math.round(Number(nextVar.oldPrice || 0));
      if (prevOld !== nextOld) {
        details.push(
          nextOld > 0
            ? `Mengubah harga coret ${prodLabel} (${nextVarName}) menjadi ${formatRupiah(nextOld)}`
            : `Menghapus harga coret ${prodLabel} (${nextVarName})`
        );
      }
      const pvOut = Boolean(prevVar.outOfStock);
      const nvOut = Boolean(nextVar.outOfStock);
      if (pvOut !== nvOut && prevOut === nextOut) {
        details.push(
          nvOut
            ? `Menandai sub produk ${prodLabel} (${nextVarName}) habis`
            : `Mengaktifkan stok sub produk ${prodLabel} (${nextVarName})`
        );
      }
    }
  }

  // 3. Relative order of common products
  const commonPrevIds = prevProducts.map((p) => p.id).filter((id) => nextProdMap.has(id));
  const commonNextIds = nextProducts.map((p) => p.id).filter((id) => prevProdMap.has(id));
  if (
    commonPrevIds.length > 1 &&
    commonPrevIds.join('::') !== commonNextIds.join('::')
  ) {
    details.push('Mengubah urutan posisi produk di katalog');
  }

  // 4. Categories diff
  const prevCats = Array.isArray(prevCatalog?.categories) ? prevCatalog.categories : [];
  const nextCats = Array.isArray(nextCatalog?.categories) ? nextCatalog.categories : [];
  if (prevCats.length > 0 || nextCats.length > 0) {
    const prevCatMap = new Map(prevCats.map((c) => [c.id, c]));
    const nextCatMap = new Map(nextCats.map((c) => [c.id, c]));
    for (const [cid, pCat] of prevCatMap.entries()) {
      if (!nextCatMap.has(cid)) {
        details.push(`Menghapus kategori layanan "${pCat.label || cid}"`);
      }
    }
    for (const [cid, nCat] of nextCatMap.entries()) {
      const pCat = prevCatMap.get(cid);
      if (!pCat) {
        details.push(`Menambah kategori layanan "${nCat.label || cid}"`);
      } else if (String(pCat.label || '').trim() !== String(nCat.label || '').trim()) {
        details.push(`Mengubah nama kategori layanan dari "${pCat.label}" menjadi "${nCat.label}"`);
      }
    }
  }

  // 5. Vouchers diff
  const prevVouchers = Array.isArray(prevCatalog?.vouchers) ? prevCatalog.vouchers : [];
  const nextVouchers = Array.isArray(nextCatalog?.vouchers) ? nextCatalog.vouchers : [];
  const prevVMap = new Map(prevVouchers.map((v) => [String(v.code || '').toUpperCase(), v]));
  const nextVMap = new Map(nextVouchers.map((v) => [String(v.code || '').toUpperCase(), v]));
  for (const [code, pv] of prevVMap.entries()) {
    if (!nextVMap.has(code)) {
      details.push(`Menghapus voucher ${code}`);
    }
  }
  for (const [code, nv] of nextVMap.entries()) {
    const pv = prevVMap.get(code);
    if (!pv) {
      const uCfg = normalizeVoucherUsageConfig(nv);
      details.push(
        `Menambah voucher ${code} (${nv.label || formatRupiah(nv.value || 0)} · ${uCfg.usageLabel})`
      );
    } else {
      const pCfg = normalizeVoucherUsageConfig(pv);
      const nCfg = normalizeVoucherUsageConfig(nv);
      if (
        pv.type !== nv.type ||
        Number(pv.value || 0) !== Number(nv.value || 0) ||
        Number(pv.minSubtotal || 0) !== Number(nv.minSubtotal || 0)
      ) {
        details.push(`Mengubah ketentuan voucher ${code} (${nv.label || formatRupiah(nv.value || 0)})`);
      }
      if (pCfg.usageMode !== nCfg.usageMode || pCfg.maxUses !== nCfg.maxUses) {
        details.push(`Mengubah batas pemakaian voucher ${code} menjadi ${nCfg.usageLabel}`);
      }
    }
  }

  // 6. Brand, Fees, Discount, OpenGraph & Socials diff
  const prevBrand = prevCatalog?.brand || {};
  const nextBrand = nextCatalog?.brand || {};
  if (prevCatalog?.brand && nextCatalog?.brand) {
    if (
      prevBrand.logo &&
      nextBrand.logo &&
      String(prevBrand.logo).trim() !== String(nextBrand.logo).trim()
    ) {
      details.push('Mengubah logo brand utama');
    } else if (!prevBrand.logo && nextBrand.logo && nextBrand.logo !== './assets/icons/brand-icon.svg') {
      details.push('Mengubah logo brand utama');
    }

    if (
      prevBrand.name &&
      nextBrand.name &&
      String(prevBrand.name).trim() !== String(nextBrand.name).trim()
    ) {
      details.push(`Mengubah nama brand dari "${prevBrand.name}" menjadi "${nextBrand.name}"`);
    }

    if (
      prevBrand.tagline &&
      nextBrand.tagline &&
      String(prevBrand.tagline).trim() !== String(nextBrand.tagline).trim()
    ) {
      details.push(`Mengubah tulisan tagline header menjadi "${nextBrand.tagline}"`);
    }

    if (
      prevBrand.footerText &&
      nextBrand.footerText &&
      String(prevBrand.footerText).trim() !== String(nextBrand.footerText).trim()
    ) {
      details.push(`Mengubah teks footer menjadi "${nextBrand.footerText}"`);
    }

    const prevRate = Math.round(Number(prevBrand.payLaterSurchargeRate ?? 0.1) * 1000) / 10;
    const nextRate = Math.round(Number(nextBrand.payLaterSurchargeRate ?? 0.1) * 1000) / 10;
    if (prevRate !== nextRate) {
      details.push(`Mengubah biaya layanan Bayar Nanti dari ${prevRate}% menjadi ${nextRate}%`);
    }

    const prevFlat = Math.round(Number(prevBrand.serviceFeeFlat || 0));
    const nextFlat = Math.round(Number(nextBrand.serviceFeeFlat || 0));
    if (prevFlat !== nextFlat) {
      details.push(
        `Mengubah ${nextBrand.serviceFeeLabel || 'biaya layanan'} tetap dari ${formatRupiah(prevFlat)} menjadi ${formatRupiah(nextFlat)}`
      );
    }

    const prevDiscAmt = Math.round(Number(prevBrand.discountAmount ?? 2000));
    const nextDiscAmt = Math.round(Number(nextBrand.discountAmount ?? 2000));
    const prevDiscMin = Math.round(Number(prevBrand.discountThreshold ?? 50000));
    const nextDiscMin = Math.round(Number(nextBrand.discountThreshold ?? 50000));
    if (prevDiscAmt !== nextDiscAmt || prevDiscMin !== nextDiscMin) {
      details.push(
        `Mengubah diskon otomatis menjadi potongan ${formatRupiah(nextDiscAmt)} (min. belanja ${formatRupiah(nextDiscMin)})`
      );
    }

    if (
      prevBrand.whatsappNumber &&
      nextBrand.whatsappNumber &&
      String(prevBrand.whatsappNumber).trim() !== String(nextBrand.whatsappNumber).trim()
    ) {
      details.push(
        `Mengubah nomor WhatsApp admin dari ${prevBrand.whatsappNumber} menjadi ${nextBrand.whatsappNumber}`
      );
    }

    // OpenGraph changes
    if (prevBrand.openGraph || nextBrand.openGraph) {
      const pOg = normalizeOpenGraphConfig(prevBrand);
      const nOg = normalizeOpenGraphConfig(nextBrand);
      if (pOg.image !== nOg.image) {
        details.push('Mengubah gambar OpenGraph (Social Share Preview)');
      }
      if (pOg.title !== nOg.title) {
        details.push(`Mengubah judul OpenGraph menjadi "${nOg.title}"`);
      }
      if (pOg.tagline !== nOg.tagline) {
        details.push(`Mengubah tagline OpenGraph menjadi "${nOg.tagline}"`);
      }
      if (pOg.description !== nOg.description) {
        details.push('Mengubah caption / deskripsi OpenGraph');
      }
      if (pOg.siteName !== nOg.siteName) {
        details.push(`Mengubah nama situs OpenGraph menjadi "${nOg.siteName}"`);
      }
    }

    if (Array.isArray(prevBrand.socials) || Array.isArray(nextBrand.socials)) {
      const pSocials = normalizeBrandSocials(prevBrand);
      const nSocials = normalizeBrandSocials(nextBrand);
      const pSocMap = new Map(pSocials.map((s) => [s.id, s]));
      const nSocMap = new Map(nSocials.map((s) => [s.id, s]));
      for (const [sid, ps] of pSocMap.entries()) {
        if (!nSocMap.has(sid)) {
          details.push(`Menghapus kontak/sosmed ${ps.label || ps.platform}`);
        }
      }
      for (const [sid, ns] of nSocMap.entries()) {
        const ps = pSocMap.get(sid);
        if (!ps) {
          details.push(`Menambah kontak/sosmed ${ns.label || ns.platform}`);
        } else {
          if (String(ps.logo || '') !== String(ns.logo || '')) {
            details.push(`Mengubah logo sosmed ${ns.label || ns.platform}`);
          }
          if (
            String(ps.label || '') !== String(ns.label || '') ||
            String(ps.url || '') !== String(ns.url || '') ||
            String(ps.handle || '') !== String(ns.handle || '')
          ) {
            details.push(`Memperbarui link/info sosmed ${ns.label || ns.platform}`);
          }
        }
      }
    }
  }

  // 7. Banners diff
  if (Array.isArray(prevCatalog?.banners) || Array.isArray(nextCatalog?.banners)) {
    const pBanners = normalizeBanners(prevCatalog?.banners);
    const nBanners = normalizeBanners(nextCatalog?.banners);
    const pBanMap = new Map(pBanners.map((b) => [b.id, b]));
    const nBanMap = new Map(nBanners.map((b) => [b.id, b]));
    for (const [bid, pb] of pBanMap.entries()) {
      if (!nBanMap.has(bid)) {
        details.push(`Menghapus banner "${pb.heading || pb.kicker || bid}"`);
      }
    }
    for (const [bid, nb] of nBanMap.entries()) {
      const pb = pBanMap.get(bid);
      if (!pb) {
        details.push(`Menambah banner baru "${nb.heading || nb.kicker || bid}"`);
      } else {
        if (String(pb.image || '') !== String(nb.image || '')) {
          details.push(`Mengubah gambar banner "${nb.heading || pb.heading}"`);
        }
        if (String(pb.heading || '') !== String(nb.heading || '')) {
          details.push(`Mengubah judul banner dari "${pb.heading}" menjadi "${nb.heading}"`);
        } else if (
          String(pb.kicker || '') !== String(nb.kicker || '') ||
          String(pb.sub || '') !== String(nb.sub || '') ||
          String(pb.ctaLabel || '') !== String(nb.ctaLabel || '') ||
          String(pb.href || '') !== String(nb.href || '')
        ) {
          details.push(`Memperbarui tulisan/tautan pada banner "${nb.heading}"`);
        }
      }
    }
    const commonPrevBan = pBanners.map((b) => b.id).filter((id) => nBanMap.has(id));
    const commonNextBan = nBanners.map((b) => b.id).filter((id) => pBanMap.has(id));
    if (commonPrevBan.length > 1 && commonPrevBan.join('::') !== commonNextBan.join('::')) {
      details.push('Mengubah urutan slide banner di beranda');
    }
  }

  // 8. FAQ diff
  const prevFaq = Array.isArray(prevCatalog?.faqItems) ? prevCatalog.faqItems : [];
  const nextFaq = Array.isArray(nextCatalog?.faqItems) ? nextCatalog.faqItems : [];
  if (prevFaq.length > 0 || nextFaq.length > 0) {
    const prevFaqMap = new Map(prevFaq.map((f) => [String(f.question || '').trim(), f]));
    const nextFaqMap = new Map(nextFaq.map((f) => [String(f.question || '').trim(), f]));
    for (const [q] of prevFaqMap.entries()) {
      if (q && !nextFaqMap.has(q)) {
        details.push(`Menghapus pertanyaan umum: "${q}"`);
      }
    }
    for (const [q, nf] of nextFaqMap.entries()) {
      if (!q) continue;
      const pf = prevFaqMap.get(q);
      if (!pf) {
        details.push(`Menambah pertanyaan umum: "${q}"`);
      } else if (String(pf.answer || '').trim() !== String(nf.answer || '').trim()) {
        details.push(`Mengubah jawaban pertanyaan umum: "${q}"`);
      }
    }
  }

  // 9. Utilities diff (Menu Utilitas callout, Music Hero card, & 7 Utility Tab Items)
  if (prevCatalog?.utilities || nextCatalog?.utilities) {
    const pUtil = normalizeUtilityConfig(prevCatalog?.utilities);
    const nUtil = normalizeUtilityConfig(nextCatalog?.utilities);

    if (pUtil.callout.icon !== nUtil.callout.icon) {
      details.push('Mengubah ikon kartu Menu Utilitas di beranda');
    }
    if (
      pUtil.callout.title !== nUtil.callout.title ||
      pUtil.callout.badge !== nUtil.callout.badge ||
      pUtil.callout.description !== nUtil.callout.description
    ) {
      details.push(`Memperbarui teks kartu Menu Utilitas ("${nUtil.callout.title}")`);
    }

    if (pUtil.musicHero.icon !== nUtil.musicHero.icon) {
      details.push('Mengubah ikon kartu YT Music Hub');
    }
    if (pUtil.musicHero.title !== nUtil.musicHero.title) {
      details.push(`Mengubah judul kartu YT Music Hub menjadi "${nUtil.musicHero.title}"`);
    }
    if (pUtil.musicHero.subtitle !== nUtil.musicHero.subtitle) {
      details.push('Memperbarui deskripsi kartu YT Music Hub');
    }

    const pItemMap = new Map(pUtil.items.map((it) => [it.id, it]));
    for (const nIt of nUtil.items) {
      const pIt = pItemMap.get(nIt.id);
      if (!pIt) continue;
      if (pIt.icon !== nIt.icon) {
        details.push(`Mengubah ikon menu utilitas "${nIt.label}"`);
      }
      if (pIt.label !== nIt.label) {
        details.push(`Mengubah nama menu utilitas "${pIt.label}" menjadi "${nIt.label}"`);
      }
      if (pIt.pageTitle !== nIt.pageTitle) {
        details.push(`Mengubah judul halaman utilitas "${nIt.label}" menjadi "${nIt.pageTitle}"`);
      }
      if (pIt.pageSubtitle !== nIt.pageSubtitle) {
        details.push(`Memperbarui subjudul halaman utilitas "${nIt.label}"`);
      }
      if (pIt.heroKicker !== nIt.heroKicker) {
        details.push(`Memperbarui caption kartu utilitas "${nIt.label}"`);
      }
      if (pIt.heroTitle !== nIt.heroTitle) {
        details.push(`Mengubah judul kartu fitur "${nIt.label}" menjadi "${nIt.heroTitle}"`);
      }
      if (pIt.heroDescription !== nIt.heroDescription) {
        details.push(`Memperbarui deskripsi kartu fitur "${nIt.label}"`);
      }
    }
  }

  return details.length > 0 ? details : ['Sinkronisasi katalog terbaru'];
}

export function pruneCatalogHistory(entries = [], maxEntries = MAX_HISTORY_LOGS) {
  const limit = Math.max(1, Math.trunc(Number(maxEntries) || MAX_HISTORY_LOGS));
  const list = Array.isArray(entries) ? entries.filter((e) => e && e.id && e.snapshot) : [];
  const sorted = [...list].sort(
    (a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0)
  );
  return sorted.slice(0, limit);
}

export function appendCatalogHistory(entries = [], entryInput = {}, maxEntries = MAX_HISTORY_LOGS) {
  const existingList = Array.isArray(entries) ? entries : [];
  const prevSnapshot = entryInput.prevSnapshot || existingList[0]?.snapshot || null;
  const computedDetails =
    Array.isArray(entryInput.details) && entryInput.details.length > 0
      ? entryInput.details.map((d) => String(d).trim()).filter(Boolean)
      : prevSnapshot && entryInput.snapshot
      ? describeCatalogChanges(prevSnapshot, entryInput.snapshot)
      : [];

  const nextEntry = {
    id:
      entryInput.id ||
      `rev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: entryInput.createdAt || new Date().toISOString(),
    action: String(entryInput.action || 'publish'),
    summary: String(
      entryInput.summary ||
        (computedDetails.length > 0 ? computedDetails[0] : 'Pembaruan katalog')
    ),
    details: computedDetails,
    productCount: Number.isFinite(entryInput.productCount)
      ? entryInput.productCount
      : Array.isArray(entryInput.snapshot?.products)
      ? entryInput.snapshot.products.length
      : 0,
    voucherCount: Number.isFinite(entryInput.voucherCount)
      ? entryInput.voucherCount
      : Array.isArray(entryInput.snapshot?.vouchers)
      ? entryInput.snapshot.vouchers.length
      : 0,
    snapshot: compactCatalogForHistory(entryInput.snapshot),
  };

  return pruneCatalogHistory([nextEntry, ...existingList], maxEntries);
}

export function summarizeCatalogDiff(prevCatalog, nextCatalog) {
  const details = describeCatalogChanges(prevCatalog, nextCatalog);
  if (!details || details.length === 0) {
    return 'Sinkronisasi katalog terbaru';
  }
  if (details.length === 1) {
    return details[0];
  }
  if (details.length === 2) {
    return `${details[0]} · ${details[1]}`;
  }
  return `${details[0]} · ${details[1]} (+${details.length - 2} perubahan lainnya)`;
}

