# Manifestudio — Storefront Katalog Digital, Utility Hub (14 Fitur) & Panel Admin Statis

Platform web statis resmi **Manifestudio** (*by Tomy*) berbasis **100% Static HTML/CSS + Native ES Modules (GitHub Pages & PWA Ready)** yang memadukan katalog akun premium, konfirmasi pesanan WhatsApp + struk Canvas 2D, Panel Admin terenkripsi AES-256-GCM penuh fitur, pemutar musik *full version* bebas iklan, serta halaman utilitas terpisah **Menu Utilitas** (`tools.html`) dengan **14 utilitas gratis** termasuk **Novel Terpadu**, **Cek Plagiarisme Terpadu**, **Manifest AI**, **Audio Editor Studio DAW**, dan **Drama China Hub**.

---

## 🎯 Tujuan Proyek

- Menyediakan toko produk digital statis zero-backend (`https://manifestudio.my.id/`) yang cepat, ringan, dan siap instal sebagai PWA di desktop maupun seluler.
- Memberikan kendali operasional penuh kepada Admin langsung lewat peramban terenkripsi tanpa menyentuh kode sumber.
- Menghadirkan ekosistem 14 utilitas harian gratis & bebas iklan bagi pengunjung: **Jadwal Sholat**, **Cuaca Presisi**, **Jam Dunia 3D**, **Speedtest**, **Downloader All-in-One**, **Kompresor Media HD AI**, **Konversi Semua File**, **Cari Judul Lagu & Video**, **YT Music Player**, **Drama China (Dracin)**, **Audio Editor Studio AI**, **Manifest AI (Multi-Model Chat AI)**, **Cek Plagiarisme Terpadu (Format Turnitin Terbaru)**, dan **Novel Terpadu Real-Time (Gratis Penuh & 122+ Tema)**.

---

## 🌟 Fitur Utama

1. **Katalog Top-Up Modern, 15 Banner Maskot Visual Gen-Z & Kartu Menu Utilitas Ringkas (`v74`)**:
   - **15 Slide Banner Maskot Gen-Z (`assets/banners/banner-*.jpg`)**: Setiap menu (Katalog Utama + 14 Menu Utilitas) memiliki ilustrasi maskot unik bergaya modern, scrim bertema, penghitung slide (`1 / 15`), serta sinkron penuh dengan Panel Admin.
   - **Kartu Pintasan Menu Utilitas Ringkas (`#utilities-callout-card`)**: Tampil ramping tanpa daftar teks panjang dengan lencana **`14 Fitur Gratis`** yang otomatis mengikuti jumlah fitur aktif di Panel Admin.
   - Grid produk responsif (5 kolom desktop → 2 kolom mobile), pencarian instan, filter kategori dinamis, status stok, serta *FAQ* yang dapat diedit Admin.
2. **Checkout Bersih, Voucher Berkuota Ketat, Biaya Layanan Fleksibel & Struk JPEG (`order.html`)**:
   - Validasi voucher ketat dengan kuota **1x Pakai**, **Maksimal N Kali**, atau **Tak Terbatas**.
   - Skema *Bayar Sekarang (0%)*, *Bayar Belakangan (+% dapat diatur Admin)*, dan *Biaya Layanan Flat* transparan.
   - Generator struk belanja HTML5 Canvas 2D (`MS-YYMMDD-HHMMSS`) `< 60 KB` + kirim WhatsApp 1-klik.
