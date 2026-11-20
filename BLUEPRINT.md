# Architectural Blueprint & Developer Onboarding — Manifestudio

Dokumen teknis terpadu bagi **Tim IT, Human Developer, maupun AI Coding Agent** untuk memahami, mengelola, memelihara, menguji, dan mengembangkan ekosistem **Manifestudio** (*Static Storefront + Admin Brankas Terenkripsi + 12-Feature Utility Hub termasuk Manifest AI, Audio Editor Studio DAW, Drama China Hub, & Full-Length Smart Music*).

---

## 1. Tujuan & Filosofi Sistem

1. **Zero-Backend Public Hosting (100% GitHub Pages + Custom Domain Ready)**:
   Seluruh aplikasi berjalan murni di browser (*Static HTML/CSS + Native ES Modules*) dan tayang di **`https://manifestudio.my.id/`** (melalui GitHub Pages + file `CNAME` + Cloudflare DNS HTTPS) tanpa menyewa server VPS/database, dan bebas dari dependensi Replit.
2. **Pemisahan Halaman Clean & Modular**:
   - **Storefront (`index.html`)**: Fokus pada pencarian, filter kategori dinamis, banner carousel yang dapat diatur Admin, belanja cepat, & validasi voucher ketat berkuota.
   - **Order Konfirmasi (`order.html`)**: Halaman invoice terpisah + HTML5 Canvas struk JPEG `< 60 KB` + WhatsApp handoff bebas catatan palsu.
   - **Menu Utilitas (`tools.html`)**: Halaman terpisah untuk **12 utilitas harian** (`?tab=prayer | weather | worldclock | speedtest | downloader | compressor | converter | songfinder | music | dracin | audioeditor | manifestai`) yang ditonjolkan melalui kartu aksen `#utilities-callout-card` (`assets/icons/menu-utilitas.svg`).
   - **Panel Admin (`admin.html`)**: Halaman *unlisted* (`noindex`) terenkripsi AES-256-GCM yang mempublikasikan perubahan katalog, aset upload, OpenGraph `index.html`, dan riwayat perubahan terperinci langsung via GitHub REST API.
3. **Kualitas Pengalaman Mobile-First, Presisi Tinggi, & Ad-Free**:
   - Semua kontrol termasuk header navigasi, grid produk, 12 menu utilitas, pemutar musik, Drama China, Audio Editor DAW, dan workspace **Manifest AI** (termasuk mode Layar Penuh, Suara Neural Cepat & Tabel Markdown) responsif penuh di HP (`360px–430px`) maupun desktop (`1025px–1440px`) bebas overflow, menggunakan *Network-First Service Worker* (`manifestudio-cache-v66` + pelestarian `manifestudio-ffmpeg-core-v1`) + query cache-busting `?v=66`.

---

## 2. Peta Arsitektur Berkas

