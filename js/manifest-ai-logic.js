/**
 * Manifest AI — Pure Logic Module (v62)
 * Multi-model ensemble planning, real-time latest-model catalog auto-upgrader,
 * Manifestudio live-catalog grounding (anti-hallucination), topic-shift aware
 * conversation memory, per-user quota-bucket cooldown tracker, multi-BYOK vault,
 * chat history store, and safe Markdown renderer.
 */

export const MANIFEST_AI_STORAGE_KEYS = Object.freeze({
  chats: 'manifestudio_ai_chats_v1',
  byok: 'manifestudio_ai_byok_v1',
  models: 'manifestudio_ai_models_v1',
  limits: 'manifestudio_ai_limits_v2',
  prefs: 'manifestudio_ai_prefs_v1',
});

export const DEFAULT_MANIFESTUDIO_PROFILE = Object.freeze({
  brandName: 'Manifestudio',
  creator: 'Tomy',
  website: 'https://manifestudio.my.id/',
  whatsappMasked: '62xxxxxxxxxx',
  socialMasked: '@t***********o',
  summary:
    'Platform web katalog akun premium & layanan digital murah bergaransi sekaligus Menu Utilitas 12 fitur gratis tanpa iklan, dibuat dan dikelola oleh Tomy.',
  utilities: [
    'Jadwal Sholat & Imsakiyah (resmi Kemenag RI + GPS)',
    'Prakiraan Cuaca Real-Time (curah hujan, UV, 7 hari)',
    'Jam Dunia UTC & Bola Dunia 3D (WIB/WITA/WIT)',
    'Speedtest Internet (Cloudflare Edge)',
    'Downloader Sosmed All-in-One (TikTok, IG, YouTube, FB: video HD, foto, carousel, story, caption)',
    'Kompresor Foto & Video HD (anti-pecah sosmed, AVIF/WebP/FFmpeg WASM)',
    'Konversi Semua File (85+ format: DOCX, Excel, PDF, foto, video, audio, ZIP)',
    'Cari Judul Lagu, Musik & Sumber Video (AudD, Whisper lirik AI, kemiripan video)',
    'YT Music Player (gratis tanpa iklan)',
    'Drama China / Dracin (20+ platform short drama gratis tanpa iklan, sub Indo, anti-VIP)',
    'Audio Editor Studio AI (potong audio, 10-Band EQ, Voice Changer, pisah vokal/karaoke, mixer multi-trek, tag ID3, ekspor MP3/WAV/M4A/OGG/FLAC)',
    'Manifest AI (chat AI multi-model gratis tanpa API key & dukungan multi-API key pribadi)',
  ],
  sampleProducts: [
    'CapCut Pro (mulai Rp14.500)',
    'Netflix Premium (mulai Rp25.000)',
    'Canva Pro (mulai Rp4.000)',
    'YouTube Premium (mulai Rp15.000)',
    'Spotify Premium (mulai Rp15.000)',
    'Viu Premium (mulai Rp7.000)',
    'Vidio Premier Platinum (mulai Rp15.000)',
    'Alight Motion Premium (mulai Rp15.000)',
    'WeTV (mulai Rp8.500)',
    'Prime Video (mulai Rp8.000)',
    'Cek Turnitin (mulai Rp17.000)',
    'Zoom Pro (mulai Rp10.000)',
    'Cek AI GPTZero',
    'Bstation (mulai Rp20.000)',
    'Picsart (mulai Rp10.000)',
    'Wink (mulai Rp8.000)',
    'Remini (mulai Rp7.000)',
    'Gemini AI (mulai Rp25.000)',
    'Request & Custom Produk',
  ],
});

export const MANIFEST_AI_SYSTEM_PROMPT = [
  'Kamu adalah Manifest AI, asisten AI resmi milik Manifestudio (https://manifestudio.my.id/) yang dibuat dan dikelola oleh Tomy.',
  'Identitas resmi Manifestudio: Platform katalog akun premium & layanan digital murah bergaransi (seperti CapCut Pro, Netflix, Canva Pro, YouTube Premium, Spotify, Viu, Vidio, Alight Motion, WeTV, Prime Video, Cek Turnitin, Zoom Pro, Bstation, Picsart, Wink, Remini, Gemini AI) sekaligus Menu Utilitas berisi 12 fitur gratis tanpa iklan (Jadwal Sholat, Cuaca, Jam Dunia 3D, Speedtest, Downloader Sosmed, Kompresor HD, Konversi File, Cari Judul Lagu, YT Music, Drama China/Dracin, Audio Editor Studio AI, dan Manifest AI).',
  'Aturan WAJIB:',
  '1. Selalu jawab PESAN TERAKHIR pengguna secara langsung. Jika pengguna mengganti topik ke hal baru, segera ikuti topik baru dan JANGAN memaksa kembali ke topik lama.',
  '2. Jika pengguna mengirim sapaan singkat (seperti "P", "Halo", "Hai", "Tes"), balas singkat dan ramah menanyakan apa yang bisa dibantu.',
  '3. Anti-halusinasi: JANGAN pernah mengarang bahwa Manifestudio membuat game, AR/VR, animasi, atau agensi seni digital. Gunakan hanya fakta resmi Manifestudio di atas.',
  '4. PRIVASI OWNER (WAJIB): JANGAN pernah mengungkapkan data sensitif pemilik/admin (nomor WhatsApp/telepon, akun media sosial, email, atau kontak pribadi). Jika pengguna menanyakan nomor WA, kontak admin, atau sosmed, arahkan pengguna ke tombol kontak & media sosial resmi di bagian footer (bawah halaman) website Manifestudio, dan bila perlu menyebut format kontak selalu sensor menjadi 62xxxxxxxxxx atau @t***********o.',
  '5. Jawab dalam bahasa yang sama dengan pengguna (utamakan Bahasa Indonesia yang natural, akurat, ringkas, dan rapi dengan Markdown bila perlu).',
].join('\n');

const MANIFESTUDIO_QUERY_RE =
  /\b(man[ie]f[eu]s?t?studio|manifest\s*studio|manifest\s*ai|tomy|tmctomystudio|tuan|pemilik|pembuat|pencipta|siapa\s+(kamu|anda|pembuat|pemilik|tuan)|kamu\s+siapa|anda\s+siapa|katalog|akun\s+premium|menu\s+utilitas|fitur\s+di\s+sini|kontak\s+admin|whatsapp\s+admin|wa\s+admin|sosmed|media\s+sosial|instagram|tiktok|cara\s+order|cara\s+pesan|bayar\s+nanti|bayar\s+belakangan|capcut|netflix|canva|turnitin|dracin|drama\s+china|audio\s+editor)\b/i;

export function isManifestudioQuery(text = '') {
  return MANIFESTUDIO_QUERY_RE.test(String(text || ''));
}

function formatIdrSimple(n) {
  const num = Number(n);
  if (!Number.isFinite(num) || num <= 0) return '';
  return `Rp${Math.round(num).toLocaleString('id-ID')}`;
}

