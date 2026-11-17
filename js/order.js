import { PENDING_ORDER_STORAGE_KEY, formatRupiah, normalizeBrandConfig } from './store.js?v=34';
import { loadCatalogData } from './data.js?v=34';
import { generateReceiptImage } from './receipt.js?v=34';
import { initMusicPlayer } from './music.js?v=34';

const THEME_STORAGE_KEY = 'manifestudio_theme_v1';

let activeTheme = 'dark';
let receiptObjectUrl = '';
let receiptFileName = '';
let getPngBlobFn = null;
let orderCaption = '';

function escapeHtml(str) {
  return String(str || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function loadTheme() {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') {
      activeTheme = saved;
    } else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
      activeTheme = 'light';
    }
  } catch {
    // Ignore
  }
}

function applyTheme() {
  document.documentElement.setAttribute('data-theme', activeTheme);
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.setAttribute('content', activeTheme === 'dark' ? '#090D16' : '#F8FAFC');
  }
  const themeBtn = document.getElementById('theme-toggle-btn');
  if (themeBtn) {
    const isDark = activeTheme === 'dark';
    themeBtn.setAttribute('aria-label', isDark ? 'Aktifkan mode terang' : 'Aktifkan mode gelap');
    themeBtn.innerHTML = isDark
      ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg><span class="hide-xs">Terang</span>`
      : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg><span class="hide-xs">Gelap</span>`;
  }
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
  }, 2800);
}

function loadPendingOrder() {
  const sources = [];
  try {
    sources.push(sessionStorage.getItem(PENDING_ORDER_STORAGE_KEY));
  } catch {
    // Ignore
  }
  try {
    sources.push(localStorage.getItem(PENDING_ORDER_STORAGE_KEY));
  } catch {
    // Ignore
  }

  for (const raw of sources) {
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.orderCode && Array.isArray(parsed.cart) && parsed.cart.length > 0) {
        return parsed;
      }
    } catch {
      // Try next source
    }
  }
  return null;
}

