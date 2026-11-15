# Manifestudio — Web Katalog, Transaksi & Panel Admin Statis

Katalog web statis resmi **Manifestudio** (dikelola oleh tMC Tomy Studio) untuk pemesanan akun premium dan layanan digital bergaransi. Dirancang 100% kompatibel dengan **GitHub Pages (Zero-Backend)** serta mendukung instalasi **Progressive Web App (PWA)** dengan modul native JavaScript ES Modules.

---

## 🌟 Fitur Utama

- **Katalog Interaktif Bergaya Toko Top-Up**:
  - Banner promosi ringkas dan elegan tanpa mengaburkan pemilihan produk.
  - Grid produk 5 kolom responsif dengan kartu logo dan indikator harga termurah.
  - Pencarian real-time, filter kategori, dan filter ketersediaan stok.
- **Pemesanan Mandiri & Konfirmasi Dedikasi (`order.html`)**:
  - Alur checkout dari drawer langsung mengarahkan pengguna ke halaman rincian pesanan khusus (`order.html`).
  - Keranjang belanja di beranda otomatis dikosongkan setelah checkout agar bersih saat pelanggan kembali membuat pesanan baru.
  - Tata letak invoice bersih tanpa tulisan berlebih; tombol aksi WhatsApp dan unduh struk tersusun rapi di bawah rincian Total Bayar.
- **Struk Belanja HTML5 Canvas (Tema Anime & Standar Nasional)**:
  - Generator struk otomatis berbasis Canvas 2D (`js/receipt.js`) berestetika anime modern beraksen cyber-violet dan stempel "VERIFIKASI ADMIN".
  - Memuat rincian standar nasional: nomor invoice unik `MS-YYMMDD-HHMMSS`, rincian paket, subtotal, diskon belanja, biaya layanan, dan kontak CS.
  - File output JPEG ultra-ringan (~35–45 KB) yang otomatis terunduh saat menekan tombol WhatsApp atau unduh struk.
- **Transparansi Metode Pembayaran**:
  - `Bayar Sekarang`: 0% biaya tambahan.
  - `Bayar Nanti (Setelah Akun Diterima)`: biaya layanan tambahan **+10%** dihitung secara otomatis dan transparan.
- **Sistem Voucher Sekali Pakai (*One-Time Use Vouchers*)**:
  - Mendukung potongan tetap (Rp) dan persentase (%) dengan batas minimum belanja.
  - Voucher yang telah dicheckout otomatis dicatat di `localStorage` (`manifestudio_used_vouchers_v1`) agar tidak bisa digunakan berulang kali di perangkat yang sama.
- **Panel Admin Terenkripsi Tanpa Edit Kode (`admin.html`)**:
  - Halaman *unlisted* yang dilindungi layar kunci **AES-256-GCM + PBKDF2-SHA256 (100.000 iterasi)**.
  - Verifikasi otomatis izin tulis (*Push*) token GitHub PAT.
  - Edit harga, ubah nama paket, tambah/hapus varian, tambah produk baru, hapus produk, toggle stok habis, dan kelola voucher langsung dari browser.
  - **Fitur Upload Logo File**: Memungkinkan admin memilih file logo gambar langsung dari memori HP/PC untuk setiap produk yang sudah ada maupun produk baru.
  - Sinkronisasi dua arah langsung ke `data/catalog.json` via GitHub Contents REST API.
- **PWA Lengkap**:
  - Banner install fleksibel dengan opsi minimize ke dock melayang (`−`) atau sembunyikan (`×`).
  - Cache offline menggunakan Service Worker (`sw.js`).

---

## 📂 Struktur Berkas Proyek

