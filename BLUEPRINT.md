# Architectural Blueprint & Developer Onboarding — Manifestudio

Dokumen teknis terpadu bagi **Tim IT, Human Developer, maupun AI Coding Agent** untuk memahami, mengelola, memelihara, menguji, dan mengembangkan ekosistem **Manifestudio** (*Static Storefront + Admin Brankas Terenkripsi + 14-Feature Utility Hub termasuk Novel Terpadu, Cek Plagiarisme Terpadu, Manifest AI, Audio Editor Studio DAW, Drama China Hub, & Full-Length Smart Music*).

---

## 1. Tujuan & Filosofi Sistem

1. **Zero-Backend Public Hosting (100% GitHub Pages + Custom Domain Ready)**:
   Seluruh aplikasi berjalan murni di browser (*Static HTML/CSS + Native ES Modules*) dan tayang di **`https://manifestudio.my.id/`** (melalui GitHub Pages + file `CNAME` + Cloudflare DNS HTTPS) tanpa menyewa server VPS/database, dan bebas dari dependensi Replit.
2. **Pemisahan Halaman Clean & Modular**:
   - **Storefront (`index.html`)**: Fokus pada pencarian, filter kategori dinamis, banner carousel yang dapat diatur Admin, belanja cepat, & validasi voucher ketat berkuota.
   - **Order Konfirmasi (`order.html`)**: Halaman invoice terpisah + HTML5 Canvas struk JPEG `< 60 KB` + WhatsApp handoff bebas catatan palsu.
   - **Menu Utilitas (`tools.html`)**: Halaman terpisah untuk **14 utilitas harian** (`?tab=prayer | weather | worldclock | speedtest | downloader | compressor | converter | songfinder | music | dracin | audioeditor | manifestai | plagiarism | novel`) yang ditonjolkan melalui kartu aksen `#utilities-callout-card` (`assets/icons/menu-utilitas.svg`).
   - **Panel Admin (`admin.html`)**: Halaman *unlisted* (`noindex`) terenkripsi AES-256-GCM yang mempublikasikan perubahan katalog, aset upload, OpenGraph `index.html`, dan riwayat perubahan terperinci langsung via GitHub REST API.
3. **Kualitas Pengalaman Mobile-First, Presisi Tinggi, & Ad-Free**:
   - Semua kontrol termasuk header navigasi, grid produk, 14 menu utilitas, pemutar musik, **Drama China Terpadu (`v73`, 1 katalog gabungan lintas 17 platform original, 0% Dailymotion, 100% VIP Terbuka Ep 1–Tamat gratis di pemutar HTML5 `<video>` vertikal native, & Mode FYP TikTok)**, Audio Editor DAW (anti-offside Gen Z), workspace **Manifest AI** (mode Layar Penuh, Suara Neural Cepat & Tabel Markdown), **Cek Plagiarisme Terpadu** (Upload Instan 0ms, Penampil Dokumen Asli Multi-Halaman + Layar Penuh, & Standar Report PDF berbasis halaman asli `pdf-lib` · No Repository), serta **Novel Terpadu (`v72`)** (warm-start instan 0ms tanpa loading lama, 200+ novel lintas 14+ sumber platform & mirror **Eks-VIP → Gratis Full**, 100% sampul visual asli tanpa kartu polos, pembersih anti-anomali OCR/DjVu, modal detail responsif, 122+ tema halaman termasuk animasi & request AI, layar penuh, loncat halaman/bab, pencocokan cuplikan/screenshot/file hingga 100%, & mode suara audiobook) responsif penuh di HP (`360px–430px`) maupun desktop (`1025px–1440px`) bebas overflow, menggunakan *Network-First Service Worker* (`manifestudio-cache-v73` + pelestarian `manifestudio-ffmpeg-core-v1`) + query cache-busting `?v=73`.

---

## 2. Peta Arsitektur Berkas