3. **Menu Utilitas — 14 Fitur Gratis di `tools.html`**:
   - **Novel Terpadu Real-Time (`tools.html?tab=novel`, `v70–v72`)**:
     - **Render Instan 0ms, 200+ Novel Lintas 14+ Sumber & Mirror Eks-VIP Gratis Penuh + 100% Sampul Visual Asli**: Menampilkan katalog langsung `0ms` (`getInstantNovelCatalog`) + *progressive streaming* yang menyatukan **14+ platform & jaringan mirror Eks-VIP Gratis Full** (**WebNovel/Qidian, Kakaopage/Munpia, GoodNovel, NovelToon, Fizzo, Dreame, SakuraNovel.id, IndoWebNovel.id, SecondLifeTranslations, Wattpad Free-Only, Archive Nusantara, OpenLibrary, Gutendex, & Wikisource ID**), lengkap dengan 100% sampul visual resolusi tinggi (`KNOWN_NOVEL_COVERS` + 3×22 AniList Batch + IndoWebNovel WP Media + `GENRE_COVER_ART_POOL`) serta filter **`Eks-VIP → Gratis Full`**.
     - **Pembersih Anti-Anomali OCR/DjVu, Layar Penuh, Loncat Halaman/Bab, Pencocokan 100%, 122+ Tema & Audiobook**: Dilengkapi `cleanOcrAndDjvuText` yang membersihkan artefak scan OCR & menyambung kata terpotong (*soft-hyphen*) menjadi paragraf rapi, mode **Layar Penuh**, **Mode Halaman + Loncat Halaman** & **Mode Gulir**, pencarian & pencocokan novel dari potongan teks / screenshot OCR / file novel hingga 100% (+ baca file lokal), **Studio 122+ Tema Halaman** (Nyaman Mata, Modern, Ilustrasi SVG, 26 Animasi Canvas Bergerak, Upload Wallpaper/JSON, Palet API Publik, & Request Tema AI), serta **Mode Suara Audiobook** dengan 31 suara pria/wanita natural & auto-lanjut bab.
   - **Cek Plagiarisme Terpadu (`tools.html?tab=plagiarism`, `v67–v69`)**:
     - **Upload File Instan 0ms (Tanpa Tunggu & Tanpa Kolom Teks) vs Tempel Tulisan**: Pilih file `PDF` (teks & scan OCR), `DOCX/DOC`, `PPTX`, `XLSX/CSV`, `ODT/ODP/ODS`, `EPUB`, `RTF`, `HTML/XML`, `TXT/MD/Code`, atau gambar dan langsung klik **`Cek Plagiarisme Sekarang`** — ekstraksi, OCR, render halaman asli, & pemindaian multi-mesin berjalan serentak dalam **1 bar progres terpadu**.
     - **Penampil Dokumen Asli Multi-Halaman + Layar Penuh**: Menampilkan halaman asli dokumen secara utuh (kop surat, logo, tabel, font, tata letak tidak dibuat ulang) yang dapat di-scroll halaman demi halaman, lengkap dengan zoom, mode **Layar Penuh (`Esc` / `Keluar Full`)**, sorotan warna transparan, dan lencana angka bulat margin kiri (`1`, `2`, ...) + filter pengecualian real-time.
     - **Fusi Paralel Multi-Mesin, No Repository Ketat & Unduh `Report_*.pdf` Halaman Asli**: Menggabungkan **OpenAlex (250M+)**, **Crossref DOI (150M+)**, **DOAJ**, **Wikipedia ID/EN**, **Winnowing K-Gram + Self-Duplication + Stylometric AI**, **Multi-AI Ensemble**, & konektor opsional **Turnitin Core API (`no_repository: true`)**, lalu mengunduh **`Unduh PDF (Standar Report)`** (`Report_*.pdf` via `pdf-lib`: Cover Page, Integrity Overview, Top Sources, & **halaman asli dokumen** beranotasi warna) tanpa pernah menyimpan naskah ke repositori manapun.
   - **Manifest AI (`tools.html?tab=manifestai`, `v60–v66`)**:
     - **Streaming Instan Real-Time & 4 Jaringan Gratis Independen**: Menjawab langsung kata-per-kata (SSE streaming) lintas **LLM7**, **Pollinations**, **OVHcloud (14+ model)**, **HF Spaces**, **Puter.js SDK**, & **Multi-BYOK** dengan orkestrasi hening di latar belakang.
     - **Riset Web Real-Time, Grounding Manifestudio & Privasi Owner 4-Lapis**: Mengenali **Manifestudio by Tomy**, katalog live `data/catalog.json`, & 13 fitur Menu Utilitas secara faktual, melakukan riset web otomatis (Wikipedia/Wikivoyage/DuckDuckGo), melindungi kontak pribadi owner (`62xxxxxxxxxx` / footer), mendeteksi pindah topik, serta mendukung **Layar Penuh**, **Tabel Markdown**, dan **Mode Suara Neural Cepat 1-Suara Konsisten** (31 suara pria & wanita).
     - **Auto-Update Model Real-Time & Riwayat Chat Lengkap**: Sinkronisasi otomatis model flagship terbaru dari OpenRouter, Models.dev, dan LLM7 + multi-thread history & ekspor `.md`.
   - **Audio Editor Studio AI (`tools.html?tab=audioeditor`, `v58–v67`)**:
     - Pemotong presisi (*Keep* & *Potong Tengah*), *10-Band Parametric Equalizer*, *Bass Boost & Stereo Virtualizer*, *Voice Changer*, penjernih & perbaikan audio, pemisah vokal/karaoke, *Multi-Track Mixer*, editor tag resmi ID3v2/RIFF + iTunes/MusicBrainz, Undo/Redo stack, asisten mastering Multi-AI, tata letak Gen Z mobile anti-offside, serta ekspor MP3/WAV/AAC/M4A/OGG/FLAC/OPUS dengan preset kualitas & estimasi ukuran file.
   - **Drama China Terpadu 17 Platform Original — 100% VIP Terbuka & Mode FYP TikTok (`tools.html?tab=dracin`, `v50–v73`)**:
     - Seluruh **17 platform short-drama original** (**DramaBox VIP/ForYou/Dubbing, PineDrama TikTok CDN, Melolo, NetShort, NunoMix Dub Indo, ReelShort, ShortMax, GoodShort, FlickReels, FreeReels, DramaWave, FlexTV, KalosTV, MoboReels, MyDrama, StardustTV, & Vigloo**) disatukan dalam **1 katalog terpadu** dengan warm-start `0ms` (92+ drama terverifikasi + sinkronisasi live 400–500+ judul) dan **0% Dailymotion**.
     - 100% pemutaran di pemutar vertikal 9:16 HTML5 `<video>` asli (Direct MP4 HD, HLS.js, WebCrypto CENC), **100% VIP Terbuka Ep 1–Tamat gratis**, fitur **🔥 Mode FYP TikTok (Full Ep Gratis)** dengan pengalih drama FYP instan, Layar Penuh + *Layar Bersih*, preloading episode berikutnya, subtitle Indonesia otomatis, serta pencari drama lintas-platform & klip AI.
   - **Jadwal Sholat Indonesia**, **Prakiraan Cuaca Presisi**, **Jam Dunia & Globe 3D**, **Speedtest Cloudflare**, **Downloader Sosmed All-in-One**, **Kompresor Media HD AI & Open-Source**, **Konversi Semua File (85+ Format)**, **Cari Judul Lagu & Sumber Video**, serta **Pemutar YT Music Bebas Iklan + Background Audio Anti-Mati**.
