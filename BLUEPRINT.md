# Architectural Blueprint & Developer Onboarding — Manifestudio

Dokumen teknis terpadu bagi **Tim IT, Human Developer, maupun AI Coding Agent** untuk memahami, mengelola, memelihara, menguji, dan mengembangkan ekosistem **Manifestudio** (*Static Storefront + Admin Brankas Terenkripsi + Utility Hub + Full-Length Smart Music + Media Compressor HD*).

---

## 1. Tujuan & Filosofi Sistem

1. **Zero-Backend Public Hosting (100% GitHub Pages + Custom Domain Ready)**:
   Seluruh aplikasi berjalan murni di browser (*Static HTML/CSS + Native ES Modules*) dan tayang di **`https://manifestudio.my.id/`** (melalui GitHub Pages + file `CNAME` + Cloudflare DNS HTTPS) tanpa menyewa server VPS/database, dan bebas dari dependensi Replit.
2. **Pemisahan Halaman Clean & Modular**:
   - **Storefront (`index.html`)**: Fokus pada pencarian, filter kategori dinamis, banner carousel yang dapat diatur Admin, belanja cepat, & validasi voucher ketat berkuota.
   - **Order Konfirmasi (`order.html`)**: Halaman invoice terpisah + HTML5 Canvas struk JPEG `< 60 KB` + WhatsApp handoff bebas catatan palsu.
   - **Menu Utilitas (`tools.html`)**: Halaman terpisah untuk utilitas harian (`?tab=prayer | weather | worldclock | speedtest | downloader | compressor`) yang ditonjolkan melalui kartu aksen `#utilities-callout-card` (`assets/icons/menu-utilitas.svg`) di atas filter kategori, lengkap dengan tombol kembali ke katalog.
   - **Panel Admin (`admin.html`)**: Halaman *unlisted* (`noindex`) terenkripsi AES-256-GCM yang mempublikasikan perubahan katalog, aset upload, OpenGraph `index.html`, dan riwayat perubahan terperinci langsung via GitHub REST API.
3. **Kualitas Pengalaman Mobile-First, Presisi Tinggi, & Ad-Free**:
   - Semua kontrol responsif di layar HP (`360px–430px`) maupun desktop (`1440px`), menggunakan *Network-First Service Worker* (`manifestudio-cache-v37`) + query cache-busting `?v=37` agar pembaruan langsung muncul di perangkat mobile pengguna.
   - Pemutar musik YT Music open-source bebas iklan dapat digeser bebas, mendukung pencarian lengkap seluruh katalog YouTube / YouTube Music (Indonesia & internasional, hingga 26 lagu per kueri), memutar lagu viral Indonesia full-length (`>= 75 detik`, bebas preview 30 detik) secara acak otomatis tiap kali tombol ditekan, tetap berputar tanpa henti saat pindah tab / keluar browser / layar mati berkat *Silent-Hold Audio Bridge* + *auto-upgrade* ke native `<audio>`, mendukung Gambar-dalam-Gambar (PiP) & Mode Headset, dan dilengkapi Hub lengkap di Menu Utilitas.

---

## 2. Peta Arsitektur Berkas