| Modul / Berkas | Tanggung Jawab Utama | Ketergantungan |
|---|---|---|
| `index.html` + `js/app.js` | Storefront katalog, carousel banner dinamis, kategori dinamis, modal varian, drawer checkout, voucher tracking | `data.js`, `store.js`, `pwa.js`, `music.js` |
| `order.html` + `js/order.js` + `js/receipt.js` | Invoice bersih + HTML5 Canvas Struk JPEG `< 60 KB` + format WA Order (tanpa voucher invalid) | `data.js`, `store.js`, `music.js` |
| `admin.html` + `js/admin.js` + `js/vault.js` | Gate AES-256-GCM + PBKDF2, edit produk/varian/urutan/logo/brand/tagline/biaya layanan/sosmed/FAQ/voucher limits/OpenGraph/banner, riwayat itemized + restore 12 log | `data.js`, `store.js`, `vault.js` |
| `tools.html` + `js/tools-page.js` + `js/tools-ui.js` + `js/tools-logic.js` | Router sub-tab 12 `Menu Utilitas`, pure math & domain logic, UI bar progres, & mounting sub-controller | `location.js`, `globe.js`, `speedtest.js`, `downloader.js`, `compressor.js`, `converter.js`, `song-finder.js`, `music.js`, `dracin-ui.js`, `audio-editor-ui.js`, `manifest-ai-ui.js` |
| `js/manifest-ai-logic.js` + `js/manifest-ai-voice.js` + `js/manifest-ai.js` + `js/manifest-ai-ui.js` | **Manifest AI (`v60–v66`)**: Auto-upgrade model real-time lintas 4 jaringan gratis (LLM7, Pollinations, OVHcloud 14+ model, HF Spaces) + Puter + BYOK, **riset web real-time anti-halusinasi** (Wikipedia ID/EN, Wikivoyage, DuckDuckGo), grounding live `catalog.json` dengan **perisai privasi owner 4-lapis** (`62xxxxxxxxxx` / footer), **topic-shift isolation**, **tabel Markdown responsif**, **Layar Penuh**, dan **Mode Suara Neural Cepat 1-Suara Konsisten** (31 suara unik, klausa pertama cepat & *progressive audio streaming*) | `localStorage`, `data/catalog.json`, CORS AI SSE, Wikipedia/Wikivoyage & Edge Neural TTS |
| `js/audio-editor-logic.js` + `js/audio-editor-engine.js` + `js/audio-editor-ui.js` | **Audio Editor Studio AI (`v58–v59`)**: DSP Web Audio (Trim/Potong Tengah, 10-Band EQ, Bass Boost, Virtualizer, Voice FX, Noise Repair, Stem Separation, Multi-Track Mix), tag ID3v2/RIFF, Undo/Redo, & ekspor MP3/WAV/AAC/M4A/OGG/FLAC/OPUS | `media-engine.js`, `lame.min.js` |
| `js/dracin-logic.js` + `js/dracin-cenc.js` + `js/dracin.js` + `js/dracin-ui.js` | **Drama China Hub (`v50–v57`)**: Katalog real-time 20+ platform short drama, pemutar vertikal fullscreen + Layar Bersih, preloading episode, pencocokan lintas platform + klip AI, & auto-failover SekaiDrama/Sansekai VIP-Free | `data/dracin-endpoints.json`, `hls.min.js` |
| `js/location.js` | Geolocation GPS prioritas utama + reverse geocode Kelurahan/Kecamatan + fallback IP + autocomplete kota | `tools-logic.js` |
| `js/globe.js` | Canvas 2D orthographic rotatable 3D globe + klik target negara + auto-rotate | `tools-logic.js` |
| `js/speedtest.js` | Speedometer 60fps + ukur Ping/Jitter/DL/UL Cloudflare CDN + telemetri perangkat | `tools-logic.js` |
| `js/downloader.js` | Adapter paralel TikTok, YouTube (Dual MP4+M4A/MP3/WAV), Instagram (Reels/Photo/Carousel/Story/Caption), & Facebook + streaming progress | `tools-logic.js` |
| `js/media-engine.js` + `js/vendor/` | Transcoding & kompresi client-side: **FFmpeg WebAssembly** (`@ffmpeg/core@0.12.6`), **LAME MP3 (`lame.min.js`)**, **HLS.js (`hls.min.js`)**, **PDF.js**, & verifikasi pemutaran nyata | `@ffmpeg/core`, `lamejs`, `pdfjs-dist` |
| `js/compressor.js` | Kompresor Foto & Video HD AI Hybrid & Open-Source (Multi-AI Publik, AVIF/WebP 2-Pass, Squoosh, UPNG, FFmpeg WASM, Weserv Libvips) | `tools-logic.js`, `media-engine.js` |
| `js/converter.js` | Mesin Konversi Semua File Multi-Format (85+ konversi lintas 30 format target) | `tools-logic.js`, `media-engine.js` |
| `js/song-finder.js` | Pencari Judul Lagu, Musik & Analisis Kemiripan Video Sosmed Multi-API + Whisper/AudD/AI Publik | `tools-logic.js`, `media-engine.js` |
| `js/music.js` + `js/music-logic.js` | Floating dock draggable, YT Music API open-source, drawer 14 kategori + tren real-time, background audio anti-mati, PiP + Mode Headset | YouTube IFrame API / Audius / Siputzx |
| `data/catalog.json` & `data/catalog-history.json` | Single Source of Truth produk, utilitas, brand, OpenGraph, banners, kategori, voucher usage limits, FAQ & 12 snapshot riwayat | Service Worker Network-First |
| `sw.js` + `manifest.webmanifest` | Network-First code/data cache (`manifestudio-cache-v66` + pelestarian `manifestudio-ffmpeg-core-v1`) & instalasi PWA | — |
| `CNAME` | Konfigurasi domain kustom resmi GitHub Pages (`manifestudio.my.id`) — jangan dihapus | Cloudflare DNS |

