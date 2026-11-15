# Roadmap & Peta Pengembangan Proyek Manifestudio

Dokumen ini adalah panduan resmi arsitektur, riwayat implementasi, serta arah pengembangan selanjutnya bagi pengembang berikutnya (**manusia maupun AI**) untuk memudahkan **pemeliharaan (maintenance), pengembangan fitur baru, perbaikan bug, dan pengelolaan proyek** pada repositori statis **Manifestudio** (GitHub Pages + PWA).

---

## 🗺️ Gambaran Umum Arsitektur (Architectural Blueprint)

Manifestudio dibangun dengan filosofi **Ultra-Lightweight Static Web Application**:
1. **100% Kompatibel GitHub Pages (Zero-Backend Hosting)**:
   - Tidak memerlukan server Node.js/PHP/Python saat rilis publik. Seluruh aplikasi berjalan di sisi browser klien (*client-side*).
   - Seluruh tautan aset (`img`, `script`, `link`, `fetch`) **wajib menggunakan path relatif `./`** agar tidak rusak saat dihosting pada sub-path repositori (contoh: `username.github.io/repo-name/`).
2. **Modular Vanilla ES Modules (Zero Build Tools Dependency)**:
   - Menggunakan native JavaScript ES Modules (`import`/`export`) langsung di browser tanpa bundler rumit (Webpack/Vite) agar mudah di-edit langsung via web/GitHub.
3. **Penyimpanan Terdesentralisasi & Aman**:
   - Data katalog publik tersimpan di `data/catalog.json`.
   - Modifikasi katalog dilakukan melalui `admin.html` yang terenkripsi lokal menggunakan **Web Crypto API (AES-256-GCM + PBKDF2)** dan dipublikasikan via GitHub Contents REST API.
   - Transaksi handoff dari keranjang ke halaman konfirmasi menggunakan snapshot `sessionStorage` / `localStorage`.

---

## 📌 Registri Kunci Penyimpanan Browser (Storage Keys Registry)

Semua developer wajib merujuk ke registri kunci berikut agar tidak terjadi konflik atau kebocoran data:

| Kunci Storage | Tempat | Tujuan & Format Data |
|---|---|---|
| `manifestudio_cart_v1` | `localStorage` | Array item keranjang aktif: `[{ productId, productName, variantId, variantName, price, quantity }]` |
| `manifestudio_theme_v1` | `localStorage` | Preferensi tema: `'dark'` atau `'light'` |
| `manifestudio_used_vouchers_v1` | `localStorage` | Array kode voucher yang sudah pernah dicheckout (sekali pakai): `['HEMAT2K', 'PROMO10']` |
| `manifestudio_pending_order_v1` | `sessionStorage` (fallback `localStorage`) | Objek snapshot pesanan aktif untuk dirender di `order.html` |
| `manifestudio_admin_vault_v1` | `localStorage` | Brankas kredensial GitHub terenkripsi format JSON: `{ v: 1, alg: 'AES-GCM-256', salt, iv, ct }` |
| `manifestudio_catalog_preview_v1` | `localStorage` | Pratinjau lokal katalog sementara sebelum dipublikasikan ke GitHub |
| `manifestudio_pwa_installed_v1` | `localStorage` | Flag penanda status install PWA |
| `manifestudio_pwa_dismissed_v1` | `localStorage` | Timestamp penolakan banner install PWA |

---

## 🚦 Status Pencapaian Fase (Milestones)

### ✅ Fase 1 — Fondasi Katalog & Arsitektur Statis (Selesai)
- [x] Struktur modular ES Modules (`data.js`, `store.js`, `receipt.js`, `pwa.js`, `app.js`).
- [x] Mode Gelap/Terang persisten dengan sinkronisasi `meta[name="theme-color"]`.
- [x] PWA Lengkap: Web App Manifest (`manifest.webmanifest`), Service Worker offline-cache (`sw.js`), banner install responsif dengan dock melayang.
- [x] Unit Test suite komprehensif menggunakan standard library `node:test` (`js/store.test.mjs`).

