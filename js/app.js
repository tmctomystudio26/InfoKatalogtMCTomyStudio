import {
  BRAND,
  CATEGORIES,
  CATEGORY_LABELS,
  FAQ_ITEMS,
  ORDER_STEPS,
  PAYMENT_OPTIONS,
  PRODUCTS,
} from './data.js';
import {
  addToCart,
  buildWhatsAppOrderMessage,
  calculateCartTotals,
  filterProducts,
  formatRupiah,
  getStartingPrice,
  removeFromCart,
  updateCartQty,
  validateOrderForm,
} from './store.js';
import { initPwaManager } from './pwa.js';

const THEME_STORAGE_KEY = 'manifestudio_theme_v2';
const CART_STORAGE_KEY = 'manifestudio_cart_v1';
const NAME_STORAGE_KEY = 'manifestudio_customer_name_v1';

const state = {
  theme: 'light',
  category: 'all',
  query: '',
  inStockOnly: false,
  cart: [],
  customerName: '',
  paymentOption: PAYMENT_OPTIONS[0].id,
  whatsappNote: '',
  checkoutError: '',
  generatedOrderUrl: '',
  generatedOrderSummary: '',
  copiedNotice: false,
  activeProductId: null,
  isCartOpen: false,
  openFaqIndex: 0,
};

function loadPersistedState() {
  try {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme === 'light' || savedTheme === 'dark') {
      state.theme = savedTheme;
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      state.theme = 'dark';
    }

    const savedCart = localStorage.getItem(CART_STORAGE_KEY);
    if (savedCart) {
      const parsed = JSON.parse(savedCart);
      if (Array.isArray(parsed)) {
        state.cart = parsed.filter(
          (item) => item && item.productId && item.variantId && Number.isFinite(item.quantity)
        );
      }
    }

    const savedName = localStorage.getItem(NAME_STORAGE_KEY);
    if (savedName) {
      state.customerName = savedName;
    }
  } catch {
    // Fallback silently if storage is blocked
  }
}

function saveCart() {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(state.cart));
  } catch {
    // Ignore
  }
}

function saveTheme(theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Ignore
  }
}

function saveCustomerName(name) {
  try {
    localStorage.setItem(NAME_STORAGE_KEY, name);
  } catch {
    // Ignore
  }
}

function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function applyTheme() {
  document.documentElement.setAttribute('data-theme', state.theme);
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.setAttribute('content', state.theme === 'dark' ? '#0E0E0D' : '#F5F4F0');
  }

  document.querySelectorAll('[data-theme-choice]').forEach((btn) => {
    const val = btn.getAttribute('data-theme-choice');
    const isActive = val === state.theme;
    btn.classList.toggle('is-active', isActive);
    btn.setAttribute('aria-pressed', String(isActive));
  });
}

function renderCategories() {
  const container = document.getElementById('category-tabs');
  if (!container) return;

  container.innerHTML = CATEGORIES.map((cat) => {
    const active = state.category === cat.id;
    return `
      <button
        type="button"
        class="seg-btn ${active ? 'is-active' : ''}"
        data-category="${escapeHtml(cat.id)}"
        aria-pressed="${active}"
      >
        ${escapeHtml(cat.label)}
      </button>
    `;
  }).join('');

  container.querySelectorAll('.seg-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.category = btn.getAttribute('data-category') || 'all';
      renderCategories();
      renderCatalog();
    });
  });
}