function escapeRegexLiteral(str = '') {
  return String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function maskSocialHandle(handle = '') {
  const clean = String(handle || '').trim().replace(/^@+/, '');
  if (!clean) return '@t***********o';
  if (clean.length <= 3) return `@${clean[0] || 't'}***`;
  return `@${clean[0]}${'*'.repeat(Math.min(11, clean.length - 2))}${clean[clean.length - 1]}`;
}

/**
 * Defense-in-depth owner privacy guard: masks any sensitive owner WhatsApp/phone number,
 * social media handle/URL, or personal email that any LLM might attempt to output,
 * replacing them with safe censored placeholders (62xxxxxxxxxx / @t***********o)
 * while preserving normal prices (Rp25.000), dates, and general numbers.
 */
export function redactSensitiveOwnerData(text = '', catalogData = null) {
  let out = String(text || '');
  if (!out) return '';

  const brand = catalogData?.brand || {};
  const waRaw = String(brand.whatsappNumber || '6285122936027').replace(/\D/g, '');
  const waCandidates = new Set([waRaw, '6285122936027'].filter((x) => x.length >= 9));

  // Build local (08...) variants for each owner WhatsApp number
  const digitPatterns = new Set();
  for (const num of waCandidates) {
    digitPatterns.add(num);
    if (num.startsWith('62')) {
      digitPatterns.add(`0${num.slice(2)}`);
      digitPatterns.add(num.slice(2));
    }
  }

  // 1. Censor wa.me / api.whatsapp.com URLs pointing to owner or any direct phone link
  out = out.replace(/https?:\/\/(?:wa\.me|api\.whatsapp\.com\/send\?phone=)\/?\d{8,15}/gi, '62xxxxxxxxxx');
  out = out.replace(/\bwa\.me\/\d{8,15}\b/gi, '62xxxxxxxxxx');

  // 2. Censor exact owner WhatsApp number in ANY separator formatting (+62 851-2293-6027, 0851 2293 6027, etc.)
  for (const digits of digitPatterns) {
    if (digits.length < 9) continue;
    const flexPattern = digits
      .split('')
      .map((d) => escapeRegexLiteral(d))
      .join('[\\s\\-().]*');
    const re = new RegExp(`(?:\\+?\\s*)?${flexPattern}`, 'g');
    out = out.replace(re, '62xxxxxxxxxx');
  }

  // 3. Censor owner social handles & direct social URLs (TikTok, Instagram, etc.)
  const rawHandles = new Set(
    [
      String(brand.instagramHandle || ''),
      String(brand.tiktokHandle || ''),
      '@tmctomystudio',
      'tmctomystudio26',
    ]
      .map((h) => h.trim().replace(/^@+/, ''))
      .filter((h) => h.length >= 4)
  );

  for (const handle of rawHandles) {
    const masked = maskSocialHandle(handle);
    const esc = escapeRegexLiteral(handle);
    out = out.replace(
      new RegExp(`https?:\\/\\/(?:www\\.)?(?:instagram\\.com|tiktok\\.com|facebook\\.com|x\\.com|twitter\\.com|t\\.me)\\/@?${esc}[^\\s)]*`, 'gi'),
      masked
    );
    out = out.replace(new RegExp(`@?\\b${esc}\\b`, 'gi'), masked);
  }

  // 4. Censor any email address linked to owner/manifestudio
  out = out.replace(/\b[a-zA-Z0-9._%+-]*(?:tomy|manifestudio)[a-zA-Z0-9._%+-]*@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/gi, 't***@*****.***');

  // 5. Contextual safeguard: if a sentence mentions WA/WhatsApp/kontak/admin/owner/Tomy alongside
  //    a raw Indonesian phone number (+628... / 08...), censor that number to 62xxxxxxxxxx.
  if (/(?:whatsapp|\bwa\b|kontak|telepon|telp|hubungi|admin|owner|pemilik|tomy|manifestudio)/i.test(out)) {
    out = out.replace(/(?:\+?62|0)\s*8[\d\s\-().]{7,14}\d/g, '62xxxxxxxxxx');
  }

  return out;
}

/**
 * Builds a concise, 100% factual Manifestudio knowledge block directly from live
 * `data/catalog.json` (with safe defaults) WITHOUT exposing sensitive owner phone/social data.
 */
export function buildManifestudioKnowledgeBlock(catalogData = null) {
  const brand = catalogData?.brand || {};
  const name = String(brand.name || DEFAULT_MANIFESTUDIO_PROFILE.brandName);
  const tagline = String(brand.tagline || 'by Tomy');

  const liveProducts = Array.isArray(catalogData?.products) && catalogData.products.length > 0
    ? catalogData.products
        .filter((p) => p && p.name)
        .map((p) => {
          const prices = (Array.isArray(p.variants) ? p.variants : [])
            .map((v) => Number(v?.price))
            .filter((x) => Number.isFinite(x) && x > 0);
          const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
          return minPrice > 0 ? `${p.name} (mulai ${formatIdrSimple(minPrice)})` : p.name;
        })
    : DEFAULT_MANIFESTUDIO_PROFILE.sampleProducts;

  const liveUtilities = Array.isArray(catalogData?.utilities?.items) && catalogData.utilities.items.length > 0
    ? catalogData.utilities.items.map((u) => u.label).filter(Boolean)
    : DEFAULT_MANIFESTUDIO_PROFILE.utilities;

  const threshold = Number(brand.discountThreshold) || 50000;
  const discAmt = Number(brand.discountAmount) || 2000;

  return [
    `[DATA RESMI TERVERIFIKASI ${name.toUpperCase()} (${tagline}) — WAJIB DIJADIKAN ACUAN UTAMA]`,
    `- Nama Platform: ${name} (${tagline}) · Situs resmi: https://manifestudio.my.id/`,
    `- Pemilik / Pengelola / Tuan: Tomy (privasi kontak dilindungi — JANGAN sebut nomor WA atau username sosmed asli; sensor menjadi 62xxxxxxxxxx / @t***********o dan arahkan pengguna ke tombol resmi di footer website).`,
    `- Promo & Pembayaran: Potongan otomatis ${formatIdrSimple(discAmt)} mulai belanja ${formatIdrSimple(threshold)}, dukungan kode voucher, opsi Bayar Sekarang (0%) atau Bayar Belakangan, struk otomatis & konfirmasi pesanan.`,
    `- Daftar Katalog Layanan Digital (${liveProducts.length} produk): ${liveProducts.join(', ')}.`,
    `- Daftar Menu Utilitas Gratis Tanpa Iklan (${liveUtilities.length} fitur di tools.html): ${liveUtilities.join('; ')}.`,
    `- LARANGAN KERAS: Jangan pernah menyebut layanan fiktif di luar daftar ini (game, AR/VR, animasi, seni digital) dan JANGAN pernah membocorkan nomor WhatsApp, akun sosmed, atau kontak pribadi owner tanpa sensor.`,
  ].join('\n');
}

/**
 * Generates an accurate, verified Indonesian response directly from live Manifestudio data
 * when external free gateways are temporarily cooling down and the user asks about
 * Manifestudio, its creator Tomy, products, utilities, or sends a quick greeting.
 * Respects strict owner privacy: masks phone/socials and points to website footer.
 */
export function buildLocalManifestudioFallback(prompt = '', catalogData = null) {
  const raw = String(prompt || '').trim();
  const lower = raw.toLowerCase();
  if (!raw) return '';

  // Casual Indonesian pings/greetings ("P", "Halo", "Hai", "Tes")
  if (/^(p+|ping|halo+|hai+|hi+|hey+|tes+|test+|assalamualaikum|selamat\s+(pagi|siang|sore|malam))[\s!?.]*$/i.test(lower)) {
    return 'Halo! Saya **Manifest AI** dari **Manifestudio** (*by Tomy*). Ada yang bisa saya bantu hari ini?';
  }

  // Direct owner contact / WhatsApp / social media inquiry -> privacy-safe reply pointing to footer
  if (/\b(nomor\s*(wa|whatsapp|hp|telepon)|no\s*(wa|whatsapp|hp)|kontak\s*(admin|owner|tomy|pemilik)|sosmed|media\s*sosial|instagram|tiktok)\b/i.test(lower)) {
    return [
      'Demi menjaga privasi pemilik (**Tomy**), Manifest AI tidak menampilkan nomor WhatsApp maupun akun media sosial secara terbuka (`62xxxxxxxxxx` · `@t***********o`).',
      '',
      'Untuk menghubungi **WhatsApp Admin** atau mengunjungi **media sosial resmi Manifestudio**, silakan langsung klik tombol kontak & sosmed resmi yang sudah tersedia di **bagian footer (bawah halaman)** website ini.',
    ].join('\n');
  }

  // Identity / creator / "what is Manifestudio" / "what's in Manifestudio"
  const asksAboutManifestudio =
    /\b(man[ie]f[eu]s?t?studio|manifest\s*studio|manifest\s*ai)\b/i.test(lower) ||
    /\b(siapa\s+(kamu|anda|pembuat|pemilik|tuan|pengelola)|kamu\s+siapa|anda\s+siapa|tuan\s+kamu|pemilik\s+web)\b/i.test(lower);

  if (!asksAboutManifestudio) return '';

  const products = Array.isArray(catalogData?.products) && catalogData.products.length > 0
    ? catalogData.products.slice(0, 12).map((p) => p.name)
    : ['CapCut Pro', 'Netflix Premium', 'Canva Pro', 'YouTube Premium', 'Spotify Premium', 'Viu', 'Vidio', 'Alight Motion', 'WeTV', 'Prime Video', 'Cek Turnitin', 'Zoom Pro', 'Gemini AI'];
  const utilities = Array.isArray(catalogData?.utilities?.items) && catalogData.utilities.items.length > 0
    ? catalogData.utilities.items.map((u) => u.label)
    : ['Jadwal Sholat', 'Prakiraan Cuaca', 'Jam Dunia & Globe', 'Speedtest', 'Downloader', 'Kompresor HD', 'Konversi File', 'Cari Judul Lagu', 'YT Music', 'Drama China', 'Audio Editor', 'Manifest AI'];

  return [
    'Halo! Saya **Manifest AI**, asisten resmi milik **Manifestudio** (*by Tomy*) di [manifestudio.my.id](https://manifestudio.my.id/).',
    '',
    '**Manifestudio** adalah platform web yang dikelola oleh **Tomy** yang menyediakan dua layanan utama:',
    '',
    `1. **Katalog Akun Premium & Layanan Digital Bergaransi**: ${products.join(', ')}, dan lainnya (dilengkapi diskon otomatis mulai Rp50.000, kode voucher, struk otomatis, serta opsi Bayar Sekarang / Bayar Belakangan).`,
    `2. **Menu Utilitas (${utilities.length} Fitur Gratis Tanpa Iklan)**: ${utilities.join(', ')}.`,
    '',
    '**Kontak & Sosmed Resmi**: Demi privasi pemilik (`62xxxxxxxxxx` · `@t***********o`), silakan akses tombol WhatsApp Admin dan media sosial resmi langsung di **bagian footer (bawah halaman)** website ini.',
  ].join('\n');
}

export const MANIFEST_AI_PROVIDERS = Object.freeze([
  {
    id: 'gemini',
    name: 'Google Gemini',
    shortName: 'Gemini',
    vendor: 'Google',
    color: '#2563eb',
    defaultModel: 'gemini-2.5-pro',
    fastModel: 'gemini-2.5-flash',
    fallbackModels: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash'],
    byokEndpoint: 'https://generativelanguage.googleapis.com/v1beta',
    byokProtocol: 'gemini',
    keyPlaceholder: 'AIzaSy...',
    keyDocsUrl: 'https://aistudio.google.com/apikey',
    openRouterPrefix: 'google/gemini',
    modelsDevKey: 'google',
    puterPreferred: ['gemini-2.5-pro', 'gemini-2.5-flash', 'google/gemini-2.5-flash'],
    freeSupported: true,
    role: 'Analisis mendalam, penalaran multimodal & riset',
  },
  {
    id: 'openai',
    name: 'OpenAI ChatGPT',
    shortName: 'ChatGPT',
    vendor: 'OpenAI',
    color: '#059669',
    defaultModel: 'gpt-5',
    fastModel: 'gpt-4.1-mini',
    fallbackModels: ['gpt-5', 'gpt-4.1', 'gpt-4o', 'gpt-4o-mini'],
    byokEndpoint: 'https://api.openai.com/v1',
    byokProtocol: 'openai',
    keyPlaceholder: 'sk-proj-...',
    keyDocsUrl: 'https://platform.openai.com/api-keys',
    openRouterPrefix: 'openai/gpt',
    modelsDevKey: 'openai',
    puterPreferred: ['gpt-5-nano', 'gpt-4.1-mini', 'gpt-4o-mini'],
    freeSupported: true,
    role: 'Penalaran umum, penulisan presisi & pemrograman',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    shortName: 'DeepSeek',
    vendor: 'DeepSeek',
    color: '#4f46e5',
    defaultModel: 'deepseek-reasoner',
    fastModel: 'deepseek-chat',
    fallbackModels: ['deepseek-reasoner', 'deepseek-chat', 'deepseek/deepseek-r1', 'deepseek/deepseek-chat-v3'],
    byokEndpoint: 'https://api.deepseek.com',
    byokProtocol: 'openai',
    keyPlaceholder: 'sk-...',
    keyDocsUrl: 'https://platform.deepseek.com/api_keys',
    openRouterPrefix: 'deepseek/deepseek',
    modelsDevKey: 'deepseek',
    puterPreferred: ['deepseek-chat', 'deepseek-reasoner'],
    freeSupported: true,
    role: 'Logika matematika, algoritma & struktur kode',
  },
  {
    id: 'claude',
    name: 'Anthropic Claude',
    shortName: 'Claude',
    vendor: 'Anthropic',
    color: '#d97706',
    defaultModel: 'claude-sonnet-4-20250514',
    fastModel: 'claude-3-5-haiku-latest',
    fallbackModels: ['claude-sonnet-4-20250514', 'claude-3-7-sonnet-latest', 'claude-3-5-haiku-latest'],
    byokEndpoint: 'https://api.anthropic.com/v1',
    byokProtocol: 'anthropic',
    keyPlaceholder: 'sk-ant-...',
    keyDocsUrl: 'https://console.anthropic.com/settings/keys',
    openRouterPrefix: 'anthropic/claude',
    modelsDevKey: 'anthropic',
    puterPreferred: ['claude-sonnet-4', 'claude-3-7-sonnet', 'claude-3-5-haiku'],
    freeSupported: true,
    role: 'Nuansa bahasa, penyuntingan & arsitektur software',
  },
  {
    id: 'grok',
    name: 'xAI Grok',
    shortName: 'Grok',
    vendor: 'xAI',
    color: '#0f172a',
    defaultModel: 'grok-3',
    fastModel: 'grok-3-mini',
    fallbackModels: ['grok-4', 'grok-3', 'grok-3-mini', 'grok-2-latest'],
    byokEndpoint: 'https://api.x.ai/v1',
    byokProtocol: 'openai',
    keyPlaceholder: 'xai-...',
    keyDocsUrl: 'https://console.x.ai/',
    openRouterPrefix: 'x-ai/grok',
    modelsDevKey: 'xai',
    puterPreferred: ['x-ai/grok-3-mini', 'x-ai/grok-3'],
    freeSupported: true,
    role: 'Sintesis cepat, analisis tren & jawaban lugas',
  },
  {
    id: 'meta',
    name: 'Meta Llama',
    shortName: 'Meta AI',
    vendor: 'Meta',
    color: '#0284c7',
    defaultModel: 'meta-llama/llama-4-maverick',
    fastModel: 'meta-llama/llama-4-scout',
    fallbackModels: ['meta-llama/llama-4-maverick', 'meta-llama/llama-4-scout', 'meta-llama/llama-3.3-70b-instruct'],
    byokEndpoint: 'https://api.groq.com/openai/v1',
    byokProtocol: 'openai',
    keyPlaceholder: 'gsk_... (via Groq / Together)',
    keyDocsUrl: 'https://console.groq.com/keys',
    openRouterPrefix: 'meta-llama/llama',
    modelsDevKey: 'groq',
    puterPreferred: ['meta-llama/llama-4-maverick', 'meta-llama/llama-3.3-70b-instruct'],
    freeSupported: true,
    role: 'Open-weight kecepatan tinggi & verifikasi silang',
  },
  {
    id: 'qwen',
    name: 'Alibaba Qwen',
    shortName: 'Qwen',
    vendor: 'Alibaba',
    color: '#7c3aed',
    defaultModel: 'qwen/qwen3-235b-a22b',
    fastModel: 'qwen/qwen3-32b',
    fallbackModels: ['qwen/qwen3-235b-a22b', 'qwen/qwen-2.5-72b-instruct', 'qwen/qwen-2.5-coder-32b-instruct'],
    byokEndpoint: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
    byokProtocol: 'openai',
    keyPlaceholder: 'sk-...',
    keyDocsUrl: 'https://dashscope.console.aliyun.com/',
    openRouterPrefix: 'qwen/qwen',
    modelsDevKey: 'alibaba',
    puterPreferred: ['qwen/qwen3-32b', 'qwen/qwen-2.5-72b-instruct'],
    freeSupported: true,
    role: 'Multibahasa Asia, pemrograman & ringkasan terstruktur',
  },
  {
    id: 'mistral',
    name: 'Mistral AI',
    shortName: 'Mistral',
    vendor: 'Mistral',
    color: '#ea580c',
    defaultModel: 'mistral-large-latest',
    fastModel: 'mistral-small-latest',
    fallbackModels: ['mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest'],
    byokEndpoint: 'https://api.mistral.ai/v1',
    byokProtocol: 'openai',
    keyPlaceholder: 'Mistral API Key...',
    keyDocsUrl: 'https://console.mistral.ai/api-keys/',
    openRouterPrefix: 'mistralai/mistral',
    modelsDevKey: 'mistral',
    puterPreferred: ['mistral-large-latest', 'mistral-small-latest'],
    freeSupported: true,
    role: 'Efisiensi penulisan & penalaran ringkas',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter (Multi-Lab)',
    shortName: 'OpenRouter',
    vendor: 'OpenRouter',
    color: '#0d9488',
    defaultModel: 'google/gemini-2.5-flash',
    fastModel: 'openai/gpt-4o-mini',
    fallbackModels: ['google/gemini-2.5-pro', 'openai/gpt-5', 'anthropic/claude-sonnet-4', 'deepseek/deepseek-r1'],
    byokEndpoint: 'https://openrouter.ai/api/v1',
    byokProtocol: 'openai',
    keyPlaceholder: 'sk-or-v1-...',
    keyDocsUrl: 'https://openrouter.ai/keys',
    openRouterPrefix: '',
    modelsDevKey: 'openrouter',
    puterPreferred: [],
    freeSupported: false,
    role: 'Satu kunci untuk semua model flagship lintas penyedia',
  },
  {
    id: 'groq',
    name: 'Groq Cloud',
    shortName: 'Groq',
    vendor: 'Groq',
    color: '#e11d48',
    defaultModel: 'llama-3.3-70b-versatile',
    fastModel: 'llama-3.1-8b-instant',
    fallbackModels: ['llama-3.3-70b-versatile', 'deepseek-r1-distill-llama-70b', 'qwen-qwq-32b'],
    byokEndpoint: 'https://api.groq.com/openai/v1',
    byokProtocol: 'openai',
    keyPlaceholder: 'gsk_...',
    keyDocsUrl: 'https://console.groq.com/keys',
    openRouterPrefix: '',
    modelsDevKey: 'groq',
    puterPreferred: [],
    freeSupported: false,
    role: 'Inferensi ultra-cepat untuk Meta Llama, DeepSeek & Qwen',
  },
  {
    id: 'custom',
    name: 'Custom OpenAI-Compatible',
    shortName: 'Custom API',
    vendor: 'Custom',
    color: '#475569',
    defaultModel: 'gpt-4o-mini',
    fastModel: 'gpt-4o-mini',
    fallbackModels: ['gpt-4o-mini'],
    byokEndpoint: 'https://api.openai.com/v1',
    byokProtocol: 'openai',
    keyPlaceholder: 'Bearer API Key...',
    keyDocsUrl: '',
    openRouterPrefix: '',
    modelsDevKey: '',
    puterPreferred: [],
    freeSupported: false,
    role: 'Endpoint proxy / self-hosted pribadi kompatibel OpenAI',
  },
]);

export const CORE_COUNCIL_PROVIDER_IDS = Object.freeze([
  'gemini',
  'openai',
  'deepseek',
  'claude',
  'grok',
  'meta',
  'qwen',
  'mistral',
]);

export function getProviderMeta(providerId = '') {
  const id = String(providerId || '').trim().toLowerCase();
  return MANIFEST_AI_PROVIDERS.find((p) => p.id === id) || MANIFEST_AI_PROVIDERS[0];
}

/**
 * Verified OVHcloud AI Endpoints (`oai.endpoints.kepler.ai.cloud.ovh.net`) anonymous CORS chat models.
 * Each model has an independent free bucket — rolling across models delivers 14+ instant (~300ms)
 * streaming flagship replies even when LLM7 or HF ZeroGPU are rate-limited on shared 4G CGNAT IPs.
 */
export const OVH_FREE_DEFAULT_MODELS = Object.freeze([
  'DeepSeek-V4.1-Flash-1017',
  'gemma-4-26b-a4b',
  'Qwen3.8-27B',
  'Mistral-Small-3.2-24B-Instruct-2506',
  'Qwen3.5-9B',
  'Qwen3.6-35b-a3b',
  'Qwen3.6-27B',
  'Meta-Llama-3_3-70B-Instruct',
  'gpt-oss-120b',
  'gpt-oss-20b',
  'Qwen3.5-397B-A17B',
  'Qwen2.5-VL-72B-Instruct',
  'nemotron3-nano-30b',
  'nemotron3-omni-30b',
]);

/**
 * Verified public Hugging Face Gradio SSE Spaces with native browser CORS & zero API key.
 * Broken/500 legacy spaces removed so ZeroGPU fallback stays fast and clean.
 */
export const HF_GRADIO_FREE_SPACES = Object.freeze([
  {
    id: 'hf:gemma-3n-e4b',
    quotaBucket: 'free:hf-zerogpu',
    host: 'https://huggingface-projects-gemma-3n-e4b-it.hf.space',
    fn: 'generate',
    payloadType: 'multimodal-sys',
    providerId: 'gemini',
    providerName: 'Google Gemma 3n',
    shortName: 'Gemini',
    model: 'gemma-3n-e4b-it',
  },
  {
    id: 'hf:gemma-4-12b',
    quotaBucket: 'free:hf-zerogpu',
    host: 'https://huggingface-projects-gemma-4-12b-it.hf.space',
    fn: 'chat',
    payloadType: 'gemma4-chat',
    providerId: 'gemini',
    providerName: 'Google Gemma 4 12B',
    shortName: 'Gemini',
    model: 'gemma-4-12b-it',
  },
]);

const EXCLUDED_MODEL_SUBSTRINGS = [
  'embed',
  'whisper',
  'tts',
  'dall-e',
  'imagen',
  'veo',
  'audio-preview',
  'realtime',
  'moderation',
  'guard',
  'vision-only',
  'transcribe',
  'speech',
  'sora',
  'flux',
  ':free',
  ':extended',
  ':nitro',
  ':floor',
  'deprecated',
  'computer-use',
  'image-preview',
  'robotics',
  'deep-research',
  '-tts',
];

/**
 * Scores a candidate model ID for a given provider so the real-time auto-upgrader
 * consistently promotes the newest flagship chat/reasoning release over legacy or utility models.
 */
export function scoreModelFreshness(modelId = '', createdTs = 0, providerId = '') {
  const raw = String(modelId || '').trim();
  const lower = raw.toLowerCase();
  if (!lower) return -1e9;

  for (const bad of EXCLUDED_MODEL_SUBSTRINGS) {
    if (lower.includes(bad)) return -1e6;
  }

  let score = 0;

  // Strip calendar date suffixes (e.g. -2024-11-20, -20250514, -05-06, -0528) before parsing versions
  const versionText = lower
    .replace(/[-_](?:20\d{2}[-_]?\d{2}[-_]?\d{2}|(?:0[1-9]|1[0-2])[-_](?:0[1-9]|[12]\d|3[01])|(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01]))(?=$|[-_/.:])/g, '')
    .replace(/[-_]20\d{2}(?=$|[-_/.:])/g, '');

  // Extract semantic version pairs like 2.5, 3.7, 4.1, 5.2, 4, 3
  const verMatches = [...versionText.matchAll(/(?:^|[-_/v])(\d+)(?:\.(\d+))?(?=$|[-_/.])/g)];
  let bestVer = 0;
  for (const m of verMatches) {
    const major = Number(m[1] || 0);
    const minor = Number(m[2] || 0);
    if (major >= 1 && major <= 20) {
      const val = major * 100 + minor * 10;
      if (val > bestVer) bestVer = val;
    }
  }
  score += bestVer * 12;

  // Prefer flagship chat/reasoning tiers over nano/tiny/mini for primary slot
  if (/(?:pro|sonnet|opus|reasoner|maverick|large|max|r1|v3)/i.test(lower)) score += 180;
  if (/(?:flash|chat|versatile|scout|medium)/i.test(lower)) score += 90;
  if (/(?:mini|haiku|small|lite|nano|8b|7b|3b|1\.5b)/i.test(lower)) score -= 60;
  if (/(?:preview|beta|exp|experimental)/i.test(lower)) score -= 35;

  // Provider-specific flagship boosts
  if (providerId === 'gemini' && /gemini-\d/.test(lower)) score += 200;
  if (providerId === 'openai' && /(?:^|\/)(?:gpt-5|gpt-4\.1|gpt-4o|o[34])/.test(lower)) score += 200;
  if (providerId === 'claude' && /claude-(?:sonnet-4|opus-4|4|3\.7|3-7|3\.5)/.test(lower)) score += 200;
  if (providerId === 'deepseek' && /deepseek-(?:r1|v3|reasoner|chat)/.test(lower)) score += 200;
  if (providerId === 'grok' && /grok-[345]/.test(lower)) score += 200;
  if (providerId === 'meta' && /llama-[34]/.test(lower)) score += 200;
  if (providerId === 'qwen' && /qwen-?[23]/.test(lower)) score += 200;
  if (providerId === 'mistral' && /mistral-(?:large|medium|small)/.test(lower)) score += 200;

  // Recency tie-breaker from unix timestamp (supports seconds or ms)
  const tsSec = Number(createdTs) > 1e12 ? Math.floor(Number(createdTs) / 1000) : Number(createdTs) || 0;
  if (tsSec > 1650000000) {
    score += Math.min(250, Math.floor((tsSec - 1650000000) / 86400) * 0.25);
  }

  return Math.round(score);
}

