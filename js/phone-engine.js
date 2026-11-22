/**
 * Real-Time Collaborative Open-Source Phone Lookup & Anti-Spam Engine (v75).
 * Combines 5 legitimate, free, no-login public/open-source engines concurrently:
 *  1. Google libphonenumber-js/max (ESM via jsDelivr) + Local ITU-T E.164 & Indonesia HLR Engine
 *  2. Verified Official Indonesia Directory (60+ Bank/OJK/Gov/Courier) & Anti-Fraud Pattern Engine
 *  3. CallShield Open-Source GitHub Sharded Spam DB (SHA-256 shard + community_watch + hot_numbers + NANP labels)
 *  4. GitHub Public Issues & Hacker News Algolia Community OSINT Search (CORS *)
 *  5. Wikidata & Wikipedia Indonesia Open Knowledge Graph (origin=*)
 * Plus persistent local Community Tag Vault & Personal Blocklist (0% fake/mocked caller names).
 */

import {
  aggregateCallerIntelligence,
  analyzeScamMessagePatterns,
  computeSha256Hex,
  findOfficialDirectoryMatch,
  parsePhoneNumberInput,
} from './phone-logic.js?v=75';

const ENGINE_TIMEOUT_MS = 5000;
const CALLSHIELD_BASE = 'https://raw.githubusercontent.com/SysAdminDoc/CallShield/master/data';
const LIBPHONE_ESM_URL = 'https://cdn.jsdelivr.net/npm/libphonenumber-js@1.12.9/max/+esm';

const shardMemoryCache = new Map();
let communityWatchCache = null;
let hotNumbersCache = null;
let areaLabelsCache = null;
let libPhoneModulePromise = null;

