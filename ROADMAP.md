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
- [x] **Pemutaran Lagu Full-Length (`>= 75 detik` / 3–5 Menit), Pencarian YT Music Lengkap (Lokal & Internasional), Background Audio Anti-Mati Lintas Browser, Mode PiP & Headset, serta Tata Letak Responsif (`v34–v38`)**:
  - **100% Lagu Berdurasi Penuh (Bebas Potongan 30 Detik)**: Memblokir dan membersihkan seluruh URL preview singkat 30 detik (`itunes.apple.com` / `mzstatic.com` / `AudioPreview`) dari resolver, pencarian, cache stream (`manifestudio_music_stream_cache_v2`), pustaka, dan sesi, serta memperluas katalog bawaan dengan **30 lagu viral Indonesia full-length terverifikasi (`156s–354s`)** + runtime guard `< 75s` pada elemen `<audio>`.
  - **Pencarian YT Music Lengkap 100% (Lokal, Internasional, Lirik & Judul Terjemahan YouTube, `v36`)**: Memperbaiki `parseDurationSeconds()` agar mengekstrak objek bersarang `duration: { seconds, timestamp }` dari API pencarian YouTube (`Siputzx /api/s/youtube`), mempertahankan seluruh hasil pencarian video YouTube yang cocok lewat lirik/deskripsi/terjemahan judul otomatis (`allowYoutubeSearchOrder: true`, hingga 26 lagu per pencarian), memperbarui 30 `videoId` YouTube asli beserta `artworkFallback` terpisah agar bebas ikon thumbnail pecah, serta memberi prioritas antrean penuh untuk kueri pencarian pengguna.
  - **Background Audio Anti-Mati Saat Pindah Tab / Keluar Browser / Layar Terkunci (`v37`)**: Memperbaiki *Silent-Hold Audio Bridge* (`startSilentHoldForBackgroundTransition`) agar elemen `<audio>` (`#music-audio-el`, diposisikan di dalam viewport 2×2px + `navigator.audioSession.type = 'playback'`) selalu terbuka (*unlocked*) sejak klik pertama dan tetap memegang sesi audio OS saat `yt-iframe` berjalan; otomatis melakukan *seamless upgrade* dari `yt-iframe` ke native `<audio>` begitu stream langsung (`Siputzx Ummy` / `vidsnap.app/proxy` / `Audius`) selesai di-resolve di latar depan; menggunakan `fetch(Range: bytes=0-128)` untuk probe stream `vidsnap.app/proxy` agar tidak menggantung di tab tersembunyi; memprioritaskan codec `m4a`/`mp4` untuk iOS Safari; mengecualikan elemen internal `#ytm-pip-video` dari pendeteksi media eksternal; serta mencegah kegagalan stream Audius memblokir resolusi YouTube `videoId` (`shouldPoisonExactYoutubeIdOnError`).
  - **Header Responsif Anti-Terpotong Lintas Resolusi Laptop & Desktop (`1025px–1440px`, `v38`)**: Memperbaiki `.header-inner`, `.header-nav` (`flex: 1 1 auto; min-width: 0; justify-content: safe center;`), `.header-actions`, serta menambahkan aturan kompak `@media (max-width: 1180px)` + `CONCISE_HEADER_NAV_LABELS` pada `js/tools-page.js` agar tombol **Keranjang**, **Tema**, **Install**, maupun 8 tautan navigasi utama tidak lagi terdorong atau terpotong di sisi kanan layar desktop/laptop.
  - **Gambar-dalam-Gambar (PiP) & Mode Headset (Audio Latar Tanpa PiP)**: Mendukung jendela PiP melayang serta tombol **🎧 Mode Headset** untuk menyembunyikan PiP tanpa menghentikan pemutaran lagu di latar belakang maupun layar terkunci.
  - **Perbaikan Tata Letak & Kontras Menu Musik Mobile + Desktop**: Menghapus pembungkus kartu ganda (`.tool-card` pada `.music-hub-stage-wrap`), menambahkan proteksi `min-width: 0; max-width: 100%; box-sizing: border-box;` pada seluruh panel/tab/form playlist/kotak kosong agar bebas *offside* di layar HP (`360px–390px`) maupun desktop (`1440px`), merapikan deretan pill kontrol menjadi grid 2×2 di mobile, serta memperbaiki kontras teks banner Mode Headset pada Tema Terang (*Light Mode*).