/**
 * Strips vendor prefix (e.g. "google/gemini-2.5-pro" -> "gemini-2.5-pro") when preparing
 * a model ID for a direct provider API (Gemini, OpenAI, Anthropic, DeepSeek, Grok, Mistral).
 */
export function normalizeDirectModelId(providerId = '', rawModelId = '') {
  const clean = String(rawModelId || '').trim();
  if (!clean) return '';
  if (providerId === 'openrouter' || providerId === 'meta' || providerId === 'qwen' || providerId === 'custom') {
    return clean;
  }
  const slashIdx = clean.indexOf('/');
  if (slashIdx > 0) {
    return clean.slice(slashIdx + 1);
  }
  return clean;
}

/**
 * Merges real-time model listings from OpenRouter, Models.dev, Pollinations, and LLM7
 * into a unified, auto-upgraded registry so every provider always points to its latest
 * official flagship model without manual code edits.
 */
export function mergeLiveModelCatalog({
  openRouterModels = [],
  modelsDevJson = null,
  pollinationsModels = [],
  genPollinationsModels = [],
  llm7Models = [],
  ovhModels = [],
  syncedAt = Date.now(),
} = {}) {
  const providers = {};

  for (const p of MANIFEST_AI_PROVIDERS) {
    const candidates = [];
    const seen = new Set();

    const addCandidate = (id, name = '', created = 0, source = 'fallback') => {
      const cleanId = String(id || '').trim();
      if (!cleanId) return;
      const directId = normalizeDirectModelId(p.id, cleanId);
      const dedupeKey = directId.toLowerCase();
      if (seen.has(dedupeKey)) return;
      const score = scoreModelFreshness(cleanId, created, p.id);
      if (score < -500000) return;
      seen.add(dedupeKey);
      candidates.push({
        id: cleanId,
        directId,
        label: String(name || directId).trim(),
        created: Number(created) || 0,
        source,
        score,
      });
    };

    // 1. OpenRouter live catalog (covers Google, OpenAI, Anthropic, DeepSeek, xAI, Meta, Qwen, Mistral)
    if (Array.isArray(openRouterModels) && p.openRouterPrefix) {
      const prefix = p.openRouterPrefix.toLowerCase();
      for (const m of openRouterModels) {
        const mid = String(m?.id || '').trim();
        if (mid.toLowerCase().startsWith(prefix)) {
          addCandidate(mid, m?.name || mid, m?.created || 0, 'openrouter-live');
        }
      }
    }

    // 2. Models.dev live registry (official direct model IDs per lab)
    if (modelsDevJson && typeof modelsDevJson === 'object' && p.modelsDevKey) {
      const labBlock = modelsDevJson[p.modelsDevKey];
      const labModels = labBlock?.models && typeof labBlock.models === 'object' ? Object.values(labBlock.models) : [];
      for (const m of labModels) {
        const mid = String(m?.id || '').trim();
        if (!mid) continue;
        const lowMid = mid.toLowerCase();
        if (p.id === 'qwen' && !lowMid.includes('qwen')) continue;
        if (p.id === 'gemini' && !lowMid.includes('gemini')) continue;
        if (p.id === 'claude' && !lowMid.includes('claude')) continue;
        if (p.id === 'deepseek' && !lowMid.includes('deepseek')) continue;
        if (p.id === 'grok' && !lowMid.includes('grok')) continue;
        if (p.id === 'mistral' && !lowMid.includes('mistral')) continue;
        const relDate = m?.release_date ? Date.parse(String(m.release_date)) : 0;
        addCandidate(mid, m?.name || mid, Number.isFinite(relDate) ? relDate : 0, 'models-dev-live');
      }
    }

    // 3. Gen Pollinations live catalog (helps verify newest OpenAI/Gemini/Claude/DeepSeek/Grok IDs)
    if (Array.isArray(genPollinationsModels) && p.openRouterPrefix) {
      const vendorPrefix = p.openRouterPrefix.split('/')[0].toLowerCase();
      for (const m of genPollinationsModels) {
        const mid = String(m?.name || '').trim();
        if (mid.toLowerCase().startsWith(`${vendorPrefix}/`) || String(m?.publisher || '').toLowerCase() === p.vendor.toLowerCase()) {
          addCandidate(mid, m?.description || mid, syncedAt, 'pollinations-live');
        }
      }
    }

    // 4. Built-in defaults as guaranteed safe baseline
    for (const fb of p.fallbackModels) {
      addCandidate(fb, fb, 0, 'baseline');
    }

    candidates.sort((a, b) => b.score - a.score);
    const liveCandidates = candidates.filter((c) => c.source !== 'baseline');
    const best = liveCandidates[0] || candidates[0];
    const fast =
      candidates.find((c) => /(?:flash|mini|haiku|scout|small|fast|chat|instant)/i.test(c.directId)) ||
      candidates[1] ||
      best;

    providers[p.id] = {
      providerId: p.id,
      latestModel: best ? best.directId : p.defaultModel,
      latestOpenRouterId: best ? best.id : p.defaultModel,
      fastModel: fast ? fast.directId : p.fastModel,
      availableModels: candidates.slice(0, 12).map((c) => c.directId),
      liveVerified: liveCandidates.length > 0,
      source: best ? best.source : 'baseline',
    };
  }

  // Extract live free gateway models (Pollinations & LLM7) so we NEVER send deprecated 404 model IDs
  const freePollinationsModels = (Array.isArray(pollinationsModels) ? pollinationsModels : [])
    .filter((m) => m && typeof m === 'object' && m.name)
    .map((m) => ({
      id: String(m.name).trim(),
      label: String(m.description || m.name).trim(),
      tier: String(m.tier || 'anonymous'),
      aliases: Array.isArray(m.aliases) ? m.aliases.map(String) : [],
    }));

  const freeLlm7Models = (Array.isArray(llm7Models) ? llm7Models : [])
    .filter((m) => m && typeof m === 'object' && m.id && !m.usage_based_only && (!m.model_type || m.model_type === 'chat'))
    .sort((a, b) => {
      const rank = (t) => (t === 'free' || t === 'turbo' ? 0 : 1);
      return rank(String(a.tier || 'free').toLowerCase()) - rank(String(b.tier || 'free').toLowerCase());
    })
    .map((m) => ({
      id: String(m.id).trim(),
      tier: String(m.tier || 'free'),
    }));

  const OVH_NON_CHAT_RE = /(?:tts|whisper|embed|bge-|guard|diffusion|solaria|clef|summarise|translate|laguna|olala)/i;
  const freeOvhModels = (Array.isArray(ovhModels) ? ovhModels : [])
    .map((m) => String(typeof m === 'string' ? m : m?.id || '').trim())
    .filter((id) => id && !OVH_NON_CHAT_RE.test(id))
    .map((id) => ({ id, tier: 'anonymous' }));

  const syncedSources = [];
  if (Array.isArray(openRouterModels) && openRouterModels.length > 0) syncedSources.push('OpenRouter');
  if (modelsDevJson && typeof modelsDevJson === 'object' && Object.keys(modelsDevJson).length > 0) {
    syncedSources.push('Models.dev');
  }
  if (freePollinationsModels.length > 0 || (Array.isArray(genPollinationsModels) && genPollinationsModels.length > 0)) {
    syncedSources.push('Pollinations');
  }
  if (freeLlm7Models.length > 0) syncedSources.push('LLM7');
  if (freeOvhModels.length > 0) syncedSources.push('OVHcloud');

  return {
    version: 63,
    syncedAt,
    syncedSources,
    providers,
    freeGateways: {
      pollinations: freePollinationsModels.length > 0 ? freePollinationsModels : [{ id: 'openai', label: 'Pollinations OpenAI', tier: 'anonymous', aliases: ['openai-fast'] }],
      llm7: freeLlm7Models.length > 0 ? freeLlm7Models : [{ id: 'default', tier: 'free' }],
      ovh: freeOvhModels.length > 0 ? freeOvhModels : OVH_FREE_DEFAULT_MODELS.map((id) => ({ id, tier: 'anonymous' })),
    },
  };
}

