import {
  CATALOG_PREVIEW_STORAGE_KEY,
  getDefaultCatalogSnapshot,
  loadCatalogData,
} from './data.js';
import {
  MAX_HISTORY_LOGS,
  appendCatalogHistory,
  collectAllActiveUploadLogoPaths,
  collectOrphanedUploadLogos,
  deleteCategoryFromCatalog,
  deleteFaqFromCatalog,
  deleteSocialFromCatalog,
  describeCatalogChanges,
  extractManagedUploadLogoPath,
  formatRupiah,
  getProductCardTone,
  moveProductInCatalog,
  normalizeBrandConfig,
  pruneCatalogHistory,
  reorderProductToIndex,
  slugifyId,
  summarizeCatalogDiff,
  syncPaymentOptionsWithBrand,
  toggleProductStockInCatalog,
  upsertCategoryInCatalog,
  upsertFaqInCatalog,
  upsertProductInCatalog,
  upsertSocialInCatalog,
} from './store.js';
import {
  decryptVault,
  encryptVault,
  verifyGitHubTokenAccess,
} from './vault.js';

const THEME_STORAGE_KEY = 'manifestudio_theme_v1';
const ADMIN_VAULT_STORAGE_KEY = 'manifestudio_admin_vault_v1';
const LEGACY_GH_STORAGE_KEY = 'manifestudio_admin_gh_v1';
const ADMIN_LOGO_OPS_KEY = 'manifestudio_admin_logo_ops_v1';
const ADMIN_HISTORY_STORAGE_KEY = 'manifestudio_admin_history_v1';

const LOGO_PRESETS = [
  { value: './assets/logos/custom-request.svg', label: 'Ikon Umum / Custom' },
  { value: './assets/logos/netflix.svg', label: 'Netflix' },
  { value: './assets/logos/canva.svg', label: 'Canva' },
  { value: './assets/logos/youtube.svg', label: 'YouTube' },
  { value: './assets/logos/spotify.svg', label: 'Spotify' },
  { value: './assets/logos/viu.svg', label: 'Viu' },
  { value: './assets/logos/vidio.svg', label: 'Vidio' },
  { value: './assets/logos/alight-motion.svg', label: 'Alight Motion' },
  { value: './assets/logos/wetv.svg', label: 'WeTV' },
  { value: './assets/logos/prime-video.svg', label: 'Prime Video' },
];

const SOCIAL_LOGO_PRESETS = [
  { value: './assets/icons/social-whatsapp.svg', label: 'WhatsApp' },
  { value: './assets/icons/social-instagram.svg', label: 'Instagram' },
  { value: './assets/icons/social-tiktok.svg', label: 'TikTok' },
  { value: './assets/icons/social-telegram.svg', label: 'Telegram' },
  { value: './assets/icons/social-globe.svg', label: 'Website / Link Umum' },
];

const adminState = {
  theme: 'dark',
  unlocked: false,
  confirmResetVault: false,
  catalog: getDefaultCatalogSnapshot(),
  baseCatalog: null,
  lastPublishedProducts: [],
  source: 'fallback',
  activeTab: 'products',
  searchQuery: '',
  dirty: false,
  confirmDeleteProductId: null,
  confirmDeleteCategoryId: null,
  remoteSha: null,
  logoEditMode: {}, // { [prodId]: 'upload' | 'link' }
  pendingUploads: {}, // { [key]: { targetPath, base64Content, previewDataUrl, fileName } }
  deletedUploadPaths: [], // managed repo paths queued for deletion on publish
  newProdLogoMode: 'upload',
  newProdPendingUpload: null,
  brandLogoMode: 'upload',
  newSocialPendingUpload: null,
  history: [],
  historySha: null,
  isPublishing: false,
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

function encodeRepoPathSegments(filePath) {
  return String(filePath || '')
    .split('/')
    .filter(Boolean)
    .map((seg) => encodeURIComponent(seg))
    .join('/');
}

function extractPublishedLogoEntries(catalog) {
  const items = (catalog?.products || []).map((p) => ({
    id: p.id,
    logo: p.logo,
  }));
  if (catalog?.brand?.logo) {
    items.push({ id: '__brand_logo__', logo: catalog.brand.logo });
  }
  for (const soc of catalog?.brand?.socials || []) {
    if (soc?.logo) {
      items.push({ id: `__social__${soc.id}`, logo: soc.logo });
    }
  }
  return items;
}

function persistPendingLogoOps() {
  try {
    const payload = {
      deletedUploadPaths: adminState.deletedUploadPaths,
      lastPublishedProducts: adminState.lastPublishedProducts.map((p) => ({
        id: p.id,
        logo: p.logo,
      })),
    };
    localStorage.setItem(ADMIN_LOGO_OPS_KEY, JSON.stringify(payload));
  } catch {
    // Ignore quota limits
  }
}

function restorePendingLogoOps() {
  try {
    const raw = localStorage.getItem(ADMIN_LOGO_OPS_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed?.deletedUploadPaths)) {
      adminState.deletedUploadPaths = [...new Set(parsed.deletedUploadPaths.filter(Boolean))];
    }
    if (Array.isArray(parsed?.lastPublishedProducts) && parsed.lastPublishedProducts.length > 0) {
      adminState.lastPublishedProducts = parsed.lastPublishedProducts;
    }
  } catch {
    // Ignore
  }
}

function clearPendingLogoOps() {
  adminState.pendingUploads = {};
  adminState.deletedUploadPaths = [];
  try {
    localStorage.removeItem(ADMIN_LOGO_OPS_KEY);
  } catch {
    // Ignore
  }
}

function queueManagedLogoForDeletion(logoUrl) {
  const managedPath = extractManagedUploadLogoPath(logoUrl);
  if (!managedPath) return;
  if (!adminState.deletedUploadPaths.includes(managedPath)) {
    adminState.deletedUploadPaths.push(managedPath);
    persistPendingLogoOps();
  }
}

async function compressLogoFile(file) {
  if (!file || !String(file.type || '').startsWith('image/')) {
    throw new Error('Pilih file gambar yang valid (PNG, JPG, WebP, atau SVG).');
  }

  if (file.type === 'image/svg+xml') {
    const text = await file.text();
    const cleanedSvg = text.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
    const base64Content = encodeBase64Utf8(cleanedSvg);
    return {
      ext: 'svg',
      base64Content,
      previewDataUrl: `data:image/svg+xml;base64,${base64Content}`,
    };
  }

  const rawDataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
    reader.readAsDataURL(file);
  });

  try {
    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Format gambar tidak dapat dirender browser.'));
      image.src = rawDataUrl;
    });

    const maxSide = 256;
    const width = Math.max(1, img.naturalWidth || img.width || 256);
    const height = Math.max(1, img.naturalHeight || img.height || 256);
    const scale = Math.min(1, maxSide / Math.max(width, height));
    const targetW = Math.max(1, Math.round(width * scale));
    const targetH = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, targetW, targetH);
      ctx.drawImage(img, 0, 0, targetW, targetH);
      const pngDataUrl = canvas.toDataURL('image/png');
      const base64Content = pngDataUrl.split(',')[1] || '';
      if (base64Content) {
        return {
          ext: 'png',
          base64Content,
          previewDataUrl: pngDataUrl,
        };
      }
    }
  } catch {
    // Fallback to raw data URL if canvas resize unavailable
  }

  const commaIdx = rawDataUrl.indexOf(',');
  const base64Content = commaIdx >= 0 ? rawDataUrl.slice(commaIdx + 1) : '';
  const ext = file.type.includes('jpeg') || file.type.includes('jpg') ? 'jpg' : file.type.includes('webp') ? 'webp' : 'png';
  return {
    ext,
    base64Content,
    previewDataUrl: rawDataUrl,
  };
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

  restorePendingLogoOps();
  loadLocalHistory();
  const loaded = await loadCatalogData({ allowLocalPreview: true });
  adminState.catalog = loaded.data;
  adminState.catalog.brand = normalizeBrandConfig(adminState.catalog.brand || {});
  adminState.catalog.paymentOptions = syncPaymentOptionsWithBrand(
    adminState.catalog.paymentOptions,
    adminState.catalog.brand
  );
  adminState.source = loaded.source;

  const baseLoaded = await loadCatalogData({ allowLocalPreview: false });
  baseLoaded.data.brand = normalizeBrandConfig(baseLoaded.data.brand || {});
  adminState.baseCatalog = structuredClone(baseLoaded.data);

  if (loaded.source !== 'preview' || adminState.lastPublishedProducts.length === 0) {
    adminState.lastPublishedProducts = extractPublishedLogoEntries(baseLoaded.data);
  }

  updateSourceBadge();
  renderTabs();
  renderCategoryOptions();
  renderCategoryList();
  renderBrandSettings();
  renderFaqList();
  renderProductList();
  renderVoucherList();
  renderHistoryList();
  syncNewProductLogoUi();
  pullHistoryFromGitHub().catch(() => {});
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
    categories: 'panel-categories',
    brand: 'panel-brand',
    faq: 'panel-faq',
    vouchers: 'panel-vouchers',
    history: 'panel-history',
  };
  Object.entries(panelMap).forEach(([tab, id]) => {
    const panel = document.getElementById(id);
    if (panel) panel.hidden = tab !== adminState.activeTab;
  });
}

function getAvailableProductCategories() {
  const cats = Array.isArray(adminState.catalog?.categories)
    ? adminState.catalog.categories.filter((c) => c && c.id && c.id !== 'all')
    : [];
  if (cats.length > 0) return cats;
  return [
    { id: 'streaming', label: 'Streaming Film' },
    { id: 'music', label: 'Musik & Hiburan' },
    { id: 'creative', label: 'Desain & Editing' },
    { id: 'custom', label: 'Request & Custom' },
  ];
}