- [x] **Animasi Progres Loading, Drawer Kategori Ikon + Tren Live YT Music, Optimasi UI Mobile/Desktop & Audio Latar Mobile Anti-Mati (`v39`)**:
  - **Animasi Progres Loading Real-Time**: Menambahkan `.ytm-progress-banner` (`%` + label tahapan + bar animasi), `.ytm-inline-spinner`, `.ytm-skeleton-list` *shimmer*, dan `#music-mini-loader-strip` di mini player agar proses mencari lagu, pindah kategori, sinkron tren, maupun penyiapan stream audio tidak pernah terkesan *hang*.
  - **Drawer Kategori Ikon Slide-Out & Tren Live Real-Time**: Mengubah baris kategori pemakan ruang menjadi tombol ikon ringkas (`Kategori (14)`) yang membuka drawer slide ke samping lengkap dengan tombol **Minimize**, 14 kategori terkurasi YT Music bertanda `LIVE`/`HOT`, dan 8 chip **Tren Saat Ini** yang tersinkronisasi real-time (`mergeRealtimeTrendCategories`), serta menyaring video kompilasi berdurasi berjam-jam keluar dari kategori (`filterPresetCategoryTracks`).
  - **Optimasi UI Mobile & Desktop Standar YT Music**: Merampingkan `.tools-subnav` mobile menjadi pill horizontal scrollable (`~63px`), menaikkan posisi `.ytm-stage-card` ke atas lipatan layar HP, merapikan label tab `Nanti (N)` bebas terpotong `...`, dan mengangkat `.music-pip-card` di `bottom: 78px` agar tidak menumpuk di atas FAB musik.
  - **Perbaikan Prioritas Audio Latar Mobile (Keluar Browser / Pindah Tab / Layar Mati)**: Memperkuat *Silent-Hold Audio Bridge* dengan PCM micro-dither (`127–129`), multi-query `buildAudiusLookupQueries` yang memprioritaskan stream full-length `api.audius.co` terverifikasi `/stream` probe (bebas cache 403 & cooldown `api.vidsnap.app` sekali gagal), *serialized prewarm* anti-429, serta `pickBackgroundSafeNextTrack` agar perpindahan lagu otomatis saat tab/layar tersembunyi selalu memilih trek native `<audio>`.
