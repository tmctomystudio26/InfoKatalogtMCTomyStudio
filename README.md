# Manifestudio — Storefront Katalog Digital, Utility Hub (13 Fitur) & Panel Admin Statis

Platform web statis resmi **Manifestudio** (*by Tomy*) berbasis **100% Static HTML/CSS + Native ES Modules (GitHub Pages & PWA Ready)** yang memadukan katalog akun premium, konfirmasi pesanan WhatsApp + struk Canvas 2D, Panel Admin terenkripsi AES-256-GCM penuh fitur, pemutar musik *full version* bebas iklan, serta halaman utilitas terpisah **Menu Utilitas** (`tools.html`) dengan **13 utilitas gratis** termasuk **Cek Plagiarisme Terpadu**, **Manifest AI**, **Audio Editor Studio DAW**, dan **Drama China Hub**.

---

## 🎯 Tujuan Proyek

- Menyediakan toko produk digital statis zero-backend (`https://manifestudio.my.id/`) yang cepat, ringan, dan siap instal sebagai PWA di desktop maupun seluler.
- Memberikan kendali operasional penuh kepada Admin langsung lewat peramban terenkripsi tanpa menyentuh kode sumber.
- Menghadirkan ekosistem 13 utilitas harian gratis & bebas iklan bagi pengunjung: **Jadwal Sholat**, **Cuaca Presisi**, **Jam Dunia 3D**, **Speedtest**, **Downloader All-in-One**, **Kompresor Media HD AI**, **Konversi Semua File**, **Cari Judul Lagu & Video**, **YT Music Player**, **Drama China (Dracin)**, **Audio Editor Studio AI**, **Manifest AI (Multi-Model Chat AI)**, dan **Cek Plagiarisme Terpadu (Format Turnitin Terbaru)**.

---

## 🌟 Fitur Utama

1. **Katalog Top-Up Modern, Tombol Khusus Menu Utilitas & Multi-Banner Carousel Dinamis**:
   - Slide banner interaktif yang sepenuhnya dapat ditambah, diubah teks/gambarnya, atau diatur urutannya lewat Panel Admin.
   - Akses **Menu Utilitas (`#utilities-callout-card`)** terpisah di atas pencarian dengan ikon vektor khusus (`menu-utilitas.svg`).
   - Grid produk responsif (5 kolom desktop → 2 kolom mobile), pencarian instan, filter kategori dinamis, status stok, serta *FAQ* yang dapat diedit Admin.
2. **Checkout Bersih, Voucher Berkuota Ketat, Biaya Layanan Fleksibel & Struk JPEG (`order.html`)**:
   - Validasi voucher ketat dengan kuota **1x Pakai**, **Maksimal N Kali**, atau **Tak Terbatas**.
   - Skema *Bayar Sekarang (0%)*, *Bayar Belakangan (+% dapat diatur Admin)*, dan *Biaya Layanan Flat* transparan.
   - Generator struk belanja HTML5 Canvas 2D (`MS-YYMMDD-HHMMSS`) `< 60 KB` + kirim WhatsApp 1-klik.
