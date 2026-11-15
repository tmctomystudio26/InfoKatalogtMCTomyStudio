/**
 * Pure storefront state, filtering, pricing, and checkout formatting utilities.
 * Zero DOM dependencies so all business logic can be unit tested directly.
 */

export function formatRupiah(amount) {
  const safeAmount = Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : 0;
  return `Rp${safeAmount.toLocaleString('id-ID')}`;
}

export function getStartingPrice(product) {
  if (!product || !Array.isArray(product.variants) || product.variants.length === 0) {
    return 0;
  }
  const priced = product.variants.map((v) => v.price).filter((p) => p > 0);
  if (priced.length === 0) return 0;
  return Math.min(...priced);
}

export function filterProducts(products, { category = 'all', query = '', inStockOnly = false } = {}) {
  const normalizedQuery = query.trim().toLowerCase();

  return products.filter((product) => {
    if (category !== 'all' && product.category !== category) {
      return false;
    }
    if (inStockOnly && product.outOfStock) {
      return false;
    }
    if (!normalizedQuery) {
      return true;
    }
    const inName = product.name.toLowerCase().includes(normalizedQuery);
    const inSummary = (product.summary || '').toLowerCase().includes(normalizedQuery);
    const inVariants = (product.variants || []).some((v) =>
      v.name.toLowerCase().includes(normalizedQuery)
    );
    return inName || inSummary || inVariants;
  });
}

export function addToCart(cart, entry) {
  const next = cart.map((item) => ({ ...item }));
  const existing = next.find(
    (item) => item.productId === entry.productId && item.variantId === entry.variantId
  );
  if (existing) {
    existing.quantity += 1;
  } else {
    next.push({
      productId: entry.productId,
      productName: entry.productName,
      variantId: entry.variantId,
      variantName: entry.variantName,
      price: entry.price,
      logo: entry.logo || '',
      quantity: 1,
    });
  }
  return next;
}

export function updateCartQty(cart, productId, variantId, delta) {
  const next = [];
  for (const item of cart) {
    if (item.productId === productId && item.variantId === variantId) {
      const updatedQty = item.quantity + delta;
      if (updatedQty > 0) {
        next.push({ ...item, quantity: updatedQty });
      }
    } else {
      next.push({ ...item });
    }
  }
  return next;
}

export function removeFromCart(cart, productId, variantId) {
  return cart.filter(
    (item) => !(item.productId === productId && item.variantId === variantId)
  );
}

export function calculateCartTotals(
  cart,
  { discountThreshold = 50000, discountAmount = 2000 } = {}
) {
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const qualifiesDiscount = subtotal >= discountThreshold && subtotal > 0;
  const discount = qualifiesDiscount ? discountAmount : 0;
  const total = Math.max(0, subtotal - discount);
  const remainingForDiscount = Math.max(0, discountThreshold - subtotal);
  const progressPercent = Math.min(
    100,
    Math.round((subtotal / Math.max(1, discountThreshold)) * 100)
  );

  return {
    itemCount,
    subtotal,
    discount,
    total,
    qualifiesDiscount,
    remainingForDiscount,
    progressPercent,
  };
}

export function validateOrderForm({ customerName, paymentOption, cart }) {
  if (!Array.isArray(cart) || cart.length === 0) {
    return { valid: false, error: 'Keranjang belanja masih kosong. Pilih minimal satu paket.' };
  }
  if (!customerName || !customerName.trim()) {
    return { valid: false, error: 'Masukkan nama panggilan Anda untuk identifikasi pesanan.' };
  }
  if (!paymentOption || !paymentOption.trim()) {
    return { valid: false, error: 'Pilih metode pembayaran terlebih dahulu.' };
  }
  return { valid: true, error: null };
}

export function buildWhatsAppOrderMessage({
  customerName,
  whatsappNote = '',
  paymentOption,
  cart,
  totals,
}) {
  const lines = [`Halo Admin Manifestudio, saya *${customerName.trim()}* ingin memesan:`, ''];

  for (const item of cart) {
    const lineTotal = item.price * item.quantity;
    const priceText = item.price === 0 ? 'Custom / Tanya Admin' : formatRupiah(lineTotal);
    lines.push(`- ${item.productName} (${item.variantName}) x${item.quantity} = ${priceText}`);
  }

  lines.push('');
  lines.push(`Subtotal: ${formatRupiah(totals.subtotal)}`);
  if (totals.discount > 0) {
    lines.push(`Diskon Belanja: -${formatRupiah(totals.discount)}`);
  }
  lines.push(`Total Bayar: *${formatRupiah(totals.total)}*`);
  lines.push(`Metode Pembayaran: ${paymentOption}`);
  if (whatsappNote.trim()) {
    lines.push(`Catatan: ${whatsappNote.trim()}`);
  }
  lines.push('');
  lines.push('Mohon diproses ya Kak. Terima kasih.');

  return encodeURIComponent(lines.join('\n'));
}