- [x] **Perbaikan Anti-Mati Pemutaran Latar Browser Laptop/Desktop (Pindah Tab / Minimize / Pindah Aplikasi, `v40`)**: Memisahkan deteksi platform desktop vs mobile (`isMobileTouchPlatform` + status `ytPlayer.getPlayerState()`), memastikan *Silent-Hold Failure Guard* & watchdog 20 detik tidak pernah memanggil `pauseVideo()` maupun mengganti lagu aktif (`bg-fallback`) pada browser laptop/desktop saat tab disembunyikan, jendela diminimalkan, atau berpindah aplikasi.
- [x] **Navigasi Menu Utilitas Mobile Tanpa Geser Horizontal (`v41`)**: Mengubah `.tools-subnav` pada layar HP (`<= 640px`) dari daftar *scroll* menyamping menjadi kisi ikon ringkas 2 baris simetris (4 kolom atas + 3 kolom bawah rata tengah) sehingga seluruh 7 menu (*Jadwal Sholat, Prakiraan Cuaca, Jam Dunia & Globe, Speedtest, Downloader, Kompresor HD, Musik YT*) langsung terlihat utuh tanpa mengaburkan menu di balik guliran horizontal.
- [x] **Kompresor Media Open-Source Nyata & Menu Konversi Semua File Multi-Format (`v42–v44`)**:
  - **Kompresor Media Open-Source Nyata (`js/compressor.js`, `js/media-engine.js`, & `js/tools-logic.js`)**: Menggantikan kompresi formalitas dengan algoritma kuantisasi iteratif *binary-search* terbuka (*Squoosh / Browser-Image-Compression*), kuantisasi palet RGBA 8-bit (*UPNG-style*), kompresi video H.264/AAC nyata via **FFmpeg WebAssembly (`@ffmpeg/core@0.12.6` + `MediaRecorder` fallback)**, integrasi endpoint cloud open-source **Weserv/Images Libvips API (`wsrv.nl`)**, serta verifikasi keterbacaan & pemutaran media output (`verifyPlayableMediaBlob`).
  - **Menu "Konversi File" Universal (`tools.html?tab=converter`, `js/converter.js`, & `js/media-engine.js`) — 85+ Konversi Lintas 30 Format Target (`v43–v44`)**:
    - Mendukung konversi nyata terverifikasi antar **Dokumen (`DOCX/DOC/ODT/RTF/MD/TXT/HTML` → `PDF/DOCX/RTF/MD/TXT/HTML/XLSX/CSV/JSON/XML/ZIP`)**, **Spreadsheet & Data (`XLSX/CSV/TSV/JSON/XML/YAML` → `PDF/XLSX/CSV/TSV/JSON/XML/YAML/HTML/MD/DOCX/TXT/ZIP`)**, **PDF (`PDF` → `JPG/JPEG/PNG/WEBP/BMP/GIF/DOCX/XLSX/TXT/HTML/MD/RTF/ZIP`)** menggunakan **Open-Source PDF.js (`pdfjs-dist`)**, **Gambar (`JPG/JPEG/PNG/WEBP/BMP/GIF/ICO/SVG`)**, **Video & Audio (`MP4/MOV/WEBM/MKV/MP3/WAV/M4A/AAC/OGG/FLAC`)** menggunakan **WebAudio `decodeAudioData` + Vendored Pure-JS LAME MP3 Encoder (`lamejs`)**, **FFmpeg WebAssembly (`@ffmpeg/ffmpeg`)**, dan **HTML5 `<video>` Frame Capture**, serta **Arsip (`ZIP`)**.
    - **UX Bersih Tanpa Tombol Ujicoba & Upload di Paling Atas (`v43`) + Cache WASM Persisten & Verifikasi Putar Nyata (`v44`)**: Menghapus seluruh tombol uji/sampel pada Kompresor HD maupun Konversi File, menempatkan kolom unggah (*dropzone*) di paling atas, menambahkan **Deteksi Format Otomatis** + **Dropdown Daftar Format Tujuan Terkelompok (`#conv-target-select`)**, **Bar Progres Persentase (`0%–100%`)**, caching permanen `manifestudio-ffmpeg-core-v1`, serta validasi pemutaran audio/video nyata sebelum hasil diserahkan ke pengguna.
- [x] **Menu Pencarian Judul Lagu, Musik & Analisis Kemiripan Video Sosmed Multi-API + AI Publik (`tools.html?tab=songfinder` & `js/song-finder.js`, `v45`)**:
  - **Deteksi Otomatis Audio vs Video**: Membaca *magic bytes* (`ID3`, `fLaC`, `OggS`, `RIFF WAVE/AVI`, `ftyp M4A vs MP4/MOV`, `EBML WebM/MKV`), MIME, dan ekstensi untuk langsung menentukan mode **Audio** atau **Video**.
  - **7 Metode & Multi-API Paralel Anti-Single-Point-of-Failure**: Menggabungkan ekstraksi tag biner (`ID3v2`, `ID3v1`, atom MP4 `©nam`/`©ART`/`©alb`, Vorbis), pembersih token nama file sosmed, **Acoustic Chromagram 12-pitch-class + Onset Autocorrelation BPM** (via WebAudio + fallback demux FFmpeg WASM), **Apple Music / iTunes Search API**, **Siputzx YouTube Music & Video API**, **Audius Open Music API**, **MusicBrainz Recording API**, **Public Free AI Disambiguator (`text.pollinations.ai`)**, serta **Database Sidik Jari Lagu Viral** untuk mengidentifikasi judul lagu, penyanyi, album, genre, tahun rilis, dan skor kemiripan (`~95%–99.8%`).
  - **Tautan Sumber Musik & Analisis Kemiripan Video Lintas Sosmed**: Menampilkan link sumber musik relevan 100% (**YouTube, Spotify, YouTube Music, Apple Music, TikTok Sound, SoundCloud/Audius**) + tombol putar langsung di **Pemutar YT Music Web**, serta khusus saat pengguna mengunggah **Video** mengekstrak **3 keyframe visual + Perceptual dHash + deteksi rasio 9:16/16:9** dan menampilkan daftar sumber video yang mirip dari **YouTube, TikTok, Instagram Reels, & Facebook Watch**.