function renderCatalog() {
  const grid = document.getElementById('product-grid');
  const countLabel = document.getElementById('catalog-count');
  if (!grid) return;

  const filtered = filterProducts(PRODUCTS, {
    category: state.category,
    query: state.query,
    inStockOnly: state.inStockOnly,
  });

  if (countLabel) {
    countLabel.textContent = `${filtered.length} layanan`;
  }

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <h3>Layanan tidak ditemukan</h3>
        <p>Coba kata kunci lain atau tampilkan kembali seluruh kategori.</p>
        <button type="button" class="btn btn-secondary btn-sm" id="reset-filters-btn">Tampilkan Semua</button>
      </div>
    `;
    document.getElementById('reset-filters-btn')?.addEventListener('click', () => {
      state.category = 'all';
      state.query = '';
      state.inStockOnly = false;
      const searchEl = document.getElementById('catalog-search');
      if (searchEl) searchEl.value = '';
      const clearBtn = document.getElementById('clear-search-btn');
      if (clearBtn) clearBtn.hidden = true;
      const stockToggle = document.getElementById('in-stock-toggle');
      if (stockToggle) stockToggle.checked = false;
      renderCategories();
      renderCatalog();
    });
    return;
  }

  grid.innerHTML = filtered
    .map((product) => {
      const startPrice = getStartingPrice(product);
      const isCustom = product.category === 'custom';
      const priceDisplay = isCustom ? 'Harga fleksibel' : `Mulai ${formatRupiah(startPrice)}`;
      const catLabel = CATEGORY_LABELS[product.category] || 'Layanan';
      const statusText = product.outOfStock
        ? product.restockMessage || 'Segera restock'
        : product.tag || 'Tersedia';

      return `
        <article class="product-card ${product.outOfStock ? 'is-restock' : ''}">
          <div class="product-media-row">
            <div class="product-logo-frame">
              <img
                src="${escapeHtml(product.logo)}"
                alt="Logo ${escapeHtml(product.name)}"
                width="52"
                height="52"
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            </div>
            <div class="product-meta-line ${product.outOfStock ? 'is-warn' : ''}">
              <span>${escapeHtml(catLabel)}</span>
              <span aria-hidden="true">·</span>
              <span>${escapeHtml(statusText)}</span>
            </div>
          </div>

          <div class="product-copy">
            <h3 class="product-title">${escapeHtml(product.name)}</h3>
            <p class="product-summary">${escapeHtml(product.summary)}</p>
          </div>

          <div class="product-foot">
            <div class="product-price-block">
              <span class="product-variant-count">${product.variants.length} varian</span>
              <span class="product-price">${escapeHtml(priceDisplay)}</span>
            </div>
            <button
              type="button"
              class="btn ${product.outOfStock ? 'btn-secondary' : 'btn-primary'} btn-sm select-product-btn"
              data-product-id="${escapeHtml(product.id)}"
              aria-label="${product.outOfStock ? 'Lihat detail' : 'Pilih paket'} ${escapeHtml(product.name)}"
            >
              ${product.outOfStock ? 'Lihat Detail' : isCustom ? 'Ajukan' : 'Pilih Paket'}
            </button>
          </div>
        </article>
      `;
    })
    .join('');

  grid.querySelectorAll('.select-product-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-product-id');
      if (id) openProductModal(id);
    });
  });
}

function renderOrderSteps() {
  const container = document.getElementById('order-steps-list');
  if (!container) return;

  container.innerHTML = ORDER_STEPS.map(
    (item) => `
      <li class="editorial-step">
        <h3 class="editorial-step-title">${escapeHtml(item.step)}</h3>
        <p class="editorial-step-desc">${escapeHtml(item.detail)}</p>
      </li>
    `
  ).join('');
}

function renderFaq() {
  const container = document.getElementById('faq-list');
  if (!container) return;

  container.innerHTML = FAQ_ITEMS.map((item, idx) => {
    const isOpen = state.openFaqIndex === idx;
    return `
      <div class="faq-item ${isOpen ? 'is-open' : ''}">
        <button
          type="button"
          class="faq-trigger"
          data-faq-idx="${idx}"
          aria-expanded="${isOpen}"
        >
          <span>${escapeHtml(item.question)}</span>
          <svg class="faq-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
        </button>
        <div class="faq-panel" ${isOpen ? '' : 'hidden'}>
          <p>${escapeHtml(item.answer)}</p>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.faq-trigger').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.getAttribute('data-faq-idx'));
      state.openFaqIndex = state.openFaqIndex === idx ? -1 : idx;
      renderFaq();
    });
  });
}

function openProductModal(productId) {
  state.activeProductId = productId;
  renderProductModal();
}

function closeProductModal() {
  state.activeProductId = null;
  const overlay = document.getElementById('product-modal-overlay');
  if (overlay) {
    overlay.hidden = true;
    overlay.innerHTML = '';
  }
}