3. **Menu Utilitas — 13 Fitur Gratis di `tools.html`**:
   - **Cek Plagiarisme Terpadu (`tools.html?tab=plagiarism`, `v67`)**:
     - **Upload Semua File & Paste Tulisan**: Membaca `PDF`, `DOCX/DOC`, `PPTX`, `XLSX/CSV`, `ODT/ODP/ODS`, `EPUB`, `RTF`, `HTML/XML`, `TXT/MD/Code`, gambar (OCR), hingga fallback biner atau langsung tempel teks.
     - **Fusi Paralel Multi-Mesin Terpadu**: Menjalankan bersamaan **OpenAlex (250M+)**, **Crossref DOI (150M+)**, **DOAJ**, **Wikipedia ID & EN**, **Winnowing K-Gram + Cosine/Jaccard + Self-Duplication + Stylometric AI Detector**, **Multi-AI Semantic Ensemble** (`manifest-ai.js`), serta konektor opsional **Turnitin Core API / Institutional** menjadi satu skor kemiripan & laporan utuh.
     - **Bar Progres Real-Time & Unduh Laporan Format Turnitin Terbaru**: Progres 0%–100% + status per mesin + tombol Batal, sorotan warna `[1]`/`[2]` interaktif, filter pengecualian (Kutipan, Daftar Pustaka, Sumber Kecil), serta ekspor langsung **PDF vektor multi-halaman**, **HTML interaktif siap cetak**, dan **JSON audit**.
   - **Manifest AI (`tools.html?tab=manifestai`, `v60–v66`)**:
     - **Streaming Instan Real-Time & 4 Jaringan Gratis Independen**: Menjawab langsung kata-per-kata (SSE streaming) lintas **LLM7**, **Pollinations**, **OVHcloud (14+ model)**, **HF Spaces**, **Puter.js SDK**, & **Multi-BYOK** dengan orkestrasi hening di latar belakang.
     - **Riset Web Real-Time, Grounding Manifestudio & Privasi Owner 4-Lapis**: Mengenali **Manifestudio by Tomy**, katalog live `data/catalog.json`, & 13 fitur Menu Utilitas secara faktual, melakukan riset web otomatis (Wikipedia/Wikivoyage/DuckDuckGo), melindungi kontak pribadi owner (`62xxxxxxxxxx` / footer), mendeteksi pindah topik, serta mendukung **Layar Penuh**, **Tabel Markdown**, dan **Mode Suara Neural Cepat 1-Suara Konsisten** (31 suara pria & wanita).
     - **Auto-Update Model Real-Time & Riwayat Chat Lengkap**: Sinkronisasi otomatis model flagship terbaru dari OpenRouter, Models.dev, dan LLM7 + multi-thread history & ekspor `.md`.
   - **Audio Editor Studio AI (`tools.html?tab=audioeditor`, `v58–v67`)**:
     - Pemotong presisi (*Keep* & *Potong Tengah*), *10-Band Parametric Equalizer*, *Bass Boost & Stereo Virtualizer*, *Voice Changer*, penjernih & perbaikan audio, pemisah vokal/karaoke, *Multi-Track Mixer*, editor tag resmi ID3v2/RIFF + iTunes/MusicBrainz, Undo/Redo stack, asisten mastering Multi-AI, tata letak Gen Z mobile anti-offside, serta ekspor MP3/WAV/AAC/M4A/OGG/FLAC/OPUS dengan preset kualitas & estimasi ukuran file.
   - **Drama China (Dracin) Gratis Tanpa Iklan (`tools.html?tab=dracin`, `v50–v57`)**:
     - Katalog real-time lintas 20+ platform (*SekaiDrama/Sansekai, DramaBox, ReelShort, ShortMax, NetShort, Melolo, PineDrama, MyDrama, GoodShort, DramaWave, Anichin*, dll.) dengan pemutar vertikal fullscreen + *Layar Bersih*, preloading episode berikutnya, subtitle Indonesia otomatis, pencari drama lintas-platform & klip AI, serta failover server VIP-free.
   - **Jadwal Sholat Indonesia**, **Prakiraan Cuaca Presisi**, **Jam Dunia & Globe 3D**, **Speedtest Cloudflare**, **Downloader Sosmed All-in-One**, **Kompresor Media HD AI & Open-Source**, **Konversi Semua File (85+ Format)**, **Cari Judul Lagu & Sumber Video**, serta **Pemutar YT Music Bebas Iklan + Background Audio Anti-Mati**.
4. **Panel Admin Terenkripsi AES-256-GCM (`admin.html`)**:
   - Dilindungi PBKDF2-SHA256 + verifikasi token GitHub PAT.
   - Kelola produk, sub-varian, harga, stok, kategori layanan custom, kuota pemakaian voucher, logo brand, tagline/footer, biaya layanan, kontak & logo sosmed, FAQ, OpenGraph Live, Slide Banner, serta Riwayat Perubahan Terperinci (maks 12 log + Restore 1-klik).

---

## 📂 Struktur Berkas Utama

```text
├── index.html              # Beranda katalog toko, multi-banner carousel, drawer checkout & FAQ
├── order.html              # Halaman konfirmasi invoice dedikasi & unduh struk Canvas 2D
├── tools.html              # Halaman Menu Utilitas (13 Fitur Gratis termasuk Cek Plagiarisme & Manifest AI)
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
