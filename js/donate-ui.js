/**
 * Please Donate UI Controller — Saweria & SociaBuzz Tribe Auto Leaderboard (v104)
 *
 * Clean, single-elevation design following Manifestudio's Light/Dark design tokens:
 *  - Support Action Strip: Direct links to Saweria & SociaBuzz Tribe + Live Tabular KPI Summary
 *  - Top 3 Champion Podium (Ranks #2, #1 Elevated Center, #3)
 *  - Segmented Tabs: Top Sepanjang Waktu (All-Time) | Top Bulan Ini (WIB) | Donasi Terbaru (Live Feed)
 *  - Instant Search & Platform Filter (Semua | Saweria | SociaBuzz)
 *  - Automatic background polling (20s when visible) + Manual Refresh + Empty/Loading/Error states
 *  - Zero admin controls exposed on public page (Admin Moderation lives exclusively inside encrypted admin.html)
 */

import {
  DONATE_CONFIG,
  escapeDonateHtml,
  filterLeaderboardEntries,
  formatOriginalCurrency,
  formatPlatformLabel,
  formatPlatformsList,
  formatRelativeTimeId,
  formatRupiahDonate,
  formatWibMonthLabel,
  getDonorInitials,
  getWibMonthKey,
  normalizeLeaderboardPayload,
} from './donate-logic.js?v=104';
import { refreshMotionEngine } from './motion-engine.js?v=106';

