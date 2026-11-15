/**
 * Pure storefront state, filtering, pricing, voucher, 10% pay-later fee,
 * clean WhatsApp message template formatting, and admin catalog helpers.
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

export function evaluateVoucher(codeInput = '', subtotal = 0, vouchers = [], usedVouchers = []) {
  const cleanCode = String(codeInput || '').trim().toUpperCase();
  if (!cleanCode) {
    return {
      status: 'none',
      code: '',
      discount: 0,
      message: '',
    };
  }

  if (
    Array.isArray(usedVouchers) &&
    usedVouchers.map((v) => String(v || '').trim().toUpperCase()).includes(cleanCode)
  ) {
    return {
      status: 'used',
      code: cleanCode,
      discount: 0,
      message: `Kode voucher "${cleanCode}" sudah pernah digunakan (sekali pakai).`,
    };
  }

  const matched = Array.isArray(vouchers)
    ? vouchers.find((v) => String(v.code || '').toUpperCase() === cleanCode)
    : null;

  if (!matched) {
    return {
      status: 'pending_admin',
      code: cleanCode,
      discount: 0,
      message: `Kode "${cleanCode}" dicatat dan akan diverifikasi Admin saat konfirmasi.`,
    };
  }

  if (subtotal < (matched.minSubtotal || 0)) {
    return {
      status: 'ineligible',
      code: cleanCode,
      discount: 0,
      message: `Kode ${cleanCode} aktif untuk minimal belanja ${formatRupiah(matched.minSubtotal)}.`,
    };
  }

  let rawDiscount = 0;
  if (matched.type === 'percent') {
    rawDiscount = Math.round((subtotal * matched.value) / 100);
    if (matched.maxDiscount > 0) {
      rawDiscount = Math.min(rawDiscount, matched.maxDiscount);
    }
  } else {
    rawDiscount = Math.round(matched.value || 0);
  }

  const discount = Math.max(0, Math.min(subtotal, rawDiscount));
  return {
    status: 'applied',
    code: cleanCode,
    discount,
    message: `Voucher ${cleanCode} aktif (-${formatRupiah(discount)}).`,
  };
}

export function calculateCartTotals(
  cart,
  {
    discountThreshold = 50000,
    discountAmount = 2000,
    voucherCode = '',
    vouchers = [],
    usedVouchers = [],
    paymentOption = 'Bayar Sekarang',
    payLaterRate = 0.1,
  } = {}
) {
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const qualifiesDiscount = subtotal >= discountThreshold && subtotal > 0;
  const discount = qualifiesDiscount ? discountAmount : 0;
  const afterAutoDiscount = Math.max(0, subtotal - discount);

  const voucherResult = evaluateVoucher(voucherCode, subtotal, vouchers, usedVouchers);
  const voucherDiscount = Math.min(afterAutoDiscount, voucherResult.discount);
  const afterDiscounts = Math.max(0, afterAutoDiscount - voucherDiscount);

  const isPayLater = paymentOption === 'Bayar Belakangan (Setelah Akun Diterima)';
  const payLaterFee = isPayLater && afterDiscounts > 0
    ? Math.round(afterDiscounts * payLaterRate)
    : 0;

  const total = afterDiscounts + payLaterFee;
  const remainingForDiscount = Math.max(0, discountThreshold - subtotal);
  const progressPercent = Math.min(
    100,
    Math.round((subtotal / Math.max(1, discountThreshold)) * 100)
  );

  return {
    itemCount,
    subtotal,
    discount,
    voucherCode: voucherResult.code,
    voucherStatus: voucherResult.status,
    voucherDiscount,
    voucherMessage: voucherResult.message,
    afterDiscounts,
    isPayLater,
    payLaterRate,
    payLaterFee,
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

export function generateOrderCode(now = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const yy = String(now.getFullYear()).slice(-2);
  const mm = pad(now.getMonth() + 1);
  const dd = pad(now.getDate());
  const hh = pad(now.getHours());
  const min = pad(now.getMinutes());
  const sec = pad(now.getSeconds());
  return `MS-${yy}${mm}${dd}-${hh}${min}${sec}`;
}

export function buildWhatsAppOrderCaption({
  orderCode = '',
  customerName,
  whatsappNote = '',
  paymentOption,
  cart,
  totals,
}) {
  const lines = [
    '*PESANAN BARU — MANIFESTUDIO*',
    ...(orderCode ? [`No. Pesanan: *${orderCode}*`] : []),
    `Pemesan: *${customerName.trim()}*`,
    '',
    '*Rincian Paket:*',
  ];

  cart.forEach((item, index) => {
    const lineTotal = item.price * item.quantity;
    const priceText = item.price === 0 ? 'Custom / Tanya Admin' : formatRupiah(lineTotal);
    lines.push(`${index + 1}. ${item.productName} — ${item.variantName}`);
    lines.push(`   Jumlah: ${item.quantity}x · Harga: ${priceText}`);
  });

  lines.push('');
  lines.push('*Ringkasan Tagihan:*');
  lines.push(`• Subtotal: ${formatRupiah(totals.subtotal)}`);
  if (totals.discount > 0) {
    lines.push(`• Diskon Belanja: -${formatRupiah(totals.discount)}`);
  }
  if (totals.voucherCode) {
    if (totals.voucherDiscount > 0) {
      lines.push(`• Voucher (${totals.voucherCode}): -${formatRupiah(totals.voucherDiscount)}`);
    } else {
      lines.push(`• Kode Voucher: ${totals.voucherCode} (Menunggu Cek Admin)`);
    }
  }
  if (totals.isPayLater) {
    if (totals.payLaterFee > 0) {
      lines.push(`• Biaya Bayar Nanti (+10%): +${formatRupiah(totals.payLaterFee)}`);
    } else {
      lines.push('• Biaya Bayar Nanti: +10% dari harga final');
    }
  }
  lines.push(`• *Total Bayar: ${formatRupiah(totals.total)}*`);

  lines.push('');
  lines.push('*Informasi Pembayaran:*');
  lines.push(`• Metode: ${paymentOption}`);
  if (whatsappNote.trim()) {
    lines.push(`• Catatan / Email: ${whatsappNote.trim()}`);
  }

  lines.push('');
  lines.push(
    '_Struk belanja otomatis sudah diunduh di perangkat saya (siap dilampirkan jika diperlukan). Mohon diproses ya Admin, terima kasih._'
  );

  return lines.join('\n');
}

export function buildWhatsAppOrderMessage(params) {
  return encodeURIComponent(buildWhatsAppOrderCaption(params));
}

export const PENDING_ORDER_STORAGE_KEY = 'manifestudio_pending_order_v1';

export function createOrderSnapshot({
  orderCode,
  whatsappNumber = '6285122936027',
  customerName,
  whatsappNote = '',
  paymentOption,
  cart = [],
  totals,
  now = new Date(),
}) {
  const safeCart = (Array.isArray(cart) ? cart : []).map((item) => ({
    productId: item.productId,
    productName: item.productName,
    variantId: item.variantId,
    variantName: item.variantName,
    price: item.price,
    logo: item.logo || '',
    quantity: item.quantity,
  }));
  const caption = buildWhatsAppOrderCaption({
    orderCode,
    customerName,
    whatsappNote,
    paymentOption,
    cart: safeCart,
    totals,
  });

  return {
    orderCode,
    createdAt: now instanceof Date ? now.toISOString() : String(now),
    whatsappNumber: String(whatsappNumber || '6285122936027'),
    customerName: String(customerName || '').trim(),
    whatsappNote: String(whatsappNote || '').trim(),
    paymentOption,
    cart: safeCart,
    totals: { ...totals },
    caption,
    whatsappUrl: `https://wa.me/${String(whatsappNumber || '6285122936027')}?text=${encodeURIComponent(caption)}`,
  };
}

export function slugifyId(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || `item-${Date.now()}`;
}

export function toggleProductStockInCatalog(catalog, productId, outOfStock, restockMessage = 'Akan segera restock') {
  const nextProducts = (catalog.products || []).map((product) => {
    if (product.id !== productId) return product;
    return {
      ...product,
      outOfStock: Boolean(outOfStock),
      tag: outOfStock ? 'Segera Restock' : product.tag === 'Segera Restock' ? 'Tersedia' : product.tag || 'Tersedia',
      restockMessage: outOfStock ? restockMessage : undefined,
      variants: (product.variants || []).map((v) => ({
        ...v,
        outOfStock: Boolean(outOfStock),
      })),
    };
  });
  return { ...catalog, products: nextProducts };
}

export function upsertProductInCatalog(catalog, productInput) {
  const cleanName = String(productInput.name || '').trim();
  if (!cleanName) {
    throw new Error('Nama produk wajib diisi.');
  }

  const variants = Array.isArray(productInput.variants)
    ? productInput.variants
        .filter((v) => String(v.name || '').trim())
        .map((v, idx) => ({
          id: v.id ? String(v.id).trim() : `${slugifyId(cleanName)}-v${idx + 1}`,
          name: String(v.name).trim(),
          price: Math.max(0, Math.round(Number(v.price) || 0)),
          ...(Number(v.oldPrice) > 0 ? { oldPrice: Math.round(Number(v.oldPrice)) } : {}),
          outOfStock: Boolean(v.outOfStock),
          ...(v.description ? { description: String(v.description).trim() } : {}),
          ...(v.outOfStock && v.restockMessage ? { restockMessage: String(v.restockMessage).trim() } : {}),
        }))
    : [];

  if (variants.length === 0) {
    throw new Error('Produk harus memiliki minimal satu varian paket.');
  }

  const allOutOfStock = variants.every((v) => v.outOfStock);
  const normalizedProduct = {
    id: productInput.id ? String(productInput.id).trim() : slugifyId(cleanName),
    name: cleanName,
    category: productInput.category || 'streaming',
    logo: String(productInput.logo || './assets/logos/custom-request.svg').trim(),
    isBestSeller: Boolean(productInput.isBestSeller),
    outOfStock: productInput.outOfStock !== undefined ? Boolean(productInput.outOfStock) : allOutOfStock,
    tag: String(productInput.tag || (allOutOfStock ? 'Segera Restock' : 'Tersedia')).trim(),
    summary: String(productInput.summary || '').trim(),
    ...(productInput.notice ? { notice: String(productInput.notice).trim() } : {}),
    ...(allOutOfStock || productInput.outOfStock
      ? { restockMessage: String(productInput.restockMessage || 'Akan segera restock').trim() }
      : {}),
    variants,
  };

  const products = [...(catalog.products || [])];
  const existingIdx = products.findIndex((p) => p.id === normalizedProduct.id);
  if (existingIdx >= 0) {
    products[existingIdx] = normalizedProduct;
  } else {
    products.push(normalizedProduct);
  }

  return { ...catalog, products };
}
