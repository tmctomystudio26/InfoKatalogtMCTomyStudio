# Manifestudio — Roadmap Pengembangan

Dokumen ini menjadi panduan arah arsitektur, fitur, dan prioritas pengembangan **Manifestudio** bagi pengembang manusia maupun agen AI berikutnya.

---

## Visi Teknis
Membangun storefront katalog layanan digital & akun premium yang terasa secepat aplikasi top-up modern (2026), responsif di desktop maupun mobile, mendukung instalasi **PWA (Progressive Web App)** dengan mode offline, dan **100% kompatibel dengan hosting statis GitHub Pages** tanpa ketergantungan backend wajib.

---

## Arsitektur Saat Ini (v2.0)

```
InfoKatalogtMCTomyStudio/
├── index.html               # Entry point semantik (path relatif ./)
├── manifest.webmanifest     # Metadata & ikon PWA (any + maskable)
├── sw.js                    # Service Worker precache + offline fallback
├── .nojekyll                # Mencegah pemrosesan Jekyll di GitHub Pages
├── css/
│   ├── tokens.css           # Design tokens tema Gelap & Terang
│   └── styles.css           # Layout responsif & komponen UI modern
├── js/
│   ├── data.js              # Sumber kebenaran katalog produk, harga, FAQ & kontak
│   ├── store.js             # Pure functions (filter, keranjang, diskon, format WA)
│   ├── store.test.mjs       # Unit test otomatis berbasis node:test
│   ├── pwa.js               # Manajemen install PWA (expand/minimize/dismiss)
│   └── app.js               # Controller DOM, tema, modal varian & drawer checkout
└── assets/
    ├── hero-banner.jpg      # Banner visual utama storefront
    ├── icons/               # Ikon PWA PNG (192, 512, maskable, apple-touch) & SVG
    └── logos/               # 10 logo SVG lokal tiap layanan & custom request
```

### Prinsip Wajib untuk Pengembang Berikutnya
1. **Path Relatif (`./`)**: GitHub Pages sering menayangkan proyek di subpath (`/NamaRepo/`). Dilarang menggunakan path absolut akar seperti `/assets/...`. Selalu gunakan `./assets/...`.
2. **Pemisahan Pure Logic (`js/store.js`)**: Setiap aturan harga, diskon, pencarian, dan format WhatsApp wajib tetap berada di `js/store.js` tanpa menyentuh `document`/`window` agar bisa terus diuji lewat `node --test js/store.test.mjs`.
3. **Tanpa Mixed Content**: Dilarang memuat API atau aset lewat `http://` karena akan diblokir di HTTPS GitHub Pages.
4. **Hormat terhadap Preferensi PWA User**: Banner penawaran install aplikasi harus selalu mempertahankan kontrol **Minimize** dan **Hilangkan (Dismiss)** yang tersimpan di `localStorage`.

---

## Tahapan Roadmap

### Fase 1 — Fondasi Storefront Modern & PWA (Selesai · v2.0)
- [x] Rebranding ke **Manifestudio** dengan identitas visual modern.
- [x] Pemisahan struktur modular (`css/`, `js/`, `assets/logos/`, `assets/icons/`).
- [x] Mode Gelap & Mode Terang dengan persistensi `localStorage`.
- [x] Filter kategori, pencarian instan, dan toggle stok tersedia.
- [x] Logo lokal SVG untuk seluruh produk + penanda harga lama (`oldPrice`) & status restock.
- [x] Keranjang belanja slide-over dengan progress bar diskon otomatis (`>= Rp50.000` hemat `Rp2.000`).
- [x] Checkout WhatsApp terstruktur dengan validasi form inline (tanpa `window.alert`).
- [x] PWA Installable + Service Worker cache offline + tombol Minimize & Dismiss.
- [x] Unit test logika toko (`js/store.test.mjs`).

### Fase 2 — Otomasi Katalog & Pengalaman Pelanggan (v2.1)
- [ ] **Ekstraksi Katalog ke `data/products.json` + Admin Previewer**: Memudahkan pembaruan stok/harga massal tanpa menyentuh kode JavaScript.
- [ ] **Sistem Kode Voucher / Promo Dinamis**: Mendukung kode kupon musiman (misal potongan nominal atau persentase) di `js/store.js` lengkap dengan unit test.
- [ ] **Riwayat Pesanan Lokal (`Order History Vault`)**: Menyimpan ringkasan pesanan terakhir user di `localStorage` sehingga pelanggan dapat mengulang pesanan (*Reorder 1-Klik*) atau menyalin ulang rincian WhatsApp.
- [ ] **Notifikasi Restock Interaktif**: Opsi cepat bagi user untuk mengirim pesan pengingat stok produk habis (`YouTube Premium`, `Spotify Premium`) ke admin.

### Fase 3 — Integrasi Pembayaran & Sinkronisasi Opsional (v3.0)
- [ ] **Worker API Ringan Opsional (Cloudflare Workers / Vercel)**: Webhook status stok real-time dan pembuatan QRIS dinamis tanpa menghilangkan mode fallback statis GitHub Pages.
- [ ] **Pelacakan Status Pesanan**: Halaman mini untuk mengecek estimasi antrean aktivasi pesanan berdasarkan ID transaksi WhatsApp.
- [ ] **Analitik Ringan Privacy-Friendly**: Pencatatan klik produk paling diminati (tanpa cookie pelacak pihak ketiga).

---

## Cara Menguji Perubahan Sebelum Push
Jalankan unit test logika toko menggunakan Node.js v18+:
```bash
node --test js/store.test.mjs
```
Jika memperbarui aset statis atau menambah logo baru, pastikan daftar file di `PRECACHE_ASSETS` pada `sw.js` ikut diperbarui dan naikkan versi `CACHE_NAME` (misalnya `manifestudio-cache-v2`).
