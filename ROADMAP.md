# Manifestudio — Roadmap Pengembangan

Dokumen ini menjadi acuan arah arsitektur dan rencana pengembangan **Manifestudio** bagi pengembang manusia maupun agen AI berikutnya.

---

## Arsitektur Saat Ini (v2.1)

```
InfoKatalogtMCTomyStudio/
├── index.html               # Entry point semantik (path relatif ./)
├── manifest.webmanifest     # Metadata & ikon PWA (any + maskable)
├── sw.js                    # Service Worker precache + offline fallback
├── .nojekyll                # Mencegah pemrosesan Jekyll di GitHub Pages
├── css/
│   ├── tokens.css           # Design tokens Mode Terang & Mode Gelap
│   └── styles.css           # Layout editorial responsif & komponen UI
├── js/
│   ├── data.js              # Sumber kebenaran katalog produk, harga, langkah pesan & FAQ
│   ├── store.js             # Pure functions (filter, keranjang, diskon, format WA)
│   ├── store.test.mjs       # Unit test otomatis berbasis node:test
│   ├── pwa.js               # Manajemen install PWA (expand / minimize / dismiss)
│   └── app.js               # Controller DOM, tema, modal varian & laci checkout
└── assets/
    ├── hero-editorial.jpg   # Foto editorial utama pada split hero
    ├── icons/               # Ikon PWA PNG (192, 512, maskable, apple-touch) & brand SVG
    └── logos/               # 10 logo SVG lokal tiap layanan & custom request
```

### Aturan Penting untuk Pengembang Berikutnya
1. **Path Relatif (`./`)**: GitHub Pages sering menayangkan proyek di subpath (`/NamaRepo/`). Gunakan selalu `./assets/...`, jangan `/assets/...`.
2. **Pemisahan Pure Logic (`js/store.js`)**: Pertahankan seluruh logika perhitungan harga, diskon, pencarian, dan format WhatsApp di `js/store.js` tanpa ketergantungan DOM agar tetap teruji melalui `node --test js/store.test.mjs`.
3. **Tanpa Mixed Content**: Jangan memanggil API eksternal melalui `http://`.
4. **Kontrol Penawaran PWA**: Pertahankan tombol **Minimize** dan **Hilangkan (Dismiss)** pada penawaran install PWA serta simpan preferensi pengguna di `localStorage`.

---

## Tahapan Roadmap

### Fase 1 — Fondasi Storefront Editorial & PWA (Selesai · v2.1)
- [x] Rebranding ke **Manifestudio** dengan sistem desain editorial tanpa visual clutter.
- [x] Pemisahan struktur modular (`css/`, `js/`, `assets/logos/`, `assets/icons/`).
- [x] Mode Terang & Mode Gelap dengan persistensi `localStorage`.
- [x] Filter kategori, pencarian instan, dan filter stok tersedia.
- [x] Logo SVG lokal untuk seluruh 10 layanan + penanda harga lama (`oldPrice`) & status restock.
- [x] Laci keranjang belanja dengan progress bar diskon otomatis (`>= Rp50.000` hemat `Rp2.000`).
- [x] Checkout WhatsApp terstruktur dengan validasi form inline tanpa `window.alert`.
- [x] PWA Installable + Service Worker cache offline + kontrol Minimize & Dismiss.
- [x] Unit test logika toko (`js/store.test.mjs`).

### Fase 2 — Otomasi Katalog & Pengalaman Pelanggan (v2.2)
- [ ] **Ekstraksi Katalog ke `data/products.json`**: Memudahkan pembaruan stok/harga massal tanpa menyentuh kode JavaScript.
- [ ] **Kode Kupon / Voucher Dinamis**: Mendukung kode promo musiman di `js/store.js` lengkap dengan unit test.
- [ ] **Riwayat Pesanan Lokal (`Order History Vault`)**: Menyimpan ringkasan pesanan terakhir user di `localStorage` untuk *Reorder 1-Klik*.

### Fase 3 — Sinkronisasi & Pembayaran Opsional (v3.0)
- [ ] **Worker API Ringan Opsional**: Pembaruan stok real-time dan QRIS dinamis tanpa menghilangkan mode fallback statis GitHub Pages.
- [ ] **Pelacakan Status Pesanan**: Halaman mini pengecekan estimasi antrean aktivasi berdasarkan kode transaksi.