function renderCategoryOptions() {
  const select = document.getElementById('new-prod-category');
  if (!select) return;
  const currentVal = select.value;
  const cats = getAvailableProductCategories();
  select.innerHTML = cats
    .map(
      (cat) =>
        `<option value="${escapeHtml(cat.id)}" ${cat.id === currentVal ? 'selected' : ''}>${escapeHtml(cat.label)}</option>`
    )
    .join('');
}

function renderCategoryList() {
  if (!adminState.unlocked) return;
  const container = document.getElementById('admin-category-list');
  if (!container) return;

  const categories = Array.isArray(adminState.catalog?.categories)
    ? adminState.catalog.categories
    : [];
  const products = Array.isArray(adminState.catalog?.products)
    ? adminState.catalog.products
    : [];

  if (categories.length === 0) {
    container.innerHTML = `<p class="admin-subtitle">Belum ada kategori layanan.</p>`;
    return;
  }

  container.innerHTML = categories
    .map((cat) => {
      const isAll = cat.id === 'all';
      const usedCount = isAll
        ? products.length
        : products.filter((p) => p.category === cat.id).length;
      const isConfirming = adminState.confirmDeleteCategoryId === cat.id;

      return `
        <div class="admin-category-row" data-category-row="${escapeHtml(cat.id)}">
          <div class="admin-category-fields">
            <div class="form-field">
              <label for="cat-label-${escapeHtml(cat.id)}">
                Nama Kategori ${isAll ? '(Tab Semua)' : ''}
              </label>
              <input
                type="text"
                id="cat-label-${escapeHtml(cat.id)}"
                data-edit-cat-label="${escapeHtml(cat.id)}"
                value="${escapeHtml(cat.label || '')}"
              />
            </div>
            <div class="admin-category-meta">
              <span class="admin-badge">ID: ${escapeHtml(cat.id)}</span>
              <span class="admin-prod-meta">${usedCount} produk</span>
            </div>
          </div>
          <div class="admin-category-actions">
            ${
              isAll
                ? '<span class="admin-prod-meta">Tab Utama</span>'
                : `<button
                    type="button"
                    class="btn btn-ghost btn-sm ${isConfirming ? 'is-danger-confirm' : ''}"
                    data-delete-cat="${escapeHtml(cat.id)}"
                  >
                    ${isConfirming ? 'Konfirmasi Hapus' : 'Hapus Kategori'}
                  </button>`
            }
          </div>
        </div>
      `;
    })
    .join('');

  container.querySelectorAll('[data-edit-cat-label]').forEach((input) => {
    input.addEventListener('input', (e) => {
      const catId = input.getAttribute('data-edit-cat-label');
      const target = (adminState.catalog.categories || []).find((c) => c.id === catId);
      if (!target) return;
      const nextVal = e.target.value.trim();
      if (!nextVal) return;
      target.label = nextVal;
      markDirty();
      renderCategoryOptions();
    });
  });

  container.querySelectorAll('[data-delete-cat]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const catId = btn.getAttribute('data-delete-cat');
      if (!catId || catId === 'all') return;
      const editableCats = getAvailableProductCategories();
      if (editableCats.length <= 1) {
        showToast('Minimal harus ada 1 kategori layanan aktif.');
        return;
      }
      if (adminState.confirmDeleteCategoryId !== catId) {
        adminState.confirmDeleteCategoryId = catId;
        renderCategoryList();
        return;
      }
      const deletedCat = (adminState.catalog.categories || []).find((c) => c.id === catId);
      adminState.catalog = deleteCategoryFromCatalog(adminState.catalog, catId);
      adminState.confirmDeleteCategoryId = null;
      markDirty();
      renderCategoryOptions();
      renderCategoryList();
      renderProductList();
      showToast(`Kategori "${deletedCat?.label || catId}" dihapus.`);
    });
  });
}

function syncBrandLogoUi() {
  const brand = normalizeBrandConfig(adminState.catalog.brand || {});
  const mode = adminState.brandLogoMode;
  document.querySelectorAll('[data-brand-logo-mode]').forEach((btn) => {
    const isActive = btn.getAttribute('data-brand-logo-mode') === mode;
    btn.classList.toggle('is-active', isActive);
    btn.setAttribute('aria-pressed', String(isActive));
  });

  const uploadPane = document.getElementById('brand-logo-upload-pane');
  const linkPane = document.getElementById('brand-logo-link-pane');
  if (uploadPane) uploadPane.hidden = mode !== 'upload';
  if (linkPane) linkPane.hidden = mode !== 'link';

  const previewEl = document.getElementById('brand-logo-preview');
  const statusEl = document.getElementById('brand-logo-status');
  const urlInput = document.getElementById('brand-logo-url');
  const pending = adminState.pendingUploads['__brand_logo__'];

  if (previewEl) previewEl.src = brand.logo || './assets/icons/brand-icon.svg';
  const headerLogo = document.querySelector('.site-header .brand-mark');
  if (headerLogo) headerLogo.src = brand.logo || './assets/icons/brand-icon.svg';

  if (urlInput && !String(brand.logo || '').startsWith('data:')) {
    urlInput.value = brand.logo || './assets/icons/brand-icon.svg';
  }
  if (statusEl) {
    if (pending) {
      statusEl.textContent = `File logo brand siap diunggah: ${pending.fileName}`;
    } else if (extractManagedUploadLogoPath(brand.logo)) {
      statusEl.textContent = `Tersimpan di repo: ${extractManagedUploadLogoPath(brand.logo)}`;
    } else {
      statusEl.textContent = `Aktif: ${brand.logo || './assets/icons/brand-icon.svg'}`;
    }
  }
}

function renderSocialList() {
  if (!adminState.unlocked) return;
  const container = document.getElementById('admin-social-list');
  if (!container) return;

  adminState.catalog.brand = normalizeBrandConfig(adminState.catalog.brand || {});
  const socials = adminState.catalog.brand.socials || [];

  if (socials.length === 0) {
    container.innerHTML = `<p class="admin-subtitle">Belum ada kontak / sosial media terdaftar.</p>`;
    return;
  }

  container.innerHTML = socials
    .map((soc) => {
      const pending = adminState.pendingUploads[`__social__${soc.id}`];
      const presetOptions = SOCIAL_LOGO_PRESETS.map(
        (preset) =>
          `<option value="${escapeHtml(preset.value)}" ${soc.logo === preset.value ? 'selected' : ''}>${escapeHtml(preset.label)}</option>`
      ).join('');

      return `
        <div class="admin-social-card" data-social-card="${escapeHtml(soc.id)}">
          <div class="admin-social-top">
            <div class="admin-social-brand">
              <img
                src="${escapeHtml(soc.logo || './assets/icons/social-globe.svg')}"
                alt="Logo ${escapeHtml(soc.label)}"
                width="38"
                height="38"
                class="modal-logo admin-logo-thumb"
                data-social-thumb="${escapeHtml(soc.id)}"
              />
              <div>
                <strong class="admin-social-title" data-social-heading="${escapeHtml(soc.id)}">${escapeHtml(soc.label)}</strong>
                <div class="admin-prod-meta">
                  ${pending ? `File baru: ${escapeHtml(pending.fileName)}` : escapeHtml(soc.url)}
                </div>
              </div>
            </div>
            <button
              type="button"
              class="btn btn-ghost btn-sm"
              data-delete-social="${escapeHtml(soc.id)}"
              aria-label="Hapus kontak ${escapeHtml(soc.label)}"
            >
              Hapus
            </button>
          </div>

          <div class="admin-form-grid">
            <div class="form-field">
              <label for="soc-label-${escapeHtml(soc.id)}">Nama / Label Tombol</label>
              <input
                type="text"
                id="soc-label-${escapeHtml(soc.id)}"
                data-soc-id="${escapeHtml(soc.id)}"
                data-soc-field="label"
                value="${escapeHtml(soc.label || '')}"
              />
            </div>
            <div class="form-field">
              <label for="soc-url-${escapeHtml(soc.id)}">Link URL Tujuan</label>
              <input
                type="text"
                id="soc-url-${escapeHtml(soc.id)}"
                data-soc-id="${escapeHtml(soc.id)}"
                data-soc-field="url"
                value="${escapeHtml(soc.url || '')}"
              />
            </div>
            <div class="form-field">
              <label for="soc-preset-${escapeHtml(soc.id)}">Preset Ikon Sosmed</label>
              <select
                id="soc-preset-${escapeHtml(soc.id)}"
                class="admin-select"
                data-soc-preset="${escapeHtml(soc.id)}"
              >
                <option value="">— Pilih Ikon Sosmed —</option>
                ${presetOptions}
              </select>
            </div>
            <div class="form-field">
              <label for="soc-logo-${escapeHtml(soc.id)}">Path / URL Logo Sosmed</label>
              <input
                type="text"
                id="soc-logo-${escapeHtml(soc.id)}"
                data-soc-id="${escapeHtml(soc.id)}"
                data-soc-field="logo"
                value="${escapeHtml(String(soc.logo || '').startsWith('data:') ? '' : soc.logo || '')}"
                placeholder="./assets/icons/social-..."
              />
            </div>
          </div>

          <div class="admin-file-row">
            <label
              for="soc-file-${escapeHtml(soc.id)}"
              class="btn btn-secondary btn-sm admin-file-trigger"
            >
              Upload Logo Sosmed Baru
            </label>
            <input
              type="file"
              id="soc-file-${escapeHtml(soc.id)}"
              class="visually-hidden-file"
              accept="image/*"
              data-soc-file="${escapeHtml(soc.id)}"
            />
            <span class="admin-prod-meta">Bisa upload logo custom (PNG/JPG/SVG/WebP) atau pilih preset di atas.</span>
          </div>
        </div>
      `;
    })
    .join('');

  container.querySelectorAll('[data-soc-id]').forEach((input) => {
    input.addEventListener('input', (e) => {
      const socId = input.getAttribute('data-soc-id');
      const field = input.getAttribute('data-soc-field');
      const soc = (adminState.catalog.brand?.socials || []).find((s) => s.id === socId);
      if (!soc || !field) return;

      if (field === 'logo') {
        const nextLogo = e.target.value.trim();
        if (!nextLogo) return;
        queueManagedLogoForDeletion(soc.logo);
        delete adminState.pendingUploads[`__social__${socId}`];
        soc.logo = nextLogo;
        const thumb = container.querySelector(`[data-social-thumb="${socId}"]`);
        if (thumb) thumb.src = nextLogo;
      } else if (field === 'label') {
        soc.label = e.target.value;
        soc.platform = e.target.value;
        const heading = container.querySelector(`[data-social-heading="${socId}"]`);
        if (heading) heading.textContent = e.target.value.trim() || 'Sosmed';
      } else if (field === 'url') {
        soc.url = e.target.value.trim();
      }
      markDirty();
    });
  });

  container.querySelectorAll('[data-soc-preset]').forEach((select) => {
    select.addEventListener('change', (e) => {
      const socId = select.getAttribute('data-soc-preset');
      const nextLogo = e.target.value;
      const soc = (adminState.catalog.brand?.socials || []).find((s) => s.id === socId);
      if (!soc || !nextLogo) return;
      queueManagedLogoForDeletion(soc.logo);
      delete adminState.pendingUploads[`__social__${socId}`];
      soc.logo = nextLogo;
      markDirty();
      renderSocialList();
      showToast(`Logo ${soc.label} diperbarui.`);
    });
  });

  container.querySelectorAll('[data-soc-file]').forEach((fileInput) => {
    fileInput.addEventListener('change', async (e) => {
      const socId = fileInput.getAttribute('data-soc-file');
      const file = e.target.files?.[0];
      const soc = (adminState.catalog.brand?.socials || []).find((s) => s.id === socId);
      if (!file || !soc) return;
      try {
        const result = await compressLogoFile(file);
        queueManagedLogoForDeletion(soc.logo);
        const safeSlug = slugifyId(socId);
        const targetPath = `assets/logos/uploads/social-${safeSlug}-${Date.now().toString(36)}.${result.ext}`;
        adminState.pendingUploads[`__social__${socId}`] = {
          targetPath,
          base64Content: result.base64Content,
          previewDataUrl: result.previewDataUrl,
          fileName: file.name,
        };
        soc.logo = result.previewDataUrl;
        markDirty();
        renderSocialList();
        showToast(`Logo sosmed "${soc.label}" siap diunggah saat Publikasi.`);
      } catch (err) {
        showToast(err.message || 'Gagal memproses file logo sosmed.');
      }
    });
  });

  container.querySelectorAll('[data-delete-social]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const socId = btn.getAttribute('data-delete-social');
      const target = (adminState.catalog.brand?.socials || []).find((s) => s.id === socId);
      if (!target) return;
      queueManagedLogoForDeletion(target.logo);
      delete adminState.pendingUploads[`__social__${socId}`];
      adminState.catalog = deleteSocialFromCatalog(adminState.catalog, socId);
      markDirty();
      renderSocialList();
      showToast(`Kontak "${target.label}" dihapus.`);
    });
  });
}

