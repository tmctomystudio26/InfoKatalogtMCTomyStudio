/**
 * Tanya Fitur — Customer Service AI Pure Logic & Verified Knowledge Base (v87)
 *
 * Powers the floating "Tanya Fitur" assistant on Manifestudio:
 *  - Powered by Manifest AI streaming engine, strictly positioned as a Customer Service agent.
 *  - AI-First / Blocklist-Only intent gate: NEVER falsely rejects natural user complaints,
 *    follow-ups, slang, or polite Indonesian courtesies ("Terimakasih atas informasinya",
 *    "Ngelag ketika menonton drama", "Drama tidak lengkap", etc.).
 *  - Knows every verified detail, format, limit, step-by-step guide, and troubleshooting tip
 *    across all 16 Manifestudio features (including Shortlink Bypass) + PWA/theme/privacy usage.
 *  - Strictly refuses unmistakable off-topic general requests (redirects politely to Manifest AI).
 *  - Zero-leak confidentiality guard: NEVER reveals Manifestore, Store catalog, pricing,
 *    WhatsApp/Instagram/TikTok contacts, or internal system/admin details.
 */

export const FEATURE_CS_KNOWLEDGE_BASE = Object.freeze([
  {
    id: 'manifestai',
    name: 'Manifest AI',
    category: 'AI & Dokumen',
    keywords: ['manifest ai', 'ai', 'chat ai', 'chatgpt', 'gemini', 'claude', 'deepseek', 'grok', 'suara ai', 'byok', 'api key'],
    summary: 'Asisten chat AI universal multi-model gratis tanpa login.',
    details: [
      'Mendukung berbagai model AI populer (Gemini, ChatGPT, DeepSeek, Claude, Grok, dan lainnya) dengan streaming jawaban cepat dan tabel Markdown rapi.',
      'Bisa dipakai untuk pertanyaan umum apa pun: menulis, coding, matematika, riset, belajar, hingga terjemahan.',
      'Dilengkapi riset web real-time untuk fakta terbaru, mode pembacaan suara natural (voice), serta dukungan API Key pribadi opsional.',
    ],
    steps: [
      'Buka fitur Manifest AI dari beranda Manifestudio.',
      'Ketik pertanyaan Anda di kolom pesan lalu tekan Kirim.',
      'Gunakan tombol suara jika ingin mendengar jawaban dibacakan, atau tombol Obrolan Baru untuk memulai topik baru.',
    ],
    troubleshooting: [
      'Jika jawaban melambat atau muncul pemberitahuan sibuk, tunggu beberapa detik lalu kirim ulang—sistem otomatis berpindah ke jalur AI cadangan.',
      'Jika ingin topik baru tidak tercampur topik lama, klik Obrolan Baru.',
    ],
  },
  {
    id: 'dracin',
    name: 'Drama Pendek',
    category: 'Hiburan & Media',
    keywords: [
      'drama', 'dracin', 'drama pendek', 'drama china', 'subtitle', 'episode', 'eps', 'fyp',
      'nonton', 'menonton', 'layar penuh', 'video macet', 'ngelag', 'lag', 'patah', 'buffering',
      'tidak lengkap', 'gak lengkap', 'belum lengkap', 'terpotong', 'scroll', 'geser',
    ],
    summary: 'Streaming ribuan episode drama pendek Indonesia, China & global gratis tanpa iklan.',
    details: [
      'Menyatukan 20+ platform drama pendek dengan pemutar vertikal HD, gestur geser atas/bawah ala video pendek, dan subtitle Bahasa Indonesia otomatis.',
      'Dilengkapi filter kategori/platform, pencarian judul, loncat episode cepat, riwayat tontonan otomatis di perangkat, mode Layar Bersih (Clean Screen), dan layar penuh.',
      'Jumlah episode yang tampil mengikuti ketersediaan terbaru dari platform sumber (sebagian judul yang masih tayang/ongoing akan bertambah otomatis saat platform sumber merilis episode baru).',
    ],
    steps: [
      'Buka fitur Drama Pendek, pilih judul dari beranda atau cari di kolom pencarian.',
      'Ketuk judul untuk mulai memutar episode; pilih nomor episode dari daftar episode atau geser vertikal dengan lembut untuk berpindah episode.',
      'Ketuk ikon Layar Bersih atau Layar Penuh untuk menonton tanpa gangguan tombol.',
    ],
    troubleshooting: [
      'Jika video ngelag, patah-patah, atau buffering saat menonton drama: (1) pastikan koneksi internet stabil (bisa dicek cepat lewat fitur Speedtest di Manifestudio), (2) tutup sementara tab atau aplikasi berat lain agar memori HP lega, (3) tekan Muat Ulang atau coba sumber/judul yang sama dari platform lain di daftar pencarian karena server sumber kadang sedang padat, dan (4) aktifkan mode Layar Bersih agar pemutaran lebih ringan.',
      'Jika episode drama terasa tidak lengkap atau berhenti di tengah seri: beberapa drama memang masih berstatus tayang (ongoing) dari platform sumbernya, atau sumber tertentu hanya menyediakan sebagian episode. Coba ketik judul yang sama di kolom pencarian Drama Pendek untuk melihat versi dari platform sumber lain yang sudah lengkap hingga tamat.',
      'Jika suara tidak keluar saat baru mulai, ketuk ikon speaker (Unmute) di pemutar video dan pastikan fitur YT Music atau Audio Editor tidak sedang aktif bersamaan.',
    ],
  },
  {
    id: 'music',
    name: 'YT Music',
    category: 'Hiburan & Media',
    keywords: ['yt music', 'musik', 'lagu', 'music', 'playlist', 'audio latar', 'background', 'headset', 'putar lagu', 'musik yt'],
    summary: 'Pemutar lagu viral Indonesia & mancanegara bebas iklan dengan audio latar anti-mati.',
    details: [
      'Bebas iklan, mendukung pencarian lagu & artis real-time, daftar tren viral, playlist pribadi tersimpan lokal di browser, serta kontrol tombol headset/notifikasi.',
      'Audio tetap berjalan mulus saat Anda berpindah fitur di Manifestudio atau saat layar ponsel redup. Ikon musik mengambang juga dapat disembunyikan melalui tombol tutup di dalam panel pemutar mini.',
    ],
    steps: [
      'Buka YT Music lalu pilih lagu dari daftar tren atau cari judul/artis di kolom pencarian.',
      'Ketuk lagu untuk memutar; gunakan tombol Tambah ke Playlist untuk menyimpan favorit Anda.',
      'Saat lagu aktif diputar, ketuk ikon musik mengambang untuk membuka kontrol mini atau menyembunyikannya.',
    ],
    troubleshooting: [
      'Jika audio berhenti saat membuka Drama Pendek atau Audio Editor, itu normal agar suara tidak bertabrakan—lanjutkan pemutaran setelah selesai.',
      'Jika lagu gagal dimuat, ketuk tombol Berikutnya atau coba cari versi lain dari judul lagu tersebut.',
    ],
  },
  {
    id: 'downloader',
    name: 'Downloader',
    category: 'Downloader & File',
    keywords: ['downloader', 'download', 'unduh', 'tiktok', 'instagram', 'youtube', 'facebook', 'reels', 'watermark', 'mp4', 'mp3', 'story', 'carousel'],
    summary: 'Unduh video MP4 HD, audio MP3, foto carousel, dan story sosial media tanpa watermark.',
    details: [
      'Mendukung TikTok (tanpa watermark), YouTube (video & MP3), Instagram (Reels, Post, Carousel, Story), dan Facebook.',
      'Menyediakan pilihan kualitas video/audio serta salin caption bila tersedia.',
    ],
    steps: [
      'Salin tautan (link) postingan dari TikTok, Instagram, YouTube, atau Facebook.',
      'Tempel tautan ke kolom input Downloader lalu tekan tombol Proses/Unduh.',
      'Pilih format video HD, audio MP3, atau foto yang ingin disimpan ke perangkat.',
    ],
    troubleshooting: [
      'Pastikan tautan berasal dari akun publik (postingan akun privat tidak dapat diambil).',
      'Pastikan yang ditempel adalah tautan lengkap (https://...) tanpa teks tambahan.',
      'Jika gagal pada percobaan pertama, tunggu sebentar lalu klik Proses ulang karena beberapa platform membatasi permintaan cepat.',
    ],
  },
  {
    id: 'shortlink',
    name: 'Shortlink Bypass',
    category: 'Downloader & File',
    keywords: [
      'shortlink', 'short link', 'bypass', 'perpendek', 'link iklan', 'safelink', 'safelinku',
      'bitly', 'bit.ly', 'tinyurl', 's.id', 'ouo', 'linkvertise', 'shrinkme', 'adfly',
      'popup', 'pop-up', 'malware', 'phishing', 'cek link', 'buka link', 'tautan pendek',
      'redirect', 'pengalihan', 'unshorten', 'expand url',
    ],
    summary: 'Lewati shortlink penuh iklan, pop-up & pengalihan berulang sekaligus pindai keamanan malware/phishing dengan Multi-API & Multi-AI.',
    details: [
      'Menggabungkan dekoder lokal instan, pelacak pengalihan aman di server (HTTP redirect, meta-refresh, canonical, & pola safelink), berbagai API bypass open-source & publik secara paralel, serta analisis keamanan kolaboratif Multi-AI (Gemini, ChatGPT, Claude, Grok, DeepSeek).',
      'Otomatis membersihkan parameter pelacak iklan (seperti utm_*, fbclid, gclid), menampilkan jejak pengalihan langkah demi langkah, dan memberi status keamanan (Aman, Waspada, atau Berbahaya) sebelum Anda membuka tautan.',
      'Mendukung mode 1 tautan maupun banyak tautan sekaligus (Batch Bypass) lengkap dengan riwayat lokal di perangkat.',
    ],
    steps: [
      'Buka fitur Shortlink Bypass dari beranda Manifestudio.',
      'Tempel tautan pendek atau safelink (atau beberapa tautan sekaligus di mode Batch) ke kolom input.',
      'Tekan tombol Bypass & Cek Keamanan, tunggu hasil gabungan mesin bypass dan analisis Multi-AI muncul, lalu salin atau buka tautan bersih yang aman.',
    ],
    troubleshooting: [
      'Jika sebuah tautan memakai verifikasi manusia ketat (CAPTCHA/Cloudflare Turnstile) di situs asalnya, mesin tetap menampilkan alamat perantara yang berhasil dilacak serta hasil audit keamanan Multi-AI agar Anda tahu apakah situs tersebut layak dibuka.',
      'Pastikan tautan diawali dengan http:// atau https:// dan tidak terpotong saat disalin.',
      'Jika hasil menandai status Waspada atau Berbahaya (misalnya unduhan .apk/.exe mencurigakan atau domain tiruan), sebaiknya jangan buka atau unduh file dari tautan tersebut.',
    ],
  },
  {
    id: 'sshvpn',
    name: 'SSH & VPN',
    category: 'Harian & Keamanan',
    keywords: [
      'ssh', 'vpn', 'vmess', 'vless', 'trojan', 'shadowsocks', 'wireguard', 'openvpn',
      'l2tp', 'sstp', 'hysteria', 'hysteria2', 'warp', 'slowdns', 'ssh websocket',
      'ssh ssl', 'ssh udp', 'buat akun ssh', 'akun vpn gratis', 'slot server', 'tunnel',
      'http custom', 'v2ray', 'xray', 'singbox', 'clash', 'riwayat akun',
    ],
    summary: 'Pembuat akun WireGuard VIP, VMess, VLess, Trojan, Shadowsocks, Hysteria2 QUIC, & OpenVPN/L2TP langsung aktif 1-klik plus server SSH WebSocket/SSL/UDP/SlowDNS real-time.',
    details: [
      'Menggabungkan 18+ API penyedia jaringan secara real-time: 7 protokol Instan 1-Klik (Cloudflare WARP WireGuard VIP, VPNGate OpenVPN/L2TP/SSTP, serta Multi-API Xray VMess, VLess, Trojan, Shadowsocks AEAD, & Hysteria2 QUIC) ditambah daftar server SSH WebSocket/SSL/UDP/SlowDNS dari SSHOcean, SSHMax, dan FreeVPN.',
      'Akun berlabel Instan 1-Klik aktif seketika di dalam Manifestudio tanpa meninggalkan halaman. Khusus server SSH VPS publik yang mewajibkan anti-bot/CAPTCHA di penyedia asalnya, disiapkan payload HTTP Custom/Injector lengkap beserta tombol langsung ke portal penyedia serta pintasan ke alternatif instan.',
      'Pengguna dapat memasukkan username, password (untuk SSH), Bug Host/SNI opsional, memilih negara & durasi aktif (3–30 hari), menyalin/mengunduh konfigurasi (.conf, .ovpn, URI, Clash YAML, Sing-Box JSON), serta mengelola riwayat akun yang pernah dibuat.',
    ],
    steps: [
      'Buka fitur SSH & VPN dari beranda Manifestudio.',
      'Pilih protokol yang diinginkan (SSH, WireGuard, VMess, VLess, Trojan, Shadowsocks, Hysteria2, atau OpenVPN), lalu pilih server & negara dengan slot tersedia.',
      'Masukkan username/password yang diinginkan, pilih durasi aktif, lalu klik Buat Akun (atau siapkan payload & buka portal untuk SSH VPS) dan simpan hasilnya.',
    ],
    troubleshooting: [
      'Jika daftar server atau sisa slot ingin diperbarui sesuai kondisi penyedia terbaru, klik tombol "Segarkan Real-Time" di pojok kanan atas.',
      'Gunakan kolom pencarian atau dropdown negara untuk langsung menyaring server berdasarkan lokasi maupun penyedia API tanpa lag.',
      'Jika akun di satu node terasa lambat pada jaringan seluler Anda, buka tab Status API lalu pilih server atau protokol lain (misalnya WireGuard WARP atau Hysteria2) dan buat akun baru secara gratis.',
    ],
  },
  {
    id: 'compressor',
    name: 'Kompresor HD',
    category: 'Downloader & File',
    keywords: ['kompres', 'kompresor', 'perkecil', 'ukuran foto', 'ukuran video', 'pecah', 'blur', 'whatsapp hd', 'tiktok hd', 'reels', 'webp', 'avif'],
    summary: 'Perkecil ukuran foto dan video tanpa pecah langsung di browser.',
    details: [
      'Semua proses kompresi berjalan 100% lokal di perangkat Anda (file tidak diunggah ke server).',
      'Dilengkapi preset siap pakai untuk TikTok HD, Instagram Reels, dan WhatsApp HD serta dukungan format WebP/AVIF & kompresi video presisi.',
    ],
    steps: [
      'Buka Kompresor HD lalu pilih atau seret file foto/video dari perangkat Anda.',
      'Pilih preset kualitas (seperti WhatsApp HD, IG Reels, TikTok HD, atau atur manual).',
      'Tekan tombol Kompres lalu unduh hasilnya setelah selesai.',
    ],
    troubleshooting: [
      'Kompresi video berdurasi panjang membutuhkan waktu dan RAM lebih besar—tutup tab lain yang tidak dipakai agar proses lancar.',
      'Jika hasil foto terasa terlalu kecil, naikkan slider kualitas ke 80–90% agar detail tetap tajam.',
    ],
  },
  {
    id: 'converter',
    name: 'Konversi File',
    category: 'Downloader & File',
    keywords: ['konversi', 'convert', 'ubah format', 'pdf', 'docx', 'word', 'excel', 'xlsx', 'jpg', 'png', 'zip', 'csv', 'json', 'mp3', 'wav'],
    summary: 'Ubah format 85+ kombinasi dokumen, gambar, audio, video, dan arsip ZIP langsung di browser.',
    details: [
      'Mendukung dokumen (DOCX, XLSX/Excel, PDF, RTF, Markdown, HTML, CSV, TSV, JSON, XML, YAML), gambar (JPG, PNG, WebP, BMP, GIF, SVG), audio (MP3, WAV, M4A, AAC, OGG, FLAC), video (MP4, WebM), dan inspeksi ZIP.',
      'Pemrosesan berlangsung lokal di browser tanpa mengunggah file ke server.',
    ],
    steps: [
      'Buka Konversi File dan pilih berkas yang ingin diubah.',
      'Sistem otomatis mendeteksi jenis file dan menampilkan daftar format tujuan yang kompatibel.',
      'Pilih format tujuan, tekan Konversi, lalu simpan file hasil konversi.',
    ],
    troubleshooting: [
      'Pastikan file tidak terkunci password atau rusak (corrupt).',
      'Untuk konversi video/audio berukuran besar di HP, pastikan ruang penyimpanan dan memori mencukupi.',
    ],
  },
  {
    id: 'audioeditor',
    name: 'Audio Editor',
    category: 'Hiburan & Media',
    keywords: ['audio editor', 'edit audio', 'potong lagu', 'potong tengah', 'equalizer', 'eq', 'bass boost', 'karaoke', 'pisah vokal', 'stem', 'voice changer', 'noise', 'mixer'],
    summary: 'Studio edit audio lengkap langsung di browser.',
    details: [
      'Fitur lengkap: potong pinggir & potong tengah, 10-Band Equalizer, Bass Boost & Virtualizer, pemisah vokal/instrumen (karaoke), pengurang noise, Voice Changer, mixer multi-trek, editor metadata ID3, undo/redo, serta estimasi ukuran ekspor.',
      'Mendukung ekspor ke format MP3, WAV, M4A, OGG, dan FLAC.',
    ],
    steps: [
      'Unggah file audio dari perangkat Anda ke Audio Editor.',
      'Gunakan waveform untuk memilih rentang potong atau aktifkan panel EQ, Bass Boost, Stem Vokal, maupun efek lainnya.',
      'Tekan Putar untuk pratinjau, lalu pilih format dan kualitas pada tombol Ekspor.',
    ],
    troubleshooting: [
      'Jika pratinjau tidak terdengar, pastikan volume perangkat aktif dan browser tidak sedang dibisukan.',
      'Untuk audio berdurasi sangat panjang (>20 menit), ekspor ke MP3 atau WAV standar agar memori perangkat tetap ringan.',
    ],
  },
  {
    id: 'songfinder',
    name: 'Cari Judul Lagu',
    category: 'Hiburan & Media',
    keywords: ['cari judul lagu', 'judul lagu', 'shazam', 'deteksi lagu', 'mikrofon', 'sumber video', 'rekam suara'],
    summary: 'Temukan judul lagu, artis, atau sumber video dari potongan audio, mikrofon, atau video.',
    details: [
      'Menerima input rekaman mikrofon langsung, unggahan file audio, maupun potongan file video.',
      'Menganalisis metadata, sidik suara akustik, dan memberikan tautan pencocokan musik & video sosial media.',
    ],
    steps: [
      'Buka Cari Judul Lagu lalu pilih metode: Rekam Mikrofon atau Unggah File Audio/Video.',
      'Rekam bagian musik yang paling jelas (sekitar 8–15 detik) atau pilih file potongan.',
      'Tunggu hasil identifikasi judul lagu dan artis muncul.',
    ],
    troubleshooting: [
      'Jika mikrofon tidak aktif, izinkan akses Mikrofon pada pengaturan browser Anda.',
      'Kurangi kebisingan sekitar dan dekatkan perangkat ke sumber suara agar akurasi lebih tinggi.',
    ],
  },
  {
    id: 'plagiarism',
    name: 'Cek Plagiarisme',
    category: 'AI & Dokumen',
    keywords: ['plagiarisme', 'plagiat', 'skripsi', 'makalah', 'kemiripan', 'ocr', 'no repository', 'laporan pdf', 'cek dokumen'],
    summary: 'Pindai kemiripan naskah PDF, Word, teks, dan gambar scan OCR dengan laporan PDF siap unduh.',
    details: [
      'Menerapkan prinsip No Repository sehingga naskah Anda tidak disimpan ke database mana pun.',
      'Menampilkan halaman asli dokumen lengkap dengan penandaan bagian mirip serta ringkasan persentase dan laporan PDF yang dapat diunduh.',
    ],
    steps: [
      'Buka Cek Plagiarisme lalu unggah file PDF/DOCX/gambar scan atau tempel teks naskah.',
      'Tekan Mulai Pindai dan tunggu proses ekstraksi & pencocokan selesai.',
      'Tinjau bagian yang ditandai pada halaman asli dan klik Unduh Laporan PDF bila diperlukan.',
    ],
    troubleshooting: [
      'Untuk PDF hasil scan gambar buram, pastikan resolusi gambar cukup jelas agar pembacaan OCR akurat.',
      'Jika file terlalu besar, pisahkan per bab agar pemindaian lebih cepat dan stabil.',
    ],
  },
  {
    id: 'novel',
    name: 'Novel Terpadu',
    category: 'AI & Dokumen',
    keywords: ['novel', 'baca novel', 'cerita', 'bab', 'chapter', 'audiobook', 'tema baca', 'font baca'],
    summary: 'Baca 200+ novel lintas platform dengan 122+ tema halaman dan mode Audiobook.',
    details: [
      'Menghimpun bacaan dari 14+ sumber dengan pembersih teks otomatis, 122+ tema warna/tipografi, pengaturan ukuran huruf, mode layar penuh, penanda bab terakhir otomatis, dan Audiobook.',
    ],
    steps: [
      'Buka Novel Terpadu, cari judul atau telusuri koleksi yang tersedia.',
      'Pilih bab untuk mulai membaca; ketuk tombol Tema/Pengaturan untuk mengganti warna kertas dan ukuran font.',
      'Aktifkan tombol Audiobook jika ingin mendengarkan bab dibacakan dengan suara.',
    ],
    troubleshooting: [
      'Jika bab tidak langsung termuat, tekan Muat Ulang Bab atau coba sumber alternatif.',
      'Riwayat bacaan disimpan lokal di browser—jangan hapus data situs jika ingin menyimpan posisi bab terakhir.',
    ],
  },
  {
    id: 'prayer',
    name: 'Jadwal Sholat',
    category: 'Harian & Keamanan',
    keywords: ['jadwal sholat', 'sholat', 'salat', 'imsak', 'subuh', 'dzuhur', 'ashar', 'maghrib', 'isya', 'adzan', 'kemenag', 'gps'],
    summary: 'Jadwal Imsak hingga Isya resmi standar Kemenag RI se-Indonesia dengan GPS otomatis.',
    details: [
      'Mencakup seluruh kota & kabupaten di Indonesia sesuai standar Kemenag RI, lengkap dengan hitung mundur menuju waktu sholat berikutnya.',
      'Mendukung deteksi GPS otomatis maupun pemilihan kota secara manual.',
    ],
    steps: [
      'Buka Jadwal Sholat; izinkan akses lokasi (GPS) agar kota terdeteksi otomatis, atau ketik nama kota Anda di kolom pilih lokasi.',
      'Lihat jadwal hari ini beserta hitung mundur waktu adzan berikutnya.',
    ],
    troubleshooting: [
      'Jika lokasi tidak terdeteksi otomatis, periksa izin Lokasi di browser atau langsung pilih kota Anda secara manual di kolom pencarian kota.',
    ],
  },
  {
    id: 'weather',
    name: 'Prakiraan Cuaca',
    category: 'Harian & Keamanan',
    keywords: ['cuaca', 'hujan', 'suhu', 'angin', 'indeks uv', 'radar hujan', 'prakiraan', 'bmkg'],
    summary: 'Pantau suhu aktual, radar curah hujan per jam, indeks UV, angin, dan prakiraan 7 hari.',
    details: [
      'Menampilkan suhu saat ini, terasa seperti (feels like), kelembapan, kecepatan angin, indeks UV, grafik curah hujan per jam, dan ramalan cuaca 7 hari ke depan.',
    ],
    steps: [
      'Buka Prakiraan Cuaca lalu gunakan deteksi lokasi GPS atau ketik nama kota yang ingin dicek.',
      'Geser kartu per jam atau 7 hari untuk melihat perubahan cuaca dan peluang hujan.',
    ],
    troubleshooting: [
      'Jika cuaca menampilkan kota lama, tekan tombol Deteksi GPS atau ketik ulang nama kecamatan/kota Anda.',
    ],
  },
  {
    id: 'worldclock',
    name: 'Jam Dunia & Globe',
    category: 'Harian & Keamanan',
    keywords: ['jam dunia', 'globe', 'bola dunia', 'zona waktu', 'utc', 'wib', 'wita', 'wit', 'negara'],
    summary: 'Bandingkan zona waktu kota-kota dunia secara real-time dengan globe 3D interaktif.',
    details: [
      'Menampilkan bola dunia 3D yang bisa diputar, perbandingan jam WIB/WITA/WIT dengan kota internasional, serta selisih jam UTC.',
    ],
    steps: [
      'Buka Jam Dunia & Globe untuk melihat jam lokal dan kota-kota utama dunia.',
      'Putar globe 3D dengan jari/mouse atau tambahkan kota lain untuk membandingkan selisih waktunya.',
    ],
    troubleshooting: [
      'Pastikan jam & tanggal perangkat Anda disetel otomatis agar konversi zona waktu tetap presisi.',
    ],
  },
  {
    id: 'speedtest',
    name: 'Speedtest',
    category: 'Harian & Keamanan',
    keywords: ['speedtest', 'kecepatan internet', 'wifi', 'ping', 'jitter', 'download', 'upload', 'lemot', 'jaringan'],
    summary: 'Ukur kecepatan unduh, unggah, ping, dan jitter jaringan Anda secara real-time.',
    details: [
      'Mengukur kecepatan Download, Upload, Ping (latensi), dan Jitter lengkap dengan jarum speedometer langsung dan penilaian kualitas untuk streaming/gaming/meeting.',
    ],
    steps: [
      'Buka fitur Speedtest lalu tekan tombol Mulai Uji.',
      'Tunggu beberapa detik hingga uji Ping, Download, dan Upload selesai seluruhnya.',
    ],
    troubleshooting: [
      'Hentikan sementara unduhan besar atau streaming di perangkat lain agar hasil pengukuran akurat.',
      'Jika hasil ping tinggi, coba pindah posisi lebih dekat ke router WiFi atau ganti ke jaringan 4G/5G yang stabil.',
    ],
  },
  {
    id: 'callerid',
    name: 'Cek Nomor',
    category: 'Harian & Keamanan',
    keywords: ['cek nomor', 'nomor telepon', 'spam', 'penipuan', 'caller id', 'operator', 'getcontact', 'hotline', 'nomor tak dikenal'],
    summary: 'Cek identitas operator, wilayah, hotline resmi, dan indikasi spam/penipuan nomor telepon.',
    details: [
      'Mendeteksi operator seluler, kode area telepon rumah/wilayah, direktori hotline resmi bank/instansi, serta analisis pola nomor indikasi spam & penipuan.',
    ],
    steps: [
      'Buka Cek Nomor lalu masukkan nomor telepon yang ingin diperiksa (format 08... atau +62...).',
      'Tekan Periksa Nomor untuk melihat hasil operator, area, dan status keamanan nomor.',
    ],
    troubleshooting: [
      'Masukkan angka nomor dengan benar tanpa huruf. Jika nomor baru dan belum tercatat laporan publik, tetap waspada dan jangan pernah membagikan kode OTP kepada siapa pun.',
    ],
  },
]);