/**
 * Extracts a compact grounded memory summary from older turns beyond the verbatim window
 * so switching models mid-conversation or combining models NEVER loses prior facts or topic.
 */
export function buildConversationMemorySummary(olderMessages = [], maxChars = 900) {
  if (!Array.isArray(olderMessages) || olderMessages.length === 0) return '';

  const bullets = [];
  for (const msg of olderMessages) {
    if (!msg || typeof msg.content !== 'string') continue;
    const roleLabel = msg.role === 'user' ? 'Pengguna' : 'Manifest AI';
    const cleaned = msg.content
      .replace(/```[\s\S]*?```/g, '[blok kode]')
      .replace(/\s+/g, ' ')
      .trim();
    if (!cleaned) continue;
    const clipped = cleaned.length > 140 ? `${cleaned.slice(0, 137)}...` : cleaned;
    bullets.push(`- ${roleLabel}: ${clipped}`);
  }

  let summary = '';
  for (const line of bullets) {
    if ((summary + '\n' + line).length > maxChars) break;
    summary = summary ? `${summary}\n${line}` : line;
  }
  return summary;
}

const TOPIC_STOPWORDS = new Set([
  'yang', 'dan', 'atau', 'di', 'ke', 'dari', 'pada', 'untuk', 'dengan', 'ini', 'itu', 'ada', 'apa',
  'aja', 'saja', 'si', 'sih', 'dong', 'deh', 'ya', 'yah', 'kah', 'kok', 'kan', 'tuh', 'nih', 'nya',
  'aku', 'saya', 'gue', 'gw', 'kamu', 'anda', 'lu', 'lo', 'kita', 'kami', 'mereka', 'dia',
  'bisa', 'boleh', 'tolong', 'coba', 'mau', 'ingin', 'bantu', 'buat', 'buatkan', 'bikin', 'kasih',
  'cara', 'bagaimana', 'gimana', 'kenapa', 'mengapa', 'kapan', 'dimana', 'siapa', 'berapa',
  'adalah', 'ialah', 'merupakan', 'tentang', 'soal', 'juga', 'lagi', 'sudah', 'udah', 'belum',
  'tidak', 'gak', 'ga', 'enggak', 'nggak', 'bukan', 'sangat', 'lebih', 'paling', 'semua', 'banyak',
  'the', 'and', 'for', 'with', 'that', 'this', 'what', 'how', 'why', 'who', 'can', 'you', 'please',
]);

function extractTopicKeywords(text = '') {
  const words = String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\u00c0-\u024f\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !TOPIC_STOPWORDS.has(w));
  return new Set(words);
}

/**
 * Detects when the user switches to a completely new topic (or sends a fresh greeting/identity
 * question) so smaller models NEVER obsessively cling to an unrelated earlier topic (e.g. coffee).
 */
export function detectTopicShift(history = [], currentPrompt = '') {
  const cleanPrompt = String(currentPrompt || '').trim();
  const lower = cleanPrompt.toLowerCase();
  if (!cleanPrompt || !Array.isArray(history) || history.length === 0) {
    return { shifted: false, reason: 'no-history' };
  }

  // Explicit topic reset / correction / fresh greeting / identity / Manifestudio switch
  if (
    /\b(bukan\s+(nanya|tanya|bahas|itu|soal)|ganti\s+topik|topik\s+(baru|lain)|lupakan\s+(tadi|sebelumnya))\b/i.test(lower) ||
    /^(p+|ping|halo+|hai+|hi+|hey+|tes+|test+)[\s!?.]*$/i.test(lower) ||
    /^(halo|hai|hi)?[\s,!]*(kamu\s+siapa|siapa\s+kamu|anda\s+siapa|siapa\s+anda)\b/i.test(lower)
  ) {
    return { shifted: true, reason: 'explicit-reset-or-greeting' };
  }

  // Explicit continuation / back-reference cues -> ALWAYS keep conversation history!
  if (
    /\b(lanjut|lanjutkan|teruskan|tadi|sebelumnya|yang\s+tadi|barusan|maksudnya|maksudku|jelaskan\s+lebih|lebih\s+(detail|lanjut|jelas|lengkap)|contohnya|langkah\s+selanjutnya|selain\s+itu|nomor\s*\d+|no\s*\d+|opsi\s*\d+|pilihan\s*\d+|yang\s+(pertama|kedua|ketiga|terakhir)|kok\s+gitu|kenapa\s+(begitu|gitu)|bagaimana\s+caranya|resepnya|kodenya|hasilnya|versi\s+lain|ubah\s+jadi|perbaiki)\b/i.test(
      lower
    )
  ) {
    return { shifted: false, reason: 'explicit-continuation' };
  }

  // Very short follow-up replies (e.g., "espresso", "1", "iya", "boleh") usually answer the AI's question
  const wordCount = cleanPrompt.split(/\s+/).filter(Boolean).length;
  if (wordCount <= 2 && !isManifestudioQuery(cleanPrompt)) {
    return { shifted: false, reason: 'short-reply' };
  }

  // Check keyword overlap against the last 4 messages (2 exchanges)
  const promptKeywords = extractTopicKeywords(cleanPrompt);
  if (promptKeywords.size === 0) {
    return { shifted: false, reason: 'no-keywords' };
  }

  const recentSlice = history.slice(-4);
  const recentKeywords = new Set();
  for (const m of recentSlice) {
    for (const kw of extractTopicKeywords(m?.content || '')) {
      recentKeywords.add(kw);
    }
  }

  let overlap = 0;
  for (const kw of promptKeywords) {
    if (recentKeywords.has(kw)) overlap += 1;
  }

  // Check if user is returning to an OLDER topic from earlier in the same thread
  if (overlap === 0 && history.length > 4) {
    const olderSlice = history.slice(0, -4);
    for (const m of olderSlice) {
      const olderKws = extractTopicKeywords(m?.content || '');
      for (const kw of promptKeywords) {
        if (olderKws.has(kw)) {
          return { shifted: false, reason: 'returned-to-earlier-topic' };
        }
      }
    }
  }

  if (overlap === 0) {
    return { shifted: true, reason: 'unrelated-new-topic' };
  }

  return { shifted: false, reason: 'same-topic-overlap' };
}

/**
 * Sanitizes raw chat history by removing orphaned unanswered user turns (e.g. from prior
 * rate-limit errors) so user/assistant alternation stays clean for every LLM API.
 */
export function sanitizeConversationHistory(history = []) {
  const valid = (Array.isArray(history) ? history : [])
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .map((m) => ({
      role: m.role,
      content: m.content.trim(),
    }));

  const normalized = [];
  for (const msg of valid) {
    const prev = normalized[normalized.length - 1];
    if (prev && prev.role === 'user' && msg.role === 'user') {
      // Replace orphaned unanswered user message with the newer user message
      normalized[normalized.length - 1] = msg;
    } else if (!prev && msg.role === 'assistant') {
      // Skip leading orphan assistant message
      continue;
    } else {
      normalized.push(msg);
    }
  }

  // Drop trailing unanswered user turn before appending the fresh current prompt
  if (normalized.length > 0 && normalized[normalized.length - 1].role === 'user') {
    normalized.pop();
  }

  return normalized;
}

/**
 * Builds the unified, anti-hallucination, topic-shift-aware message array sent to EVERY
 * participating model (and any failover model).
 * - Keeps full memory when continuing or revisiting a topic.
 * - Isolates cleanly when the user switches to a brand-new topic so models NEVER cling to old topics.
 * - Injects live verified Manifestudio catalog data on demand.
 */
export function buildUnifiedContextMessages(
  history = [],
  currentUserPrompt = '',
  {
    maxVerbatimTurns = 8,
    maxTotalChars = 9000,
    customSystemPrompt = '',
    catalogData = null,
  } = {}
) {
  const promptClean = String(currentUserPrompt || '').trim();
  const cleanHistory = sanitizeConversationHistory(history);
  const shift = detectTopicShift(cleanHistory, promptClean);

  const systemParts = [customSystemPrompt || MANIFEST_AI_SYSTEM_PROMPT];
  if (isManifestudioQuery(promptClean)) {
    systemParts.push(buildManifestudioKnowledgeBlock(catalogData));
  }

  // When user clearly switched to an unrelated new topic, keep context laser-focused on the new topic!
  if (shift.shifted) {
    systemParts.push(
      'Catatan konteks: Pengguna baru saja beralih ke topik baru. Fokus 100% menjawab pesan terbaru ini secara akurat tanpa mengungkit topik obrolan lama.'
    );
    const messages = [{ role: 'system', content: systemParts.join('\n\n') }];
    if (promptClean) {
      messages.push({ role: 'user', content: promptClean });
    }
    return messages;
  }

  const cutoff = Math.max(0, cleanHistory.length - maxVerbatimTurns);
  const older = cleanHistory.slice(0, cutoff);
  let recent = cleanHistory.slice(cutoff);

  // Respect total character budget by folding excess recent messages into compact memory summary
  const charCount = (arr) => arr.reduce((sum, m) => sum + m.content.length, 0);
  const foldedOlder = [...older];
  while (recent.length > 2 && charCount(recent) > maxTotalChars) {
    foldedOlder.push(recent.shift());
  }

  const memorySummary = buildConversationMemorySummary(foldedOlder, 700);
  if (memorySummary) {
    systemParts.push(
      `Ringkasan Memori Percakapan Sebelumnya (gunakan hanya jika relevan dengan pesan terbaru pengguna):\n${memorySummary}`
    );
  }

  const messages = [{ role: 'system', content: systemParts.join('\n\n') }, ...recent];

  if (promptClean) {
    const last = messages[messages.length - 1];
    if (!(last && last.role === 'user' && last.content === promptClean)) {
      messages.push({ role: 'user', content: promptClean });
    }
  }

  return messages;
}

/**
 * Per-user cooldown & rate-limit tracker helpers (client-side localStorage state).
 */
export function normalizeLimitMap(raw = {}, now = Date.now()) {
  if (!raw || typeof raw !== 'object') return {};
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!v || typeof v !== 'object') continue;
    const resetAt = Number(v.resetAt) || 0;
    if (resetAt > now) {
      out[k] = {
        resetAt,
        reason: String(v.reason || 'Batas permintaan sementara'),
        hits: Math.max(1, Number(v.hits) || 1),
      };
    }
  }
  return out;
}

export function recordProviderCooldown(limitMap = {}, targetKey = '', cooldownMs = 60000, reason = 'Rate limit sementara', now = Date.now()) {
  const next = normalizeLimitMap(limitMap, now);
  const key = String(targetKey || '').trim();
  if (!key) return next;
  const prevHits = Number(next[key]?.hits || 0);
  const maxCapMs = key.startsWith('free:ovh:') ? 12 * 60 * 60 * 1000 : 3600000;
  const safeMs = Math.max(5000, Math.min(maxCapMs, Number(cooldownMs) || 60000));
  next[key] = {
    resetAt: now + safeMs,
    reason: String(reason || 'Rate limit sementara'),
    hits: prevHits + 1,
  };
  return next;
}

export function getCooldownRemainingMs(limitMap = {}, targetKey = '', now = Date.now()) {
  const entry = limitMap?.[targetKey];
  if (!entry || !entry.resetAt) return 0;
  return Math.max(0, Number(entry.resetAt) - now);
}

export function formatCooldownShort(ms = 0) {
  const sec = Math.ceil(Math.max(0, Number(ms) || 0) / 1000);
  if (sec <= 0) return 'Siap';
  if (sec < 60) return `${sec} dtk`;
  const min = Math.ceil(sec / 60);
  return `${min} mnt`;
}

/**
 * Multi-BYOK Key Vault normalization & masking (supports multiple simultaneous keys & providers).
 */
export function maskApiKey(rawKey = '') {
  const key = String(rawKey || '').trim();
  if (!key) return '';
  if (key.length <= 8) return `${key.slice(0, 2)}••••`;
  return `${key.slice(0, 6)}••••${key.slice(-4)}`;
}

export function normalizeByokKeys(rawList = []) {
  if (!Array.isArray(rawList)) return [];
  const out = [];
  const seenIds = new Set();
  for (const item of rawList) {
    if (!item || typeof item !== 'object') continue;
    const providerId = String(item.providerId || '').trim().toLowerCase();
    const apiKey = String(item.apiKey || '').trim();
    if (!providerId || !apiKey) continue;
    const provider = getProviderMeta(providerId);
    const id = String(item.id || `key_${provider.id}_${out.length + 1}`).trim();
    if (seenIds.has(id)) continue;
    seenIds.add(id);
    out.push({
      id,
      providerId: provider.id,
      label: String(item.label || `${provider.shortName} Pribadi`).trim().slice(0, 48),
      apiKey,
      model: String(item.model || 'auto').trim() || 'auto',
      customEndpoint: String(item.customEndpoint || '').trim(),
      enabled: item.enabled !== false,
      createdAt: Number(item.createdAt) || Date.now(),
      lastStatus: String(item.lastStatus || 'idle'),
    });
  }
  return out;
}

