/**
 * Caller ID & Anti-Spam Intelligence UI Controller (v75).
 * Features:
 *  - Country-aware & E.164 Phone Search Bar (no login, 100% free)
 *  - Trust/Risk Score Meter + Structured Telecom & HLR Card
 *  - Verified Official Indonesia Directory Match (60+ Bank/OJK/Gov/Courier)
 *  - Live 5-Engine Collaborative Telemetry (libphonenumber-js, Official ID, CallShield GitHub Shards, GitHub/HN OSINT, Wikidata)
 *  - Interactive Community Tag Cloud + Custom Tag/Spam Reporter + Personal Blocklist
 *  - Searchable Official Directory, Check History, Scam Script Analyzer & JSON Vault Export/Import
 */

import {
  COMMON_SCAM_PATTERNS_ID,
  COUNTRY_CALLING_CODES,
  VERIFIED_OFFICIAL_DIRECTORY,
  aggregateCallerIntelligence,
  mergeCommunityVaultJson,
  normalizeCommunityVault,
  parsePhoneNumberInput,
  toggleBlockedNumber,
  upsertCheckHistory,
  upsertCommunityTag,
} from './phone-logic.js?v=75';
import { runCollaborativePhoneLookup } from './phone-engine.js?v=75';

const VAULT_STORAGE_KEY = 'manifestudio_callerid_vault_v1';

const QUICK_SAMPLE_NUMBERS = [
  { label: 'Halo BCA 1500888', number: '1500888', note: 'Bank Resmi' },
  { label: 'OJK WA Resmi', number: '081157157157', note: 'Regulator Resmi' },
  { label: 'Telkomsel HLR', number: '081234567890', note: 'Cek Operator' },
  { label: 'Sampel Spam CallShield', number: '+12012302420', note: 'Database Open-Source' },
];

const QUICK_TAG_PRESETS = [
  { tag: 'Kurir / Ekspedisi', sentiment: 'business' },
  { tag: 'Layanan Resmi', sentiment: 'safe' },
  { tag: 'Sales / Telemarketer', sentiment: 'nuisance' },
  { tag: 'Penipuan / Phishing', sentiment: 'spam' },
  { tag: 'Pinjol Ilegal', sentiment: 'spam' },
  { tag: 'Kontak Terpercaya', sentiment: 'safe' },
];

function escapeHtml(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function readVaultStorage() {
  try {
    const raw = localStorage.getItem(VAULT_STORAGE_KEY);
    if (!raw) return normalizeCommunityVault();
    return normalizeCommunityVault(JSON.parse(raw));
  } catch {
    return normalizeCommunityVault();
  }
}

function writeVaultStorage(vault) {
  try {
    localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(vault));
  } catch {
    // Ignore storage quota errors
  }
}