function renderProductModal() {
  const overlay = document.getElementById('product-modal-overlay');
  if (!overlay) return;

  const product = PRODUCTS.find((p) => p.id === state.activeProductId);
  if (!product) {
    overlay.hidden = true;
    overlay.innerHTML = '';
    return;
  }

  overlay.hidden = false;

  const variantsHtml = product.variants
    .map((variant) => {
      const priceLabel =
        variant.price === 0 ? 'Konsultasi / Custom' : formatRupiah(variant.price);
      const oldPriceHtml =
        variant.oldPrice && variant.oldPrice > 0
          ? `<span class="variant-old-price">${escapeHtml(formatRupiah(variant.oldPrice))}</span>`
          : '';
      const unavailable = Boolean(variant.outOfStock);

      return `
        <div class="variant-row ${unavailable ? 'is-disabled' : ''}">
          <div class="variant-info">
            <div class="variant-name">${escapeHtml(variant.name)}</div>
            ${
              variant.description
                ? `<p class="variant-desc">${escapeHtml(variant.description)}</p>`
                : ''
            }
            ${
              unavailable
                ? `<span class="variant-restock">${escapeHtml(variant.restockMessage || 'Stok habis sementara')}</span>`
                : ''
            }
          </div>
          <div class="variant-action">
            <div class="variant-price-stack">
              ${oldPriceHtml}
              <span class="variant-price">${escapeHtml(priceLabel)}</span>
            </div>
            <button
              type="button"
              class="btn ${unavailable ? 'btn-secondary' : 'btn-primary'} btn-xs add-variant-btn"
              data-variant-id="${escapeHtml(variant.id)}"
              ${unavailable ? 'disabled' : ''}
              aria-label="Tambah ${escapeHtml(product.name)} ${escapeHtml(variant.name)} ke keranjang"
            >
              ${unavailable ? 'Habis' : '+ Tambah'}
            </button>
          </div>
        </div>
      `;
    })
    .join('');

  overlay.innerHTML = `
    <div class="modal-backdrop" id="product-modal-backdrop"></div>
    <div class="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="modal-product-title">
      <div class="modal-header">
        <div class="modal-brand-row">
          <img src="${escapeHtml(product.logo)}" alt="" width="44" height="44" class="modal-logo" referrerPolicy="no-referrer" />
          <div>
            <h2 id="modal-product-title">${escapeHtml(product.name)}</h2>
            <p class="modal-subtitle">${escapeHtml(product.summary)}</p>
          </div>
        </div>
        <button type="button" class="icon-close-btn" id="close-product-modal-btn" aria-label="Tutup detail produk">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
      </div>

      ${
        product.notice
          ? `<div class="modal-notice" role="note">${escapeHtml(product.notice)}</div>`
          : ''
      }
      ${
        product.outOfStock
          ? `<div class="modal-notice is-warn" role="note">Produk ini sedang menunggu restock. Cek berkala atau hubungi admin untuk pre-order.</div>`
          : ''
      }

      <div class="variant-list">
        ${variantsHtml}
      </div>

      <div class="modal-footer">
        <span class="modal-hint">Pesanan diproses via WhatsApp Admin</span>
        <button type="button" class="btn btn-secondary btn-sm" id="modal-open-cart-btn">
          Lihat Keranjang (${calculateCartTotals(state.cart).itemCount})
        </button>
      </div>
    </div>
  `;

  overlay.querySelector('#product-modal-backdrop')?.addEventListener('click', closeProductModal);
  overlay.querySelector('#close-product-modal-btn')?.addEventListener('click', closeProductModal);
  overlay.querySelector('#modal-open-cart-btn')?.addEventListener('click', () => {
    closeProductModal();
    openCartDrawer();
  });

  overlay.querySelectorAll('.add-variant-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const variantId = btn.getAttribute('data-variant-id');
      const variant = product.variants.find((v) => v.id === variantId);
      if (!variant || variant.outOfStock) return;

      state.cart = addToCart(state.cart, {
        productId: product.id,
        productName: product.name,
        variantId: variant.id,
        variantName: variant.name,
        price: variant.price,
        logo: product.logo,
      });
      state.generatedOrderUrl = '';
      state.checkoutError = '';
      saveCart();
      updateCartIndicators();

      btn.textContent = 'Ditambahkan';
      btn.classList.add('is-added');
      const openCartShortcut = overlay.querySelector('#modal-open-cart-btn');
      if (openCartShortcut) {
        openCartShortcut.textContent = `Buka Keranjang (${calculateCartTotals(state.cart).itemCount})`;
      }
      showToast(`${product.name} (${variant.name}) masuk keranjang`);
    });
  });
}

