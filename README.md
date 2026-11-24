# Manifestudio — Storefront Katalog Digital, Utility Hub (15 Fitur) & Panel Admin Statis

Platform web statis resmi **Manifestudio** (*by Tomy*) berbasis **100% Static HTML/CSS + Native ES Modules (GitHub Pages & PWA Ready)** yang memadukan katalog akun premium, konfirmasi pesanan WhatsApp + struk Canvas 2D, Panel Admin terenkripsi AES-256-GCM penuh fitur, pemutar musik *full version* bebas iklan, serta halaman utilitas terpisah **Menu Utilitas** (`tools.html`) dengan **15 utilitas gratis** termasuk **Cek Nomor & Caller ID Anti-Spam**, **Novel Terpadu**, **Cek Plagiarisme Terpadu**, **Manifest AI**, **Audio Editor Studio DAW**, dan **Drama Pendek Hub**.

---

## 🎯 Tujuan Proyek

- Menyediakan toko produk digital statis zero-backend (`https://manifestudio.my.id/`) yang cepat, ringan, dan siap instal sebagai PWA di desktop maupun seluler.
- Memberikan kendali operasional penuh kepada Admin langsung lewat peramban terenkripsi tanpa menyentuh kode sumber.
- Menghadirkan ekosistem 15 utilitas harian gratis & bebas iklan bagi pengunjung: **Jadwal Sholat**, **Cuaca Presisi**, **Jam Dunia 3D**, **Speedtest**, **Downloader All-in-One**, **Kompresor Media HD AI**, **Konversi Semua File**, **Cari Judul Lagu & Video**, **YT Music Player**, **Drama Pendek (Indonesia, China & Global)**, **Audio Editor Studio AI**, **Manifest AI (Multi-Model Chat AI)**, **Cek Plagiarisme Terpadu (Format Turnitin Terbaru)**, **Novel Terpadu Real-Time (Gratis Penuh & 122+ Tema)**, dan **Cek Nomor & Caller ID Anti-Spam (Multi-API Open-Source Tanpa Login)**.

---

## 🌟 Fitur Utama

1. **Arsitektur Dual-Domain (`manifestore.my.id` ⇄ `manifestudio.my.id`), Website Mandiri & Halaman Khusus Per Fitur (`v76–v82`)**:
   - **1 Repositori + Cloudflare Pages Dual-Domain & Server Vault (`functions/_middleware.js`, `functions/api/store-access/*`, `js/domain-router.js`, `js/studio-home.js`)**: `manifestore.my.id` tayang sebagai **Manifestore** (Katalog Akun Premium, 5 Banner Fitur Store + 1 slide Manifestudio, faktur JPG/WA Manifestore, & PWA mandiri `manifest-store.webmanifest`) yang bebas akses langsung tanpa kode dan bebas berpindah ke Utilitas; `manifestudio.my.id` tayang sebagai **Website Platform Mandiri Manifestudio** dengan **Beranda Bersih Tanpa Duplikasi** (Multi-Banner Showcase 16 slide + 1 Direktori 15 Fitur ringkas + 4 Pilar Keunggulan + FAQ + Footer 3-kolom) serta **Halaman Khusus Per Fitur (`/?tab=<id>`)** yang bersih & fokus + **Keamanan Berlapis Server Vault (`v83`)** berbasis Cloudflare KV (`STORE_ACCESS_KV`, hash PBKDF2-SHA256, cookie `HttpOnly` bertanda tangan HMAC-SHA256, rate-limit anti-tebak, gateway 302 server-side, 0% kunci di HTML/JS/GitHub, tetap bisa diedit langsung dari Panel Admin).
   - **Pemuatan Instan Menu Utilitas & *Zero-Freeze Engine* (`perf-guard.js`)**: *On-demand lazy loading* per fitur, precache shell ringan `<260 KB` (`manifestudio-cache-v83`), anti-konflik `MediaCodec` Drama Pendek, lazy YouTube music engine, serta mode adaptif perangkat ringan (`data-perf="lite"`) tanpa mengurangi kualitas visual maupun fitur.
   - **Kartu Pintasan Menu Utilitas Ringkas (`#utilities-callout-card`)**: Tampil ramping tanpa daftar teks panjang dengan lencana **`15 Fitur Gratis`** yang otomatis mengikuti jumlah fitur aktif di Panel Admin.
   - Grid produk responsif (5 kolom desktop → 2 kolom mobile), pencarian instan, filter kategori dinamis, status stok, serta *FAQ* yang dapat diedit Admin.
