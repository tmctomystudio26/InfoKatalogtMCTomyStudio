# Manifestudio — Storefront Katalog Digital, Utility Hub & Panel Admin Statis

Platform web statis resmi **Manifestudio** (*by Tomy*) berbasis **100% Static HTML/CSS + Native ES Modules (GitHub Pages & PWA Ready)** yang memadukan katalog akun premium, konfirmasi pesanan WhatsApp + struk Canvas 2D, Panel Admin terenkripsi AES-256-GCM penuh fitur, pemutar musik *full version* bebas iklan, serta halaman utilitas terpisah **Menu Utilitas** (`tools.html`).

---

## 🎯 Tujuan Proyek

- Menyediakan toko produk digital statis zero-backend (`https://manifestudio.my.id/`) yang cepat, ringan, dan siap instal sebagai PWA di desktop maupun seluler.
- Memberikan kendali operasional penuh kepada Admin langsung lewat peramban terenkripsi tanpa menyentuh kode sumber.
- Menghadirkan utilitas produktivitas harian bebas iklan bagi pengunjung (Jadwal Sholat, Cuaca Presisi, Jam Dunia 3D, Speedtest, Downloader All-in-One berbar progres, dan Kompresor Media HD).

---

## 🌟 Fitur Utama

1. **Katalog Top-Up Modern, Tombol Khusus Menu Utilitas & Multi-Banner Carousel Dinamis**:
   - Slide banner interaktif yang sepenuhnya dapat ditambah, diubah teks/gambarnya, atau diatur urutannya lewat Panel Admin.
   - Akses **Menu Utilitas (`#utilities-callout-card`)** terpisah di atas pencarian dengan ikon vektor khusus (`menu-utilitas.svg`) — rapi dan terpisah penuh dari daftar kategori layanan agar langsung terlihat pengunjung.
   - Grid produk responsif (5 kolom desktop → 2 kolom mobile), pencarian instan, filter kategori dinamis, status stok, serta *FAQ* yang dapat diedit Admin.
2. **Checkout Bersih, Voucher Berkuota Ketat, Biaya Layanan Fleksibel & Struk JPEG (`order.html`)**:
   - Validasi voucher ketat: kode yang tidak terdaftar langsung ditolak sebagai **Tidak Valid** (bukan dicatat menunggu Admin). Mendukung kuota **1x Pakai**, **Maksimal N Kali**, atau **Tak Terbatas**.
   - Skema *Bayar Sekarang (0%)*, *Bayar Belakangan (+% dapat diatur Admin)*, dan *Biaya Layanan Flat* transparan.
   - Generator struk belanja HTML5 Canvas 2D (`MS-YYMMDD-HHMMSS`) `< 60 KB` + kirim WhatsApp 1-klik.
3. **Menu Utilitas — Halaman Utilitas Terpisah (`tools.html`)**:
   - **Jadwal Sholat Indonesia**: Resmi Kemenag RI (MyQuran v2 + AlAdhan method=20), prioritas GPS presisi Kelurahan/Kecamatan → fallback IP → cari kota.
   - **Prakiraan Cuaca Presisi**: Deteksi hujan lebat/badai berbasis curah hujan konvektif, stasiun lokal & kalibrasi real-time, per jam & 7 hari (Open-Meteo).
   - **Jam Dunia & Globe 3D Interaktif**: Waktu UTC internasional, konversi WIB/WITA/WIT, dan globe yang dapat diputar serta diklik per negara target.
   - **Speedtest Internet**: Meter kecepatan real-time 60fps, ping, jitter, loaded latency, download/upload berbobot berkelanjutan (Cloudflare Speed Edge), server node, ISP, dan info perangkat.
   - **Downloader Sosmed All-in-One + Bar Progres Live (`v23`)**: Unduh **Video MP4 HD & Audio M4A/MP3 bersamaan** pada YouTube (`Siputzx Ummy` + `4-node Tioo` + `vidsnap.app/proxy` CORS), serta **Reels, Foto HD, Carousel Multi-Slide, Story & Salin Caption** pada Instagram (`Siputzx sssinstagram` + `Ummy` + `fastdl`/`igram` fallback), bebas jebakan redirect HTML (`sf-converter`/`savetube`), lengkap dengan **Bar Progres Konversi & Streaming Download Real-Time** + pemutar pratinjau `<video>` / `<audio>` + ekstraksi `.wav` lokal.
   - **Kompresor Foto & Video HD (Anti-Pecah Sosmed)**: 4 metode kompresi *zero-loss* dengan preset TikTok HD, Instagram HD, WhatsApp HD, dan Original 1:1 untuk mencegah penurunan kualitas saat unggah.