function renderBrandSettings() {
  if (!adminState.unlocked) return;
  adminState.catalog.brand = normalizeBrandConfig(adminState.catalog.brand || {});
  const brand = adminState.catalog.brand;

  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = String(val ?? '');
  };

  setVal('brand-name-input', brand.name || 'Manifestudio');
  setVal('brand-tagline-input', brand.tagline || 'Premium Account by Tomy');
  setVal('brand-footer-input', brand.footerText || 'Dikelola oleh Manifestudio by Tomy © 2026');
  setVal(
    'brand-paylater-pct-input',
    Math.round(Number(brand.payLaterSurchargeRate ?? 0.1) * 1000) / 10
  );
  setVal('brand-service-fee-flat-input', Number(brand.serviceFeeFlat || 0));
  setVal('brand-service-fee-label-input', brand.serviceFeeLabel || 'Biaya Layanan');
  setVal('brand-whatsapp-input', brand.whatsappNumber || '6285122936027');
  setVal('brand-discount-threshold-input', Number(brand.discountThreshold ?? 50000));
  setVal('brand-discount-amount-input', Number(brand.discountAmount ?? 2000));

  syncBrandLogoUi();
  renderSocialList();
}

function renderFaqList() {
  if (!adminState.unlocked) return;
  const container = document.getElementById('admin-faq-list');
  if (!container) return;

  const faqItems = Array.isArray(adminState.catalog?.faqItems)
    ? adminState.catalog.faqItems
    : [];

  if (faqItems.length === 0) {
    container.innerHTML = `<p class="admin-subtitle">Belum ada pertanyaan umum (FAQ). Tambahkan melalui formulir di bawah.</p>`;
    return;
  }

  container.innerHTML = faqItems
    .map(
      (item, idx) => `
      <div class="admin-faq-card" data-faq-row="${idx}">
        <div class="admin-faq-head">
          <span class="admin-order-badge mono-num">FAQ #${idx + 1}</span>
          <div class="admin-order-controls">
            <button
              type="button"
              class="btn btn-secondary btn-sm admin-order-btn"
              data-move-faq="${idx}"
              data-move-dir="up"
              ${idx === 0 ? 'disabled' : ''}
            >
              ↑ Naik
            </button>
            <button
              type="button"
              class="btn btn-secondary btn-sm admin-order-btn"
              data-move-faq="${idx}"
              data-move-dir="down"
              ${idx === faqItems.length - 1 ? 'disabled' : ''}
            >
              ↓ Turun
            </button>
            <button
              type="button"
              class="btn btn-ghost btn-sm"
              data-delete-faq="${idx}"
            >
              Hapus
            </button>
          </div>
        </div>
        <div class="form-field">
          <label for="faq-q-${idx}">Pertanyaan</label>
          <input
            type="text"
            id="faq-q-${idx}"
            data-faq-idx="${idx}"
            data-faq-field="question"
            value="${escapeHtml(item.question || '')}"
          />
        </div>
        <div class="form-field">
          <label for="faq-a-${idx}">Jawaban</label>
          <textarea
            id="faq-a-${idx}"
            class="admin-textarea"
            rows="2"
            data-faq-idx="${idx}"
            data-faq-field="answer"
          >${escapeHtml(item.answer || '')}</textarea>
        </div>
      </div>
    `
    )
    .join('');

  container.querySelectorAll('[data-faq-idx]').forEach((input) => {
    input.addEventListener('input', (e) => {
      const idx = Number(input.getAttribute('data-faq-idx'));
      const field = input.getAttribute('data-faq-field');
      const target = adminState.catalog.faqItems?.[idx];
      if (!target || !field) return;
      target[field] = e.target.value;
      markDirty();
    });
  });

  container.querySelectorAll('[data-move-faq]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.getAttribute('data-move-faq'));
      const dir = btn.getAttribute('data-move-dir');
      const list = [...(adminState.catalog.faqItems || [])];
      const targetIdx = dir === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= list.length) return;
      const [moved] = list.splice(idx, 1);
      list.splice(targetIdx, 0, moved);
      adminState.catalog.faqItems = list;
      markDirty();
      renderFaqList();
      showToast('Urutan FAQ diperbarui.');
    });
  });

  container.querySelectorAll('[data-delete-faq]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.getAttribute('data-delete-faq'));
      adminState.catalog = deleteFaqFromCatalog(adminState.catalog, idx);
      markDirty();
      renderFaqList();
      showToast('Pertanyaan umum dihapus.');
    });
  });
}

function getProductLogoMode(product) {
  if (adminState.logoEditMode[product.id]) {
    return adminState.logoEditMode[product.id];
  }
  if (adminState.pendingUploads[product.id] || extractManagedUploadLogoPath(product.logo)) {
    return 'upload';
  }
  return 'link';
}