export const PLATFORM_GENERAL_KB = Object.freeze({
  installPwa:
    'Untuk memasang Manifestudio sebagai aplikasi (PWA): ketuk tombol **Install** di pojok kanan atas atau di bagian bawah halaman. Di Chrome/Edge Android & Desktop akan muncul dialog pasang langsung; di Safari iPhone/iPad, ketuk ikon **Bagikan (Share)** lalu pilih **Tambah ke Layar Utama**.',
  theme:
    'Anda bisa mengganti tampilan **Mode Terang / Mode Gelap** kapan saja melalui tombol ikon matahari/bulan di pojok kanan atas halaman.',
  privacy:
    'Seluruh 17 fitur Manifestudio gratis tanpa perlu login. Fitur pemrosesan berkas (Kompresor HD, Konversi File, Audio Editor, Cek Plagiarisme) berjalan lokal di perangkat Anda, dan riwayat akun SSH & VPN tersimpan aman hanya di penyimpanan lokal browser Anda.',
  navigation:
    'Dari beranda, ketuk salah satu ikon fitur untuk membuka halaman penuhnya. Di dalam halaman fitur, gunakan tombol **Semua Fitur** untuk kembali ke beranda atau ketuk tombol **Pindah Fitur** di kanan atas untuk berpindah cepat ke fitur lain.',
});