function openCartDrawer() {
  state.isCartOpen = true;
  renderCartDrawer();
}

function closeCartDrawer() {
  state.isCartOpen = false;
  renderCartDrawer();
}

function updateCartIndicators() {
  const totals = calculateCartTotals(state.cart, {
    discountThreshold: BRAND.discountThreshold,
    discountAmount: BRAND.discountAmount,
  });

  const countEl = document.getElementById('header-cart-count');
  if (countEl) {
    countEl.textContent = totals.itemCount > 0 ? `(${totals.itemCount})` : '';
  }

  const floatCartCount = document.getElementById('mobile-cart-count');
  const floatCartTotal = document.getElementById('mobile-cart-total');
  const floatBar = document.getElementById('mobile-cart-bar');
  if (floatBar && floatCartCount && floatCartTotal) {
    floatBar.hidden = totals.itemCount === 0;
    floatCartCount.textContent = `${totals.itemCount} item`;
    floatCartTotal.textContent = formatRupiah(totals.total);
  }
}

function renderCartDrawer() {
  const drawerRoot = document.getElementById('cart-drawer-root');
  if (!drawerRoot) return;

  updateCartIndicators();

  if (!state.isCartOpen) {
    drawerRoot.hidden = true;
    drawerRoot.innerHTML = '';
    return;
  }

  drawerRoot.hidden = false;

  const totals = calculateCartTotals(state.cart, {
    discountThreshold: BRAND.discountThreshold,
    discountAmount: BRAND.discountAmount,
  });

  const progressText = totals.qualifiesDiscount
    ? `Diskon ${formatRupiah(BRAND.discountAmount)} otomatis aktif.`
    : `Tambah ${formatRupiah(totals.remainingForDiscount)} lagi untuk diskon ${formatRupiah(BRAND.discountAmount)}.`;

  const itemsHtml =
    state.cart.length === 0
      ? `
        <div class="cart-empty">
          <p>Keranjang belanja masih kosong.</p>
          <span>Pilih paket aplikasi dari katalog untuk memulai pesanan.</span>
        </div>
      `
      : state.cart
          .map(
            (item) => `
          <div class="cart-item">
            <img src="${escapeHtml(item.logo || './assets/icons/brand-icon.svg')}" alt="" width="36" height="36" class="cart-item-logo" referrerPolicy="no-referrer" />
            <div class="cart-item-info">
              <div class="cart-item-name">${escapeHtml(item.productName)}</div>
              <div class="cart-item-variant">${escapeHtml(item.variantName)}</div>
              <div class="cart-item-price">
                ${item.price === 0 ? 'Custom / Tanya Admin' : formatRupiah(item.price * item.quantity)}
              </div>
            </div>
            <div class="cart-item-controls">
              <button
                type="button"
                class="qty-btn"
                data-action="dec"
                data-product-id="${escapeHtml(item.productId)}"
                data-variant-id="${escapeHtml(item.variantId)}"
                aria-label="Kurangi jumlah ${escapeHtml(item.productName)} ${escapeHtml(item.variantName)}"
              >−</button>
              <span class="qty-value">${item.quantity}</span>
              <button
                type="button"
                class="qty-btn"
                data-action="inc"
                data-product-id="${escapeHtml(item.productId)}"
                data-variant-id="${escapeHtml(item.variantId)}"
                aria-label="Tambah jumlah ${escapeHtml(item.productName)} ${escapeHtml(item.variantName)}"
              >+</button>
              <button
                type="button"
                class="remove-item-btn"
                data-action="remove"
                data-product-id="${escapeHtml(item.productId)}"
                data-variant-id="${escapeHtml(item.variantId)}"
                aria-label="Hapus ${escapeHtml(item.productName)} ${escapeHtml(item.variantName)}"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
              </button>
            </div>
          </div>
        `
          )
          .join('');

  const paymentHtml = PAYMENT_OPTIONS.map((opt) => {
    const checked = state.paymentOption === opt.id;
    return `
      <label class="payment-option ${checked ? 'is-selected' : ''}">
        <input
          type="radio"
          name="paymentOption"
          value="${escapeHtml(opt.id)}"
          ${checked ? 'checked' : ''}
        />
        <div>
          <span class="payment-title">${escapeHtml(opt.label)}</span>
          <span class="payment-note">${escapeHtml(opt.note)}</span>
        </div>
      </label>
    `;
  }).join('');

  drawerRoot.innerHTML = `
    <div class="drawer-backdrop" id="cart-backdrop"></div>
    <aside class="cart-drawer" role="dialog" aria-modal="true" aria-label="Keranjang Belanja &amp; Checkout">
      <div class="drawer-header">
        <div>
          <h2>Keranjang Pesanan</h2>
          <p class="drawer-sub">${totals.itemCount} item dipilih</p>
        </div>
        <button type="button" class="icon-close-btn" id="close-cart-btn" aria-label="Tutup keranjang belanja">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
      </div>

      <div class="drawer-body">
        <div class="discount-progress-card">
          <div class="discount-progress-text">${escapeHtml(progressText)}</div>
          <div class="discount-track" aria-hidden="true">
            <div class="discount-fill" style="width: ${totals.progressPercent}%"></div>
          </div>
        </div>

        <div class="cart-items-list">
          ${itemsHtml}
        </div>

        ${
          state.cart.length > 0
            ? `
          <form id="checkout-form" class="checkout-form" novalidate>
            <div class="summary-breakdown">
              <div class="summary-row">
                <span>Subtotal</span>
                <span class="mono-num">${escapeHtml(formatRupiah(totals.subtotal))}</span>
              </div>
              <div class="summary-row ${totals.discount > 0 ? 'is-discount' : ''}">
                <span>Diskon Belanja</span>
                <span class="mono-num">-${escapeHtml(formatRupiah(totals.discount))}</span>
              </div>
              <div class="summary-row is-total">
                <span>Total Bayar</span>
                <span class="mono-num">${escapeHtml(formatRupiah(totals.total))}</span>
              </div>
            </div>

            <div class="form-field">
              <label for="checkout-name">Nama Panggilan <span class="req">*</span></label>
              <input
                type="text"
                id="checkout-name"
                name="customerName"
                placeholder="Contoh: Andi"
                value="${escapeHtml(state.customerName)}"
                autocomplete="name"
                required
              />
            </div>

            <div class="form-field">
              <span class="field-label">Metode Pembayaran</span>
              <div class="payment-options">
                ${paymentHtml}
              </div>
            </div>

            <div class="form-field">
              <label for="checkout-note">Catatan / Email Tujuan (Opsional)</label>
              <input
                type="text"
                id="checkout-note"
                name="whatsappNote"
                placeholder="Contoh: Email Canva andi@gmail.com"
                value="${escapeHtml(state.whatsappNote)}"
              />
            </div>

            ${
              state.checkoutError
                ? `<div class="form-error" role="alert">${escapeHtml(state.checkoutError)}</div>`
                : ''
            }

            <button type="submit" class="btn btn-primary btn-full">
              Buat Pesanan WhatsApp
            </button>

            ${
              state.generatedOrderUrl
                ? `
              <div class="order-ready-box" role="status">
                <p class="order-ready-title">Format Pesanan Siap Dikirim</p>
                <p class="order-ready-desc">Klik tombol di bawah untuk langsung membuka chat WhatsApp Admin Manifestudio.</p>
                <div class="order-ready-actions">
                  <a
                    href="${escapeHtml(state.generatedOrderUrl)}"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="btn btn-primary btn-sm"
                    id="open-whatsapp-link"
                  >
                    Buka WhatsApp Admin
                  </a>
                  <button type="button" class="btn btn-secondary btn-sm" id="copy-order-btn">
                    ${state.copiedNotice ? 'Tersalin' : 'Salin Teks'}
                  </button>
                </div>
              </div>
            `
                : ''
            }
          </form>
        `
            : ''
        }
      </div>
    </aside>
  `;

  drawerRoot.querySelector('#cart-backdrop')?.addEventListener('click', closeCartDrawer);
  drawerRoot.querySelector('#close-cart-btn')?.addEventListener('click', closeCartDrawer);

  drawerRoot.querySelectorAll('[data-action]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const action = btn.getAttribute('data-action');
      const productId = btn.getAttribute('data-product-id');
      const variantId = btn.getAttribute('data-variant-id');
      if (!productId || !variantId) return;

      if (action === 'inc') {
        state.cart = updateCartQty(state.cart, productId, variantId, 1);
      } else if (action === 'dec') {
        state.cart = updateCartQty(state.cart, productId, variantId, -1);
      } else if (action === 'remove') {
        state.cart = removeFromCart(state.cart, productId, variantId);
      }
      state.generatedOrderUrl = '';
      saveCart();
      renderCartDrawer();
    });
  });

  drawerRoot.querySelector('#checkout-name')?.addEventListener('input', (e) => {
    state.customerName = e.target.value;
    state.checkoutError = '';
    saveCustomerName(state.customerName);
  });

  drawerRoot.querySelector('#checkout-note')?.addEventListener('input', (e) => {
    state.whatsappNote = e.target.value;
  });

  drawerRoot.querySelectorAll('input[name="paymentOption"]').forEach((radio) => {
    radio.addEventListener('change', (e) => {
      state.paymentOption = e.target.value;
      renderCartDrawer();
    });
  });

  drawerRoot.querySelector('#checkout-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const validation = validateOrderForm({
      customerName: state.customerName,
      paymentOption: state.paymentOption,
      cart: state.cart,
    });

    if (!validation.valid) {
      state.checkoutError = validation.error || 'Periksa kembali data pesanan.';
      state.generatedOrderUrl = '';
      renderCartDrawer();
      return;
    }

    const encodedMessage = buildWhatsAppOrderMessage({
      customerName: state.customerName,
      whatsappNote: state.whatsappNote,
      paymentOption: state.paymentOption,
      cart: state.cart,
      totals,
    });

    state.checkoutError = '';
    state.copiedNotice = false;
    state.generatedOrderUrl = `https://wa.me/${BRAND.whatsappNumber}?text=${encodedMessage}`;
    state.generatedOrderSummary = decodeURIComponent(encodedMessage);
    renderCartDrawer();
  });

  drawerRoot.querySelector('#copy-order-btn')?.addEventListener('click', async () => {
    if (!state.generatedOrderSummary) return;
    try {
      await navigator.clipboard.writeText(state.generatedOrderSummary);
      state.copiedNotice = true;
      renderCartDrawer();
    } catch {
      showToast('Salin teks gagal, gunakan tombol Buka WhatsApp Admin.');
    }
  });
}