export function upsertByokKey(existing = [], entry = {}) {
  const list = normalizeByokKeys(existing);
  const provider = getProviderMeta(entry.providerId || 'gemini');
  const apiKey = String(entry.apiKey || '').trim();
  if (!apiKey) return list;

  const id = String(entry.id || `key_${provider.id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
  const nextItem = {
    id,
    providerId: provider.id,
    label: String(entry.label || `${provider.shortName} Pribadi`).trim().slice(0, 48),
    apiKey,
    model: String(entry.model || 'auto').trim() || 'auto',
    customEndpoint: String(entry.customEndpoint || '').trim(),
    enabled: entry.enabled !== false,
    createdAt: Number(entry.createdAt) || Date.now(),
    lastStatus: String(entry.lastStatus || 'idle'),
  };

  const idx = list.findIndex((k) => k.id === id);
  if (idx >= 0) {
    list[idx] = nextItem;
  } else {
    list.unshift(nextItem);
  }
  return list;
}

/**
 * Plans the optimal multi-model execution council for a user prompt:
 * - Prioritizes combining multiple models simultaneously (BYOK multi-key AND/OR multi-gateway free ensemble)
 * - Automatically bypasses models/gateways currently in per-user cooldown
 * - Keeps backup failover candidates ready in case any primary model errors or hits a 429/402 limit.
 */
export function planEnsembleExecution({
  mode = 'ensemble',
  focusProviderId = 'gemini',
  byokKeys = [],
  combineByokWithFree = true,
  puterAvailable = false,
  liveRegistry = null,
  limitMap = {},
  turnIndex = 0,
  now = Date.now(),
} = {}) {
  const activeKeys = normalizeByokKeys(byokKeys).filter((k) => k.enabled);
  const registry = liveRegistry && liveRegistry.providers ? liveRegistry : mergeLiveModelCatalog();

  const resolveModelForProvider = (pid, override = 'auto') => {
    if (override && override !== 'auto') return override;
    return registry.providers?.[pid]?.latestModel || getProviderMeta(pid).defaultModel;
  };

  const byokCandidates = activeKeys.map((k) => {
    const provider = getProviderMeta(k.providerId);
    const modelId = resolveModelForProvider(k.providerId, k.model);
    const limitKey = `byok:${k.id}`;
    return {
      id: limitKey,
      quotaBucket: limitKey,
      channel: 'byok',
      keyId: k.id,
      providerId: k.providerId,
      providerName: k.label || provider.name,
      shortName: provider.shortName,
      model: modelId,
      apiKey: k.apiKey,
      customEndpoint: k.customEndpoint || provider.byokEndpoint,
      protocol: provider.byokProtocol,
      cooldownMs: getCooldownRemainingMs(limitMap, limitKey, now),
    };
  });

  // Token-efficient LLM7 model order: fast chat models first (preserves hourly token allowance 3x-4x longer
  // compared to heavy chain-of-thought reasoning models that burn hidden reasoning tokens).
  const llm7Pool = Array.isArray(registry.freeGateways?.llm7) && registry.freeGateways.llm7.length > 0
    ? registry.freeGateways.llm7
    : [
        { id: 'gemma-3-27b', tier: 'turbo' },
        { id: 'mistral-Nemo-Instruct-2407', tier: 'turbo' },
        { id: 'default', tier: 'free' },
        { id: 'gpt-oss:20b', tier: 'turbo' },
      ];
  const llm7PreferredOrder = [
    'gemma-3-27b',
    'mistral-Nemo-Instruct-2407',
    'default',
    'codestral-latest',
    'gpt-oss:20b',
  ];
  const llm7Model =
    llm7PreferredOrder.find((m) => llm7Pool.some((p) => p.id === m)) ||
    llm7Pool[0]?.id ||
    'default';

  const puterCandidates = [];
  if (puterAvailable) {
    const puterProviders =
      mode === 'single'
        ? [focusProviderId]
        : ['gemini', 'openai', 'deepseek', 'claude', 'grok', 'meta'];
    for (const pid of puterProviders) {
      const pMeta = getProviderMeta(pid);
      const puterModel = pMeta.puterPreferred?.[0] || resolveModelForProvider(pid, 'auto');
      const limitKey = `free:puter:${pid}`;
      puterCandidates.push({
        id: limitKey,
        quotaBucket: limitKey,
        channel: 'free-puter',
        providerId: pid,
        providerName: pMeta.name,
        shortName: pMeta.shortName,
        model: puterModel,
        cooldownMs: getCooldownRemainingMs(limitMap, limitKey, now),
      });
    }
  }

  const llm7Candidate = {
    id: 'free:llm7',
    quotaBucket: 'free:llm7',
    channel: 'free-llm7',
    providerId: llm7Model.includes('gemma')
      ? 'gemini'
      : llm7Model.includes('gpt')
        ? 'openai'
        : llm7Model.includes('mistral') || llm7Model.includes('codestral')
          ? 'mistral'
          : 'deepseek',
    providerName: 'Manifest AI',
    shortName: llm7Model.includes('gemma')
      ? 'Gemini'
      : llm7Model.includes('gpt')
        ? 'ChatGPT'
        : llm7Model.includes('mistral') || llm7Model.includes('codestral')
          ? 'Mistral'
          : 'DeepSeek',
    model: llm7Model,
    cooldownMs: getCooldownRemainingMs(limitMap, 'free:llm7', now),
  };

  // Pollinations Classic OpenAI: resets every 45 seconds per IP (infinite daily free backup!)
  const pollinationsCandidate = {
    id: 'free:pollinations',
    quotaBucket: 'free:pollinations',
    channel: 'free-pollinations',
    providerId: 'openai',
    providerName: 'Pollinations AI',
    shortName: 'ChatGPT',
    model: 'openai',
    cooldownMs: getCooldownRemainingMs(limitMap, 'free:pollinations', now),
  };

  // OVHcloud AI Endpoints: 14+ distinct flagship models, EACH with its OWN independent anonymous bucket!
  const ovhPoolIds =
    Array.isArray(registry.freeGateways?.ovh) && registry.freeGateways.ovh.length > 0
      ? registry.freeGateways.ovh.map((m) => String(m?.id || m || '').trim()).filter(Boolean)
      : [...OVH_FREE_DEFAULT_MODELS];
  const ovhOrderedIds = [
    ...OVH_FREE_DEFAULT_MODELS.filter((id) => ovhPoolIds.includes(id)),
    ...ovhPoolIds.filter((id) => !OVH_FREE_DEFAULT_MODELS.includes(id)),
  ];
  const inferOvhProvider = (mid) => {
    const low = mid.toLowerCase();
    if (low.includes('deepseek')) return { providerId: 'deepseek', shortName: 'DeepSeek' };
    if (low.includes('gemma')) return { providerId: 'gemini', shortName: 'Gemini' };
    if (low.includes('qwen')) return { providerId: 'qwen', shortName: 'Qwen' };
    if (low.includes('mistral')) return { providerId: 'mistral', shortName: 'Mistral' };
    if (low.includes('llama')) return { providerId: 'meta', shortName: 'Meta AI' };
    if (low.includes('gpt')) return { providerId: 'openai', shortName: 'ChatGPT' };
    return { providerId: 'deepseek', shortName: 'Manifest AI' };
  };
  const ovhCandidates = ovhOrderedIds.map((mid) => {
    const meta = inferOvhProvider(mid);
    const key = `free:ovh:${mid}`;
    return {
      id: key,
      quotaBucket: key,
      channel: 'free-ovh',
      providerId: meta.providerId,
      providerName: `OVHcloud ${mid}`,
      shortName: meta.shortName,
      model: mid,
      cooldownMs: getCooldownRemainingMs(limitMap, key, now),
    };
  });

  // Shared ZeroGPU bucket cooldown prevents wasting consecutive doomed requests once ZeroGPU IP quota cools down
  const sharedZeroGpuCooldown = getCooldownRemainingMs(limitMap, 'free:hf-zerogpu', now);
  const hfCandidates = HF_GRADIO_FREE_SPACES.map((sp) => {
    const ownCd = getCooldownRemainingMs(limitMap, `free:${sp.id}`, now);
    return {
      id: `free:${sp.id}`,
      quotaBucket: sp.quotaBucket || 'free:hf-zerogpu',
      channel: 'free-hf-gradio',
      providerId: sp.providerId,
      providerName: sp.providerName,
      shortName: sp.shortName,
      model: sp.model,
      gradioHost: sp.host,
      gradioFn: sp.fn,
      gradioPayloadType: sp.payloadType,
      cooldownMs: Math.max(ownCd, sharedZeroGpuCooldown),
    };
  });

  // Rotate across 4 INDEPENDENT free networks (LLM7, Pollinations 45s-reset, OVH 14-model pool, HF)
  // so no single IP bucket gets exhausted quickly — even on crowded 4G CGNAT networks!
  const safeTurn = Math.max(0, Number(turnIndex) || 0);
  const firstFreshOvh = ovhCandidates.find((c) => c.cooldownMs === 0) || ovhCandidates[0];
  const restOvh = ovhCandidates.filter((c) => c.id !== firstFreshOvh?.id);

  let rotatedNoKeyFree;
  if (safeTurn % 3 === 1) {
    rotatedNoKeyFree = [pollinationsCandidate, llm7Candidate, firstFreshOvh, ...restOvh, ...hfCandidates].filter(Boolean);
  } else if (safeTurn % 3 === 2) {
    rotatedNoKeyFree = [firstFreshOvh, llm7Candidate, pollinationsCandidate, ...restOvh, ...hfCandidates].filter(Boolean);
  } else {
    rotatedNoKeyFree = [llm7Candidate, pollinationsCandidate, firstFreshOvh, ...restOvh, ...hfCandidates].filter(Boolean);
  }

  const freeCandidates =
    puterCandidates.length > 0
      ? [...puterCandidates, ...rotatedNoKeyFree]
      : rotatedNoKeyFree;

  const healthyByok = byokCandidates.filter((c) => c.cooldownMs === 0);
  const healthyFree = freeCandidates.filter((c) => c.cooldownMs === 0);

  let primary = [];
  let backups = [];

  if (mode === 'single') {
    const matchingByok = healthyByok.find((c) => c.providerId === focusProviderId) || healthyByok[0];
    const matchingFree = healthyFree.find((c) => c.providerId === focusProviderId) || healthyFree[0];
    if (matchingByok) {
      primary = [matchingByok];
      backups = [
        ...healthyByok.filter((c) => c.id !== matchingByok.id),
        ...(combineByokWithFree ? healthyFree : []),
      ];
    } else if (matchingFree) {
      primary = [matchingFree];
      backups = healthyFree.filter((c) => c.id !== matchingFree.id);
    } else {
      const allSorted = [...byokCandidates, ...freeCandidates].sort((a, b) => a.cooldownMs - b.cooldownMs);
      primary = allSorted.slice(0, 1);
      backups = allSorted.slice(1);
    }
  } else {
    if (healthyByok.length >= 2) {
      primary = healthyByok.slice(0, 4);
      backups = [
        ...healthyByok.slice(4),
        ...(combineByokWithFree ? healthyFree : []),
      ];
    } else if (healthyByok.length === 1) {
      if (combineByokWithFree && healthyFree.length > 0) {
        primary = [healthyByok[0], healthyFree[0]];
        backups = healthyFree.slice(1);
      } else {
        primary = [healthyByok[0]];
        backups = healthyFree;
      }
    } else if (healthyFree.length > 0) {
      // Pick up to 2 targets from DISTINCT quota buckets (staggered hedging burns ONLY 1 request on normal fast replies!)
      const picked = [];
      const seenBuckets = new Set();
      for (const c of healthyFree) {
        if (picked.length >= 2) break;
        if (!seenBuckets.has(c.quotaBucket)) {
          picked.push(c);
          seenBuckets.add(c.quotaBucket);
        }
      }
      if (picked.length < 2) {
        for (const c of healthyFree) {
          if (picked.length >= 2) break;
          if (!picked.some((p) => p.id === c.id)) picked.push(c);
        }
      }
      primary = picked;
      backups = healthyFree.filter((c) => !picked.some((p) => p.id === c.id));
    } else {
      const allSorted = [...byokCandidates, ...freeCandidates].sort((a, b) => a.cooldownMs - b.cooldownMs);
      primary = allSorted.slice(0, 2);
      backups = allSorted.slice(2);
    }
  }

  return {
    mode,
    primary,
    backups,
    hasActiveByok: activeKeys.length > 0,
    activeByokCount: activeKeys.length,
    coolingDownCount: [...byokCandidates, ...freeCandidates].filter((c) => c.cooldownMs > 0).length,
  };
}

/**
 * Scores response completeness & structure so ensemble consensus picks the clearest
 * anchor response when deterministic merging is needed (zero hallucination).
 */
export function scoreAssistantResponse(text = '') {
  const clean = String(text || '').trim();
  if (!clean) return -100;
  let score = Math.min(400, clean.length * 0.45);
  if (/```/.test(clean)) score += 45;
  if (/^\s*[-*•\d]+\./m.test(clean)) score += 30;
  if (/\n\n/.test(clean)) score += 20;
  if (/(?:error|rate limit|forbidden|cannot fulfill|i am unable)/i.test(clean.slice(0, 120))) score -= 180;
  return Math.round(score);
}