| Modul / Berkas | Tanggung Jawab Utama | Ketergantungan |
|---|---|---|
| `index.html` + `js/app.js` | Storefront katalog, carousel banner dinamis, kategori dinamis, modal varian, drawer checkout, voucher tracking | `data.js`, `store.js`, `pwa.js`, `music.js` |
| `order.html` + `js/order.js` + `js/receipt.js` | Invoice bersih + HTML5 Canvas Struk JPEG `< 60 KB` + format WA Order (tanpa voucher invalid) | `data.js`, `store.js`, `music.js` |
| `admin.html` + `js/admin.js` + `js/vault.js` | Gate AES-256-GCM + PBKDF2, edit produk/varian/urutan/logo/brand/tagline/biaya layanan/sosmed/FAQ/voucher limits/OpenGraph/banner, riwayat itemized + restore 12 log | `data.js`, `store.js`, `vault.js` |
| `tools.html` + `js/tools-page.js` + `js/tools-ui.js` + `js/tools-logic.js` | Router sub-tab `Menu Utilitas`, pure math & domain logic, UI bar progres konversi & download, Hub Pemutar Musik YT lengkap | `location.js`, `globe.js`, `speedtest.js`, `downloader.js`, `compressor.js`, `music.js` |
| `js/location.js` | Geolocation GPS prioritas utama + reverse geocode Kelurahan/Kecamatan + fallback IP + autocomplete kota | `tools-logic.js` |
| `js/globe.js` | Canvas 2D orthographic rotatable 3D globe + klik target negara + auto-rotate | `tools-logic.js` |
| `js/speedtest.js` | Speedometer 60fps + ukur Ping/Jitter/DL/UL Cloudflare CDN (berbobot berkelanjutan) + telemetri perangkat | `tools-logic.js` |
| `js/downloader.js` | Adapter paralel TikTok (4-node Tioo/TikWM/Cobalt/DavidCyril), YouTube (Cobalt + 4-node Tioo + Siputzx Ummy + vidsnap CORS proxy + Wave 2 audio retry + DavidCyril + ekstrak WAV client-side), IG (`Siputzx sssinstagram` + `Ummy` + Cobalt + Tioo + `fastdl`/`igram` fallback), FB + streaming download progress | `tools-logic.js` |
| `js/compressor.js` | Kompresor Foto & Video HD Zero-Loss (binary EXIF/PNG/MP4 atom stripper & Social Shield encoder) | `tools-logic.js` |
| `js/music.js` + `js/music-logic.js` | Floating dock minimalis modern draggable, YT Music API open-source (Siputzx YT Search nested duration parser + Ummy Range probe + 30 full-length seed tracks), Silent-Hold Audio Bridge + auto-upgrade `yt-iframe` ke `<audio>` untuk background playback anti-mati, pemblokir preview 30 detik, PiP + Mode Headset, Fisher-Yates auto-shuffle prioritas Viral Indonesia tiap tombol ditekan | YouTube IFrame API / Audius / Siputzx |
| `data/catalog.json` & `data/catalog-history.json` | Single Source of Truth produk, brand, OpenGraph, banners, kategori, voucher usage limits, FAQ & 12 snapshot riwayat | Service Worker Network-First |
| `sw.js` + `manifest.webmanifest` | Network-First code/data cache (`manifestudio-cache-v37`) & instalasi PWA | — |
| `CNAME` | Konfigurasi domain kustom resmi GitHub Pages (`manifestudio.my.id`) — jangan dihapus | Cloudflare DNS |

---

## 3. Registri Integrasi API Eksternal (Gratis & CORS-Enabled)

Semua integrasi pihak ketiga berjalan murni *client-side* tanpa API key rahasia:

1. **Jadwal Sholat Indonesia**:
   - **Primary (Presisi Koordinat Kecamatan/Kelurahan)**: `https://api.aladhan.com/v1/timings/{DD}-{MM}-{YYYY}?latitude=...&longitude=...&method=20` (Metode Kemenag RI).
   - **Fallback (Kota/Kabupaten)**: `https://api.myquran.com/v2/sholat/kota/semua` & `/jadwal/{cityId}/{YYYY}/{MM}/{DD}` (Bimas Islam Kemenag RI).
2. **Prakiraan Cuaca Presisi Tinggi & Geocoding**:
   - **Cuaca**: `https://api.open-meteo.com/v1/forecast` (`current` termasuk `rain`/`showers`/`wind_gusts_10m`, `hourly`, 7-day `daily`) + pengamatan stasiun lokal (`wttr.in`).
   - **Cari Wilayah/Kecamatan**: `https://nominatim.openstreetmap.org/search`, `https://photon.komoot.io/api/`, & `https://geocoding-api.open-meteo.com/v1/search`.