function triggerReceiptDownload() {
  if (!receiptObjectUrl || !receiptFileName) return;
  const a = document.createElement('a');
  a.href = receiptObjectUrl;
  a.download = receiptFileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function copyReceiptPngInBackground() {
  if (!getPngBlobFn || typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) {
    return;
  }
  getPngBlobFn()
    .then((pngBlob) => {
      if (pngBlob) {
        return navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
      }
      return undefined;
    })
    .catch(() => {
      // Optional enhancement: download button remains available
    });
}

function renderOrderDetails(order) {
  const heading = document.getElementById('order-code-heading');
  if (heading) heading.textContent = order.orderCode;

  const waLink = document.getElementById('open-whatsapp-link');
  if (waLink) {
    waLink.href = order.whatsappUrl;
  }

  const metaEl = document.getElementById('order-meta-list');
  if (metaEl) {
    const isPayLater = Boolean(order.totals?.isPayLater);
    metaEl.innerHTML = `
      <div class="order-meta-row">
        <span>Pemesan</span>
        <strong>${escapeHtml(order.customerName)}</strong>
      </div>
      <div class="order-meta-row">
        <span>Pembayaran</span>
        <strong class="${isPayLater ? 'is-warn-text' : ''}">${escapeHtml(order.paymentOption)}</strong>
      </div>
      ${
        order.whatsappNote
          ? `
        <div class="order-meta-row">
          <span>Catatan / Email</span>
          <strong>${escapeHtml(order.whatsappNote)}</strong>
        </div>
      `
          : ''
      }
    `;
  }

  const itemsEl = document.getElementById('order-items-summary');
  if (itemsEl) {
    itemsEl.innerHTML = order.cart
      .map((item) => {
        const linePrice = item.price === 0 ? 'Custom' : formatRupiah(item.price * item.quantity);
        return `
          <div class="order-item-row">
            <div>
              <div class="order-item-title">${escapeHtml(item.productName)}</div>
              <div class="order-item-sub">${escapeHtml(item.variantName)} · Qty ${item.quantity}</div>
            </div>
            <span class="mono-num">${escapeHtml(linePrice)}</span>
          </div>
        `;
      })
      .join('');
  }

  const totalsEl = document.getElementById('order-totals-summary');
  if (totalsEl && order.totals) {
    const t = order.totals;
    const payLaterPct =
      t.payLaterPercent !== undefined
        ? t.payLaterPercent
        : Math.round(Number(t.payLaterRate ?? 0.1) * 1000) / 10;
    totalsEl.innerHTML = `
      <div class="summary-row">
        <span>Subtotal</span>
        <span class="mono-num">${escapeHtml(formatRupiah(t.subtotal))}</span>
      </div>
      ${
        t.discount > 0
          ? `<div class="summary-row is-discount">
              <span>Diskon Belanja</span>
              <span class="mono-num">-${escapeHtml(formatRupiah(t.discount))}</span>
            </div>`
          : ''
      }
      ${
        t.voucherCode && t.voucherDiscount > 0
          ? `<div class="summary-row is-discount">
              <span>Kode Voucher (${escapeHtml(t.voucherCode)})</span>
              <span class="mono-num">-${escapeHtml(formatRupiah(t.voucherDiscount))}</span>
            </div>`
          : ''
      }
      ${
        t.serviceFee > 0
          ? `<div class="summary-row">
              <span>${escapeHtml(t.serviceFeeLabel || 'Biaya Layanan')}</span>
              <span class="mono-num">+${escapeHtml(formatRupiah(t.serviceFee))}</span>
            </div>`
          : ''
      }
      ${
        t.isPayLater
          ? `<div class="summary-row is-fee">
              <span>Biaya Bayar Nanti (+${payLaterPct}%)</span>
              <span class="mono-num">${t.payLaterFee > 0 ? `+${escapeHtml(formatRupiah(t.payLaterFee))}` : `+${payLaterPct}% Final`}</span>
            </div>`
          : ''
      }
      <div class="summary-row is-total">
        <span>Total Bayar</span>
        <span class="mono-num">${escapeHtml(formatRupiah(t.total))}</span>
      </div>
    `;
  }
}

async function initOrderPage() {
  loadTheme();
  applyTheme();

  document.getElementById('theme-toggle-btn')?.addEventListener('click', () => {
    activeTheme = activeTheme === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem(THEME_STORAGE_KEY, activeTheme);
    } catch {
      // Ignore
    }
    applyTheme();
  });

  const emptyView = document.getElementById('order-empty-state');
  const readyView = document.getElementById('order-ready-view');

  const order = loadPendingOrder();
  if (!order) {
    if (emptyView) emptyView.hidden = false;
    if (readyView) readyView.hidden = true;
    return;
  }

  if (emptyView) emptyView.hidden = true;
  if (readyView) readyView.hidden = false;

  orderCaption = order.caption || '';
  renderOrderDetails(order);

  document.getElementById('open-whatsapp-link')?.addEventListener('click', () => {
    triggerReceiptDownload();
    copyReceiptPngInBackground();
    showToast('Struk diunduh otomatis — membuka WhatsApp Admin...');
  });

  const copyBtn = document.getElementById('copy-order-btn');
  copyBtn?.addEventListener('click', async () => {
    if (!orderCaption) return;
    try {
      await navigator.clipboard.writeText(orderCaption);
      copyBtn.textContent = 'Teks Tersalin';
      showToast('Rincian pesanan disalin ke clipboard');
    } catch {
      showToast('Salin teks gagal, gunakan tombol Unduh Struk.');
    }
  });

  try {
    const createdAt = order.createdAt ? new Date(order.createdAt) : new Date();
    const receipt = await generateReceiptImage({
      orderCode: order.orderCode,
      customerName: order.customerName,
      whatsappNote: order.whatsappNote || '',
      paymentOption: order.paymentOption,
      cart: order.cart,
      totals: order.totals,
      createdAt: Number.isNaN(createdAt.getTime()) ? new Date() : createdAt,
    });

    receiptObjectUrl = receipt.objectUrl;
    receiptFileName = receipt.fileName;
    getPngBlobFn = receipt.getPngBlob;

    const sizeEl = document.getElementById('order-receipt-size');
    if (sizeEl) sizeEl.textContent = `${receipt.sizeKb} KB · JPG`;

    const imgEl = document.getElementById('order-receipt-img');
    const loadingEl = document.getElementById('receipt-loading-text');
    if (imgEl) {
      imgEl.src = receipt.objectUrl;
      imgEl.alt = `Struk belanja Manifestudio ${order.orderCode}`;
      imgEl.hidden = false;
    }
    if (loadingEl) loadingEl.hidden = true;

    const dlBtn = document.getElementById('download-receipt-btn');
    if (dlBtn) {
      dlBtn.href = receipt.objectUrl;
      dlBtn.download = receipt.fileName;
    }
  } catch {
    const loadingEl = document.getElementById('receipt-loading-text');
    if (loadingEl) {
      loadingEl.textContent = 'Struk gambar gagal dirender. Gunakan tombol Kirim Pesanan ke WhatsApp di atas.';
    }
  }

  window.addEventListener('pagehide', () => {
    if (receiptObjectUrl) {
      try {
        URL.revokeObjectURL(receiptObjectUrl);
      } catch {
        // Ignore
      }
    }
  });

  loadCatalogData({ allowLocalPreview: true })
    .then((loaded) => {
      const brand = normalizeBrandConfig(loaded?.data?.brand || {});
      const logoEl = document.getElementById('header-brand-logo');
      if (logoEl && brand.logo) logoEl.src = brand.logo;
      const nameEl = document.getElementById('header-brand-name');
      if (nameEl && brand.name) nameEl.textContent = brand.name;
      const taglineEl = document.getElementById('header-brand-tagline');
      if (taglineEl && brand.tagline) taglineEl.textContent = brand.tagline;
    })
    .catch(() => {});

  initMusicPlayer();
}

initOrderPage();