4. **Pemutar YT Music Lengkap (Lokal & Internasional), Full-Length, PiP, Mode Headset & Background Audio Non-Stop (`tools.html?tab=music` & Floating Dock, `v37`)**:
   - Menggabungkan **YT Music Community API** (`Siputzx YT Search` & `Ummy`), **30 Lagu Viral Indonesia Full-Length Terverifikasi (`156s–354s`, Real YouTube Video ID + Audius Direct CDN)**, dan **YouTube IFrame Audio Engine** — bebas potongan preview 30 detik (`>= 75 detik` wajib) dan menampilkan hasil pencarian YouTube Music secara utuh (lagu Indonesia, luar negeri, lirik, remix, maupun akustik hingga 26 lagu per pencarian).
   - **Tetap Menyala Saat Layar Dimatikan / Pindah Tab / Keluar Browser di Semua Browser (`v37`)**: Dilengkapi *Silent-Hold Audio Bridge* kontinu pada `#music-audio-el` (in-viewport 2×2px + `navigator.audioSession.type = 'playback'`), *auto-upgrade* instan dari `yt-iframe` ke native `<audio>` begitu stream langsung tersedia, probe cepat `fetch(Range: bytes=0-128)` untuk `vidsnap.app/proxy`, pemilihan codec `m4a`/`mp4` otomatis untuk Safari/iOS, **Gambar-dalam-Gambar (PiP)**, **🎧 Mode Headset (Audio Latar Tanpa PiP)**, serta **MediaSession Lock-Screen Controls**.
   - **Tata Letak Responsif Mobile/Desktop & Persistensi Lintas Halaman**: Tampilan Hub Musik dan Floating Popover bebas *offside* di mobile maupun desktop (Mode Terang & Gelap), lengkap dengan **Playlist Pribadi**, **Tonton Nanti**, dan **Auto-Klik ON/OFF**.
5. **Panel Admin Terenkripsi AES-256-GCM (`admin.html`)**:
   - Dilindungi PBKDF2-SHA256 + verifikasi token GitHub PAT.
   - Kelola produk, sub-varian, harga, stok, kategori layanan custom, **kuota pemakaian voucher**, **logo brand**, **tagline/footer**, **biaya layanan**, **kontak & logo sosmed**, **FAQ**, **OpenGraph & Meta Tag Live** (otomatis menyinkronkan `index.html`), **Slide Banner**, bar progres publikasi GitHub, serta **Riwayat Perubahan Terperinci per Aksi (maks 12 log + Restore 1-klik)**.

---

## 📂 Struktur Berkas Utama

```text
├── index.html            # Beranda katalog toko, multi-banner carousel, drawer checkout & FAQ
├── order.html            # Halaman konfirmasi invoice dedikasi & unduh struk Canvas 2D
├── tools.html            # Halaman Menu Utilitas (Sholat, Cuaca, Jam Dunia, Speedtest, Downloader, Kompresor HD)
├── admin.html            # Panel Admin terenkripsi AES-256-GCM (Kendali penuh toko & CMS)
├── BLUEPRINT.md          # Arsitektur teknis lengkap, tujuan proyek, daftar API & storage keys
├── ROADMAP.md            # Pencapaian milestone (Fase 1-7) & rencana fase berikutnya
├── data/
│   ├── catalog.json      # Single Source of Truth katalog, brand, OpenGraph, banners, kategori, voucher & FAQ
│   └── catalog-history.json # Log riwayat perubahan katalog (maks 12 snapshot + rincian aksi)
├── css/                  # Design tokens & responsive styles
├── js/                   # Native ES Modules (store, tools-logic, downloader, compressor, speedtest, music, vault, admin)
└── assets/               # Ikon SVG, gambar banner, logo produk, uploads & og-manifestudio.jpg (1200×630)
```

---

## 🧪 Pengujian & Verifikasi Developer

```bash
# Jalankan seluruh unit test (voucher limits, downloader dual MP4/MP3, weather, compressor, admin history)
npx --yes tsx --test InfoKatalogtMCTomyStudio/js/store.test.mjs

# Build dan Lint proyek
npm run build && npm run lint
```

Detail lengkap mengenai arsitektur, kontrak API gratis, dan pedoman pengembangan lanjutan tersedia pada **`BLUEPRINT.md`** dan **`ROADMAP.md`**.