2. **Checkout Bersih, Voucher Berkuota Ketat, Biaya Layanan Fleksibel & Struk JPEG (`order.html`)**:
   - Validasi voucher ketat dengan kuota **1x Pakai**, **Maksimal N Kali**, atau **Tak Terbatas**.
   - Skema *Bayar Sekarang (0%)*, *Bayar Belakangan (+% dapat diatur Admin)*, dan *Biaya Layanan Flat* transparan.
   - Generator struk belanja HTML5 Canvas 2D (`MS-YYMMDD-HHMMSS`) `< 60 KB` + kirim WhatsApp 1-klik.
3. **Menu Utilitas — 15 Fitur Gratis di `tools.html`**:
   - **Cek Nomor & Caller ID Anti-Spam (`tools.html?tab=callerid`, `v75`)**:
     - **Gratis 100% Tanpa Login & Kolaborasi 5 Engine Open-Source**: Menggabungkan **Google `libphonenumber-js@max`** (telekomunikasi & validasi E.164 internasional + **38+ prefix HLR seluler & 37+ kode area PSTN Indonesia**), **Direktori Resmi Terverifikasi Indonesia** (40+ hotline Bank, OJK, Darurat 112, Ekspedisi), **CallShield Open-Source Spam Database** (256 shard hash SHA-256 + `community_watch.json` + NANP area code labels di GitHub tanpa login), **GitHub Issues & HN Algolia Public OSINT**, serta **Wikidata & Wikipedia ID** secara paralel dalam satu tampilan skor Trust/Risiko (`0–100`).
     - **Tag Komunitas, Daftar Blokir Lokal, Direktori Resmi, Analisis Klaim Penipuan & Ekspor Vault JSON**: Simpan tag penelepon & catatan kronologi, kelola daftar blokir pribadi, analisis skrip/klaim phishing (file `.APK`, BI-FAST palsu, permintaan OTP), cari kontak resmi instansi, serta ekspor/impor paket tag komunitas JSON tanpa akun.
   - **Novel Terpadu Real-Time (`tools.html?tab=novel`, `v70–v72`)**:
     - **Render Instan 0ms, 200+ Novel Lintas 14+ Sumber & Mirror Eks-VIP Gratis Penuh + 100% Sampul Visual Asli**: Menampilkan katalog langsung `0ms` (`getInstantNovelCatalog`) + *progressive streaming* yang menyatukan **14+ platform & jaringan mirror Eks-VIP Gratis Full** (**WebNovel/Qidian, Kakaopage/Munpia, GoodNovel, NovelToon, Fizzo, Dreame, SakuraNovel.id, IndoWebNovel.id, SecondLifeTranslations, Wattpad Free-Only, Archive Nusantara, OpenLibrary, Gutendex, & Wikisource ID**), lengkap dengan 100% sampul visual resolusi tinggi (`KNOWN_NOVEL_COVERS` + 3×22 AniList Batch + IndoWebNovel WP Media + `GENRE_COVER_ART_POOL`) serta filter **`Eks-VIP → Gratis Full`**.
     - **Pembersih Anti-Anomali OCR/DjVu, Layar Penuh, Loncat Halaman/Bab, Pencocokan 100%, 122+ Tema & Audiobook**: Dilengkapi `cleanOcrAndDjvuText` yang membersihkan artefak scan OCR & menyambung kata terpotong (*soft-hyphen*) menjadi paragraf rapi, mode **Layar Penuh**, **Mode Halaman + Loncat Halaman** & **Mode Gulir**, pencarian & pencocokan novel dari potongan teks / screenshot OCR / file novel hingga 100% (+ baca file lokal), **Studio 122+ Tema Halaman** (Nyaman Mata, Modern, Ilustrasi SVG, 26 Animasi Canvas Bergerak, Upload Wallpaper/JSON, Palet API Publik, & Request Tema AI), serta **Mode Suara Audiobook** dengan 31 suara pria/wanita natural & auto-lanjut bab.
   - **Cek Plagiarisme Terpadu (`tools.html?tab=plagiarism`, `v67–v69`)**:
     - **Upload File Instan 0ms (Tanpa Tunggu & Tanpa Kolom Teks) vs Tempel Tulisan**: Pilih file `PDF` (teks & scan OCR), `DOCX/DOC`, `PPTX`, `XLSX/CSV`, `ODT/ODP/ODS`, `EPUB`, `RTF`, `HTML/XML`, `TXT/MD/Code`, atau gambar dan langsung klik **`Cek Plagiarisme Sekarang`** — ekstraksi, OCR, render halaman asli, & pemindaian multi-mesin berjalan serentak dalam **1 bar progres terpadu**.
     - **Penampil Dokumen Asli Multi-Halaman + Layar Penuh**: Menampilkan halaman asli dokumen secara utuh (kop surat, logo, tabel, font, tata letak tidak dibuat ulang) yang dapat di-scroll halaman demi halaman, lengkap dengan zoom, mode **Layar Penuh (`Esc` / `Keluar Full`)**, sorotan warna transparan, dan lencana angka bulat margin kiri (`1`, `2`, ...) + filter pengecualian real-time.
     - **Fusi Paralel Multi-Mesin, No Repository Ketat & Unduh `Report_*.pdf` Halaman Asli**: Menggabungkan **OpenAlex (250M+)**, **Crossref DOI (150M+)**, **DOAJ**, **Wikipedia ID/EN**, **Winnowing K-Gram + Self-Duplication + Stylometric AI**, **Multi-AI Ensemble**, & konektor opsional **Turnitin Core API (`no_repository: true`)**, lalu mengunduh **`Unduh PDF (Standar Report)`** (`Report_*.pdf` via `pdf-lib`: Cover Page, Integrity Overview, Top Sources, & **halaman asli dokumen** beranotasi warna) tanpa pernah menyimpan naskah ke repositori manapun.
   - **Manifest AI (`tools.html?tab=manifestai`, `v60–v66`)**:
     - **Streaming Instan Real-Time & 4 Jaringan Gratis Independen**: Menjawab langsung kata-per-kata (SSE streaming) lintas **LLM7**, **Pollinations**, **OVHcloud (14+ model)**, **HF Spaces**, **Puter.js SDK**, & **Multi-BYOK** dengan orkestrasi hening di latar belakang.
     - **Riset Web Real-Time, Grounding Manifestudio & Privasi Owner 4-Lapis**: Mengenali **Manifestudio by Tomy**, katalog live `data/catalog.json`, & 15 fitur Menu Utilitas secara faktual, melakukan riset web otomatis (Wikipedia/Wikivoyage/DuckDuckGo), melindungi kontak pribadi owner (`62xxxxxxxxxx` / footer), mendeteksi pindah topik, serta mendukung **Layar Penuh**, **Tabel Markdown**, dan **Mode Suara Neural Cepat 1-Suara Konsisten** (31 suara pria & wanita).
     - **Auto-Update Model Real-Time & Riwayat Chat Lengkap**: Sinkronisasi otomatis model flagship terbaru dari OpenRouter, Models.dev, dan LLM7 + multi-thread history & ekspor `.md`.
   - **Audio Editor Studio AI (`tools.html?tab=audioeditor`, `v58–v67`)**:
     - Pemotong presisi (*Keep* & *Potong Tengah*), *10-Band Parametric Equalizer*, *Bass Boost & Stereo Virtualizer*, *Voice Changer*, penjernih & perbaikan audio, pemisah vokal/karaoke, *Multi-Track Mixer*, editor tag resmi ID3v2/RIFF + iTunes/MusicBrainz, Undo/Redo stack, asisten mastering Multi-AI, tata letak Gen Z mobile anti-offside, serta ekspor MP3/WAV/AAC/M4A/OGG/FLAC/OPUS dengan preset kualitas & estimasi ukuran file.
   - **Drama Pendek Terpadu (Indonesia, China & Global · 17 Platform Original · 100% Gratis, `tools.html?tab=dracin`, `v50–v79`)**:
     - Seluruh **17 platform short-drama original** (**Drama Pendek Indonesia, DramaBox VIP/ForYou/Dubbing, PineDrama TikTok CDN, Melolo, NetShort, NunoMix Dub Indo, ReelShort, ShortMax, GoodShort, FlickReels, FreeReels, DramaWave, FlexTV, KalosTV, MoboReels, MyDrama, StardustTV, & Vigloo**) disatukan dalam **1 katalog terpadu** dengan warm-start `0ms` (108+ drama terverifikasi termasuk **16+ Drama Pendek Indonesia 100% Gratis Ep 1–Tamat** + pembaruan live tanpa batas).
     - 100% pemutaran di pemutar vertikal 9:16 HTML5 `<video>` asli (Direct MP4 HD, HLS.js, WebCrypto CENC), **anti-scroll lompat ke bawah** saat buka drama & keluar layar penuh, **subtitle eksternal CORS-unwrapped VTT/SRT/ASS/JSON + laci pilih subtitle in-stage + terjemahan otomatis penuh**, tombol ubah resolusi di layar penuh, **🔥 Mode FYP TikTok**, serta pencari drama lintas-platform & klip AI.
   - **Jadwal Sholat Indonesia**, **Prakiraan Cuaca Presisi**, **Jam Dunia & Globe 3D**, **Speedtest Cloudflare**, **Downloader Sosmed All-in-One**, **Kompresor Media HD AI & Open-Source**, **Konversi Semua File (85+ Format)**, **Cari Judul Lagu & Sumber Video**, serta **Pemutar YT Music Bebas Iklan + Background Audio Anti-Mati**.