### ✅ Fase 2 — Drawer Checkout, Skema Bayar Nanti, & Struk HTML5 Canvas (Selesai)
- [x] Drawer pemesanan interaktif dengan pencegahan layout shift & scroll bouncing.
- [x] Skema opsi pembayaran:
  - *Bayar Sekarang*: 0% biaya tambahan.
  - *Bayar Nanti (Setelah Akun Diterima)*: Otomatis menghitung biaya layanan transparan **+10%**.
- [x] Sistem voucher fleksibel (potongan tetap Rp / persentase) dengan validasi minimal belanja.
- [x] Generator struk otomatis berbasis HTML5 Canvas 2D yang menghasilkan gambar JPEG berkualitas tinggi namun ultra-ringan (~35–50 KB).

### ✅ Fase 3 — Panel Admin Brankas Terenkripsi & Sinkronisasi GitHub (Selesai)
- [x] Pemisahan basis data katalog ke `data/catalog.json` dengan strategi caching *Network-First* di Service Worker.
- [x] Halaman `admin.html` berstatus *unlisted* (tersembunyi dari navigasi umum toko).
- [x] Perlindungan Brankas Admin menggunakan standar kriptografi perbankan **AES-256-GCM** dengan derivasi kunci **PBKDF2-SHA256 (100.000 iterasi)**.
- [x] Verifikasi izin tulis (*Push/Write permission*) token GitHub PAT sebelum enkripsi disimpan.
- [x] Fitur Admin: Toggle stok habis/tersedia, ubah harga, hapus varian, tambah varian baru, tambah produk baru, hapus produk, serta kelola kode voucher.
- [x] Sinkronisasi katalog dua arah: *Muat Ulang dari GitHub*, *Simpan Pratinjau Lokal*, *Unduh JSON*, dan *Simpan & Publikasikan ke GitHub* via REST API.

### ✅ Fase 4 — UX Top-Up Store, Alur Pemisahan Order & Voucher Sekali Pakai (Selesai)
- [x] **Desain Beranda Kompak (Gaya Toko Top-Up Modern / Codashop)**:
  - Banner hero disederhanakan menjadi strip promo ringkas bergradien futuristik.
  - Grid produk 5 kolom responsif dengan kartu panggung logo produk dan label harga awal yang menonjol.
- [x] **Pemisahan Halaman Konfirmasi Pesanan Dedikasi (`order.html`)**:
  - Alur checkout dari drawer langsung mengarahkan ke `order.html`.
  - Keranjang belanja di `index.html` otomatis dikosongkan setelah pesanan dibuat sehingga tidak tertinggal saat membuka toko kembali.
  - Penataan tata letak profesional: Tombol aksi utama (*Kirim Pesanan ke WhatsApp Admin*, *Unduh Struk (.jpg)*, *Salin Teks*) diposisikan tepat di bawah rincian Total Bayar.
  - Menghapus teks instruksi yang redundant agar invoice bersih, minimalis, dan profesional.
- [x] **Struk Belanja Standar Nasional & Tema Anime**:
  - Desain struk diperbarui dengan estetika anime modern beraksen cyber-violet, label `★ ANIME STORE EDITION ★`, font monospace tech, kode referensi resmi `MS-YYMMDD-HHMMSS`, rincian faktur itemized, stempel status "VERIFIKASI ADMIN", barcode dekoratif, dan kontak WhatsApp CS resmi.
- [x] **Voucher Promo Sekali Pakai (*One-Time Use Vouchers*)**:
  - Kode voucher yang telah dicheckout otomatis ditandai di `manifestudio_used_vouchers_v1` sehingga pelanggan tidak dapat menggunakan voucher yang sama berulang kali.
- [x] **Fitur Upload & Ganti Logo Produk di Admin Panel**:
  - Disediakan input unggah file gambar (`<input type="file" accept="image/*">`) untuk setiap produk yang sudah ada maupun form produk baru. Gambar langsung diubah menjadi Data URL Base64 atau URL path tanpa perlu upload manual ke hosting lain.

---

## 🚀 Rencana Fase Selanjutnya (Future Roadmap)

Pengembang berikutnya disarankan memprioritaskan fitur-fitur berikut:

