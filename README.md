# Manifestudio

Katalog web statis resmi **Manifestudio** (dikelola oleh tMC Tomy Studio) untuk pemesanan akun premium dan layanan digital bergaransi. Dirancang 100% kompatibel dengan **GitHub Pages** serta mendukung instalasi **Progressive Web App (PWA)**.

## Fitur Utama
- **Katalog Interaktif**: Pencarian real-time, filter kategori, filter stok tersedia, serta modal varian lengkap dengan harga dan status garansi.
- **Mode Gelap & Terang**: Switch tema persisten yang tersimpan di `localStorage`.
- **Keranjang & Diskon Otomatis**: Potongan harga otomatis **Rp2.000** untuk total belanja minimal **Rp50.000**.
- **Kode Voucher Opsional**: Dukungan kolom kode voucher (`HEMAT2K`, `MANIFEST5`, `PROMO10`, atau kode promo admin).
- **Transparansi Metode Pembayaran**:
  - `Bayar Sekarang`: 0% biaya tambahan.
  - `Bayar Nanti (Setelah Akun Diterima)`: biaya layanan tambahan **+10%** ditampilkan secara transparan sebelum checkout.
- **Struk Belanja Otomatis (Canvas 2D)**: Menekan **Buat Pesanan** menghasilkan gambar struk JPEG ringan (`~30–55 KB`) secara instan di browser tanpa library eksternal untuk langsung dikirim via Web Share API / unduh + WhatsApp Admin.
- **PWA Installable**: Banner install dengan tombol **Minimize (`−`)** ke dock melayang dan **Hilangkan (`×`)** permanen, plus dukungan cache offline (`sw.js`).

## Struktur Folder
- `index.html` — Halaman utama katalog & modal/drawer checkout.
- `css/tokens.css`, `css/styles.css` — Token tema terang/gelap dan styling responsif.
- `js/data.js` — Data produk, varian, kategori, metode pembayaran, voucher, dan FAQ.
- `js/store.js` — Logika murni (filter, harga, voucher, biaya 10%, format WhatsApp) + `js/store.test.mjs`.
- `js/receipt.js` — Generator gambar struk otomatis berbasis HTML5 Canvas 2D.
- `js/pwa.js`, `sw.js`, `manifest.webmanifest` — Manajemen siklus hidup PWA & offline cache.
- `assets/` — Banner hero, ikon PWA, dan logo SVG aplikasi.

## Pengujian Lokal
```bash
node --test js/store.test.mjs
```