export function createDonateController({ onToast = () => {} } = {}) {
  let mountEl = null;
  let activeTab = 'allTime'; // 'allTime' | 'monthly' | 'recent'
  let platformFilter = 'all'; // 'all' | 'saweria' | 'sociabuzz'
  let searchQuery = '';
  let isLoading = false;
  let hasLoadedOnce = false;
  let lastError = '';
  let pollTimer = null;
  let data = normalizeLeaderboardPayload({
    ok: true,
    summary: {
      totalIdrAllTime: 0,
      totalCountAllTime: 0,
      uniqueDonorsAllTime: 0,
      totalIdrMonth: 0,
      totalCountMonth: 0,
      uniqueDonorsMonth: 0,
      monthKey: getWibMonthKey(),
      monthLabel: formatWibMonthLabel(getWibMonthKey()),
      updatedAt: '',
    },
    allTime: [],
    monthly: [],
    recent: [],
  });

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  function startPolling() {
    stopPolling();
    pollTimer = setInterval(() => {
      if (document.visibilityState === 'visible' && mountEl) {
        fetchLeaderboard({ silent: true });
      }
    }, DONATE_CONFIG.pollIntervalMs);
  }

  async function fetchLeaderboard({ silent = false, showSuccessToast = false } = {}) {
    if (!mountEl) return;
    if (!silent) {
      isLoading = true;
      lastError = '';
      renderDynamicSections();
    }
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);
      const res = await fetch(`${DONATE_CONFIG.leaderboardEndpoint}?limit=50&recentLimit=30`, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const json = await res.json();
      if (!json || json.ok === false) {
        throw new Error(json?.error || 'Data leaderboard belum siap.');
      }
      data = normalizeLeaderboardPayload(json);
      hasLoadedOnce = true;
      lastError = '';
      if (showSuccessToast) {
        onToast('Leaderboard donasi diperbarui.');
      }
    } catch (err) {
      lastError =
        err?.name === 'AbortError'
          ? 'Koneksi ke server leaderboard melebihi batas waktu.'
          : 'Server leaderboard sedang disiapkan atau belum merespons. Coba segarkan beberapa saat lagi.';
    } finally {
      isLoading = false;
      renderDynamicSections();
    }
  }

  function renderSummaryStrip() {
    const s = data.summary;
    const updatedText = hasLoadedOnce && s.updatedAt
      ? `Diperbarui ${formatRelativeTimeId(s.updatedAt)}`
      : isLoading
      ? 'Menyinkronkan data...'
      : 'Menunggu sinkronisasi';

    return `
      <div class="donate-kpi-strip" aria-label="Ringkasan dukungan">
        <div class="donate-kpi-cell">
          <span class="donate-kpi-label">Total Dukungan</span>
          <strong class="donate-kpi-value">${escapeDonateHtml(formatRupiahDonate(s.totalIdrAllTime))}</strong>
          <span class="donate-kpi-sub">${s.totalCountAllTime} transaksi sepanjang waktu</span>
        </div>
        <div class="donate-kpi-cell">
          <span class="donate-kpi-label">Bulan ${escapeDonateHtml(s.monthLabel)}</span>
          <strong class="donate-kpi-value">${escapeDonateHtml(formatRupiahDonate(s.totalIdrMonth))}</strong>
          <span class="donate-kpi-sub">${s.totalCountMonth} dukungan bulan ini</span>
        </div>
        <div class="donate-kpi-cell">
          <span class="donate-kpi-label">Supporter Tercatat</span>
          <strong class="donate-kpi-value">${s.uniqueDonorsAllTime}</strong>
          <span class="donate-kpi-sub">${escapeDonateHtml(updatedText)}</span>
        </div>
      </div>
    `;
  }

  function renderPodium() {
    const board = activeTab === 'monthly' ? data.monthly : data.allTime;
    const scopeLabel = activeTab === 'monthly' ? `Top 3 Bulan ${data.summary.monthLabel}` : 'Top 3 Sepanjang Waktu';

    if (isLoading && !hasLoadedOnce) {
      return `
        <div class="donate-podium-section">
          <div class="donate-section-head">
            <h3 class="donate-section-title">Podium Juara Donatur</h3>
            <span class="donate-section-meta">Memuat peringkat...</span>
          </div>
          <div class="donate-podium-grid">
            <div class="donate-podium-card is-skeleton"><div class="donate-skel-line is-sm"></div><div class="donate-skel-line is-lg"></div><div class="donate-skel-line is-md"></div></div>
            <div class="donate-podium-card is-first is-skeleton"><div class="donate-skel-line is-sm"></div><div class="donate-skel-line is-lg"></div><div class="donate-skel-line is-md"></div></div>
            <div class="donate-podium-card is-skeleton"><div class="donate-skel-line is-sm"></div><div class="donate-skel-line is-lg"></div><div class="donate-skel-line is-md"></div></div>
          </div>
        </div>
      `;
    }

    if (board.length === 0) {
      return `
        <div class="donate-podium-section">
          <div class="donate-section-head">
            <h3 class="donate-section-title">Podium Juara Donatur</h3>
            <span class="donate-section-meta">${escapeDonateHtml(scopeLabel)}</span>
          </div>
          <div class="donate-empty-podium">
            <div class="donate-empty-icon" aria-hidden="true">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
            </div>
            <h4 class="donate-empty-title">Podium ${escapeDonateHtml(activeTab === 'monthly' ? 'Bulan Ini' : 'Utama')} Masih Terbuka</h4>
            <p class="donate-empty-desc">Jadilah supporter pertama yang tercatat di puncak Leaderboard Manifestudio melalui Saweria atau SociaBuzz Tribe. Nama dan dukunganmu masuk otomatis dalam hitungan detik.</p>
            <div class="donate-empty-actions">
              <a class="donate-btn donate-btn-saweria" href="${DONATE_CONFIG.saweriaUrl}" target="_blank" rel="noopener noreferrer">Dukung via Saweria</a>
              <a class="donate-btn donate-btn-sociabuzz" href="${DONATE_CONFIG.sociabuzzUrl}" target="_blank" rel="noopener noreferrer">Dukung via SociaBuzz Tribe</a>
            </div>
          </div>
        </div>
      `;
    }

    // Arrange visual podium order: #2 left, #1 center elevated, #3 right
    const slots = [
      { idx: 1, rankNum: 2, cls: 'is-second', medal: 'Peringkat #2' },
      { idx: 0, rankNum: 1, cls: 'is-first', medal: 'Juara #1' },
      { idx: 2, rankNum: 3, cls: 'is-third', medal: 'Peringkat #3' },
    ];

    const cardsHtml = slots
      .map((slot) => {
        const entry = board[slot.idx];
        if (!entry) {
          return `
            <div class="donate-podium-card ${slot.cls} is-open-slot">
              <div class="donate-podium-rank">${slot.medal}</div>
              <div class="donate-avatar is-muted">#${slot.rankNum}</div>
              <div class="donate-podium-name">Slot Terbuka</div>
              <div class="donate-podium-amount">—</div>
              <div class="donate-podium-meta">Menunggu supporter berikutnya</div>
            </div>
          `;
        }
        const quote = entry.latestMessage
          ? `<p class="donate-podium-msg">"${escapeDonateHtml(entry.latestMessage)}"</p>`
          : '<p class="donate-podium-msg is-empty">Terima kasih atas dukungannya untuk Manifestudio.</p>';
        return `
          <article class="donate-podium-card ${slot.cls}" aria-label="${slot.medal} ${escapeDonateHtml(entry.donorName)}">
            <div class="donate-podium-rank">${slot.medal}</div>
            <div class="donate-avatar ${slot.cls}" aria-hidden="true">${escapeDonateHtml(getDonorInitials(entry.donorName))}</div>
            <h4 class="donate-podium-name">${escapeDonateHtml(entry.donorName)}</h4>
            <div class="donate-podium-amount">${escapeDonateHtml(formatRupiahDonate(entry.totalIdr))}</div>
            <div class="donate-podium-meta">
              <span>${escapeDonateHtml(formatPlatformsList(entry.platforms))}</span>
              <span aria-hidden="true">·</span>
              <span>${entry.donationCount}x donasi</span>
            </div>
            ${quote}
          </article>
        `;
      })
      .join('');

    return `
      <div class="donate-podium-section">
        <div class="donate-section-head">
          <h3 class="donate-section-title">Podium Juara Donatur</h3>
          <span class="donate-section-meta">${escapeDonateHtml(scopeLabel)} · Total digabungkan per nama donatur</span>
        </div>
        <div class="donate-podium-grid">${cardsHtml}</div>
      </div>
    `;
  }

  function renderBoardRows() {
    if (isLoading && !hasLoadedOnce) {
      return `
        <div class="donate-list-skeleton">
          ${Array.from({ length: 5 })
            .map(() => '<div class="donate-list-skel-row"><div class="donate-skel-line is-sm"></div><div class="donate-skel-line is-lg"></div><div class="donate-skel-line is-md"></div></div>')
            .join('')}
        </div>
      `;
    }

    if (activeTab === 'recent') {
      const filteredRecent = filterLeaderboardEntries(data.recent, {
        query: searchQuery,
        platform: platformFilter,
      });
      if (filteredRecent.length === 0) {
        return `<div class="donate-list-empty">${
          searchQuery || platformFilter !== 'all'
            ? 'Tidak ada donasi terbaru yang cocok dengan pencarian atau filter platform ini.'
            : 'Belum ada riwayat donasi masuk. Setiap dukungan baru dari Saweria maupun SociaBuzz Tribe akan tampil langsung di sini.'
        }</div>`;
      }

      return `
        <div class="donate-feed-list" role="list">
          ${filteredRecent
            .map((item) => {
              const showFxNote = item.originalCurrency && item.originalCurrency !== 'IDR';
              const fxText = showFxNote
                ? `${formatOriginalCurrency(item.originalAmount, item.originalCurrency)} → ${formatRupiahDonate(item.amountIdr)}`
                : formatRupiahDonate(item.amountIdr);
              return `
                <article class="donate-feed-row" role="listitem">
                  <div class="donate-avatar is-compact" aria-hidden="true">${escapeDonateHtml(getDonorInitials(item.donorName))}</div>
                  <div class="donate-feed-body">
                    <div class="donate-feed-top">
                      <span class="donate-row-name">${escapeDonateHtml(item.donorName)}</span>
                      <span class="donate-row-meta">
                        ${escapeDonateHtml(formatPlatformLabel(item.platform))}
                        <span aria-hidden="true">·</span>
                        ${escapeDonateHtml(formatRelativeTimeId(item.createdAt))}
                      </span>
                    </div>
                    ${
                      item.message
                        ? `<p class="donate-row-msg">${escapeDonateHtml(item.message)}</p>`
                        : '<p class="donate-row-msg is-empty">Mengirimkan dukungan tanpa pesan tambahan.</p>'
                    }
                  </div>
                  <div class="donate-feed-amount">
                    <strong>${escapeDonateHtml(formatRupiahDonate(item.amountIdr))}</strong>
                    ${showFxNote ? `<span class="donate-fx-sub">${escapeDonateHtml(fxText)}</span>` : ''}
                  </div>
                </article>
              `;
            })
            .join('')}
        </div>
      `;
    }

    const sourceList = activeTab === 'monthly' ? data.monthly : data.allTime;
    const filtered = filterLeaderboardEntries(sourceList, {
      query: searchQuery,
      platform: platformFilter,
    });

    if (filtered.length === 0) {
      return `<div class="donate-list-empty">${
        searchQuery || platformFilter !== 'all'
          ? 'Tidak ada donatur yang cocok dengan pencarian atau filter platform ini.'
          : 'Belum ada peringkat tercatat untuk periode ini.'
      }</div>`;
    }

    return `
      <div class="donate-rank-table" role="table" aria-label="Daftar Peringkat Donatur">
        <div class="donate-rank-head" role="row">
          <span role="columnheader" class="col-rank">#</span>
          <span role="columnheader" class="col-donor">Donatur & Pesan</span>
          <span role="columnheader" class="col-platform">Platform</span>
          <span role="columnheader" class="col-amount">Total (IDR)</span>
        </div>
        ${filtered
          .map((row) => {
            const rankClass =
              row.rank === 1 ? 'is-gold' : row.rank === 2 ? 'is-silver' : row.rank === 3 ? 'is-bronze' : '';
            return `
              <div class="donate-rank-row" role="row">
                <span role="cell" class="col-rank">
                  <span class="donate-rank-num ${rankClass}">#${row.rank}</span>
                </span>
                <div role="cell" class="col-donor">
                  <div class="donate-donor-cell">
                    <div class="donate-avatar is-compact ${rankClass}" aria-hidden="true">${escapeDonateHtml(getDonorInitials(row.donorName))}</div>
                    <div class="donate-donor-text">
                      <div class="donate-row-name">${escapeDonateHtml(row.donorName)}</div>
                      <div class="donate-row-sub">
                        ${row.donationCount}x donasi
                        ${row.latestAt ? `<span aria-hidden="true">·</span> ${escapeDonateHtml(formatRelativeTimeId(row.latestAt))}` : ''}
                      </div>
                      ${row.latestMessage ? `<p class="donate-row-msg">${escapeDonateHtml(row.latestMessage)}</p>` : ''}
                    </div>
                  </div>
                </div>
                <span role="cell" class="col-platform">${escapeDonateHtml(formatPlatformsList(row.platforms))}</span>
                <span role="cell" class="col-amount">${escapeDonateHtml(formatRupiahDonate(row.totalIdr))}</span>
              </div>
            `;
          })
          .join('')}
      </div>
    `;
  }

  function renderDynamicSections() {
    if (!mountEl) return;
    const summaryEl = mountEl.querySelector('#donate-summary-mount');
    const podiumEl = mountEl.querySelector('#donate-podium-mount');
    const listEl = mountEl.querySelector('#donate-list-mount');
    const errorEl = mountEl.querySelector('#donate-error-banner');
    const refreshBtn = mountEl.querySelector('#donate-refresh-btn');

    if (summaryEl) summaryEl.innerHTML = renderSummaryStrip();
    if (podiumEl) podiumEl.innerHTML = renderPodium();
    if (listEl) listEl.innerHTML = renderBoardRows();

    if (errorEl) {
      if (lastError) {
        errorEl.hidden = false;
        errorEl.innerHTML = `
          <span>${escapeDonateHtml(lastError)}</span>
          <button type="button" class="donate-retry-btn" data-donate-retry="1">Coba Lagi</button>
        `;
      } else {
        errorEl.hidden = true;
        errorEl.innerHTML = '';
      }
    }

    if (refreshBtn) {
      refreshBtn.disabled = isLoading;
      refreshBtn.textContent = isLoading ? 'Memuat...' : 'Segarkan';
    }

    // Sync active tab & filter button states
    mountEl.querySelectorAll('[data-donate-tab]').forEach((btn) => {
      const active = btn.getAttribute('data-donate-tab') === activeTab;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    mountEl.querySelectorAll('[data-donate-platform]').forEach((btn) => {
      const active = btn.getAttribute('data-donate-platform') === platformFilter;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });

    refreshMotionEngine(mountEl, { immediateCards: true });
  }

  function renderShell() {
    if (!mountEl) return;
    mountEl.innerHTML = `
      <div class="donate-shell">
        <section class="donate-hero-grid" aria-label="Dukungan Saweria dan SociaBuzz Tribe">
          <div class="donate-hero-copy">
            <p class="donate-eyebrow">Saweria · SociaBuzz Tribe · Leaderboard Otomatis</p>
            <h2 class="donate-heading">Dukung Manifestudio Tetap Gratis Tanpa Login</h2>
            <p class="donate-lead">
              Setiap dukungan melalui Saweria atau SociaBuzz Tribe langsung tercatat otomatis ke Leaderboard Top Donatur dalam hitungan detik. Donasi berulang dengan nama yang sama akan otomatis dijumlahkan, dan dukungan mata uang asing di SociaBuzz dikonversi ke Rupiah (IDR).
            </p>
            <div class="donate-cta-row">
              <a class="donate-btn donate-btn-saweria" href="${DONATE_CONFIG.saweriaUrl}" target="_blank" rel="noopener noreferrer">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
                <span>Donasi via Saweria</span>
              </a>
              <a class="donate-btn donate-btn-sociabuzz" href="${DONATE_CONFIG.sociabuzzUrl}" target="_blank" rel="noopener noreferrer">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
                <span>Donasi via SociaBuzz Tribe</span>
              </a>
            </div>
            <p class="donate-method-note">
              Mendukung QRIS, GoPay, OVO, DANA, ShopeePay, Transfer Bank, hingga pembayaran internasional · Pesan otomatis dimoderasi dari kata kasar & tautan spam.
            </p>
          </div>

          <div class="donate-hero-stats">
            <div id="donate-summary-mount"></div>
            <div class="donate-refresh-row">
              <span class="donate-refresh-hint">Sinkron otomatis setiap 20 detik</span>
              <button type="button" id="donate-refresh-btn" class="donate-refresh-btn">Segarkan</button>
            </div>
          </div>
        </section>

        <div id="donate-error-banner" class="donate-error-banner" role="alert" hidden></div>

        <section id="donate-podium-mount" aria-label="Podium Top 3 Donatur"></section>

        <section class="donate-board-section" aria-label="Papan Peringkat dan Donasi Terbaru">
          <div class="donate-toolbar">
            <div class="donate-tabs" role="tablist" aria-label="Periode Leaderboard">
              <button type="button" role="tab" class="donate-tab is-active" data-donate-tab="allTime" aria-selected="true">Sepanjang Waktu</button>
              <button type="button" role="tab" class="donate-tab" data-donate-tab="monthly" aria-selected="false">Bulan Ini</button>
              <button type="button" role="tab" class="donate-tab" data-donate-tab="recent" aria-selected="false">Donasi Terbaru</button>
            </div>

            <div class="donate-filters">
              <div class="donate-search-wrap">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                <input
                  type="search"
                  id="donate-search-input"
                  class="donate-search-input"
                  placeholder="Cari nama donatur atau pesan..."
                  autocomplete="off"
                  value="${escapeDonateHtml(searchQuery)}"
                  aria-label="Cari nama donatur atau pesan"
                />
              </div>
              <div class="donate-platform-filter" role="group" aria-label="Filter platform">
                <button type="button" class="donate-pf-btn is-active" data-donate-platform="all" aria-pressed="true">Semua</button>
                <button type="button" class="donate-pf-btn" data-donate-platform="saweria" aria-pressed="false">Saweria</button>
                <button type="button" class="donate-pf-btn" data-donate-platform="sociabuzz" aria-pressed="false">SociaBuzz</button>
              </div>
            </div>
          </div>

          <div id="donate-list-mount" class="donate-list-wrap"></div>
        </section>
      </div>
    `;

    bindEvents();
    renderDynamicSections();
  }

  function bindEvents() {
    if (!mountEl) return;

    mountEl.addEventListener('click', (e) => {
      const tabBtn = e.target.closest('[data-donate-tab]');
      if (tabBtn) {
        const nextTab = tabBtn.getAttribute('data-donate-tab');
        if (nextTab && nextTab !== activeTab) {
          activeTab = nextTab;
          renderDynamicSections();
        }
        return;
      }

      const pfBtn = e.target.closest('[data-donate-platform]');
      if (pfBtn) {
        const nextPf = pfBtn.getAttribute('data-donate-platform');
        if (nextPf && nextPf !== platformFilter) {
          platformFilter = nextPf;
          renderDynamicSections();
        }
        return;
      }

      if (e.target.closest('#donate-refresh-btn') || e.target.closest('[data-donate-retry]')) {
        fetchLeaderboard({ silent: false, showSuccessToast: true });
      }
    });

    const searchInput = mountEl.querySelector('#donate-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        searchQuery = String(e.target.value || '');
        renderDynamicSections();
      });
    }
  }

  return {
    mount(el) {
      if (!el) return;
      mountEl = el;
      renderShell();
      fetchLeaderboard({ silent: false });
      startPolling();
    },
    unmount() {
      stopPolling();
      mountEl = null;
    },
    redrawTheme() {
      // Uses CSS variables directly; no canvas redraw needed
    },
  };
}