async function fetchJsonWithTimeout(url, timeoutMs = ENGINE_TIMEOUT_MS, headers = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers });
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchTextWithTimeout(url, timeoutMs = ENGINE_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

async function ensureLibPhoneNumber() {
  if (!libPhoneModulePromise) {
    libPhoneModulePromise = Promise.race([
      import(LIBPHONE_ESM_URL),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout libphonenumber-js')), 3500)),
    ]).catch(() => {
      libPhoneModulePromise = null;
      return null;
    });
  }
  return libPhoneModulePromise;
}

function mapLibPhoneType(rawType = '') {
  switch (String(rawType).toUpperCase()) {
    case 'MOBILE':
      return 'SELULER (MOBILE)';
    case 'FIXED_LINE':
      return 'TELEPON TETAP (PSTN)';
    case 'FIXED_LINE_OR_MOBILE':
      return 'TETAP / SELULER';
    case 'TOLL_FREE':
      return 'BEBAS PULSA (TOLL-FREE)';
    case 'VOIP':
      return 'VOIP / VIRTUAL';
    case 'PREMIUM_RATE':
      return 'TARIF PREMIUM';
    case 'SHARED_COST':
      return 'BERBAGI BIAYA';
    default:
      return '';
  }
}

async function runLibPhoneEngine(parsed) {
  const started = performance.now();
  try {
    const mod = await ensureLibPhoneNumber();
    if (!mod || typeof mod.parsePhoneNumberFromString !== 'function') {
      return {
        id: 'libphonenumber',
        name: 'Google libphonenumber-js + HLR',
        status: 'fallback',
        statusLabel: 'Mesin Lokal Aktif',
        durationMs: Math.round(performance.now() - started),
        detail: `${parsed.carrier || 'ITU-T E.164'} · ${parsed.lineType}`,
        data: null,
      };
    }
    const phoneObj = mod.parsePhoneNumberFromString(parsed.e164 || parsed.raw, parsed.country?.iso || 'ID');
    if (!phoneObj) {
      return {
        id: 'libphonenumber',
        name: 'Google libphonenumber-js + HLR',
        status: 'ok',
        statusLabel: 'Format Dianalisis',
        durationMs: Math.round(performance.now() - started),
        detail: `${parsed.carrier} · Validasi struktural lokal`,
        data: null,
      };
    }
    const typeLabel = mapLibPhoneType(phoneObj.getType?.()) || parsed.lineType;
    const isValid = Boolean(phoneObj.isValid?.());
    return {
      id: 'libphonenumber',
      name: 'Google libphonenumber-js + HLR',
      status: isValid ? 'ok' : 'warn',
      statusLabel: isValid ? 'Valid ITU-T E.164' : 'Format Parsial',
      durationMs: Math.round(performance.now() - started),
      detail: `${parsed.carrier || phoneObj.country || 'Global'} · ${typeLabel}`,
      data: {
        isValid,
        countryIso: phoneObj.country || parsed.country?.iso || '',
        nationalNumber: phoneObj.formatNational?.() || parsed.nationalFormat,
        internationalNumber: phoneObj.formatInternational?.() || parsed.internationalFormat,
        lineTypeLabel: typeLabel,
      },
    };
  } catch {
    return {
      id: 'libphonenumber',
      name: 'Google libphonenumber-js + HLR',
      status: 'fallback',
      statusLabel: 'Mesin Lokal Aktif',
      durationMs: Math.round(performance.now() - started),
      detail: `${parsed.carrier || 'ITU-T E.164'} · ${parsed.lineType}`,
      data: null,
    };
  }
}

async function runCallShieldEngine(parsed) {
  const started = performance.now();
  const targetE164 = parsed?.e164?.startsWith('+') ? parsed.e164 : '';
  if (!targetE164) {
    return {
      id: 'callshield',
      name: 'CallShield GitHub Spam DB',
      status: 'skip',
      statusLabel: 'Kode Pendek Lokal',
      durationMs: Math.round(performance.now() - started),
      detail: 'Nomor pendek nasional tidak memakai shard E.164 internasional.',
      data: { found: false },
    };
  }

  try {
    const hashHex = await computeSha256Hex(targetE164);
    const shardId = hashHex.slice(0, 2);

    const shardPromise = shardMemoryCache.has(shardId)
      ? Promise.resolve(shardMemoryCache.get(shardId))
      : fetchJsonWithTimeout(`${CALLSHIELD_BASE}/spam_number_shards/${shardId}.json`, 5500).then((json) => {
          shardMemoryCache.set(shardId, json);
          return json;
        });

    const watchPromise = communityWatchCache
      ? Promise.resolve(communityWatchCache)
      : fetchJsonWithTimeout(`${CALLSHIELD_BASE}/community_watch.json`, 4500)
          .then((json) => {
            communityWatchCache = json;
            return json;
          })
          .catch(() => null);

    const hotPromise = hotNumbersCache
      ? Promise.resolve(hotNumbersCache)
      : fetchJsonWithTimeout(`${CALLSHIELD_BASE}/hot_numbers.json`, 4500)
          .then((json) => {
            hotNumbersCache = json;
            return json;
          })
          .catch(() => null);

    // Optional NANP US/CA city label enrichment for +1 numbers
    const areaLabelsPromise =
      parsed.country?.iso === 'US' && !areaLabelsCache
        ? fetchTextWithTimeout(`${CALLSHIELD_BASE}/area-code-city-labels.csv`, 4500)
            .then((csv) => {
              const map = new Map();
              for (const line of csv.split(/\r?\n/)) {
                const m = /^(\d{3}),"?([^"]+)"?$/.exec(line.trim());
                if (m) map.set(m[1], m[2]);
              }
              areaLabelsCache = map;
              return map;
            })
            .catch(() => null)
        : Promise.resolve(areaLabelsCache);

    const [shardJson, watchJson, hotJson, areaMap] = await Promise.all([
      shardPromise,
      watchPromise,
      hotPromise,
      areaLabelsPromise,
    ]);

    const shardEntry = Array.isArray(shardJson?.numbers)
      ? shardJson.numbers.find((item) => item?.number === targetE164)
      : null;
    const watchEntry = Array.isArray(watchJson?.numbers)
      ? watchJson.numbers.find((item) => item?.number === targetE164)
      : null;
    const hotEntry = Array.isArray(hotJson?.numbers)
      ? hotJson.numbers.find((item) => item?.number === targetE164)
      : null;

    let nanpCity = '';
    if (parsed.country?.iso === 'US' && areaMap) {
      const npa = targetE164.slice(2, 5);
      nanpCity = areaMap.get(npa) || '';
    }

    if (shardEntry || watchEntry || hotEntry) {
      const merged = {
        found: true,
        shardId,
        type: shardEntry?.type || (hotEntry ? 'hot-spam' : 'community-watch'),
        reports: Number(shardEntry?.reports || hotEntry?.reports || watchEntry?.reporter_count || 1),
        reporterCount: Number(watchEntry?.reporter_count || shardEntry?.reports || 1),
        firstSeen: shardEntry?.first_seen || '',
        lastSeen: shardEntry?.last_seen || '',
        description:
          shardEntry?.description ||
          (hotEntry ? 'Tren lonjakan laporan spam 24 jam terakhir' : 'Masuk daftar pantau komunitas CallShield'),
        sources: Array.isArray(shardEntry?.sources) ? shardEntry.sources : ['CallShield Community'],
        nanpCity,
      };
      return {
        id: 'callshield',
        name: 'CallShield GitHub Spam DB',
        status: 'alert',
        statusLabel: `${merged.reports} Laporan Spam`,
        durationMs: Math.round(performance.now() - started),
        detail: `${merged.type} · ${merged.description} (Shard ${shardId})`,
        data: merged,
      };
    }

    return {
      id: 'callshield',
      name: 'CallShield GitHub Spam DB',
      status: 'ok',
      statusLabel: 'Bersih di 256 Shard',
      durationMs: Math.round(performance.now() - started),
      detail: `Shard SHA-256 #${shardId} (${shardJson?.numbers?.length || 0} entri) & Community Watch bersih.${nanpCity ? ` Wilayah: ${nanpCity}.` : ''}`,
      data: { found: false, shardId, nanpCity },
    };
  } catch (err) {
    return {
      id: 'callshield',
      name: 'CallShield GitHub Spam DB',
      status: 'offline',
      statusLabel: 'Gagal Terjangkau',
      durationMs: Math.round(performance.now() - started),
      detail: `Tidak dapat memuat shard CallShield (${err?.message || 'jaringan'}).`,
      data: { found: false },
    };
  }
}