### ✅ Fase 10 — Kompresor AI Hybrid, Drama China Hub (20+ Platform & Sansekai VIP-Free) & Audio Editor Studio DAW (`v49–v59`, Selesai)
- [x] **Kompresor Media AI Hybrid (`v49`)**: Pembaruan kompresor foto & video HD dengan dukungan Multi-AI Publik tanpa key, AVIF/WebP 2-pass, Unsharp Clarity, dan FFmpeg WASM.
- [x] **Drama China (Dracin) Gratis Tanpa Iklan (`tools.html?tab=dracin`, `v50–v57`)**:
  - Agregasi real-time 20+ platform (*SekaiDrama/Sansekai, DramaBox, ReelShort, ShortMax, NetShort, Melolo, PineDrama, MyDrama*, dll.) dengan dropdown pencarian platform & dropdown *Lanjutkan Menonton*.
  - Pemutar vertikal responsif dengan mode **Layar Bersih** (fullscreen bebas ikon HUD), mempertahankan fullscreen saat scroll/pindah episode, preloading episode berikutnya tanpa menunggu buffering, subtitle Indonesia otomatis, dekripsi segmen CENC, pencocokan drama lintas-platform & klip AI, serta failover server VIP-free (`SekaiDrama / Sansekai`).
- [x] **Audio Editor Studio AI DAW (`tools.html?tab=audioeditor`, `v58–v59`)**:
  - Editor audio client-side lengkap dengan pemotong presisi (*Keep* & *Potong Tengah*), *10-Band Parametric EQ*, *Bass Boost & Stereo Virtualizer*, *Voice Changer*, penjernih noise & perbaikan audio, pemisah vokal/karaoke, *Multi-Track Mixer*, editor metadata ID3v2/RIFF + iTunes/MusicBrainz, Undo/Redo stack, asisten mastering Multi-AI, dan ekspor MP3/WAV/AAC/M4A/OGG/FLAC/OPUS dengan estimasi ukuran & preset kualitas.

### ✅ Fase 11 — Manifest AI: Multi-Model Chat AI Gratis, Auto-Update Model Real-Time & Multi-BYOK (`tools.html?tab=manifestai`, `v60`, Selesai)
- [x] **Multi-Model AI Ensemble Gratis Tanpa API Key (`js/manifest-ai-logic.js`, `js/manifest-ai.js`, `js/manifest-ai-ui.js`)**:
  - Menggabungkan banyak model AI terkemuka (**Google Gemini, OpenAI ChatGPT, DeepSeek, Anthropic Claude, xAI Grok, Meta Llama, Qwen, & Mistral**) bekerja sama secara paralel dan mensintesis hasil terbaik menjadi satu jawaban koheren, lengkap dengan rincian kontributor model yang dapat dibuka (*collapsible*).
- [x] **Auto-Update & Auto-Upgrade Model Terbaru Real-Time**:
  - Otomatis menyinkronkan versi model flagship terbaru tiap penyedia dari registri CORS live (**OpenRouter Live Models**, **Models.dev**, **Pollinations**, & **LLM7**) agar selalu mengikuti rilis terbaru di platform aslinya tanpa perlu edit kode manual.
- [x] **Limit & Reset Per Pengguna + Failover Otomatis Tanpa Hilang Memori**:
  - Pelacakan cooldown rate-limit per perangkat di `localStorage` (`manifestudio_ai_limits_v1`) + dukungan kuota gratis terpisah per pengguna via **Puter.js SDK**.
  - Ketika satu model/gateway mencapai limit atau bermasalah, permintaan dialihkan mulus ke jalur cadangan sambil membawa **ringkasan memori percakapan + sliding window riwayat penuh** agar jawaban tetap nyambung dan anti-halusinasi.
- [x] **Multi-Provider BYOK (API Key Pribadi Paralel)**:
  - Pengguna dapat menambahkan **1 atau banyak API Key pribadi sekaligus** dari berbagai penyedia (Gemini, OpenAI, DeepSeek, Claude, Grok, Groq, OpenRouter, Mistral, Qwen/DashScope, Custom OpenAI-Compatible), memilih model manual atau *Otomatis Model Terbaru*, menguji koneksi langsung, serta menggabungkan banyak kunci pribadi secara paralel (dengan opsi memadukannya bersama jalur AI gratis). Semua kunci tersimpan 100% lokal di browser pengguna.
