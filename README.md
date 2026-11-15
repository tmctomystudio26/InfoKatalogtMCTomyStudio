# Manifestudio — Katalog Layanan Digital & Akun Premium

Storefront web statis untuk katalog layanan digital dan akun premium bergaransi. Dirancang dengan arsitektur modular tanpa server backend sehingga berjalan 100% di **GitHub Pages**, responsif di desktop maupun mobile, mendukung **Mode Terang / Gelap**, dan dapat diinstal sebagai **PWA (Progressive Web App)**.

## Fitur Utama
- **Desain Editorial Retail**: Tata letak split-hero, tipografi `Bricolage Grotesque`, `Manrope`, dan angka tabular `IBM Plex Mono`, tanpa dekorasi berlebihan.
- **Mode Terang & Mode Gelap**: Pengubah tema langsung di toolbar katalog yang tersimpan otomatis di `localStorage`.
- **Katalog & Filter Cepat**: Filter kategori (`Streaming Film`, `Musik & Hiburan`, `Desain & Editing`, `Request & Custom`), filter stok tersedia, dan pencarian instan.
- **Logo Khusus Setiap Aplikasi**: Aset SVG lokal untuk seluruh 10 layanan.
- **Keranjang & Diskon Otomatis**: Tambah banyak varian, atur jumlah, pantau progress diskon otomatis (`Rp2.000` untuk belanja minimal `Rp50.000`), dan buat format pesanan WhatsApp instan.
- **PWA Siap Install**: Mendukung cache offline (`sw.js`) serta banner penawaran install yang dapat **di-minimize** maupun **dihilangkan** oleh pengguna.

## Menjalankan Secara Lokal
Karena menggunakan ES Modules (`<script type="module">`), buka melalui HTTP server lokal:
```bash
python3 -m http.server 4173
```

## Menjalankan Unit Test
```bash
node --test js/store.test.mjs
```

## Roadmap Pengembangan
Lihat [`ROADMAP.md`](./ROADMAP.md) untuk panduan arsitektur dan rencana fase berikutnya.