const CS_GREETING_RE =
  /^(p+|ping|halo+|hai+|hi+|hey+|permisi|assalamualaikum|selamat\s+(pagi|siang|sore|malam)|tes+|test+)[\s!?.]*$/i;

// Flexible courtesy/gratitude/closing detection — catches natural Indonesian sentences like
// "Terimakasih atas informasinya", "Makasih banyak ya min infonya sangat membantu",
// "Oke paham kak, sudah berhasil", etc., as long as the user is NOT asking a follow-up question.
const CS_COURTESY_CORE_RE =
  /\b(terima\s*kasih|terimakasih|makasih+|makasi+|mksh|thanks?|thank\s*you|tq|thx|ty|tengkyu|syukron|hatur\s*nuhun|sama[\s-]*sama|alhamdulillah|oke+|ok+|okay|okey|sip+|siap+|baik+|baiklah|mantap+|keren+|bagus+|hebat+|paham+|mengerti|jelas+|noted|done|berhasil|sukses|sudah\s*bisa|udah\s*bisa|work+|dadah|bye+)\b/i;

const CS_QUESTION_OR_PROBLEM_SIGNAL_RE =
  /(\?|\b(kenapa|mengapa|gimana|bagaimana|cara|apa|apakah|kapan|dimana|di\s*mana|siapa|berapa|bisa\s*(?:gak|nggak|tidak|kah)|tolong|bantu|tanya|error|eror|gagal|macet|ngelag|lag|lemot|buffering|tidak\s*(?:bisa|lengkap|muncul|jalan|keluar)|gak\s*(?:bisa|lengkap|muncul|jalan)|nggak\s*(?:bisa|lengkap|muncul)|belum\s*(?:bisa|lengkap|muncul)|kendala|masalah|rusak|patah|bug|tapi|tetapi|namun|cuma|hanya|masih)\b)/i;