| Modul / Berkas | Tanggung Jawab Utama | Ketergantungan |
|---|---|---|
| `index.html` + `js/app.js` | Storefront katalog, carousel banner dinamis, kategori dinamis, modal varian, drawer checkout, voucher tracking | `data.js`, `store.js`, `pwa.js`, `music.js` |
| `order.html` + `js/order.js` + `js/receipt.js` | Invoice bersih + HTML5 Canvas Struk JPEG `< 60 KB` + format WA Order (tanpa voucher invalid) | `data.js`, `store.js`, `music.js` |
| `admin.html` + `js/admin.js` + `js/vault.js` | Gate AES-256-GCM + PBKDF2, edit produk/varian/urutan/logo/brand/tagline/biaya layanan/sosmed/FAQ/voucher limits/OpenGraph/banner, riwayat itemized + restore 12 log | `data.js`, `store.js`, `vault.js` |
| `tools.html` + `js/tools-page.js` + `js/tools-ui.js` + `js/tools-logic.js` | Router sub-tab 14 `Menu Utilitas`, pure math & domain logic, UI bar progres, & mounting sub-controller | `location.js`, `globe.js`, `speedtest.js`, `downloader.js`, `compressor.js`, `converter.js`, `song-finder.js`, `music.js`, `dracin-ui.js`, `audio-editor-ui.js`, `manifest-ai-ui.js`, `plagiarism-ui.js`, `novel-ui.js` |
| `js/novel-themes.js` + `js/novel-logic.js` + `js/novel-engine.js` + `js/novel-ui.js` | **Novel Terpadu (`v70–v72`)**: Warm-start instan `0ms` (`getInstantNovelCatalog`) + *progressive streaming* (`onPartialUpdate`) lintas **14+ sumber novel & jaringan mirror Eks-VIP Gratis Full** (200+ novel: WebNovel/Qidian VIP→Mirror Gratis, Kakaopage/Munpia VIP→Mirror Gratis, GoodNovel/NovelToon/Fizzo/Dreame Mirror Gratis, SakuraNovel, IndoWebNovel, SecondLife TL, Wattpad Gratis, Archive Nusantara, OpenLibrary, Gutendex, Wikisource ID), **100% sampul visual asli** (`KNOWN_NOVEL_COVERS` + 3×22 AniList GraphQL batch + IndoWebNovel WP Media Library + `GENRE_COVER_ART_POOL`), **Anti-OCR/DjVu Anomaly Cleaner** (`cleanOcrAndDjvuText` & `isOcrGarbageLine`), mode Layar Penuh, Loncat Halaman/Bab, Pencocokan 100%, **122+ tema halaman**, serta **Mode Suara Audiobook** (`manifest-ai-voice.js`) | `manifest-ai-voice.js`, `manifest-ai.js`, `plagiarism-engine.js`, `localStorage` |
| `js/plagiarism-logic.js` + `js/plagiarism-engine.js` + `js/plagiarism-report.js` + `js/plagiarism-ui.js` | **Cek Plagiarisme Terpadu (`v67–v69`)**: Upload File instan 0ms (tanpa kolom teks mentah & tanpa menunggu ekstraksi sebelum klik Cek), ekstraksi + render halaman asli dalam 1 bar progres terpadu (PDF.js Blob Worker + CMap + auto-OCR + Word/DOCX rich layout + Gambar), **Penampil Dokumen Asli Multi-Halaman + Layar Penuh** (tanpa menulis ulang naskah) dengan sorotan warna transparan & lencana angka margin kiri (`1`, `2`, ...), fusi paralel **OpenAlex + Crossref + DOAJ + Wikipedia ID/EN + Winnowing K-Gram/Stylometric AI + Multi-AI Ensemble + Turnitin Core API (No Repository)**, serta **`Unduh PDF (Standar Report)`** (`pdf-lib`, Cover Page + Integrity Overview + Top Sources + **halaman asli dokumen** disematkan utuh) berawalan `Report_` | `manifest-ai.js`, `pdfjs-dist`, `pdf-lib`, `jszip`, `tesseract.js`, `localStorage` |
| `js/manifest-ai-logic.js` + `js/manifest-ai-voice.js` + `js/manifest-ai.js` + `js/manifest-ai-ui.js` | **Manifest AI (`v60–v66`)**: Auto-upgrade model real-time lintas 4 jaringan gratis (LLM7, Pollinations, OVHcloud 14+ model, HF Spaces) + Puter + BYOK, **riset web real-time anti-halusinasi** (Wikipedia ID/EN, Wikivoyage, DuckDuckGo), grounding live `catalog.json` dengan **perisai privasi owner 4-lapis** (`62xxxxxxxxxx` / footer), **topic-shift isolation**, **tabel Markdown responsif**, **Layar Penuh**, dan **Mode Suara Neural Cepat 1-Suara Konsisten** (31 suara unik, klausa pertama cepat & *progressive audio streaming*) | `localStorage`, `data/catalog.json`, CORS AI SSE, Wikipedia/Wikivoyage & Edge Neural TTS |
| `js/audio-editor-logic.js` + `js/audio-editor-engine.js` + `js/audio-editor-ui.js` | **Audio Editor Studio AI (`v58–v67`)**: DSP Web Audio (Trim/Potong Tengah, 10-Band EQ, Bass Boost, Virtualizer, Voice FX, Noise Repair, Stem Separation, Multi-Track Mix), tag ID3v2/RIFF, Undo/Redo, ekspor MP3/WAV/AAC/M4A/OGG/FLAC/OPUS, serta pemolesan UI Gen Z anti-offside mobile (header 1-baris, stepper simetris, canvas empty-state terbungkus, & gradien waveform) | `media-engine.js`, `lame.min.js` |
| `js/dracin-verified-seed.js` + `js/dracin-logic.js` + `js/dracin-cenc.js` + `js/dracin.js` + `js/dracin-ui.js` | **Drama China Terpadu (`v50–v73`)**: Warm-start instan `0ms` (92+ drama terverifikasi + sinkronisasi live 400–500+ drama) dalam **1 katalog terpadu lintas 17 platform short-drama original** (DramaBox VIP/ForYou/Dubbing, PineDrama TikTok CDN, Melolo, NetShort, NunoMix Dub Indo, ReelShort, ShortMax, GoodShort, FlickReels, FreeReels, DramaWave, FlexTV, KalosTV, MoboReels, MyDrama, StardustTV, Vigloo) — **0% Dailymotion**, pemutar HTML5 `<video>` vertikal 9:16 asli (Direct MP4, HLS.js, WebCrypto CENC), **100% VIP Terbuka Ep 1–Tamat Gratis**, serta **🔥 Mode FYP TikTok** dengan tombol pindah drama FYP & bar akses episode penuh | `data/dracin-endpoints.json`, `hls.min.js` |
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
| `sw.js` + `manifest.webmanifest` | Network-First code/data cache (`manifestudio-cache-v73` + pelestarian `manifestudio-ffmpeg-core-v1`) & instalasi PWA | — |
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
2. **Drama China Terpadu (`v50–v73` — 17 Platform Original, 0% Dailymotion, 100% VIP Terbuka & Mode FYP TikTok)**:
   - Menyatukan **17 platform short-drama original** (**DramaBox VIP/ForYou/Dubbing, PineDrama TikTok CDN, Melolo, NetShort, NunoMix Dub Indo, ReelShort, ShortMax, GoodShort, FlickReels, FreeReels, DramaWave, FlexTV, KalosTV, MoboReels, MyDrama, StardustTV, & Vigloo**) ke dalam 1 katalog terpadu tanpa menu pemisah platform dan **0% Dailymotion** (menghapus total rekaman layar/episode terpotong). Seluruh episode (Ep 1 hingga Tamat, termasuk episode VIP komersial) diputar langsung melalui pemutar `<video>` vertikal 9:16 asli (Direct MP4 1080P/720P/540P, HLS `.m3u8`, & dekripsi WebCrypto CENC-AES-CTR), lengkap dengan warm-start `0ms` (`manifestudio_dracin_warm_catalog_v73`) dan **🔥 Mode FYP TikTok**.