---

## 3. Registri Integrasi API Eksternal (Gratis, CORS-Enabled & Opsional BYOK)

Semua integrasi berjalan murni *client-side* tanpa server backend:

1. **Manifest AI (`v60–v61`) — Katalog Model Real-Time, Streaming Instan Multi-Gateway & Multi-BYOK**:
   - **Auto-Upgrade Model Real-Time (CORS `*`)**:
     - `https://openrouter.ai/api/v1/models` (katalog live flagship Google Gemini, OpenAI, Anthropic Claude, DeepSeek, xAI Grok, Meta Llama, Qwen, Mistral).
     - `https://models.dev/api.json` (registri rilis terbaru lintas vendor AI).
     - `https://api.llm7.io/v1/models` (daftar model aktif gateway gratis terverifikasi `!usage_based_only`).
   - **Jalur AI Gratis Tanpa API Key (Fastest-First SSE Streaming & Failover Anti-Limit)**:
     - **Hugging Face Gradio SSE Spaces (`*.hf.space/gradio_api/call/*`)**: 5 space CORS-native bebas API key (`gemma-3n-e4b-it`, `llama-3.2-3b-instruct`, `gemma-4-12b-it`, `gemma-2-9b-it`, `llama-2-7b-chat`) dengan kuota harian ZeroGPU per IP pengguna dan streaming SSE real-time.
     - **LLM7 Free SSE API (`https://api.llm7.io/v1/chat/completions`, `stream: true`)**: Dibatasi ketat **maks 1 permintaan per giliran** agar tidak memicu *burst 429*.
     - **Puter.js Client SDK (`https://js.puter.com/v2/`, `stream: true`)**: Kuota gratis multi-model terpisah per akun browser pengguna (opsional 1-klik).
   - **Multi-Provider BYOK Direct Endpoints (Opsional, 100% Lokal di Browser Pengguna)**:
     - Google Gemini (`generativelanguage.googleapis.com/v1beta`), OpenAI (`api.openai.com/v1`), DeepSeek (`api.deepseek.com`), Anthropic Claude (`api.anthropic.com/v1` + `anthropic-dangerous-direct-browser-access: true`), xAI Grok (`api.x.ai/v1`), Groq (`api.groq.com/openai/v1`), OpenRouter (`openrouter.ai/api/v1`), Mistral (`api.mistral.ai/v1`), Qwen/DashScope (`dashscope-intl.aliyuncs.com/compatible-mode/v1`), dan Custom OpenAI-Compatible Base URL.
2. **Drama China Hub (`v50–v57`)**:
   - Katalog adaptif & mirror endpoint terkelola di `data/dracin-endpoints.json`, termasuk integrasi **SekaiDrama (`api.sansekai.my.id`)** untuk failover episode VIP-free, mirror platform short drama, dan fallback Dailymotion.
3. **Jadwal Sholat Indonesia**:
   - `https://api.aladhan.com/v1/timings/...?method=20` & `https://api.myquran.com/v2/sholat/...`.
4. **Prakiraan Cuaca Presisi Tinggi & Geocoding**:
   - `https://api.open-meteo.com/v1/forecast`, `wttr.in`, Nominatim, Photon, & Open-Meteo Geocoding.
5. **Deteksi Lokasi GPS + Fallback IP & Speedtest Cloudflare**:
   - Nominatim/BigDataCloud/Photon reverse geocode, `ipwho.is`, & `speed.cloudflare.com`.
