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

## Fase 3 — Peningkatan Operasional & Manajemen Katalog (Rencana Berikutnya)
- **Eksternal JSON Catalog Sync**: Memisahkan data katalog ke file `data/products.json` agar admin dapat memperbarui harga/stok tanpa menyentuh kode JS.
- **Riwayat Pesanan Lokal**: Menyimpan 5 struk pesanan terakhir di `localStorage` / IndexedDB agar pelanggan dapat mengunduh ulang bukti checkout mereka.
- **QRIS Dinamis / Panduan Transfer**: Menampilkan kartu panduan pembayaran saat memilih *Bayar Sekarang* sebelum membuka WhatsApp Admin.
- **Multi-Bahasa Ringan (ID / EN)**: Menambahkan sakelar bahasa opsional untuk pelanggan internasional.