const CS_RESTRICTED_RE =
  /\b(manifestore|katalog\s*(?:produk|akun|store|toko)|akun\s+premium|beli\s+(?:akun|capcut|netflix|canva|spotify|youtube\s+premium|viu|vidio|wetv|prime|zoom|gemini|turnitin)|harga\s+(?:capcut|netflix|canva|spotify|youtube|viu|vidio|wetv|prime|zoom|turnitin|akun|paket)|cara\s+(?:order|pesan|beli|checkout)|bayar\s+(?:nanti|belakangan)|kode\s*voucher|(?:kode|kunci)\s*akses|password\s*(?:store|admin|brankas)|tmctomystudio|(?:nomor|no\.?|kontak|link|akun)\s*(?:wa|whatsapp|instagram|ig|tiktok|admin|owner|pemilik|tomy)|whatsapp\s*(?:admin|owner|tomy)|instagram\s*(?:admin|owner|tomy|resmi)|tiktok\s*(?:admin|owner|tomy|resmi)|cloudflare\s*kv|pbkdf2|hmac|admin\.html|catalog\.json)\b/i;

const CS_CLEAR_OFF_TOPIC_RE =
  /\b(resep|masak(?:an)?|memasak|nasi\s*goreng|presiden|sejarah|perang\s*dunia|puisi|pantun|cerpen|lirik\s*lengkap|coding|koding|python|javascript|java\b|c\+\+|php\b|html\b|css\b|react\b|sql\b|quicksort|algoritma|matematika|kalkulus|integral|turunan|fisika|kimia|biologi|rumus\s*(?:luas|volume|fisika|kimia|excel)|terjemahkan|translate|curhat|galau|ramalan|zodiak|shio|saham|kripto|crypto|bitcoin|buatkan\s*(?:makalah|esai|essay|artikel|surat|cv|caption|kode|program|script|skrip|cerita|soal)|siapa\s+(?:penemu|presiden|raja|pahlawan|pemain|artis)|ibukota|ibu\s*kota|hitung(?:kan)?\s+\d+)\b/i;

