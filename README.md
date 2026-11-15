# Manifestudio — Storefront Katalog Digital, Utility Hub & Panel Admin Statis

Platform web statis resmi **Manifestudio** (tMC Tomy Studio) berbasis **100% Static HTML/CSS + Native ES Modules (GitHub Pages & PWA Ready)** yang memadukan katalog akun premium, konfirmasi pesanan WhatsApp + struk Canvas 2D, Panel Admin terenkripsi AES-256-GCM, pemutar musik *full version* bebas iklan, serta halaman utilitas terpisah **Menu Lainnya**.

---

## 🌟 Fitur Utama

1. **Katalog Top-Up Modern & Multi-Banner Geser**:
   - 6 slide banner interaktif (promo katalog, Jadwal Sholat, Cuaca, Jam Dunia, Speedtest, & Downloader).
   - Grid produk responsif (5 kolom desktop → 2 kolom mobile), pencarian instan, filter kategori & stok, serta *FAQ* ringkas.
2. **Checkout Bersih, Bayar Nanti (+10%), & Struk JPEG Ringan (`order.html`)**:
   - Skema *Bayar Sekarang (0%)* dan *Bayar Nanti (+10%)* transparan + voucher sekali pakai.
   - Generator struk belanja HTML5 Canvas 2D (`MS-YYMMDD-HHMMSS`) `< 60 KB` + kirim WhatsApp 1-klik.
3. **Menu Lainnya — Halaman Utilitas Terpisah (`tools.html`)**:
   - **Jadwal Sholat Indonesia**: Resmi Kemenag RI (MyQuran v2 + AlAdhan method=20), prioritas GPS → fallback IP → cari kota.
   - **Prakiraan Cuaca**: Suhu, angin, hujan per jam & 7 hari (Open-Meteo).
   - **Jam Dunia & Globe 3D Interaktif**: Waktu UTC internasional, konversi WIB/WITA/WIT, dan globe yang dapat diputar serta diklik per negara target.
   - **Speedtest Internet**: Meter kecepatan real-time 60fps, ping, jitter, loaded latency, download/upload (Cloudflare Speed Edge), info server, ISP, dan perangkat.
   - **Downloader Video Tanpa Watermark**: TikTok HD/SD/MP3 No Watermark, YouTube MP4/MP3, Facebook HD/SD, dan Instagram Reels/Post.
4. **Pemutar Musik Pintar Full Version (Bebas Iklan & Draggable)**:
   - Ikon musik melayang dapat digeser ke posisi mana pun dan posisinya tersimpan.
   - Mendukung mode **Full Audio** (lagu versi penuh `>= 75 detik` Viral Indonesia/DJ/Cover via Audius), **SoundCloud Player**, dan **Spotify Embed Player**.
   - Auto-play cerdas mengikuti kata kunci pencarian dan lagu favorit pengguna.
5. **Panel Admin Terenkripsi AES-256-GCM (`admin.html`)**:
   - Dilindungi PBKDF2-SHA256 + verifikasi token GitHub PAT.
   - Kelola nama layanan, sub-varian, harga, stok, voucher, urutan produk, upload/link logo (hapus file upload lama otomatis), progress bar real-time, dan **Riwayat Perubahan (maks 12 log) + Restore**.

---

## 📂 Struktur Berkas Utama

```text
├── index.html            # Beranda katalog toko, 6-slide banner, drawer checkout & FAQ
├── order.html            # Halaman konfirmasi invoice dedikasi & unduh struk
├── tools.html            # Halaman Menu Lainnya (Sholat, Cuaca, Jam Dunia, Speedtest, Downloader)
├── admin.html            # Panel Admin terenkripsi AES-256-GCM
├── BLUEPRINT.md          # Arsitektur teknis lengkap, daftar API, & storage keys untuk developer/AI
├── ROADMAP.md            # Pencapaian milestone (Fase 1-5) & rencana fase berikutnya
├── data/catalog.json     # Database katalog produk, varian, voucher & FAQ
├── css/                  # Design tokens & responsive styles
├── js/                   # Native ES Modules (store, tools, music, downloader, speedtest, vault, admin)
└── assets/               # Ikon SVG, gambar banner, logo produk & og-manifestudio.jpg (1200×630)
```

---

## 🧪 Pengujian & Verifikasi Developer

```bash
# Jalankan seluruh unit test logika bisnis, kriptografi, jam dunia, globe, musik & downloader
node --test InfoKatalogtMCTomyStudio/js/store.test.mjs
```

Detail lengkap mengenai arsitektur, kontrak API gratis, dan pedoman pengembangan lanjutan tersedia pada **`BLUEPRINT.md`** dan **`ROADMAP.md`**.
