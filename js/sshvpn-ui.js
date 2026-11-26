/**
 * Manifestudio SSH & VPN Studio — UI Controller (v95)
 * Clean, single-elevation multi-API network account provisioning console.
 * Zero alert()/confirm(), full Light & Dark mode support, 100% escaped DOM rendering.
 */

import {
  DURATION_OPTIONS,
  SSHVPN_PROTOCOLS,
  addAccountToHistory,
  buildCopyableSummary,
  clearSshVpnHistory,
  computeAccountExpiry,
  computeSlotHealth,
  extractAvailableCountries,
  filterAndSortServers,
  generateRandomCredentials,
  getProtocolMeta,
  loadSshVpnHistory,
  protocolRequiresPassword,
  removeAccountFromHistory,
  sanitizeExternalPortalUrl,
  validateSshVpnForm,
} from './sshvpn-logic.js?v=95';

function esc(val) {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function copyText(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fallback below
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

function downloadTextFile(filename, content) {
  const safeName = String(filename || 'manifestudio-config.txt').replace(/[^a-zA-Z0-9._-]/g, '_');
  const blob = new Blob([String(content || '')], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = safeName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function formatSyncTime(iso) {
  if (!iso) return 'Belum disinkron';
  try {
    return new Date(iso).toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return 'Baru saja';
  }
}

export function createSshVpnController({ rootEl, onToast }) {
  let mounted = false;

  const state = {
    activeView: 'builder', // 'builder' | 'history'
    loadingCatalog: true,
    syncing: false,
    catalogError: '',
    servers: [],
    providers: [],
    activeApiCount: 0,
    totalApiCount: 0,
    syncedAt: '',
    showProviderDrawer: false,

    // Filters
    protocol: 'all',
    country: 'ALL',
    instantOnly: false,
    query: '',
    sortBy: 'recommended',

    // Selection & Form
    selectedServerId: '',
    username: '',
    password: '',
    sni: '',
    durationDays: 7,
    creating: false,
    formError: '',

    // Created Result
    activeResult: null, // { provisioningMode, requiresPortalVerification, portalMessage, account }
    resultTab: 'summary', // 'summary' | 'config' | 'clash' | 'singbox'

    // History
    history: loadSshVpnHistory(),
    historyQuery: '',
    confirmClearHistory: false,
  };

  function notify(msg, type = 'info') {
    if (typeof onToast === 'function') onToast(msg, type);
  }

  function getFilteredServers() {
    return filterAndSortServers(state.servers, {
      protocol: state.protocol,
      country: state.country,
      instantOnly: state.instantOnly,
      query: state.query,
      sortBy: state.sortBy,
    });
  }

  function getSelectedServer(filteredList) {
    const list = filteredList || getFilteredServers();
    if (state.selectedServerId) {
      const exact = state.servers.find((s) => s.id === state.selectedServerId);
      if (exact) return exact;
    }
    return list[0] || state.servers[0] || null;
  }

  async function fetchServers(forceRefresh = false) {
    if (forceRefresh) {
      state.syncing = true;
    } else {
      state.loadingCatalog = true;
    }
    state.catalogError = '';
    render();

    try {
      const endpoint = forceRefresh ? '/api/ssh-vpn?refresh=1' : '/api/ssh-vpn';
      const res = await fetch(endpoint, { method: 'GET', cache: 'no-store' });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || 'Gagal memuat daftar server dari API penyedia.');
      }
      state.servers = Array.isArray(data.servers) ? data.servers : [];
      state.providers = Array.isArray(data.providers) ? data.providers : [];
      state.activeApiCount = Number(data.activeApiCount || 0);
      state.totalApiCount = Number(data.totalApiCount || state.providers.length || 0);
      state.syncedAt = data.syncedAt || new Date().toISOString();

      const filtered = getFilteredServers();
      if (!state.selectedServerId || !state.servers.some((s) => s.id === state.selectedServerId)) {
        state.selectedServerId = filtered[0]?.id || state.servers[0]?.id || '';
      }
      if (forceRefresh) {
        notify(`Daftar server diperbarui: ${state.servers.length} server aktif dari ${state.activeApiCount} API.`, 'success');
      }
    } catch (err) {
      state.catalogError = err instanceof Error ? err.message : 'Gagal menyinkronkan API server.';
      notify(state.catalogError, 'error');
    } finally {
      state.loadingCatalog = false;
      state.syncing = false;
      render();
    }
  }

  async function handleCreateAccount() {
    const server = getSelectedServer();
    const validation = validateSshVpnForm({
      server,
      username: state.username,
      password: state.password,
      sni: state.sni,
      durationDays: state.durationDays,
    });

    if (!validation.ok) {
      state.formError = validation.errors[0];
      render();
      return;
    }

    state.formError = '';
    state.creating = true;
    render();

    try {
      const res = await fetch('/api/ssh-vpn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          protocol: server.protocol,
          serverId: server.id,
          username: validation.clean.username,
          password: validation.clean.password,
          sni: validation.clean.sni,
          durationDays: validation.clean.durationDays,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok || !data.account) {
        throw new Error(data?.error || 'Pembuatan akun gagal pada server ini. Coba server atau API lain.');
      }

      state.activeResult = data;
      state.resultTab = 'summary';

      if (data.provisioningMode === 'instant') {
        state.history = addAccountToHistory(data.account);
        notify(`Akun ${data.account.protocolLabel} (${data.account.country}) berhasil dibuat & disimpan!`, 'success');
      } else {
        notify('Konfigurasi SSH siap. Klik tombol Portal Resmi untuk aktivasi 1 klik.', 'info');
      }
    } catch (err) {
      state.formError = err instanceof Error ? err.message : 'Terjadi kendala saat membuat akun.';
      notify(state.formError, 'error');
    } finally {
      state.creating = false;
      render();
      const resultCard = rootEl?.querySelector('#sshvpn-result-anchor');
      if (resultCard) {
        resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }

  function renderResultPanel() {
    const res = state.activeResult;
    if (!res || !res.account) return '';
    const acc = res.account;
    const isPortal = res.provisioningMode === 'portal';
    const safePortalUrl = sanitizeExternalPortalUrl(acc.portalUrl);
    const hasClash = Boolean(acc.clashConfig && acc.clashConfig.trim());
    const hasSingbox = Boolean(acc.singboxConfig && acc.singboxConfig.trim());
    const expiry = computeAccountExpiry(acc.expiresAt);

    let tabBody = '';
    if (state.resultTab === 'summary') {
      const rows = [
        ['Protokol', acc.protocolLabel || acc.protocol],
        ['Server & Negara', `${acc.flag || ''} ${acc.serverName || acc.host} (${acc.country || ''})`.trim()],
        ['Host / Endpoint', acc.host],
        ['Port', acc.ports || String(acc.port || '')],
        ['Username', acc.username],
        ...(acc.password ? [['Password / UUID', acc.password]] : []),
        ['Penyedia API', acc.provider || 'Multi-API'],
        ['Masa Aktif', `${acc.durationDays || 7} Hari · ${expiry.label}`],
        ...Object.entries(acc.extraDetails || {}),
      ];
      tabBody = `
        <dl class="sshvpn-detail-grid">
          ${rows
            .map(
              ([k, v]) => `
            <div class="sshvpn-detail-row">
              <dt>${esc(k)}</dt>
              <dd class="sshvpn-mono">${esc(v)}</dd>
            </div>
          `
            )
            .join('')}
        </dl>
      `;
    } else if (state.resultTab === 'config') {
      tabBody = `
        <pre class="sshvpn-code-block"><code>${esc(acc.configFile || acc.configUri || '')}</code></pre>
      `;
    } else if (state.resultTab === 'clash' && hasClash) {
      tabBody = `
        <pre class="sshvpn-code-block"><code>${esc(acc.clashConfig)}</code></pre>
      `;
    } else if (state.resultTab === 'singbox' && hasSingbox) {
      tabBody = `
        <pre class="sshvpn-code-block"><code>${esc(acc.singboxConfig)}</code></pre>
      `;
    }

    return `
      <div id="sshvpn-result-anchor" class="sshvpn-result-card ${isPortal ? 'is-portal' : 'is-instant'}">
        <div class="sshvpn-result-head">
          <div>
            <p class="sshvpn-result-kicker">${
              isPortal ? 'Siap Aktivasi Portal Resmi' : 'Akun VIP Gratis Aktif Instan'
            }</p>
            <h3 class="sshvpn-result-title">${esc(acc.flag || '')} ${esc(acc.serverName || acc.host)}</h3>
          </div>
          <span class="sshvpn-expiry-text">${esc(expiry.label)}</span>
        </div>

        ${
          isPortal && res.portalMessage
            ? `<p class="sshvpn-portal-notice">${esc(res.portalMessage)}</p>`
            : ''
        }

        <div class="sshvpn-subtabs" role="tablist" aria-label="Format konfigurasi akun">
          <button type="button" role="tab" aria-selected="${state.resultTab === 'summary'}" class="sshvpn-subtab ${
            state.resultTab === 'summary' ? 'is-active' : ''
          }" data-result-tab="summary">Ringkasan</button>
          <button type="button" role="tab" aria-selected="${state.resultTab === 'config'}" class="sshvpn-subtab ${
            state.resultTab === 'config' ? 'is-active' : ''
          }" data-result-tab="config">URI / Konfig</button>
          ${
            hasClash
              ? `<button type="button" role="tab" aria-selected="${state.resultTab === 'clash'}" class="sshvpn-subtab ${
                  state.resultTab === 'clash' ? 'is-active' : ''
                }" data-result-tab="clash">Clash YAML</button>`
              : ''
          }
          ${
            hasSingbox
              ? `<button type="button" role="tab" aria-selected="${state.resultTab === 'singbox'}" class="sshvpn-subtab ${
                  state.resultTab === 'singbox' ? 'is-active' : ''
                }" data-result-tab="singbox">Sing-Box JSON</button>`
              : ''
          }
        </div>

        <div class="sshvpn-result-body">${tabBody}</div>

        <div class="sshvpn-result-actions">
          <button type="button" class="sshvpn-btn sshvpn-btn-primary" data-action="copy-config">Salin Konfig</button>
          <button type="button" class="sshvpn-btn sshvpn-btn-secondary" data-action="copy-summary">Salin Ringkasan</button>
          <button type="button" class="sshvpn-btn sshvpn-btn-secondary" data-action="download-config">Unduh File</button>
          ${
            isPortal && safePortalUrl
              ? `<a class="sshvpn-btn sshvpn-btn-accent" href="${esc(safePortalUrl)}" target="_blank" rel="noopener noreferrer">Aktifkan di Portal Resmi ↗</a>
                 <button type="button" class="sshvpn-btn sshvpn-btn-secondary" data-action="save-portal-history">Simpan ke Riwayat</button>`
              : ''
          }
        </div>
      </div>
    `;
  }

  function renderBuilderView() {
    const filtered = getFilteredServers();
    const selected = getSelectedServer(filtered);
    const countries = extractAvailableCountries(state.servers);
    const needsPass = selected ? protocolRequiresPassword(selected.protocol) : false;
    const selectedMeta = selected ? getProtocolMeta(selected.protocol) : SSHVPN_PROTOCOLS[0];
    const selectedSlots = selected ? computeSlotHealth(selected) : null;
    const isSniSupported = selected && ['vmess', 'vless', 'trojan', 'ssh-ws', 'ssh-ssl'].includes(selected.protocol);

    const serverListHtml = state.loadingCatalog
      ? Array.from({ length: 6 })
          .map(
            () => `
          <div class="sshvpn-server-skeleton" aria-hidden="true">
            <div class="sshvpn-skel-line w-60"></div>
            <div class="sshvpn-skel-line w-90"></div>
            <div class="sshvpn-skel-line w-40"></div>
          </div>
        `
          )
          .join('')
      : filtered.length === 0
      ? `
        <div class="sshvpn-empty-state">
          <p class="sshvpn-empty-title">Tidak ada server yang cocok dengan filter ini</p>
          <p class="sshvpn-empty-desc">Coba pilih protokol lain, ubah negara ke Semua Negara, atau tekan Segarkan Real-Time untuk menarik server terbaru.</p>
          <button type="button" class="sshvpn-btn sshvpn-btn-secondary" data-action="reset-filters">Reset Semua Filter</button>
        </div>
      `
      : filtered
          .map((srv) => {
            const isSelected = selected && selected.id === srv.id;
            const slot = computeSlotHealth(srv);
            const modeLabel = srv.provisioningMode === 'instant' ? 'Instan 1-Klik' : 'Portal Resmi';
            return `
              <button
                type="button"
                class="sshvpn-server-item ${isSelected ? 'is-selected' : ''}"
                data-select-server="${esc(srv.id)}"
                aria-pressed="${isSelected}"
              >
                <div class="sshvpn-server-top">
                  <div class="sshvpn-server-name-wrap">
                    <span class="sshvpn-flag" aria-hidden="true">${esc(srv.flag || '🌐')}</span>
                    <span class="sshvpn-server-name">${esc(srv.name)}</span>
                  </div>
                  <span class="sshvpn-mode-text ${srv.provisioningMode === 'instant' ? 'is-instant' : 'is-portal'}">${modeLabel}</span>
                </div>

                <div class="sshvpn-server-meta">
                  <span class="sshvpn-mono">${esc(srv.host)}</span>
                  <span aria-hidden="true">·</span>
                  <span>${esc(srv.country)}</span>
                  <span aria-hidden="true">·</span>
                  <span>${esc(srv.protocolLabel)}</span>
                </div>

                <div class="sshvpn-server-metrics">
                  <span class="sshvpn-num">${esc(srv.pingMs)} ms</span>
                  <span aria-hidden="true">·</span>
                  <span class="sshvpn-num">${esc(srv.speedMbps >= 1000 ? '1 Gbps+' : `${srv.speedMbps} Mbps`)}</span>
                  <span aria-hidden="true">·</span>
                  <span>${esc(srv.provider)}</span>
                </div>

                <div class="sshvpn-slot-row">
                  <div class="sshvpn-slot-bar" aria-hidden="true">
                    <span class="sshvpn-slot-fill is-${slot.status}" style="width: ${slot.percent}%"></span>
                  </div>
                  <span class="sshvpn-slot-label sshvpn-num is-${slot.status}">${esc(slot.label)}</span>
                </div>
              </button>
            `;
          })
          .join('');

    return `
      <div class="sshvpn-proto-strip" role="tablist" aria-label="Pilih protokol akun jaringan">
        ${SSHVPN_PROTOCOLS.map((p) => {
          const count =
            p.id === 'all'
              ? state.servers.length
              : state.servers.filter((s) => s.protocol === p.id).length;
          return `
            <button
              type="button"
              role="tab"
              aria-selected="${state.protocol === p.id}"
              class="sshvpn-proto-btn ${state.protocol === p.id ? 'is-active' : ''}"
              data-proto="${esc(p.id)}"
            >
              <span>${esc(p.short)}</span>
              <span class="sshvpn-proto-count sshvpn-num">${count}</span>
            </button>
          `;
        }).join('')}
      </div>

      <div class="sshvpn-filter-bar">
        <div class="sshvpn-filter-field">
          <label class="sshvpn-sr-only" for="sshvpn-search-input">Cari server atau host</label>
          <input
            id="sshvpn-search-input"
            type="search"
            class="sshvpn-input"
            placeholder="Cari negara, host, protokol, atau penyedia..."
            value="${esc(state.query)}"
          />
        </div>

        <div class="sshvpn-filter-field sshvpn-filter-select">
          <label class="sshvpn-sr-only" for="sshvpn-country-select">Filter negara server</label>
          <select id="sshvpn-country-select" class="sshvpn-select">
            <option value="ALL">Semua Negara (${countries.length})</option>
            ${countries
              .map(
                (c) =>
                  `<option value="${esc(c.code)}" ${state.country === c.code ? 'selected' : ''}>${esc(
                    `${c.flag} ${c.name} (${c.count})`
                  )}</option>`
              )
              .join('')}
          </select>
        </div>

        <div class="sshvpn-filter-field sshvpn-filter-select">
          <label class="sshvpn-sr-only" for="sshvpn-sort-select">Urutkan daftar server</label>
          <select id="sshvpn-sort-select" class="sshvpn-select">
            <option value="recommended" ${state.sortBy === 'recommended' ? 'selected' : ''}>Rekomendasi VIP</option>
            <option value="ping" ${state.sortBy === 'ping' ? 'selected' : ''}>Ping Terendah</option>
            <option value="slots" ${state.sortBy === 'slots' ? 'selected' : ''}>Slot Terbanyak</option>
            <option value="speed" ${state.sortBy === 'speed' ? 'selected' : ''}>Kecepatan Tertinggi</option>
          </select>
        </div>

        <label class="sshvpn-checkbox-label">
          <input type="checkbox" id="sshvpn-instant-toggle" ${state.instantOnly ? 'checked' : ''} />
          <span>Hanya Instan 1-Klik</span>
        </label>
      </div>

      ${
        state.catalogError
          ? `<div class="sshvpn-alert-error" role="alert">${esc(state.catalogError)}</div>`
          : ''
      }

      <div class="sshvpn-workspace-grid">
        <div class="sshvpn-list-col">
          <div class="sshvpn-col-head">
            <h2 class="sshvpn-col-title">Daftar Server Real-Time</h2>
            <span class="sshvpn-col-meta sshvpn-num">${filtered.length} server tersedia</span>
          </div>
          <div class="sshvpn-server-list" role="region" aria-label="Daftar server aktif">
            ${serverListHtml}
          </div>
        </div>

        <div class="sshvpn-form-col">
          ${
            selected
              ? `
            <div class="sshvpn-spec-card">
              <div class="sshvpn-spec-head">
                <div>
                  <p class="sshvpn-spec-kicker">Spesifikasi Server Terpilih</p>
                  <h2 class="sshvpn-spec-title">${esc(selected.flag || '')} ${esc(selected.name)}</h2>
                </div>
                <span class="sshvpn-slot-label sshvpn-num is-${selectedSlots.status}">${esc(selectedSlots.label)}</span>
              </div>

              <dl class="sshvpn-spec-grid">
                <div>
                  <dt>Host / IP</dt>
                  <dd class="sshvpn-mono">${esc(selected.host)}</dd>
                </div>
                <div>
                  <dt>Lokasi &amp; Ping</dt>
                  <dd class="sshvpn-num">${esc(selected.country)} · ${esc(selected.pingMs)} ms</dd>
                </div>
                <div>
                  <dt>Protokol &amp; Port</dt>
                  <dd>${esc(selected.ports || String(selected.port))}</dd>
                </div>
                <div>
                  <dt>Penyedia &amp; ISP</dt>
                  <dd>${esc(selected.provider)} · ${esc(selected.isp || '-')}</dd>
                </div>
                <div>
                  <dt>Spesifikasi</dt>
                  <dd>${esc(selected.specs || '-')}</dd>
                </div>
                <div>
                  <dt>Aplikasi Rekomendasi</dt>
                  <dd>${esc(selectedMeta.apps)}</dd>
                </div>
              </dl>
            </div>

            <form id="sshvpn-create-form" class="sshvpn-form-card" novalidate>
              <div class="sshvpn-form-head">
                <h3 class="sshvpn-form-title">Konfigurasi Akun Anda</h3>
                <button type="button" class="sshvpn-link-btn" data-action="random-creds">Isi Acak</button>
              </div>

              <div class="sshvpn-field-grid ${needsPass ? 'is-two-col' : ''}">
                <div class="sshvpn-field">
                  <label for="sshvpn-username">Username / Nama Profil</label>
                  <input
                    id="sshvpn-username"
                    name="username"
                    type="text"
                    class="sshvpn-input"
                    placeholder="Contoh: tomyvip01"
                    autocomplete="off"
                    maxlength="24"
                    value="${esc(state.username)}"
                    required
                  />
                  <span class="sshvpn-hint">3–24 karakter huruf, angka, titik, atau strip.</span>
                </div>

                ${
                  needsPass
                    ? `
                  <div class="sshvpn-field">
                    <label for="sshvpn-password">Password Akun SSH</label>
                    <input
                      id="sshvpn-password"
                      name="password"
                      type="text"
                      class="sshvpn-input"
                      placeholder="Contoh: pass2026"
                      autocomplete="off"
                      maxlength="32"
                      value="${esc(state.password)}"
                      required
                    />
                    <span class="sshvpn-hint">Minimal 3 karakter tanpa spasi.</span>
                  </div>
                `
                    : ''
                }
              </div>

              ${
                isSniSupported
                  ? `
                <div class="sshvpn-field">
                  <label for="sshvpn-sni">Bug Host / SNI Custom (Opsional)</label>
                  <input
                    id="sshvpn-sni"
                    name="sni"
                    type="text"
                    class="sshvpn-input"
                    placeholder="Kosongkan untuk default server (contoh: m.zoom.us)"
                    autocomplete="off"
                    maxlength="120"
                    value="${esc(state.sni)}"
                  />
                </div>
              `
                  : ''
              }

              <div class="sshvpn-field">
                <span class="sshvpn-field-label">Durasi Aktif Akun</span>
                <div class="sshvpn-duration-group" role="radiogroup" aria-label="Durasi aktif akun">
                  ${DURATION_OPTIONS.map((opt) => {
                    const active = state.durationDays === opt.days;
                    return `
                      <button
                        type="button"
                        class="sshvpn-duration-btn ${active ? 'is-active' : ''}"
                        data-duration="${opt.days}"
                        aria-pressed="${active}"
                      >
                        <strong class="sshvpn-num">${esc(opt.label)}</strong>
                        <span>${esc(opt.note)}</span>
                      </button>
                    `;
                  }).join('')}
                </div>
              </div>

              ${
                state.formError
                  ? `<div class="sshvpn-alert-error" role="alert">${esc(state.formError)}</div>`
                  : ''
              }

              <button
                type="submit"
                class="sshvpn-btn sshvpn-btn-primary sshvpn-submit-btn"
                ${state.creating ? 'disabled' : ''}
              >
                ${
                  state.creating
                    ? 'Menghubungi API Server...'
                    : selected.provisioningMode === 'instant'
                    ? `Buat Akun ${selected.protocolLabel} Gratis`
                    : `Siapkan Akun ${selected.protocolLabel}`
                }
              </button>
            </form>
          `
              : `
            <div class="sshvpn-empty-state">
              <p class="sshvpn-empty-title">Memuat server aktif...</p>
              <p class="sshvpn-empty-desc">Pilih salah satu server di sebelah kiri untuk melihat spesifikasi lengkap dan membuat akun.</p>
            </div>
          `
          }

          ${renderResultPanel()}
        </div>
      </div>
    `;
  }

  function renderHistoryView() {
    const q = state.historyQuery.trim().toLowerCase();
    const list = state.history.filter((item) => {
      if (!q) return true;
      const hay = `${item.username || ''} ${item.serverName || ''} ${item.country || ''} ${item.protocolLabel || ''} ${item.host || ''}`.toLowerCase();
      return hay.includes(q);
    });

    return `
      <div class="sshvpn-history-bar">
        <div class="sshvpn-filter-field">
          <label class="sshvpn-sr-only" for="sshvpn-history-search">Cari riwayat akun</label>
          <input
            id="sshvpn-history-search"
            type="search"
            class="sshvpn-input"
            placeholder="Cari username, protokol, negara, atau host di riwayat..."
            value="${esc(state.historyQuery)}"
          />
        </div>

        ${
          state.history.length > 0
            ? state.confirmClearHistory
              ? `
                <div class="sshvpn-confirm-inline">
                  <span>Hapus semua riwayat?</span>
                  <button type="button" class="sshvpn-btn sshvpn-btn-danger" data-action="confirm-clear-history">Ya, Hapus</button>
                  <button type="button" class="sshvpn-btn sshvpn-btn-secondary" data-action="cancel-clear-history">Batal</button>
                </div>
              `
              : `<button type="button" class="sshvpn-btn sshvpn-btn-secondary" data-action="ask-clear-history">Bersihkan Riwayat</button>`
            : ''
        }
      </div>

      ${
        list.length === 0
          ? `
        <div class="sshvpn-empty-state">
          <p class="sshvpn-empty-title">${
            state.history.length === 0 ? 'Belum ada riwayat pembuatan akun' : 'Riwayat tidak ditemukan'
          }</p>
          <p class="sshvpn-empty-desc">${
            state.history.length === 0
              ? 'Semua akun WireGuard, VMess, VLess, Trojan, Shadowsocks, OpenVPN, dan SSH yang Anda buat tersimpan otomatis secara lokal di perangkat ini.'
              : 'Coba ubah kata kunci pencarian Anda.'
          }</p>
          ${
            state.history.length === 0
              ? `<button type="button" class="sshvpn-btn sshvpn-btn-primary" data-view="builder">Buat Akun Pertama</button>`
              : ''
          }
        </div>
      `
          : `
        <div class="sshvpn-history-grid">
          ${list
            .map((acc) => {
              const exp = computeAccountExpiry(acc.expiresAt);
              return `
                <article class="sshvpn-history-card">
                  <div class="sshvpn-history-top">
                    <div>
                      <p class="sshvpn-history-meta">${esc(acc.protocolLabel || acc.protocol)} · ${esc(acc.provider || 'Multi-API')}</p>
                      <h3 class="sshvpn-history-title">${esc(acc.flag || '')} ${esc(acc.username)} — ${esc(acc.country || acc.host)}</h3>
                    </div>
                    <span class="sshvpn-expiry-text ${exp.expired ? 'is-expired' : ''}">${esc(exp.label)}</span>
                  </div>

                  <div class="sshvpn-history-info sshvpn-mono">
                    <span>${esc(acc.host)}:${esc(acc.port || 443)}</span>
                    ${acc.password ? `<span aria-hidden="true">·</span><span>Pass: ${esc(acc.password)}</span>` : ''}
                  </div>

                  <div class="sshvpn-history-actions">
                    <button type="button" class="sshvpn-btn sshvpn-btn-primary" data-history-copy="${esc(acc.id)}">Salin Konfig</button>
                    <button type="button" class="sshvpn-btn sshvpn-btn-secondary" data-history-open="${esc(acc.id)}">Detail</button>
                    <button type="button" class="sshvpn-btn sshvpn-btn-secondary" data-history-download="${esc(acc.id)}">Unduh</button>
                    <button type="button" class="sshvpn-btn sshvpn-btn-ghost" data-history-delete="${esc(acc.id)}" aria-label="Hapus riwayat ${esc(acc.username)}">Hapus</button>
                  </div>
                </article>
              `;
            })
            .join('')}
        </div>
      `
      }
    `;
  }

  function renderProviderDrawer() {
    if (!state.showProviderDrawer) return '';
    return `
      <div class="sshvpn-provider-drawer" role="region" aria-label="Status koneksi multi-API">
        <div class="sshvpn-provider-drawer-head">
          <strong>Status Sinkronisasi Multi-API &amp; Auto-Failover</strong>
          <button type="button" class="sshvpn-link-btn" data-action="toggle-providers">Tutup</button>
        </div>
        <div class="sshvpn-provider-list">
          ${state.providers
            .map(
              (p) => `
            <div class="sshvpn-provider-row">
              <span>${esc(p.name)}</span>
              <span class="sshvpn-num ${p.ok ? 'is-ok' : 'is-warn'}">${
                p.ok ? `Aktif · ${p.count} server` : 'Dialihkan otomatis'
              }</span>
            </div>
          `
            )
            .join('')}
        </div>
      </div>
    `;
  }

  function render() {
    if (!mounted || !rootEl) return;

    const focusedId = document.activeElement?.id || '';
    const selStart = typeof document.activeElement?.selectionStart === 'number' ? document.activeElement.selectionStart : null;

    const totalSlots = state.servers.reduce((acc, s) => acc + (Number(s.remainingSlots) >= 999 ? 100 : Number(s.remainingSlots) || 0), 0);

    rootEl.innerHTML = `
      <div class="sshvpn-shell">
        <div class="sshvpn-topbar">
          <div class="sshvpn-topbar-info">
            <div class="sshvpn-nav-tabs" role="tablist" aria-label="Mode SSH dan VPN Studio">
              <button
                type="button"
                role="tab"
                aria-selected="${state.activeView === 'builder'}"
                class="sshvpn-nav-tab ${state.activeView === 'builder' ? 'is-active' : ''}"
                data-view="builder"
              >Buat Akun &amp; Server Live</button>
              <button
                type="button"
                role="tab"
                aria-selected="${state.activeView === 'history'}"
                class="sshvpn-nav-tab ${state.activeView === 'history' ? 'is-active' : ''}"
                data-view="history"
              >Riwayat Akun (${state.history.length})</button>
            </div>
            <div class="sshvpn-sync-summary">
              <span class="sshvpn-num">${state.activeApiCount}/${state.totalApiCount || 12} API aktif</span>
              <span aria-hidden="true">·</span>
              <span class="sshvpn-num">${state.servers.length} server online</span>
              <span aria-hidden="true">·</span>
              <span class="sshvpn-num">${totalSlots.toLocaleString('id-ID')}+ slot tersedia</span>
              <span aria-hidden="true">·</span>
              <span>Sinkron ${esc(formatSyncTime(state.syncedAt))}</span>
            </div>
          </div>

          <div class="sshvpn-topbar-actions">
            <button type="button" class="sshvpn-btn sshvpn-btn-secondary" data-action="toggle-providers">
              Status API
            </button>
            <button type="button" class="sshvpn-btn sshvpn-btn-primary" data-action="refresh-catalog" ${state.syncing ? 'disabled' : ''}>
              ${state.syncing ? 'Menyegarkan...' : 'Segarkan Real-Time'}
            </button>
          </div>
        </div>

        ${renderProviderDrawer()}

        <div class="sshvpn-body">
          ${state.activeView === 'builder' ? renderBuilderView() : renderHistoryView()}
        </div>
      </div>
    `;

    bindEvents();

    if (focusedId) {
      const el = rootEl.querySelector(`#${CSS.escape(focusedId)}`);
      if (el && typeof el.focus === 'function') {
        el.focus();
        if (selStart !== null && typeof el.setSelectionRange === 'function') {
          try {
            el.setSelectionRange(selStart, selStart);
          } catch {
            // ignore on search/select inputs
          }
        }
      }
    }
  }

  function bindEvents() {
    if (!rootEl) return;

    rootEl.querySelectorAll('[data-view]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.activeView = btn.getAttribute('data-view') || 'builder';
        state.confirmClearHistory = false;
        render();
      });
    });

    rootEl.querySelectorAll('[data-proto]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.protocol = btn.getAttribute('data-proto') || 'all';
        const filtered = getFilteredServers();
        if (filtered.length > 0) {
          state.selectedServerId = filtered[0].id;
        }
        render();
      });
    });

    rootEl.querySelectorAll('[data-select-server]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.selectedServerId = btn.getAttribute('data-select-server') || '';
        state.formError = '';
        render();
      });
    });

    rootEl.querySelectorAll('[data-duration]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.durationDays = Number(btn.getAttribute('data-duration')) || 7;
        render();
      });
    });

    rootEl.querySelectorAll('[data-result-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.resultTab = btn.getAttribute('data-result-tab') || 'summary';
        render();
      });
    });

    const searchInput = rootEl.querySelector('#sshvpn-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        state.query = e.target.value || '';
        render();
      });
    }

    const countrySelect = rootEl.querySelector('#sshvpn-country-select');
    if (countrySelect) {
      countrySelect.addEventListener('change', (e) => {
        state.country = e.target.value || 'ALL';
        const filtered = getFilteredServers();
        if (filtered.length > 0) state.selectedServerId = filtered[0].id;
        render();
      });
    }

    const sortSelect = rootEl.querySelector('#sshvpn-sort-select');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        state.sortBy = e.target.value || 'recommended';
        render();
      });
    }

    const instantToggle = rootEl.querySelector('#sshvpn-instant-toggle');
    if (instantToggle) {
      instantToggle.addEventListener('change', (e) => {
        state.instantOnly = !!e.target.checked;
        const filtered = getFilteredServers();
        if (filtered.length > 0) state.selectedServerId = filtered[0].id;
        render();
      });
    }

    const usernameInput = rootEl.querySelector('#sshvpn-username');
    if (usernameInput) {
      usernameInput.addEventListener('input', (e) => {
        state.username = e.target.value || '';
      });
    }

    const passwordInput = rootEl.querySelector('#sshvpn-password');
    if (passwordInput) {
      passwordInput.addEventListener('input', (e) => {
        state.password = e.target.value || '';
      });
    }

    const sniInput = rootEl.querySelector('#sshvpn-sni');
    if (sniInput) {
      sniInput.addEventListener('input', (e) => {
        state.sni = e.target.value || '';
      });
    }

    const createForm = rootEl.querySelector('#sshvpn-create-form');
    if (createForm) {
      createForm.addEventListener('submit', (e) => {
        e.preventDefault();
        handleCreateAccount();
      });
    }

    const historySearch = rootEl.querySelector('#sshvpn-history-search');
    if (historySearch) {
      historySearch.addEventListener('input', (e) => {
        state.historyQuery = e.target.value || '';
        render();
      });
    }

    rootEl.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const act = btn.getAttribute('data-action');
        if (act === 'refresh-catalog') {
          fetchServers(true);
        } else if (act === 'toggle-providers') {
          state.showProviderDrawer = !state.showProviderDrawer;
          render();
        } else if (act === 'reset-filters') {
          state.protocol = 'all';
          state.country = 'ALL';
          state.instantOnly = false;
          state.query = '';
          state.sortBy = 'recommended';
          render();
        } else if (act === 'random-creds') {
          const creds = generateRandomCredentials('vip');
          state.username = creds.username;
          state.password = creds.password;
          state.formError = '';
          render();
        } else if (act === 'copy-config' && state.activeResult?.account) {
          const acc = state.activeResult.account;
          const payload =
            state.resultTab === 'clash' && acc.clashConfig
              ? acc.clashConfig
              : state.resultTab === 'singbox' && acc.singboxConfig
              ? acc.singboxConfig
              : acc.configFile || acc.configUri || '';
          const ok = await copyText(payload);
          notify(ok ? 'Konfigurasi berhasil disalin ke clipboard.' : 'Gagal menyalin konfigurasi.', ok ? 'success' : 'error');
        } else if (act === 'copy-summary' && state.activeResult?.account) {
          const ok = await copyText(buildCopyableSummary(state.activeResult.account));
          notify(ok ? 'Ringkasan akun berhasil disalin.' : 'Gagal menyalin ringkasan.', ok ? 'success' : 'error');
        } else if (act === 'download-config' && state.activeResult?.account) {
          const acc = state.activeResult.account;
          downloadTextFile(acc.configFileName || `${acc.username}-config.txt`, acc.configFile || acc.configUri || '');
          notify(`Berkas ${acc.configFileName || 'konfigurasi'} diunduh.`, 'success');
        } else if (act === 'save-portal-history' && state.activeResult?.account) {
          state.history = addAccountToHistory(state.activeResult.account);
          notify('Akun SSH disimpan ke Riwayat Akun.', 'success');
          render();
        } else if (act === 'ask-clear-history') {
          state.confirmClearHistory = true;
          render();
        } else if (act === 'cancel-clear-history') {
          state.confirmClearHistory = false;
          render();
        } else if (act === 'confirm-clear-history') {
          state.history = clearSshVpnHistory();
          state.confirmClearHistory = false;
          notify('Seluruh riwayat akun telah dibersihkan.', 'info');
          render();
        }
      });
    });

    rootEl.querySelectorAll('[data-history-copy]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-history-copy');
        const acc = state.history.find((h) => h.id === id);
        if (!acc) return;
        const ok = await copyText(acc.configFile || acc.configUri || buildCopyableSummary(acc));
        notify(ok ? `Konfigurasi ${acc.username} berhasil disalin.` : 'Gagal menyalin.', ok ? 'success' : 'error');
      });
    });

    rootEl.querySelectorAll('[data-history-download]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-history-download');
        const acc = state.history.find((h) => h.id === id);
        if (!acc) return;
        downloadTextFile(acc.configFileName || `${acc.username}-config.txt`, acc.configFile || acc.configUri || '');
        notify(`Mengunduh ${acc.configFileName || 'konfigurasi'}.`, 'success');
      });
    });

    rootEl.querySelectorAll('[data-history-open]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-history-open');
        const acc = state.history.find((h) => h.id === id);
        if (!acc) return;
        state.activeResult = {
          ok: true,
          provisioningMode: acc.portalUrl && String(acc.protocol || '').startsWith('ssh-') ? 'portal' : 'instant',
          account: acc,
        };
        state.resultTab = 'summary';
        state.activeView = 'builder';
        render();
      });
    });

    rootEl.querySelectorAll('[data-history-delete]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-history-delete');
        state.history = removeAccountFromHistory(id);
        notify('Akun dihapus dari riwayat.', 'info');
        render();
      });
    });
  }

  return {
    mount() {
      mounted = true;
      if (!state.username) {
        const seed = generateRandomCredentials('vip');
        state.username = seed.username;
        state.password = seed.password;
      }
      render();
      if (state.servers.length === 0) {
        fetchServers(false);
      }
    },
    unmount() {
      mounted = false;
      if (rootEl) rootEl.innerHTML = '';
    },
    redrawTheme() {
      // Uses CSS variables directly; no manual canvas redraw needed
    },
  };
}