- [x] **Manajemen Riwayat Chat Lengkap & UI Dual-Theme Responsif**:
  - Mendukung multi-thread chat (*Chat Baru*, pencarian riwayat, ubah judul, hapus satuan/semua, ekspor Markdown `.md`), rendering Markdown + blok kode siap salin, serta antarmuka desktop 2-panel & mobile slide-over drawer yang rapi di Dark Mode dan Light Mode.
- [x] **Streaming Instan Real-Time & Orkestrasi Hening (`v61`)**:
  - Migrasi penuh ke **SSE Token Streaming real-time** (*Fastest-First Parallel Racing*) di seluruh jalur (HF Gradio SSE Spaces bebas API key, LLM7 maks 1/giliran anti-429, Puter SDK, dan semua provider BYOK) agar teks mulai mengalir instan tanpa menunggu model lain selesai.
  - Menghapus seluruh teks orkestrasi/status teknis mentah (`"Menggabungkan..."`, rincian kontributor, error HTTP mentah) dari tampilan chat dan menggantinya dengan gelembung animasi titik halus + kursor ketik real-time ala ChatGPT/Gemini, serta sinkronisasi cache-busting penuh `manifestudio-cache-v61` (`?v=61`).
- [x] **Grounding Identitas Manifestudio, Deteksi Pindah Topik, & Hemat Kuota 3× (`v62`)**:
  - **Kenal Tuan & Katalog Live**: Menyuntikkan profil resmi **Manifestudio by Tomy** + data langsung dari `data/catalog.json` (19 produk akun premium & 12 fitur Menu Utilitas) dengan larangan keras mengarang layanan fiktif, ditambah fallback terverifikasi lokal untuk pertanyaan seputar Manifestudio & sapaan singkat (`"P"`, `"Halo"`).
  - **Deteksi Pindah Topik & Sanitasi Riwayat**: Mendeteksi otomatis perpindahan topik (`detectTopicShift`) dan membersihkan giliran gagal bertumpuk (`sanitizeConversationHistory`) agar model tidak lagi terjebak mengulang topik lama saat pengguna beralih topik, namun tetap nyambung penuh saat melanjutkan atau kembali ke topik sebelumnya.
  - **Smart Staggered Hedging & Rotasi Bucket Kuota (Hemat 3×–4×)**: Menjalankan hanya **1 jalur gratis** terlebih dahulu (alih-alih memboroskan 3 permintaan serentak tiap chat), merotasi bucket `LLM7` ↔ `HF ZeroGPU`, memilih model chat hemat token (`max_tokens: 768`), serta menandai cooldown bucket ZeroGPU terpadu agar tidak membuang kuota IP secara sia-sia (`manifestudio-cache-v62`).
- [x] **4 Jaringan AI Gratis Independen Anti-Limit 4G CGNAT (`v63`)**:
  - Menambahkan jalur **Pollinations Classic** (reset cepat 45 detik + auto-wait) dan **OVHcloud AI Endpoints** (pool 14+ model flagship dengan cooldown independen per model) melengkapi LLM7 & HF Spaces agar pengguna HP 4G/CGNAT tidak lagi terkena limit baru 1 chat.
- [x] **Layar Penuh, Mode Suara Neural Multibahasa & Code-Switching, serta Privasi Kontak Owner Ketat (`v64`)**:
  - **Mode Layar Penuh (Fullscreen)**: Tombol `Layar Penuh` / `Keluar Full` di header Manifest AI untuk desktop & mobile (`Escape` untuk keluar, modal pengaturan suara/model/API tetap tampil di atas layar penuh).
  - **Mode Suara Natural 27 Suara Pria & Wanita + Code-Switching Otomatis (`js/manifest-ai-voice.js`)**: Membacakan jawaban AI dengan suara manusia neural alami lintas bahasa (Indonesia, Inggris US/UK, Melayu, Jepang, Korea, Mandarin, Arab, Prancis, Spanyol, Jerman) dengan **deteksi campuran bahasa otomatis** (*code-switching*) sehingga kata Indonesia dibaca dengan pelafalan Indonesia asli dan frasa Inggris/asing langsung beralih ke pelafalan asli sambil menjaga gender suara tetap konsisten, lengkap dengan pengaturan kecepatan, gaya intonasi, baca otomatis, & failover 3 lapis (Edge Neural TTS → TikTok Neural TTS → Web Speech).
  - **Privasi Kontak Owner Ketat (`redactSensitiveOwnerData`)**: Mencegah Manifest AI membocorkan nomor WhatsApp, telepon, sosmed, atau email pribadi owner secara mentah baik saat streaming maupun hasil akhir; seluruh info sensitif otomatis disensor (`62xxxxxxxxxx` / `@t***********o`) dan pengguna diarahkan ke **footer website** (`manifestudio-cache-v64`).
