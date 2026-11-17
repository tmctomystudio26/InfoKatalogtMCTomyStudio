# Roadmap & Peta Pengembangan Proyek Manifestudio

Dokumen ini adalah panduan resmi tujuan proyek, arsitektur, pencapaian implementasi, serta arah pengembangan selanjutnya bagi pengembang (**manusia, tim IT, maupun AI assistant**) pada repositori statis **Manifestudio** (`https://manifestudio.my.id/`). Lihat `BLUEPRINT.md` untuk detail kontrak API, struktur file, dan aturan koding teknis.

---

## 🎯 Tujuan Proyek (Project Goals)

1. **Storefront Digital Zero-Backend Cepat & Kredibel**: Menyajikan katalog layanan digital *Premium Account by Tomy* secara ringan (100% Static HTML/CSS + Native ES Modules di GitHub Pages + Custom Domain Cloudflare HTTPS), siap pakai tanpa server database eksternal.
2. **Checkout Transparan & Terotomasi**: Menghitung total biaya (diskon otomatis, voucher tervalidasi dengan batas pakai terukur, biaya layanan fleksibel, serta skema Bayar Sekarang 0% vs Bayar Belakangan), lengkap dengan generator struk JPEG Canvas 2D dan pesan order WhatsApp terstruktur.
3. **Kemandirian Penuh Admin Tanpa Edit Kode**: Memberikan kendali total kepada pemilik toko via Panel Admin terenkripsi AES-256-GCM (produk, sub-varian, kategori dinamis, banner carousel, meta OpenGraph, logo brand & sosmed, biaya layanan, voucher berbatas, FAQ, serta riwayat perubahan terperinci + restore).
4. **Hub Utilitas Harian Gratis & Berkualitas Tinggi (`tools.html`)**: Menghadirkan utilitas penting harian bebas iklan (Jadwal Sholat Kemenag RI presisi GPS, Cuaca akurat pendeteksi hujan lebat, Jam Dunia & Globe 3D, Speedtest Cloudflare CDN, Downloader Sosmed Video MP4 + Audio MP3 + Foto + Carousel + Story + Caption berbar progres, dan Kompresor Media HD anti-pecah sosmed).

---

## 🚦 Status Pencapaian Fase (Milestones)

### ✅ Fase 1 — Fondasi Katalog & Arsitektur Statis (Selesai)
- [x] Struktur modular Native ES Modules tanpa bundler rumit.
- [x] Mode Gelap/Terang persisten dengan sinkronisasi `meta[name="theme-color"]`.
- [x] PWA Lengkap (`manifest.webmanifest`, `sw.js` dengan cache versioning network-first).
- [x] Unit Test suite menggunakan `node:test` (`js/store.test.mjs`).

### ✅ Fase 2 — Drawer Checkout, Bayar Nanti, & Struk HTML5 Canvas (Selesai)
- [x] Drawer pemesanan interaktif dengan perhitungan diskon belanja & voucher otomatis.
- [x] Opsi `Bayar Sekarang` (0%) dan `Bayar Belakangan (+10% default, dapat diubah di Admin)`.
- [x] Generator struk JPEG `< 60 KB` berbasis HTML5 Canvas 2D (`MS-YYMMDD-HHMMSS`).

### ✅ Fase 3 — Panel Admin Brankas Terenkripsi & Sinkronisasi GitHub (Selesai)
- [x] Pemisahan basis data katalog ke `data/catalog.json` & riwayat ke `data/catalog-history.json`.
- [x] Perlindungan Brankas Admin **AES-256-GCM + PBKDF2-SHA256 (100.000 iterasi)**.
- [x] Edit nama produk utama, sub-varian, harga, kategori, stok, urutan posisi produk (naik/turun/pindah indeks).
- [x] Upload & ganti logo (kompresi WebP/PNG 256×256 + auto-hapus file upload lama di GitHub) maupun Link URL.
- [x] **Log Riwayat Perubahan Terperinci (Itemized Actions, maks 12 log + Restore 1-klik)**: mencatat aksi spesifik (*menambah/menghapus sub-produk, ubah harga lama -> baru, ganti logo, ubah kategori, banner, OpenGraph, biaya layanan, & batas voucher*).