function renderProductList() {
  if (!adminState.unlocked) return;
  const container = document.getElementById('admin-product-list');
  const countEl = document.getElementById('admin-product-count');
  if (!container) return;

  const allProducts = adminState.catalog.products || [];
  const totalProducts = allProducts.length;
  const availableCategories = getAvailableProductCategories();
  const q = adminState.searchQuery.trim().toLowerCase();
  const products = allProducts.filter((p) => {
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
      const globalIndex = allProducts.findIndex((p) => p.id === product.id);
      const isFirst = globalIndex <= 0;
      const isLast = globalIndex >= totalProducts - 1;
      const logoMode = getProductLogoMode(product);
      const pendingUpload = adminState.pendingUploads[product.id];
      const managedPath = extractManagedUploadLogoPath(product.logo);

      const logoStatusText = pendingUpload
        ? `File baru siap diupload: ${pendingUpload.fileName}`
        : managedPath
        ? `Tersimpan di repo: ${managedPath}`
        : String(product.logo || '').startsWith('data:')
        ? 'Gambar upload lokal siap dipublikasikan'
        : 'Menggunakan URL / Preset ikon';

      const positionOptionsHtml = allProducts
        .map(
          (_item, idx) =>
            `<option value="${idx}" ${idx === globalIndex ? 'selected' : ''}>Posisi #${idx + 1}</option>`
        )
        .join('');

      const categorySelectHtml = availableCategories
        .map(
          (cat) =>
            `<option value="${escapeHtml(cat.id)}" ${product.category === cat.id ? 'selected' : ''}>${escapeHtml(cat.label)}</option>`
        )
        .join('');

      const presetOptionsHtml = LOGO_PRESETS.map(
        (preset) =>
          `<option value="${escapeHtml(preset.value)}" ${product.logo === preset.value ? 'selected' : ''}>${escapeHtml(preset.label)}</option>`
      ).join('');

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
      const cardTone = getProductCardTone(globalIndex);

      return `
        <article class="admin-product-card" data-admin-product="${escapeHtml(product.id)}" data-card-tone="${cardTone}">
          <div class="admin-prod-head">
            <div class="admin-prod-brand">
              <span class="admin-order-badge mono-num" title="Urutan tampil di katalog">#${globalIndex + 1}</span>
              <img src="${escapeHtml(product.logo)}" alt="" width="42" height="42" class="modal-logo" />
              <div class="admin-prod-title-wrap">
                <h2 class="admin-prod-name">${escapeHtml(product.name)}</h2>
                <span class="admin-prod-meta">ID: ${escapeHtml(product.id)} · ${(product.variants || []).length} varian</span>
              </div>
            </div>

            <div class="admin-prod-controls">
              <div class="admin-order-controls" role="group" aria-label="Urutan tampil ${escapeHtml(product.name)}">
                <button
                  type="button"
                  class="btn btn-secondary btn-sm admin-order-btn"
                  data-move-prod="${escapeHtml(product.id)}"
                  data-move-dir="up"
                  ${isFirst ? 'disabled' : ''}
                  aria-label="Naikkan urutan ${escapeHtml(product.name)}"
                >
                  ↑ Naik
                </button>
                <button
                  type="button"
                  class="btn btn-secondary btn-sm admin-order-btn"
                  data-move-prod="${escapeHtml(product.id)}"
                  data-move-dir="down"
                  ${isLast ? 'disabled' : ''}
                  aria-label="Turunkan urutan ${escapeHtml(product.name)}"
                >
                  ↓ Turun
                </button>
                <select
                  class="admin-order-select"
                  data-reorder-select="${escapeHtml(product.id)}"
                  aria-label="Pilih urutan posisi ${escapeHtml(product.name)}"
                >
                  ${positionOptionsHtml}
                </select>
              </div>

              <div class="admin-prod-action-pair">
                <button
                  type="button"
                  class="btn ${product.outOfStock ? 'btn-primary' : 'btn-secondary'} btn-sm"
                  data-toggle-stock="${escapeHtml(product.id)}"
                >
                  ${product.outOfStock ? 'Aktifkan Stok' : 'Tandai Habis'}
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
          </div>

          <div class="admin-prod-meta-grid">
            <div class="form-field">
              <label for="pname-${escapeHtml(product.id)}">Nama Produk</label>
              <input
                type="text"
                id="pname-${escapeHtml(product.id)}"
                data-prod-meta="${escapeHtml(product.id)}"
                data-meta-field="name"
                value="${escapeHtml(product.name || '')}"
              />
            </div>
            <div class="form-field">
              <label for="pcat-${escapeHtml(product.id)}">Kategori Layanan</label>
              <select
                id="pcat-${escapeHtml(product.id)}"
                class="admin-select"
                data-prod-meta="${escapeHtml(product.id)}"
                data-meta-field="category"
              >
                ${categorySelectHtml}
              </select>
            </div>
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

            <!-- Logo Manager: selalu tampil jelas di Mobile & Desktop -->
            <div class="admin-logo-manager admin-logo-manager-full" data-testid="logo-manager-${escapeHtml(product.id)}">
              <div class="admin-logo-head">
                <div class="admin-logo-preview-wrap">
                  <img
                    src="${escapeHtml(product.logo)}"
                    alt="Logo ${escapeHtml(product.name)}"
                    width="42"
                    height="42"
                    class="modal-logo admin-logo-thumb"
                  />
                  <div>
                    <strong class="admin-logo-title">Ganti Logo Produk</strong>
                    <span class="admin-prod-meta">${escapeHtml(logoStatusText)}</span>
                  </div>
                </div>

                <div class="admin-logo-tabs" role="group" aria-label="Pilih metode ganti logo ${escapeHtml(product.name)}">
                  <button
                    type="button"
                    class="admin-logo-mode-btn ${logoMode === 'upload' ? 'is-active' : ''}"
                    data-logo-mode-btn="${escapeHtml(product.id)}"
                    data-logo-mode="upload"
                    aria-pressed="${logoMode === 'upload'}"
                  >
                    Upload Gambar
                  </button>
                  <button
                    type="button"
                    class="admin-logo-mode-btn ${logoMode === 'link' ? 'is-active' : ''}"
                    data-logo-mode-btn="${escapeHtml(product.id)}"
                    data-logo-mode="link"
                    aria-pressed="${logoMode === 'link'}"
                  >
                    Link / URL
                  </button>
                </div>
              </div>

              <div class="admin-logo-pane" ${logoMode === 'upload' ? '' : 'hidden'}>
                <div class="admin-file-row">
                  <label
                    for="plogofile-${escapeHtml(product.id)}"
                    class="btn btn-secondary btn-sm admin-file-trigger"
                  >
                    Pilih File Gambar
                  </label>
                  <input
                    type="file"
                    id="plogofile-${escapeHtml(product.id)}"
                    class="visually-hidden-file"
                    accept="image/*"
                    data-prod-file-logo="${escapeHtml(product.id)}"
                  />
                  <span class="admin-prod-meta">Otomatis kompres &amp; hapus file upload lama saat publish ke GitHub.</span>
                </div>
              </div>

              <div class="admin-logo-pane" ${logoMode === 'link' ? '' : 'hidden'}>
                <div class="admin-logo-link-grid">
                  <div class="form-field">
                    <label for="plogopreset-${escapeHtml(product.id)}">Pilih Preset Cepat</label>
                    <select
                      id="plogopreset-${escapeHtml(product.id)}"
                      class="admin-select"
                      data-prod-preset-logo="${escapeHtml(product.id)}"
                    >
                      <option value="">— Pilih Ikon Bawaan —</option>
                      ${presetOptionsHtml}
                    </select>
                  </div>
                  <div class="form-field">
                    <label for="plogo-${escapeHtml(product.id)}">URL / Path Logo</label>
                    <input
                      type="text"
                      id="plogo-${escapeHtml(product.id)}"
                      data-prod-meta="${escapeHtml(product.id)}"
                      data-meta-field="logo"
                      placeholder="https://... atau ./assets/logos/..."
                      value="${escapeHtml(String(product.logo || '').startsWith('data:') ? '' : product.logo || '')}"
                    />
                  </div>
                </div>
              </div>
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
  container.querySelectorAll('[data-move-prod]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const prodId = btn.getAttribute('data-move-prod');
      const dir = btn.getAttribute('data-move-dir');
      if (!prodId || !dir) return;
      adminState.catalog = moveProductInCatalog(adminState.catalog, prodId, dir);
      markDirty();
      renderProductList();
      showToast('Urutan produk diperbarui.');
    });
  });

  container.querySelectorAll('[data-reorder-select]').forEach((select) => {
    select.addEventListener('change', (e) => {
      const prodId = select.getAttribute('data-reorder-select');
      const targetIdx = Number(e.target.value);
      if (!prodId || !Number.isFinite(targetIdx)) return;
      adminState.catalog = reorderProductToIndex(adminState.catalog, prodId, targetIdx);
      markDirty();
      renderProductList();
      showToast(`Posisi produk dipindahkan ke urutan #${targetIdx + 1}.`);
    });
  });

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
      const deletedProd = adminState.catalog.products.find((p) => p.id === prodId);
      if (deletedProd) {
        queueManagedLogoForDeletion(deletedProd.logo);
        delete adminState.pendingUploads[prodId];
      }
      adminState.catalog.products = adminState.catalog.products.filter((p) => p.id !== prodId);
      adminState.confirmDeleteProductId = null;
      markDirty();
      renderProductList();
      renderCategoryList();
      showToast('Produk dihapus dari daftar kerja.');
    });
  });

  container.querySelectorAll('[data-logo-mode-btn]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const prodId = btn.getAttribute('data-logo-mode-btn');
      const mode = btn.getAttribute('data-logo-mode');
      if (!prodId || (mode !== 'upload' && mode !== 'link')) return;
      adminState.logoEditMode[prodId] = mode;
      renderProductList();
    });
  });

  container.querySelectorAll('[data-prod-preset-logo]').forEach((select) => {
    select.addEventListener('change', (e) => {
      const prodId = select.getAttribute('data-prod-preset-logo');
      const nextUrl = e.target.value;
      if (!prodId || !nextUrl) return;
      const prod = adminState.catalog.products.find((p) => p.id === prodId);
      if (!prod) return;
      queueManagedLogoForDeletion(prod.logo);
      delete adminState.pendingUploads[prodId];
      prod.logo = nextUrl;
      adminState.logoEditMode[prodId] = 'link';
      markDirty();
      renderProductList();
      showToast(`Logo ${prod.name} diganti ke ikon preset.`);
    });
  });

  container.querySelectorAll('[data-prod-meta]').forEach((input) => {
    const evtName = input.tagName === 'SELECT' ? 'change' : 'input';
    input.addEventListener(evtName, (e) => {
      const prodId = input.getAttribute('data-prod-meta');
      const field = input.getAttribute('data-meta-field');
      const prod = adminState.catalog.products.find((p) => p.id === prodId);
      if (!prod || !field) return;

      if (field === 'logo') {
        const prevLogo = prod.logo;
        const nextVal = e.target.value.trim();
        if (!nextVal) return;
        if (prevLogo !== nextVal) {
          queueManagedLogoForDeletion(prevLogo);
          delete adminState.pendingUploads[prodId];
        }
        prod.logo = nextVal;
        const card = input.closest('.admin-product-card');
        card?.querySelectorAll('.admin-logo-thumb, .admin-prod-brand .modal-logo').forEach((img) => {
          img.src = nextVal;
        });
      } else if (field === 'name') {
        prod.name = e.target.value;
        const card = input.closest('.admin-product-card');
        const headingEl = card?.querySelector('.admin-prod-name');
        if (headingEl) {
          headingEl.textContent = e.target.value.trim() || 'Produk Tanpa Nama';
        }
      } else if (field === 'category') {
        prod.category = e.target.value;
        renderCategoryList();
        showToast(`Kategori ${prod.name} diperbarui.`);
      } else {
        prod[field] = e.target.value;
      }
      markDirty();
    });
  });

  container.querySelectorAll('[data-prod-file-logo]').forEach((fileInput) => {
    fileInput.addEventListener('change', async (e) => {
      const prodId = fileInput.getAttribute('data-prod-file-logo');
      const file = e.target.files?.[0];
      if (!file || !prodId) return;
      const prod = adminState.catalog.products.find((p) => p.id === prodId);
      if (!prod) return;

      try {
        const result = await compressLogoFile(file);
        queueManagedLogoForDeletion(prod.logo);
        const safeSlug = slugifyId(prodId);
        const targetPath = `assets/logos/uploads/${safeSlug}-${Date.now().toString(36)}.${result.ext}`;
        adminState.pendingUploads[prodId] = {
          targetPath,
          base64Content: result.base64Content,
          previewDataUrl: result.previewDataUrl,
          fileName: file.name,
        };
        adminState.logoEditMode[prodId] = 'upload';
        prod.logo = result.previewDataUrl;
        markDirty();
        renderProductList();
        showToast(`Logo ${prod.name} diperbarui (${file.name}). Klik Publikasikan untuk sinkron & hapus logo lama.`);
      } catch (err) {
        showToast(err.message || 'Gagal memproses file logo.');
      }
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

function syncNewProductLogoUi() {
  const mode = adminState.newProdLogoMode;
  document.querySelectorAll('[data-new-logo-mode]').forEach((btn) => {
    const isActive = btn.getAttribute('data-new-logo-mode') === mode;
    btn.classList.toggle('is-active', isActive);
    btn.setAttribute('aria-pressed', String(isActive));
  });

  const uploadPane = document.getElementById('new-prod-logo-upload-pane');
  const linkPane = document.getElementById('new-prod-logo-link-pane');
  if (uploadPane) uploadPane.hidden = mode !== 'upload';
  if (linkPane) linkPane.hidden = mode !== 'link';

  const previewEl = document.getElementById('new-prod-logo-preview');
  const statusEl = document.getElementById('new-prod-logo-status');
  const urlInput = document.getElementById('new-prod-logo-url');

  const activeSrc =
    mode === 'upload' && adminState.newProdPendingUpload
      ? adminState.newProdPendingUpload.previewDataUrl
      : urlInput?.value.trim() || './assets/logos/custom-request.svg';

  if (previewEl) previewEl.src = activeSrc;
  if (statusEl) {
    if (mode === 'upload' && adminState.newProdPendingUpload) {
      statusEl.textContent = `File siap: ${adminState.newProdPendingUpload.fileName}`;
    } else if (mode === 'upload') {
      statusEl.textContent = 'Belum ada file dipilih (atau gunakan tab Link / URL)';
    } else {
      statusEl.textContent = `Link aktif: ${activeSrc}`;
    }
  }
}

async function putGitHubFile({ owner, repo, branch, token, filePath, base64Content, message, sha = null }) {
  const endpoint = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeRepoPathSegments(filePath)}`;
  const body = {
    message,
    content: base64Content,
    branch,
    ...(sha ? { sha } : {}),
  };
  const res = await fetch(endpoint, {
    method: 'PUT',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || `GitHub HTTP ${res.status} (${filePath})`);
  }
  return res.json();
}

async function deleteGitHubFile({ owner, repo, branch, token, filePath, message }) {
  const endpoint = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeRepoPathSegments(filePath)}`;
  const getRes = await fetch(`${endpoint}?ref=${encodeURIComponent(branch)}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
    },
    cache: 'no-store',
  });

  if (getRes.status === 404) {
    return false;
  }
  if (!getRes.ok) {
    return false;
  }
  const meta = await getRes.json();
  if (!meta?.sha) return false;

  const delRes = await fetch(endpoint, {
    method: 'DELETE',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      sha: meta.sha,
      branch,
    }),
  });
  return delRes.ok;
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
    parsed.brand = normalizeBrandConfig(parsed.brand || {});
    parsed.paymentOptions = syncPaymentOptionsWithBrand(parsed.paymentOptions, parsed.brand);
    adminState.catalog = parsed;
    adminState.baseCatalog = structuredClone(parsed);
    adminState.lastPublishedProducts = extractPublishedLogoEntries(parsed);
    adminState.remoteSha = payload.sha || null;
    adminState.source = 'github';
    adminState.dirty = false;
    clearPendingLogoOps();
    updateSourceBadge();
    renderCategoryOptions();
    renderCategoryList();
    renderBrandSettings();
    renderFaqList();
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

function setPublishProgress({ visible = true, percent = 0, label = '' }) {
  const box = document.getElementById('admin-publish-progress');
  const labelEl = document.getElementById('admin-progress-label');
  const pctEl = document.getElementById('admin-progress-pct');
  const barEl = document.getElementById('admin-progress-bar');
  const fillEl = document.getElementById('admin-progress-fill');
  if (!box) return;

  if (!visible) {
    box.hidden = true;
    return;
  }
  const safePct = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
  box.hidden = false;
  if (labelEl && label) labelEl.textContent = label;
  if (pctEl) pctEl.textContent = `${safePct}%`;
  if (barEl) barEl.setAttribute('aria-valuenow', String(safePct));
  if (fillEl) fillEl.style.width = `${safePct}%`;
}

function loadLocalHistory() {
  try {
    const raw = localStorage.getItem(ADMIN_HISTORY_STORAGE_KEY);
    if (!raw) {
      adminState.history = [];
      return;
    }
    const parsed = JSON.parse(raw);
    adminState.history = pruneCatalogHistory(parsed, MAX_HISTORY_LOGS);
  } catch {
    adminState.history = [];
  }
}

function saveLocalHistory(entries) {
  const pruned = pruneCatalogHistory(entries, MAX_HISTORY_LOGS);
  adminState.history = pruned;
  try {
    localStorage.setItem(ADMIN_HISTORY_STORAGE_KEY, JSON.stringify(pruned));
  } catch {
    // Ignore storage quota
  }
  return pruned;
}

function recordLocalHistory(action, summary, snapshot, prevSnapshotOverride = null) {
  const prevSnapshot =
    prevSnapshotOverride ||
    adminState.baseCatalog ||
    adminState.history[0]?.snapshot ||
    null;

  const details = prevSnapshot
    ? describeCatalogChanges(prevSnapshot, snapshot)
    : ['Sinkronisasi / penyimpanan snapshot katalog'];

  const resolvedSummary =
    summary ||
    (prevSnapshot ? summarizeCatalogDiff(prevSnapshot, snapshot) : details[0]);

  const updated = appendCatalogHistory(
    adminState.history,
    {
      action,
      summary: resolvedSummary,
      details,
      snapshot,
      prevSnapshot,
    },
    MAX_HISTORY_LOGS
  );
  if (action === 'publish' || action === 'preview' || action === 'manual') {
    adminState.baseCatalog = structuredClone(snapshot);
  }
  saveLocalHistory(updated);
  renderHistoryList();
  return updated;
}

function formatHistoryDate(isoString) {
  try {
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(isoString));
  } catch {
    return String(isoString || '');
  }
}

function renderHistoryList() {
  if (!adminState.unlocked) return;
  const limitEl = document.getElementById('history-limit-label');
  if (limitEl) limitEl.textContent = String(MAX_HISTORY_LOGS);

  const listEl = document.getElementById('admin-history-list');
  if (!listEl) return;

  const logs = pruneCatalogHistory(adminState.history, MAX_HISTORY_LOGS);
  if (logs.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        <h3>Belum ada riwayat perubahan</h3>
        <p>Log otomatis dicatat setiap kali Anda mempublikasikan ke GitHub atau menyimpan snapshot manual.</p>
      </div>
    `;
    return;
  }

  const badgeLabel = {
    publish: 'Publikasi GitHub',
    preview: 'Pratinjau Lokal',
    restore: 'Cadangan Sebelum Restore',
    manual: 'Snapshot Manual',
  };

  listEl.innerHTML = logs
    .map((entry, idx) => {
      const olderSnapshot = logs[idx + 1]?.snapshot || null;
      const rawDetails =
        Array.isArray(entry.details) && entry.details.length > 0
          ? entry.details
          : olderSnapshot && entry.snapshot
          ? describeCatalogChanges(olderSnapshot, entry.snapshot)
          : entry.summary
          ? [entry.summary]
          : ['Pembaruan katalog'];

      const isLegacyVagueSummary = /^\+\d+\s+produk\b/i.test(String(entry.summary || '').trim());
      const headlineText =
        isLegacyVagueSummary && rawDetails.length > 0
          ? rawDetails.length === 1
            ? rawDetails[0]
            : `${rawDetails.length} tindakan perubahan tercatat (${rawDetails[0]})`
          : entry.summary || rawDetails[0] || 'Pembaruan katalog';

      const detailsListHtml = rawDetails
        .map((item) => `<li class="admin-history-detail-item">${escapeHtml(item)}</li>`)
        .join('');

      return `
      <article class="admin-history-row" data-history-id="${escapeHtml(entry.id)}">
        <div class="admin-history-main">
          <div class="admin-history-meta-top">
            <span class="admin-badge ${entry.action === 'publish' ? 'is-ok' : 'is-warn'}">${escapeHtml(badgeLabel[entry.action] || 'Perubahan')}</span>
            <time class="admin-prod-meta mono-num">${escapeHtml(formatHistoryDate(entry.createdAt))}</time>
            ${idx === 0 ? '<span class="admin-history-latest">Terbaru</span>' : ''}
            <span class="admin-prod-meta">${rawDetails.length} rincian tindakan</span>
          </div>
          <strong class="admin-history-summary">${escapeHtml(headlineText)}</strong>
          <ul class="admin-history-details-list" aria-label="Rincian tindakan perubahan">
            ${detailsListHtml}
          </ul>
          <span class="admin-prod-meta">${Number(entry.productCount || 0)} produk · ${Number(entry.voucherCount || 0)} voucher</span>
        </div>
        <div class="admin-history-actions">
          <button
            type="button"
            class="btn btn-primary btn-sm"
            data-restore-history="${escapeHtml(entry.id)}"
          >
            Pulihkan
          </button>
          <button
            type="button"
            class="btn btn-ghost btn-sm"
            data-delete-history="${escapeHtml(entry.id)}"
            aria-label="Hapus log ${escapeHtml(headlineText)}"
          >
            Hapus
          </button>
        </div>
      </article>
    `;
    })
    .join('');

  listEl.querySelectorAll('[data-restore-history]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-restore-history');
      const target = adminState.history.find((h) => h.id === id);
      if (!target || !target.snapshot) return;

      recordLocalHistory(
        'restore',
        `Cadangan sebelum restore ke versi ${formatHistoryDate(target.createdAt)}`,
        adminState.catalog,
        target.snapshot
      );

      adminState.catalog = structuredClone(target.snapshot);
      adminState.catalog.brand = normalizeBrandConfig(adminState.catalog.brand || {});
      adminState.catalog.paymentOptions = syncPaymentOptionsWithBrand(
        adminState.catalog.paymentOptions,
        adminState.catalog.brand
      );
      adminState.baseCatalog = structuredClone(adminState.catalog);
      markDirty();
      try {
        localStorage.setItem(CATALOG_PREVIEW_STORAGE_KEY, JSON.stringify(adminState.catalog));
      } catch {
        // Ignore
      }
      adminState.activeTab = 'products';
      renderTabs();
      renderCategoryOptions();
      renderCategoryList();
      renderBrandSettings();
      renderFaqList();
      renderProductList();
      renderVoucherList();
      setStatusBox(
        'admin-status-box',
        `Katalog dipulihkan ke versi ${formatHistoryDate(target.createdAt)}. Klik "Simpan & Publikasikan ke GitHub" untuk menerapkan secara live.`,
        'info'
      );
      showToast('Katalog berhasil dipulihkan dari riwayat.');
    });
  });

  listEl.querySelectorAll('[data-delete-history]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-delete-history');
      const next = adminState.history.filter((h) => h.id !== id);
      saveLocalHistory(next);
      renderHistoryList();
      showToast('Log riwayat dihapus.');
    });
  });
}