3. **Deteksi Lokasi GPS + Reverse Geocode & Fallback IP**:
   - **Reverse Geocode Detail**: `https://nominatim.openstreetmap.org/reverse`, `https://api-bdc.io/data/reverse-geocode-client`, & `https://photon.komoot.io/reverse`.
   - **IP Fallback**: `https://ipwho.is/`.
4. **Speedtest Internet**:
   - **CDN Info**: `https://speed.cloudflare.com/cdn-cgi/trace` & `https://speed.cloudflare.com/meta`.
   - **Bandwidth & Latency**: `https://speed.cloudflare.com/__down?bytes=...` & `https://speed.cloudflare.com/__up`.
5. **Pemutar Musik YT Music API Komunitas Open-Source & Shuffled Viral Indonesia Full-Length**:
   - **Open-Source Community API**: `https://api.siputzx.my.id/api/s/youtube` (mendukung ekstraksi objek durasi bersarang `{ seconds, timestamp }` & pelestarian hasil lirik/judul terjemahan YouTube), `https://api.siputzx.my.id/api/d/ummy`, & `https://api.audius.co/v1/tracks` (CORS-enabled, full-length `>= 75s`, memblokir preview singkat 30 detik).
   - **Mesin Pemutar Hibrida Native `<audio>` + YouTube IFrame**: Memutar stream penuh di latar belakang/layar mati + fallback instan YouTube IFrame untuk video penuh.
   - **Gambar-dalam-Gambar (PiP) & Mode Headset**: Jendela PiP mengambang dengan tombol 🎧 Mode Headset untuk menyembunyikan PiP sambil menjaga lagu tetap berputar.
   - **Dua Tampilan Tersinkron**: Panel lengkap informatif di Menu Utilitas (`tools.html?tab=music`) dan floating dock minimalis modern (`js/music.js`).
6. **Sosmed Media Downloader All-in-One**:
   - **TikTok (Video No-WM/MP3/Photo Carousel)**: Failover paralel 4 node `https://backend1..4.tioo.eu.org/ttdl`, `https://www.tikwm.com/api/?url=...&hd=1`, `https://cobaltapi.cjs.nz/`, fallback `https://apis.davidcyriltech.my.id/download/tiktok`.
   - **YouTube (Dual Video MP4 & Audio M4A/MP3/WAV)**: Paralel `https://www.youtube.com/oembed`, `https://api.siputzx.my.id/api/d/ummy` (MP4 + M4A), `https://cobaltapi.cjs.nz/` (video + audio MP3 terpisah), failover 4 node `https://backend1..4.tioo.eu.org/youtube` (+ Wave 2 audio retry & pembungkusan stream `googlevideo.com` via `https://api.vidsnap.app/proxy?u=...` yang lolos CORS serta pemblokiran redirect `sf-converter.com`), fallback ganda `https://apis.davidcyriltech.my.id/download/ytmp4` + `/ytmp3`, serta ekstraksi audio `.wav` client-side (`AudioContext`).
   - **Facebook (HD/SD/MP3/Photo/Story)**: `https://cobaltapi.cjs.nz/`, `https://apis.davidcyriltech.my.id/facebook`, & failover 4 node `https://backend1..4.tioo.eu.org/fbdown`.
   - **Instagram (Reels/Photo/Carousel/Story/Caption)**: Paralel **`https://api.siputzx.my.id/api/d/sssinstagram`**, **`https://api.siputzx.my.id/api/d/ummy`**, `https://cobaltapi.cjs.nz/`, & 4-node `tioo.eu.org/igdl`, dengan fallback `siputzx/fastdl`, `siputzx/igram`, dan `davidcyriltech/instagram`.

---

## 4. Registri Kunci Penyimpanan Browser