- [x] **Suara AI Natural 1-Speaker Konsisten, 29 Model Unik & Retry Otomatis (`v65`)**:
  - **100% Model Unik & Azure V2 Multilingual**: Menghapus duplikat *pitch-shift*, memperluas katalog ke **29 suara neural unik Pria & Wanita** (Azure V2 `Ava`, `Andrew`, `Emma`, `Brian`, `William`, `Thalita`, `Giuseppe` + `Gadis`, `Ardi`, `Aria`, `Jenny`, `Michelle`, `Guy`, `Christopher`, `Sonia`, `Ryan`, `Natasha`, dll.) dengan `defaultPitch: 0` bebas suara robotik kaku.
  - **1 Suara Konsisten Lintas Bahasa (Tanpa Ganti Orang)**: Menjaga kalimat campuran Indonesia + Inggris tetap dibacakan utuh oleh 1 suara yang dipilih user (tidak lagi menimpa pilihan ke Gadis/Ardi atau mengganti pembicara di tengah kalimat), ditambah normalisasi bahasa lisan Indonesia (Rp, %, singkatan) serta 3× auto-retry + opsional `gpt-4o-mini-tts` Puter (`manifestudio-cache-v65`).

---

## 🚀 Rencana Pengembangan Selanjutnya (Next Milestones)

### 🔹 Fase 12 — Riwayat Transaksi Pelanggan & Pembayaran QRIS Dinamis
1. **Riwayat Pesanan Lokal Pelanggan**:
   - Simpan hingga 10 riwayat pesanan terakhir dari `order.html` ke `localStorage` agar pelanggan dapat mengunduh ulang struk atau menanyakan status ke CS kapan saja.
2. **Modal QRIS & Rekening Bank Resmi (Dapat Diedit dari Admin)**:
   - Tampilan QRIS statis/rekening saat memilih metode *Bayar Sekarang* dengan tombol salin nomor rekening 1-klik dan pengelolaan gambar QRIS di Admin.

### 🔹 Fase 13 — Peningkatan Manifest AI Multimodal & Analitik Utilitas Lokal
1. **Dukungan Lampiran Dokumen & Gambar pada Manifest AI**:
   - Membaca file teks/kode/PDF/gambar secara lokal untuk dianalisis langsung oleh Multi-Model Ensemble maupun BYOK Vision models.
2. **Riwayat Speedtest & Subdomain Utilitas Opsional**:
   - Menyimpan 5 hasil pengujian Speedtest terakhir serta opsi routing subdomain **`tools.manifestudio.my.id`** via Cloudflare Redirect Rules.

---

## 🛠️ SOP Pemeliharaan & Dokumentasi Wajib

> **Komitmen Wajib Pengembangan:** Setiap pembaruan fitur **harus** disertai pembaruan `ROADMAP.md`, `README.md`, dan `BLUEPRINT.md`, lolos seluruh unit test + browser check, dan langsung di-push ke `origin/main` GitHub Pages.

```bash
# 1. Jalankan dev server lokal (port 3000)
npm run dev

# 2. Jalankan seluruh unit test logika bisnis, voucher, downloader, kompresor, dracin, audio-editor & manifest-ai
npx --yes tsx --test .repos/InfoKatalogtMCTomyStudio/js/store.test.mjs

# 3. Verifikasi kompilasi & linter
npm run build && npm run lint

# 4. Sinkronisasi aman sebelum push
git -C .repos/InfoKatalogtMCTomyStudio pull --rebase origin main
```