async function pullHistoryFromGitHub() {
  if (!adminState.unlocked) return;

  const mergeAndSaveLogs = (incomingLogs = []) => {
    if (!Array.isArray(incomingLogs) || incomingLogs.length === 0) return;
    const mergedMap = new Map();
    for (const item of [...incomingLogs, ...adminState.history]) {
      if (!item || !item.id) continue;
      const existing = mergedMap.get(item.id);
      if (!existing) {
        mergedMap.set(item.id, item);
      } else if (
        (!Array.isArray(existing.details) || existing.details.length === 0) &&
        Array.isArray(item.details) &&
        item.details.length > 0
      ) {
        mergedMap.set(item.id, item);
      }
    }
    saveLocalHistory([...mergedMap.values()]);
    renderHistoryList();
  };

  try {
    const localRes = await fetch(`./data/catalog-history.json?t=${Date.now()}`, {
      cache: 'no-store',
    });
    if (localRes.ok) {
      const localPayload = await localRes.json();
      if (Array.isArray(localPayload?.logs)) {
        mergeAndSaveLogs(localPayload.logs);
      }
    }
  } catch {
    // Ignore local fetch fallback error
  }

  const { owner, repo, branch, token } = adminState.ghConfig;
  if (!owner || !repo) return;

  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/data/catalog-history.json?ref=${encodeURIComponent(branch)}`;
  const headers = { Accept: 'application/vnd.github+json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, { headers, cache: 'no-store' });
  if (!res.ok) return;
  const payload = await res.json();
  adminState.historySha = payload.sha || null;
  const decoded = decodeBase64Utf8(payload.content);
  const parsed = JSON.parse(decoded);
  const remoteLogs = Array.isArray(parsed?.logs) ? parsed.logs : [];
  mergeAndSaveLogs(remoteLogs);
}

async function syncHistoryToGitHub({ owner, repo, branch, token, logs }) {
  const endpoint = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/data/catalog-history.json`;
  let sha = adminState.historySha;
  try {
    const getRes = await fetch(`${endpoint}?ref=${encodeURIComponent(branch)}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    });
    if (getRes.ok) {
      const meta = await getRes.json();
      sha = meta.sha || sha;
    } else if (getRes.status === 404) {
      sha = null;
    }
  } catch {
    // Use existing sha if available
  }

  const pruned = pruneCatalogHistory(logs, MAX_HISTORY_LOGS);
  const bodyJson = JSON.stringify(
    {
      updatedAt: new Date().toISOString(),
      maxLogs: MAX_HISTORY_LOGS,
      logs: pruned,
    },
    null,
    2
  );
  const payload = await putGitHubFile({
    owner,
    repo,
    branch,
    token,
    filePath: 'data/catalog-history.json',
    base64Content: encodeBase64Utf8(`${bodyJson}\n`),
    message: `chore(history): catat riwayat katalog (maks ${MAX_HISTORY_LOGS} log)`,
    sha,
  });
  adminState.historySha = payload.content?.sha || sha;
}

function putGitHubFileWithProgress({
  owner,
  repo,
  branch,
  token,
  filePath,
  base64Content,
  message,
  sha = null,
  onUploadProgress = null,
}) {
  const endpoint = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeRepoPathSegments(filePath)}`;
  const bodyStr = JSON.stringify({
    message,
    content: base64Content,
    branch,
    ...(sha ? { sha } : {}),
  });

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', endpoint, true);
    xhr.setRequestHeader('Accept', 'application/vnd.github+json');
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('Content-Type', 'application/json');

    if (xhr.upload && typeof onUploadProgress === 'function') {
      xhr.upload.onprogress = (evt) => {
        if (evt.lengthComputable && evt.total > 0) {
          onUploadProgress(evt.loaded / evt.total);
        }
      };
    }

    xhr.onload = () => {
      let data = {};
      try {
        data = JSON.parse(xhr.responseText || '{}');
      } catch {
        data = {};
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        onUploadProgress?.(1);
        resolve(data);
      } else {
        reject(new Error(data.message || `GitHub HTTP ${xhr.status} (${filePath})`));
      }
    };

    xhr.onerror = () => reject(new Error(`Koneksi gagal saat mengunggah ${filePath}`));
    xhr.send(bodyStr);
  });
}

