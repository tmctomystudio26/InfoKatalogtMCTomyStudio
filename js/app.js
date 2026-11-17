import {
  BRAND as DEFAULT_BRAND,
  CATALOG_PREVIEW_STORAGE_KEY,
  PAY_LATER_SURCHARGE_RATE,
  getDefaultCatalogSnapshot,
  loadCatalogData,
} from './data.js?v=35';
import {
  PENDING_ORDER_STORAGE_KEY,
  addToCart,
  calculateCartTotals,
  createOrderSnapshot,
  filterProducts,
  formatRupiah,
  generateOrderCode,
  getStartingPrice,
  normalizeBanners,
  normalizeBrandConfig,
  normalizeUtilityConfig,
  removeFromCart,
  resolveAbsoluteOgImageUrl,
  syncPaymentOptionsWithBrand,
  updateCartQty,
  validateOrderForm,
} from './store.js?v=35';
import { initPwaManager } from './pwa.js?v=35';
import { initMusicPlayer } from './music.js?v=35';

const THEME_STORAGE_KEY = 'manifestudio_theme_v1';
const CART_STORAGE_KEY = 'manifestudio_cart_v1';
const NAME_STORAGE_KEY = 'manifestudio_customer_name_v1';

const initialCatalog = getDefaultCatalogSnapshot();

const state = {
  theme: 'dark',
  catalog: initialCatalog,
  catalogSource: 'fallback',
  category: 'all',
  query: '',
  inStockOnly: false,
  cart: [],
  customerName: '',
  voucherCode: '',
  paymentOption: initialCatalog.paymentOptions[0]?.id || 'Bayar Sekarang',
  whatsappNote: '',
  checkoutError: '',
  isSubmittingOrder: false,
  activeProductId: null,
  isCartOpen: false,
  openFaqIndex: 0,
  activeBannerSlide: 0,
};

function getBrand() {
  return normalizeBrandConfig(state.catalog.brand || DEFAULT_BRAND);
}

function getBanners() {
  return normalizeBanners(state.catalog.banners);
}

function getCategories() {
  return state.catalog.categories || [];
}

function getPaymentOptions() {
  return syncPaymentOptionsWithBrand(state.catalog.paymentOptions, getBrand());
}

function getVouchers() {
  return state.catalog.vouchers || [];
}

function getProducts() {
  return state.catalog.products || [];
}

function getFaqItems() {
  return state.catalog.faqItems || [];
}

function readPersistedCart() {
  try {
    const savedCart = localStorage.getItem(CART_STORAGE_KEY);
    if (savedCart) {
      const parsed = JSON.parse(savedCart);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (item) => item && item.productId && item.variantId && Number.isFinite(item.quantity)
        );
      }
    }
  } catch {
    // Graceful fallback
  }
  return [];
}

function loadPersistedState() {
  try {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme === 'light' || savedTheme === 'dark') {
      state.theme = savedTheme;
    } else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
      state.theme = 'light';
    }

    state.cart = readPersistedCart();

    const savedName = localStorage.getItem(NAME_STORAGE_KEY);
    if (savedName) {
      state.customerName = savedName;
    }
  } catch {
    // Graceful fallback if localStorage is unavailable
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

function persistPendingOrder(snapshot) {
  const serialized = JSON.stringify(snapshot);
  try {
    sessionStorage.setItem(PENDING_ORDER_STORAGE_KEY, serialized);
  } catch {
    // Ignore
  }
  try {
    localStorage.setItem(PENDING_ORDER_STORAGE_KEY, serialized);
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
    metaTheme.setAttribute('content', state.theme === 'dark' ? '#090D16' : '#F8FAFC');
  }
  const themeBtn = document.getElementById('theme-toggle-btn');
  if (themeBtn) {
    const isDark = state.theme === 'dark';
    themeBtn.setAttribute(
      'aria-label',
      isDark ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'
    );
    themeBtn.innerHTML = isDark
      ? `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg><span class="hide-xs">Terang</span>`
      : `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg><span class="hide-xs">Gelap</span>`;
  }
}

function renderCategories() {
  const container = document.getElementById('category-tabs');
  if (!container) return;

  const baseCats = getCategories().filter((cat) => cat && cat.id !== 'menu-lainnya');

  const tabsHtml = baseCats
    .map((cat) => {
      const active = state.category === cat.id;
      return `
        <button
          type="button"
          class="cat-tab ${active ? 'is-active' : ''}"
          data-category="${escapeHtml(cat.id)}"
          aria-pressed="${active}"
        >
          ${escapeHtml(cat.label)}
        </button>
      `;
    })
    .join('');

  container.innerHTML = tabsHtml;

  container.querySelectorAll('.cat-tab[data-category]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.category = btn.getAttribute('data-category') || 'all';
      renderCategories();
      renderCatalog();
    });
  });
}

