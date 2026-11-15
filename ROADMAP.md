# Roadmap Pengembangan Manifestudio

Dokumen ini menjadi panduan arah pengembangan berikutnya bagi developer manusia maupun AI pada repositori statis **Manifestudio** (GitHub Pages + PWA).

## Fase 1 — Fondasi Katalog & Checkout Statis (Selesai)
- Struktur modular ES Modules (`data.js`, `store.js`, `receipt.js`, `pwa.js`, `app.js`) tanpa bundler atau backend wajib.
- Mode Gelap/Terang persisten dan responsivitas penuh desktop & mobile.
- PWA lengkap (`manifest.webmanifest`, `sw.js` dengan precache relatif `./`, serta penawaran install yang dapat di-minimize atau di-dismiss).
- Unit test logika toko menggunakan `node:test` (`js/store.test.mjs`).

## Fase 2 — Transparansi Checkout & Struk Otomatis (Selesai)
- Perbaikan stabilitas scroll pada drawer checkout saat mengganti opsi pembayaran atau voucher.
- Penerapan biaya tambahan **+10%** yang transparan untuk opsi **Bayar Nanti (Setelah Akun Diterima)**.
- Kolom kode voucher opsional dengan evaluasi otomatis & fallback verifikasi admin.
- Generator gambar struk belanja ringan berbasis HTML5 Canvas 2D (`js/receipt.js`) beserta integrasi Web Share API / unduh otomatis + pesan WhatsApp.

## Fase 3 — Panel Admin Statis & Sinkronisasi Katalog JSON (Selesai)
- Pemisahan data tunggal katalog, varian, harga, voucher, dan FAQ ke `data/catalog.json` (dengan fetch Network-First di `sw.js`).
- Halaman khusus `admin.html` (`js/admin.js`) untuk toggle stok, edit harga, tambah varian, tambah produk baru, dan kelola voucher langsung dari browser HP/Desktop tanpa membuka editor kode.
- Integrasi GitHub Contents API (`PUT data/catalog.json`) memakai Fine-Grained PAT lokal admin agar perubahan sinkron ke semua pengunjung GitHub Pages, plus fitur pratinjau lokal & unduh JSON backup.
- Perbaikan alur checkout WhatsApp agar langsung mengarah ke chat Admin (`wa.me/6285122936027`) membawa teks rapi sekaligus mengunduh struk otomatis.

## Fase 4 — Peningkatan Pengalaman Pelanggan (Rencana Berikutnya)
- **Riwayat Pesanan Lokal**: Menyimpan 5 struk pesanan terakhir di `localStorage` / IndexedDB agar pelanggan dapat mengunduh ulang bukti checkout mereka.
- **QRIS Dinamis / Panduan Transfer**: Menampilkan kartu panduan pembayaran saat memilih *Bayar Sekarang* sebelum membuka WhatsApp Admin.
- **Multi-Bahasa Ringan (ID / EN)**: Menambahkan sakelar bahasa opsional untuk pelanggan internasional.