const CS_MANIFESTUDIO_CONTEXT_RE =
  /\b(manifestudio|tanya\s*fitur|fitur|menu|utilitas|manifest\s*ai|drama|dracin|episode|yt\s*music|musik|download(?:er)?|shortlink|bypass|safelink|peramban|proxy|vpn|incognito|vidmate|kompres(?:or)?|konversi|audio\s*editor|cari\s*judul\s*lagu|plagiarisme|plagiat|novel|sholat|cuaca|jam\s*dunia|globe|speedtest|cek\s*nomor|pwa|install|tema|dark\s*mode|light\s*mode)\b/i;

const CS_CONTACT_CHANNEL_RE =
  /\b(wa|whatsapp|instagram|\big\b|tiktok|sosmed|media\s*sosial|email|gmail|nomor\s*(?:hp|telp|wa)|kontak)\b/i;

const CS_OWNER_TARGET_RE = /\b(admin|owner|pemilik|tomy|tuan|pribadi)\b/i;

const CS_MEDIA_TOOL_ACTION_RE =
  /\b(download(?:er)?|unduh|watermark|kompres(?:or)?|perkecil|konversi|convert|reels|story|carousel|mp3|mp4|shortlink|bypass|proxy|vpn|vidmate)\b/i;

/**
 * AI-First / Blocklist-Only classifier for the "Tanya Fitur" Customer Service drawer.
 * - Immediately intercepts only: empty, short greeting, natural courtesy/thanks,
 *   Store/Contact/System privacy probes, and unmistakable general off-topic requests.
 * - Routes ALL other natural user questions, complaints, slang, and troubleshooting
 *   directly to the Manifest AI CS engine ('feature_support') so visitors NEVER hit
 *   false off-topic rejections like "Ngelag ketika menonton drama" or "Drama tidak lengkap".
 *
 * @param {string} prompt
 * @param {{ hasContext?: boolean, activeTabId?: string }} [opts]
 * @returns {'empty' | 'greeting' | 'courtesy' | 'restricted_leak' | 'feature_support' | 'off_topic'}
 */