4. **Panel Admin Terenkripsi AES-256-GCM + Dashboard Status Sinkronisasi (`admin.html`, `v74`)**:
   - Dilindungi PBKDF2-SHA256 + verifikasi token GitHub PAT.
   - **Pusat Kontrol & Status Sinkronisasi real-time**: Menampilkan indikator sinkronisasi 4 area (*Menu Utama & Katalog*, *Menu Utilitas*, *Banner Carousel*, *Status Publikasi*), tombol 1-klik **`Sinkronkan Semua Menu & Banner`**, penghitung angka live di tab, serta kartu *collapsible* rapi dengan sakelar Aktif/Nonaktif & pengatur urutan untuk 15 banner dan 14 menu utilitas.
   - Kelola produk, sub-varian, harga, stok, kategori layanan custom, kuota pemakaian voucher, logo brand, tagline/footer, biaya layanan, kontak & logo sosmed, FAQ, OpenGraph Live, Slide Banner, serta Riwayat Perubahan Terperinci (maks 12 log + Restore 1-klik).

---

## 📂 Struktur Berkas Utama

```text
├── index.html              # Beranda katalog toko, multi-banner carousel, drawer checkout & FAQ
├── order.html              # Halaman konfirmasi invoice dedikasi & unduh struk Canvas 2D
├── tools.html              # Halaman Menu Utilitas (14 Fitur Gratis termasuk Novel Terpadu, Cek Plagiarisme & Manifest AI)
├── admin.html              # Panel Admin terenkripsi AES-256-GCM (Kendali penuh toko & CMS)
├── BLUEPRINT.md            # Arsitektur teknis lengkap, tujuan proyek, daftar API & storage keys
├── ROADMAP.md              # Pencapaian milestone (Fase 1-11) & rencana fase berikutnya
├── data/
│   ├── catalog.json        # Single Source of Truth katalog, utilitas, brand, OpenGraph, banners, voucher & FAQ
│   ├── dracin-endpoints.json # Konfigurasi adaptif endpoint mirror Drama China
│   └── catalog-history.json # Log riwayat perubahan katalog (maks 12 snapshot + rincian aksi)
├── css/                    # Design tokens (Dark/Light) & responsive styles
├── js/                     # Native ES Modules (store, tools-logic, plagiarism-*, manifest-ai-*, audio-editor-*, dracin-*, music, downloader, compressor, converter, song-finder, speedtest, vault, admin)
└── assets/                 # Ikon SVG, gambar banner, logo produk, uploads & og-manifestudio.jpg (1200×630)
```

---

## 🧪 Pengujian & Verifikasi Developer

```bash
# Jalankan unit test plagiarisme, registrasi 13 utilitas, & manifest-ai
npx --yes tsx --test .repos/InfoKatalogtMCTomyStudio/js/plagiarism.test.mjs .repos/InfoKatalogtMCTomyStudio/js/manifest-ai.test.mjs

# Build dan Lint proyek
npm run build && npm run lint
```

Detail lengkap mengenai arsitektur, kontrak API gratis & BYOK, serta pedoman pengembangan lanjutan tersedia pada **`BLUEPRINT.md`** dan **`ROADMAP.md`**.