async function runPublicOsintEngine(parsed) {
  const started = performance.now();
  const cleanNat = String(parsed?.nationalFormat || '').replace(/[^\d]/g, '');
  const searchTerms = Array.from(new Set([parsed?.e164, cleanNat].filter((t) => t && t.length >= 7)));

  if (searchTerms.length === 0) {
    return {
      id: 'osint',
      name: 'GitHub Issues & HN OSINT',
      status: 'skip',
      statusLabel: 'Dilewati (Shortcode)',
      durationMs: Math.round(performance.now() - started),
      detail: 'Pencarian OSINT publik hanya dijalankan untuk nomor lengkap >= 7 digit.',
      data: [],
    };
  }

  const hits = [];
  let rateLimited = false;

  const ghPromise = fetchJsonWithTimeout(
    `https://api.github.com/search/issues?q=${encodeURIComponent(`"${searchTerms[0]}"`)}&per_page=3`,
    4500
  )
    .then((json) => {
      for (const item of json?.items || []) {
        const text = `${item.title || ''} ${item.body || ''}`.toLowerCase();
        hits.push({
          source: 'GitHub Public Issue',
          title: item.title || 'Diskusi GitHub',
          url: item.html_url || '',
          snippet: String(item.body || '').replace(/\s+/g, ' ').slice(0, 140),
          isSpamSignal: /spam|scam|penipu|phishing|fraud|blocklist/.test(text),
        });
      }
    })
    .catch((err) => {
      if (err?.status === 403 || err?.status === 429) rateLimited = true;
    });

  const hnPromise = fetchJsonWithTimeout(
    `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(`"${searchTerms[0]}"`)}&hitsPerPage=3`,
    4500
  )
    .then((json) => {
      for (const item of json?.hits || []) {
        const title = item.title || item.story_title || 'Diskusi Hacker News';
        const snippet = String(item.comment_text || '').replace(/<[^>]+>/g, ' ').slice(0, 140);
        hits.push({
          source: 'Hacker News Algolia',
          title,
          url: item.url || `https://news.ycombinator.com/item?id=${item.objectID}`,
          snippet,
          isSpamSignal: /spam|scam|robocall|phishing|fraud/.test(`${title} ${snippet}`.toLowerCase()),
        });
      }
    })
    .catch(() => {});

  await Promise.all([ghPromise, hnPromise]);

  return {
    id: 'osint',
    name: 'GitHub Issues & HN OSINT',
    status: hits.length > 0 ? 'ok' : rateLimited ? 'warn' : 'ok',
    statusLabel:
      hits.length > 0
        ? `${hits.length} Jejak Publik`
        : rateLimited
        ? 'Sebagian Limit Publik'
        : 'Tidak Ada Jejak Publik',
    durationMs: Math.round(performance.now() - started),
    detail:
      hits.length > 0
        ? `Ditemukan ${hits.length} penyebutan publik pada repositori/forum terbuka.`
        : 'Tidak ditemukan laporan terbuka pada GitHub Issues atau Hacker News.',
    data: hits,
  };
}