### ✅ Fase 4 — Storefront Top-Up, Multi-Banner Carousel & Halaman Konfirmasi (Selesai)
- [x] Banner carousel 6+ slide responsif (swipe/panah) untuk Katalog & Hub Utilitas.
- [x] Halaman konfirmasi dedikasi `order.html`.
- [x] Bagian *Pertanyaan Umum (FAQ)* ringkas & mutakhir.

### ✅ Fase 5 — Menu Utilitas Terpisah & Pemutar Musik Full Version Bebas Iklan (Selesai)
- [x] Halaman terpisah `tools.html` + pemutar musik melayang bebas iklan (`Full Audio >= 75 detik` via Audius, `SoundCloud Widget`, `Spotify Embed`) dengan posisi *draggable* persisten.
- [x] **OpenGraph WhatsApp/Sosmed Ready**: Thumbnail `1200×630` baseline JPEG `< 110 KB` URL absolut HTTPS `https://manifestudio.my.id/`.
- [x] **Custom Domain & HTTPS Aktif**: Domain `manifestudio.my.id` melalui Cloudflare DNS ke GitHub Pages (`CNAME`), serta bersih sepenuhnya dari keterikatan Replit.

### ✅ Fase 6 — Kendali Penuh Admin, Cuaca Presisi Tinggi & Kompresor Media HD (Selesai)
- [x] **Kustomisasi Total dari Panel Admin (`admin.html`)**:
  - Ubah **Logo Brand**, **Nama Toko**, **Tagline Header** (*"by Tomy"*), & **Teks Footer** (*"Dikelola oleh Manifestudio by Tomy © 2026"*).
  - Edit besaran **Biaya Layanan** (`% Bayar Nanti` maupun `Biaya Admin Flat (Rp)` + labelnya).
  - Kelola **Kategori Layanan Dinamis** (tambah/edit/hapus kategori di luar kategori bawaan).
  - Kelola **Kontak / Sosial Media** lengkap dengan preset/upload logo sosmed custom & manajemen **FAQ** langsung dari Admin.
  - **OpenGraph Manager & Live Card Preview**: Ubah gambar OpenGraph, judul, tagline, caption/deskripsi, site name + sinkron otomatis meta tag `index.html` saat publikasi ke GitHub.
  - **Banner Carousel Manager**: Tambah, edit teks/CTA/link/scrim, upload gambar, atur urutan slide banner, dan hapus slide langsung dari Admin.
- [x] **Prakiraan Cuaca Presisi Tinggi**: Penilaian kondisi multi-faktor (curah hujan konvektif, jam puncak, angin kencang, & data stasiun lokal terdekat) untuk mendeteksi **Hujan Lebat / Sangat Lebat / Badai** secara akurat + tombol kalibrasi kondisi lokal pengguna.
- [x] **Kompresor Foto & Video HD Anti-Pecah Sosmed (`tools.html?tab=compressor`)**:
  - 4 metode optimasi (*Zero-Loss Metadata Stripper*, *Social Shield Guard*, *Lossless Palette/Huffman*, *High-Bitrate Stream*) dengan preset **TikTok HD**, **Instagram HD/Reels**, **WhatsApp HD**, dan **Original 1:1** agar platform tidak menurunkan ketajaman saat unggah.

### ✅ Fase 7 — Validasi Voucher Ketat & Peningkatan Reliabilitas Downloader + Progress Bar (Selesai)
- [x] **Validasi Voucher Ketat & Pengaturan Batas Penggunaan di Admin**:
  - Kode voucher tidak terdaftar ditolak dengan status `invalid` (`"Kode voucher ... tidak valid atau tidak terdaftar."`) — menghapus pesan `"dicatat & Cek Admin"`.
  - Admin dapat mengatur kuota pemakaian tiap voucher: **1 Kali Pakai (`once`)**, **Maksimal N Kali (`limited`)**, atau **Tak Terbatas (`unlimited`)** lengkap dengan pelacakan penggunaan per pelanggan.