3. **Jadwal Sholat Indonesia**:
   - `https://api.aladhan.com/v1/timings/...?method=20` & `https://api.myquran.com/v2/sholat/...`.
4. **Prakiraan Cuaca Presisi Tinggi & Geocoding**:
   - `https://api.open-meteo.com/v1/forecast`, `wttr.in`, Nominatim, Photon, & Open-Meteo Geocoding.
5. **Deteksi Lokasi GPS + Fallback IP & Speedtest Cloudflare**:
   - Nominatim/BigDataCloud/Photon reverse geocode, `ipwho.is`, & `speed.cloudflare.com`.
6. **YT Music API Open-Source & Sosmed Media Downloader All-in-One**:
   - Siputzx (`youtube`, `ummy`, `sssinstagram`), Audius (`api.audius.co`), 4-node Tioo, TikWM, Cobalt, & `api.vidsnap.app/proxy`.
7. **Cek Plagiarisme Terpadu Multi-Mesin (`v67–v69`, Authentic Original-Document & Strict No Repository)**:
   - **Korpus Akademik & Publikasi Terbuka (CORS `*`)**: **OpenAlex** (`api.openalex.org/works`, 250M+ karya ilmiah dengan polite `mailto`), **Crossref** (`api.crossref.org/works?filter=has-abstract:true`, 150M+ DOI), **DOAJ** (`doaj.org/api/search/articles`), serta **Wikipedia ID & EN** (`id/en.wikipedia.org/w/api.php` dengan `prop=extracts&exintro=1&exlimit=max`).
   - **Dokumen Asli Utuh (`pdf-lib` + PDF.js), Analisis Semantik, & Jaminan No Repository**: Upload file 0ms langsung siap cek, ekstraksi + pemetaan koordinat kata (`extractNormalizedPdfSpans` proporsional & OCR bounding boxes) + fusi **Multi-AI Semantic Ensemble + Winnowing K-Gram + Self-Duplication + Stylometric AI** + opsional **Turnitin Core API (`no_repository: true`)**, **Penampil Dokumen Asli Multi-Halaman + Layar Penuh**, serta ekspor **`Report_*.pdf`** berbasis `pdf-lib` yang menyematkan halaman PDF/gambar/DOCX asli secara utuh di bawah sorotan warna & lencana angka margin kiri (`1`, `2`, ...).