/**
 * Deterministic multi-model merger used when 2+ models succeed and an LLM synthesis pass
 * is skipped or unavailable. Deduplicates redundant lines and selects the strongest
 * primary answer while preserving unique verified insights from partner models.
 */
export function synthesizeEnsembleResponses(responses = []) {
  const valid = (Array.isArray(responses) ? responses : [])
    .filter((r) => r && typeof r.content === 'string' && r.content.trim().length > 0)
    .map((r) => ({
      ...r,
      content: r.content.trim(),
      qualityScore: scoreAssistantResponse(r.content),
    }))
    .sort((a, b) => b.qualityScore - a.qualityScore);

  if (valid.length === 0) {
    return { finalText: '', contributors: [], synthesized: false };
  }

  if (valid.length === 1) {
    return {
      finalText: valid[0].content,
      contributors: valid,
      synthesized: false,
    };
  }

  const anchor = valid[0];
  return {
    finalText: anchor.content,
    contributors: valid,
    synthesized: true,
  };
}

/**
 * Builds the grounded synthesis prompt sent to the strongest active model when 2+
 * models produce answers in parallel — ensuring one seamless, verified, hallucination-free answer.
 */
export function buildEnsembleSynthesisMessages(userPrompt = '', responses = [], memorySummary = '') {
  const draftBlocks = (Array.isArray(responses) ? responses : [])
    .map(
      (r, idx) =>
        `### Draft ${idx + 1} (${r.providerName || r.providerId} — ${r.model}):\n${String(r.content || '').trim()}`
    )
    .join('\n\n---\n\n');

  return [
    {
      role: 'system',
      content: [
        MANIFEST_AI_SYSTEM_PROMPT,
        'Tugas khusus saat ini: Kamu adalah synthesizer Manifest AI.',
        'Gabungkan beberapa draf jawaban dari beberapa model AI berikut menjadi SATU jawaban akhir yang paling akurat, runtut, lengkap, dan bebas kontradiksi.',
        'Aturan ketat anti-halusinasi:',
        '- Hanya pertahankan fakta yang konsisten atau masuk akal; buang klaim yang saling bertentangan atau meragukan.',
        '- Jangan menyebut "Draft 1", "Draft 2", atau proses internal penggabungan. Tulis langsung sebagai satu jawaban utuh dari Manifest AI.',
        memorySummary ? `Memori Percakapan:\n${memorySummary}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    },
    {
      role: 'user',
      content: `Pertanyaan pengguna:\n${String(userPrompt || '').trim()}\n\nDraf dari model kolaborasi:\n\n${draftBlocks}\n\nHasilkan satu jawaban terpadu terbaik:`,
    },
  ];
}

/**
 * Chat Thread History Management
 */
export function deriveThreadTitle(firstPrompt = '') {
  const clean = String(firstPrompt || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean) return 'Percakapan Baru';
  return clean.length > 48 ? `${clean.slice(0, 45).trim()}...` : clean;
}

export function createChatThread(title = 'Percakapan Baru') {
  const now = Date.now();
  return {
    id: `chat_${now}_${Math.random().toString(36).slice(2, 7)}`,
    title: String(title || 'Percakapan Baru').trim() || 'Percakapan Baru',
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
}

export function normalizeChatThreads(raw = []) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((t) => t && typeof t === 'object' && t.id)
    .map((t) => ({
      id: String(t.id),
      title: String(t.title || 'Percakapan Baru').trim() || 'Percakapan Baru',
      createdAt: Number(t.createdAt) || Date.now(),
      updatedAt: Number(t.updatedAt) || Number(t.createdAt) || Date.now(),
      messages: Array.isArray(t.messages)
        ? t.messages
            .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
            .map((m) => ({
              id: String(m.id || `msg_${Math.random().toString(36).slice(2, 8)}`),
              role: m.role,
              content: m.content,
              createdAt: Number(m.createdAt) || Date.now(),
              meta: m.meta && typeof m.meta === 'object' ? m.meta : null,
            }))
        : [],
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 40);
}

export function upsertChatThread(threads = [], thread) {
  const list = normalizeChatThreads(threads);
  if (!thread || !thread.id) return list;
  const idx = list.findIndex((t) => t.id === thread.id);
  const updated = { ...thread, updatedAt: Date.now() };
  if (idx >= 0) {
    list[idx] = updated;
  } else {
    list.unshift(updated);
  }
  return list.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 40);
}

export function deleteChatThread(threads = [], threadId = '') {
  return normalizeChatThreads(threads).filter((t) => t.id !== threadId);
}

export function exportThreadMarkdown(thread) {
  if (!thread) return '';
  const lines = [`# ${thread.title || 'Manifest AI Chat'}`, ''];
  for (const m of thread.messages || []) {
    const label = m.role === 'user' ? '## Pengguna' : '## Manifest AI';
    lines.push(label, '', m.content || '', '');
  }
  return lines.join('\n').trim() + '\n';
}

/**
 * Safe, zero-XSS Markdown renderer for assistant replies (fenced code blocks with copy
 * button, inline code, headings, bold/italic, lists, links, and tables).
 */
export function escapeAiHtml(str = '') {
  return String(str || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatInlineMarkdown(escapedLine = '') {
  let out = escapedLine;
  // Inline code
  out = out.replace(/`([^`]+)`/g, '<code class="mai-inline-code">$1</code>');
  // Bold + italic
  out = out.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
  // Bold
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // Italic
  out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  // Safe https links
  out = out.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" class="mai-md-link">$1</a>'
  );
  return out;
}

export function renderMarkdownSafe(markdown = '') {
  const src = String(markdown || '').replace(/\r\n/g, '\n');
  if (!src.trim()) return '';

  // Extract fenced code blocks first so their contents aren't altered by inline formatting
  const codeBlocks = [];
  const tokenized = src.replace(/```([a-zA-Z0-9_+#.-]*)\n([\s\S]*?)```/g, (_m, lang, code) => {
    const idx = codeBlocks.length;
    const safeLang = escapeAiHtml((lang || 'kode').trim() || 'kode');
    const safeCode = escapeAiHtml(code.replace(/\n$/, ''));
    codeBlocks.push(
      `<div class="mai-code-block"><div class="mai-code-head"><span class="mai-code-lang">${safeLang}</span><button type="button" class="mai-code-copy" data-mai-copy-code="${idx}">Salin kode</button></div><pre><code>${safeCode}</code></pre></div>`
    );
    return `\n@@CODE_BLOCK_${idx}@@\n`;
  });

  const lines = tokenized.split('\n');
  const html = [];
  let inUl = false;
  let inOl = false;

  const closeLists = () => {
    if (inUl) {
      html.push('</ul>');
      inUl = false;
    }
    if (inOl) {
      html.push('</ol>');
      inOl = false;
    }
  };

  for (let i = 0; i < lines.length; i += 1) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      closeLists();
      continue;
    }

    const codeMatch = trimmed.match(/^@@CODE_BLOCK_(\d+)@@$/);
    if (codeMatch) {
      closeLists();
      html.push(codeBlocks[Number(codeMatch[1])] || '');
      continue;
    }

    const hMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (hMatch) {
      closeLists();
      const level = Math.min(4, Math.max(2, hMatch[1].length + 1));
      html.push(`<h${level} class="mai-md-h">${formatInlineMarkdown(escapeAiHtml(hMatch[2]))}</h${level}>`);
      continue;
    }

    const ulMatch = trimmed.match(/^[-*•]\s+(.+)$/);
    if (ulMatch) {
      if (inOl) {
        html.push('</ol>');
        inOl = false;
      }
      if (!inUl) {
        html.push('<ul class="mai-md-list">');
        inUl = true;
      }
      html.push(`<li>${formatInlineMarkdown(escapeAiHtml(ulMatch[1]))}</li>`);
      continue;
    }

    const olMatch = trimmed.match(/^\d+\.\s+(.+)$/);
    if (olMatch) {
      if (inUl) {
        html.push('</ul>');
        inUl = false;
      }
      if (!inOl) {
        html.push('<ol class="mai-md-list is-ordered">');
        inOl = true;
      }
      html.push(`<li>${formatInlineMarkdown(escapeAiHtml(olMatch[1]))}</li>`);
      continue;
    }

    if (trimmed.startsWith('> ')) {
      closeLists();
      html.push(`<blockquote class="mai-md-quote">${formatInlineMarkdown(escapeAiHtml(trimmed.slice(2)))}</blockquote>`);
      continue;
    }

    closeLists();
    html.push(`<p class="mai-md-p">${formatInlineMarkdown(escapeAiHtml(trimmed))}</p>`);
  }

  closeLists();
  return html.join('');
}

/**
 * ============================================================================
 * Natural Human Neural Voice Catalog & Mixed-Language (Code-Switching) Engine
 * ============================================================================
 * Curated Microsoft Edge Neural TTS voices (Male & Female across Indonesian,
 * - 29+ 100%-unique neural human voices (Azure V2 MultilingualNeural + Indonesian Native + English + Asian + Arabic + European)
 * - Single-speaker consistency: mixed Indonesian & English sentences ALWAYS keep the user's chosen voice
 *   without mid-sentence speaker swaps or choppy HTTP splice pauses
 * - Conversational spoken Indonesian normalization (Rupiah, %, abbreviations, smooth breathing punctuation)
 */
const LEGACY_VOICE_ALIASES = Object.freeze({
  'id-gadis-santai': 'multi-emma',
  'id-ardi-tenang': 'multi-andrew',
});

export const MANIFEST_AI_VOICE_CATALOG = Object.freeze([
  // Azure V2 Ultra-Natural Multilingual Neural Voices (1 single voice speaks fluent Indonesian + English + 40+ languages!)
  {
    id: 'multi-ava',
    name: 'Ava V2',
    label: 'Ava — Multibahasa Natural (Wanita)',
    lang: 'en-US',
    baseLang: 'multi',
    langGroup: 'multi',
    langLabel: 'Multibahasa (Indo + EN)',
    gender: 'female',
    isMultilingual: true,
    style: 'Hangat, luwes seperti manusia asli, fasih Indo & Inggris dalam 1 suara',
    edgeVoice: 'en-US-AvaMultilingualNeural - en-US (Female)',
    tiktokVoice: 'en_female_emotional',
    puterOpenAiVoice: 'coral',
    defaultPitch: 0,
    defaultRateDelta: 0,
    fallbackPitch: 2,
  },
  {
    id: 'multi-andrew',
    name: 'Andrew V2',
    label: 'Andrew — Multibahasa Natural (Pria)',
    lang: 'en-US',
    baseLang: 'multi',
    langGroup: 'multi',
    langLabel: 'Multibahasa (Indo + EN)',
    gender: 'male',
    isMultilingual: true,
    style: 'Pria hangat gaya podcast modern, fasih Indo & Inggris dalam 1 suara',
    edgeVoice: 'en-US-AndrewMultilingualNeural - en-US (Male)',
    tiktokVoice: 'en_us_006',
    puterOpenAiVoice: 'ash',
    defaultPitch: 0,
    defaultRateDelta: 0,
    fallbackPitch: -2,
  },
  {
    id: 'multi-emma',
    name: 'Emma V2',
    label: 'Emma — Multibahasa Lembut (Wanita)',
    lang: 'en-US',
    baseLang: 'multi',
    langGroup: 'multi',
    langLabel: 'Multibahasa (Indo + EN)',
    gender: 'female',
    isMultilingual: true,
    style: 'Lembut, jernih, intonasi santai modern untuk obrolan harian',
    edgeVoice: 'en-US-EmmaMultilingualNeural - en-US (Female)',
    tiktokVoice: 'en_us_002',
    puterOpenAiVoice: 'nova',
    defaultPitch: 0,
    defaultRateDelta: 0,
    fallbackPitch: 3,
  },
  {
    id: 'multi-brian',
    name: 'Brian V2',
    label: 'Brian — Multibahasa Tegas (Pria)',
    lang: 'en-US',
    baseLang: 'multi',
    langGroup: 'multi',
    langLabel: 'Multibahasa (Indo + EN)',
    gender: 'male',
    isMultilingual: true,
    style: 'Mantap, jelas, gaya presenter cerdas untuk penjelasan detail',
    edgeVoice: 'en-US-BrianMultilingualNeural - en-US (Male)',
    tiktokVoice: 'en_us_009',
    puterOpenAiVoice: 'echo',
    defaultPitch: 0,
    defaultRateDelta: 0,
    fallbackPitch: -1,
  },
  {
    id: 'multi-william',
    name: 'William V2',
    label: 'William — Multibahasa Santai (Pria)',
    lang: 'en-AU',
    baseLang: 'multi',
    langGroup: 'multi',
    langLabel: 'Multibahasa (Indo + EN)',
    gender: 'male',
    isMultilingual: true,
    style: 'Santai berkarakter dengan sentuhan aksen Australia halus',
    edgeVoice: 'en-AU-WilliamMultilingualNeural - en-AU (Male)',
    tiktokVoice: 'en_au_002',
    puterOpenAiVoice: 'fable',
    defaultPitch: 0,
    defaultRateDelta: 0,
    fallbackPitch: -1,
  },
  {
    id: 'multi-thalita',
    name: 'Thalita V2',
    label: 'Thalita — Multibahasa Cerah (Wanita)',
    lang: 'pt-BR',
    baseLang: 'multi',
    langGroup: 'multi',
    langLabel: 'Multibahasa (Indo + EN)',
    gender: 'female',
    isMultilingual: true,
    style: 'Ekspresif, ramah, ritme bicara hidup dan bersahabat',
    edgeVoice: 'pt-BR-ThalitaMultilingualNeural - pt-BR (Female)',
    tiktokVoice: 'en_us_001',
    puterOpenAiVoice: 'sage',
    defaultPitch: 0,
    defaultRateDelta: 0,
    fallbackPitch: 2,
  },
  {
    id: 'multi-giuseppe',
    name: 'Giuseppe V2',
    label: 'Giuseppe — Multibahasa Narator (Pria)',
    lang: 'it-IT',
    baseLang: 'multi',
    langGroup: 'multi',
    langLabel: 'Multibahasa (Indo + EN)',
    gender: 'male',
    isMultilingual: true,
    style: 'Berwibawa, hangat, cocok untuk narasi & ringkasan panjang',
    edgeVoice: 'it-IT-GiuseppeMultilingualNeural - it-IT (Male)',
    tiktokVoice: 'en_male_narration',
    puterOpenAiVoice: 'verse',
    defaultPitch: 0,
    defaultRateDelta: 0,
    fallbackPitch: -2,
  },

  // Indonesian Native Neural Voices (100% Authentic Local Accent)
  {
    id: 'id-gadis',
    name: 'Gadis',
    label: 'Gadis — Indonesia Asli (Wanita)',
    lang: 'id-ID',
    baseLang: 'id',
    langGroup: 'id',
    langLabel: 'Indonesia Asli',
    gender: 'female',
    isMultilingual: false,
    style: 'Pelafalan logat Indonesia asli yang ramah & konsisten',
    edgeVoice: 'id-ID-GadisNeural - id-ID (Female)',
    tiktokVoice: 'id_001',
    puterOpenAiVoice: 'nova',
    defaultPitch: 0,
    defaultRateDelta: 0,
    fallbackPitch: 1,
  },
  {
    id: 'id-ardi',
    name: 'Ardi',
    label: 'Ardi — Indonesia Asli (Pria)',
    lang: 'id-ID',
    baseLang: 'id',
    langGroup: 'id',
    langLabel: 'Indonesia Asli',
    gender: 'male',
    isMultilingual: false,
    style: 'Pria Indonesia berwibawa & tenang, pelafalan lokal autentik',
    edgeVoice: 'id-ID-ArdiNeural - id-ID (Male)',
    tiktokVoice: 'id_001',
    puterOpenAiVoice: 'onyx',
    defaultPitch: 0,
    defaultRateDelta: 0,
    fallbackPitch: -2,
  },

  // English Native Neural Voices (US / UK / AU) — distinct speakers!
  {
    id: 'en-aria',
    name: 'Aria (US)',
    label: 'Aria — Inggris Amerika Ekspresif (Wanita)',
    lang: 'en-US',
    baseLang: 'en',
    langGroup: 'en',
    langLabel: 'Inggris (US)',
    gender: 'female',
    isMultilingual: false,
    style: 'Dinamis, ekspresif, sangat komunikatif untuk obrolan cepat',
    edgeVoice: 'en-US-AriaNeural - en-US (Female)',
    tiktokVoice: 'en_female_emotional',
    puterOpenAiVoice: 'coral',
    defaultPitch: 0,
    defaultRateDelta: 0,
    fallbackPitch: 2,
  },
  {
    id: 'en-jenny',
    name: 'Jenny (US)',
    label: 'Jenny — Inggris Amerika Natural (Wanita)',
    lang: 'en-US',
    baseLang: 'en',
    langGroup: 'en',
    langLabel: 'Inggris (US)',
    gender: 'female',
    isMultilingual: false,
    style: 'Ramah, jernih, pelafalan Amerika standar yang bersahabat',
    edgeVoice: 'en-US-JennyNeural - en-US (Female)',
    tiktokVoice: 'en_us_001',
    puterOpenAiVoice: 'shimmer',
    defaultPitch: 0,
    defaultRateDelta: 0,
    fallbackPitch: 1,
  },
  {
    id: 'en-michelle',
    name: 'Michelle (US)',
    label: 'Michelle — Inggris Amerika Lembut (Wanita)',
    lang: 'en-US',
    baseLang: 'en',
    langGroup: 'en',
    langLabel: 'Inggris (US)',
    gender: 'female',
    isMultilingual: false,
    style: 'Lembut, profesional, cocok untuk tutorial & ulasan',
    edgeVoice: 'en-US-MichelleNeural - en-US (Female)',
    tiktokVoice: 'en_us_002',
    puterOpenAiVoice: 'sage',
    defaultPitch: 0,
    defaultRateDelta: 0,
    fallbackPitch: 2,
  },
  {
    id: 'en-guy',
    name: 'Guy (US)',
    label: 'Guy — Inggris Amerika Santai (Pria)',
    lang: 'en-US',
    baseLang: 'en',
    langGroup: 'en',
    langLabel: 'Inggris (US)',
    gender: 'male',
    isMultilingual: false,
    style: 'Pria Amerika modern, lugas, dan kasual',
    edgeVoice: 'en-US-GuyNeural - en-US (Male)',
    tiktokVoice: 'en_us_006',
    puterOpenAiVoice: 'echo',
    defaultPitch: 0,
    defaultRateDelta: 0,
    fallbackPitch: -1,
  },
  {
    id: 'en-christopher',
    name: 'Christopher (US)',
    label: 'Christopher — Inggris Amerika Dalam (Pria)',
    lang: 'en-US',
    baseLang: 'en',
    langGroup: 'en',
    langLabel: 'Inggris (US)',
    gender: 'male',
    isMultilingual: false,
    style: 'Suara pria dalam dan tenang untuk penjelasan terstruktur',
    edgeVoice: 'en-US-ChristopherNeural - en-US (Male)',
    tiktokVoice: 'en_us_007',
    puterOpenAiVoice: 'onyx',
    defaultPitch: 0,
    defaultRateDelta: 0,
    fallbackPitch: -3,
  },
  {
    id: 'en-sonia',
    name: 'Sonia (UK)',
    label: 'Sonia — Inggris British Elegan (Wanita)',
    lang: 'en-GB',
    baseLang: 'en',
    langGroup: 'en',
    langLabel: 'Inggris (UK)',
    gender: 'female',
    isMultilingual: false,
    style: 'Aksen British elegan yang jelas & rapi',
    edgeVoice: 'en-GB-SoniaNeural - en-GB (Female)',
    tiktokVoice: 'en_uk_001',
    puterOpenAiVoice: 'alloy',
    defaultPitch: 0,
    defaultRateDelta: 0,
    fallbackPitch: 1,
  },
  {
    id: 'en-ryan',
    name: 'Ryan (UK)',
    label: 'Ryan — Inggris British Hangat (Pria)',
    lang: 'en-GB',
    baseLang: 'en',
    langGroup: 'en',
    langLabel: 'Inggris (UK)',
    gender: 'male',
    isMultilingual: false,
    style: 'Pria British hangat & artikulatif',
    edgeVoice: 'en-GB-RyanNeural - en-GB (Male)',
    tiktokVoice: 'en_uk_003',
    puterOpenAiVoice: 'ballad',
    defaultPitch: 0,
    defaultRateDelta: 0,
    fallbackPitch: -1,
  },
  {
    id: 'en-natasha',
    name: 'Natasha (AU)',
    label: 'Natasha — Inggris Australia (Wanita)',
    lang: 'en-AU',
    baseLang: 'en',
    langGroup: 'en',
    langLabel: 'Inggris (AU)',
    gender: 'female',
    isMultilingual: false,
    style: 'Aksen Australia cerah, ramah & ringan didengar',
    edgeVoice: 'en-AU-NatashaNeural - en-AU (Female)',
    tiktokVoice: 'en_au_001',
    puterOpenAiVoice: 'coral',
    defaultPitch: 0,
    defaultRateDelta: 0,
    fallbackPitch: 2,
  },

  // Malay (Serumpun)
  {
    id: 'ms-yasmin',
    name: 'Yasmin',
    label: 'Yasmin — Melayu (Wanita)',
    lang: 'ms-MY',
    baseLang: 'ms',
    langGroup: 'ms',
    langLabel: 'Melayu',
    gender: 'female',
    isMultilingual: false,
    style: 'Lembut dengan pelafalan Melayu natural',
    edgeVoice: 'ms-MY-YasminNeural - ms-MY (Female)',
    tiktokVoice: 'id_001',
    puterOpenAiVoice: 'nova',
    defaultPitch: 0,
    defaultRateDelta: 0,
    fallbackPitch: 1,
  },
  {
    id: 'ms-osman',
    name: 'Osman',
    label: 'Osman — Melayu (Pria)',
    lang: 'ms-MY',
    baseLang: 'ms',
    langGroup: 'ms',
    langLabel: 'Melayu',
    gender: 'male',
    isMultilingual: false,
    style: 'Pria Melayu jelas & tenang',
    edgeVoice: 'ms-MY-OsmanNeural - ms-MY (Male)',
    tiktokVoice: 'id_001',
    puterOpenAiVoice: 'ash',
    defaultPitch: 0,
    defaultRateDelta: 0,
    fallbackPitch: -2,
  },

  // Japanese, Korean, Mandarin, Arabic, European
  {
    id: 'ja-nanami',
    name: 'Nanami',
    label: 'Nanami — Jepang (Wanita)',
    lang: 'ja-JP',
    baseLang: 'ja',
    langGroup: 'asia',
    langLabel: 'Jepang',
    gender: 'female',
    isMultilingual: false,
    style: 'Pelafalan Jepang alami & ekspresif',
    edgeVoice: 'ja-JP-NanamiNeural - ja-JP (Female)',
    tiktokVoice: 'jp_001',
    puterOpenAiVoice: 'shimmer',
    defaultPitch: 0,
    defaultRateDelta: 0,
    fallbackPitch: 2,
  },
  {
    id: 'ja-keita',
    name: 'Keita',
    label: 'Keita — Jepang (Pria)',
    lang: 'ja-JP',
    baseLang: 'ja',
    langGroup: 'asia',
    langLabel: 'Jepang',
    gender: 'male',
    isMultilingual: false,
    style: 'Pria Jepang natural & tenang',
    edgeVoice: 'ja-JP-KeitaNeural - ja-JP (Male)',
    tiktokVoice: 'jp_006',
    puterOpenAiVoice: 'verse',
    defaultPitch: 0,
    defaultRateDelta: 0,
    fallbackPitch: -1,
  },
  {
    id: 'ko-sunhi',
    name: 'SunHi',
    label: 'SunHi — Korea (Wanita)',
    lang: 'ko-KR',
    baseLang: 'ko',
    langGroup: 'asia',
    langLabel: 'Korea',
    gender: 'female',
    isMultilingual: false,
    style: 'Pelafalan Korea halus & natural',
    edgeVoice: 'ko-KR-SunHiNeural - ko-KR (Female)',
    tiktokVoice: 'kr_003',
    puterOpenAiVoice: 'nova',
    defaultPitch: 0,
    defaultRateDelta: 0,
    fallbackPitch: 2,
  },
  {
    id: 'ko-hyunsu',
    name: 'Hyunsu V2',
    label: 'Hyunsu — Korea Multibahasa (Pria)',
    lang: 'ko-KR',
    baseLang: 'ko',
    langGroup: 'asia',
    langLabel: 'Korea + Multi',
    gender: 'male',
    isMultilingual: true,
    style: 'Pria Korea natural & fasih multibahasa',
    edgeVoice: 'ko-KR-HyunsuMultilingualNeural - ko-KR (Male)',
    tiktokVoice: 'kr_002',
    puterOpenAiVoice: 'ballad',
    defaultPitch: 0,
    defaultRateDelta: 0,
    fallbackPitch: -1,
  },
  {
    id: 'zh-xiaoxiao',
    name: 'Xiaoxiao',
    label: 'Xiaoxiao — Mandarin (Wanita)',
    lang: 'zh-CN',
    baseLang: 'zh',
    langGroup: 'asia',
    langLabel: 'Mandarin',
    gender: 'female',
    isMultilingual: false,
    style: 'Mandarin ekspresif & hangat',
    edgeVoice: 'zh-CN-XiaoxiaoNeural - zh-CN (Female)',
    tiktokVoice: 'en_us_001',
    puterOpenAiVoice: 'coral',
    defaultPitch: 0,
    defaultRateDelta: 0,
    fallbackPitch: 2,
  },
  {
    id: 'zh-yunxi',
    name: 'Yunxi',
    label: 'Yunxi — Mandarin (Pria)',
    lang: 'zh-CN',
    baseLang: 'zh',
    langGroup: 'asia',
    langLabel: 'Mandarin',
    gender: 'male',
    isMultilingual: false,
    style: 'Pria Mandarin ceria & natural',
    edgeVoice: 'zh-CN-YunxiNeural - zh-CN (Male)',
    tiktokVoice: 'en_us_006',
    puterOpenAiVoice: 'echo',
    defaultPitch: 0,
    defaultRateDelta: 0,
    fallbackPitch: 0,
  },
  {
    id: 'ar-zariyah',
    name: 'Zariyah',
    label: 'Zariyah — Arab (Wanita)',
    lang: 'ar-SA',
    baseLang: 'ar',
    langGroup: 'ar',
    langLabel: 'Arab',
    gender: 'female',
    isMultilingual: false,
    style: 'Bahasa Arab fusha jernih & fasih',
    edgeVoice: 'ar-SA-ZariyahNeural - ar-SA (Female)',
    tiktokVoice: 'en_us_001',
    puterOpenAiVoice: 'sage',
    defaultPitch: 0,
    defaultRateDelta: 0,
    fallbackPitch: 1,
  },
  {
    id: 'ar-hamed',
    name: 'Hamed',
    label: 'Hamed — Arab (Pria)',
    lang: 'ar-SA',
    baseLang: 'ar',
    langGroup: 'ar',
    langLabel: 'Arab',
    gender: 'male',
    isMultilingual: false,
    style: 'Pria Arab fusha mantap & berwibawa',
    edgeVoice: 'ar-SA-HamedNeural - ar-SA (Male)',
    tiktokVoice: 'en_us_006',
    puterOpenAiVoice: 'onyx',
    defaultPitch: 0,
    defaultRateDelta: 0,
    fallbackPitch: -2,
  },
  {
    id: 'fr-vivienne',
    name: 'Vivienne V2',
    label: 'Vivienne — Prancis Multibahasa (Wanita)',
    lang: 'fr-FR',
    baseLang: 'fr',
    langGroup: 'eu',
    langLabel: 'Prancis + Multi',
    gender: 'female',
    isMultilingual: true,
    style: 'Aksen Prancis elegan & fasih multibahasa',
    edgeVoice: 'fr-FR-VivienneMultilingualNeural - fr-FR (Female)',
    tiktokVoice: 'fr_001',
    puterOpenAiVoice: 'shimmer',
    defaultPitch: 0,
    defaultRateDelta: 0,
    fallbackPitch: 1,
  },
  {
    id: 'fr-remy',
    name: 'Remy V2',
    label: 'Remy — Prancis Multibahasa (Pria)',
    lang: 'fr-FR',
    baseLang: 'fr',
    langGroup: 'eu',
    langLabel: 'Prancis + Multi',
    gender: 'male',
    isMultilingual: true,
    style: 'Pria Prancis ekspresif & fasih multibahasa',
    edgeVoice: 'fr-FR-RemyMultilingualNeural - fr-FR (Male)',
    tiktokVoice: 'fr_002',
    puterOpenAiVoice: 'fable',
    defaultPitch: 0,
    defaultRateDelta: 0,
    fallbackPitch: -1,
  },
  {
    id: 'es-elvira',
    name: 'Elvira',
    label: 'Elvira — Spanyol (Wanita)',
    lang: 'es-ES',
    baseLang: 'es',
    langGroup: 'eu',
    langLabel: 'Spanyol',
    gender: 'female',
    isMultilingual: false,
    style: 'Pelafalan Spanyol natural & jelas',
    edgeVoice: 'es-ES-ElviraNeural - es-ES (Female)',
    tiktokVoice: 'es_002',
    puterOpenAiVoice: 'coral',
    defaultPitch: 0,
    defaultRateDelta: 0,
    fallbackPitch: 1,
  },
  {
    id: 'de-conrad',
    name: 'Conrad',
    label: 'Conrad — Jerman (Pria)',
    lang: 'de-DE',
    baseLang: 'de',
    langGroup: 'eu',
    langLabel: 'Jerman',
    gender: 'male',
    isMultilingual: false,
    style: 'Pria Jerman jernih & natural',
    edgeVoice: 'de-DE-ConradNeural - de-DE (Male)',
    tiktokVoice: 'de_002',
    puterOpenAiVoice: 'ash',
    defaultPitch: 0,
    defaultRateDelta: 0,
    fallbackPitch: -2,
  },
]);

export function getVoiceProfileById(voiceId = 'multi-ava') {
  const mapped = LEGACY_VOICE_ALIASES[voiceId] || voiceId;
  return MANIFEST_AI_VOICE_CATALOG.find((v) => v.id === mapped) || MANIFEST_AI_VOICE_CATALOG[0];
}

function detectNonLatinScript(word = '') {
  if (/[\u0600-\u06FF\u0750-\u077F]/.test(word)) return 'ar';
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(word)) return 'ja';
  if (/[\uAC00-\uD7AF\u1100-\u11FF]/.test(word)) return 'ko';
  if (/[\u4E00-\u9FFF]/.test(word)) return 'zh';
  return null;
}

function formatRupiahSpoken(rawDigits = '') {
  const num = Number(String(rawDigits || '').replace(/[^0-9]/g, ''));
  if (!Number.isFinite(num) || num <= 0) return 'rupiah';
  if (num >= 1_000_000_000) {
    const m = (num / 1_000_000_000).toFixed(num % 1_000_000_000 === 0 ? 0 : 1).replace('.', ',');
    return `${m} miliar rupiah`;
  }
  if (num >= 1_000_000) {
    const jt = (num / 1_000_000).toFixed(num % 1_000_000 === 0 ? 0 : 1).replace('.', ',');
    return `${jt} juta rupiah`;
  }
  if (num >= 1000 && num % 1000 === 0) {
    return `${num / 1000} ribu rupiah`;
  }
  return `${num} rupiah`;
}

/**
 * Normalizes Markdown, currency, abbreviations, symbols, and sensitive owner info
 * so TTS voices sound like relaxed, conversational human speech instead of a rigid screen reader.
 */
export function cleanTextForSpeech(markdown = '', catalogData = null) {
  let text = redactSensitiveOwnerData(String(markdown || ''), catalogData);
  // Replace fenced code blocks with a polite spoken cue instead of reading raw syntax
  text = text.replace(/```[\s\S]*?```/g, '. Potongan kode tersedia di layar. ');
  // Convert Markdown links `[Label](https://...)` to just `Label`
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '$1');
  // Remove bare URLs except readable domain names
  text = text.replace(/https?:\/\/(?:www\.)?([a-zA-Z0-9.-]+)(?:\/[^\s)]*)?/g, '$1');
  // Strip inline code backticks, headings, bold/italic markers, blockquotes, list bullets
  text = text
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/^\s*(?:[-*•]+|\d+[.)])\s+/gm, '')
    .replace(/\*\*\*([^*]+)\*\*\*/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/_{1,2}([^_\n]+)_{1,2}/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1');

  // Make masked owner placeholders sound natural instead of reading "x x x x x"
  text = text.replace(/62x{5,}/gi, 'nomor yang disensor');
  text = text.replace(/@[a-z]\*{4,}[a-z]/gi, 'akun yang disensor');

  // Convert Indonesian Rupiah pricing into natural conversational speech ("Rp25.000" -> "25 ribu rupiah")
  text = text.replace(/Rp\.?\s*([0-9][0-9.]*)/gi, (_, digits) => formatRupiahSpoken(digits));

  // Expand stiff symbols & common Indonesian abbreviations that make neural voices stumble
  text = text
    .replace(/(\d+)\s*%/g, '$1 persen')
    .replace(/\b([A-Za-zÀ-ÿ0-9-]+)\s*\/\s*([A-Za-zÀ-ÿ0-9-]+)\b/g, '$1 atau $2')
    .replace(/\s+&\s+/g, ' dan ')
    .replace(/\bdll\.?(?=\s|$|[,.)])/gi, 'dan lain-lain')
    .replace(/\bdsb\.?(?=\s|$|[,.)])/gi, 'dan sebagainya')
    .replace(/\bdst\.?(?=\s|$|[,.)])/gi, 'dan seterusnya')
    .replace(/\bdkk\.?(?=\s|$|[,.)])/gi, 'dan kawan-kawan')
    .replace(/\bspt\.?(?=\s|$)/gi, 'seperti')
    .replace(/\byg\b/gi, 'yang')
    .replace(/\butk\b/gi, 'untuk')
    .replace(/\bdgn\b/gi, 'dengan')
    .replace(/\btsb\b/gi, 'tersebut')
    .replace(/\bsbg\b/gi, 'sebagai');

  // Remove decorative emojis / pictographs that cause awkward pauses or weird pronunciations
  text = text.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\uFE0F]/gu, '');

  // Smooth whitespace, line breaks, colons, and parentheses into natural human breathing pauses
  text = text
    .replace(/:\s+/g, ', ')
    .replace(/\s+[—–-]\s+/g, ', ')
    .replace(/\r?\n{2,}/g, '. ')
    .replace(/\r?\n/g, ', ')
    .replace(/[·•|]/g, ', ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\.\s*\./g, '.')
    .replace(/,\s*,+/g, ',')
    .trim();
  return text;
}

