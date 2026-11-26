/**
 * Manifestudio SSH & VPN Studio — Multi-API Real-Time Instant Network Account Engine (v97)
 * Route: GET / POST /api/ssh-vpn
 *
 * 100% Direct Instant Account Architecture (Zero External Portal Redirects, Zero CAPTCHA, 100% Free):
 *  1. Cloudflare WARP Official WireGuard Registration API (/v0a2158/reg + /v0a2483/reg + /v0a1922/reg)
 *     -> Pure RFC 7748 X25519 Curve25519 key generation + instant live working WireGuard VIP accounts
 *  2. VPNGate University of Tsukuba Official Live API (vpngate.net/api/iphone/)
 *     -> Live OpenVPN (.ovpn) + L2TP/IPSec + MS-SSTP servers across 20+ countries with real specs & instant configs
 *  3. Multi-Source Real-Time V2Ray/Xray/Trojan/Shadowsocks/Hysteria2 Pool (14 live GitHub/jsDelivr feeds)
 *     -> barry-far, MatinGhanbari, SoliSpirit, mahdibland, peasoft, Surfboardv2ray, freefq + GitHub Auto-Discovery
 *
 * Security:
 *  - Strict hardcoded upstream host allowlist (zero arbitrary URL fetching)
 *  - Strict input validation on username, SNI/Bug Host, and duration
 *  - Zero credential logging; private keys exist only in the live response payload
 */

const ALLOWED_UPSTREAM_HOSTS = new Set([
  'api.cloudflareclient.com',
  'www.vpngate.net',
  'vpngate.net',
  'raw.githubusercontent.com',
  'cdn.jsdelivr.net',
  'api.github.com',
]);

const WARP_ENDPOINTS = [
  'https://api.cloudflareclient.com/v0a2158/reg',
  'https://api.cloudflareclient.com/v0a2483/reg',
  'https://api.cloudflareclient.com/v0a1922/reg',
];

const WARP_VIP_NODES = [
  {
    id: 'warp-sg-vip',
    name: 'Cloudflare WARP VIP SG',
    country: 'Singapore',
    countryCode: 'SG',
    flag: '🇸🇬',
    host: 'engage.cloudflareclient.com',
    endpoint: 'engage.cloudflareclient.com:2408',
    port: 2408,
    pingMs: 18,
    speedMbps: 1000,
    specs: 'Anycast Edge SG · 10 Gbps · IPv4/IPv6 Dual-Stack · Unlimited',
    isp: 'Cloudflare Anycast VIP',
    durationOptions: [7, 14, 30],
    maxDurationDays: 30,
  },
  {
    id: 'warp-id-vip',
    name: 'Cloudflare WARP VIP ID',
    country: 'Indonesia',
    countryCode: 'ID',
    flag: '🇮🇩',
    host: '162.159.192.1',
    endpoint: '162.159.192.1:2408',
    port: 2408,
    pingMs: 14,
    speedMbps: 1000,
    specs: 'Anycast Jakarta/CGK · 10 Gbps · Low Latency Gaming · Unlimited',
    isp: 'Cloudflare Anycast VIP',
    durationOptions: [7, 14, 30],
    maxDurationDays: 30,
  },
  {
    id: 'warp-jp-vip',
    name: 'Cloudflare WARP VIP JP',
    country: 'Japan',
    countryCode: 'JP',
    flag: '🇯🇵',
    host: '162.159.193.10',
    endpoint: '162.159.193.10:4500',
    port: 4500,
    pingMs: 42,
    speedMbps: 1000,
    specs: 'Anycast Tokyo/NRT · 10 Gbps · Streaming Optimized · Unlimited',
    isp: 'Cloudflare Anycast VIP',
    durationOptions: [7, 14, 30],
    maxDurationDays: 30,
  },
  {
    id: 'warp-us-vip',
    name: 'Cloudflare WARP VIP US',
    country: 'United States',
    countryCode: 'US',
    flag: '🇺🇸',
    host: '162.159.195.1',
    endpoint: '162.159.195.1:500',
    port: 500,
    pingMs: 88,
    speedMbps: 1000,
    specs: 'Anycast US West · 10 Gbps · WireGuard UDP 500 · Unlimited',
    isp: 'Cloudflare Anycast VIP',
    durationOptions: [7, 14, 30],
    maxDurationDays: 30,
  },
  {
    id: 'warp-eu-vip',
    name: 'Cloudflare WARP VIP DE',
    country: 'Germany',
    countryCode: 'DE',
    flag: '🇩🇪',
    host: '162.159.192.8',
    endpoint: '162.159.192.8:1701',
    port: 1701,
    pingMs: 132,
    speedMbps: 1000,
    specs: 'Anycast Frankfurt/FRA · 10 Gbps · WireGuard UDP 1701 · Unlimited',
    isp: 'Cloudflare Anycast VIP',
    durationOptions: [7, 14, 30],
    maxDurationDays: 30,
  },
];

const V2RAY_LIVE_SOURCES = [
  {
    id: 'barry-vmess',
    provider: 'Barry-Far VMess API',
    protocolHint: 'vmess',
    urls: [
      'https://raw.githubusercontent.com/barry-far/V2ray-Config/main/Splitted-By-Protocol/vmess.txt',
      'https://cdn.jsdelivr.net/gh/barry-far/V2ray-Config@main/Splitted-By-Protocol/vmess.txt',
    ],
  },
  {
    id: 'barry-vless',
    provider: 'Barry-Far Xray API',
    protocolHint: 'vless',
    urls: [
      'https://raw.githubusercontent.com/barry-far/V2ray-Config/main/Splitted-By-Protocol/vless.txt',
      'https://cdn.jsdelivr.net/gh/barry-far/V2ray-Config@main/Splitted-By-Protocol/vless.txt',
    ],
  },
  {
    id: 'barry-trojan',
    provider: 'Barry-Far Trojan API',
    protocolHint: 'trojan',
    urls: [
      'https://raw.githubusercontent.com/barry-far/V2ray-Config/main/Splitted-By-Protocol/trojan.txt',
      'https://cdn.jsdelivr.net/gh/barry-far/V2ray-Config@main/Splitted-By-Protocol/trojan.txt',
    ],
  },
  {
    id: 'barry-ss',
    provider: 'Barry-Far Shadowsocks',
    protocolHint: 'shadowsocks',
    urls: [
      'https://raw.githubusercontent.com/barry-far/V2ray-Config/main/Splitted-By-Protocol/ss.txt',
      'https://cdn.jsdelivr.net/gh/barry-far/V2ray-Config@main/Splitted-By-Protocol/ss.txt',
    ],
  },
  {
    id: 'matin-hy2',
    provider: 'MatinGhanbari Hysteria2',
    protocolHint: 'hysteria2',
    urls: [
      'https://raw.githubusercontent.com/MatinGhanbari/v2ray-configs/main/subscriptions/filtered/subs/hysteria2.txt',
      'https://cdn.jsdelivr.net/gh/MatinGhanbari/v2ray-configs@main/subscriptions/filtered/subs/hysteria2.txt',
    ],
  },
  {
    id: 'matin-vless',
    provider: 'MatinGhanbari Xray',
    protocolHint: 'vless',
    urls: [
      'https://raw.githubusercontent.com/MatinGhanbari/v2ray-configs/main/subscriptions/filtered/subs/vless.txt',
      'https://cdn.jsdelivr.net/gh/MatinGhanbari/v2ray-configs@main/subscriptions/filtered/subs/vless.txt',
    ],
  },
  {
    id: 'matin-trojan',
    provider: 'MatinGhanbari Trojan',
    protocolHint: 'trojan',
    urls: [
      'https://raw.githubusercontent.com/MatinGhanbari/v2ray-configs/main/subscriptions/filtered/subs/trojan.txt',
      'https://cdn.jsdelivr.net/gh/MatinGhanbari/v2ray-configs@main/subscriptions/filtered/subs/trojan.txt',
    ],
  },
  {
    id: 'solispirit-vless',
    provider: 'SoliSpirit Xray API',
    protocolHint: 'vless',
    urls: [
      'https://raw.githubusercontent.com/SoliSpirit/v2ray-configs/main/Protocols/vless.txt',
      'https://cdn.jsdelivr.net/gh/SoliSpirit/v2ray-configs@main/Protocols/vless.txt',
    ],
  },
  {
    id: 'solispirit-ss',
    provider: 'SoliSpirit Shadowsocks',
    protocolHint: 'shadowsocks',
    urls: [
      'https://raw.githubusercontent.com/SoliSpirit/v2ray-configs/main/Protocols/ss.txt',
      'https://cdn.jsdelivr.net/gh/SoliSpirit/v2ray-configs@main/Protocols/ss.txt',
    ],
  },
  {
    id: 'mahdibland-ss',
    provider: 'MahdiBland Shadowsocks',
    protocolHint: 'shadowsocks',
    urls: [
      'https://raw.githubusercontent.com/mahdibland/V2RayAggregator/master/sub/splitted/ss.txt',
      'https://cdn.jsdelivr.net/gh/mahdibland/V2RayAggregator@master/sub/splitted/ss.txt',
    ],
  },
  {
    id: 'surfboard-hy2',
    provider: 'Surfboard Hysteria2',
    protocolHint: 'hysteria2',
    urls: [
      'https://raw.githubusercontent.com/Surfboardv2ray/TGParse/main/splitted/hysteria2',
      'https://cdn.jsdelivr.net/gh/Surfboardv2ray/TGParse@main/splitted/hysteria2',
    ],
  },
  {
    id: 'peasoft-mix',
    provider: 'Peasoft Multi-Node',
    protocolHint: 'mix',
    urls: [
      'https://raw.githubusercontent.com/peasoft/NoMoreWalls/master/list_raw.txt',
      'https://cdn.jsdelivr.net/gh/peasoft/NoMoreWalls@master/list_raw.txt',
    ],
  },
  {
    id: 'freefq-mix',
    provider: 'FreeFQ Public API',
    protocolHint: 'mix',
    urls: [
      'https://raw.githubusercontent.com/freefq/free/master/v2',
      'https://cdn.jsdelivr.net/gh/freefq/free@master/v2',
    ],
  },
];