export function classifyFeatureCsIntent(prompt = '', { hasContext = false, activeTabId = '' } = {}) {
  const clean = String(prompt || '').trim();
  if (!clean) return 'empty';
  if (CS_GREETING_RE.test(clean)) return 'greeting';

  // 1. Strict confidentiality firewall (Manifestore, Store, Contacts, Admin internals)
  if (
    CS_RESTRICTED_RE.test(clean) ||
    (CS_CONTACT_CHANNEL_RE.test(clean) && CS_OWNER_TARGET_RE.test(clean) && !CS_MEDIA_TOOL_ACTION_RE.test(clean))
  ) {
    return 'restricted_leak';
  }

  // 2. Natural polite courtesies / closings (e.g., "Terimakasih atas informasinya", "Oke paham min")
  const wordCount = clean.split(/\s+/).filter(Boolean).length;
  if (
    wordCount <= 12 &&
    CS_COURTESY_CORE_RE.test(clean) &&
    !CS_QUESTION_OR_PROBLEM_SIGNAL_RE.test(clean) &&
    !CS_MANIFESTUDIO_CONTEXT_RE.test(clean)
  ) {
    return 'courtesy';
  }

  // 3. Unambiguous off-topic requests (coding, recipes, poems, math, politics, etc.)
  //    ONLY blocked when the message does NOT mention any Manifestudio feature.
  if (CS_CLEAR_OFF_TOPIC_RE.test(clean) && !CS_MANIFESTUDIO_CONTEXT_RE.test(clean)) {
    return 'off_topic';
  }

  // 4. AI-First default: let Manifest AI CS handle all natural questions, complaints,
  //    troubleshooting, and follow-ups intelligently (context & activeTabId stay passed into prompt).
  void hasContext;
  void activeTabId;
  return 'feature_support';
}

export function buildFeatureCsGreetingReply() {
  return [
    'Halo! Selamat datang di **Tanya Fitur — Layanan Bantuan Manifestudio**.',
    '',
    'Saya siap membantu menjelaskan cara pakai, keunggulan, format yang didukung, hingga solusi jika ada kendala pada **17 fitur Manifestudio** (seperti Manifest AI, SSH & VPN, Drama Pendek, YT Music, Downloader, Shortlink Bypass, Kompresor HD, Konversi File, Audio Editor, Cek Plagiarisme, Novel, Jadwal Sholat, Cuaca, Speedtest, Cek Nomor, dan lainnya).',
    '',
    'Ada fitur atau kendala apa yang bisa saya bantu hari ini?',
  ].join('\n');
}

export function buildFeatureCsCourtesyReply(prompt = '') {
  const lower = String(prompt || '').toLowerCase();
  if (/\b(terima\s*kasih|terimakasih|makasih|makasi|mksh|thanks?|thank\s*you|tq|thx|ty|tengkyu|syukron|hatur\s*nuhun)\b/i.test(lower)) {
    return 'Sama-sama! Senang sekali bisa membantu. Jika nanti ada pertanyaan lain atau mengalami kendala pada salah satu dari **17 fitur Manifestudio**, silakan chat di **Tanya Fitur** kapan saja ya!';
  }
  if (/\b(berhasil|sudah\s*bisa|udah\s*bisa|work|mantap|keren|bagus|hebat)\b/i.test(lower)) {
    return 'Senang mendengarnya! Semoga fitur Manifestudio terus membantu aktivitas Anda. Kalau butuh panduan fitur lainnya, tinggal tanya saja di sini.';
  }
  return 'Siap, senang bisa membantu! Jika ada fitur lain yang ingin Anda pelajari atau ada kendala saat menggunakannya, silakan tanyakan kapan saja.';
}

export function buildFeatureCsRestrictedReply() {
  return [
    'Mohon maaf, **Tanya Fitur** hanya melayani pertanyaan seputar penggunaan dan pemecahan kendala pada **17 fitur gratis di Manifestudio**.',
    '',
    'Saya tidak memiliki akses maupun informasi mengenai layanan eksternal, kontak pribadi, akun media sosial, ataupun pengaturan internal. Ada fitur Manifestudio yang ingin saya bantu jelaskan?',
  ].join('\n');
}