```text
├── index.html                 # Halaman utama storefront, modal varian, & drawer checkout
├── order.html                 # Halaman konfirmasi pesanan dedikasi & pratinjau struk
├── admin.html                 # Panel Admin terenkripsi AES-256-GCM untuk manajemen katalog
├── manifest.webmanifest       # Konfigurasi instalasi PWA
├── sw.js                      # Service Worker (caching offline & Network-First untuk catalog.json)
├── ROADMAP.md                 # Peta pengembangan & panduan arsitektur developer
├── README.md                  # Dokumentasi proyek
├── data/
│   └── catalog.json           # Sumber data tunggal katalog publik, varian, voucher, & FAQ
├── css/
│   ├── tokens.css             # Desain token (warna, font, spacing, radius, tema gelap/terang)
│   └── styles.css             # Styling responsif seluruh komponen aplikasi
├── js/
│   ├── app.js                 # Orkestrasi interaksi storefront beranda & drawer checkout
│   ├── order.js               # Handler halaman konfirmasi pesanan, unduh struk & WhatsApp handoff
│   ├── admin.js               # Logika Panel Admin, upload logo file, & GitHub REST API sync
│   ├── data.js                # Loader catalog.json dengan dukungan pratinjau lokal & fallback
│   ├── store.js               # Logika murni bisnis (keranjang, diskon, voucher, fee 10%, formatter)
│   ├── store.test.mjs         # Unit test suite logika bisnis menggunakan node:test
│   ├── receipt.js             # Canvas 2D generator struk belanja tema anime & invoice resmi
│   ├── vault.js               # Modul Web Crypto API (PBKDF2-SHA256 + AES-256-GCM) & verifikasi token
│   └── pwa.js                 # Handler siklus hidup instalasi PWA & mode dock melayang
└── assets/
    ├── icons/                 # Favicon dan ikon PWA
    ├── images/                # Banner promosi dan gambar ilustrasi
    └── logos/                 # Logo SVG bawaan berbagai layanan (Netflix, Canva, YouTube, dll)
```

---

## 🧪 Pengujian Unit & Verifikasi

Proyek ini dilengkapi dengan unit test tanpa dependensi eksternal (menggunakan standard runner bawaan Node.js):

```bash
# Menjalankan unit test logika belanja, voucher, dan brankas kriptografi
node --test .repos/InfoKatalogtMCTomyStudio/js/store.test.mjs
```

---

## 🔑 Kunci Penyimpanan Lokal (Local Storage Keys)

| Kunci Storage | Lokasi | Keterangan |
|---|---|---|
| `manifestudio_cart_v1` | `localStorage` | Daftar item di dalam keranjang belanja |
| `manifestudio_theme_v1` | `localStorage` | Preferensi mode tampilan (`dark` / `light`) |
| `manifestudio_used_vouchers_v1` | `localStorage` | Riwayat voucher sekali pakai yang sudah dicheckout |
| `manifestudio_pending_order_v1` | `sessionStorage` | Snapshot pesanan aktif yang ditransfer ke `order.html` |
| `manifestudio_admin_vault_v1` | `localStorage` | Kredensial PAT GitHub admin terenkripsi AES-256-GCM |
| `manifestudio_catalog_preview_v1`| `localStorage` | Data pratinjau lokal admin sebelum dipublikasikan |

---

## 💡 Panduan Untuk Pengembang (Developer / AI Assistant)

1. **Path Relatif**: Selalu gunakan path relatif berawalan `./` pada seluruh tag HTML, skrip, impor JS, dan CSS agar aplikasi tidak rusak saat dihosting di subfolder GitHub Pages.
2. **Tanpa Build Step Wajib**: File JavaScript dijalankan langsung oleh browser sebagai Native ES Modules (`type="module"`).
3. **Ukuran Canvas Struk**: Generator `js/receipt.js` harus selalu menghasilkan file JPEG di bawah 60 KB agar ringan diunduh pada koneksi seluler.
4. **Detail Lengkap Roadmap**: Rujuk berkas `ROADMAP.md` untuk melihat status milestone dan instruksi pengembangan fase berikutnya.