function getFallbackLogoForProduct(productId = '') {
  const id = String(productId || '').toLowerCase();
  if (id.includes('netflix')) return './assets/logos/netflix.svg';
  if (id.includes('youtube')) return './assets/logos/youtube.svg';
  if (id.includes('spotify')) return './assets/logos/spotify.svg';
  if (id.includes('canva')) return './assets/logos/canva.svg';
  if (id.includes('viu')) return './assets/logos/viu.svg';
  if (id.includes('vidio')) return './assets/logos/vidio.svg';
  if (id.includes('alight')) return './assets/logos/alight-motion.svg';
  if (id.includes('wetv')) return './assets/logos/wetv.svg';
  if (id.includes('prime')) return './assets/logos/prime-video.svg';
  return './assets/logos/custom-request.svg';
}

function attachLogoFallbacks(rootEl) {
  if (!rootEl) return;
  rootEl.querySelectorAll('img[data-fallback-logo]').forEach((img) => {
    img.addEventListener(
      'error',
      () => {
        const fb = img.getAttribute('data-fallback-logo') || './assets/logos/custom-request.svg';
        if (img.getAttribute('src') !== fb) {
          img.src = fb;
        }
      },
      { once: true }
    );
  });
}

function renderCatalog() {
  const grid = document.getElementById('product-grid');
  const countLabel = document.getElementById('catalog-count');
  if (!grid) return;

  const filtered = filterProducts(getProducts(), {
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
        <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        <h3>Layanan tidak ditemukan</h3>
        <p>Coba kata kunci atau kategori lain.</p>
        <button type="button" class="btn btn-secondary btn-sm" id="reset-filters-btn">Reset Filter</button>
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
      const priceDisplay = isCustom ? 'Fleksibel' : `Mulai ${formatRupiah(startPrice)}`;

      const quietNote = product.outOfStock
        ? product.restockMessage || 'Segera Restock'
        : product.isBestSeller
        ? 'Terlaris'
        : `${product.variants.length} paket`;

      const fallbackLogo = getFallbackLogoForProduct(product.id);

      return `
        <button
          type="button"
          class="product-tile ${product.outOfStock ? 'is-restock' : ''}"
          data-product-id="${escapeHtml(product.id)}"
          aria-label="${escapeHtml(product.name)} — ${escapeHtml(priceDisplay)}"
        >
          <div class="tile-stage">
            <img
              src="${escapeHtml(product.logo || fallbackLogo)}"
              data-fallback-logo="${escapeHtml(fallbackLogo)}"
              referrerpolicy="no-referrer"
              alt="${escapeHtml(product.name)}"
              width="58"
              height="58"
              loading="lazy"
              class="tile-logo"
            />
          </div>
          <div class="tile-body">
            <span class="tile-title">${escapeHtml(product.name)}</span>
            <span class="tile-price mono-num">${escapeHtml(priceDisplay)}</span>
            <span class="tile-kicker ${product.outOfStock ? 'is-warn' : product.isBestSeller ? 'is-hot' : ''}">
              ${escapeHtml(quietNote)}
            </span>
          </div>
        </button>
      `;
    })
    .join('');

  attachLogoFallbacks(grid);

  grid.querySelectorAll('.product-tile').forEach((tile) => {
    tile.addEventListener('click', () => {
      const id = tile.getAttribute('data-product-id');
      if (id) openProductModal(id);
    });
  });
}

let applyBannerSlideFn = null;

function renderBanners() {
  const track = document.getElementById('banner-track');
  const dotsContainer = document.getElementById('banner-dots');
  if (!track) return;

  const banners = getBanners();
  if (state.activeBannerSlide >= banners.length) {
    state.activeBannerSlide = 0;
  }

  track.innerHTML = banners
    .map((b, idx) => {
      const scrimClass =
        b.scrim && b.scrim !== 'default' ? `scrim-${escapeHtml(b.scrim)}` : '';
      const hasImage = Boolean(String(b.image || '').trim());
      const frameExtraClass = !hasImage
        ? b.scrim === 'downloader'
          ? 'banner-slide-downloader'
          : 'banner-slide-gradient'
        : '';
      const isCatalogAnchor = b.href === '#katalog';
      const btnClass = idx === 0 && isCatalogAnchor ? 'btn btn-primary btn-sm' : 'btn btn-outline-light btn-sm';

      return `
        <article
          class="promo-banner-frame banner-slide ${frameExtraClass}"
          data-slide-index="${idx}"
          data-banner-id="${escapeHtml(b.id)}"
          data-banner-href="${escapeHtml(b.href || '#katalog')}"
          aria-hidden="${idx !== state.activeBannerSlide}"
        >
          ${
            hasImage
              ? `<img
                  src="${escapeHtml(b.image)}"
                  alt="${escapeHtml(b.heading)}"
                  class="promo-banner-img"
                  width="1200"
                  height="400"
                  ${idx === 0 ? 'fetchpriority="high"' : 'loading="lazy"'}
                />`
              : ''
          }
          <div class="promo-banner-scrim ${scrimClass}" aria-hidden="true"></div>
          <div class="promo-banner-content">
            <div class="promo-banner-copy">
              <span class="promo-kicker">${escapeHtml(b.kicker)}</span>
              <h2 class="promo-heading">${escapeHtml(b.heading)}</h2>
              ${b.sub ? `<p class="promo-sub">${escapeHtml(b.sub)}</p>` : ''}
            </div>
            <div class="promo-banner-cta">
              <a href="${escapeHtml(b.href || '#katalog')}" class="${btnClass}">
                ${escapeHtml(b.ctaLabel || 'Selengkapnya')}
              </a>
            </div>
          </div>
        </article>
      `;
    })
    .join('');

  if (dotsContainer) {
    dotsContainer.innerHTML = banners
      .map(
        (b, idx) => `
        <button
          type="button"
          class="banner-dot ${idx === state.activeBannerSlide ? 'is-active' : ''}"
          data-slide-dot="${idx}"
          aria-label="Slide ${idx + 1}: ${escapeHtml(b.heading)}"
          aria-selected="${idx === state.activeBannerSlide}"
        ></button>
      `
      )
      .join('');
  }

  if (typeof applyBannerSlideFn === 'function') {
    applyBannerSlideFn(state.activeBannerSlide, { immediate: true });
  }
}

