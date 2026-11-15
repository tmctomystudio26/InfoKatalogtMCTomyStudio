# Architectural Blueprint & Developer Onboarding — Manifestudio

Dokumen teknis terpadu bagi **Tim IT, Human Developer, maupun AI Coding Agent** untuk memahami, mengelola, memelihara, menguji, dan mengembangkan ekosistem **Manifestudio** (*Static Storefront + Admin Brankas Terenkripsi + Utility Hub + Full-Length Smart Music*).

---

## 1. Tujuan & Filosofi Sistem

1. **Zero-Backend Public Hosting (100% GitHub Pages Ready)**:
   Seluruh aplikasi berjalan murni di browser (*Static HTML/CSS + Native ES Modules*) agar bisa langsung rilis di `https://tmctomystudio26.github.io/InfoKatalogtMCTomyStudio/` tanpa menyewa server VPS/database.
2. **Pemisahan Halaman Clean & Modular**:
   - **Storefront (`index.html`)**: Fokus penuh pada pencarian, filter, banner geser Gen-Z, dan belanja cepat ala top-up store.
   - **Order Konfirmasi (`order.html`)**: Halaman invoice terpisah + HTML5 Canvas struk JPEG `< 60 KB` + WhatsApp handoff.
   - **Menu Lainnya (`tools.html`)**: Halaman terpisah untuk utilitas harian (`?tab=prayer | weather | worldclock | speedtest | downloader`) dengan tombol kembali ke katalog.
   - **Panel Admin (`admin.html`)**: Halaman *unlisted* (`noindex`) terenkripsi AES-256-GCM yang mempublikasikan perubahan katalog langsung ke `data/catalog.json` via GitHub REST API.
3. **Kualitas Pengalaman Mobile-First & Ad-Free**:
   - Semua kontrol grid responsif di layar HP (`360px–430px`) maupun desktop (`1440px`).
   - Pemutar musik bebas iklan dapat digeser bebas dan memutar lagu versi penuh (*Full Version*).

---

## 2. Peta Arsitektur Berkas

| Modul / Berkas | Tanggung Jawab Utama | Ketergantungan |
|---|---|---|
| `index.html` + `js/app.js` | Storefront katalog, 6-slide carousel, kategori, modal varian, drawer checkout | `data.js`, `store.js`, `pwa.js`, `music.js` |
| `order.html` + `js/order.js` + `js/receipt.js` | Invoice bersih + HTML5 Canvas Struk JPEG `< 60 KB` + format WA Order | `store.js`, `music.js` |
| `admin.html` + `js/admin.js` + `js/vault.js` | Gate AES-256-GCM + PBKDF2, edit nama/harga/urutan/logo, riwayat + restore 12 log, progress bar publikasi GitHub | `data.js`, `store.js`, `vault.js` |
| `tools.html` + `js/tools-page.js` + `js/tools-ui.js` + `js/tools-logic.js` | Router sub-tab `Menu Lainnya`, pure math & domain logic | `location.js`, `globe.js`, `speedtest.js`, `downloader.js`, `music.js` |
| `js/location.js` | Geolocation GPS prioritas utama + fallback IP geolocation + cache + autocomplete kota | `tools-logic.js` |
| `js/globe.js` | Canvas 2D orthographic rotatable 3D globe + klik target negara + auto-rotate | `tools-logic.js` |
| `js/speedtest.js` | Speedometer 60fps + ukur Ping/Jitter/DL/UL Cloudflare CDN + telemetri perangkat | `tools-logic.js` |
| `js/downloader.js` | Adapter TikTok No-Watermark, YouTube MP4/MP3, Facebook HD/SD, & Instagram Reels/Post | `tools-logic.js` |
| `js/music.js` + `js/music-logic.js` | Widget musik draggable, algoritma preferensi pencarian & play, **Full Audio** (Audius), **SoundCloud Widget**, **Spotify Embed** | Audius / SoundCloud Widget / Spotify |
| `data/catalog.json` | Sumber kebenaran (*Single Source of Truth*) katalog produk, urutan posisi, logo, voucher, dan FAQ | Service Worker Network-First |
| `sw.js` + `manifest.webmanifest` | Offline cache asset (`manifestudio-cache-v10`) & instalasi PWA | — |

---

## 3. Registri Integrasi API Eksternal (Gratis & CORS-Enabled)

Semua integrasi pihak ketiga berjalan murni *client-side* tanpa API key rahasia:

1. **Jadwal Sholat Indonesia**:
   - **Primary**: `https://api.myquran.com/v2/sholat/kota/semua` & `/jadwal/{cityId}/{YYYY}/{MM}/{DD}` (Bimas Islam Kemenag RI).
   - **Fallback**: `https://api.aladhan.com/v1/timings/{DD}-{MM}-{YYYY}?latitude=...&longitude=...&method=20` (Metode Kemenag RI).
2. **Prakiraan Cuaca & Geocoding**:
   - **Cuaca**: `https://api.open-meteo.com/v1/forecast` (current, hourly, 7-day daily).
   - **Cari Kota**: `https://geocoding-api.open-meteo.com/v1/search`.
