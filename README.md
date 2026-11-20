# Manifestudio — Storefront Katalog Digital, Utility Hub (12 Fitur) & Panel Admin Statis

Platform web statis resmi **Manifestudio** (*by Tomy*) berbasis **100% Static HTML/CSS + Native ES Modules (GitHub Pages & PWA Ready)** yang memadukan katalog akun premium, konfirmasi pesanan WhatsApp + struk Canvas 2D, Panel Admin terenkripsi AES-256-GCM penuh fitur, pemutar musik *full version* bebas iklan, serta halaman utilitas terpisah **Menu Utilitas** (`tools.html`) dengan **12 utilitas gratis** termasuk **Manifest AI**, **Audio Editor Studio DAW**, dan **Drama China Hub**.

---

## 🎯 Tujuan Proyek

- Menyediakan toko produk digital statis zero-backend (`https://manifestudio.my.id/`) yang cepat, ringan, dan siap instal sebagai PWA di desktop maupun seluler.
- Memberikan kendali operasional penuh kepada Admin langsung lewat peramban terenkripsi tanpa menyentuh kode sumber.
- Menghadirkan ekosistem 12 utilitas harian gratis & bebas iklan bagi pengunjung: **Jadwal Sholat**, **Cuaca Presisi**, **Jam Dunia 3D**, **Speedtest**, **Downloader All-in-One**, **Kompresor Media HD AI**, **Konversi Semua File**, **Cari Judul Lagu & Video**, **YT Music Player**, **Drama China (Dracin)**, **Audio Editor Studio AI**, dan **Manifest AI (Multi-Model Chat AI)**.

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
3. **Menu Utilitas — 12 Fitur Gratis di `tools.html`**:
   - **Manifest AI (`tools.html?tab=manifestai`, `v60–v62`)**:
     - **Streaming Instan Real-Time & Smart Staggered Hedging (Hemat Kuota 3×)**: Menjawab langsung kata-per-kata (SSE token streaming ala ChatGPT/Gemini) dengan rotasi bucket gratis (**LLM7 Free API**, **Hugging Face Gradio SSE Spaces**, & **Puter.js SDK**) dan BYOK pribadi. Hanya mengirim 1 permintaan gratis terlebih dahulu (baru membuka cadangan jika lambat/gagal) agar kuota pengguna jauh lebih awet, dengan orkestrasi hening di latar belakang.
     - **Grounding Identitas Manifestudio & Deteksi Pindah Topik**: Mengenali **Manifestudio by Tomy (`@tmctomystudio`)**, 19 produk katalog live dari `data/catalog.json`, dan 12 fitur Menu Utilitas secara faktual anti-halusinasi, serta otomatis mendeteksi perpindahan topik agar tidak terjebak di topik sebelumnya.
     - **Auto-Update & Auto-Upgrade Model Real-Time**: Otomatis menyinkronkan katalog model terbaru dari **OpenRouter Live Registry**, **Models.dev**, dan **LLM7** agar setiap penyedia selalu memakai model flagship terbarunya sesuai platform asli.
     - **Multi-Provider BYOK (API Key Pribadi Paralel)**: Pengguna bebas memasang **1 atau banyak API Key pribadi sekaligus** (Gemini, OpenAI, DeepSeek, Claude, xAI Grok, Groq, OpenRouter, Mistral, Qwen/DashScope, Custom OpenAI-compatible), memilih model atau *Auto-Latest*, menguji koneksi, serta menggabungkan beberapa kunci pribadi sekaligus (atau memadukannya dengan jalur gratis). Kunci disimpan 100% lokal di browser pengguna.
     - **Riwayat Chat Lengkap**: Multi-thread history (*Chat Baru*, cari riwayat, ubah judul, hapus satuan/semua, & ekspor `.md`) tersimpan persisten di browser.
   - **Audio Editor Studio AI (`tools.html?tab=audioeditor`, `v58–v59`)**:
     - Pemotong presisi (*Keep* & *Potong Tengah*), *10-Band Parametric Equalizer*, *Bass Boost & Stereo Virtualizer*, *Voice Changer*, penjernih & perbaikan audio, pemisah vokal/karaoke, *Multi-Track Mixer*, editor tag resmi ID3v2/RIFF + iTunes/MusicBrainz, Undo/Redo stack, asisten mastering Multi-AI, serta ekspor MP3/WAV/AAC/M4A/OGG/FLAC/OPUS dengan preset kualitas & estimasi ukuran file.
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
├── tools.html              # Halaman Menu Utilitas (12 Fitur Gratis termasuk Manifest AI)
├── admin.html              # Panel Admin terenkripsi AES-256-GCM (Kendali penuh toko & CMS)
├── BLUEPRINT.md            # Arsitektur teknis lengkap, tujuan proyek, daftar API & storage keys
├── ROADMAP.md              # Pencapaian milestone (Fase 1-11) & rencana fase berikutnya
├── data/
│   ├── catalog.json        # Single Source of Truth katalog, utilitas, brand, OpenGraph, banners, voucher & FAQ
│   ├── dracin-endpoints.json # Konfigurasi adaptif endpoint mirror Drama China
│   └── catalog-history.json # Log riwayat perubahan katalog (maks 12 snapshot + rincian aksi)
├── css/                    # Design tokens (Dark/Light) & responsive styles
├── js/                     # Native ES Modules (store, tools-logic, manifest-ai-*, audio-editor-*, dracin-*, music, downloader, compressor, converter, song-finder, speedtest, vault, admin)
└── assets/                 # Ikon SVG, gambar banner, logo produk, uploads & og-manifestudio.jpg (1200×630)
```

---

## 🧪 Pengujian & Verifikasi Developer

```bash
# Jalankan seluruh unit test (store, voucher, downloader, compressor, music, dracin, audio-editor, manifest-ai)
npx --yes tsx --test .repos/InfoKatalogtMCTomyStudio/js/store.test.mjs

# Build dan Lint proyek
npm run build && npm run lint
```

Detail lengkap mengenai arsitektur, kontrak API gratis & BYOK, serta pedoman pengembangan lanjutan tersedia pada **`BLUEPRINT.md`** dan **`ROADMAP.md`**.