8. **Novel Terpadu Real-Time (`v70–v72` — 14+ Sumber & Mirror Eks-VIP Gratis Penuh, 0ms Warm-Start, 100% Cover Asli & Anti-OCR Cleaner)**:
   - Menggabungkan **WebNovel/Qidian VIP→Mirror Gratis**, **Kakaopage/Munpia VIP→Mirror Gratis**, **GoodNovel/NovelToon/Fizzo/Dreame Mirror Gratis**, **SakuraNovel.id**, **IndoWebNovel.id**, **SecondLifeTranslations**, **Wattpad Free-Only**, **Internet Archive Koleksi Novel Indonesia**, **OpenLibrary Romance & Fantasy**, **Project Gutenberg / Gutendex**, dan **Wikisource Nusantara** ke dalam 1 katalog terpadu (200+ novel) dengan render instan `0ms`, `KNOWN_NOVEL_COVERS` + AniList 3×22 batch + IndoWebNovel WP Media Library + `GENRE_COVER_ART_POOL`, pembersih teks OCR/DjVu (`cleanOcrAndDjvuText`), serta palet tema publik `thecolorapi.com`.

---

## 4. Registri Kunci Penyimpanan Browser

| Kunci Storage | Penyimpanan | Isi / Struktur |
|---|---|---|
| `manifestudio_novel_history_v1` | `localStorage` | Riwayat baca novel terpadu (metadata novel, bab terakhir, nomor halaman, progres %, waktu baca) |
| `manifestudio_novel_bookmarks_v1` | `localStorage` | Rak novel tersimpan (bookmark) |
| `manifestudio_novel_prefs_v1` | `localStorage` | Preferensi pembaca novel (tema aktif, font, ukuran huruf, spasi, mode halaman/gulir, kecerahan, suara audiobook, auto-lanjut bab) |
| `manifestudio_novel_custom_themes_v1` | `localStorage` | Tema halaman novel buatan AI, tema API publik, & tema wallpaper/JSON unggahan pengguna |
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
| `manifestudio_plagiarism_history_v1` | `localStorage` | Riwayat laporan pengecekan plagiarisme (skor kemiripan, sumber teratas, segmen berlabel, timestamp) |
| `manifestudio_plagiarism_turnitin_v1` | `localStorage` | Konfigurasi opsional konektor Turnitin Core API / Institutional (Base URL & API Key lokal browser) |

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
   - Jalankan `npx --yes tsx --test .repos/InfoKatalogtMCTomyStudio/js/plagiarism.test.mjs .repos/InfoKatalogtMCTomyStudio/js/manifest-ai.test.mjs`, `npm run build && npm run lint`, serta uji UI desktop + mobile (`playwright-cli`) bebas error dan overflow (`scrollWidth <= innerWidth`), lalu langsung push ke `origin/main`.