4. **Panel Admin Terenkripsi AES-256-GCM + Dashboard Status Sinkronisasi (`admin.html`, `v75`)**:
   - Dilindungi PBKDF2-SHA256 + verifikasi token GitHub PAT.
   - **Pusat Kontrol & Status Sinkronisasi real-time**: Menampilkan indikator sinkronisasi 4 area (*Menu Utama & Katalog*, *Menu Utilitas*, *Banner Carousel*, *Status Publikasi*), tombol 1-klik **`Sinkronkan Semua Menu & Banner`**, penghitung angka live di tab, serta kartu *collapsible* rapi dengan sakelar Aktif/Nonaktif & pengatur urutan untuk 16 banner dan 15 menu utilitas.
   - Kelola produk, sub-varian, harga, stok, kategori layanan custom, kuota pemakaian voucher, logo brand, tagline/footer, biaya layanan, kontak & logo sosmed, FAQ, OpenGraph Live, Slide Banner, serta Riwayat Perubahan Terperinci (maks 12 log + Restore 1-klik).

---

## 📂 Struktur Berkas Utama

```text
├── index.html              # Beranda katalog toko, multi-banner carousel, drawer checkout & FAQ
├── order.html              # Halaman konfirmasi invoice dedikasi & unduh struk Canvas 2D
├── tools.html              # Halaman Menu Utilitas (15 Fitur Gratis termasuk Cek Nomor, Novel Terpadu, Cek Plagiarisme & Manifest AI)
├── admin.html              # Panel Admin terenkripsi AES-256-GCM (Kendali penuh toko & CMS)
├── BLUEPRINT.md            # Arsitektur teknis lengkap, tujuan proyek, daftar API & storage keys
├── ROADMAP.md              # Pencapaian milestone (Fase 1-11) & rencana fase berikutnya
├── data/
│   ├── catalog.json        # Single Source of Truth katalog, utilitas, brand, OpenGraph, banners, voucher & FAQ
│   ├── dracin-endpoints.json # Konfigurasi adaptif endpoint mirror Drama China
│   └── catalog-history.json # Log riwayat perubahan katalog (maks 12 snapshot + rincian aksi)
├── css/                    # Design tokens (Dark/Light) & responsive styles
├── js/                     # Native ES Modules (store, tools-logic, phone-logic, phone-engine, callerid-ui, plagiarism-*, manifest-ai-*, audio-editor-*, dracin-*, music, downloader, compressor, converter, song-finder, speedtest, vault, admin)
└── assets/                 # Ikon SVG, gambar banner, logo produk, uploads & og-manifestudio.jpg (1200×630)
```

---

## 🧪 Pengujian & Verifikasi Developer

```bash
# Jalankan unit test store, plagiarisme, novel, phone callerid, & manifest-ai
npx --yes tsx --test .repos/InfoKatalogtMCTomyStudio/js/store.test.mjs .repos/InfoKatalogtMCTomyStudio/js/phone.test.mjs .repos/InfoKatalogtMCTomyStudio/js/novel.test.mjs .repos/InfoKatalogtMCTomyStudio/js/plagiarism.test.mjs .repos/InfoKatalogtMCTomyStudio/js/manifest-ai.test.mjs

# Build dan Lint proyek
npm run build && npm run lint
```

Detail lengkap mengenai arsitektur, kontrak API gratis & BYOK, serta pedoman pengembangan lanjutan tersedia pada **`BLUEPRINT.md`** dan **`ROADMAP.md`**.
