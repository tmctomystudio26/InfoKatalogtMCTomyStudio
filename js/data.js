export const BRAND = {
  name: 'Manifestudio',
  tagline: 'Katalog Layanan Digital & Akun Premium',
  whatsappNumber: '6285122936027',
  tiktokUrl: 'https://www.tiktok.com/@tmctomystudio',
  tiktokHandle: '@tmctomystudio',
  instagramUrl: 'https://www.instagram.com/tmctomystudio',
  instagramHandle: '@tmctomystudio',
  discountThreshold: 50000,
  discountAmount: 2000,
};

export const CATEGORIES = [
  { id: 'all', label: 'Semua Layanan' },
  { id: 'streaming', label: 'Streaming Film' },
  { id: 'music', label: 'Musik & Hiburan' },
  { id: 'creative', label: 'Desain & Editing' },
  { id: 'custom', label: 'Request & Custom' },
];

export const CATEGORY_LABELS = {
  streaming: 'Streaming',
  music: 'Musik',
  creative: 'Desain & Editing',
  custom: 'Custom',
};

export const PAYMENT_OPTIONS = [
  {
    id: 'Bayar Sekarang',
    label: 'Bayar Sekarang (QRIS / E-Wallet / Bank)',
    note: 'Proses prioritas instan setelah bukti transfer dikonfirmasi.',
  },
  {
    id: 'Bayar Belakangan (Setelah Akun Diterima)',
    label: 'Bayar Setelah Akun Aktif',
    note: 'Khusus pesanan tertentu dengan verifikasi admin via WhatsApp.',
  },
];

export const ORDER_STEPS = [
  {
    step: '01. Pilih Paket & Durasi',
    detail: 'Buka produk yang diinginkan, periksa keterangan garansi, lalu tambahkan varian ke keranjang.',
  },
  {
    step: '02. Periksa Diskon Otomatis',
    detail: 'Total belanja minimal Rp50.000 otomatis mendapatkan potongan harga Rp2.000 di keranjang.',
  },
  {
    step: '03. Kirim Format ke WhatsApp',
    detail: 'Isi nama panggilan dan metode pembayaran, lalu kirim rincian terformat langsung ke admin.',
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
    tag: 'Paling laris',
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
    tag: 'Populer kreator',
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
    tag: 'Segera restock',
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
    tag: 'Segera restock',
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
    tag: 'Favorit editor',
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
    tag: 'Layanan custom',
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
    question: 'Berapa lama proses aktivasi setelah pemesanan?',
    answer:
      'Pesanan yang sudah dibayar diproses rata-rata dalam 3 hingga 10 menit selama jam operasional admin melalui WhatsApp.',
  },
  {
    question: 'Apa perbedaan paket Sharing dan Privat?',
    answer:
      'Paket Sharing menggunakan profil terpisah dalam satu akun bersama sesuai kuota (misal 1P1U atau 1P2U), sedangkan paket Privat memberikan kendali penuh atas seluruh akun.',
  },
  {
    question: 'Bagaimana sistem garansi penggantian akun bekerja?',
    answer:
      'Setiap paket dengan keterangan garansi akan mendapat penggantian akun baru sesuai ketentuan masa garansi apabila terjadi kendala akses bukan karena pelanggaran aturan penggunaan.',
  },
];