- [x] **Perbaikan Downloader Sosmed + Kelengkapan Dual MP4 & Audio (MP3/M4A/WAV) (v22)**:
  - Deteksi dini tautan YouTube terpotong (`parseYouTubeVideoId`), normalisasi penuh payload **Tioo `/ttdl` (`video[]` & `audio[]`)**, **failover paralel 4 node Tioo (`backend1..4.tioo.eu.org`)**, **Wave 2 audio retry** khusus YouTube, dekode URI ganda pada parameter MIME URL proxy (`audio/mp4` -> `.m4a`), serta fallback otomatis ekstraksi trek audio `.wav` client-side (`AudioContext`) bila stream audio terpisah gagal/diblokir sehingga **Video MP4 & Audio Musik tetap muncul lengkap bersamaan** + dukungan Foto HD, Carousel Multi-Slide, Story IG/TikTok/FB, dan Salin Caption 1-klik.
- [x] **Bar Progres Konversi & Download Real-Time di Downloader**:
  - Menampilkan **Progres Pengambilan/Konversi** (`#dl-conv-progress-card`: menganalisis -> mengambil -> mengonversi -> siap) serta **Progres Streaming Download** (`#dl-save-progress-card`: MB terunduh / total MB & persentase `%` baik single file maupun batch multi-foto).

### ✅ Fase 8 — Menu Utilitas Terpisah & Perbaikan Downloader IG/YT CORS (v23, Selesai)
- [x] **Pemisahan & Penonjolan "Menu Utilitas" + Ikon Khusus (`menu-utilitas.svg`)**:
  - Memisahkan tombol/kartu **Menu Utilitas** keluar dari deretan pill kategori (`#category-tabs`) menjadi kartu aksen terpisah (`#utilities-callout-card`) di beranda, serta mengganti seluruh istilah *Menu Lainnya* menjadi *Menu Utilitas*.
  - Menghapus subjudul statis *"Pilih aplikasi untuk melihat paket & garansi."* dan *"Info aktivasi, garansi, pembayaran, dan menu utilitas."* agar antarmuka katalog & FAQ lebih ringkas.
- [x] **Perbaikan Total Instagram Downloader & YouTube Dual MP4 + Audio (`v23`)**:
  - **Instagram**: Mengganti endpoint mati (`api.ryzendesu.vip`) dengan paralel **`api.siputzx.my.id/api/d/sssinstagram`** + **`api.siputzx.my.id/api/d/ummy`** (+ fallback `fastdl` / `igram` / `davidcyriltech`), mendukung Reels MP4 HD, postingan foto tunggal, carousel multi-foto (termasuk URI proxy terenkode), Story, serta salin caption penuh.
  - **YouTube Dual MP4 + Audio M4A/MP3**: Mengintegrasikan `api.siputzx.my.id/api/d/ummy` secara paralel, membungkus stream `googlevideo.com` dengan **`api.vidsnap.app/proxy?u=...`** agar bebas blokir CORS, serta memblokir tautan jebakan redirect HTML `sf-converter.com` / `du.sf-converter.com`.