export function buildFeatureCsOffTopicReply() {
  return [
    'Mohon maaf, menu **Tanya Fitur** dirancang khusus sebagai Customer Service untuk membantu pertanyaan seputar **17 fitur Manifestudio** dan pemecahan kendala pengguna.',
    '',
    'Untuk pertanyaan umum di luar fitur Manifestudio (seperti coding, tugas, tulisan, riset, matematika, atau obrolan bebas), silakan buka menu **Manifest AI** — asisten AI universal kami siap membantu topik apa saja!',
  ].join('\n');
}

/**
 * Builds the strict Customer Service system prompt grounded in all 17 verified features.
 */
export function buildFeatureCsSystemPrompt(activeTabId = '') {
  const activeFeat = FEATURE_CS_KNOWLEDGE_BASE.find((f) => f.id === activeTabId);
  const kbText = FEATURE_CS_KNOWLEDGE_BASE.map(
    (f, idx) =>
      `${idx + 1}. ${f.name} (${f.category}): ${f.summary}\n   - Fakta: ${f.details.join(' ')}\n   - Cara pakai: ${f.steps.join(' ')}\n   - Solusi kendala: ${f.troubleshooting.join(' ')}`
  ).join('\n');

  return [
    'Kamu adalah Customer Service resmi "Tanya Fitur" di Manifestudio (bertenaga Manifest AI).',
    'Gaya bahasa: Ramah, empatik, cerdas, solutif, ringkas, terstruktur (gunakan poin langkah yang jelas), berbahasa Indonesia natural layaknya CS manusia profesional.',
    activeFeat
      ? `Konteks halaman saat ini: Pengunjung sedang membuka fitur "${activeFeat.name}". Jika pertanyaan merujuk "fitur ini", "halaman ini", atau keluhan umum, prioritaskan menjelaskan "${activeFeat.name}".`
      : 'Konteks halaman saat ini: Pengunjung sedang berada di Beranda Manifestudio.',
    'ATURAN KETAT (WAJIB DIPATUHI 100%):',
    '1. PAHAMI KELUHAN NATURAL PENGGUNA: Tangani keluhan sehari-hari pengunjung dengan cerdas dan empatik (misalnya "ngelag ketika menonton drama", "drama tidak lengkap", "link penuh iklan", "video tidak ada suara", "file gagal diubah") berdasarkan fakta fitur di bawah ini. JANGAN PERNAH menolak keluhan atau pertanyaan fitur hanya karena gaya bahasanya santai atau singkat.',
    '2. RUANG LINGKUP TERBATAS (KHUSUS CS MANIFESTUDIO): HANYA jawab pertanyaan mengenai 17 fitur Manifestudio, cara penggunaan, format/batasan nyata, privasi, install aplikasi (PWA), tema terang/gelap, dan pemecahan masalah/kendala pengunjung.',
    '3. TOLAK HANYA TOPIK JELAS DI LUAR FITUR: Jika pengguna menanyakan topik umum yang sama sekali tidak terkait Manifestudio (tugas sekolah, coding, resep, puisi, sejarah, matematika, politik, berita, curhat), tolak dengan ramah dan arahkan ke menu "Manifest AI" yang bersifat universal.',
    '4. FAKTA & DATA 100% AKURAT: Gunakan HANYA fakta dari basis pengetahuan di bawah ini. Jangan pernah mengarang tombol, fitur, atau batasan yang tidak ada.',
    '5. KERAHASIAAN MUTLAK: DILARANG KERAS menyebut, mengonfirmasi, atau membocorkan nama toko/store eksternal, katalog akun berbayar, harga produk, WhatsApp, Instagram, TikTok, email, ataupun istilah teknis sistem/admin.',
    '6. FORMAT RAPI UNTUK HP: Jawab dengan daftar bernomor atau bullet singkat yang enak dibaca di layar HP. DILARANG memakai tag HTML mentah seperti `<br>` dan hindari tabel Markdown lebar.',
    '7. RESPON HUMANIS: Jika pengunjung mengucapkan terima kasih, oke, paham, atau puas, balas dengan hangat layaknya CS manusia sungguhan.',
    '',
    '=== BASIS PENGETAHUAN RESMI MANIFESTUDIO (17 FITUR) ===',
    kbText,
    '',
    '=== INFORMASI PLATFORM UMUM ===',
    `- Install PWA: ${PLATFORM_GENERAL_KB.installPwa}`,
    `- Tema: ${PLATFORM_GENERAL_KB.theme}`,
    `- Privasi: ${PLATFORM_GENERAL_KB.privacy}`,
    `- Navigasi: ${PLATFORM_GENERAL_KB.navigation}`,
  ].join('\n');
}

/**
 * Deterministic factual fallback from verified KB if external AI gateways are busy.
 */