function formatDateShort(iso = '') {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function getSentimentLabel(sentiment = 'business') {
  switch (sentiment) {
    case 'safe':
      return 'Aman / Resmi';
    case 'nuisance':
      return 'Mengganggu / Sales';
    case 'spam':
      return 'Spam / Penipuan';
    default:
      return 'Umum / Bisnis';
  }
}

function getEngineBadgeMeta(status = 'ok') {
  switch (status) {
    case 'alert':
      return { cls: 'is-alert', symbol: '!' };
    case 'warn':
      return { cls: 'is-warn', symbol: '~' };
    case 'offline':
      return { cls: 'is-offline', symbol: '×' };
    case 'fallback':
    case 'skip':
      return { cls: 'is-muted', symbol: '•' };
    default:
      return { cls: 'is-ok', symbol: '✓' };
  }
}

export function createCallerIdController({ onToast = () => {} } = {}) {
  const state = {
    view: 'lookup', // 'lookup' | 'directory' | 'vault' | 'patterns'
    defaultRegion: 'ID',
    phoneInput: '',
    claimInput: '',
    claimOpen: false,
    loading: false,
    error: '',
    result: null,
    directoryQuery: '',
    tagFormOpen: false,
    tagInput: '',
    tagSentiment: 'business',
    tagNote: '',
    vault: readVaultStorage(),
  };

  let hostEl = null;

  function saveVault(nextVault) {
    state.vault = normalizeCommunityVault(nextVault);
    writeVaultStorage(state.vault);
  }

  function refreshCurrentResultWithVault() {
    if (!state.result?.ok) return;
    const prev = state.result;
    const e164Key = prev.parsed.e164 || prev.parsed.raw;
    const communityTags = state.vault.tagsByNumber[e164Key] || [];
    const isBlockedLocally = state.vault.blockedNumbers.some((b) => b.e164 === e164Key);
    const nextSummary = aggregateCallerIntelligence({
      parsed: prev.parsed,
      officialMatch: prev.officialMatch,
      callShieldMatch: prev.callShieldMatch,
      communityTags,
      isBlockedLocally,
      osintHits: prev.osintHits,
      wikidataMatch: prev.wikidataMatch,
      scamAnalysis: prev.scamAnalysis,
    });
    nextSummary.effectiveCarrier = prev.summary?.effectiveCarrier || nextSummary.effectiveCarrier;
    nextSummary.effectiveRegion = prev.summary?.effectiveRegion || nextSummary.effectiveRegion;
    nextSummary.effectiveLineType = prev.summary?.effectiveLineType || nextSummary.effectiveLineType;

    state.result = {
      ...prev,
      communityTags,
      isBlockedLocally,
      summary: nextSummary,
    };
    const nextVault = upsertCheckHistory(state.vault, {
      e164: e164Key,
      nationalFormat: prev.parsed.nationalFormat || prev.parsed.raw,
      carrier: nextSummary.effectiveCarrier,
      verdictKey: nextSummary.verdictKey,
      verdictLabel: nextSummary.verdictLabel,
      primaryTag: nextSummary.primaryTag,
    });
    saveVault(nextVault);
    render();
  }

  async function executeLookup(rawNumberInput, { recordHistory = true, silentToast = false } = {}) {
    const cleanInput = String(rawNumberInput ?? state.phoneInput).trim();
    state.phoneInput = cleanInput;
    state.error = '';

    if (!cleanInput) {
      state.error = 'Masukkan nomor telepon yang ingin diperiksa (contoh: 081234567890 atau +12012302420).';
      render();
      return;
    }

    const quickParsed = parsePhoneNumberInput(cleanInput, state.defaultRegion);
    if (!quickParsed.valid && (!quickParsed.e164 || quickParsed.e164.length < 4)) {
      state.error = quickParsed.reason || 'Format nomor belum valid.';
      state.result = null;
      render();
      return;
    }

    state.loading = true;
    state.view = 'lookup';
    render();

    try {
      const report = await runCollaborativePhoneLookup({
        rawNumber: cleanInput,
        defaultRegion: state.defaultRegion,
        claimText: state.claimOpen ? state.claimInput : '',
        communityVault: state.vault,
      });

      if (!report.ok) {
        state.error = report.error || 'Gagal menganalisis nomor telepon.';
        state.result = null;
      } else {
        state.result = report;
        if (recordHistory) {
          const nextVault = upsertCheckHistory(state.vault, {
            e164: report.parsed.e164 || report.parsed.raw,
            nationalFormat: report.parsed.nationalFormat || report.parsed.raw,
            carrier: report.summary.effectiveCarrier,
            verdictKey: report.summary.verdictKey,
            verdictLabel: report.summary.verdictLabel,
            primaryTag: report.summary.primaryTag,
          });
          saveVault(nextVault);
        }
        if (!silentToast) {
          onToast(`Analisis selesai · ${report.summary.verdictLabel}`);
        }
      }
    } catch (err) {
      state.error = err?.message || 'Terjadi kendala saat menghubungi engine open-source.';
    } finally {
      state.loading = false;
      render();
    }
  }

  function renderTopTabs() {
    const blockedCount = state.vault.blockedNumbers.length;
    const historyCount = state.vault.history.length;
    return `
      <div class="cid-subnav" role="tablist" aria-label="Menu Cek Nomor & Anti-Spam">
        <button type="button" role="tab" class="cid-tab-btn ${state.view === 'lookup' ? 'is-active' : ''}" data-cid-view="lookup" aria-selected="${state.view === 'lookup'}">
          Lacak & Cek Nomor
        </button>
        <button type="button" role="tab" class="cid-tab-btn ${state.view === 'directory' ? 'is-active' : ''}" data-cid-view="directory" aria-selected="${state.view === 'directory'}">
          Direktori Resmi (${VERIFIED_OFFICIAL_DIRECTORY.length})
        </button>
        <button type="button" role="tab" class="cid-tab-btn ${state.view === 'vault' ? 'is-active' : ''}" data-cid-view="vault" aria-selected="${state.view === 'vault'}">
          Riwayat & Blokir (${historyCount}/${blockedCount})
        </button>
        <button type="button" role="tab" class="cid-tab-btn ${state.view === 'patterns' ? 'is-active' : ''}" data-cid-view="patterns" aria-selected="${state.view === 'patterns'}">
          Pola Penipuan
        </button>
      </div>
    `;
  }

  function renderResultWorkspace() {
    if (state.loading) {
      return `
        <section class="cid-loading-card" aria-busy="true" aria-label="Memeriksa nomor lintas API open-source">
          <div class="cid-loading-spinner" aria-hidden="true"></div>
          <div>
            <strong>Menjalankan 5 Engine Kolaboratif Secara Paralel...</strong>
            <p>Memvalidasi ITU-T E.164 &amp; HLR, Direktori Resmi ID, CallShield GitHub Spam Shard, GitHub/HN OSINT, dan Wikidata.</p>
          </div>
        </section>
      `;
    }

    if (!state.result) {
      return `
        <section class="cid-empty-workspace">
          <div class="cid-empty-head">
            <h3>Inteligensi Nomor &amp; Anti-Spam Multi-API (Gratis Tanpa Login)</h3>
            <p>
              Masukkan nomor HP Indonesia (<code>08xx</code>), telepon kantor (<code>021xx</code>), call center resmi (<code>1500888</code>), atau nomor internasional (<code>+1...</code>, <code>+60...</code>, <code>+65...</code>).
            </p>
          </div>
          <div class="cid-engine-overview-grid">
            <div class="cid-overview-row">
              <strong>1. Telekomunikasi &amp; HLR</strong>
              <span>Google libphonenumber-js + kode HLR Telkomsel, Indosat/Tri, XL/AXIS, Smartfren &amp; 35+ kode area PSTN Indonesia.</span>
            </div>
            <div class="cid-overview-row">
              <strong>2. CallShield Open-Source DB</strong>
              <span>Pencocokan hash SHA-256 langsung ke 256 shard dataset spam publik &amp; Community Watch di GitHub tanpa login.</span>
            </div>
            <div class="cid-overview-row">
              <strong>3. Direktori Resmi &amp; OSINT</strong>
              <span>Verifikasi 40+ hotline resmi Bank/OJK/Polri/Kurir + pencarian jejak publik di GitHub Issues, Hacker News &amp; Wikidata.</span>
            </div>
            <div class="cid-overview-row">
              <strong>4. Vault Tag Komunitas Lokal</strong>
              <span>Simpan label tag penelepon, blokir nomor spam, &amp; ekspor/impor database tag komunitas JSON di browser Anda.</span>
            </div>
          </div>
          <p class="cid-transparency-note">
            Catatan transparansi: Database tag kontak privat GetContact/Truecaller mewajibkan autentikasi akun pribadi dan tidak menyediakan API publik tanpa login. Fitur ini memakai sumber open-source publik yang sah, direktori resmi terverifikasi, serta tag komunitas terbuka (0% nama palsu/rekaan).
          </p>
        </section>
      `;
    }

    const r = state.result;
    const { parsed, summary, officialMatch, callShieldMatch, osintHits, wikidataMatch, scamAnalysis, engines } = r;
    const e164Key = parsed.e164 || parsed.raw;
    const waHref = parsed.whatsappDigits ? `https://wa.me/${encodeURIComponent(parsed.whatsappDigits)}` : '';
    const tgHref = parsed.whatsappDigits ? `https://t.me/+${encodeURIComponent(parsed.whatsappDigits)}` : '';
    const googleHref = `https://www.google.com/search?q=${encodeURIComponent(`"${parsed.nationalFormat}" OR "${e164Key}" penipu OR spam`)}`;

    return `
      <section class="cid-result-grid" data-testid="callerid-result-card">
        <!-- Hero Caller Verdict Card -->
        <article class="cid-verdict-card is-${escapeHtml(summary.verdictTone)}">
          <div class="cid-verdict-top">
            <div class="cid-verdict-identity">
              <div class="cid-verdict-status-line">
                <span class="cid-status-dot is-${escapeHtml(summary.verdictTone)}" aria-hidden="true"></span>
                <strong class="cid-verdict-label" data-testid="callerid-verdict-label">${escapeHtml(summary.verdictLabel)}</strong>
                <span aria-hidden="true">·</span>
                <span class="cid-tabular">${escapeHtml(parsed.country ? `${parsed.country.flag} ${parsed.country.name}` : 'Internasional')}</span>
              </div>
              <h3 class="cid-primary-number cid-tabular" data-testid="callerid-primary-number">${escapeHtml(parsed.internationalFormat || e164Key)}</h3>
              <div class="cid-meta-inline cid-tabular">
                <span>Nasional: ${escapeHtml(parsed.nationalFormat)}</span>
                <span aria-hidden="true">·</span>
                <span>E.164: ${escapeHtml(e164Key)}</span>
                <span aria-hidden="true">·</span>
                <span>${escapeHtml(summary.effectiveLineType)}</span>
              </div>
            </div>

            <div class="cid-trust-gauge" aria-label="Skor kepercayaan ${summary.trustScore} dari 100">
              <div class="cid-score-box is-${escapeHtml(summary.verdictTone)}">
                <span class="cid-score-num cid-tabular">${summary.trustScore}</span>
                <span class="cid-score-cap">Trust / 100</span>
              </div>
              <span class="cid-risk-sub cid-tabular">Risiko ${summary.riskScore}%</span>
            </div>
          </div>

          <p class="cid-verdict-summary">${escapeHtml(summary.verdictSummary)}</p>

          ${
            officialMatch
              ? `
            <div class="cid-official-callout" data-testid="callerid-official-badge">
              <div>
                <strong>Entitas Resmi Terverifikasi: ${escapeHtml(officialMatch.name)}</strong>
                <p>${escapeHtml(officialMatch.category)} · ${escapeHtml(officialMatch.short)}</p>
              </div>
              ${
                officialMatch.website
                  ? `<a href="${escapeHtml(officialMatch.website)}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-xs">Situs Resmi ↗</a>`
                  : ''
              }
            </div>
          `
              : ''
          }

          <div class="cid-telecom-specs">
            <div class="cid-spec-item">
              <span class="cid-spec-label">Operator / Jaringan</span>
              <strong class="cid-spec-val">${escapeHtml(summary.effectiveCarrier)}${parsed.carrierBrand ? ` (${escapeHtml(parsed.carrierBrand)})` : ''}</strong>
            </div>
            <div class="cid-spec-item">
              <span class="cid-spec-label">Wilayah &amp; Kode Area</span>
              <strong class="cid-spec-val">${escapeHtml(summary.effectiveRegion)}</strong>
            </div>
            <div class="cid-spec-item">
              <span class="cid-spec-label">Zona Waktu</span>
              <strong class="cid-spec-val cid-tabular">${escapeHtml(parsed.timezone || 'UTC')}</strong>
            </div>
            <div class="cid-spec-item">
              <span class="cid-spec-label">Validasi Struktural</span>
              <strong class="cid-spec-val">${parsed.valid ? 'Valid (ITU-T E.164)' : `Perhatian (${escapeHtml(parsed.reason)})`}</strong>
            </div>
          </div>

          <!-- Action Row -->
          <div class="cid-action-bar">
            <button type="button" class="btn btn-secondary btn-xs" id="cid-copy-e164" data-copy-text="${escapeHtml(e164Key)}">
              Salin ${escapeHtml(e164Key)}
            </button>
            <button type="button" class="btn ${r.isBlockedLocally ? 'btn-primary' : 'btn-secondary'} btn-xs" id="cid-toggle-block-btn" data-testid="callerid-block-btn">
              ${r.isBlockedLocally ? 'Hapus dari Daftar Blokir' : 'Blokir Nomor Ini'}
            </button>
            <button type="button" class="btn btn-primary btn-xs" id="cid-open-tag-form-btn" data-testid="callerid-add-tag-btn">
              + Tambah Tag / Laporkan
            </button>
            ${waHref ? `<a href="${escapeHtml(waHref)}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-xs">Cek WhatsApp ↗</a>` : ''}
            ${tgHref ? `<a href="${escapeHtml(tgHref)}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-xs">Cek Telegram ↗</a>` : ''}
            <a href="${escapeHtml(googleHref)}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-xs">Jejak Web ↗</a>
          </div>
        </article>

        <!-- Tag Cloud & Community Reporter -->
        <article class="cid-panel-card">
          <div class="cid-panel-head">
            <div>
              <h4>Tag Penelepon &amp; Laporan Komunitas</h4>
              <p>Gabungan label dari Direktori Resmi, CallShield Open-Source DB, Wikidata, dan Vault Tag Komunitas Anda.</p>
            </div>
          </div>

          ${
            summary.tags.length === 0
              ? `
            <p class="cid-muted-line">
              Belum ada tag komunitas tersimpan untuk nomor ini. Klik <strong>+ Tambah Tag / Laporkan</strong> untuk memberi label agar terekam pada riwayat Anda.
            </p>
          `
              : `
            <ul class="cid-tag-list" data-testid="callerid-tag-list">
              ${summary.tags
                .map(
                  (t) => `
                <li class="cid-tag-item is-${escapeHtml(t.sentiment)}">
                  <span class="cid-tag-name">${escapeHtml(t.label)}</span>
                  <span class="cid-tag-meta cid-tabular">${escapeHtml(t.sources.join(', '))} · ${t.count}×</span>
                </li>
              `
                )
                .join('')}
            </ul>
          `
          }

          ${
            state.tagFormOpen
              ? `
            <form id="cid-tag-form" class="cid-tag-form">
              <div class="cid-tag-presets">
                ${QUICK_TAG_PRESETS.map(
                  (p) => `
                  <button type="button" class="cid-preset-btn" data-tag-preset="${escapeHtml(p.tag)}" data-tag-sentiment="${escapeHtml(p.sentiment)}">
                    ${escapeHtml(p.tag)}
                  </button>
                `
                ).join('')}
              </div>
              <div class="cid-tag-form-grid">
                <div class="cid-field">
                  <label for="cid-tag-input">Nama / Label Tag Penelepon</label>
                  <input type="text" id="cid-tag-input" maxlength="48" required value="${escapeHtml(state.tagInput)}" placeholder="Contoh: Kurir J&T Express / Penipu Undian" />
                </div>
                <div class="cid-field">
                  <label for="cid-tag-sentiment">Kategori Keamanan</label>
                  <select id="cid-tag-sentiment">
                    <option value="business" ${state.tagSentiment === 'business' ? 'selected' : ''}>Umum / Bisnis / Kurir</option>
                    <option value="safe" ${state.tagSentiment === 'safe' ? 'selected' : ''}>Aman / Resmi Terpercaya</option>
                    <option value="nuisance" ${state.tagSentiment === 'nuisance' ? 'selected' : ''}>Mengganggu / Sales / Telemarketer</option>
                    <option value="spam" ${state.tagSentiment === 'spam' ? 'selected' : ''}>Spam / Penipuan / Phishing</option>
                  </select>
                </div>
              </div>
              <div class="cid-field">
                <label for="cid-tag-note">Catatan Kronologi Singkat (Opsional)</label>
                <input type="text" id="cid-tag-note" maxlength="160" value="${escapeHtml(state.tagNote)}" placeholder="Contoh: Mengaku kurir mengirim file .apk lewat WhatsApp" />
              </div>
              <div class="cid-tag-form-actions">
                <button type="submit" class="btn btn-primary btn-sm">Simpan Tag Komunitas</button>
                <button type="button" class="btn btn-secondary btn-sm" id="cid-cancel-tag-btn">Batal</button>
              </div>
            </form>
          `
              : ''
          }
        </article>

        ${
          scamAnalysis?.analyzed
            ? `
          <article class="cid-panel-card">
            <div class="cid-panel-head">
              <div>
                <h4>Analisis Klaim / Pesan Penelepon</h4>
                <p>Status: <strong>${escapeHtml(scamAnalysis.verdict)}</strong> (Skor risiko pesan: <span class="cid-tabular">${scamAnalysis.riskPoints}/100</span>)</p>
              </div>
            </div>
            ${
              scamAnalysis.matchedSignals.length > 0
                ? `<ul class="cid-signal-list">${scamAnalysis.matchedSignals
                    .map((s) => `<li>${escapeHtml(s)}</li>`)
                    .join('')}</ul>`
                : `<p class="cid-muted-line">Tidak terdeteksi pola skrip phishing umum (.APK, BI-FAST palsu, permintaan OTP/CVV) pada teks pesan.</p>`
            }
          </article>
        `
            : ''
        }

        <!-- 5 Collaborative Open-Source Engines Telemetry -->
        <article class="cid-panel-card">
          <div class="cid-panel-head">
            <div>
              <h4>Hasil 5 Mesin Kolaboratif Real-Time</h4>
              <p>Semua engine dijalankan serentak tanpa login atau API key berbayar.</p>
            </div>
          </div>
          <div class="cid-engines-table" data-testid="callerid-engines-list">
            ${engines
              .map((eng) => {
                const badge = getEngineBadgeMeta(eng.status);
                return `
                  <div class="cid-engine-row">
                    <div class="cid-engine-main">
                      <span class="cid-engine-mark ${badge.cls}" aria-hidden="true">${badge.symbol}</span>
                      <div>
                        <strong>${escapeHtml(eng.name)}</strong>
                        <p>${escapeHtml(eng.detail)}</p>
                      </div>
                    </div>
                    <div class="cid-engine-right">
                      <span class="cid-engine-status ${badge.cls}">${escapeHtml(eng.statusLabel)}</span>
                      <span class="cid-engine-ms cid-tabular">${eng.durationMs} ms</span>
                    </div>
                  </div>
                `;
              })
              .join('')}
          </div>

          ${
            callShieldMatch?.found
              ? `
            <div class="cid-evidence-box">
              <strong>Detail Bukti CallShield Open-Source (Shard #${escapeHtml(callShieldMatch.shardId)})</strong>
              <p class="cid-tabular">
                Kategori: ${escapeHtml(callShieldMatch.type)} · Laporan: ${callShieldMatch.reports} · Terlihat: ${escapeHtml(callShieldMatch.firstSeen || '-')} s.d. ${escapeHtml(callShieldMatch.lastSeen || '-')} · Sumber: ${escapeHtml((callShieldMatch.sources || []).join(', '))}
              </p>
            </div>
          `
              : ''
          }

          ${
            Array.isArray(osintHits) && osintHits.length > 0
              ? `
            <div class="cid-evidence-box">
              <strong>Jejak Publik Terbuka (GitHub Issues &amp; Forum)</strong>
              <ul class="cid-osint-list">
                ${osintHits
                  .map(
                    (h) => `
                  <li>
                    <a href="${escapeHtml(h.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(h.source)}: ${escapeHtml(h.title)} ↗</a>
                    ${h.snippet ? `<span>${escapeHtml(h.snippet)}</span>` : ''}
                  </li>
                `
                  )
                  .join('')}
              </ul>
            </div>
          `
              : ''
          }

          ${
            wikidataMatch?.label
              ? `
            <div class="cid-evidence-box">
              <strong>Entitas Wikimedia</strong>
              <p>${escapeHtml(wikidataMatch.label)}${wikidataMatch.description ? ` — ${escapeHtml(wikidataMatch.description)}` : ''}</p>
            </div>
          `
              : ''
          }
        </article>
      </section>
    `;
  }

  function renderDirectoryView() {
    const q = state.directoryQuery.trim().toLowerCase();
    const list = VERIFIED_OFFICIAL_DIRECTORY.filter((item) => {
      if (!q) return true;
      return `${item.name} ${item.category} ${item.short} ${item.numbers.join(' ')}`.toLowerCase().includes(q);
    });

    return `
      <section class="cid-panel-card">
        <div class="cid-panel-head">
          <div>
            <h3>Direktori Kontak Resmi Terverifikasi Indonesia</h3>
            <p>Cocokkan nomor Bank, OJK, Darurat, Pemerintah, &amp; Ekspedisi resmi agar terhindar dari nomor HP tiruan.</p>
          </div>
          <input
            type="search"
            id="cid-directory-search"
            class="cid-inline-search"
            value="${escapeHtml(state.directoryQuery)}"
            placeholder="Cari BCA, OJK, BRI, JNE, 112..."
            aria-label="Cari direktori nomor resmi"
          />
        </div>

        <div class="cid-directory-list">
          ${
            list.length === 0
              ? `<p class="cid-muted-line">Tidak ada instansi resmi yang cocok dengan pencarian "${escapeHtml(state.directoryQuery)}".</p>`
              : list
                  .map(
                    (item) => `
                <div class="cid-dir-row">
                  <div class="cid-dir-info">
                    <strong>${escapeHtml(item.name)}</strong>
                    <span>${escapeHtml(item.category)} · ${escapeHtml(item.short)}</span>
                  </div>
                  <div class="cid-dir-actions">
                    <span class="cid-dir-num cid-tabular">${escapeHtml(item.numbers[0])}</span>
                    <button type="button" class="btn btn-secondary btn-xs" data-cid-quick="${escapeHtml(item.numbers[0])}">
                      Cek
                    </button>
                  </div>
                </div>
              `
                  )
                  .join('')
          }
        </div>
      </section>
    `;
  }

  function renderVaultView() {
    const { history, blockedNumbers, tagsByNumber } = state.vault;
    const taggedEntries = Object.entries(tagsByNumber);

    return `
      <div class="cid-vault-stack">
        <section class="cid-panel-card">
          <div class="cid-panel-head">
            <div>
              <h3>Cadangkan / Bagikan Tag Komunitas (JSON)</h3>
              <p>Data tag &amp; daftar blokir disimpan privat di perangkat Anda. Ekspor ke JSON atau impor paket tag komunitas tepercaya.</p>
            </div>
            <div class="cid-vault-tools">
              <button type="button" class="btn btn-secondary btn-xs" id="cid-export-vault-btn">Ekspor JSON</button>
              <label for="cid-import-vault-file" class="btn btn-secondary btn-xs cid-file-btn">Impor JSON</label>
              <input type="file" id="cid-import-vault-file" accept=".json,application/json" hidden />
              ${
                history.length > 0
                  ? `<button type="button" class="btn btn-secondary btn-xs" id="cid-clear-history-btn">Hapus Riwayat</button>`
                  : ''
              }
            </div>
          </div>
        </section>

        <section class="cid-panel-card">
          <div class="cid-panel-head">
            <div>
              <h3>Daftar Blokir Pribadi (${blockedNumbers.length})</h3>
              <p>Nomor yang Anda tandai masuk daftar pantau/blokir lokal.</p>
            </div>
          </div>
          ${
            blockedNumbers.length === 0
              ? `<p class="cid-muted-line">Belum ada nomor di daftar blokir Anda.</p>`
              : `
            <div class="cid-directory-list">
              ${blockedNumbers
                .map(
                  (b) => `
                <div class="cid-dir-row">
                  <div class="cid-dir-info">
                    <strong class="cid-tabular">${escapeHtml(b.e164)}</strong>
                    <span>${escapeHtml(b.reason)} · ${escapeHtml(formatDateShort(b.blockedAt))}</span>
                  </div>
                  <div class="cid-dir-actions">
                    <button type="button" class="btn btn-secondary btn-xs" data-cid-quick="${escapeHtml(b.e164)}">Lihat</button>
                    <button type="button" class="btn btn-secondary btn-xs" data-cid-unblock="${escapeHtml(b.e164)}">Buka Blokir</button>
                  </div>
                </div>
              `
                )
                .join('')}
            </div>
          `
          }
        </section>

        <section class="cid-panel-card">
          <div class="cid-panel-head">
            <div>
              <h3>Tag Komunitas Tersimpan (${taggedEntries.length} Nomor)</h3>
              <p>Semua tag yang Anda tambahkan atau impor.</p>
            </div>
          </div>
          ${
            taggedEntries.length === 0
              ? `<p class="cid-muted-line">Belum ada tag komunitas tersimpan. Tambahkan tag dari hasil pengecekan nomor.</p>`
              : `
            <div class="cid-directory-list">
              ${taggedEntries
                .map(([num, list]) => {
                  const top = list[0];
                  return `
                    <div class="cid-dir-row">
                      <div class="cid-dir-info">
                        <strong class="cid-tabular">${escapeHtml(num)}</strong>
                        <span>${escapeHtml(top.tag)} (${escapeHtml(getSentimentLabel(top.sentiment))}) · ${list.length} tag</span>
                      </div>
                      <div class="cid-dir-actions">
                        <button type="button" class="btn btn-secondary btn-xs" data-cid-quick="${escapeHtml(num)}">Buka</button>
                      </div>
                    </div>
                  `;
                })
                .join('')}
            </div>
          `
          }
        </section>

        <section class="cid-panel-card">
          <div class="cid-panel-head">
            <div>
              <h3>Riwayat Pengecekan Terakhir (${history.length})</h3>
              <p>Klik nomor mana saja untuk mengecek ulang secara live.</p>
            </div>
          </div>
          ${
            history.length === 0
              ? `<p class="cid-muted-line">Belum ada riwayat pengecekan nomor.</p>`
              : `
            <div class="cid-directory-list">
              ${history
                .map(
                  (h) => `
                <div class="cid-dir-row">
                  <div class="cid-dir-info">
                    <strong class="cid-tabular">${escapeHtml(h.nationalFormat || h.e164)} (${escapeHtml(h.e164)})</strong>
                    <span>${escapeHtml(h.verdictLabel)} · ${escapeHtml(h.carrier || 'Operator')} · ${escapeHtml(formatDateShort(h.checkedAt))}</span>
                  </div>
                  <div class="cid-dir-actions">
                    <button type="button" class="btn btn-secondary btn-xs" data-cid-quick="${escapeHtml(h.e164)}">Cek Ulang</button>
                  </div>
                </div>
              `
                )
                .join('')}
            </div>
          `
          }
        </section>
      </div>
    `;
  }

  function renderPatternsView() {
    return `
      <section class="cid-panel-card">
        <div class="cid-panel-head">
          <div>
            <h3>Panduan Modus Penipuan Telepon &amp; WhatsApp Populer</h3>
            <p>Kenali ciri khas rekayasa sosial sebelum merespons panggilan atau mengklik tautan.</p>
          </div>
        </div>
        <div class="cid-patterns-grid">
          ${COMMON_SCAM_PATTERNS_ID.map(
            (p) => `
            <article class="cid-pattern-card">
              <div class="cid-pattern-top">
                <strong>${escapeHtml(p.title)}</strong>
                <span class="cid-pattern-risk">Risiko ${escapeHtml(p.risk)}</span>
              </div>
              <p class="cid-pattern-desc">${escapeHtml(p.summary)}</p>
              <p class="cid-pattern-tip"><strong>Pencegahan:</strong> ${escapeHtml(p.tip)}</p>
            </article>
          `
          ).join('')}
        </div>
      </section>
    `;
  }

  function bindEvents() {
    if (!hostEl) return;

    hostEl.querySelectorAll('[data-cid-view]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.view = btn.getAttribute('data-cid-view') || 'lookup';
        render();
      });
    });

    hostEl.querySelector('#cid-region-select')?.addEventListener('change', (e) => {
      state.defaultRegion = e.target.value || 'ID';
    });

    hostEl.querySelector('#cid-phone-input')?.addEventListener('input', (e) => {
      state.phoneInput = e.target.value;
    });

    hostEl.querySelector('#cid-toggle-claim-btn')?.addEventListener('click', () => {
      state.claimOpen = !state.claimOpen;
      render();
    });

    hostEl.querySelector('#cid-claim-input')?.addEventListener('input', (e) => {
      state.claimInput = e.target.value;
    });

    hostEl.querySelector('#cid-lookup-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      executeLookup(state.phoneInput);
    });

    hostEl.querySelectorAll('[data-cid-quick]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const num = btn.getAttribute('data-cid-quick');
        if (num) executeLookup(num);
      });
    });

    hostEl.querySelector('#cid-copy-e164')?.addEventListener('click', async (e) => {
      const txt = e.currentTarget.getAttribute('data-copy-text') || '';
      if (!txt) return;
      try {
        await navigator.clipboard.writeText(txt);
        onToast(`Disalin: ${txt}`);
      } catch {
        onToast(`Nomor: ${txt}`);
      }
    });

    hostEl.querySelector('#cid-toggle-block-btn')?.addEventListener('click', () => {
      if (!state.result?.ok) return;
      const e164Key = state.result.parsed.e164 || state.result.parsed.raw;
      const wasBlocked = state.vault.blockedNumbers.some((b) => b.e164 === e164Key);
      const next = toggleBlockedNumber(state.vault, e164Key, {
        label: state.result.summary.primaryTag || state.result.summary.effectiveCarrier,
        reason: wasBlocked ? '' : state.result.summary.verdictLabel,
      });
      saveVault(next);
      onToast(wasBlocked ? `${e164Key} dihapus dari daftar blokir` : `${e164Key} ditambahkan ke daftar blokir`);
      refreshCurrentResultWithVault();
    });

    hostEl.querySelector('#cid-open-tag-form-btn')?.addEventListener('click', () => {
      state.tagFormOpen = !state.tagFormOpen;
      render();
    });

    hostEl.querySelector('#cid-cancel-tag-btn')?.addEventListener('click', () => {
      state.tagFormOpen = false;
      render();
    });

    hostEl.querySelectorAll('[data-tag-preset]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.tagInput = btn.getAttribute('data-tag-preset') || '';
        state.tagSentiment = btn.getAttribute('data-tag-sentiment') || 'business';
        const input = hostEl.querySelector('#cid-tag-input');
        const sel = hostEl.querySelector('#cid-tag-sentiment');
        if (input) input.value = state.tagInput;
        if (sel) sel.value = state.tagSentiment;
      });
    });

    hostEl.querySelector('#cid-tag-input')?.addEventListener('input', (e) => {
      state.tagInput = e.target.value;
    });
    hostEl.querySelector('#cid-tag-sentiment')?.addEventListener('change', (e) => {
      state.tagSentiment = e.target.value;
    });
    hostEl.querySelector('#cid-tag-note')?.addEventListener('input', (e) => {
      state.tagNote = e.target.value;
    });

    hostEl.querySelector('#cid-tag-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!state.result?.ok) return;
      const e164Key = state.result.parsed.e164 || state.result.parsed.raw;
      try {
        const next = upsertCommunityTag(state.vault, e164Key, {
          tag: state.tagInput,
          sentiment: state.tagSentiment,
          note: state.tagNote,
        });
        saveVault(next);
        state.tagFormOpen = false;
        state.tagInput = '';
        state.tagNote = '';
        onToast('Tag komunitas berhasil disimpan');
        refreshCurrentResultWithVault();
      } catch (err) {
        onToast(err?.message || 'Gagal menyimpan tag');
      }
    });

    hostEl.querySelector('#cid-directory-search')?.addEventListener('input', (e) => {
      state.directoryQuery = e.target.value;
      render();
      const el = hostEl?.querySelector('#cid-directory-search');
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
    });

    hostEl.querySelectorAll('[data-cid-unblock]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const num = btn.getAttribute('data-cid-unblock');
        if (!num) return;
        saveVault(toggleBlockedNumber(state.vault, num));
        onToast(`${num} dibuka dari daftar blokir`);
        render();
      });
    });

    hostEl.querySelector('#cid-clear-history-btn')?.addEventListener('click', () => {
      saveVault({ ...state.vault, history: [] });
      onToast('Riwayat pengecekan dibersihkan');
      render();
    });

    hostEl.querySelector('#cid-export-vault-btn')?.addEventListener('click', () => {
      const payload = JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          source: 'Manifestudio Caller ID Community Vault',
          ...state.vault,
        },
        null,
        2
      );
      const blob = new Blob([payload], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `manifestudio-callerid-vault-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      onToast('Database tag komunitas diekspor ke JSON');
    });

    hostEl.querySelector('#cid-import-vault-file')?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const parsedJson = JSON.parse(text);
        saveVault(mergeCommunityVaultJson(state.vault, parsedJson));
        onToast('Tag & daftar blokir JSON berhasil digabungkan');
        render();
      } catch {
        onToast('File JSON tag komunitas tidak valid');
      }
    });
  }

  function render() {
    if (!hostEl) return;
    const bodyHtml =
      state.view === 'directory'
        ? renderDirectoryView()
        : state.view === 'vault'
        ? renderVaultView()
        : state.view === 'patterns'
        ? renderPatternsView()
        : renderResultWorkspace();

    hostEl.innerHTML = `
      <div class="cid-app">
        <form id="cid-lookup-form" class="cid-search-shell" role="search">
          <div class="cid-search-row">
            <select id="cid-region-select" class="cid-region-select" aria-label="Negara asal default">
              ${COUNTRY_CALLING_CODES.slice(0, 12)
                .map(
                  (c) => `
                <option value="${escapeHtml(c.iso)}" ${state.defaultRegion === c.iso ? 'selected' : ''}>
                  ${escapeHtml(c.flag)} +${escapeHtml(c.code)} (${escapeHtml(c.iso)})
                </option>
              `
                )
                .join('')}
            </select>
            <input
              type="tel"
              id="cid-phone-input"
              class="cid-phone-input cid-tabular"
              value="${escapeHtml(state.phoneInput)}"
              placeholder="Contoh: 081234567890, 1500888, atau +12012302420"
              aria-label="Nomor telepon yang ingin dilacak dan dicek"
            />
            <button type="submit" class="btn btn-primary cid-submit-btn" id="cid-submit-btn" ${state.loading ? 'disabled' : ''}>
              ${state.loading ? 'Melacak...' : 'Cek Nomor'}
            </button>
          </div>

          <div class="cid-search-subbar">
            <div class="cid-quick-samples">
              <span class="cid-quick-label">Contoh cepat:</span>
              ${QUICK_SAMPLE_NUMBERS.map(
                (s) => `
                <button type="button" class="cid-sample-btn" data-cid-quick="${escapeHtml(s.number)}">
                  ${escapeHtml(s.label)}
                </button>
              `
              ).join('')}
            </div>
            <button type="button" class="cid-link-toggle" id="cid-toggle-claim-btn" aria-expanded="${state.claimOpen ? 'true' : 'false'}">
              ${state.claimOpen ? 'Tutup Analisis Pesan' : '+ Cek Klaim / Pesan Penelepon'}
            </button>
          </div>

          ${
            state.claimOpen
              ? `
            <div class="cid-claim-box">
              <label for="cid-claim-input">Tempel isi SMS/WhatsApp atau pengakuan penelepon (opsional, dianalisis 100% di browser)</label>
              <textarea
                id="cid-claim-input"
                rows="2"
                placeholder="Contoh: Saya kurir J&T, tolong instal file resi-paket.apk atau bayar biaya BI-FAST Rp150.000..."
              >${escapeHtml(state.claimInput)}</textarea>
            </div>
          `
              : ''
          }

          ${state.error ? `<p class="cid-error-banner" role="alert">${escapeHtml(state.error)}</p>` : ''}
        </form>

        ${renderTopTabs()}

        <div class="cid-workspace-body">
          ${bodyHtml}
        </div>
      </div>
    `;

    bindEvents();
  }

  return {
    mount(targetEl) {
      hostEl = targetEl;
      render();
      try {
        const params = new URLSearchParams(window.location.search);
        const deepNumber = params.get('number') || params.get('phone');
        if (deepNumber && !state.result) {
          executeLookup(deepNumber, { silentToast: true });
        }
      } catch {
        // Ignore URL error
      }
    },
    unmount() {
      hostEl = null;
    },
    redrawTheme() {
      // Uses CSS semantic variables cleanly
    },
  };
}