let toastTimer = null;
function showToast(message) {
  const toast = document.getElementById('toast-notification');
  if (!toast) return;
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, 2400);
}

function bindGlobalEvents() {
  document.querySelectorAll('[data-theme-choice]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = btn.getAttribute('data-theme-choice');
      if (next === 'light' || next === 'dark') {
        state.theme = next;
        saveTheme(next);
        applyTheme();
      }
    });
  });

  const searchInput = document.getElementById('catalog-search');
  const clearSearchBtn = document.getElementById('clear-search-btn');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.query = e.target.value;
      if (clearSearchBtn) {
        clearSearchBtn.hidden = state.query.trim().length === 0;
      }
      renderCatalog();
    });
  }
  clearSearchBtn?.addEventListener('click', () => {
    state.query = '';
    if (searchInput) searchInput.value = '';
    clearSearchBtn.hidden = true;
    renderCatalog();
  });

  document.getElementById('in-stock-toggle')?.addEventListener('change', (e) => {
    state.inStockOnly = e.target.checked;
    renderCatalog();
  });

  document.getElementById('header-cart-btn')?.addEventListener('click', openCartDrawer);
  document.getElementById('mobile-cart-open-btn')?.addEventListener('click', openCartDrawer);

  document.getElementById('hero-custom-btn')?.addEventListener('click', () => {
    openProductModal('request-custom');
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (state.activeProductId) closeProductModal();
      else if (state.isCartOpen) closeCartDrawer();
    }
  });
}

function bootstrap() {
  loadPersistedState();
  applyTheme();
  renderCategories();
  renderCatalog();
  renderOrderSteps();
  renderFaq();
  updateCartIndicators();
  bindGlobalEvents();
  initPwaManager();
}

bootstrap();