async function publishToGitHub() {
  if (!adminState.unlocked || adminState.isPublishing) return;
  const { owner, repo, branch, token } = adminState.ghConfig;
  if (!token) {
    setStatusBox('admin-status-box', 'Sesi token kosong. Kunci lalu buka kembali brankas Anda.', 'error');
    return;
  }

  adminState.isPublishing = true;
  const publishBtn = document.getElementById('publish-github-btn');
  if (publishBtn) publishBtn.disabled = true;

  const endpoint = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/data/catalog.json`;
  setStatusBox('admin-status-box', 'Mengunggah perubahan & logo ke GitHub Pages...', 'info');

  try {
    const nextCatalog = structuredClone(adminState.catalog);
    nextCatalog.brand = normalizeBrandConfig(nextCatalog.brand || {});
    nextCatalog.paymentOptions = syncPaymentOptionsWithBrand(
      nextCatalog.paymentOptions,
      nextCatalog.brand
    );

    const uploadQueue = [];

    for (const prod of nextCatalog.products || []) {
      const pending = adminState.pendingUploads[prod.id];
      if (pending && prod.logo === pending.previewDataUrl) {
        uploadQueue.push({
          label: `logo produk ${prod.name}`,
          pending,
          applyPath: (relPath) => {
            prod.logo = relPath;
          },
        });
      }
    }

    const brandPending = adminState.pendingUploads['__brand_logo__'];
    if (brandPending && nextCatalog.brand.logo === brandPending.previewDataUrl) {
      uploadQueue.push({
        label: 'logo brand utama',
        pending: brandPending,
        applyPath: (relPath) => {
          nextCatalog.brand.logo = relPath;
        },
      });
    }

    for (const soc of nextCatalog.brand.socials || []) {
      const socPending = adminState.pendingUploads[`__social__${soc.id}`];
      if (socPending && soc.logo === socPending.previewDataUrl) {
        uploadQueue.push({
          label: `logo sosmed ${soc.label}`,
          pending: socPending,
          applyPath: (relPath) => {
            soc.logo = relPath;
          },
        });
      }
    }

    const diffOrphans = collectOrphanedUploadLogos(
      adminState.lastPublishedProducts,
      nextCatalog.products,
      nextCatalog
    );
    const stillActiveSet = collectAllActiveUploadLogoPaths(nextCatalog);
    const preUploadActiveSet = new Set(stillActiveSet);
    for (const job of uploadQueue) {
      if (job.pending?.targetPath) preUploadActiveSet.add(job.pending.targetPath);
    }
    const plannedOrphans = [...new Set([...diffOrphans, ...adminState.deletedUploadPaths])].filter(
      (p) => p && !preUploadActiveSet.has(p)
    );

    const totalWeight =
      uploadQueue.length * 1.2 +
      0.5 + // fetch remote SHA
      1.8 + // upload catalog.json
      plannedOrphans.length * 0.5 +
      0.8; // sync history log
    let completedWeight = 0;

    const updateWeightedProgress = (partialWeight, label) => {
      const ratio = totalWeight > 0 ? Math.min(0.99, (completedWeight + partialWeight) / totalWeight) : 0;
      setPublishProgress({
        visible: true,
        percent: Math.max(2, Math.round(ratio * 100)),
        label,
      });
    };

    updateWeightedProgress(0.05, 'Memvalidasi data katalog & gambar...');

    // 1. Upload pending compressed logo files directly to assets/logos/uploads/
    let uploadedLogosCount = 0;
    for (let i = 0; i < uploadQueue.length; i += 1) {
      const job = uploadQueue[i];
      const { pending } = job;
      const stepLabel = `Mengunggah (${i + 1}/${uploadQueue.length}): ${job.label}...`;
      await putGitHubFileWithProgress({
        owner,
        repo,
        branch,
        token,
        filePath: pending.targetPath,
        base64Content: pending.base64Content,
        message: `chore(logo): upload ${job.label} via Panel Admin`,
        onUploadProgress: (frac) => updateWeightedProgress(frac * 1.2, stepLabel),
      });
      job.applyPath(`./${pending.targetPath}`);
      uploadedLogosCount += 1;
      completedWeight += 1.2;
    }

    // 2. Fetch latest catalog.json SHA
    updateWeightedProgress(0.15, 'Memeriksa versi catalog.json di GitHub...');
    let prevRemoteCatalog = null;
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
      try {
        prevRemoteCatalog = JSON.parse(decodeBase64Utf8(currentMeta.content));
      } catch {
        prevRemoteCatalog = null;
      }
    } else if (getRes.status !== 404) {
      throw new Error(`Gagal cek versi file (HTTP ${getRes.status})`);
    }
    completedWeight += 0.5;

    // 3. Upload updated catalog.json with realtime byte progress
    const formattedJson = `${JSON.stringify(nextCatalog, null, 2)}\n`;
    const putPayload = await putGitHubFileWithProgress({
      owner,
      repo,
      branch,
      token,
      filePath: 'data/catalog.json',
      base64Content: encodeBase64Utf8(formattedJson),
      message: 'chore(catalog): update katalog via Panel Admin',
      sha: latestSha,
      onUploadProgress: (frac) =>
        updateWeightedProgress(frac * 1.8, 'Mengunggah catalog.json ke GitHub...'),
    });
    completedWeight += 1.8;

    // 4. Delete previous uploaded logo files that were replaced or removed
    const finalActiveSet = collectAllActiveUploadLogoPaths(nextCatalog);
    const allOrphansToDelete = [...new Set([...diffOrphans, ...adminState.deletedUploadPaths])].filter(
      (p) => p && !finalActiveSet.has(p)
    );

    let deletedLogosCount = 0;
    for (let i = 0; i < allOrphansToDelete.length; i += 1) {
      const orphanPath = allOrphansToDelete[i];
      updateWeightedProgress(
        0.2,
        `Membersihkan logo lama (${i + 1}/${allOrphansToDelete.length})...`
      );
      const removed = await deleteGitHubFile({
        owner,
        repo,
        branch,
        token,
        filePath: orphanPath,
        message: `chore(logo): hapus file logo lama ${orphanPath}`,
      });
      if (removed) deletedLogosCount += 1;
      completedWeight += 0.5;
    }

    // 5. Record change history & enforce log limit cleanly
    updateWeightedProgress(0.3, `Menyimpan riwayat perubahan (maks ${MAX_HISTORY_LOGS} log)...`);
    const baselineCatalog = prevRemoteCatalog || adminState.baseCatalog;
    const changeSummary = summarizeCatalogDiff(baselineCatalog, nextCatalog);
    const updatedLogs = recordLocalHistory(
      'publish',
      changeSummary,
      nextCatalog,
      baselineCatalog
    );
    try {
      await syncHistoryToGitHub({
        owner,
        repo,
        branch,
        token,
        logs: updatedLogs,
      });
    } catch {
      // Non-fatal: history stays safely saved locally
    }

    adminState.catalog = nextCatalog;
    adminState.baseCatalog = structuredClone(nextCatalog);
    adminState.lastPublishedProducts = extractPublishedLogoEntries(nextCatalog);
    adminState.remoteSha = putPayload.content?.sha || latestSha;
    adminState.source = 'github';
    adminState.dirty = false;
    clearPendingLogoOps();

    try {
      localStorage.removeItem(CATALOG_PREVIEW_STORAGE_KEY);
    } catch {
      // Ignore
    }

    updateSourceBadge();
    renderCategoryOptions();
    renderCategoryList();
    renderBrandSettings();
    renderFaqList();
    renderProductList();
    renderHistoryList();

    setPublishProgress({
      visible: true,
      percent: 100,
      label: 'Publikasi selesai & riwayat tercatat!',
    });

    const cleanupNote =
      deletedLogosCount > 0 ? ` (${deletedLogosCount} file logo lama otomatis dihapus)` : '';
    const uploadNote =
      uploadedLogosCount > 0 ? ` · ${uploadedLogosCount} logo baru diunggah` : '';
    setStatusBox(
      'admin-status-box',
      `Berhasil dipublikasikan ke GitHub!${uploadNote}${cleanupNote} (${changeSummary})`,
      'ok'
    );
    showToast('Perubahan katalog berhasil dipublikasikan ke GitHub.');
  } catch (err) {
    setPublishProgress({
      visible: true,
      percent: 0,
      label: `Gagal: ${err.message}`,
    });
    setStatusBox('admin-status-box', `Gagal mempublikasikan: ${err.message}`, 'error');
  } finally {
    adminState.isPublishing = false;
    if (publishBtn) publishBtn.disabled = false;
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
      adminState.catalog.brand = normalizeBrandConfig(adminState.catalog.brand || {});
      adminState.catalog.paymentOptions = syncPaymentOptionsWithBrand(
        adminState.catalog.paymentOptions,
        adminState.catalog.brand
      );
      localStorage.setItem(CATALOG_PREVIEW_STORAGE_KEY, JSON.stringify(adminState.catalog));
      persistPendingLogoOps();
      recordLocalHistory('preview', null, adminState.catalog);
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

  document.getElementById('snapshot-history-btn')?.addEventListener('click', () => {
    if (!adminState.unlocked) return;
    recordLocalHistory('manual', null, adminState.catalog);
    showToast(`Snapshot disimpan ke riwayat (maks ${MAX_HISTORY_LOGS} log).`);
  });

  document.getElementById('clear-history-btn')?.addEventListener('click', () => {
    if (!adminState.unlocked) return;
    saveLocalHistory([]);
    renderHistoryList();
    showToast('Seluruh log riwayat lokal dibersihkan.');
  });

  document.getElementById('clear-preview-btn')?.addEventListener('click', async () => {
    if (!adminState.unlocked) return;
    try {
      localStorage.removeItem(CATALOG_PREVIEW_STORAGE_KEY);
    } catch {
      // Ignore
    }
    clearPendingLogoOps();
    const fresh = await loadCatalogData({ allowLocalPreview: false });
    fresh.data.brand = normalizeBrandConfig(fresh.data.brand || {});
    fresh.data.paymentOptions = syncPaymentOptionsWithBrand(
      fresh.data.paymentOptions,
      fresh.data.brand
    );
    adminState.catalog = fresh.data;
    adminState.baseCatalog = structuredClone(fresh.data);
    adminState.lastPublishedProducts = extractPublishedLogoEntries(fresh.data);
    adminState.source = fresh.source;
    adminState.dirty = false;
    updateSourceBadge();
    renderCategoryOptions();
    renderCategoryList();
    renderBrandSettings();
    renderFaqList();
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
      if (adminState.activeTab === 'history') {
        renderHistoryList();
      } else if (adminState.activeTab === 'categories') {
        renderCategoryList();
      } else if (adminState.activeTab === 'brand') {
        renderBrandSettings();
      } else if (adminState.activeTab === 'faq') {
        renderFaqList();
      }
    });
  });

  document.getElementById('admin-product-search')?.addEventListener('input', (e) => {
    adminState.searchQuery = e.target.value;
    renderProductList();
  });

  // Add New Product Logo Mode Tabs + Listeners
  document.querySelectorAll('[data-new-logo-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.getAttribute('data-new-logo-mode');
      if (mode !== 'upload' && mode !== 'link') return;
      adminState.newProdLogoMode = mode;
      syncNewProductLogoUi();
    });
  });

  const presetEl = document.getElementById('new-prod-logo-preset');
  const logoUrlEl = document.getElementById('new-prod-logo-url');
  const newProdFileEl = document.getElementById('new-prod-logo-file');

  presetEl?.addEventListener('change', () => {
    if (logoUrlEl && presetEl.value) {
      logoUrlEl.value = presetEl.value;
      adminState.newProdPendingUpload = null;
      syncNewProductLogoUi();
    }
  });

  logoUrlEl?.addEventListener('input', () => {
    adminState.newProdPendingUpload = null;
    syncNewProductLogoUi();
  });

  newProdFileEl?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await compressLogoFile(file);
      adminState.newProdPendingUpload = {
        ...result,
        fileName: file.name,
      };
      adminState.newProdLogoMode = 'upload';
      syncNewProductLogoUi();
      showToast(`Logo "${file.name}" siap untuk produk baru.`);
    } catch (err) {
      showToast(err.message || 'Gagal membaca file logo.');
    }
  });

  document.getElementById('add-product-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!adminState.unlocked) return;
    const name = document.getElementById('new-prod-name')?.value.trim() || '';
    const category = document.getElementById('new-prod-category')?.value || 'streaming';
    const pendingUpload =
      adminState.newProdLogoMode === 'upload' ? adminState.newProdPendingUpload : null;
    const logo = pendingUpload
      ? pendingUpload.previewDataUrl
      : document.getElementById('new-prod-logo-url')?.value.trim() ||
        './assets/logos/custom-request.svg';
    const tag = document.getElementById('new-prod-tag')?.value.trim() || 'Tersedia';
    const summary = document.getElementById('new-prod-summary')?.value.trim() || '';
    const variantName = document.getElementById('new-prod-variant-name')?.value.trim() || '';
    const variantPrice = Number(document.getElementById('new-prod-variant-price')?.value || 0);

    try {
      const newProdId = slugifyId(name);
      adminState.catalog = upsertProductInCatalog(adminState.catalog, {
        id: newProdId,
        name,
        category,
        logo,
        tag,
        summary,
        variants: [{ name: variantName, price: variantPrice, outOfStock: false }],
      });

      if (pendingUpload) {
        adminState.pendingUploads[newProdId] = {
          targetPath: `assets/logos/uploads/${newProdId}-${Date.now().toString(36)}.${pendingUpload.ext}`,
          base64Content: pendingUpload.base64Content,
          previewDataUrl: pendingUpload.previewDataUrl,
          fileName: pendingUpload.fileName,
        };
        adminState.logoEditMode[newProdId] = 'upload';
      }

      markDirty();
      e.target.reset();
      adminState.newProdPendingUpload = null;
      adminState.newProdLogoMode = 'upload';
      if (logoUrlEl) logoUrlEl.value = './assets/logos/custom-request.svg';
      syncNewProductLogoUi();
      renderCategoryList();

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

  // Kategori Layanan Baru
  document.getElementById('add-category-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!adminState.unlocked) return;
    const label = document.getElementById('new-category-label')?.value.trim() || '';
    const customId = document.getElementById('new-category-id')?.value.trim() || '';
    try {
      adminState.catalog = upsertCategoryInCatalog(adminState.catalog, {
        id: customId ? slugifyId(customId) : slugifyId(label),
        label,
      });
      markDirty();
      e.target.reset();
      renderCategoryOptions();
      renderCategoryList();
      renderProductList();
      showToast(`Kategori layanan "${label}" berhasil ditambahkan.`);
    } catch (err) {
      showToast(err.message || 'Gagal menambah kategori.');
    }
  });

  // Brand Logo Mode & Upload / Link / Reset
  document.querySelectorAll('[data-brand-logo-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.getAttribute('data-brand-logo-mode');
      if (mode !== 'upload' && mode !== 'link') return;
      adminState.brandLogoMode = mode;
      syncBrandLogoUi();
    });
  });

  document.getElementById('brand-logo-file')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file || !adminState.unlocked) return;
    try {
      const result = await compressLogoFile(file);
      adminState.catalog.brand = normalizeBrandConfig(adminState.catalog.brand || {});
      queueManagedLogoForDeletion(adminState.catalog.brand.logo);
      const targetPath = `assets/logos/uploads/brand-${Date.now().toString(36)}.${result.ext}`;
      adminState.pendingUploads['__brand_logo__'] = {
        targetPath,
        base64Content: result.base64Content,
        previewDataUrl: result.previewDataUrl,
        fileName: file.name,
      };
      adminState.catalog.brand.logo = result.previewDataUrl;
      adminState.brandLogoMode = 'upload';
      markDirty();
      syncBrandLogoUi();
      showToast(`Logo brand "${file.name}" siap diunggah saat Publikasi.`);
    } catch (err) {
      showToast(err.message || 'Gagal memproses file logo brand.');
    }
  });

  document.getElementById('brand-logo-url')?.addEventListener('input', (e) => {
    if (!adminState.unlocked) return;
    const nextUrl = e.target.value.trim();
    if (!nextUrl) return;
    adminState.catalog.brand = normalizeBrandConfig(adminState.catalog.brand || {});
    queueManagedLogoForDeletion(adminState.catalog.brand.logo);
    delete adminState.pendingUploads['__brand_logo__'];
    adminState.catalog.brand.logo = nextUrl;
    markDirty();
    syncBrandLogoUi();
  });

  document.getElementById('brand-logo-reset-btn')?.addEventListener('click', () => {
    if (!adminState.unlocked) return;
    adminState.catalog.brand = normalizeBrandConfig(adminState.catalog.brand || {});
    queueManagedLogoForDeletion(adminState.catalog.brand.logo);
    delete adminState.pendingUploads['__brand_logo__'];
    adminState.catalog.brand.logo = './assets/icons/brand-icon.svg';
    markDirty();
    syncBrandLogoUi();
    showToast('Logo brand dikembalikan ke logo default Manifestudio.');
  });

  // Brand Identity & Service Fee Live Inputs
  const bindBrandField = (inputId, applyFn) => {
    document.getElementById(inputId)?.addEventListener('input', (e) => {
      if (!adminState.unlocked) return;
      adminState.catalog.brand = normalizeBrandConfig(adminState.catalog.brand || {});
      applyFn(adminState.catalog.brand, e.target.value);
      adminState.catalog.paymentOptions = syncPaymentOptionsWithBrand(
        adminState.catalog.paymentOptions,
        adminState.catalog.brand
      );
      markDirty();
    });
  };

  bindBrandField('brand-name-input', (b, val) => {
    b.name = val.trim() || 'Manifestudio';
  });
  bindBrandField('brand-tagline-input', (b, val) => {
    b.tagline = val.trim() || 'Premium Account by Tomy';
  });
  bindBrandField('brand-footer-input', (b, val) => {
    b.footerText = val.trim() || 'Dikelola oleh Manifestudio by Tomy © 2026';
  });
  bindBrandField('brand-paylater-pct-input', (b, val) => {
    const pct = Math.max(0, Math.min(100, Number(val) || 0));
    b.payLaterSurchargeRate = Math.round(pct * 10) / 1000;
  });
  bindBrandField('brand-service-fee-flat-input', (b, val) => {
    b.serviceFeeFlat = Math.max(0, Math.round(Number(val) || 0));
  });
  bindBrandField('brand-service-fee-label-input', (b, val) => {
    b.serviceFeeLabel = val.trim() || 'Biaya Layanan';
  });
  bindBrandField('brand-whatsapp-input', (b, val) => {
    const cleanWa = val.replace(/[^0-9]/g, '') || '6285122936027';
    b.whatsappNumber = cleanWa;
    const waSocial = (b.socials || []).find((s) => s.id === 'social-whatsapp');
    if (waSocial) {
      waSocial.url = `https://wa.me/${cleanWa}`;
      waSocial.handle = `+${cleanWa}`;
      renderSocialList();
    }
  });
  bindBrandField('brand-discount-threshold-input', (b, val) => {
    b.discountThreshold = Math.max(0, Math.round(Number(val) || 0));
  });
  bindBrandField('brand-discount-amount-input', (b, val) => {
    b.discountAmount = Math.max(0, Math.round(Number(val) || 0));
  });

  // Add New Social Media / Contact Form
  const newSocPresetEl = document.getElementById('new-social-logo-preset');
  const newSocUrlEl = document.getElementById('new-social-logo-url');
  const newSocPreviewEl = document.getElementById('new-social-logo-preview');
  const newSocStatusEl = document.getElementById('new-social-logo-status');
  const newSocFileEl = document.getElementById('new-social-logo-file');

  newSocPresetEl?.addEventListener('change', () => {
    if (newSocUrlEl && newSocPresetEl.value) {
      newSocUrlEl.value = newSocPresetEl.value;
      adminState.newSocialPendingUpload = null;
      if (newSocPreviewEl) newSocPreviewEl.src = newSocPresetEl.value;
      if (newSocStatusEl) newSocStatusEl.textContent = `Preset dipilih: ${newSocPresetEl.value}`;
    }
  });

  newSocUrlEl?.addEventListener('input', () => {
    const val = newSocUrlEl.value.trim();
    if (!val) return;
    adminState.newSocialPendingUpload = null;
    if (newSocPreviewEl) newSocPreviewEl.src = val;
    if (newSocStatusEl) newSocStatusEl.textContent = `Link logo: ${val}`;
  });

  newSocFileEl?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await compressLogoFile(file);
      adminState.newSocialPendingUpload = {
        ...result,
        fileName: file.name,
      };
      if (newSocPreviewEl) newSocPreviewEl.src = result.previewDataUrl;
      if (newSocStatusEl) newSocStatusEl.textContent = `File siap: ${file.name}`;
      showToast(`Logo sosmed "${file.name}" siap ditambahkan.`);
    } catch (err) {
      showToast(err.message || 'Gagal membaca file logo sosmed.');
    }
  });

  document.getElementById('add-social-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!adminState.unlocked) return;
    const label = document.getElementById('new-social-label')?.value.trim() || '';
    const url = document.getElementById('new-social-url')?.value.trim() || '';
    const pendingUpload = adminState.newSocialPendingUpload;
    const logo = pendingUpload
      ? pendingUpload.previewDataUrl
      : newSocUrlEl?.value.trim() || './assets/icons/social-globe.svg';

    try {
      const socialId = `social-${slugifyId(label)}-${Date.now().toString(36).slice(-3)}`;
      adminState.catalog = upsertSocialInCatalog(adminState.catalog, {
        id: socialId,
        platform: label,
        label,
        url,
        logo,
      });

      if (pendingUpload) {
        adminState.pendingUploads[`__social__${socialId}`] = {
          targetPath: `assets/logos/uploads/${socialId}.${pendingUpload.ext}`,
          base64Content: pendingUpload.base64Content,
          previewDataUrl: pendingUpload.previewDataUrl,
          fileName: pendingUpload.fileName,
        };
      }

      markDirty();
      e.target.reset();
      adminState.newSocialPendingUpload = null;
      if (newSocUrlEl) newSocUrlEl.value = './assets/icons/social-whatsapp.svg';
      if (newSocPreviewEl) newSocPreviewEl.src = './assets/icons/social-whatsapp.svg';
      if (newSocStatusEl) {
        newSocStatusEl.textContent = 'Bisa pilih preset, link URL, atau upload gambar sendiri.';
      }
      renderSocialList();
      showToast(`Kontak / sosmed "${label}" berhasil ditambahkan.`);
    } catch (err) {
      showToast(err.message || 'Gagal menambah kontak sosmed.');
    }
  });

  // Add FAQ Form
  document.getElementById('add-faq-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!adminState.unlocked) return;
    const question = document.getElementById('new-faq-question')?.value.trim() || '';
    const answer = document.getElementById('new-faq-answer')?.value.trim() || '';
    try {
      adminState.catalog = upsertFaqInCatalog(adminState.catalog, { question, answer });
      markDirty();
      e.target.reset();
      renderFaqList();
      showToast('Pertanyaan umum (FAQ) baru berhasil ditambahkan.');
    } catch (err) {
      showToast(err.message || 'Pertanyaan dan jawaban wajib diisi.');
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
  if (
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ) {
    window.__unlockAdminForLocalVerification = () => openUnlockedDashboard();
  }
}

bootstrapAdmin();