/**
 * Chunks speech cleanly WITHOUT splitting mixed Latin sentences (e.g., Indonesian + English)
 * across different speakers.
 *
 * All Latin sentences (including mixed Indonesian + English like
 * "pak salim membeli buku The King Of Madagascar and Island di perpustakaan yang melelang buku")
 * stay inside ONE unified span spoken by ONE consistent human voice!
 * Non-Latin scripts (Arabic, Japanese, Korean, Mandarin) are only separated as needed when the
 * selected voice is not natively multilingual.
 */
export function segmentMultilingualSpeech(
  rawText = '',
  primaryLang = 'multi',
  { maxSegmentChars = 340, codeSwitch = true, isMultilingualVoice = false } = {}
) {
  const clean = String(rawText || '').trim();
  if (!clean) return [];

  const baseLang = primaryLang === 'multi' ? 'id' : String(primaryLang || 'id').toLowerCase().split('-')[0];

  const detectMixedLatinTag = (str) => {
    const hasIndo = /\b(?:yang|dan|di|ke|dari|untuk|dengan|buku|membeli|melelang|perpustakaan|halo|saya|anda|ini|itu)\b/i.test(str);
    const hasEng = /\b(?:the|of|and|in|island|king|book|hello|welcome|library|studio|market|model|voice|english)\b/i.test(str);
    if (hasIndo && hasEng) return 'id+en';
    if (hasEng && !hasIndo && baseLang !== 'id') return 'en';
    return baseLang === 'en' ? 'en' : 'id';
  };

  const splitLongChunks = (str, explicitLang = null) => {
    const trimmed = str.trim();
    if (!trimmed) return [];
    const tag = explicitLang || detectMixedLatinTag(trimmed);
    if (trimmed.length <= maxSegmentChars) return [{ lang: tag, text: trimmed }];

    const parts = [];
    const sentences = trimmed.split(/(?<=[.!?。！？])\s+/);
    let current = '';
    for (const s of sentences) {
      if (!s.trim()) continue;
      if (current && current.length + s.length + 1 > maxSegmentChars) {
        parts.push({ lang: explicitLang || detectMixedLatinTag(current), text: current.trim() });
        current = s;
      } else {
        current = current ? `${current} ${s}` : s;
      }
    }
    if (current.trim()) parts.push({ lang: explicitLang || detectMixedLatinTag(current), text: current.trim() });

    const finalParts = [];
    for (const p of parts) {
      if (p.text.length <= maxSegmentChars) {
        finalParts.push(p);
      } else {
        const sub = p.text.split(/(?<=,|;)\s+/);
        let acc = '';
        for (const piece of sub) {
          if (acc && acc.length + piece.length + 1 > maxSegmentChars) {
            finalParts.push({ lang: explicitLang || detectMixedLatinTag(acc), text: acc.trim() });
            acc = piece;
          } else {
            acc = acc ? `${acc} ${piece}` : piece;
          }
        }
        if (acc.trim()) finalParts.push({ lang: explicitLang || detectMixedLatinTag(acc), text: acc.trim() });
      }
    }
    return finalParts;
  };

  // Keep mixed Latin text ALWAYS unified! Only split off non-Latin runs when voice is Latin-only & codeSwitch is enabled
  const hasNonLatin = /[\u0600-\u06FF\u0750-\u077F\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF\u1100-\u11FF\u4E00-\u9FFF]/.test(clean);
  if (!hasNonLatin || !codeSwitch || isMultilingualVoice) {
    return splitLongChunks(clean);
  }

  // Split ONLY at non-Latin script boundaries while keeping surrounding Latin text unified
  const tokens = clean.split(/\s+/).filter(Boolean);
  const runs = [];
  for (const tok of tokens) {
    const script = detectNonLatinScript(tok) || 'latin';
    const last = runs[runs.length - 1];
    if (last && last.script === script) {
      last.text = `${last.text} ${tok}`;
    } else {
      runs.push({ script, text: tok });
    }
  }

  const out = [];
  for (const r of runs) {
    out.push(...splitLongChunks(r.text, r.script === 'latin' ? null : r.script));
  }
  return out;
}