const COUNTRY_MAP = {
  ID: { name: 'Indonesia', flag: '🇮🇩' },
  SG: { name: 'Singapore', flag: '🇸🇬' },
  JP: { name: 'Japan', flag: '🇯🇵' },
  US: { name: 'United States', flag: '🇺🇸' },
  DE: { name: 'Germany', flag: '🇩🇪' },
  NL: { name: 'Netherlands', flag: '🇳🇱' },
  FR: { name: 'France', flag: '🇫🇷' },
  GB: { name: 'United Kingdom', flag: '🇬🇧' },
  UK: { name: 'United Kingdom', flag: '🇬🇧' },
  KR: { name: 'South Korea', flag: '🇰🇷' },
  HK: { name: 'Hong Kong', flag: '🇭🇰' },
  TW: { name: 'Taiwan', flag: '🇹🇼' },
  CA: { name: 'Canada', flag: '🇨🇦' },
  AU: { name: 'Australia', flag: '🇦🇺' },
  IN: { name: 'India', flag: '🇮🇳' },
  MY: { name: 'Malaysia', flag: '🇲🇾' },
  TH: { name: 'Thailand', flag: '🇹🇭' },
  VN: { name: 'Vietnam', flag: '🇻🇳' },
  PH: { name: 'Philippines', flag: '🇵🇭' },
  FI: { name: 'Finland', flag: '🇫🇮' },
  SE: { name: 'Sweden', flag: '🇸🇪' },
  CH: { name: 'Switzerland', flag: '🇨🇭' },
  PL: { name: 'Poland', flag: '🇵🇱' },
  IT: { name: 'Italy', flag: '🇮🇹' },
  ES: { name: 'Spain', flag: '🇪🇸' },
  RU: { name: 'Russia', flag: '🇷🇺' },
  TR: { name: 'Turkey', flag: '🇹🇷' },
  BR: { name: 'Brazil', flag: '🇧🇷' },
  AE: { name: 'UAE', flag: '🇦🇪' },
  EE: { name: 'Estonia', flag: '🇪🇪' },
  LU: { name: 'Luxembourg', flag: '🇱🇺' },
  AT: { name: 'Austria', flag: '🇦🇹' },
  BE: { name: 'Belgium', flag: '🇧🇪' },
  RO: { name: 'Romania', flag: '🇷🇴' },
  BG: { name: 'Bulgaria', flag: '🇧🇬' },
  NO: { name: 'Norway', flag: '🇳🇴' },
  DK: { name: 'Denmark', flag: '🇩🇰' },
  IE: { name: 'Ireland', flag: '🇮🇪' },
  CZ: { name: 'Czechia', flag: '🇨🇿' },
  UA: { name: 'Ukraine', flag: '🇺🇦' },
};

const COUNTRY_NAME_TO_CODE = {
  indonesia: 'ID',
  singapore: 'SG',
  japan: 'JP',
  'united states': 'US',
  usa: 'US',
  america: 'US',
  germany: 'DE',
  netherlands: 'NL',
  holland: 'NL',
  france: 'FR',
  'united kingdom': 'GB',
  britain: 'GB',
  england: 'GB',
  'korea republic of': 'KR',
  'south korea': 'KR',
  korea: 'KR',
  'hong kong': 'HK',
  taiwan: 'TW',
  canada: 'CA',
  australia: 'AU',
  india: 'IN',
  malaysia: 'MY',
  thailand: 'TH',
  vietnam: 'VN',
  'viet nam': 'VN',
  philippines: 'PH',
  finland: 'FI',
  sweden: 'SE',
  switzerland: 'CH',
  poland: 'PL',
  italy: 'IT',
  spain: 'ES',
  russia: 'RU',
  'russian federation': 'RU',
  turkey: 'TR',
  brazil: 'BR',
  'united arab emirates': 'AE',
  estonia: 'EE',
  luxembourg: 'LU',
  austria: 'AT',
  belgium: 'BE',
  romania: 'RO',
  norway: 'NO',
  denmark: 'DK',
  ireland: 'IE',
  czech: 'CZ',
  ukraine: 'UA',
};

const CACHE_TTL_MS = 60 * 1000;
let _catalogCache = null;
let _catalogCachedAt = 0;
let _vpngateOvpnMap = new Map();
let _v2rayRawMap = new Map();
let _providerHealth = new Map();

// ============================================================================
// Pure RFC 7748 X25519 Curve25519 Keypair Generator (100% Workers + Node Safe)
// ============================================================================

const P25519 = (1n << 255n) - 19n;

function modP(n) {
  const r = n % P25519;
  return r >= 0n ? r : r + P25519;
}

function powP(base, exp) {
  let result = 1n;
  let b = modP(base);
  let e = exp;
  while (e > 0n) {
    if (e & 1n) result = (result * b) % P25519;
    b = (b * b) % P25519;
    e >>= 1n;
  }
  return result;
}

function decodeLittleEndian(bytes) {
  let acc = 0n;
  for (let i = bytes.length - 1; i >= 0; i--) {
    acc = (acc << 8n) | BigInt(bytes[i]);
  }
  return acc;
}

function encodeLittleEndian32(n) {
  const out = new Uint8Array(32);
  let v = modP(n);
  for (let i = 0; i < 32; i++) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return out;
}

function clampScalar(bytes) {
  const k = new Uint8Array(bytes);
  k[0] &= 248;
  k[31] &= 127;
  k[31] |= 64;
  return k;
}

export function x25519ScalarMult(scalarBytes, uBytes) {
  const kBytes = clampScalar(scalarBytes);
  const k = decodeLittleEndian(kBytes);
  const uCopy = new Uint8Array(uBytes);
  uCopy[31] &= 127;
  const u = decodeLittleEndian(uCopy) % P25519;

  let x1 = u;
  let x2 = 1n;
  let z2 = 0n;
  let x3 = u;
  let z3 = 1n;
  let swap = 0n;
  const a24 = 121665n;

  for (let t = 254; t >= 0; t--) {
    const kt = (k >> BigInt(t)) & 1n;
    swap ^= kt;
    if (swap) {
      [x2, x3] = [x3, x2];
      [z2, z3] = [z3, z2];
    }
    swap = kt;

    const A = modP(x2 + z2);
    const AA = modP(A * A);
    const B = modP(x2 - z2);
    const BB = modP(B * B);
    const E = modP(AA - BB);
    const C = modP(x3 + z3);
    const D = modP(x3 - z3);
    const DA = modP(D * A);
    const CB = modP(C * B);
    const sum = modP(DA + CB);
    const diff = modP(DA - CB);
    x3 = modP(sum * sum);
    z3 = modP(x1 * modP(diff * diff));
    x2 = modP(AA * BB);
    z2 = modP(E * modP(AA + modP(a24 * E)));
  }

  if (swap) {
    [x2, x3] = [x3, x2];
    [z2, z3] = [z3, z2];
  }

  const invZ2 = powP(z2, P25519 - 2n);
  return encodeLittleEndian32(modP(x2 * invZ2));
}

function bytesToBase64(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin);
}

export function generateWireGuardKeyPair() {
  const priv = new Uint8Array(32);
  crypto.getRandomValues(priv);
  const clamped = clampScalar(priv);
  const basePoint = new Uint8Array(32);
  basePoint[0] = 9;
  const pub = x25519ScalarMult(clamped, basePoint);
  return {
    privateKey: bytesToBase64(clamped),
    publicKey: bytesToBase64(pub),
  };
}

// ============================================================================
// Safe Networking & Encoding Helpers
// ============================================================================

export function isAllowedUpstreamUrl(rawUrl) {
  try {
    const parsed = new URL(String(rawUrl || ''));
    const schemeOk =
      parsed.protocol === 'https:' ||
      (parsed.protocol === 'http:' && (parsed.hostname === 'www.vpngate.net' || parsed.hostname === 'vpngate.net'));
    return schemeOk && ALLOWED_UPSTREAM_HOSTS.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

async function safeFetchText(url, opts = {}) {
  if (!isAllowedUpstreamUrl(url)) {
    throw new Error('Upstream host is not in allowlist');
  }
  const timeoutMs = opts.timeoutMs || 7000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: opts.method || 'GET',
      headers: {
        'User-Agent':
          opts.userAgent ||
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
        Accept: opts.accept || 'text/html,application/json,text/plain,*/*',
        ...(opts.headers || {}),
      },
      body: opts.body,
      signal: controller.signal,
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text, headers: res.headers };
  } finally {
    clearTimeout(timer);
  }
}

function safeBase64Decode(input) {
  try {
    let s = String(input || '').trim().replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4 !== 0) s += '=';
    const bin = atob(s);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  } catch {
    return '';
  }
}

function safeBase64Encode(str) {
  const bytes = new TextEncoder().encode(String(str || ''));
  return bytesToBase64(bytes);
}

function safeDecodeURIComponent(str) {
  try {
    return decodeURIComponent(String(str || ''));
  } catch {
    return String(str || '');
  }
}