export function buildFeatureCsLocalFallback(prompt = '', activeTabId = '', { hasContext = false } = {}) {
  const lower = String(prompt || '').toLowerCase();
  const intent = classifyFeatureCsIntent(prompt, { hasContext, activeTabId });
  if (intent === 'greeting') return buildFeatureCsGreetingReply();
  if (intent === 'courtesy') return buildFeatureCsCourtesyReply(prompt);
  if (intent === 'restricted_leak') return buildFeatureCsRestrictedReply();
  if (intent === 'off_topic') return buildFeatureCsOffTopicReply();

  if (/\b(install|instal|pwa|layar\s*utama|pasang\s*aplikasi)\b/i.test(lower)) {
    return `${PLATFORM_GENERAL_KB.installPwa}\n\nJika tombol Install belum muncul, pastikan Anda membuka situs memakai browser modern (Chrome, Edge, atau Safari).`;
  }
  if (/\b(tema|dark\s*mode|light\s*mode|mode\s*(gelap|terang))\b/i.test(lower)) {
    return PLATFORM_GENERAL_KB.theme;
  }
  if (/\b(daftar\s*fitur|semua\s*fitur|ada\s*fitur\s*apa|fitur\s*apa\s*saja)\b/i.test(lower)) {
    const list = FEATURE_CS_KNOWLEDGE_BASE.map((f, i) => `${i + 1}. **${f.name}** — ${f.summary}`).join('\n');
    return `Manifestudio menyediakan **17 fitur gratis tanpa login**:\n\n${list}\n\nKetuk salah satu ikon fitur di beranda untuk langsung menggunakannya!`;
  }

  // Targeted smart troubleshooting for common Drama Pendek complaints
  if (/\b(drama|dracin|episode|eps|nonton|menonton)\b/i.test(lower)) {
    if (/\b(ngelag|lag|patah|buffering|macet|lemot|lambat|muter)\b/i.test(lower)) {
      return [
        'Maaf atas ketidaknyamanannya! Jika video terasa **ngelag atau buffering** saat menonton **Drama Pendek**, coba langkah berikut:',
        '',
        '1. **Cek kestabilan internet** — Anda bisa mengecek kecepatan dan ping jaringan terlebih dahulu melalui fitur **Speedtest** di Manifestudio.',
        '2. **Segarkan atau ganti sumber platform** — cari judul yang sama di kolom pencarian Drama Pendek untuk mencoba server dari platform lain yang sedang lebih lancar.',
        '3. **Ringankan memori perangkat** — tutup tab atau aplikasi berat lain di latar belakang, lalu aktifkan mode **Layar Bersih** di pemutar.',
        '4. **Muat ulang halaman** jika video macet di satu episode tertentu.',
      ].join('\n');
    }
    if (/\b(tidak\s*lengkap|gak\s*lengkap|nggak\s*lengkap|belum\s*lengkap|terpotong|kurang|hilang|sedikit|tamat)\b/i.test(lower)) {
      return [
        'Terkait **episode Drama Pendek yang belum lengkap**:',
        '',
        '1. **Status drama masih tayang (ongoing)** — daftar episode mengikuti rilis terbaru dari platform sumbernya, sehingga episode baru akan otomatis muncul setelah sumber memperbaruinya.',
        '2. **Coba platform sumber lain** — ketik judul drama tersebut di kolom pencarian **Drama Pendek**, karena satu judul yang sama sering tersedia di beberapa platform berbeda dan versi sumber lain bisa jadi sudah lengkap hingga tamat.',
        '3. **Gunakan daftar episode cepat** — ketuk tombol daftar episode di pemutar untuk memastikan tidak ada nomor episode yang terlewat.',
      ].join('\n');
    }
  }

  // Score matching features from KB
  let best = null;
  let bestScore = 0;
  for (const feat of FEATURE_CS_KNOWLEDGE_BASE) {
    let score = 0;
    for (const kw of feat.keywords) {
      if (lower.includes(kw)) score += kw.length >= 6 ? 4 : 2;
    }
    if (lower.includes(feat.name.toLowerCase())) score += 6;
    if (score > bestScore) {
      bestScore = score;
      best = feat;
    }
  }

  // If user is inside a dedicated tool page and describes a generic issue
  if (!best && activeTabId) {
    best = FEATURE_CS_KNOWLEDGE_BASE.find((f) => f.id === activeTabId) || null;
  }

  if (best) {
    const isTroubleshooting =
      /\b(error|eror|gagal|macet|ngelag|lag|patah|lemot|buffering|tidak\s*(?:bisa|lengkap|muncul|jalan|keluar)|gak\s*(?:bisa|lengkap|muncul)|nggak\s*(?:bisa|lengkap)|belum\s*lengkap|kendala|masalah|solusi|rusak|bug)\b/i.test(
        lower
      );
    const lines = [`Berikut panduan **${best.name}** (${best.category}):`, '', best.summary, ''];
    if (isTroubleshooting) {
      lines.push('**Langkah Pemecahan Kendala:**');
      best.troubleshooting.forEach((t, i) => lines.push(`${i + 1}. ${t}`));
      lines.push('', '**Cara Penggunaan Singkat:**');
      best.steps.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
    } else {
      lines.push('**Detail Fitur:**');
      best.details.forEach((d) => lines.push(`- ${d}`));
      lines.push('', '**Cara Menggunakan:**');
      best.steps.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
    }
    return lines.join('\n');
  }

  return [
    'Saya siap membantu seputar **17 fitur Manifestudio** (Manifest AI, SSH & VPN, Drama Pendek, YT Music, Downloader, Shortlink Bypass, Kompresor HD, Konversi File, Audio Editor, Cari Judul Lagu, Cek Plagiarisme, Novel Terpadu, Jadwal Sholat, Prakiraan Cuaca, Jam Dunia & Globe, Speedtest, dan Cek Nomor).',
    '',
    'Boleh ceritakan fitur mana yang sedang Anda gunakan dan kendala apa yang muncul agar saya bisa berikan solusi yang paling tepat?',
  ].join('\n');
}

/**
 * Post-output sanitizer ensuring CS responses never leak Store/Contacts, raw system internals,
 * or ugly raw HTML tags like `<br>` inside Markdown bubbles/tables.
 */
export function sanitizeFeatureCsReply(text = '') {
  let out = String(text || '').trim();
  if (!out) return '';
  // Normalize raw HTML <br> tags safely: inline bullet inside Markdown table rows, real newline outside
  out = out
    .split('\n')
    .map((line) => {
      if (/^\s*\|.*\|\s*$/.test(line)) {
        return line.replace(/<br\s*\/?>/gi, ' · ');
      }
      return line.replace(/<br\s*\/?>/gi, '\n');
    })
    .join('\n');
  out = out.replace(/<\/?(?:p|div|span|b|i|strong|em|ul|ol|li|table|tr|td|th|thead|tbody)[^>]*>/gi, '');
  out = out.replace(/https?:\/\/(?:www\.)?manifestore\.my\.id[^\s)]*/gi, 'https://manifestudio.my.id/');
  out = out.replace(/\bmanifestore(?:\.my\.id)?\b/gi, 'layanan terkait');
  out = out.replace(/https?:\/\/(?:wa\.me|api\.whatsapp\.com|www\.instagram\.com|instagram\.com|www\.tiktok\.com|tiktok\.com)[^\s)]*/gi, '[tautan dilindungi]');
  out = out.replace(/(?:\+?62|0)[\s\u00A0\u202F\-–—‑.]*8(?:[\s\u00A0\u202F\-–—‑.]*\d){7,12}/g, '[kontak dilindungi]');
  out = out.replace(/@?\btmc[a-z0-9_]*studio[a-z0-9_]*\b/gi, '[dilindungi]');
  out = out.replace(/\b(?:STORE_ACCESS_KV|Cloudflare\s*KV|PBKDF2(?:-SHA256)?|HMAC-SHA256|HttpOnly|admin\.html|catalog\.json|Server\s*Vault)\b/gi, 'sistem');
  return out;
}
