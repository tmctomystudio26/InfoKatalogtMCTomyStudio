import {
  CATALOG_PREVIEW_STORAGE_KEY,
  getDefaultCatalogSnapshot,
  loadCatalogData,
} from './data.js';
import {
  formatRupiah,
  slugifyId,
  toggleProductStockInCatalog,
  upsertProductInCatalog,
} from './store.js';
import {
  decryptVault,
  encryptVault,
  verifyGitHubTokenAccess,
} from './vault.js';

const THEME_STORAGE_KEY = 'manifestudio_theme_v1';
const ADMIN_VAULT_STORAGE_KEY = 'manifestudio_admin_vault_v1';
const LEGACY_GH_STORAGE_KEY = 'manifestudio_admin_gh_v1';

const adminState = {
  theme: 'dark',
  unlocked: false,
  confirmResetVault: false,
  catalog: getDefaultCatalogSnapshot(),
  source: 'fallback',
  activeTab: 'products',
  searchQuery: '',
  dirty: false,
  confirmDeleteProductId: null,
  remoteSha: null,
  ghConfig: {
    owner: '',
    repo: '',
    branch: 'main',
    token: '',
  },
};

function escapeHtml(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function encodeBase64Utf8(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decodeBase64Utf8(base64Text) {
  const clean = String(base64Text || '').replace(/\s+/g, '');
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

let toastTimer = null;
function showToast(message) {
  const toast = document.getElementById('toast-notification');
  if (!toast) return;
  toast.textContent = message;
  toast.hidden = false;
  toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('is-visible');
    toast.hidden = true;
  }, 2800);
}

function setStatusBox(id, message, tone = 'info') {
  const box = document.getElementById(id);
  if (!box) return;
  if (!message) {
    box.hidden = true;
    box.textContent = '';
    box.className = 'admin-status-box';
    return;
  }
  box.hidden = false;
  box.textContent = message;
  box.className = `admin-status-box is-${tone}`;
}

function loadTheme() {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') {
      adminState.theme = saved;
    } else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
      adminState.theme = 'light';
    }
  } catch {
    // Ignore
  }
}

function applyTheme() {
  document.documentElement.setAttribute('data-theme', adminState.theme);
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.setAttribute('content', adminState.theme === 'dark' ? '#090D16' : '#F8FAFC');
  }
  const btn = document.getElementById('theme-toggle-btn');
  if (btn) {
    const isDark = adminState.theme === 'dark';
    btn.setAttribute('aria-label', isDark ? 'Aktifkan mode terang' : 'Aktifkan mode gelap');
    btn.innerHTML = isDark
      ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg><span class="hide-xs">Terang</span>`
      : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg><span class="hide-xs">Gelap</span>`;
  }
}