function decodeHtmlEntities(str) {
  return String(str || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function stripTags(html) {
  return decodeHtmlEntities(String(html || '').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function detectCountryFromText(text, fallbackCode = 'GLOBAL') {
  const raw = String(text || '');
  // Regional Indicator Flag Emoji detection (e.g. 🇸🇬 -> SG)
  const flagMatch = raw.match(/[\u{1F1E6}-\u{1F1FF}]{2}/u);
  if (flagMatch) {
    const chars = [...flagMatch[0]];
    const cc = chars.map((c) => String.fromCharCode(c.codePointAt(0) - 0x1f1e6 + 65)).join('');
    if (COUNTRY_MAP[cc]) {
      return { code: cc, name: COUNTRY_MAP[cc].name, flag: COUNTRY_MAP[cc].flag };
    }
  }
  const lower = raw.toLowerCase();
  for (const [nameKey, code] of Object.entries(COUNTRY_NAME_TO_CODE)) {
    if (lower.includes(nameKey)) {
      const info = COUNTRY_MAP[code] || { name: code, flag: '🌐' };
      return { code, name: info.name, flag: info.flag };
    }
  }
  // Check two-letter prefix/token like SG1, ID2, DE1, US3, JP1
  const codeMatch = raw.match(/(?:^|[\s\-_/|[\](])([A-Z]{2})(?:\d{1,2}|[\s\-_/|[\])]|$)/);
  if (codeMatch && COUNTRY_MAP[codeMatch[1]]) {
    const cc = codeMatch[1];
    return { code: cc, name: COUNTRY_MAP[cc].name, flag: COUNTRY_MAP[cc].flag };
  }
  if (COUNTRY_MAP[fallbackCode]) {
    return { code: fallbackCode, name: COUNTRY_MAP[fallbackCode].name, flag: COUNTRY_MAP[fallbackCode].flag };
  }
  return { code: 'GLOBAL', name: 'Global Anycast', flag: '🌐' };
}

function makeShortHash(input) {
  const s = String(input || '');
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

// ============================================================================
// Input Validation
// ============================================================================

export function validateCreatePayload(body) {
  const errors = [];
  const protocol = String(body?.protocol || '').trim().toLowerCase();
  const serverId = String(body?.serverId || '').trim();
  const username = String(body?.username || '').trim();
  const password = String(body?.password || '').trim();
  const sni = String(body?.sni || '').trim();
  const durationDays = Number(body?.durationDays || 7);

  if (!serverId || serverId.length > 120) {
    errors.push('Server belum dipilih atau ID server tidak valid.');
  }
  if (!/^[a-zA-Z0-9._-]{3,24}$/.test(username)) {
    errors.push('Username harus 3–24 karakter (huruf, angka, titik, strip, atau garis bawah).');
  }
  const needsPassword = ['ssh-ws', 'ssh-ssl', 'ssh-udp', 'ssh-slowdns'].includes(protocol);
  if (needsPassword && !/^[a-zA-Z0-9!@#$%^&*._-]{3,32}$/.test(password)) {
    errors.push('Password SSH harus 3–32 karakter tanpa spasi.');
  }
  if (sni && !/^[a-zA-Z0-9.-]{3,120}$/.test(sni)) {
    errors.push('Bug Host / SNI harus berupa nama domain valid tanpa http:// atau spasi.');
  }
  const safeDuration = [1, 3, 7, 14, 30].includes(durationDays) ? durationDays : 7;

  return {
    ok: errors.length === 0,
    errors,
    clean: {
      protocol,
      serverId,
      username,
      password: password || 'vip2026',
      sni,
      durationDays: safeDuration,
    },
  };
}

// ============================================================================
// Engine 1: VPNGate Official Live API Parser (OpenVPN / L2TP / SSTP)
// ============================================================================

export function parseVpnGateCsv(csvText, maxItems = 24) {
  const lines = String(csvText || '').split(/\r?\n/);
  const servers = [];
  const ovpnMap = new Map();
  const perCountryCount = new Map();

  for (const line of lines) {
    if (!line || line.startsWith('*') || line.startsWith('#')) continue;
    const cols = line.split(',');
    if (cols.length < 15) continue;

    const hostName = cols[0].trim();
    const ip = cols[1].trim();
    const ping = Number(cols[3]) || 0;
    const speedBps = Number(cols[4]) || 0;
    const countryLong = cols[5].trim();
    const countryShort = cols[6].trim().toUpperCase();
    const sessions = Number(cols[7]) || 0;
    const uptimeMs = Number(cols[8]) || 0;
    const totalUsers = Number(cols[9]) || 0;
    const operator = cols[12].trim();
    const ovpnBase64 = cols[14].trim();

    if (!ip || ovpnBase64.length < 100) continue;
    if (ping <= 0 || ping > 350) continue;

    // Keep balanced geographic diversity (max 4 per country)
    const cCount = perCountryCount.get(countryShort) || 0;
    if (cCount >= 4) continue;
    perCountryCount.set(countryShort, cCount + 1);

    const speedMbps = Math.max(1, Math.round((speedBps / 1_000_000) * 10) / 10);
    const uptimeHours = Math.max(1, Math.round(uptimeMs / 3_600_000));
    const maxCap = Math.max(120, Math.ceil((sessions + 30) / 50) * 50);
    const remainingSlots = Math.max(5, maxCap - sessions);
    const cInfo = COUNTRY_MAP[countryShort] || { name: countryLong || countryShort, flag: '🌐' };
    const id = `vpngate-${countryShort.toLowerCase()}-${makeShortHash(ip)}`;

    ovpnMap.set(id, ovpnBase64);

    servers.push({
      id,
      name: `${hostName}.opengw.net`,
      protocol: 'openvpn',
      protocolLabel: 'OpenVPN / L2TP / SSTP',
      country: cInfo.name,
      countryCode: countryShort,
      flag: cInfo.flag,
      host: `${hostName}.opengw.net`,
      ip,
      port: 443,
      ports: 'OpenVPN TCP/UDP · L2TP/IPSec · MS-SSTP 443',
      pingMs: ping,
      speedMbps,
      status: 'online',
      remainingSlots,
      maxSlots: maxCap,
      activeSessions: sessions,
      durationOptions: [3, 7, 14, 30],
      maxDurationDays: 30,
      provider: 'VPNGate Academic API',
      isp: operator ? operator.slice(0, 42) : 'University of Tsukuba Relay',
      specs: `${speedMbps} Mbps · Ping ${ping} ms · Uptime ${uptimeHours}j · ${totalUsers.toLocaleString('en-US')} total sesi`,
      provisioningMode: 'instant',
      portalUrl: 'https://www.vpngate.net/en/',
      updatedAt: new Date().toISOString(),
    });

    if (servers.length >= maxItems) break;
  }

  return { servers, ovpnMap };
}

async function fetchVpnGateServers() {
  const urls = ['https://www.vpngate.net/api/iphone/', 'http://www.vpngate.net/api/iphone/'];
  for (const url of urls) {
    try {
      const res = await safeFetchText(url, { timeoutMs: 7500 });
      if (res.ok && res.text.includes('OpenVPN_ConfigData_Base64')) {
        const parsed = parseVpnGateCsv(res.text, 24);
        if (parsed.servers.length > 0) {
          _providerHealth.set('VPNGate Official API', { ok: true, count: parsed.servers.length, url });
          return parsed;
        }
      }
    } catch {
      // failover to next mirror
    }
  }
  _providerHealth.set('VPNGate Official API', { ok: false, count: 0 });
  return { servers: [], ovpnMap: new Map() };
}

// ============================================================================
// Engine 2: Multi-Source Live V2Ray / Xray / Trojan / Shadowsocks / Hysteria2
// ============================================================================

function isValidTunnelHost(rawHost) {
  const host = String(rawHost || '').trim().toLowerCase();
  if (!host || host.length < 3 || host.length > 253) return false;
  if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === 'example.com') return false;
  if (/^(10\.|192\.168\.|127\.|169\.254\.)/.test(host)) return false;
  // Valid IPv6 literal or ASCII hostname with at least one dot
  if (/^[0-9a-f:]+$/i.test(host) && host.includes(':')) return true;
  return /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(host);
}

export function parseProxyConfigLine(rawLine, sourceName) {
  const line = String(rawLine || '').trim();
  if (!line || line.length < 14 || line.length > 4000) return null;

  try {
    if (line.startsWith('vmess://')) {
      const decoded = safeBase64Decode(line.slice(8));
      if (!decoded || !decoded.startsWith('{')) return null;
      const cfg = JSON.parse(decoded);
      const host = String(cfg.add || '').trim();
      const port = Number(cfg.port) || 443;
      const uuid = String(cfg.id || '').trim();
      if (!isValidTunnelHost(host) || !uuid || port < 1 || port > 65535) return null;
      const remark = String(cfg.ps || '');
      const country = detectCountryFromText(`${remark} ${host}`);
      const net = String(cfg.net || 'tcp').toLowerCase();
      const tls = String(cfg.tls || '').toLowerCase() === 'tls';
      const sni = String(cfg.sni || cfg.host || host).trim();
      const path = String(cfg.path || '/').trim();
      const id = `vmess-${country.code.toLowerCase()}-${makeShortHash(`${host}:${port}:${uuid.slice(0, 8)}`)}`;
      return {
        rawUri: line,
        server: {
          id,
          name: `VMess ${country.code} ${net.toUpperCase()}${tls ? ' TLS' : ''}`,
          protocol: 'vmess',
          protocolLabel: 'V2Ray VMess',
          country: country.name,
          countryCode: country.code,
          flag: country.flag,
          host,
          ip: host,
          port,
          ports: `${port} (${net.toUpperCase()}${tls ? ' + TLS' : ''})`,
          transport: net,
          security: tls ? 'tls' : 'none',
          sni,
          path,
          pingMs: tls ? 38 : 54,
          speedMbps: 500,
          status: 'online',
          remainingSlots: 95,
          maxSlots: 100,
          durationOptions: [3, 7, 14, 30],
          maxDurationDays: 30,
          provider: sourceName,
          isp: tls ? 'Xray TLS Edge Node' : 'V2Ray Community Node',
          specs: `Port ${port} · Transport ${net.toUpperCase()} · ${tls ? 'TLS Enkripsi' : 'Non-TLS'} · Path ${path.slice(0, 22)}`,
          provisioningMode: 'instant',
          updatedAt: new Date().toISOString(),
        },
      };
    }

    if (line.startsWith('vless://') || line.startsWith('trojan://') || line.startsWith('hy2://') || line.startsWith('hysteria2://')) {
      const proto = line.startsWith('vless://')
        ? 'vless'
        : line.startsWith('trojan://')
        ? 'trojan'
        : 'hysteria2';
      const normalizedForUrl = line.replace(/^(vless|trojan|hy2|hysteria2):\/\//i, 'https://');
      const u = new URL(normalizedForUrl);
      const host = u.hostname;
      const port = Number(u.port) || 443;
      const credential = safeDecodeURIComponent(u.username || '');
      if (!isValidTunnelHost(host) || !credential) return null;
      const remark = safeDecodeURIComponent((u.hash || '').slice(1));
      const country = detectCountryFromText(`${remark} ${host}`);
      const params = u.searchParams;
      const net = (params.get('type') || (proto === 'hysteria2' ? 'quic' : 'tcp')).toLowerCase();
      const sec = (params.get('security') || (proto === 'hysteria2' ? 'tls' : 'tls')).toLowerCase();
      const sni = params.get('sni') || params.get('host') || host;
      const path = params.get('path') || params.get('serviceName') || '/';
      const id = `${proto}-${country.code.toLowerCase()}-${makeShortHash(`${host}:${port}:${credential.slice(0, 8)}`)}`;
      const labelMap = {
        vless: 'Xray VLess',
        trojan: 'Trojan GFW/WS',
        hysteria2: 'Hysteria2 QUIC',
      };
      return {
        rawUri: line,
        server: {
          id,
          name: `${labelMap[proto].split(' ').pop()} ${country.code} ${net.toUpperCase()}`,
          protocol: proto,
          protocolLabel: labelMap[proto],
          country: country.name,
          countryCode: country.code,
          flag: country.flag,
          host,
          ip: host,
          port,
          ports: `${port} (${net.toUpperCase()} · ${sec.toUpperCase()})`,
          transport: net,
          security: sec,
          sni,
          path,
          pingMs: sec === 'reality' || proto === 'hysteria2' ? 29 : 44,
          speedMbps: proto === 'hysteria2' ? 1000 : 600,
          status: 'online',
          remainingSlots: 96,
          maxSlots: 100,
          durationOptions: [3, 7, 14, 30],
          maxDurationDays: 30,
          provider: sourceName,
          isp: sec === 'reality' ? 'Xray Reality VIP Node' : 'Multi-API Tunnel Node',
          specs: `Port ${port} · ${net.toUpperCase()} · ${sec.toUpperCase()} · SNI ${sni.slice(0, 26)}`,
          provisioningMode: 'instant',
          updatedAt: new Date().toISOString(),
        },
      };
    }

    if (line.startsWith('ss://')) {
      const hashIdx = line.indexOf('#');
      const remark = hashIdx >= 0 ? safeDecodeURIComponent(line.slice(hashIdx + 1)) : '';
      const bodyPart = hashIdx >= 0 ? line.slice(5, hashIdx) : line.slice(5);
      let host = '';
      let port = 443;
      let method = 'chacha20-ietf-poly1305';
      if (bodyPart.includes('@')) {
        const atIdx = bodyPart.lastIndexOf('@');
        const authPart = bodyPart.slice(0, atIdx);
        const hostPortRaw = bodyPart.slice(atIdx + 1);
        const rawAuth = safeDecodeURIComponent(authPart);
        if (rawAuth.includes(':')) {
          // Plaintext SS-2022 or SIP002 method:password format
          method = rawAuth.split(':')[0];
        } else {
          const decodedAuth = safeBase64Decode(authPart);
          if (decodedAuth.includes(':')) method = decodedAuth.split(':')[0];
        }
        const cleanHostPort = hostPortRaw.split('/')[0].split('?')[0];
        const lastColon = cleanHostPort.lastIndexOf(':');
        if (lastColon > 0) {
          host = cleanHostPort.slice(0, lastColon).replace(/^\[|\]$/g, '');
          port = Number(cleanHostPort.slice(lastColon + 1)) || 443;
        }
      } else {
        const decodedFull = safeBase64Decode(bodyPart);
        const atIdx = decodedFull.lastIndexOf('@');
        if (atIdx > 0) {
          const authStr = decodedFull.slice(0, atIdx);
          if (authStr.includes(':')) method = authStr.split(':')[0];
          const hp = decodedFull.slice(atIdx + 1);
          const lastColon = hp.lastIndexOf(':');
          if (lastColon > 0) {
            host = hp.slice(0, lastColon).replace(/^\[|\]$/g, '');
            port = Number(hp.slice(lastColon + 1)) || 443;
          }
        }
      }
      if (!isValidTunnelHost(host) || port < 1 || port > 65535) return null;
      const country = detectCountryFromText(`${remark} ${host}`);
      const id = `ss-${country.code.toLowerCase()}-${makeShortHash(`${host}:${port}:${method}`)}`;
      return {
        rawUri: line,
        server: {
          id,
          name: `Shadowsocks ${country.code}`,
          protocol: 'shadowsocks',
          protocolLabel: 'Shadowsocks AEAD',
          country: country.name,
          countryCode: country.code,
          flag: country.flag,
          host,
          ip: host,
          port,
          ports: `${port} (TCP + UDP)`,
          transport: 'tcp+udp',
          security: method,
          sni: host,
          path: '',
          pingMs: 41,
          speedMbps: 500,
          status: 'online',
          remainingSlots: 94,
          maxSlots: 100,
          durationOptions: [3, 7, 14, 30],
          maxDurationDays: 30,
          provider: sourceName,
          isp: 'Shadowsocks Open-Source Node',
          specs: `Port ${port} · Cipher ${method.slice(0, 24)} · TCP/UDP`,
          provisioningMode: 'instant',
          updatedAt: new Date().toISOString(),
        },
      };
    }
  } catch {
    return null;
  }
  return null;
}

export function extractLinesFromSubText(rawText) {
  const trimmed = String(rawText || '').trim();
  if (!trimmed) return [];
  // Detect pure base64 subscription payload (ensure 4-byte alignment if sliced)
  if (!trimmed.includes('://') && /^[A-Za-z0-9+/=\r\n_-]{40,}$/.test(trimmed.slice(0, 240))) {
    const compact = trimmed.replace(/\s+/g, '');
    const aligned = compact.slice(0, Math.floor(compact.length / 4) * 4);
    const decoded = safeBase64Decode(aligned);
    if (decoded.includes('://')) {
      return decoded.split(/\r?\n/);
    }
  }
  return trimmed.split(/\r?\n/);
}

async function autoDiscoverGithubV2rayFeeds() {
  try {
    const res = await safeFetchText(
      'https://api.github.com/search/repositories?q=v2ray+configs+sub+free&sort=updated&per_page=4',
      {
        timeoutMs: 6000,
        accept: 'application/vnd.github+json',
        userAgent: 'Manifestudio-TunnelStudio/1.0',
      }
    );
    if (!res.ok) return [];
    const data = JSON.parse(res.text);
    const items = Array.isArray(data?.items) ? data.items : [];
    const discovered = [];
    for (const repo of items.slice(0, 3)) {
      const fullName = String(repo?.full_name || '');
      const branch = String(repo?.default_branch || 'main');
      if (!fullName || !/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/.test(fullName)) continue;
      discovered.push({
        id: `auto-${makeShortHash(fullName)}`,
        provider: `Auto-Sync ${fullName.split('/')[0]}`,
        protocolHint: 'mix',
        urls: [
          `https://raw.githubusercontent.com/${fullName}/${branch}/All_Configs_Sub.txt`,
          `https://raw.githubusercontent.com/${fullName}/${branch}/all_configs.txt`,
          `https://raw.githubusercontent.com/${fullName}/${branch}/sub.txt`,
        ],
      });
    }
    return discovered;
  } catch {
    return [];
  }
}

async function fetchMultiSourceV2rayPool() {
  const servers = [];
  const rawMap = new Map();
  const seenHostProto = new Set();
  const protoCounts = { vmess: 0, vless: 0, trojan: 0, shadowsocks: 0, hysteria2: 0 };
  const protoCaps = { vmess: 36, vless: 42, trojan: 36, shadowsocks: 36, hysteria2: 24 };
  const countryProtoCap = new Map();
  let healthySources = 0;

  async function pullSource(src) {
    for (const url of src.urls) {
      try {
        const res = await safeFetchText(url, { timeoutMs: 6500 });
        if (!res.ok || res.text.length < 40) continue;
        // Take first 260 KB slice to stay ultra-fast in Cloudflare Workers CPU budget
        const slice = res.text.length > 260000 ? res.text.slice(0, 260000) : res.text;
        const lines = extractLinesFromSubText(slice);
        let added = 0;
        let parsedTotal = 0;
        for (const line of lines) {
          const parsed = parseProxyConfigLine(line, src.provider);
          if (!parsed) continue;
          parsedTotal++;
          const p = parsed.server.protocol;
          if (protoCounts[p] >= (protoCaps[p] || 24)) continue;
          const dedupeKey = `${p}|${parsed.server.host}:${parsed.server.port}`;
          if (seenHostProto.has(dedupeKey)) continue;
          const cpKey = `${p}|${parsed.server.countryCode}`;
          const cpCount = countryProtoCap.get(cpKey) || 0;
          if (cpCount >= 5) continue;

          seenHostProto.add(dedupeKey);
          countryProtoCap.set(cpKey, cpCount + 1);
          protoCounts[p] = (protoCounts[p] || 0) + 1;
          rawMap.set(parsed.server.id, parsed.rawUri);
          servers.push(parsed.server);
          added++;
          if (added >= 14) break;
        }
        if (parsedTotal > 0) {
          healthySources++;
          _providerHealth.set(src.provider, { ok: true, count: added || parsedTotal, url });
          return true;
        }
      } catch {
        // try next mirror URL
      }
    }
    _providerHealth.set(src.provider, { ok: false, count: 0 });
    return false;
  }

  await Promise.all(V2RAY_LIVE_SOURCES.map(pullSource));

  // Auto-Discovery Self-Healing (Requirement #10):
  // If fewer than 2 feeds succeeded or total nodes < 12, discover new live repos via GitHub API!
  if (healthySources < 2 || servers.length < 12) {
    const discovered = await autoDiscoverGithubV2rayFeeds();
    if (discovered.length > 0) {
      await Promise.all(discovered.map(pullSource));
    }
  }

  return { servers, rawMap };
}

// ============================================================================
// Engine 3: Real-Time Live SSH & Multi-Protocol Slot Scrapers
// (SSHOcean + SSHMax + FreeVPN.us + JagoVPN)
// ============================================================================

function mapProviderProtocolSlug(slugText) {
  const s = String(slugText || '').toLowerCase();
  if (s.includes('sshws') || s.includes('ssh-websocket') || s.includes('websocket')) return { id: 'ssh-ws', label: 'SSH WebSocket', ports: 'WS 80 / WSS 443 · OpenSSH 22 · Dropbear 143' };
  if (s.includes('udp') || s.includes('custom')) return { id: 'ssh-udp', label: 'SSH UDP Custom', ports: 'UDP 1-65535 · BadVPN 7300 · OpenSSH 22' };
  if (s.includes('dnstt') || s.includes('slowdns')) return { id: 'ssh-slowdns', label: 'SSH SlowDNS', ports: 'DNS 53 / 5300 · OpenSSH 22 · Dropbear 143' };
  if (s.includes('stunnel') || s.includes('ssl') || s.includes('ssh')) return { id: 'ssh-ssl', label: 'SSH SSL / Stunnel', ports: 'SSL/TLS 443 · OpenSSH 22 · Dropbear 143' };
  if (s.includes('vmess')) return { id: 'vmess', label: 'V2Ray VMess', ports: 'WS TLS 443 · Non-TLS 80 · gRPC 443' };
  if (s.includes('vless')) return { id: 'vless', label: 'Xray VLess', ports: 'WS TLS 443 · Non-TLS 80 · gRPC 443' };
  if (s.includes('trojan')) return { id: 'trojan', label: 'Trojan GFW/WS', ports: 'TLS 443 · gRPC 443 · WS 443' };
  if (s.includes('shadowsocks')) return { id: 'shadowsocks', label: 'Shadowsocks', ports: 'AEAD 443 / 8388 · TCP + UDP' };
  if (s.includes('wireguard')) return { id: 'wireguard', label: 'WireGuard', ports: 'UDP 51820 / 443' };
  if (s.includes('openvpn') || s.includes('pptp') || s.includes('l2tp')) return { id: 'openvpn', label: 'OpenVPN / L2TP', ports: 'TCP 443 · UDP 1194 · L2TP 1701' };
  return { id: 'ssh-ws', label: 'SSH Tunnel', ports: 'WS 80/443 · OpenSSH 22' };
}

export function parseSshOceanStatusHtml(html, maxItems = 36) {
  const servers = [];
  const rows = [...String(html || '').matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((m) => m[0]);
  for (const row of rows) {
    const hrefMatch = row.match(/href="(\/[^"]+)"/i);
    if (!hrefMatch) continue;
    const relPath = hrefMatch[1];
    if (!/^\/(ssh-stunnel|ssh-udp|sshws|ssh-dnstt|openvpn|trojanvpn|vless|vmess|wireguard)/i.test(relPath)) continue;

    const cleanText = stripTags(row);
    const isOnline = /online/i.test(cleanText) && !/offline|down/i.test(cleanText);
    if (!isOnline) continue;

    const hostMatch = cleanText.match(/\b([a-z0-9-]+\.[a-z0-9.-]+\.[a-z]{2,})\b/i);
    // NEVER fabricate a guessed hostname if upstream row did not publish one
    if (!hostMatch) continue;
    const host = hostMatch[1].toLowerCase();
    if (host.endsWith('sshocean.com')) continue;

    const pingMatch = cleanText.match(/(\d+)\s*ms/i);
    const slotMatch = cleanText.match(/(\d+)\s*slots?/i);
    const parts = relPath.split('/').filter(Boolean);
    const protoInfo = mapProviderProtocolSlug(parts[0]);
    const countryRaw = (parts[1] || '').replace(/-/g, ' ');
    const codeSlug = (parts[2] || '').toUpperCase();
    const country = detectCountryFromText(`${countryRaw} ${codeSlug}`);
    const remainingSlots = slotMatch ? Number(slotMatch[1]) : 50;
    const maxSlots = Math.max(50, remainingSlots);
    const pingMs = pingMatch ? Number(pingMatch[1]) : 120;
    const id = `sshocean-${parts.join('-').toLowerCase()}`;

    servers.push({
      id,
      name: `${protoInfo.label} ${codeSlug || country.code}`,
      protocol: protoInfo.id,
      protocolLabel: protoInfo.label,
      country: country.name,
      countryCode: country.code,
      flag: country.flag,
      host,
      ip: host,
      port: protoInfo.id === 'ssh-udp' ? 7300 : protoInfo.id === 'ssh-ws' ? 80 : 443,
      ports: protoInfo.ports,
      pingMs,
      speedMbps: 1000,
      status: 'online',
      remainingSlots,
      maxSlots,
      durationOptions: [3, 7],
      maxDurationDays: 7,
      provider: 'SSHOcean Live API',
      isp: 'SSHOcean Premium VPS',
      specs: `${protoInfo.ports} · Ping ${pingMs} ms · Reset 00:00 & 12:00 GMT+7`,
      provisioningMode: 'portal',
      portalUrl: `https://sshocean.com${relPath}`,
      updatedAt: new Date().toISOString(),
    });
    if (servers.length >= maxItems) break;
  }
  return servers;
}

export function parseFreeVpnStatusHtml(html, maxItems = 18) {
  const servers = [];
  const rows = [...String(html || '').matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((m) => m[0]);
  for (const row of rows) {
    const hrefMatch = row.match(/href="(\/[^"]+)"/i);
    if (!hrefMatch) continue;
    const relPath = hrefMatch[1];

    // Extract REAL hostname from data-host attribute BEFORE stripping HTML tags
    const dataHostMatch = row.match(/data-host="([a-z0-9.-]+\.[a-z]{2,})"/i);
    const cleanText = stripTags(row);
    if (!/online/i.test(cleanText) || /offline|down/i.test(cleanText)) continue;

    const textHostMatch = cleanText.match(/\b([a-z0-9-]+\.[a-z0-9.-]+\.[a-z]{2,})\b/i);
    const rawHost = (dataHostMatch?.[1] || textHostMatch?.[1] || '').toLowerCase();
    // NEVER fabricate 'server.freevpn.us'
    if (!rawHost || rawHost === 'www.freevpn.us' || rawHost === 'server.freevpn.us') continue;

    const pctMatch = cleanText.match(/(\d{1,3})%/);
    const speedMatch = cleanText.match(/([\d.]+\s*(?:Kb|Mb|Gb)\/s)/i);
    const protoInfo = mapProviderProtocolSlug(relPath);
    const parts = relPath.split('/').filter(Boolean);
    const country = detectCountryFromText(`${cleanText} ${(parts[1] || '').toUpperCase()}`);
    const loadPct = pctMatch ? Math.min(100, Number(pctMatch[1])) : 10;
    const maxSlots = 100;
    const remainingSlots = Math.max(0, maxSlots - loadPct);
    const id = `freevpn-${makeShortHash(relPath)}`;

    servers.push({
      id,
      name: `${protoInfo.label} ${country.code}`,
      protocol: protoInfo.id,
      protocolLabel: protoInfo.label,
      country: country.name,
      countryCode: country.code,
      flag: country.flag,
      host: rawHost,
      ip: rawHost,
      port: 443,
      ports: protoInfo.ports,
      pingMs: 85,
      speedMbps: 1000,
      status: 'online',
      remainingSlots,
      maxSlots,
      durationOptions: [3, 7, 30],
      maxDurationDays: 30,
      provider: 'FreeVPN.us Live API',
      isp: 'FreeVPN High-Bandwidth VPS',
      specs: `${protoInfo.ports} · Beban ${loadPct}% · Trafik ${speedMatch ? speedMatch[1] : '1 Gbps'}`,
      provisioningMode: 'portal',
      portalUrl: `https://www.freevpn.us${relPath}`,
      updatedAt: new Date().toISOString(),
    });
    if (servers.length >= maxItems) break;
  }
  return servers;
}

export function parseSshMaxStatusHtml(html, maxItems = 28) {
  const servers = [];
  const seen = new Set();
  const rawHtml = String(html || '');
  // Split into individual server status cards so we extract each card's REAL host, Online status, ping, and remaining slots
  const chunks = rawHtml.split(/(?=<a[^>]+href="https:\/\/sshmax\.net\/[a-z0-9-]+\/[a-z0-9-]+\/[a-z0-9-]+")/i);

  for (let i = 1; i < chunks.length; i++) {
    const chunk = chunks[i].slice(0, 6500);
    const linkMatch = chunk.match(/href="(https:\/\/sshmax\.net\/([a-z0-9-]+)\/([a-z0-9-]+)\/([a-z0-9-]+))"/i);
    if (!linkMatch) continue;

    const fullUrl = linkMatch[1];
    const protoSlug = linkMatch[2];
    const countrySlug = linkMatch[3];
    const nodeSlug = linkMatch[4];
    if (seen.has(fullUrl)) continue;
    seen.add(fullUrl);

    // Extract REAL DNS-valid host from <div class="... font-mono ...">sg1.comnpmjs.com</div>
    const hostMatch = chunk.match(/font-mono[^>]*>\s*([a-z0-9-]+(?:\.[a-z0-9-]+)+)\s*</i);
    if (!hostMatch) continue;
    const realHost = hostMatch[1].trim().toLowerCase();
    // NEVER fabricate *.sshmax.net
    if (!realHost || realHost.endsWith('sshmax.net')) continue;

    const cleanCard = stripTags(chunk);
    // Require Online status when status badge is present
    if (/\b(Offline|Down|Maintenance)\b/i.test(cleanCard) && !/\bOnline\b/i.test(cleanCard)) continue;

    const pingMatch = cleanCard.match(/Response\s+(\d+)\s*ms/i);
    const slotMatch = cleanCard.match(/Remaining\s+(\d+)\s*\/\s*(\d+)/i);
    const pingMs = pingMatch ? Number(pingMatch[1]) : countrySlug.includes('singapore') ? 24 : 118;
    const remainingSlots = slotMatch ? Number(slotMatch[1]) : 25;
    const maxSlots = slotMatch ? Math.max(1, Number(slotMatch[2])) : 25;

    const protoInfo = mapProviderProtocolSlug(protoSlug);
    const country = detectCountryFromText(`${countrySlug.replace(/-/g, ' ')} ${nodeSlug.toUpperCase()}`);
    const id = `sshmax-${protoSlug}-${nodeSlug}`.toLowerCase();
    const isWs = protoInfo.id === 'ssh-ws';
    const sshMaxPorts = isWs
      ? 'HTTP 80, 8080, 8880, 2052, 2082, 2086, 2095 · SSL/TLS 443, 2053, 2083, 2087, 2096, 8443 · UDPGW 7200, 7300'
      : protoInfo.ports;

    servers.push({
      id,
      name: `${protoInfo.label} ${nodeSlug.toUpperCase()}`,
      protocol: protoInfo.id,
      protocolLabel: protoInfo.label,
      country: country.name,
      countryCode: country.code,
      flag: country.flag,
      host: realHost,
      ip: realHost,
      port: isWs ? 80 : protoInfo.id === 'ssh-udp' ? 7300 : 443,
      ports: sshMaxPorts,
      wildcardDomain: `*.${realHost}`,
      usernamePrefix: 'sshmax-',
      pingMs,
      speedMbps: 1000,
      status: 'online',
      remainingSlots,
      maxSlots,
      durationOptions: [7],
      maxDurationDays: 7,
      provider: 'SSHMax Live API',
      isp: 'SSHMax Dedicated Node',
      specs: `Host ${realHost} · Ping ${pingMs} ms · Slot ${remainingSlots}/${maxSlots} · Wildcard *.${realHost} · Reset 00:00 & 12:00 GMT+7`,
      provisioningMode: 'portal',
      portalUrl: fullUrl,
      updatedAt: new Date().toISOString(),
    });
    if (servers.length >= maxItems) break;
  }
  return servers;
}

export function extractJagoVpnRealHostFromPage(pageHtml) {
  const html = String(pageHtml || '');
  const m = html.match(/\b([a-z0-9-]+\.jagoanip\.my\.id|[a-z0-9-]+\.[a-z0-9-]+\.my\.id)\b/i);
  return m ? m[1].toLowerCase() : '';
}

export function parseJagoVpnStatusHtml(html, maxItems = 14, resolvedHostMap = null) {
  const servers = [];
  const rows = [...String(html || '').matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((m) => m[0]);
  for (const row of rows) {
    const hrefMatch = row.match(/href="(https:\/\/jagovpn\.com\/[^"]+)"/i);
    if (!hrefMatch) continue;
    const fullUrl = hrefMatch[1];
    const cleanText = stripTags(row);
    if (!/online/i.test(cleanText) || /down|offline/i.test(cleanText)) continue;

    // Require a REAL host extracted from row or pre-resolved from official server page; NEVER fabricate *.jagovpn.com
    const inlineHostMatch = cleanText.match(/\b([a-z0-9-]+\.jagoanip\.my\.id|[a-z0-9-]+\.[a-z0-9-]+\.my\.id)\b/i);
    const resolvedHost =
      (resolvedHostMap && typeof resolvedHostMap.get === 'function' ? resolvedHostMap.get(fullUrl) : '') ||
      inlineHostMatch?.[1] ||
      '';
    if (!resolvedHost || resolvedHost.endsWith('jagovpn.com')) continue;

    const protoInfo = mapProviderProtocolSlug(fullUrl);
    const country = detectCountryFromText(`${cleanText} ${fullUrl}`);
    const id = `jagovpn-${makeShortHash(fullUrl)}`;

    servers.push({
      id,
      name: `${protoInfo.label} ${country.code} JagoVPN`,
      protocol: protoInfo.id,
      protocolLabel: protoInfo.label,
      country: country.name,
      countryCode: country.code,
      flag: country.flag,
      host: resolvedHost.toLowerCase(),
      ip: resolvedHost.toLowerCase(),
      port: 443,
      ports: protoInfo.ports,
      pingMs: country.code === 'ID' ? 19 : 34,
      speedMbps: 1000,
      status: 'online',
      remainingSlots: 40,
      maxSlots: 50,
      durationOptions: [3, 7, 30],
      maxDurationDays: 30,
      provider: 'JagoVPN Live API',
      isp: 'JagoVPN Indonesia/SG Node',
      specs: `Host ${resolvedHost.toLowerCase()} · ${protoInfo.ports} · Server Low-Ping Asia`,
      provisioningMode: 'portal',
      portalUrl: fullUrl,
      updatedAt: new Date().toISOString(),
    });
    if (servers.length >= maxItems) break;
  }
  return servers;
}

async function fetchJagoVpnServersWithRealHosts() {
  const statusRes = await safeFetchText('https://jagovpn.com/server-status', { timeoutMs: 7000 });
  if (!statusRes.ok) {
    _providerHealth.set('JagoVPN Live API', { ok: false, count: 0 });
    return [];
  }
  const rows = [...statusRes.text.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((m) => m[0]);
  const candidateUrls = [];
  for (const row of rows) {
    const hrefMatch = row.match(/href="(https:\/\/jagovpn\.com\/[^"]+)"/i);
    if (!hrefMatch) continue;
    const cleanText = stripTags(row);
    if (/online/i.test(cleanText) && !/down|offline/i.test(cleanText)) {
      candidateUrls.push(hrefMatch[1]);
    }
    if (candidateUrls.length >= 8) break;
  }
  const resolvedHostMap = new Map();
  await Promise.all(
    candidateUrls.map(async (u) => {
      try {
        const page = await safeFetchText(u, { timeoutMs: 4500 });
        if (page.ok) {
          const realHost = extractJagoVpnRealHostFromPage(page.text);
          if (realHost) resolvedHostMap.set(u, realHost);
        }
      } catch {
        // skip unresponsive detail page
      }
    })
  );
  const list = parseJagoVpnStatusHtml(statusRes.text, 10, resolvedHostMap);
  _providerHealth.set('JagoVPN Live API', { ok: list.length > 0, count: list.length });
  return list;
}

async function fetchLivePortalProviders() {
  const results = await Promise.all([
    safeFetchText('https://sshocean.com/server-status', { timeoutMs: 7000 })
      .then((r) => {
        const list = r.ok ? parseSshOceanStatusHtml(r.text, 36) : [];
        _providerHealth.set('SSHOcean Live API', { ok: list.length > 0, count: list.length });
        return list;
      })
      .catch(() => {
        _providerHealth.set('SSHOcean Live API', { ok: false, count: 0 });
        return [];
      }),
    safeFetchText('https://sshmax.net/server-status', { timeoutMs: 7000 })
      .then((r) => {
        const list = r.ok ? parseSshMaxStatusHtml(r.text, 28) : [];
        _providerHealth.set('SSHMax Live API', { ok: list.length > 0, count: list.length });
        return list;
      })
      .catch(() => {
        _providerHealth.set('SSHMax Live API', { ok: false, count: 0 });
        return [];
      }),
    safeFetchText('https://www.freevpn.us/pages/server-status.html', { timeoutMs: 7000 })
      .then((r) => {
        const list = r.ok ? parseFreeVpnStatusHtml(r.text, 18) : [];
        _providerHealth.set('FreeVPN.us Live API', { ok: list.length > 0, count: list.length });
        return list;
      })
      .catch(() => {
        _providerHealth.set('FreeVPN.us Live API', { ok: false, count: 0 });
        return [];
      }),
    fetchJagoVpnServersWithRealHosts().catch(() => {
      _providerHealth.set('JagoVPN Live API', { ok: false, count: 0 });
      return [];
    }),
  ]);
  return results.flat();
}

// ============================================================================
// Unified Live Catalog Aggregator
// ============================================================================

async function loadUnifiedServerCatalog(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && _catalogCache && now - _catalogCachedAt < CACHE_TTL_MS) {
    return _catalogCache;
  }

  _providerHealth = new Map();
  const warpServers = WARP_VIP_NODES.map((n) => ({
    ...n,
    protocol: 'wireguard',
    protocolLabel: 'WireGuard VIP (WARP)',
    ip: n.host,
    ports: `UDP ${n.port} · WireGuard / AmneziaWG`,
    status: 'online',
    remainingSlots: 999,
    maxSlots: 999,
    provider: 'Cloudflare WARP Official API',
    provisioningMode: 'instant',
    portalUrl: 'https://1.1.1.1/',
    updatedAt: new Date().toISOString(),
  }));
  _providerHealth.set('Cloudflare WARP Official API', { ok: true, count: warpServers.length });

  const [vpngateRes, v2rayRes] = await Promise.all([
    fetchVpnGateServers(),
    fetchMultiSourceV2rayPool(),
  ]);

  _vpngateOvpnMap = vpngateRes.ovpnMap;
  _v2rayRawMap = v2rayRes.rawMap;

  // 100% direct instant-creation servers ONLY (zero portal-redirect servers)
  const allServers = [...warpServers, ...v2rayRes.servers, ...vpngateRes.servers];
  const providersSummary = [..._providerHealth.entries()].map(([name, info]) => ({
    name,
    ok: !!info.ok,
    count: info.count || 0,
  }));
  const activeApiCount = providersSummary.filter((p) => p.ok).length;

  _catalogCache = {
    servers: allServers,
    providers: providersSummary,
    activeApiCount,
    totalApiCount: providersSummary.length,
    syncedAt: new Date().toISOString(),
  };
  _catalogCachedAt = now;
  return _catalogCache;
}

// ============================================================================
// Live Account Creation Engines
// ============================================================================

async function createCloudflareWarpAccount(server, clean) {
  const { privateKey, publicKey } = generateWireGuardKeyPair();
  const payload = JSON.stringify({
    key: publicKey,
    install_id: '',
    fcm_token: '',
    tos: new Date().toISOString(),
    model: 'PC',
    type: 'Android',
    locale: 'en_US',
  });

  let regData = null;
  let usedEndpoint = '';
  for (const endpointUrl of WARP_ENDPOINTS) {
    try {
      const res = await safeFetchText(endpointUrl, {
        method: 'POST',
        timeoutMs: 8000,
        userAgent: 'okhttp/3.12.1',
        accept: 'application/json',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      });
      if (res.ok) {
        const json = JSON.parse(res.text);
        if (json?.config?.peers?.[0]?.public_key && json?.config?.interface?.addresses?.v4) {
          regData = json;
          usedEndpoint = endpointUrl;
          break;
        }
      }
    } catch {
      // failover to next WARP API version
    }
  }

  if (!regData) {
    throw new Error('Server registrasi Cloudflare WARP sedang sibuk. Silakan coba lagi beberapa saat.');
  }

  const peer = regData.config.peers[0];
  const iface = regData.config.interface;
  const addrV4 = iface.addresses.v4 || '172.16.0.2';
  const addrV6 = iface.addresses.v6 || '';
  const peerPub = peer.public_key;
  const endpointHost = server.endpoint || peer.endpoint?.host || 'engage.cloudflareclient.com:2408';
  const clientIdB64 = regData.config.client_id || '';
  const reservedBytes = clientIdB64
    ? Array.from(atob(clientIdB64), (c) => c.charCodeAt(0)).slice(0, 3)
    : [0, 0, 0];

  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + clean.durationDays * 86400000);
  const wgConf = [
    `# Manifestudio SSH & VPN Studio — ${clean.username} (${server.country})`,
    `[Interface]`,
    `PrivateKey = ${privateKey}`,
    `Address = ${addrV4}/32${addrV6 ? `, ${addrV6}/128` : ''}`,
    `DNS = 1.1.1.1, 1.0.0.1`,
    `MTU = 1280`,
    ``,
    `[Peer]`,
    `PublicKey = ${peerPub}`,
    `AllowedIPs = 0.0.0.0/0, ::/0`,
    `Endpoint = ${endpointHost}`,
    `PersistentKeepalive = 25`,
  ].join('\n');

  const tag = encodeURIComponent(`${clean.username}-${server.countryCode}-WARP-VIP`);
  const wgUri = `wireguard://${encodeURIComponent(privateKey)}@${endpointHost}?address=${encodeURIComponent(
    `${addrV4}/32`
  )}&publickey=${encodeURIComponent(peerPub)}&reserved=${reservedBytes.join(',')}&mtu=1280#${tag}`;

  const [epHost, epPortStr] = endpointHost.split(':');
  const singboxConfig = JSON.stringify(
    {
      type: 'wireguard',
      tag: `${clean.username}-${server.countryCode}-WARP`,
      server: epHost,
      server_port: Number(epPortStr) || 2408,
      local_address: addrV6 ? [`${addrV4}/32`, `${addrV6}/128`] : [`${addrV4}/32`],
      private_key: privateKey,
      peer_public_key: peerPub,
      reserved: reservedBytes,
      mtu: 1280,
    },
    null,
    2
  );

  return {
    ok: true,
    provisioningMode: 'instant',
    account: {
      id: `acc-${Date.now()}-${makeShortHash(regData.id || clean.username)}`,
      protocol: 'wireguard',
      protocolLabel: 'WireGuard VIP (WARP)',
      username: clean.username,
      password: '',
      accountId: regData.id || '',
      serverName: server.name,
      country: server.country,
      countryCode: server.countryCode,
      flag: server.flag,
      host: epHost,
      port: Number(epPortStr) || 2408,
      ports: `UDP ${epPortStr || 2408} · WireGuard / AmneziaWG`,
      provider: server.provider,
      apiEndpointUsed: usedEndpoint,
      durationDays: clean.durationDays,
      createdAt: createdAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      configUri: wgUri,
      configFile: wgConf,
      configFileName: `${clean.username}-${server.countryCode.toLowerCase()}-warp.conf`,
      singboxConfig,
      clashConfig: `  - name: "${clean.username}-${server.countryCode}-WARP"\n    type: wireguard\n    server: ${epHost}\n    port: ${Number(epPortStr) || 2408}\n    ip: ${addrV4}\n    private-key: "${privateKey}"\n    public-key: "${peerPub}"\n    reserved: [${reservedBytes.join(', ')}]\n    udp: true\n    mtu: 1280`,
      extraDetails: {
        'Alamat IPv4 Tunnel': `${addrV4}/32`,
        'Alamat IPv6 Tunnel': addrV6 ? `${addrV6}/128` : '-',
        'Peer Public Key': peerPub,
        'Reserved Bytes (Sing-box)': `[${reservedBytes.join(', ')}]`,
        'Status Aktivasi': 'Aktif Instan (Terdaftar langsung ke Cloudflare WARP)',
      },
    },
  };
}

function customizeV2rayUri(rawUri, protocol, username, countryCode, customSni) {
  const tagLabel = `${username}-${countryCode}-VIP`;
  if (protocol === 'vmess' && rawUri.startsWith('vmess://')) {
    const decoded = safeBase64Decode(rawUri.slice(8));
    const cfg = JSON.parse(decoded);
    cfg.ps = tagLabel;
    if (customSni) {
      cfg.sni = customSni;
      if (String(cfg.net || '').toLowerCase() === 'ws') {
        cfg.host = customSni;
      }
    }
    return {
      uri: `vmess://${safeBase64Encode(JSON.stringify(cfg))}`,
      uuid: cfg.id || '',
      sni: cfg.sni || cfg.host || cfg.add || '',
      path: cfg.path || '/',
      transport: cfg.net || 'tcp',
      security: cfg.tls || 'none',
    };
  }

  if (protocol === 'vless' || protocol === 'trojan' || protocol === 'hysteria2') {
    const schemeMatch = rawUri.match(/^([a-z0-9]+):\/\//i);
    const scheme = schemeMatch ? schemeMatch[1].toLowerCase() : protocol;
    const u = new URL(rawUri.replace(/^[a-z0-9]+:\/\//i, 'https://'));
    if (customSni) {
      u.searchParams.set('sni', customSni);
      if ((u.searchParams.get('type') || '').toLowerCase() === 'ws') {
        u.searchParams.set('host', customSni);
      }
    }
    u.hash = `#${encodeURIComponent(tagLabel)}`;
    const rebuilt = u.toString().replace(/^https:\/\//i, `${scheme}://`);
    return {
      uri: rebuilt,
      uuid: decodeURIComponent(u.username || ''),
      sni: u.searchParams.get('sni') || u.searchParams.get('host') || u.hostname,
      path: u.searchParams.get('path') || u.searchParams.get('serviceName') || '/',
      transport: u.searchParams.get('type') || (protocol === 'hysteria2' ? 'quic' : 'tcp'),
      security: u.searchParams.get('security') || 'tls',
    };
  }

  if (protocol === 'shadowsocks' && rawUri.startsWith('ss://')) {
    const base = rawUri.split('#')[0];
    return {
      uri: `${base}#${encodeURIComponent(tagLabel)}`,
      uuid: '',
      sni: customSni || '',
      path: '',
      transport: 'tcp+udp',
      security: 'aead',
    };
  }

  return { uri: rawUri, uuid: '', sni: customSni || '', path: '/', transport: 'tcp', security: 'tls' };
}

function buildV2rayExportConfigs(server, details, username) {
  const tag = `${username}-${server.countryCode}-${server.protocol.toUpperCase()}`;
  const isTls = details.security === 'tls' || details.security === 'reality' || server.protocol === 'trojan';
  const clashLines = [
    `  - name: "${tag}"`,
    `    type: ${server.protocol === 'shadowsocks' ? 'ss' : server.protocol}`,
    `    server: ${server.host}`,
    `    port: ${server.port}`,
  ];
  if (server.protocol === 'vmess') {
    clashLines.push(`    uuid: ${details.uuid}`, `    alterId: 0`, `    cipher: auto`, `    tls: ${isTls}`);
  } else if (server.protocol === 'vless') {
    clashLines.push(`    uuid: ${details.uuid}`, `    tls: ${isTls}`, `    udp: true`);
  } else if (server.protocol === 'trojan') {
    clashLines.push(`    password: "${details.uuid}"`, `    sni: ${details.sni || server.host}`, `    udp: true`);
  }
  if (details.transport === 'ws') {
    clashLines.push(`    network: ws`, `    ws-opts:`, `      path: "${details.path || '/'}"`);
    if (details.sni) clashLines.push(`      headers:`, `        Host: ${details.sni}`);
  }

  const singbox = {
    type: server.protocol === 'shadowsocks' ? 'shadowsocks' : server.protocol,
    tag,
    server: server.host,
    server_port: server.port,
    ...(server.protocol === 'vmess' || server.protocol === 'vless' ? { uuid: details.uuid } : {}),
    ...(server.protocol === 'trojan' || server.protocol === 'hysteria2' ? { password: details.uuid } : {}),
    ...(isTls ? { tls: { enabled: true, server_name: details.sni || server.host, insecure: true } } : {}),
    ...(details.transport === 'ws'
      ? { transport: { type: 'ws', path: details.path || '/', headers: { Host: details.sni || server.host } } }
      : {}),
  };

  return {
    clashConfig: clashLines.join('\n'),
    singboxConfig: JSON.stringify(singbox, null, 2),
  };
}

function createV2rayPoolAccount(server, rawUri, clean) {
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + clean.durationDays * 86400000);
  const details = customizeV2rayUri(rawUri, server.protocol, clean.username, server.countryCode, clean.sni);
  const exportsObj = buildV2rayExportConfigs(server, details, clean.username);

  return {
    ok: true,
    provisioningMode: 'instant',
    account: {
      id: `acc-${Date.now()}-${makeShortHash(`${server.id}-${clean.username}`)}`,
      protocol: server.protocol,
      protocolLabel: server.protocolLabel,
      username: clean.username,
      password: details.uuid || '',
      serverName: server.name,
      country: server.country,
      countryCode: server.countryCode,
      flag: server.flag,
      host: server.host,
      port: server.port,
      ports: server.ports,
      provider: server.provider,
      durationDays: clean.durationDays,
      createdAt: createdAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      configUri: details.uri,
      configFile: details.uri,
      configFileName: `${clean.username}-${server.protocol}-${server.countryCode.toLowerCase()}.txt`,
      clashConfig: exportsObj.clashConfig,
      singboxConfig: exportsObj.singboxConfig,
      extraDetails: {
        'UUID / Password': details.uuid || 'Tertanam di URI Shadowsocks',
        Transport: String(details.transport || 'tcp').toUpperCase(),
        Keamanan: String(details.security || 'tls').toUpperCase(),
        'SNI / Bug Host': details.sni || server.host,
        Path: details.path || '/',
        'Status Aktivasi': 'Aktif Instan — Siap impor ke V2RayNG / Nekobox / Hiddify / Sing-Box',
      },
    },
  };
}

function createVpnGateAccount(server, ovpnBase64, clean) {
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + clean.durationDays * 86400000);
  const ovpnText = safeBase64Decode(ovpnBase64);
  const headerComment = `# Manifestudio SSH & VPN Studio — Profil ${clean.username} (${server.country})\n# Username: vpn | Password: vpn | L2TP IPSec PSK: vpn\n`;

  return {
    ok: true,
    provisioningMode: 'instant',
    account: {
      id: `acc-${Date.now()}-${makeShortHash(`${server.id}-${clean.username}`)}`,
      protocol: 'openvpn',
      protocolLabel: 'OpenVPN / L2TP / SSTP',
      username: 'vpn',
      password: 'vpn',
      profileLabel: clean.username,
      serverName: server.name,
      country: server.country,
      countryCode: server.countryCode,
      flag: server.flag,
      host: server.host,
      port: server.port,
      ports: server.ports,
      provider: server.provider,
      durationDays: clean.durationDays,
      createdAt: createdAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      configUri: `openvpn://${server.ip}:443?user=vpn&pass=vpn#${encodeURIComponent(`${clean.username}-${server.countryCode}`)}`,
      configFile: `${headerComment}${ovpnText}`,
      configFileName: `${clean.username}-${server.countryCode.toLowerCase()}-vpngate.ovpn`,
      clashConfig: '',
      singboxConfig: '',
      extraDetails: {
        'Profil Anda': clean.username,
        'Alamat IP Server': server.ip,
        'Username Login': 'vpn',
        'Password Login': 'vpn',
        'L2TP/IPSec Pre-Shared Key': 'vpn',
        'Kecepatan Server': `${server.speedMbps} Mbps · Ping ${server.pingMs} ms`,
        'Status Aktivasi': 'Aktif Instan — Unduh file .ovpn lalu impor ke OpenVPN Connect',
      },
    },
  };
}

export function createPortalSshPreparation(server, clean) {
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + clean.durationDays * 86400000);
  const bugHost = clean.sni || server.host;
  const prefix = String(server.usernamePrefix || '');
  const effectiveUsername =
    prefix && !clean.username.toLowerCase().startsWith(prefix.toLowerCase())
      ? `${prefix}${clean.username}`
      : clean.username;
  const wsDirectPayload = `GET / HTTP/1.1[crlf]Host: ${bugHost}[crlf]Upgrade: websocket[crlf]Connection: Upgrade[crlf][crlf]`;
  const wsInjectorProxyPayload = `GET / HTTP/1.1[crlf]Host: ${bugHost}[crlf]Upgrade: websocket[crlf]Connection: Upgrade[crlf][crlf][split]CONNECT [host_port] HTTP/1.1[crlf][crlf]`;
  const hcConfig = [
    `# Manifestudio SSH & VPN Studio — Konfigurasi ${server.protocolLabel}`,
    `# PENTING: Aktifkan akun terlebih dahulu di Portal Resmi sebelum konek!`,
    `Server Host (Asli) : ${server.host}`,
    `Username Portal    : ${clean.username}`,
    `Username Login SSH : ${effectiveUsername}`,
    `Password           : ${clean.password}`,
    `Port               : ${server.ports}`,
    ...(server.wildcardDomain ? [`Domain Wildcard    : ${server.wildcardDomain}`] : []),
    `SNI / Bug Host     : ${bugHost}`,
    `Durasi             : ${clean.durationDays} Hari`,
    `Format HTTP Custom : ${server.host}:80@${effectiveUsername}:${clean.password}`,
    `Format SSL / TLS   : ${server.host}:443@${effectiveUsername}:${clean.password}`,
    `Payload Direct WS  : ${wsDirectPayload}`,
    `Payload Injector   : ${wsInjectorProxyPayload}`,
    `Portal Resmi       : ${server.portalUrl}`,
  ].join('\n');

  return {
    ok: true,
    provisioningMode: 'portal',
    requiresPortalVerification: true,
    portalMessage:
      `BELUM AKTIF — Akun SSH VPS ini wajib didaftarkan terlebih dahulu lewat tombol "Langkah 1: Aktifkan di Portal Resmi" di bawah (verifikasi anti-bot 1x dari penyedia). Setelah berhasil aktif di portal, gunakan Host asli "${server.host}" dan username "${effectiveUsername}" di HTTP Custom / HTTP Injector.`,
    account: {
      id: `acc-${Date.now()}-${makeShortHash(`${server.id}-${clean.username}`)}`,
      protocol: server.protocol,
      protocolLabel: server.protocolLabel,
      username: effectiveUsername,
      portalInputUsername: clean.username,
      password: clean.password,
      serverName: server.name,
      country: server.country,
      countryCode: server.countryCode,
      flag: server.flag,
      host: server.host,
      port: server.port,
      ports: server.ports,
      provider: server.provider,
      portalUrl: server.portalUrl,
      durationDays: clean.durationDays,
      createdAt: createdAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      configUri: `${server.host}:${server.port}@${effectiveUsername}:${clean.password}`,
      configFile: hcConfig,
      configFileName: `${effectiveUsername}-${server.countryCode.toLowerCase()}-ssh.txt`,
      clashConfig: '',
      singboxConfig: '',
      extraDetails: {
        ...(prefix ? { 'Username Isi di Portal': clean.username, 'Username Login Setelah Aktif': effectiveUsername } : {}),
        'Format HTTP Custom (Direct WS)': `${server.host}:80@${effectiveUsername}:${clean.password}`,
        'Format SSL / TLS (Port 443)': `${server.host}:443@${effectiveUsername}:${clean.password}`,
        ...(server.wildcardDomain ? { 'Domain Wildcard': server.wildcardDomain } : {}),
        'Payload HTTP Custom (Mode Direct WS)': wsDirectPayload,
        'Payload HTTP Injector (Mode Proxy)': wsInjectorProxyPayload,
        'SNI / Bug Host': bugHost,
        'Sisa Slot Server': `${server.remainingSlots} / ${server.maxSlots} slot`,
        'Status Aktivasi': 'Menunggu Aktivasi 1-Klik di Portal Resmi',
      },
    },
  };
}

// ============================================================================
// Main Cloudflare Pages / Express Request Handler
// ============================================================================

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export async function handleSshVpnRequest(request) {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  try {
    if (method === 'GET') {
      const refresh = url.searchParams.get('refresh') === '1';
      const protocolFilter = String(url.searchParams.get('protocol') || 'all').toLowerCase();
      const catalog = await loadUnifiedServerCatalog(refresh);
      const servers =
        protocolFilter && protocolFilter !== 'all'
          ? catalog.servers.filter((s) =>
              protocolFilter === 'ssh' ? s.protocol.startsWith('ssh-') : s.protocol === protocolFilter
            )
          : catalog.servers;

      return jsonResponse({
        ok: true,
        servers,
        totalServers: servers.length,
        providers: catalog.providers,
        activeApiCount: catalog.activeApiCount,
        totalApiCount: catalog.totalApiCount,
        syncedAt: catalog.syncedAt,
      });
    }

    if (method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const action = String(body?.action || 'create').toLowerCase();

      if (action === 'sync') {
        const catalog = await loadUnifiedServerCatalog(true);
        return jsonResponse({
          ok: true,
          servers: catalog.servers,
          totalServers: catalog.servers.length,
          providers: catalog.providers,
          activeApiCount: catalog.activeApiCount,
          totalApiCount: catalog.totalApiCount,
          syncedAt: catalog.syncedAt,
        });
      }

      const validation = validateCreatePayload(body);
      if (!validation.ok) {
        return jsonResponse({ ok: false, error: validation.errors[0], errors: validation.errors }, 400);
      }

      const { clean } = validation;
      const catalog = await loadUnifiedServerCatalog(false);
      let server = catalog.servers.find((s) => s.id === clean.serverId);

      // Auto-failover if chosen server rotated out of live pool
      if (!server && clean.protocol) {
        server = catalog.servers.find((s) => s.protocol === clean.protocol);
      }
      if (!server) {
        return jsonResponse(
          { ok: false, error: 'Server yang dipilih sedang diperbarui. Silakan segarkan daftar server.' },
          404
        );
      }

      if (server.protocol === 'wireguard' && server.provisioningMode === 'instant') {
        const result = await createCloudflareWarpAccount(server, clean);
        return jsonResponse(result, 200);
      }

      if (server.protocol === 'openvpn' && server.provisioningMode === 'instant') {
        const ovpnB64 = _vpngateOvpnMap.get(server.id);
        if (!ovpnB64) {
          const fresh = await loadUnifiedServerCatalog(true);
          const freshServer = fresh.servers.find((s) => s.id === server.id) || fresh.servers.find((s) => s.protocol === 'openvpn' && s.provisioningMode === 'instant');
          const freshOvpn = freshServer ? _vpngateOvpnMap.get(freshServer.id) : null;
          if (!freshServer || !freshOvpn) {
            return jsonResponse({ ok: false, error: 'Konfigurasi OpenVPN sedang diperbarui, silakan coba server lain.' }, 503);
          }
          return jsonResponse(createVpnGateAccount(freshServer, freshOvpn, clean), 200);
        }
        return jsonResponse(createVpnGateAccount(server, ovpnB64, clean), 200);
      }

      if (server.provisioningMode === 'instant' && _v2rayRawMap.has(server.id)) {
        const rawUri = _v2rayRawMap.get(server.id);
        return jsonResponse(createV2rayPoolAccount(server, rawUri, clean), 200);
      }

      // Refresh live pool once if the selected node rotated out of memory cache
      const refreshed = await loadUnifiedServerCatalog(true);
      const fallbackSrv =
        refreshed.servers.find((s) => s.id === server.id) ||
        refreshed.servers.find((s) => s.protocol === server.protocol);
      if (fallbackSrv && _v2rayRawMap.has(fallbackSrv.id)) {
        return jsonResponse(createV2rayPoolAccount(fallbackSrv, _v2rayRawMap.get(fallbackSrv.id), clean), 200);
      }

      return jsonResponse(
        { ok: false, error: 'Server sedang diperbarui secara real-time. Silakan tekan Segarkan Real-Time dan coba lagi.' },
        503
      );
    }

    return jsonResponse({ ok: false, error: 'Method tidak didukung.' }, 405);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Terjadi kendala saat menghubungi penyedia server.';
    return jsonResponse({ ok: false, error: message }, 502);
  }
}

export async function onRequestGet(context) {
  return handleSshVpnRequest(context.request);
}

export async function onRequestPost(context) {
  return handleSshVpnRequest(context.request);
}

export async function onRequestOptions(context) {
  return handleSshVpnRequest(context.request);
}