### 🔹 Fase 5 — Riwayat Transaksi & Layanan Mandiri Pelanggan (Prioritas Utama)
1. **Riwayat Pesanan Pelanggan (Customer Order History)**:
   - Simpan hingga 10 riwayat transaksi terakhir di browser pelanggan menggunakan `localStorage` / IndexedDB.
   - Tambahkan menu *Riwayat Pesanan* di header/footer untuk melihat kembali status pesanan dan mengunduh ulang struk belanja kapan saja.
2. **Tampilan QRIS Statis / Rekening Bank Dinamis**:
   - Menampilkan modal popup kode QRIS atau nomor rekening resmi saat pelanggan memilih metode *Bayar Sekarang*, dilengkapi tombol *Salin Nomor Rekening* yang memudahkan transfer.
3. **Status Tracking Pesanan Sederhana**:
   - Tombol cepat di `order.html`: "Cek Status Pesanan ke Admin" yang memformat pesan chat WhatsApp otomatis untuk menanyakan proses pengerjaan akun.

### 🔹 Fase 6 — Peningkatan Kapabilitas Panel Admin
1. **Kompresi Gambar Logo Otomatis**:
   - Saat admin memilih gambar file resolusi tinggi dari HP (>1 MB), lakukan resize & kompresi canvas otomatis di `js/admin.js` ke ukuran thumbnail 128x128 px WebP/PNG sebelum disimpan ke `catalog.json` guna menghemat ukuran repository.
2. **Pencadangan & Pemulihan Katalog (Backup & Restore)**:
   - Fitur upload file `catalog.json` cadangan langsung di panel admin untuk memulihkan katalog jika terjadi kesalahan pengeditan.
3. **Kategori Produk Kustom**:
   - Memungkinkan admin menambah atau menghapus kategori produk baru secara dinamis selain 4 kategori bawaan.

### 🔹 Fase 7 — Performa & Aksesibilitas Lanjutan
1. **Internasionalisasi (Multi-Bahasa Ringan)**:
   - Tambahkan toggle Bahasa (Indonesia / English) untuk teks katalog dan struk belanja.
2. **Analitik Privasi Ramah Pelanggan**:
   - Integrasi penghitung kunjungan statis tanpa cookie pihak ketiga (seperti GoatCounter atau Cloudflare Web Analytics).

---

## 🛠️ SOP Pemeliharaan & Pengembangan (Developer Maintenance Guide)

### 1. Menjalankan Server Pengembangan Lokal
```bash
# Jalankan dev server Vite/Express
npm run dev
# Akses di browser: http://localhost:3000
```

### 2. Menjalankan Unit Test (Wajib Sebelum Push)
Setiap kali mengubah file di folder `js/` (terutama `store.js`, `vault.js`, `data.js`), jalankan unit test untuk memastikan integritas logika transaksi:
```bash
node --test .repos/InfoKatalogtMCTomyStudio/js/store.test.mjs
```
*Pastikan seluruh 9 pengujian lulus (PASS) tanpa error.*

### 3. Kompilasi & Linter
```bash
npm run build
npm run lint
```

### 4. Menangani Penolakan Git Push (`[rejected] fetch first`)
Jika remote GitHub telah memiliki commit baru yang belum ada di local repository:
1. Klik tombol **`Pull`** pada RepoSync Studio (atau `git pull origin main` di terminal).
2. Tulis pesan commit pada kolom teks commit.
3. Klik **`Commit Perubahan`**.
4. Klik tombol **`Push`** ke remote origin.

### 5. Aturan Penting bagi AI / Developer Berikutnya:
- **Jangan Mengubah Skema Enkripsi Brankas** tanpa menyediakan migrasi untuk record `manifestudio_admin_vault_v1`.
- **Selalu Jaga Format JSON Katalog** agar sesuai dengan struktur schema di `data/catalog.json`.
- **Pertahankan Ukuran Struk Ringan** (<60 KB) saat memodifikasi `js/receipt.js`. Struk harus dapat di-generate dalam waktu <200ms di perangkat mobile spesifikasi rendah.
- **Hindari Dependency NPM Runtime untuk Storefront**: Toko storefront harus selalu dapat berjalan sebagai static files murni di GitHub Pages.