function getStoredVaultRecord() {
  try {
    // Purge any legacy unencrypted config immediately if present
    localStorage.removeItem(LEGACY_GH_STORAGE_KEY);
    const raw = localStorage.getItem(ADMIN_VAULT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && parsed.v === 1 && parsed.ct ? parsed : null;
  } catch {
    return null;
  }
}

function renderGateScreen() {
  const lockScreen = document.getElementById('admin-lock-screen');
  const dashboard = document.getElementById('admin-dashboard');
  const lockBtn = document.getElementById('lock-vault-btn');
  const unlockForm = document.getElementById('unlock-vault-form');
  const setupForm = document.getElementById('setup-vault-form');
  const resetBtn = document.getElementById('reset-vault-btn');

  if (!lockScreen || !dashboard) return;

  if (adminState.unlocked) {
    lockScreen.hidden = true;
    dashboard.hidden = false;
    if (lockBtn) lockBtn.hidden = false;

    const repoLabel = document.getElementById('connected-repo-label');
    if (repoLabel) {
      repoLabel.textContent = `${adminState.ghConfig.owner}/${adminState.ghConfig.repo} (${adminState.ghConfig.branch})`;
    }
    return;
  }

  lockScreen.hidden = false;
  dashboard.hidden = true;
  if (lockBtn) lockBtn.hidden = true;

  // Clear rendered sensitive lists when locked
  const prodList = document.getElementById('admin-product-list');
  const voucherList = document.getElementById('admin-voucher-list');
  if (prodList) prodList.innerHTML = '';
  if (voucherList) voucherList.innerHTML = '';

  const hasVault = Boolean(getStoredVaultRecord());
  if (unlockForm) unlockForm.hidden = !hasVault;
  if (setupForm) setupForm.hidden = hasVault;
  if (resetBtn) {
    resetBtn.textContent = adminState.confirmResetVault
      ? 'Konfirmasi Reset Brankas'
      : 'Ganti Token / Reset Brankas';
    resetBtn.classList.toggle('is-danger-confirm', adminState.confirmResetVault);
  }
}

function lockVaultSession() {
  adminState.unlocked = false;
  adminState.ghConfig = { owner: '', repo: '', branch: 'main', token: '' };
  adminState.confirmResetVault = false;
  const unlockInput = document.getElementById('unlock-password');
  if (unlockInput) unlockInput.value = '';
  setStatusBox('lock-status-box', '');
  renderGateScreen();
  showToast('Brankas Admin dikunci.');
}

async function openUnlockedDashboard() {
  adminState.unlocked = true;
  renderGateScreen();

  const loaded = await loadCatalogData({ allowLocalPreview: true });
  adminState.catalog = loaded.data;
  adminState.source = loaded.source;
  updateSourceBadge();
  renderTabs();
  renderProductList();
  renderVoucherList();
}

function updateSourceBadge() {
  const badge = document.getElementById('admin-source-badge');
  if (!badge) return;
  if (adminState.dirty) {
    badge.textContent = 'Ada perubahan belum dipublikasikan';
    badge.className = 'admin-badge is-warn';
    return;
  }
  if (adminState.source === 'preview') {
    badge.textContent = 'Pratinjau Lokal Aktif';
    badge.className = 'admin-badge is-warn';
  } else if (adminState.source === 'github') {
    badge.textContent = 'Sinkron dari GitHub';
    badge.className = 'admin-badge is-ok';
  } else if (adminState.source === 'remote') {
    badge.textContent = 'Katalog Live (catalog.json)';
    badge.className = 'admin-badge is-ok';
  } else {
    badge.textContent = 'Data Bawaan';
    badge.className = 'admin-badge';
  }
}

function markDirty() {
  adminState.dirty = true;
  updateSourceBadge();
}

function renderTabs() {
  document.querySelectorAll('[data-admin-tab]').forEach((btn) => {
    const tab = btn.getAttribute('data-admin-tab');
    const active = tab === adminState.activeTab;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-selected', String(active));
  });

  const panelMap = {
    products: 'panel-products',
    add: 'panel-add',
    vouchers: 'panel-vouchers',
  };
  Object.entries(panelMap).forEach(([tab, id]) => {
    const panel = document.getElementById(id);
    if (panel) panel.hidden = tab !== adminState.activeTab;
  });
}

function renderProductList() {
  if (!adminState.unlocked) return;
  const container = document.getElementById('admin-product-list');
  const countEl = document.getElementById('admin-product-count');
  if (!container) return;

  const q = adminState.searchQuery.trim().toLowerCase();
  const products = (adminState.catalog.products || []).filter((p) => {
    if (!q) return true;
    const inName = p.name.toLowerCase().includes(q);
    const inTag = (p.tag || '').toLowerCase().includes(q);
    const inVariants = (p.variants || []).some((v) => v.name.toLowerCase().includes(q));
    return inName || inTag || inVariants;
  });

  if (countEl) {
    countEl.textContent = `${products.length} produk ditampilkan`;
  }

  if (products.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <h3>Tidak ada produk yang cocok</h3>
        <p>Ubah kata kunci pencarian atau tambahkan produk baru melalui tab "+ Tambah Produk Baru".</p>
      </div>
    `;
    return;
  }

  container.innerHTML = products
    .map((product) => {
      const variantsHtml = (product.variants || [])
        .map(
          (variant, vIdx) => `
          <div class="admin-variant-row ${variant.outOfStock ? 'is-restock' : ''}">
            <div class="admin-var-fields">
              <div class="form-field">
                <label for="vname-${escapeHtml(product.id)}-${vIdx}">Nama Paket</label>
                <input
                  type="text"
                  id="vname-${escapeHtml(product.id)}-${vIdx}"
                  data-prod-id="${escapeHtml(product.id)}"
                  data-var-idx="${vIdx}"
                  data-field="name"
                  value="${escapeHtml(variant.name)}"
                />
              </div>
              <div class="form-field">
                <label for="vprice-${escapeHtml(product.id)}-${vIdx}">Harga (Rp)</label>
                <input
                  type="number"
                  min="0"
                  step="500"
                  id="vprice-${escapeHtml(product.id)}-${vIdx}"
                  data-prod-id="${escapeHtml(product.id)}"
                  data-var-idx="${vIdx}"
                  data-field="price"
                  value="${Number(variant.price || 0)}"
                />
              </div>
              <div class="form-field">
                <label for="vold-${escapeHtml(product.id)}-${vIdx}">Harga Lama (Opsional)</label>
                <input
                  type="number"
                  min="0"
                  step="500"
                  id="vold-${escapeHtml(product.id)}-${vIdx}"
                  data-prod-id="${escapeHtml(product.id)}"
                  data-var-idx="${vIdx}"
                  data-field="oldPrice"
                  value="${Number(variant.oldPrice || 0)}"
                />
              </div>
            </div>
            <div class="admin-var-actions">
              <label class="stock-filter-label">
                <input
                  type="checkbox"
                  data-prod-id="${escapeHtml(product.id)}"
                  data-var-idx="${vIdx}"
                  data-field="outOfStock"
                  ${variant.outOfStock ? 'checked' : ''}
                />
                <span>Habis</span>
              </label>
              <button
                type="button"
                class="btn btn-ghost btn-sm admin-del-var-btn"
                data-delete-variant="${escapeHtml(product.id)}::${vIdx}"
                aria-label="Hapus varian ${escapeHtml(variant.name)} dari ${escapeHtml(product.name)}"
              >
                Hapus
              </button>
            </div>
          </div>
        `
        )
        .join('');

      const isConfirmingDelete = adminState.confirmDeleteProductId === product.id;

      return `
        <article class="admin-product-card" data-admin-product="${escapeHtml(product.id)}">
          <div class="admin-prod-head">
            <div class="admin-prod-brand">
              <img src="${escapeHtml(product.logo)}" alt="" width="42" height="42" class="modal-logo" />
              <div>
                <h2 class="admin-prod-name">${escapeHtml(product.name)}</h2>
                <span class="admin-prod-meta">ID: ${escapeHtml(product.id)} · ${(product.variants || []).length} varian</span>
              </div>
            </div>
            <div class="admin-prod-controls">
              <button
                type="button"
                class="btn ${product.outOfStock ? 'btn-primary' : 'btn-secondary'} btn-sm"
                data-toggle-stock="${escapeHtml(product.id)}"
              >
                ${product.outOfStock ? 'Aktifkan Semua Stok' : 'Tandai Habis Semua'}
              </button>
              <button
                type="button"
                class="btn btn-ghost btn-sm ${isConfirmingDelete ? 'is-danger-confirm' : ''}"
                data-delete-product="${escapeHtml(product.id)}"
              >
                ${isConfirmingDelete ? 'Konfirmasi Hapus' : 'Hapus Produk'}
              </button>
            </div>
          </div>

          <div class="admin-prod-meta-grid">
            <div class="form-field">
              <label for="ptag-${escapeHtml(product.id)}">Label Tag</label>
              <input
                type="text"
                id="ptag-${escapeHtml(product.id)}"
                data-prod-meta="${escapeHtml(product.id)}"
                data-meta-field="tag"
                value="${escapeHtml(product.tag || '')}"
              />
            </div>
            <div class="form-field">
              <label for="psum-${escapeHtml(product.id)}">Ringkasan</label>
              <input
                type="text"
                id="psum-${escapeHtml(product.id)}"
                data-prod-meta="${escapeHtml(product.id)}"
                data-meta-field="summary"
                value="${escapeHtml(product.summary || '')}"
              />
            </div>
            <div class="form-field">
              <label for="plogo-${escapeHtml(product.id)}">URL / Path Logo</label>
              <input
                type="text"
                id="plogo-${escapeHtml(product.id)}"
                data-prod-meta="${escapeHtml(product.id)}"
                data-meta-field="logo"
                value="${escapeHtml(product.logo || '')}"
              />
            </div>
            <div class="form-field">
              <label for="plogofile-${escapeHtml(product.id)}">Atau Ganti Gambar Logo (File)</label>
              <input
                type="file"
                id="plogofile-${escapeHtml(product.id)}"
                accept="image/*"
                data-prod-file-logo="${escapeHtml(product.id)}"
              />
            </div>
          </div>

          <div class="admin-variant-list">
            ${variantsHtml}
          </div>

          <div class="admin-add-variant-row">
            <input
              type="text"
              placeholder="Nama varian baru (contoh: 6 Bulan Sharing)"
              aria-label="Nama varian baru untuk ${escapeHtml(product.name)}"
              data-new-var-name="${escapeHtml(product.id)}"
            />
            <input
              type="number"
              min="0"
              step="500"
              placeholder="Harga (Rp)"
              aria-label="Harga varian baru untuk ${escapeHtml(product.name)}"
              data-new-var-price="${escapeHtml(product.id)}"
            />
            <button
              type="button"
              class="btn btn-secondary btn-sm"
              data-add-variant="${escapeHtml(product.id)}"
            >
              + Tambah Varian
            </button>
          </div>
        </article>
      `;
    })
    .join('');

  bindProductListEvents(container);
}

function bindProductListEvents(container) {
  container.querySelectorAll('[data-toggle-stock]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const prodId = btn.getAttribute('data-toggle-stock');
      const prod = adminState.catalog.products.find((p) => p.id === prodId);
      if (!prod) return;
      adminState.catalog = toggleProductStockInCatalog(
        adminState.catalog,
        prodId,
        !prod.outOfStock
      );
      markDirty();
      renderProductList();
      showToast(
        !prod.outOfStock
          ? `${prod.name} ditandai habis / restock.`
          : `${prod.name} diaktifkan kembali.`
      );
    });
  });

  container.querySelectorAll('[data-delete-product]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const prodId = btn.getAttribute('data-delete-product');
      if (adminState.confirmDeleteProductId !== prodId) {
        adminState.confirmDeleteProductId = prodId;
        renderProductList();
        return;
      }
      adminState.catalog.products = adminState.catalog.products.filter((p) => p.id !== prodId);
      adminState.confirmDeleteProductId = null;
      markDirty();
      renderProductList();
      showToast('Produk dihapus dari daftar kerja.');
    });
  });

  container.querySelectorAll('[data-prod-meta]').forEach((input) => {
    input.addEventListener('input', (e) => {
      const prodId = input.getAttribute('data-prod-meta');
      const field = input.getAttribute('data-meta-field');
      const prod = adminState.catalog.products.find((p) => p.id === prodId);
      if (!prod || !field) return;
      prod[field] = e.target.value;
      markDirty();
    });
  });

  container.querySelectorAll('[data-prod-file-logo]').forEach((fileInput) => {
    fileInput.addEventListener('change', (e) => {
      const prodId = fileInput.getAttribute('data-prod-file-logo');
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        const base64 = evt.target?.result;
        if (typeof base64 === 'string') {
          const prod = adminState.catalog.products.find((p) => p.id === prodId);
          if (!prod) return;
          prod.logo = base64;
          markDirty();
          renderProductList();
          showToast(`Logo ${prod.name} diperbarui dari file.`);
        }
      };
      reader.readAsDataURL(file);
    });
  });

  container.querySelectorAll('[data-prod-id][data-var-idx]').forEach((input) => {
    const eventType = input.type === 'checkbox' ? 'change' : 'input';
    input.addEventListener(eventType, (e) => {
      const prodId = input.getAttribute('data-prod-id');
      const vIdx = Number(input.getAttribute('data-var-idx'));
      const field = input.getAttribute('data-field');
      const prod = adminState.catalog.products.find((p) => p.id === prodId);
      if (!prod || !prod.variants || !prod.variants[vIdx]) return;

      const variant = prod.variants[vIdx];
      if (field === 'outOfStock') {
        variant.outOfStock = Boolean(e.target.checked);
        const allOut = prod.variants.every((v) => v.outOfStock);
        prod.outOfStock = allOut;
        if (allOut) {
          prod.tag = 'Segera Restock';
          prod.restockMessage = prod.restockMessage || 'Akan segera restock';
        } else if (prod.tag === 'Segera Restock') {
          prod.tag = 'Tersedia';
        }
        renderProductList();
      } else if (field === 'price') {
        variant.price = Math.max(0, Math.round(Number(e.target.value) || 0));
      } else if (field === 'oldPrice') {
        const val = Math.round(Number(e.target.value) || 0);
        if (val > 0) variant.oldPrice = val;
        else delete variant.oldPrice;
      } else if (field === 'name') {
        variant.name = e.target.value;
      }
      markDirty();
    });
  });

  container.querySelectorAll('[data-delete-variant]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const [prodId, idxStr] = (btn.getAttribute('data-delete-variant') || '').split('::');
      const prod = adminState.catalog.products.find((p) => p.id === prodId);
      if (!prod || !Array.isArray(prod.variants)) return;
      if (prod.variants.length <= 1) {
        showToast('Minimal harus tersisa 1 varian pada setiap produk.');
        return;
      }
      prod.variants.splice(Number(idxStr), 1);
      prod.outOfStock = prod.variants.every((v) => v.outOfStock);
      markDirty();
      renderProductList();
      showToast('Varian dihapus.');
    });
  });

  container.querySelectorAll('[data-add-variant]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const prodId = btn.getAttribute('data-add-variant');
      const prod = adminState.catalog.products.find((p) => p.id === prodId);
      if (!prod) return;
      const nameInput = container.querySelector(`[data-new-var-name="${prodId}"]`);
      const priceInput = container.querySelector(`[data-new-var-price="${prodId}"]`);
      const name = nameInput?.value.trim() || '';
      const price = Math.max(0, Math.round(Number(priceInput?.value) || 0));
      if (!name) {
        showToast('Masukkan nama varian baru terlebih dahulu.');
        return;
      }
      prod.variants.push({
        id: `${slugifyId(prodId)}-${Date.now().toString(36).slice(-4)}`,
        name,
        price,
        outOfStock: false,
      });
      prod.outOfStock = false;
      if (prod.tag === 'Segera Restock') prod.tag = 'Tersedia';
      markDirty();
      renderProductList();
      showToast(`Varian "${name}" ditambahkan ke ${prod.name}.`);
    });
  });
}

function renderVoucherList() {
  if (!adminState.unlocked) return;
  const container = document.getElementById('admin-voucher-list');
  if (!container) return;

  const vouchers = adminState.catalog.vouchers || [];
  if (vouchers.length === 0) {
    container.innerHTML = `<p class="admin-subtitle">Belum ada voucher terdaftar.</p>`;
    return;
  }

  container.innerHTML = vouchers
    .map(
      (v, idx) => `
      <div class="admin-voucher-row">
        <div>
          <strong class="mono-num">${escapeHtml(v.code)}</strong>
          <div class="admin-prod-meta">
            ${escapeHtml(v.label || (v.type === 'percent' ? `Diskon ${v.value}%` : `Potongan ${formatRupiah(v.value)}`))}
            · Min. ${escapeHtml(formatRupiah(v.minSubtotal || 0))}
          </div>
        </div>
        <button
          type="button"
          class="btn btn-ghost btn-sm"
          data-remove-voucher="${idx}"
          aria-label="Hapus voucher ${escapeHtml(v.code)}"
        >
          Hapus
        </button>
      </div>
    `
    )
    .join('');

  container.querySelectorAll('[data-remove-voucher]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.getAttribute('data-remove-voucher'));
      adminState.catalog.vouchers.splice(idx, 1);
      markDirty();
      renderVoucherList();
      showToast('Voucher dihapus.');
    });
  });
}

async function pullFromGitHub() {
  if (!adminState.unlocked) return;
  const { owner, repo, branch, token } = adminState.ghConfig;
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/data/catalog.json?ref=${encodeURIComponent(branch)}`;

  const headers = { Accept: 'application/vnd.github+json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  setStatusBox('admin-status-box', 'Mengambil data terbaru dari GitHub...', 'info');
  try {
    const res = await fetch(url, { headers, cache: 'no-store' });
    if (!res.ok) {
      throw new Error(`GitHub HTTP ${res.status}`);
    }
    const payload = await res.json();
    const decoded = decodeBase64Utf8(payload.content);
    const parsed = JSON.parse(decoded);
    if (!parsed || !Array.isArray(parsed.products)) {
      throw new Error('Format catalog.json tidak valid.');
    }
    adminState.catalog = parsed;
    adminState.remoteSha = payload.sha || null;
    adminState.source = 'github';
    adminState.dirty = false;
    updateSourceBadge();
    renderProductList();
    renderVoucherList();
    setStatusBox('admin-status-box', 'Berhasil memuat katalog terbaru langsung dari GitHub.', 'ok');
    showToast('Katalog berhasil disinkronkan dari GitHub.');
  } catch (err) {
    setStatusBox(
      'admin-status-box',
      `Gagal memuat dari GitHub (${err.message}).`,
      'error'
    );
  }
}

async function publishToGitHub() {
  if (!adminState.unlocked) return;
  const { owner, repo, branch, token } = adminState.ghConfig;
  if (!token) {
    setStatusBox('admin-status-box', 'Sesi token kosong. Kunci lalu buka kembali brankas Anda.', 'error');
    return;
  }

  const endpoint = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/data/catalog.json`;
  const headers = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  setStatusBox('admin-status-box', 'Mempublikasikan perubahan ke GitHub Pages...', 'info');
  try {
    const getRes = await fetch(`${endpoint}?ref=${encodeURIComponent(branch)}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    });

    let latestSha = adminState.remoteSha;
    if (getRes.ok) {
      const currentMeta = await getRes.json();
      latestSha = currentMeta.sha || latestSha;
    } else if (getRes.status !== 404) {
      throw new Error(`Gagal cek versi file (HTTP ${getRes.status})`);
    }

    const formattedJson = `${JSON.stringify(adminState.catalog, null, 2)}\n`;
    const body = {
      message: 'chore(catalog): update produk, harga, atau stok via Panel Admin',
      content: encodeBase64Utf8(formattedJson),
      branch,
      ...(latestSha ? { sha: latestSha } : {}),
    };

    const putRes = await fetch(endpoint, {
      method: 'PUT',
      headers,
      body: JSON.stringify(body),
    });

    if (!putRes.ok) {
      const errData = await putRes.json().catch(() => ({}));
      throw new Error(errData.message || `GitHub HTTP ${putRes.status}`);
    }

    const putPayload = await putRes.json();
    adminState.remoteSha = putPayload.content?.sha || latestSha;
    adminState.source = 'github';
    adminState.dirty = false;
    try {
      localStorage.removeItem(CATALOG_PREVIEW_STORAGE_KEY);
    } catch {
      // Ignore
    }
    updateSourceBadge();
    setStatusBox(
      'admin-status-box',
      'Berhasil dipublikasikan ke GitHub! GitHub Pages otomatis memperbarui katalog publik dalam ~30 detik.',
      'ok'
    );
    showToast('Perubahan katalog berhasil dipublikasikan ke GitHub.');
  } catch (err) {
    setStatusBox('admin-status-box', `Gagal mempublikasikan: ${err.message}`, 'error');
  }
}