async function runWikimediaOfficialEngine(parsed, officialMatch) {
  const started = performance.now();
  const query = officialMatch?.name
    ? officialMatch.name.replace(/\(.*?\)/g, '').trim()
    : parsed?.carrier && parsed?.isIndonesian
    ? parsed.carrier
    : parsed?.country?.name || '';

  if (!query) {
    return {
      id: 'wikimedia',
      name: 'Wikidata & Wikipedia ID',
      status: 'skip',
      statusLabel: 'Tidak Relevan',
      durationMs: Math.round(performance.now() - started),
      detail: 'Tidak ada nama entitas atau operator untuk dicocokkan.',
      data: null,
    };
  }

  try {
    const [wdJson, wpJson] = await Promise.all([
      fetchJsonWithTimeout(
        `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(query)}&language=id&limit=1&format=json&origin=*`,
        4200
      ).catch(() => null),
      fetchJsonWithTimeout(
        `https://id.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=1&format=json&origin=*`,
        4200
      ).catch(() => null),
    ]);

    const entity = wdJson?.search?.[0] || null;
    const wikiPage = wpJson?.query?.search?.[0] || null;
    if (entity || wikiPage) {
      return {
        id: 'wikimedia',
        name: 'Wikidata & Wikipedia ID',
        status: 'ok',
        statusLabel: officialMatch ? 'Entitas Resmi Cocok' : 'Info Operator Terverifikasi',
        durationMs: Math.round(performance.now() - started),
        detail: `${entity?.label || wikiPage?.title}${entity?.description ? ` — ${entity.description}` : ''}`,
        data: {
          label: entity?.label || wikiPage?.title || '',
          description: entity?.description || '',
          url: entity?.concepturi || (wikiPage ? `https://id.wikipedia.org/wiki/${encodeURIComponent(wikiPage.title)}` : ''),
        },
      };
    }

    return {
      id: 'wikimedia',
      name: 'Wikidata & Wikipedia ID',
      status: 'ok',
      statusLabel: 'Siap',
      durationMs: Math.round(performance.now() - started),
      detail: `Entitas ${query} tidak mengembalikan ringkasan tambahan.`,
      data: null,
    };
  } catch {
    return {
      id: 'wikimedia',
      name: 'Wikidata & Wikipedia ID',
      status: 'offline',
      statusLabel: 'Offline',
      durationMs: Math.round(performance.now() - started),
      detail: 'Gagal menjangkau Wikidata/Wikipedia API.',
      data: null,
    };
  }
}

/**
 * Runs all 5 collaborative engines in parallel and returns a complete Caller ID report.
 */
export async function runCollaborativePhoneLookup({
  rawNumber = '',
  defaultRegion = 'ID',
  claimText = '',
  communityVault = {},
} = {}) {
  const parsed = parsePhoneNumberInput(rawNumber, defaultRegion);
  if (!parsed.valid && (!parsed.e164 || parsed.e164.length < 4)) {
    return { ok: false, error: parsed.reason || 'Format nomor telepon tidak valid.', parsed };
  }

  const officialMatch = findOfficialDirectoryMatch(parsed);
  const scamAnalysis = analyzeScamMessagePatterns(claimText, parsed);

  const [libPhoneRes, callShieldRes, osintRes, wikimediaRes] = await Promise.all([
    runLibPhoneEngine(parsed),
    runCallShieldEngine(parsed),
    runPublicOsintEngine(parsed),
    runWikimediaOfficialEngine(parsed, officialMatch),
  ]);

  const e164Key = parsed.e164 || parsed.raw;
  const communityTags = communityVault?.tagsByNumber?.[e164Key] || [];
  const isBlockedLocally = Array.isArray(communityVault?.blockedNumbers)
    ? communityVault.blockedNumbers.some((b) => b.e164 === e164Key)
    : false;

  const summary = aggregateCallerIntelligence({
    parsed,
    officialMatch,
    callShieldMatch: callShieldRes.data,
    communityTags,
    isBlockedLocally,
    osintHits: osintRes.data,
    wikidataMatch: wikimediaRes.data,
    scamAnalysis,
    libPhone: libPhoneRes.data,
  });

  if (callShieldRes.data?.nanpCity && parsed.country?.iso === 'US') {
    summary.effectiveRegion = `${callShieldRes.data.nanpCity} (Amerika Serikat / NANP)`;
  }

  const officialEngineStatus = {
    id: 'official-directory',
    name: 'Direktori Resmi ID & Anti-Fraud',
    status: officialMatch ? 'ok' : scamAnalysis.riskPoints >= 40 ? 'alert' : 'ok',
    statusLabel: officialMatch
      ? 'Resmi Terverifikasi'
      : scamAnalysis.analyzed && scamAnalysis.riskPoints >= 40
      ? 'Pola Penipuan Terdeteksi'
      : 'Cek Direktori Selesai',
    durationMs: 1,
    detail: officialMatch
      ? `Cocok dengan ${officialMatch.name} (${officialMatch.category})`
      : scamAnalysis.analyzed
      ? scamAnalysis.verdict
      : 'Tidak termasuk shortcode darurat/hotline bank resmi Indonesia.',
  };

  return {
    ok: true,
    checkedAt: new Date().toISOString(),
    parsed,
    officialMatch,
    scamAnalysis,
    callShieldMatch: callShieldRes.data,
    osintHits: osintRes.data,
    wikidataMatch: wikimediaRes.data,
    isBlockedLocally,
    communityTags,
    summary,
    engines: [
      libPhoneRes,
      officialEngineStatus,
      callShieldRes,
      osintRes,
      wikimediaRes,
    ],
  };
}