function initBannerCarousel() {
  const carousel = document.getElementById('hero-carousel');
  const track = document.getElementById('banner-track');
  const prevBtn = document.getElementById('banner-prev-btn');
  const nextBtn = document.getElementById('banner-next-btn');
  const dotsContainer = document.getElementById('banner-dots');
  if (!carousel || !track) return;

  let autoTimer = null;
  let isPointerDown = false;
  let hasMoved = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragDeltaX = 0;
  let dragDeltaY = 0;
  let dragSourceSlide = null;

  const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  function getSlides() {
    return Array.from(track.querySelectorAll('.banner-slide'));
  }

  function applySlide(index, { immediate = false } = {}) {
    const slides = getSlides();
    const totalSlides = slides.length;
    if (totalSlides === 0) return;

    const wrapped = ((index % totalSlides) + totalSlides) % totalSlides;
    state.activeBannerSlide = wrapped;
    track.style.transition = immediate ? 'none' : '';
    track.style.transform = `translate3d(-${wrapped * 100}%, 0, 0)`;

    slides.forEach((slide, idx) => {
      slide.setAttribute('aria-hidden', String(idx !== wrapped));
    });

    dotsContainer?.querySelectorAll('[data-slide-dot]').forEach((dot) => {
      const dotIdx = Number(dot.getAttribute('data-slide-dot'));
      const active = dotIdx === wrapped;
      dot.classList.toggle('is-active', active);
      dot.setAttribute('aria-selected', String(active));
    });
  }

  applyBannerSlideFn = applySlide;

  function startAutoSlide() {
    if (prefersReducedMotion) return;
    stopAutoSlide();
    autoTimer = setInterval(() => {
      if (!document.hidden && !isPointerDown && getSlides().length > 1) {
        applySlide(state.activeBannerSlide + 1);
      }
    }, 6500);
  }

  function stopAutoSlide() {
    if (autoTimer) {
      clearInterval(autoTimer);
      autoTimer = null;
    }
  }

  function navigateToBannerTarget(href) {
    if (!href) return;
    if (href.startsWith('#')) {
      const target = document.querySelector(href);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      return;
    }
    window.location.href = href;
  }

  prevBtn?.addEventListener('click', () => {
    applySlide(state.activeBannerSlide - 1);
    startAutoSlide();
  });

  nextBtn?.addEventListener('click', () => {
    applySlide(state.activeBannerSlide + 1);
    startAutoSlide();
  });

  dotsContainer?.addEventListener('click', (e) => {
    const dot = e.target.closest('[data-slide-dot]');
    if (!dot) return;
    const idx = Number(dot.getAttribute('data-slide-dot') || 0);
    applySlide(idx);
    startAutoSlide();
  });

  carousel.addEventListener('keydown', (e) => {
    const slides = getSlides();
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      applySlide(state.activeBannerSlide - 1);
      startAutoSlide();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      applySlide(state.activeBannerSlide + 1);
      startAutoSlide();
    } else if (e.key === 'Enter' && document.activeElement === carousel) {
      const href = slides[state.activeBannerSlide]?.getAttribute('data-banner-href');
      if (href) {
        e.preventDefault();
        navigateToBannerTarget(href);
      }
    }
  });

  carousel.addEventListener('mouseenter', stopAutoSlide);
  carousel.addEventListener('mouseleave', startAutoSlide);
  carousel.addEventListener('focusin', stopAutoSlide);
  carousel.addEventListener('focusout', startAutoSlide);

  carousel.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if (e.target.closest('button, a')) return;
    const slides = getSlides();
    isPointerDown = true;
    hasMoved = false;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragDeltaX = 0;
    dragDeltaY = 0;
    dragSourceSlide = e.target.closest('.banner-slide') || slides[state.activeBannerSlide] || null;
  });

  carousel.addEventListener('pointermove', (e) => {
    if (!isPointerDown) return;
    dragDeltaX = e.clientX - dragStartX;
    dragDeltaY = e.clientY - dragStartY;

    if (!hasMoved) {
      if (Math.hypot(dragDeltaX, dragDeltaY) <= 6) return;
      if (Math.abs(dragDeltaY) > Math.abs(dragDeltaX) + 4) {
        isPointerDown = false;
        dragSourceSlide = null;
        return;
      }
      hasMoved = true;
      stopAutoSlide();
      track.style.transition = 'none';
      carousel.classList.add('is-dragging');
    }

    const width = Math.max(1, carousel.clientWidth);
    const offsetPercent = -(state.activeBannerSlide * 100) + (dragDeltaX / width) * 100;
    track.style.transform = `translate3d(${offsetPercent}%, 0, 0)`;
  });

  const finishDrag = (e) => {
    if (!isPointerDown) return;
    const wasTap = !hasMoved && Math.hypot(dragDeltaX, dragDeltaY) < 8;
    const sourceSlide = dragSourceSlide;

    isPointerDown = false;
    hasMoved = false;
    dragSourceSlide = null;
    carousel.classList.remove('is-dragging');

    if (wasTap && e?.type === 'pointerup' && !e.target.closest('button, a')) {
      const href = sourceSlide?.getAttribute('data-banner-href') || '';
      dragDeltaX = 0;
      dragDeltaY = 0;
      if (href) {
        navigateToBannerTarget(href);
        return;
      }
      startAutoSlide();
      return;
    }

    const threshold = Math.min(72, Math.max(36, carousel.clientWidth * 0.14));
    if (dragDeltaX <= -threshold) {
      applySlide(state.activeBannerSlide + 1);
    } else if (dragDeltaX >= threshold) {
      applySlide(state.activeBannerSlide - 1);
    } else {
      applySlide(state.activeBannerSlide);
    }
    dragDeltaX = 0;
    dragDeltaY = 0;
    startAutoSlide();
  };

  carousel.addEventListener('pointerup', finishDrag);
  carousel.addEventListener('pointercancel', finishDrag);
  carousel.addEventListener('pointerleave', () => {
    if (isPointerDown) finishDrag({ type: 'pointerleave', target: carousel });
  });

  applySlide(0, { immediate: true });
  startAutoSlide();
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

  const product = getProducts().find((p) => p.id === state.activeProductId);
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
      const inCartItem = state.cart.find(
        (item) => item.productId === product.id && item.variantId === variant.id
      );
      const qtyInCart = inCartItem ? inCartItem.quantity : 0;

      return `
        <div class="variant-card ${unavailable ? 'is-disabled' : ''} ${qtyInCart > 0 ? 'is-in-cart' : ''}">
          <div class="variant-card-top">
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

          <div class="variant-card-foot">
            <div class="variant-price-stack">
              ${oldPriceHtml}
              <span class="variant-price">${escapeHtml(priceLabel)}</span>
            </div>
            <button
              type="button"
              class="btn ${unavailable ? 'btn-secondary' : qtyInCart > 0 ? 'btn-secondary' : 'btn-primary'} btn-sm add-variant-btn"
              data-variant-id="${escapeHtml(variant.id)}"
              ${unavailable ? 'disabled' : ''}
              aria-label="Tambah ${escapeHtml(product.name)} ${escapeHtml(variant.name)} ke keranjang"
            >
              ${unavailable ? 'Habis' : qtyInCart > 0 ? `+ Tambah (${qtyInCart})` : '+ Tambah'}
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
          <img src="${escapeHtml(product.logo)}" alt="" width="44" height="44" class="modal-logo" />
          <div>
            <h2 id="modal-product-title">${escapeHtml(product.name)}</h2>
            <p class="modal-subtitle">${escapeHtml(product.summary)}</p>
          </div>
        </div>
        <button type="button" class="icon-close-btn" id="close-product-modal-btn" aria-label="Tutup detail produk">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
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

      <div class="variant-grid">
        ${variantsHtml}
      </div>

      <div class="modal-footer">
        <span class="modal-hint">Pilih satu atau beberapa nominal paket</span>
        <button type="button" class="btn btn-primary btn-sm" id="modal-open-cart-btn">
          Checkout (${calculateCartTotals(state.cart).itemCount})
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
      state.checkoutError = '';
      saveCart();
      updateCartBadges();

      const updatedQty =
        state.cart.find((i) => i.productId === product.id && i.variantId === variant.id)?.quantity || 1;
      btn.textContent = `+ Tambah (${updatedQty})`;
      btn.classList.remove('btn-primary');
      btn.classList.add('btn-secondary', 'is-added');
      btn.closest('.variant-card')?.classList.add('is-in-cart');

      const openCartShortcut = overlay.querySelector('#modal-open-cart-btn');
      if (openCartShortcut) {
        openCartShortcut.textContent = `Checkout (${calculateCartTotals(state.cart).itemCount})`;
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

const USED_VOUCHERS_STORAGE_KEY = 'manifestudio_used_vouchers_v1';

function getUsedVouchers() {
  try {
    const raw = localStorage.getItem(USED_VOUCHERS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const counts = {};
        for (const item of parsed) {
          const clean = String(item || '').trim().toUpperCase();
          if (clean) counts[clean] = (counts[clean] || 0) + 1;
        }
        return counts;
      }
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    }
  } catch {
    // Ignore
  }
  return {};
}

function markVoucherAsUsed(code) {
  const clean = String(code || '').trim().toUpperCase();
  if (!clean) return;
  try {
    const counts = getUsedVouchers();
    counts[clean] = (Math.floor(Number(counts[clean]) || 0)) + 1;
    localStorage.setItem(USED_VOUCHERS_STORAGE_KEY, JSON.stringify(counts));
  } catch {
    // Ignore
  }
}

function getCartTotals() {
  const brand = getBrand();
  return calculateCartTotals(state.cart, {
    discountThreshold: brand.discountThreshold,
    discountAmount: brand.discountAmount,
    voucherCode: state.voucherCode,
    vouchers: getVouchers(),
    usedVouchers: getUsedVouchers(),
    paymentOption: state.paymentOption,
    payLaterRate: brand.payLaterSurchargeRate ?? PAY_LATER_SURCHARGE_RATE,
    serviceFeeFlat: brand.serviceFeeFlat ?? 0,
    serviceFeeLabel: brand.serviceFeeLabel || 'Biaya Layanan',
  });
}

function updateCartBadges() {
  const totals = getCartTotals();

  const badge = document.getElementById('header-cart-badge');
  if (badge) {
    badge.textContent = String(totals.itemCount);
    badge.hidden = totals.itemCount === 0;
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

function buildSummaryBreakdownHtml(totals) {
  const payLaterPct =
    totals.payLaterPercent !== undefined
      ? totals.payLaterPercent
      : Math.round(Number(totals.payLaterRate ?? 0.1) * 1000) / 10;

  const voucherRow = totals.voucherCode
    ? `
      <div class="summary-row ${totals.voucherDiscount > 0 ? 'is-discount' : ''}">
        <span>Kode Voucher (${escapeHtml(totals.voucherCode)})</span>
        <span class="mono-num">${
          totals.voucherDiscount > 0
            ? `-${escapeHtml(formatRupiah(totals.voucherDiscount))}`
            : totals.voucherStatus === 'used'
            ? 'Batas Habis'
            : totals.voucherStatus === 'ineligible'
            ? 'Belum Memenuhi'
            : 'Tidak Valid'
        }</span>
      </div>
    `
    : '';

  const serviceFeeRow =
    totals.serviceFee > 0
      ? `
      <div class="summary-row">
        <span>${escapeHtml(totals.serviceFeeLabel || 'Biaya Layanan')}</span>
        <span class="mono-num">+${escapeHtml(formatRupiah(totals.serviceFee))}</span>
      </div>
    `
      : '';

  const payLaterRow = totals.isPayLater
    ? `
      <div class="summary-row is-fee">
        <span>Biaya Bayar Nanti (+${payLaterPct}%)</span>
        <span class="mono-num">${
          totals.payLaterFee > 0
            ? `+${escapeHtml(formatRupiah(totals.payLaterFee))}`
            : `+${payLaterPct}% Final`
        }</span>
      </div>
    `
    : '';

  return `
    <div class="summary-row">
      <span>Subtotal</span>
      <span class="mono-num">${escapeHtml(formatRupiah(totals.subtotal))}</span>
    </div>
    <div class="summary-row ${totals.discount > 0 ? 'is-discount' : ''}">
      <span>Diskon Belanja</span>
      <span class="mono-num">-${escapeHtml(formatRupiah(totals.discount))}</span>
    </div>
    ${voucherRow}
    ${serviceFeeRow}
    ${payLaterRow}
    <div class="summary-row is-total">
      <span>Total Bayar</span>
      <span class="mono-num">${escapeHtml(formatRupiah(totals.total))}</span>
    </div>
  `;
}

function buildPayLaterNoticeHtml(totals) {
  if (!totals.isPayLater) return '';
  const payLaterPct =
    totals.payLaterPercent !== undefined
      ? totals.payLaterPercent
      : Math.round(Number(totals.payLaterRate ?? 0.1) * 1000) / 10;
  const feeDetail =
    totals.payLaterFee > 0
      ? `sebesar <strong>+${escapeHtml(formatRupiah(totals.payLaterFee))}</strong>`
      : `<strong>+${payLaterPct}% dari harga final</strong>`;
  return `
    <div class="pay-later-notice" role="note">
      <strong>Transparansi Biaya Bayar Nanti (+${payLaterPct}%):</strong>
      <span>Pembayaran setelah akun diterima dikenakan biaya tambahan ${payLaterPct}% (${feeDetail}). Pilih <strong>Bayar Sekarang</strong> untuk bebas biaya bayar nanti.</span>
    </div>
  `;
}

function syncCheckoutDynamicParts(drawerRoot) {
  if (!drawerRoot) return;
  const brand = getBrand();
  const totals = getCartTotals();
  updateCartBadges();

  const discountTextEl = drawerRoot.querySelector('.discount-progress-text');
  if (discountTextEl) {
    discountTextEl.textContent = totals.qualifiesDiscount
      ? `Selamat! Diskon ${formatRupiah(brand.discountAmount)} otomatis aktif.`
      : `Tambah ${formatRupiah(totals.remainingForDiscount)} lagi untuk diskon ${formatRupiah(brand.discountAmount)}.`;
  }
  const discountFillEl = drawerRoot.querySelector('.discount-fill');
  if (discountFillEl) {
    discountFillEl.style.width = `${totals.progressPercent}%`;
  }

  const summaryEl = drawerRoot.querySelector('#cart-summary-breakdown');
  if (summaryEl) {
    summaryEl.innerHTML = buildSummaryBreakdownHtml(totals);
  }

  drawerRoot.querySelectorAll('.payment-option').forEach((label) => {
    const input = label.querySelector('input[name="paymentOption"]');
    if (!input) return;
    const isChecked = input.value === state.paymentOption;
    input.checked = isChecked;
    label.classList.toggle('is-selected', isChecked);
  });

  const payLaterSlot = drawerRoot.querySelector('#pay-later-notice-slot');
  if (payLaterSlot) {
    payLaterSlot.innerHTML = buildPayLaterNoticeHtml(totals);
  }

  const voucherFeedback = drawerRoot.querySelector('#voucher-feedback');
  if (voucherFeedback) {
    if (totals.voucherMessage) {
      voucherFeedback.hidden = false;
      voucherFeedback.textContent = totals.voucherMessage;
      voucherFeedback.className = `voucher-feedback is-${totals.voucherStatus}`;
    } else {
      voucherFeedback.hidden = true;
      voucherFeedback.textContent = '';
    }
  }

  const errorSlot = drawerRoot.querySelector('#checkout-error-slot');
  if (errorSlot) {
    errorSlot.innerHTML = state.checkoutError
      ? `<div class="form-error" role="alert">${escapeHtml(state.checkoutError)}</div>`
      : '';
  }

  const submitBtn = drawerRoot.querySelector('#checkout-submit-btn');
  if (submitBtn) {
    submitBtn.disabled = state.isSubmittingOrder;
    submitBtn.textContent = state.isSubmittingOrder ? 'Memproses Pesanan...' : 'Buat Pesanan';
  }
}

function renderCartDrawer() {
  const drawerRoot = document.getElementById('cart-drawer-root');
  if (!drawerRoot) return;

  updateCartBadges();

  if (!state.isCartOpen) {
    drawerRoot.hidden = true;
    drawerRoot.innerHTML = '';
    return;
  }

  const prevDrawerScroll = drawerRoot.querySelector('.drawer-body')?.scrollTop || 0;
  const prevWindowY = window.scrollY;

  drawerRoot.hidden = false;
  const brand = getBrand();
  const totals = getCartTotals();

  const progressText = totals.qualifiesDiscount
    ? `Selamat! Diskon ${formatRupiah(brand.discountAmount)} otomatis aktif.`
    : `Tambah ${formatRupiah(totals.remainingForDiscount)} lagi untuk diskon ${formatRupiah(brand.discountAmount)}.`;

  const itemsHtml =
    state.cart.length === 0
      ? `
        <div class="cart-empty">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>
          <p>Keranjang belanja masih kosong.</p>
          <span>Pilih layanan di katalog untuk membuat pesanan baru.</span>
        </div>
      `
      : state.cart
          .map(
            (item) => `
          <div class="cart-item">
            <img src="${escapeHtml(item.logo || './assets/icons/brand-icon.svg')}" alt="" width="36" height="36" class="cart-item-logo" />
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

  const paymentHtml = getPaymentOptions()
    .map((opt) => {
      const checked = state.paymentOption === opt.id;
      return `
        <label class="payment-option ${checked ? 'is-selected' : ''}">
          <input
            type="radio"
            name="paymentOption"
            value="${escapeHtml(opt.id)}"
            ${checked ? 'checked' : ''}
          />
          <div class="payment-option-body">
            <div class="payment-title-row">
              <span class="payment-title">${escapeHtml(opt.label)}</span>
              <span class="payment-fee-tag ${opt.surchargeRate > 0 ? 'is-surcharge' : ''}">${escapeHtml(opt.badge || '')}</span>
            </div>
            <span class="payment-note">${escapeHtml(opt.note)}</span>
          </div>
        </label>
      `;
    })
    .join('');

  drawerRoot.innerHTML = `
    <div class="drawer-backdrop" id="cart-backdrop"></div>
    <aside class="cart-drawer" role="dialog" aria-modal="true" aria-label="Keranjang Belanja &amp; Checkout">
      <div class="drawer-header">
        <div>
          <h2>Keranjang Pesanan</h2>
          <p class="drawer-sub">${totals.itemCount} item dipilih</p>
        </div>
        <button type="button" class="icon-close-btn" id="close-cart-btn" aria-label="Tutup keranjang belanja">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
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
            <div id="cart-summary-breakdown" class="summary-breakdown">
              ${buildSummaryBreakdownHtml(totals)}
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
              <label for="checkout-voucher">Kode Voucher (Opsional)</label>
              <div class="voucher-input-row">
                <input
                  type="text"
                  id="checkout-voucher"
                  name="voucherCode"
                  placeholder="Contoh: HEMAT2K"
                  value="${escapeHtml(state.voucherCode)}"
                  autocomplete="off"
                />
                <button type="button" class="btn btn-secondary btn-sm" id="apply-voucher-btn">
                  Pakai
                </button>
              </div>
              <div
                id="voucher-feedback"
                class="voucher-feedback ${totals.voucherStatus ? `is-${escapeHtml(totals.voucherStatus)}` : ''}"
                ${totals.voucherMessage ? '' : 'hidden'}
              >${escapeHtml(totals.voucherMessage || '')}</div>
            </div>

            <div class="form-field">
              <span class="field-label">Metode Pembayaran</span>
              <div class="payment-options">
                ${paymentHtml}
              </div>
              <div id="pay-later-notice-slot">
                ${buildPayLaterNoticeHtml(totals)}
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

            <div id="checkout-error-slot">
              ${
                state.checkoutError
                  ? `<div class="form-error" role="alert">${escapeHtml(state.checkoutError)}</div>`
                  : ''
              }
            </div>

            <button type="submit" id="checkout-submit-btn" class="btn btn-primary btn-full">
              Buat Pesanan
            </button>
          </form>
        `
            : ''
        }
      </div>
    </aside>
  `;

  const nextDrawerBody = drawerRoot.querySelector('.drawer-body');
  if (nextDrawerBody && prevDrawerScroll > 0) {
    nextDrawerBody.scrollTop = prevDrawerScroll;
  }
  if (window.scrollY !== prevWindowY) {
    window.scrollTo(0, prevWindowY);
  }

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
      saveCart();
      renderCartDrawer();
    });
  });

  const nameInput = drawerRoot.querySelector('#checkout-name');
  nameInput?.addEventListener('input', (e) => {
    state.customerName = e.target.value;
    state.checkoutError = '';
    saveCustomerName(state.customerName);
    const errorSlot = drawerRoot.querySelector('#checkout-error-slot');
    if (errorSlot) errorSlot.innerHTML = '';
  });

  const voucherInput = drawerRoot.querySelector('#checkout-voucher');
  voucherInput?.addEventListener('input', (e) => {
    state.voucherCode = e.target.value;
    syncCheckoutDynamicParts(drawerRoot);
  });

  drawerRoot.querySelector('#apply-voucher-btn')?.addEventListener('click', () => {
    if (voucherInput) {
      state.voucherCode = voucherInput.value.trim().toUpperCase();
      voucherInput.value = state.voucherCode;
    }
    syncCheckoutDynamicParts(drawerRoot);
  });

  const noteInput = drawerRoot.querySelector('#checkout-note');
  noteInput?.addEventListener('input', (e) => {
    state.whatsappNote = e.target.value;
  });

  drawerRoot.querySelectorAll('input[name="paymentOption"]').forEach((radio) => {
    radio.addEventListener('change', (e) => {
      state.paymentOption = e.target.value;
      syncCheckoutDynamicParts(drawerRoot);
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
      syncCheckoutDynamicParts(drawerRoot);
      return;
    }

    state.checkoutError = '';
    state.isSubmittingOrder = true;
    syncCheckoutDynamicParts(drawerRoot);

    const activeTotals = getCartTotals();
    if (activeTotals.voucherCode && activeTotals.voucherStatus === 'applied') {
      markVoucherAsUsed(activeTotals.voucherCode);
    }
    const orderCode = generateOrderCode();
    const brand = getBrand();

    const snapshot = createOrderSnapshot({
      orderCode,
      whatsappNumber: brand.whatsappNumber,
      customerName: state.customerName,
      whatsappNote: state.whatsappNote,
      paymentOption: state.paymentOption,
      cart: state.cart,
      totals: activeTotals,
    });

    persistPendingOrder(snapshot);

    // Clear cart immediately so reopening storefront starts fresh for a new order
    state.cart = [];
    state.voucherCode = '';
    state.whatsappNote = '';
    state.checkoutError = '';
    state.isSubmittingOrder = false;
    state.isCartOpen = false;
    saveCart();
    updateCartBadges();

    window.location.href = './order.html';
  });
}

function renderFaq() {
  const container = document.getElementById('faq-list');
  if (!container) return;

  container.innerHTML = getFaqItems()
    .map((item, idx) => {
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
    })
    .join('');

  container.querySelectorAll('.faq-trigger').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.getAttribute('data-faq-idx'));
      state.openFaqIndex = state.openFaqIndex === idx ? -1 : idx;
      renderFaq();
    });
  });
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
  }, 2600);
}

function bindGlobalEvents() {
  document.getElementById('theme-toggle-btn')?.addEventListener('click', () => {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    saveTheme(state.theme);
    applyTheme();
  });

  document.querySelectorAll('[data-nav-target="catalog"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.category = 'all';
      renderCategories();
      renderCatalog();
      document.getElementById('katalog')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

  // Sync persisted cart when returning via browser back/bfcache after checkout
  window.addEventListener('pageshow', () => {
    state.cart = readPersistedCart();
    state.isSubmittingOrder = false;
    renderAllStorefrontViews();
  });
}

function renderPreviewNotice() {
  const banner = document.getElementById('admin-preview-banner');
  if (!banner) return;
  banner.hidden = state.catalogSource !== 'preview';
}

function renderBrandAndFooter() {
  const brand = getBrand();
  const logoEl = document.getElementById('header-brand-logo');
  if (logoEl && brand.logo) {
    logoEl.src = brand.logo;
  }
  const nameEl = document.getElementById('header-brand-name');
  if (nameEl && brand.name) {
    nameEl.textContent = brand.name;
  }
  const taglineEl = document.getElementById('header-brand-tagline');
  if (taglineEl && brand.tagline) {
    taglineEl.textContent = brand.tagline;
  }
  const footerNameEl = document.getElementById('footer-brand-name');
  if (footerNameEl && brand.name) {
    footerNameEl.textContent = brand.name;
  }
  const footerCopyEl = document.getElementById('footer-copy-text');
  if (footerCopyEl && brand.footerText) {
    footerCopyEl.textContent = brand.footerText;
  }

  // Sync OpenGraph & Document Meta Tags dynamically
  const og = brand.openGraph || {};
  if (og.title) {
    document.title = og.title;
  }
  const setMetaContent = (selector, value) => {
    if (!value) return;
    const el = document.querySelector(selector);
    if (el) el.setAttribute('content', value);
  };
  const absOgImage = resolveAbsoluteOgImageUrl(og.image || './assets/og-manifestudio.jpg', window.location.origin);
  setMetaContent('meta[name="description"]', og.description);
  setMetaContent('meta[property="og:site_name"]', og.siteName || brand.name);
  setMetaContent('meta[property="og:title"]', og.title);
  setMetaContent('meta[property="og:description"]', og.description);
  setMetaContent('meta[property="og:image"]', absOgImage);
  setMetaContent('meta[property="og:image:secure_url"]', absOgImage);
  setMetaContent('meta[property="og:image:alt"]', og.imageAlt);
  setMetaContent('meta[name="twitter:title"]', og.title);
  setMetaContent('meta[name="twitter:description"]', og.description);
  setMetaContent('meta[name="twitter:image"]', absOgImage);
  setMetaContent('meta[name="twitter:image:alt"]', og.imageAlt);

  const socialContainer = document.getElementById('footer-social-links');
  if (socialContainer) {
    const installBtn = socialContainer.querySelector('#footer-install-link');
    const socialsHtml = (brand.socials || [])
      .map(
        (soc) => `
        <a
          href="${escapeHtml(soc.url || '#')}"
          target="_blank"
          rel="noopener noreferrer"
          class="footer-link-btn"
        >
          ${
            soc.logo
              ? `<img src="${escapeHtml(soc.logo)}" alt="" width="18" height="18" class="footer-social-icon" />`
              : ''
          }
          <span>${escapeHtml(soc.label || soc.platform || 'Sosmed')}</span>
        </a>
      `
      )
      .join('');

    socialContainer.innerHTML = `
      <a href="./tools.html" class="footer-link-btn">Menu Utilitas</a>
      ${socialsHtml}
    `;
    if (installBtn) {
      socialContainer.appendChild(installBtn);
    }
  }

  // Sync Storefront Utilities Callout Card from catalog.utilities.callout
  const utilitiesCfg = normalizeUtilityConfig(state.catalog?.utilities);
  const calloutCard = document.getElementById('utilities-callout-card');
  if (calloutCard && utilitiesCfg.callout) {
    const iconImg = calloutCard.querySelector('.utilities-callout-icon img');
    if (iconImg && utilitiesCfg.callout.icon) {
      iconImg.src = utilitiesCfg.callout.icon;
    }
    const titleStrong = calloutCard.querySelector('.utilities-callout-title-row strong');
    if (titleStrong && utilitiesCfg.callout.title) {
      titleStrong.textContent = utilitiesCfg.callout.title;
    }
    const badgeSpan = calloutCard.querySelector('.utilities-callout-badge');
    if (badgeSpan && utilitiesCfg.callout.badge) {
      badgeSpan.textContent = utilitiesCfg.callout.badge;
    }
    const subP = calloutCard.querySelector('.utilities-callout-copy p');
    const calloutDesc = utilitiesCfg.callout.description || utilitiesCfg.callout.subtitle;
    if (subP && calloutDesc) {
      subP.textContent = calloutDesc;
    }
  }
}

function renderAllStorefrontViews() {
  renderPreviewNotice();
  renderBrandAndFooter();
  renderBanners();
  renderCategories();
  renderCatalog();
  renderFaq();
  updateCartBadges();
  if (state.activeProductId) {
    renderProductModal();
  }
  if (state.isCartOpen) {
    renderCartDrawer();
  }
}

async function bootstrap() {
  loadPersistedState();
  applyTheme();
  initBannerCarousel();
  renderAllStorefrontViews();
  bindGlobalEvents();
  initPwaManager();
  initMusicPlayer();

  document.getElementById('exit-preview-btn')?.addEventListener('click', async () => {
    try {
      localStorage.removeItem(CATALOG_PREVIEW_STORAGE_KEY);
    } catch {
      // Ignore
    }
    const fresh = await loadCatalogData({ allowLocalPreview: false });
    state.catalog = fresh.data;
    state.catalogSource = fresh.source;
    renderAllStorefrontViews();
    showToast('Pratinjau lokal dihapus — kembali ke katalog publik.');
  });

  const loaded = await loadCatalogData({ allowLocalPreview: true });
  state.catalog = loaded.data;
  state.catalogSource = loaded.source;
  if (!getPaymentOptions().some((opt) => opt.id === state.paymentOption)) {
    state.paymentOption = getPaymentOptions()[0]?.id || 'Bayar Sekarang';
  }
  renderAllStorefrontViews();
}

bootstrap();
