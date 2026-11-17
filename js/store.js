/**
 * Pure storefront state, filtering, pricing, voucher, 10% pay-later fee,
 * clean WhatsApp message template formatting, and admin catalog helpers.
 * Zero DOM dependencies so all business logic can be unit tested directly.
 */

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

  const lines = [
    '*PESANAN BARU — MANIFESTUDIO*',
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
  whatsappNumber = '6285122936027',
  customerName,
  whatsappNote = '',
  paymentOption,
  cart = [],
  totals,
  now = new Date(),
}) {
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
    customerName,
    whatsappNote,
    paymentOption,
    cart: safeCart,
    totals,
  });

  return {
    orderCode,
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

export const DEFAULT_BANNERS = [
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
    .map((b, idx) => ({
      id: String(b.id || `banner-${idx + 1}`).trim(),
      kicker: String(b.kicker || 'Promo & Info')
        .trim()
        .replace(/^Menu Lainnya\b/i, 'Menu Utilitas'),
      heading: String(b.heading || 'Manifestudio').trim(),
      sub: String(b.sub || '').trim(),
      ctaLabel: String(b.ctaLabel || 'Selengkapnya').trim() || 'Selengkapnya',
      href: String(b.href || '#katalog').trim() || '#katalog',
      image: String(b.image ?? '').trim(),
      scrim: ['default', 'prayer', 'weather', 'world', 'downloader'].includes(
        String(b.scrim || '').trim()
      )
        ? String(b.scrim).trim()
        : 'default',
    }));
}

export const DEFAULT_UTILITY_CONFIG = {
  callout: {
    icon: './assets/icons/menu-utilitas.svg',
    title: 'Menu Utilitas',
    badge: '7 Fitur Gratis',
    description:
      'Jadwal Sholat · Cuaca · Jam Dunia & Globe · Speedtest · Downloader (Video/Foto/Story/Caption) · Kompres HD · YT Music',
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
    },
    {
      id: 'weather',
      label: 'Prakiraan Cuaca',
      icon: './assets/icons/tool-weather.svg',
      pageTitle: 'Prakiraan Cuaca Real-Time',
      pageSubtitle:
        'Kondisi cuaca saat ini, curah hujan presisi per jam, kelembapan, UV, angin, & prakiraan 7 hari ke depan.',
    },
    {
      id: 'worldclock',
      label: 'Jam Dunia & Globe',
      icon: './assets/icons/tool-world.svg',
      pageTitle: 'Jam Dunia UTC & Bola Dunia',
      pageSubtitle:
        'Standar waktu internasional UTC/GMT, WIB, WITA, WIT, serta konversi waktu lintas negara.',
    },
    {
      id: 'speedtest',
      label: 'Speedtest',
      icon: './assets/icons/tool-speed.svg',
      pageTitle: 'Speedtest Internet Real-Time',
      pageSubtitle:
        'Uji kecepatan rata-rata download, upload, ping, jitter, lokasi server, ISP, dan perangkat Anda.',
    },
    {
      id: 'downloader',
      label: 'Downloader',
      icon: './assets/icons/tool-downloader.svg',
      pageTitle: 'Downloader Video, Foto, Carousel & Story',
      pageSubtitle:
        'Unduh video HD, postingan foto, slide carousel, story, & salin caption dari TikTok, IG, YT, dan FB.',
    },
    {
      id: 'compressor',
      label: 'Kompresor HD',
      icon: './assets/icons/tool-compressor.svg',
      pageTitle: 'Kompresor Foto & Video HD (Anti-Pecah Sosmed)',
      pageSubtitle:
        '4 metode kompresi ukuran file tanpa menurunkan ketajaman visual agar lolos kompresi ulang TikTok, IG, & WA.',
    },
    {
      id: 'music',
      label: 'Musik YT',
      icon: './assets/icons/tool-music.svg',
      pageTitle: 'YT Music Player — Viral Indonesia',
      pageSubtitle:
        'Pemutar YT Music API bebas iklan dengan daftar putar acak otomatis lagu Indonesia viral, pencarian lengkap, & sinkron dengan ikon mengambang.',
    },
  ],
};

export function normalizeUtilityConfig(utilities = {}) {
  const safe = utilities && typeof utilities === 'object' ? utilities : {};
  const rawCallout = safe.callout && typeof safe.callout === 'object' ? safe.callout : {};
  const rawMusicHero = safe.musicHero && typeof safe.musicHero === 'object' ? safe.musicHero : {};
  const rawItems = Array.isArray(safe.items) ? safe.items : [];
  const rawItemMap = new Map(
    rawItems
      .filter((it) => it && typeof it === 'object' && it.id)
      .map((it) => [String(it.id).trim(), it])
  );

  const items = DEFAULT_UTILITY_CONFIG.items.map((defItem) => {
    const custom = rawItemMap.get(defItem.id) || {};
    return {
      id: defItem.id,
      label: String(custom.label || defItem.label).trim() || defItem.label,
      icon: String(custom.icon || defItem.icon).trim() || defItem.icon,
      pageTitle: String(custom.pageTitle || defItem.pageTitle).trim() || defItem.pageTitle,
      pageSubtitle: String(custom.pageSubtitle || defItem.pageSubtitle).trim() || defItem.pageSubtitle,
    };
  });

  return {
    callout: {
      icon:
        String(rawCallout.icon || DEFAULT_UTILITY_CONFIG.callout.icon).trim() ||
        DEFAULT_UTILITY_CONFIG.callout.icon,
      title:
        String(rawCallout.title || DEFAULT_UTILITY_CONFIG.callout.title).trim() ||
        DEFAULT_UTILITY_CONFIG.callout.title,
      badge:
        String(rawCallout.badge || DEFAULT_UTILITY_CONFIG.callout.badge).trim() ||
        DEFAULT_UTILITY_CONFIG.callout.badge,
      description:
        String(rawCallout.description || rawCallout.subtitle || DEFAULT_UTILITY_CONFIG.callout.description).trim() ||
        DEFAULT_UTILITY_CONFIG.callout.description,
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
      label: itemInput.label !== undefined ? String(itemInput.label).trim() || it.label : it.label,
      icon: itemInput.icon !== undefined ? String(itemInput.icon).trim() || it.icon : it.icon,
      pageTitle:
        itemInput.pageTitle !== undefined ? String(itemInput.pageTitle).trim() || it.pageTitle : it.pageTitle,
      pageSubtitle:
        itemInput.pageSubtitle !== undefined
          ? String(itemInput.pageSubtitle).trim() || it.pageSubtitle
          : it.pageSubtitle,
    };
  });
  return {
    ...catalog,
    utilities: {
      ...currentUtil,
      items,
    },
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
  const cleanScrim = ['default', 'prayer', 'weather', 'world', 'downloader'].includes(
    String(bannerInput.scrim || '').trim()
  )
    ? String(bannerInput.scrim).trim()
    : 'default';

  const currentBanners = normalizeBanners(catalog?.banners);
  const existingIdx = currentBanners.findIndex((b) => b.id === cleanId);
  const entry = {
    id: cleanId,
    kicker: cleanKicker,
    heading: cleanHeading,
    sub: cleanSub,
    ctaLabel: cleanCta,
    href: cleanHref,
    image: cleanImage,
    scrim: cleanScrim,
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