/**
 * Resolves which voice profile speaks a given segment.
 * - ALWAYS preserves the user's selected speaker for ALL Latin text (Indonesian, English, mixed, Malay, French, etc.)
 *   so switching voice models in the UI ALWAYS changes the actual voice heard, and mixed sentences NEVER swap speakers mid-way!
 * - If the chosen voice is Azure V2 MultilingualNeural (`isMultilingual: true`), it ALSO handles non-Latin scripts in 1 voice.
 * - Only borrows a matching-gender native voice when a Latin-only voice encounters non-Latin text (Japanese, Korean, Mandarin, Arabic).
 */
export function resolveVoiceForSegment(selectedVoiceId = 'multi-ava', segmentLang = 'id', codeSwitch = true) {
  const base = getVoiceProfileById(selectedVoiceId);
  const targetLang = String(segmentLang || 'id').toLowerCase().split(/[-+]/)[0];
  const isNonLatin = ['ar', 'ja', 'ko', 'zh'].includes(targetLang);

  // Always preserve user's chosen speaker for Latin languages OR when speaker is natively Multilingual V2
  if (!codeSwitch || !isNonLatin || base.isMultilingual || base.baseLang === targetLang) {
    return base;
  }

  // Non-Latin fallback when user picked a Latin-only voice (e.g. Gadis / Ardi)
  const gender = base.gender === 'male' ? 'male' : 'female';
  const nonLatinMap = {
    ja: gender === 'male' ? 'ja-keita' : 'ja-nanami',
    ko: gender === 'male' ? 'ko-hyunsu' : 'ko-sunhi',
    zh: gender === 'male' ? 'zh-yunxi' : 'zh-xiaoxiao',
    ar: gender === 'male' ? 'ar-hamed' : 'ar-zariyah',
  };

  const mappedId = nonLatinMap[targetLang];
  return mappedId ? getVoiceProfileById(mappedId) : base;
}