### ✅ Fase 9 — Integrasi YT Music Viral Indonesia, Background Audio Non-Stop & Pemulihan Penuh Panel Admin (v24–v25, Selesai)
- [x] **Hub YT Music & Floating Dock Minimalis Modern (`tools.html?tab=music` & `js/music.js`)**:
  - Sumber musik hibrida dari **Open-Source Community YT Music API** (`Piped music_songs` + `Siputzx YT Search`) dipadukan dengan **Direct Native Audio Stream (Audius CDN CORS `*`)** dan **YouTube IFrame Audio Engine**.
  - **Pemutaran Background Non-Stop (Layar Mati / Pindah Tab / Keluar Browser)**: Menggunakan mesin utama HTML5 `<audio>` untuk seluruh lagu yang memiliki aliran audio langsung, dilengkapi *visibilitychange auto-handoff*, *Web Audio Keep-Alive*, dan integrasi penuh **MediaSession API** (kontrol *Lock Screen* & notifikasi Android/iOS) sehingga musik **tidak ikut mati** ketika layar dimatikan, berpindah tab, atau browser diminimalkan.
  - **Persistensi Sesi Musik Lintas Halaman & Toggle Auto-Klik**: Menyimpan status `explicitPaused`, `wasPlaying`, `lastTrackId`, dan posisi detik di `manifestudio_music_session_v1` agar saat pengguna menjeda lagu lalu pindah ke `tools.html` / `order.html`, musik tetap tenang; atau jika sedang memutar lagu lalu pindah halaman, otomatis lanjut memutar. Dilengkapi tombol **Auto-Klik ON/OFF** pada dock & Hub Musik.
- [x] **Pemulihan Penuh 8 Tab Panel Admin (`admin.html` & `js/admin.js`)**:
  - Memulihkan seluruh fitur CMS Admin yang sempat tertimpa: *Kelola Produk*, *Tambah Produk*, *Kategori Kustom*, *Slide Banner*, *Brand & OpenGraph*, *FAQ*, *Kode Voucher (Kuota 1x/Limit/Unlimited)*, serta *Riwayat & Rollback Katalog (12 Log)*.
- [x] **Deduplikasi `<title>`, Sinkronisasi JSON-LD Schema.org, & Circuit-Breaker API**:
  - `applyOpenGraphToHtml` kini mencegah pengulangan tagline ganda pada `<title>` dan otomatis menyinkronkan `image` serta `description` pada blok JSON-LD `index.html`.
  - Menambahkan *per-node circuit-breaker* (cooldown otomatis untuk mirror API yang sedang *rate-limit* / *timeout*) pada `js/downloader.js` dan `js/music.js`.
- [x] **Pemutaran Lagu Full-Length (`>= 75 detik` / 3–5 Menit), Pencarian YT Music Lengkap (Lokal & Internasional), Background Audio Anti-Mati Lintas Browser, Mode PiP & Headset, serta Tata Letak Responsif (`v34–v37`)**:
  - **100% Lagu Berdurasi Penuh (Bebas Potongan 30 Detik)**: Memblokir dan membersihkan seluruh URL preview singkat 30 detik (`itunes.apple.com` / `mzstatic.com` / `AudioPreview`) dari resolver, pencarian, cache stream (`manifestudio_music_stream_cache_v2`), pustaka, dan sesi, serta memperluas katalog bawaan dengan **30 lagu viral Indonesia full-length terverifikasi (`156s–354s`)** + runtime guard `< 75s` pada elemen `<audio>`.
  - **Pencarian YT Music Lengkap 100% (Lokal, Internasional, Lirik & Judul Terjemahan YouTube, `v36`)**: Memperbaiki `parseDurationSeconds()` agar mengekstrak objek bersarang `duration: { seconds, timestamp }` dari API pencarian YouTube (`Siputzx /api/s/youtube`), mempertahankan seluruh hasil pencarian video YouTube yang cocok lewat lirik/deskripsi/terjemahan judul otomatis (`allowYoutubeSearchOrder: true`, hingga 26 lagu per pencarian), memperbarui 30 `videoId` YouTube asli beserta `artworkFallback` terpisah agar bebas ikon thumbnail pecah, serta memberi prioritas antrean penuh untuk kueri pencarian pengguna.
  - **Background Audio Anti-Mati Saat Pindah Tab / Keluar Browser / Layar Terkunci (`v37`)**: Memperbaiki *Silent-Hold Audio Bridge* (`startSilentHoldForBackgroundTransition`) agar elemen `<audio>` (`#music-audio-el`, diposisikan di dalam viewport 2×2px + `navigator.audioSession.type = 'playback'`) selalu terbuka (*unlocked*) sejak klik pertama dan tetap memegang sesi audio OS saat `yt-iframe` berjalan; otomatis melakukan *seamless upgrade* dari `yt-iframe` ke native `<audio>` begitu stream langsung (`Siputzx Ummy` / `vidsnap.app/proxy` / `Audius`) selesai di-resolve di latar depan; menggunakan `fetch(Range: bytes=0-128)` untuk probe stream `vidsnap.app/proxy` agar tidak menggantung di tab tersembunyi; memprioritaskan codec `m4a`/`mp4` untuk iOS Safari; mengecualikan elemen internal `#ytm-pip-video` dari pendeteksi media eksternal; serta mencegah kegagalan stream Audius memblokir resolusi YouTube `videoId` (`shouldPoisonExactYoutubeIdOnError`).
  - **Gambar-dalam-Gambar (PiP) & Mode Headset (Audio Latar Tanpa PiP)**: Mendukung jendela PiP melayang serta tombol **🎧 Mode Headset** untuk menyembunyikan PiP tanpa menghentikan pemutaran lagu di latar belakang maupun layar terkunci.
  - **Perbaikan Tata Letak & Kontras Menu Musik Mobile + Desktop**: Menghapus pembungkus kartu ganda (`.tool-card` pada `.music-hub-stage-wrap`), menambahkan proteksi `min-width: 0; max-width: 100%; box-sizing: border-box;` pada seluruh panel/tab/form playlist/kotak kosong agar bebas *offside* di layar HP (`360px–390px`) maupun desktop (`1440px`), merapikan deretan pill kontrol menjadi grid 2×2 di mobile, serta memperbaiki kontras teks banner Mode Headset pada Tema Terang (*Light Mode*).

