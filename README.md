# Manifestudio — Digital Store & Premium Catalog

Storefront web statis modern bergaya e-commerce & top-up digital untuk katalog akun premium, desain kreatif, dan layanan streaming bergaransi. Dirancang agar ringan, responsif di mobile maupun desktop, mendukung **Mode Gelap / Terang**, dapat diinstal sebagai **PWA (Progressive Web App)**, dan berjalan 100% di **GitHub Pages** tanpa server backend.

## Fitur Utama
- **Desain Modern & Responsif**: Layout grid adaptif, tipografi rapi (`Outfit`, `Plus Jakarta Sans`, `JetBrains Mono`), dan transisi halus yang ramah mobile maupun desktop.
- **Mode Gelap & Mode Terang**: Tombol pengubah tema instan yang tersimpan otomatis.
- **Katalog & Pencarian Cepat**: Filter berdasarkan kategori (`Streaming Film`, `Musik & Hiburan`, `Desain & Editing`, `Request & Custom`), filter stok tersedia, serta pencarian langsung.
- **Logo Khusus Setiap Aplikasi**: Aset SVG lokal tajam untuk Netflix, Canva Pro, YouTube Premium, Spotify, Viu, Vidio, Alight Motion, WeTV, Prime Video, dan Custom Request.
- **Keranjang & Diskon Otomatis**: Tambah banyak paket sekaligus, atur jumlah, pantau progress diskon otomatis (`Rp2.000` untuk belanja minimal `Rp50.000`), dan buat format pesanan WhatsApp instan.
- **PWA Siap Install**: Mendukung mode offline via Service Worker (`sw.js`) serta banner penawaran install yang dapat **di-minimize** maupun **dihilangkan** sesuai pilihan pengguna.

## Menjalankan Secara Lokal
Karena menggunakan ES Modules (`<script type="module">`), buka folder ini melalui static server HTTP lokal (bukan `file://`):

```bash
npx serve .
# atau
python3 -m http.server 4173
```

## Menjalankan Unit Test
```bash
node --test js/store.test.mjs
```

## Arah Pengembangan Selanjutnya
Lihat [`ROADMAP.md`](./ROADMAP.md) untuk daftar lengkap struktur arsitektur dan rencana pengembangan fitur berikutnya.
