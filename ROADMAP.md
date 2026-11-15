# Roadmap & Peta Pengembangan Proyek Manifestudio

Dokumen ini adalah panduan resmi arsitektur, pencapaian implementasi, serta arah pengembangan selanjutnya bagi pengembang (**manusia, tim IT, maupun AI assistant**) pada repositori statis **Manifestudio** (`https://tmctomystudio26.github.io/InfoKatalogtMCTomyStudio/`). Lihat `BLUEPRINT.md` untuk detail kontrak API, struktur file, dan aturan koding teknis.

---

## 🚦 Status Pencapaian Fase (Milestones)

### ✅ Fase 1 — Fondasi Katalog & Arsitektur Statis (Selesai)
- [x] Struktur modular Native ES Modules tanpa bundler rumit.
- [x] Mode Gelap/Terang persisten dengan sinkronisasi `meta[name="theme-color"]`.
- [x] PWA Lengkap (`manifest.webmanifest`, `sw.js` dengan cache versioning).
- [x] Unit Test suite menggunakan standard library `node:test` (`js/store.test.mjs`).

### ✅ Fase 2 — Drawer Checkout, Bayar Nanti +10%, & Struk HTML5 Canvas (Selesai)
- [x] Drawer pemesanan interaktif dengan perhitungan diskon belanja & voucher otomatis.
- [x] Opsi `Bayar Sekarang` (0%) dan `Bayar Belakangan (+10%)`.
- [x] Generator struk JPEG `< 60 KB` berbasis HTML5 Canvas 2D (`MS-YYMMDD-HHMMSS`).

### ✅ Fase 3 — Panel Admin Brankas Terenkripsi & Sinkronisasi GitHub (Selesai)
- [x] Pemisahan basis data katalog ke `data/catalog.json`.
- [x] Perlindungan Brankas Admin **AES-256-GCM + PBKDF2-SHA256 (100.000 iterasi)**.
- [x] Edit nama produk utama, sub-varian, harga, kategori, stok, voucher, serta urutan posisi produk (naik/turun/pindah indeks).
- [x] Ganti logo lewat Upload File (kompresi WebP/PNG 256×256 + hapus otomatis file upload lama di GitHub) maupun Link URL.
- [x] Bar progres real-time & persentase publikasi ke GitHub, serta **Riwayat Perubahan (maks 12 log, auto-prune) dengan fitur Restore 1-klik**.
- [x] Kartu produk berkode warna berbeda di Admin & perbaikan wrapping tombol mobile tanpa teks offside.

### ✅ Fase 4 — Storefront Top-Up, Multi-Banner Carousel & Halaman Konfirmasi (Selesai)
- [x] Banner carousel 6-slide responsif (dapat digeser swipe/panah) untuk Katalog, Jadwal Sholat, Cuaca, Jam Dunia, Speedtest, dan Downloader.
- [x] Halaman konfirmasi dedikasi `order.html` & kode voucher sekali pakai.
- [x] Bagian *Pertanyaan Umum (FAQ)* ringkas & mutakhir tanpa kalimat berlebih dan rapi di layar mobile.

### ✅ Fase 5 — Menu Lainnya Terpisah & Pemutar Musik Full Version Bebas Iklan (Selesai)
- [x] Halaman terpisah `tools.html` dengan navigasi 5 utilitas + tombol kembali ke toko utama:
  1. **Jadwal Sholat Indonesia**: Kemenag RI (`api.myquran.com` v2 + fallback AlAdhan method=20), prioritas GPS -> fallback IP -> riwayat/cari kota.
  2. **Prakiraan Cuaca**: Open-Meteo (real-time, per jam 12 jam, 7 hari ke depan).
  3. **Jam Dunia & Bola Dunia Interaktif**: Standar UTC, konversi WIB/WITA/WIT & zona global, globe 3D canvas dapat diputar & diklik per negara target.
  4. **Speedtest Internet**: Cloudflare Speed Edge (`ping`, `jitter`, `loaded latency`, `download`, `upload`), speedometer 60fps, lokasi, server node, ISP, serta info OS/browser/perangkat.
  5. **Downloader Video Tanpa Watermark**: Mendukung tautan **TikTok (HD/SD/MP3 No Watermark), YouTube (MP4/MP3), Facebook (HD/SD), dan Instagram (Reels/Post)**.
- [x] **Pemutar Musik Pintar Bebas Iklan Full Version**:
  - Ikon musik dapat digeser bebas (*draggable*) ke posisi mana pun dan posisinya tersimpan persisten.
  - Memutar lagu **Full Version (`>= 75 detik`)** tanpa terpotong 30 detik (prioritas Viral Indonesia Gen-Z, DJ remix, cover via Audius + pilihan embed **SoundCloud Player** & **Spotify Embed Player**).
- [x] **OpenGraph WhatsApp/Sosmed Ready**: Thumbnail `1200×630` baseline JPEG `< 110 KB` dengan URL absolut HTTPS agar muncul penuh di pratinjau WhatsApp & Telegram.

---

## 🚀 Rencana Pengembangan Selanjutnya (Next Milestones)

### 🔹 Fase 6 — Riwayat Transaksi Pelanggan & QRIS Dinamis
1. **Riwayat Pesanan Lokal Pelanggan**:
   - Simpan hingga 10 riwayat pesanan terakhir dari `order.html` ke `localStorage` agar pelanggan dapat mengunduh ulang struk atau menanyakan status ke CS kapan saja.
2. **Modal QRIS & Rekening Bank Resmi**:
   - Modal QRIS statis/rekening saat memilih metode *Bayar Sekarang* dengan tombol salin nomor rekening 1-klik.

### 🔹 Fase 7 — Ekosistem Admin & Utilitas Lanjutan
1. **Manajemen Banner Carousel Dinamis di Admin**:
   - Mengizinkan admin mengedit teks/gambar slide banner langsung dari `admin.html` dan menyimpannya ke `data/catalog.json`.
2. **Riwayat Speedtest & Ekspor Laporan**:
   - Menyimpan 5 hasil pengujian Speedtest terakhir untuk perbandingan kecepatan ISP pagi/malam.
3. **Subdomain Terpisah Opsional (Future Scaling)**:
   - Jika kelak repositori dipindahkan ke domain kustom (`manifestudio.id`), arahkan route `tools.manifestudio.id` ke `tools.html` sebagai micro-app terpisah sesuai saran fase lanjut.

---

## 🛠️ SOP Pemeliharaan Harian

```bash
# 1. Jalankan dev server lokal (port 3000)
npm run dev

# 2. Jalankan seluruh unit test sebelum commit/push
node --test InfoKatalogtMCTomyStudio/js/store.test.mjs

# 3. Verifikasi kompilasi & linter
npm run build && npm run lint

# 4. Sinkronisasi aman sebelum push
git -C InfoKatalogtMCTomyStudio pull --rebase origin main
```