6. **YT Music API Open-Source & Sosmed Media Downloader All-in-One**:
   - Siputzx (`youtube`, `ummy`, `sssinstagram`), Audius (`api.audius.co`), 4-node Tioo, TikWM, Cobalt, & `api.vidsnap.app/proxy`.

---

## 4. Registri Kunci Penyimpanan Browser

| Kunci Storage | Penyimpanan | Isi / Struktur |
|---|---|---|
| `manifestudio_ai_chats_v1` | `localStorage` | Riwayat seluruh thread percakapan **Manifest AI** (judul, pesan, metadata kontributor model, timestamp) |
| `manifestudio_ai_byok_v1` | `localStorage` | Daftar API Key pribadi pengguna (**multi-provider BYOK**), hanya tersimpan lokal di perangkat pengguna |
| `manifestudio_ai_models_v1` | `localStorage` | Cache katalog model flagship terbaru hasil sinkronisasi real-time (TTL auto-refresh 6 jam) |
| `manifestudio_ai_limits_v1` | `localStorage` | Peta cooldown & reset rate-limit per pengguna di browser untuk failover otomatis |
| `manifestudio_ai_prefs_v1` | `localStorage` | Preferensi mode (`ensemble`/`single`), provider fokus, toggle gabung BYOK+Gratis, & Puter SDK |
| `manifestudio_cart_v1` | `localStorage` | Item keranjang aktif |
| `manifestudio_theme_v1` | `localStorage` | `'dark'` atau `'light'` |
| `manifestudio_used_vouchers_v1` | `localStorage` | Map jumlah pemakaian per kode voucher `{ CODE: count }` |
| `manifestudio_pending_order_v1` | `sessionStorage` + `localStorage` | Snapshot handoff menuju `order.html` |
| `manifestudio_admin_vault_v1` | `localStorage` | Kredensial GitHub terenkripsi AES-256-GCM |
| `manifestudio_catalog_preview_v1` | `localStorage` | Draft lokal admin sebelum publish ke GitHub |
| `manifestudio_catalog_history_v1` | `localStorage` | Riwayat perubahan katalog terperinci (maks 12 log, auto-prune) |
| `manifestudio_pwa_installed_v1` / `dismissed_v1` | `localStorage` | Status instalasi & penolakan banner PWA |
| `manifestudio_user_location_v1` / `weather_cal_v1` | `localStorage` | Lokasi terakhir & kalibrasi cuaca aktual lokal pengguna |
| `manifestudio_music_*` | `localStorage` / `sessionStorage` | Library musik, stream cache, Mode Headset, sesi lintas halaman, & posisi FAB |
| `manifestudio_dracin_*` | `localStorage` | Riwayat tontonan, favorit, & health mirror Drama China |

---

## 5. Aturan Teknis Kritis untuk Pengembang Berikutnya

1. **Path Relatif vs OpenGraph Absolut**:
   - Seluruh aset di HTML/JS/CSS (`img`, `script`, `fetch`) **wajib** memakai path relatif `./`.
   - Tag **OpenGraph & Canonical** **wajib** memakai URL absolut HTTPS lengkap menuju `https://manifestudio.my.id/...`.
   - Jangan pernah menghapus file `CNAME` (`manifestudio.my.id`).
2. **Cache-Busting Konsisten (`sw.js` & `?v=N`)**:
   - Setiap kali mengubah JS/CSS/HTML, naikkan `CACHE_NAME` di `sw.js` **dan** `CURRENT_CACHE` + query `?v=N` pada seluruh HTML (`index.html`, `tools.html`, `order.html`, `admin.html`) dan import ES module terkait.
3. **Dokumentasi & Verifikasi Wajib Sebelum Push**:
   - Setiap pembaruan fitur wajib memperbarui `ROADMAP.md`, `README.md`, dan `BLUEPRINT.md`.
   - Jalankan `npx --yes tsx --test .repos/InfoKatalogtMCTomyStudio/js/store.test.mjs`, `npm run build && npm run lint`, serta uji UI desktop + mobile (`playwright-cli`) bebas error dan overflow (`scrollWidth <= innerWidth`), lalu langsung push ke `origin/main`.