| Kunci Storage | Penyimpanan | Isi / Struktur |
|---|---|---|
| `manifestudio_cart_v1` | `localStorage` | Item keranjang aktif |
| `manifestudio_theme_v1` | `localStorage` | `'dark'` atau `'light'` |
| `manifestudio_used_vouchers_v1` | `localStorage` | Map jumlah pemakaian per kode voucher `{ CODE: count }` (migrasi otomatis dari array lama) |
| `manifestudio_pending_order_v1` | `sessionStorage` + `localStorage` | Snapshot handoff menuju `order.html` |
| `manifestudio_admin_vault_v1` | `localStorage` | Kredensial GitHub terenkripsi AES-256-GCM |
| `manifestudio_catalog_preview_v1` | `localStorage` | Draft lokal admin sebelum publish ke GitHub |
| `manifestudio_catalog_history_v1` | `localStorage` | Riwayat perubahan katalog terperinci (maks 12 log, auto-prune) |
| `manifestudio_pwa_installed_v1` | `localStorage` | Flag status instalasi PWA |
| `manifestudio_pwa_dismissed_v1` | `localStorage` | Timestamp penolakan banner PWA |
| `manifestudio_user_location_v1` | `localStorage` | Lokasi terakhir (GPS / IP / manual) untuk Sholat & Cuaca |
| `manifestudio_weather_cal_v1` | `localStorage` | Kalibrasi cuaca aktual lokal pengguna (auto-expire 3 jam) |
| `manifestudio_music_library_v1` | `localStorage` | Daftar `watchLater` (Tonton Nanti) dan `playlists` pribadi pengguna |
| `manifestudio_music_stream_cache_v2` | `localStorage` | Cache URL stream audio full-length terverifikasi (bebas preview 30 detik) |
| `manifestudio_music_headset_v1` | `localStorage` | Status Mode Headset (`true` / `false`) untuk audio latar tanpa PiP |
| `manifestudio_music_session_v1` | `sessionStorage` + `localStorage` | Status `explicitPaused`, `wasPlaying`, `lastTrackId`, & `currentTime` lintas halaman |
| `manifestudio_music_clickplay_v1` | `localStorage` | Preferensi toggle Auto-Klik musik (`true` / `false`) |
| `manifestudio_music_pos_v2` | `localStorage` | Koordinat `(x, y)` ikon musik hasil geser pengguna |

---

## 5. Aturan Teknis Kritis untuk Pengembang Berikutnya

1. **Path Relatif vs OpenGraph Absolut**:
   - Seluruh aset di HTML/JS/CSS (`img`, `script`, `fetch`) **wajib** memakai path relatif `./`.
   - Tag **OpenGraph & Canonical (`og:url`, `og:image`, `og:image:secure_url`, `twitter:image`, Schema.org)** **wajib** memakai URL absolut HTTPS lengkap menuju `https://manifestudio.my.id/...` agar pratinjau WhatsApp/Telegram tampil penuh.
   - Jangan pernah menghapus file `CNAME` (`manifestudio.my.id`).
2. **Cache-Busting Konsisten (`sw.js` & `?v=N`)**:
   - Setiap kali mengubah JS/CSS/HTML, naikkan `CACHE_NAME` di `sw.js` **dan** `CURRENT_CACHE` + query `?v=N` pada seluruh HTML (`index.html`, `tools.html`, `order.html`, `admin.html`) dan import ES module terkait agar browser mobile tidak menahan cache usang.
3. **Dokumentasi & Verifikasi Wajib Sebelum Push**:
   - Setiap pembaruan fitur wajib memperbarui `ROADMAP.md`, `README.md`, dan `BLUEPRINT.md`.
   - Jalankan `npx --yes tsx --test InfoKatalogtMCTomyStudio/js/store.test.mjs`, `npm run build && npm run lint`, serta uji UI desktop + mobile (`playwright-cli`) bebas error dan overflow (`scrollWidth <= innerWidth`), lalu langsung push ke `origin/main`.