---

## 🚀 Rencana Pengembangan Selanjutnya (Next Milestones)

### 🔹 Fase 10 — Riwayat Transaksi Pelanggan & Pembayaran QRIS Dinamis
1. **Riwayat Pesanan Lokal Pelanggan**:
   - Simpan hingga 10 riwayat pesanan terakhir dari `order.html` ke `localStorage` agar pelanggan dapat mengunduh ulang struk atau menanyakan status ke CS kapan saja.
2. **Modal QRIS & Rekening Bank Resmi (Dapat Diedit dari Admin)**:
   - Tampilan QRIS statis/rekening saat memilih metode *Bayar Sekarang* dengan tombol salin nomor rekening 1-klik dan pengelolaan gambar QRIS di Admin.

### 🔹 Fase 11 — Analitik Lokal & Ekosistem Utilitas Lanjutan
1. **Riwayat Speedtest & Perbandingan ISP**:
   - Menyimpan 5 hasil pengujian Speedtest terakhir untuk membandingkan kestabilan jaringan pelanggan.
2. **Subdomain Terpisah Opsional**:
   - Dukungan pemisahan `tools.html` ke subdomain **`tools.manifestudio.my.id`** melalui Cloudflare Redirect Rules.

---

## 🛠️ SOP Pemeliharaan & Dokumentasi Wajib

> **Komitmen Wajib Pengembangan:** Setiap pembaruan fitur **harus** disertai pembaruan `ROADMAP.md`, `README.md`, dan `BLUEPRINT.md`, lolos seluruh unit test + browser check, dan langsung di-push ke `origin/main` GitHub Pages.

```bash
# 1. Jalankan dev server lokal (port 3000)
npm run dev

# 2. Jalankan seluruh unit test logika bisnis, voucher, downloader & kompresor
npx --yes tsx --test InfoKatalogtMCTomyStudio/js/store.test.mjs

# 3. Verifikasi kompilasi & linter
npm run build && npm run lint

# 4. Sinkronisasi aman sebelum push
git -C InfoKatalogtMCTomyStudio pull --rebase origin main
```