function bindEvents() {
  document.getElementById('theme-toggle-btn')?.addEventListener('click', () => {
    adminState.theme = adminState.theme === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem(THEME_STORAGE_KEY, adminState.theme);
    } catch {
      // Ignore
    }
    applyTheme();
  });

  document.getElementById('lock-vault-btn')?.addEventListener('click', lockVaultSession);

  document.querySelectorAll('[data-toggle-secret]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-toggle-secret');
      const input = targetId ? document.getElementById(targetId) : null;
      if (!input) return;
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      btn.textContent = isPassword ? 'Tutup' : 'Lihat';
    });
  });

  document.getElementById('reset-vault-btn')?.addEventListener('click', () => {
    if (!adminState.confirmResetVault) {
      adminState.confirmResetVault = true;
      renderGateScreen();
      return;
    }
    try {
      localStorage.removeItem(ADMIN_VAULT_STORAGE_KEY);
    } catch {
      // Ignore
    }
    adminState.confirmResetVault = false;
    setStatusBox('lock-status-box', 'Brankas lama dihapus. Silakan verifikasi token untuk setup baru.', 'info');
    renderGateScreen();
  });

  document.getElementById('unlock-vault-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = document.getElementById('unlock-password')?.value || '';
    const vaultRecord = getStoredVaultRecord();
    if (!vaultRecord) {
      renderGateScreen();
      return;
    }

    const submitBtn = document.getElementById('unlock-submit-btn');
    if (submitBtn) submitBtn.disabled = true;
    setStatusBox('lock-status-box', 'Mendekripsi brankas AES-256-GCM...', 'info');

    try {
      const decrypted = await decryptVault(vaultRecord, password);
      if (!decrypted || !decrypted.token || !decrypted.owner || !decrypted.repo) {
        throw new Error('Data brankas tidak lengkap.');
      }
      adminState.ghConfig = {
        owner: decrypted.owner,
        repo: decrypted.repo,
        branch: decrypted.branch || 'main',
        token: decrypted.token,
      };
      setStatusBox('lock-status-box', '');
      await openUnlockedDashboard();
      showToast('Brankas Admin terbuka.');
    } catch (err) {
      setStatusBox('lock-status-box', err.message || 'Password brankas salah.', 'error');
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });

  document.getElementById('setup-vault-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const owner = document.getElementById('setup-owner')?.value.trim() || '';
    const repo = document.getElementById('setup-repo')?.value.trim() || '';
    const branch = document.getElementById('setup-branch')?.value.trim() || 'main';
    const token = document.getElementById('setup-token')?.value.trim() || '';
    const password = document.getElementById('setup-password')?.value || '';

    if (password.length < 6) {
      setStatusBox('lock-status-box', 'Password brankas minimal 6 karakter.', 'error');
      return;
    }

    const submitBtn = document.getElementById('setup-submit-btn');
    if (submitBtn) submitBtn.disabled = true;
    setStatusBox('lock-status-box', 'Memverifikasi izin tulis Token GitHub...', 'info');

    try {
      const verification = await verifyGitHubTokenAccess({ owner, repo, token });
      if (!verification.ok) {
        setStatusBox('lock-status-box', verification.error, 'error');
        return;
      }

      const encryptedVault = await encryptVault({ owner, repo, branch, token }, password);
      localStorage.setItem(ADMIN_VAULT_STORAGE_KEY, JSON.stringify(encryptedVault));
      adminState.ghConfig = { owner, repo, branch, token };
      e.target.reset();
      setStatusBox('lock-status-box', '');
      await openUnlockedDashboard();
      showToast('Token terverifikasi & dienkripsi ke brankas.');
    } catch (err) {
      setStatusBox(
        'lock-status-box',
        err.message || 'Gagal mengenkripsi brankas admin.',
        'error'
      );
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });

  document.getElementById('pull-github-btn')?.addEventListener('click', pullFromGitHub);
  document.getElementById('publish-github-btn')?.addEventListener('click', publishToGitHub);

  document.getElementById('save-preview-btn')?.addEventListener('click', () => {
    if (!adminState.unlocked) return;
    try {
      localStorage.setItem(CATALOG_PREVIEW_STORAGE_KEY, JSON.stringify(adminState.catalog));
      adminState.source = 'preview';
      adminState.dirty = false;
      updateSourceBadge();
      setStatusBox(
        'admin-status-box',
        'Pratinjau lokal tersimpan. Klik "Toko" untuk mengetes perubahan sebelum publish ke GitHub.',
        'ok'
      );
      showToast('Pratinjau lokal disimpan.');
    } catch {
      setStatusBox('admin-status-box', 'Penyimpanan browser dibatasi — gunakan Unduh catalog.json.', 'error');
    }
  });

  document.getElementById('clear-preview-btn')?.addEventListener('click', async () => {
    if (!adminState.unlocked) return;
    try {
      localStorage.removeItem(CATALOG_PREVIEW_STORAGE_KEY);
    } catch {
      // Ignore
    }
    const fresh = await loadCatalogData({ allowLocalPreview: false });
    adminState.catalog = fresh.data;
    adminState.source = fresh.source;
    adminState.dirty = false;
    updateSourceBadge();
    renderProductList();
    renderVoucherList();
    setStatusBox('admin-status-box', 'Pratinjau lokal dihapus — kembali mengikuti catalog.json live.', 'info');
    showToast('Pratinjau lokal dihapus.');
  });

  document.getElementById('download-json-btn')?.addEventListener('click', () => {
    if (!adminState.unlocked) return;
    const formatted = `${JSON.stringify(adminState.catalog, null, 2)}\n`;
    const blob = new Blob([formatted], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'catalog.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast('File catalog.json diunduh.');
  });

  document.querySelectorAll('[data-admin-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      adminState.activeTab = btn.getAttribute('data-admin-tab') || 'products';
      renderTabs();
    });
  });

  document.getElementById('admin-product-search')?.addEventListener('input', (e) => {
    adminState.searchQuery = e.target.value;
    renderProductList();
  });

  const presetEl = document.getElementById('new-prod-logo-preset');
  const logoUrlEl = document.getElementById('new-prod-logo-url');
  const newProdFileEl = document.getElementById('new-prod-logo-file');

  presetEl?.addEventListener('change', () => {
    if (logoUrlEl && presetEl.value) {
      logoUrlEl.value = presetEl.value;
    }
  });

  newProdFileEl?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const base64 = evt.target?.result;
      if (typeof base64 === 'string' && logoUrlEl) {
        logoUrlEl.value = base64;
        showToast('File logo produk baru siap digunakan.');
      }
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('add-product-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!adminState.unlocked) return;
    const name = document.getElementById('new-prod-name')?.value.trim() || '';
    const category = document.getElementById('new-prod-category')?.value || 'streaming';
    const logo =
      document.getElementById('new-prod-logo-url')?.value.trim() ||
      './assets/logos/custom-request.svg';
    const tag = document.getElementById('new-prod-tag')?.value.trim() || 'Tersedia';
    const summary = document.getElementById('new-prod-summary')?.value.trim() || '';
    const variantName = document.getElementById('new-prod-variant-name')?.value.trim() || '';
    const variantPrice = Number(document.getElementById('new-prod-variant-price')?.value || 0);

    try {
      adminState.catalog = upsertProductInCatalog(adminState.catalog, {
        name,
        category,
        logo,
        tag,
        summary,
        variants: [{ name: variantName, price: variantPrice, outOfStock: false }],
      });
      markDirty();
      e.target.reset();
      if (logoUrlEl) logoUrlEl.value = './assets/logos/custom-request.svg';
      adminState.activeTab = 'products';
      adminState.searchQuery = '';
      const searchEl = document.getElementById('admin-product-search');
      if (searchEl) searchEl.value = '';
      renderTabs();
      renderProductList();
      showToast(`Produk "${name}" berhasil ditambahkan ke katalog.`);
    } catch (err) {
      showToast(err.message || 'Periksa kembali input produk baru.');
    }
  });

  document.getElementById('add-voucher-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!adminState.unlocked) return;
    const code = (document.getElementById('new-voucher-code')?.value || '').trim().toUpperCase();
    const type = document.getElementById('new-voucher-type')?.value || 'fixed';
    const value = Math.max(1, Math.round(Number(document.getElementById('new-voucher-value')?.value) || 0));
    const minSubtotal = Math.max(0, Math.round(Number(document.getElementById('new-voucher-min')?.value) || 0));

    if (!code) {
      showToast('Kode voucher tidak boleh kosong.');
      return;
    }

    const label =
      type === 'percent'
        ? `Diskon ${value}% (min. ${formatRupiah(minSubtotal)})`
        : `Potongan ${formatRupiah(value)} (min. ${formatRupiah(minSubtotal)})`;

    adminState.catalog.vouchers = [
      ...(adminState.catalog.vouchers || []).filter((v) => v.code !== code),
      { code, type, value, minSubtotal, label },
    ];
    markDirty();
    e.target.reset();
    renderVoucherList();
    showToast(`Voucher ${code} ditambahkan.`);
  });
}

function bootstrapAdmin() {
  loadTheme();
  applyTheme();
  bindEvents();
  renderGateScreen();
}

bootstrapAdmin();