3. **Deteksi Lokasi IP Fallback**:
   - **Primary**: `https://api.bigdatacloud.net/data/reverse-geocode-client`.
   - **Fallback**: `https://ipwho.is/`.
4. **Speedtest Internet**:
   - **CDN Info**: `https://speed.cloudflare.com/cdn-cgi/trace` & `https://speed.cloudflare.com/meta`.
   - **Bandwidth & Latency**: `https://speed.cloudflare.com/__down?bytes=...` & `https://speed.cloudflare.com/__up`.
5. **Pemutar Musik Full Version (Bebas Iklan)**:
   - **Full Audio Direct Stream**: `https://api.audius.co/v1/tracks/search` + `/tracks/{id}/stream` (filter ketat `duration >= 75s`, bebas cuplikan 30 detik).
   - **SoundCloud Player**: `https://w.soundcloud.com/player/` + `https://w.soundcloud.com/player/api.js`.
   - **Spotify Embed Player**: `https://open.spotify.com/embed/playlist/...`.
6. **Sosmed Video Downloader No Watermark**:
   - **TikTok (HD/SD/MP3)**: `https://www.tikwm.com/api/?url=...&hd=1` (fallback `https://apis.davidcyriltech.my.id/download/tiktok?url=...`).
   - **YouTube (MP4/MP3)**: `https://apis.davidcyriltech.my.id/download/ytmp4?url=...` & `/download/ytmp3?url=...`.
   - **Facebook (HD/SD)**: `https://apis.davidcyriltech.my.id/facebook?url=...`.
   - **Instagram (Reels/Post)**: `https://apis.davidcyriltech.my.id/instagram?url=...`.

---

## 4. Registri Kunci Penyimpanan Browser

| Kunci Storage | Penyimpanan | Isi / Struktur |
|---|---|---|
| `manifestudio_cart_v1` | `localStorage` | Item keranjang aktif |
| `manifestudio_theme_v1` | `localStorage` | `'dark'` atau `'light'` |
| `manifestudio_used_vouchers_v1` | `localStorage` | Daftar voucher yang sudah dipakai checkout |
| `manifestudio_pending_order_v1` | `sessionStorage` + `localStorage` | Snapshot handoff menuju `order.html` |
| `manifestudio_admin_vault_v1` | `localStorage` | Kredensial GitHub terenkripsi AES-256-GCM |
| `manifestudio_catalog_preview_v1` | `localStorage` | Draft lokal admin sebelum publish ke GitHub |
| `manifestudio_catalog_history_v1` | `localStorage` | Riwayat perubahan katalog (maks 12 log, auto-prune) |
| `manifestudio_pwa_installed_v1` | `localStorage` | Flag status instalasi PWA |
| `manifestudio_pwa_dismissed_v1` | `localStorage` | Timestamp penolakan banner PWA |
| `manifestudio_user_location_v1` | `localStorage` | Lokasi terakhir (GPS / IP / manual) untuk Sholat & Cuaca |
| `manifestudio_music_prefs_v1` | `localStorage` | Riwayat pencarian, artist/genre weights, play count, & skip |
| `manifestudio_music_session_v1` | `localStorage` | Status pause, `lastTrackId`, stasiun SoundCloud & Spotify |
| `manifestudio_music_pos_v1` | `localStorage` | Koordinat `(x, y)` ikon musik hasil geser pengguna |
| `manifestudio_music_mode_v1` | `localStorage` | Mode musik aktif: `'full-audio'`, `'soundcloud'`, `'spotify'` |

---

## 5. Aturan Teknis Kritis untuk Pengembang Berikutnya

1. **Path Relatif vs OpenGraph Absolut**:
   - Seluruh aset di HTML/JS/CSS (`img`, `script`, `fetch`) **wajib** memakai path relatif `./`.
   - Tag **OpenGraph & Canonical (`og:url`, `og:image`, `og:image:secure_url`, `twitter:image`, Schema.org)** **wajib** memakai URL absolut HTTPS lengkap menuju `https://tmctomystudio26.github.io/InfoKatalogtMCTomyStudio/assets/og-manifestudio.jpg?v=2` (JPEG baseline non-interlaced `1200×630` `< 300 KB`) agar WhatsApp & Telegram menampilkan gambar pratinjau.
2. **Responsif Tombol Admin Mobile**:
   - Jangan memakai `white-space: nowrap` pada tombol multi-kata di grid mobile `< 640px`. Gunakan `white-space: normal; word-break: break-word; min-width: 0; height: auto;` agar teks panjang seperti `"Ganti Token / Reset Brankas"` tidak pernah offside.
3. **Verifikasi Wajib Sebelum Push**:
   - Jalankan `node --test InfoKatalogtMCTomyStudio/js/store.test.mjs` dan pastikan semua pengujian PASS.
   - Uji tampilan desktop & mobile (`360px` / `390px`) bebas overflow horizontal (`scrollWidth <= innerWidth`).
   - Pastikan tidak ada aset yang ter-cache usang dengan menaikkan `CACHE_NAME` di `sw.js` saat menambah file statis baru.
