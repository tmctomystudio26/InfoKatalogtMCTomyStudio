import test from 'node:test';
import assert from 'node:assert/strict';
import { PRODUCTS, VOUCHERS } from './data.js';
import {
  addToCart,
  buildWhatsAppOrderCaption,
  buildWhatsAppOrderMessage,
  calculateCartTotals,
  evaluateVoucher,
  filterProducts,
  formatRupiah,
  getStartingPrice,
  removeFromCart,
  updateCartQty,
  validateOrderForm,
} from './store.js';

test('formatRupiah formats Indonesian currency accurately', () => {
  assert.equal(formatRupiah(22500), 'Rp22.500');
  assert.equal(formatRupiah(0), 'Rp0');
  assert.equal(formatRupiah(-500), 'Rp0');
});

test('getStartingPrice ignores zero-priced custom items unless all zero', () => {
  const netflix = PRODUCTS.find((p) => p.id === 'netflix-premium');
  const custom = PRODUCTS.find((p) => p.id === 'request-custom');
  assert.equal(getStartingPrice(netflix), 22500);
  assert.equal(getStartingPrice(custom), 0);
});

test('filterProducts filters by category, search query, and stock availability', () => {
  const streamingOnly = filterProducts(PRODUCTS, { category: 'streaming' });
  assert.equal(streamingOnly.every((p) => p.category === 'streaming'), true);

  const canvaSearch = filterProducts(PRODUCTS, { query: 'canva' });
  assert.equal(canvaSearch.length, 1);
  assert.equal(canvaSearch[0].id, 'canva-pro');

  const inStock = filterProducts(PRODUCTS, { inStockOnly: true });
  assert.equal(inStock.some((p) => p.outOfStock), false);
});

test('cart operations add, increment, decrement, remove, and compute auto discount', () => {
  let cart = [];
  cart = addToCart(cart, {
    productId: 'netflix-premium',
    productName: 'Netflix Premium',
    variantId: 'nf-1p1u',
    variantName: '1 Bulan - Sharing 1P1U',
    price: 30000,
  });
  cart = addToCart(cart, {
    productId: 'netflix-premium',
    productName: 'Netflix Premium',
    variantId: 'nf-1p1u',
    variantName: '1 Bulan - Sharing 1P1U',
    price: 30000,
  });
  assert.equal(cart.length, 1);
  assert.equal(cart[0].quantity, 2);

  const totals = calculateCartTotals(cart);
  assert.equal(totals.itemCount, 2);
  assert.equal(totals.subtotal, 60000);
  assert.equal(totals.qualifiesDiscount, true);
  assert.equal(totals.discount, 2000);
  assert.equal(totals.total, 58000);

  cart = updateCartQty(cart, 'netflix-premium', 'nf-1p1u', -1);
  assert.equal(cart[0].quantity, 1);
  const belowThreshold = calculateCartTotals(cart);
  assert.equal(belowThreshold.qualifiesDiscount, false);
  assert.equal(belowThreshold.discount, 0);
  assert.equal(belowThreshold.remainingForDiscount, 20000);

  cart = removeFromCart(cart, 'netflix-premium', 'nf-1p1u');
  assert.equal(cart.length, 0);
});

test('evaluateVoucher and Pay Later 10% surcharge compute accurately', () => {
  const validFixed = evaluateVoucher(' hemat2k ', 22500, VOUCHERS);
  assert.equal(validFixed.status, 'applied');
  assert.equal(validFixed.code, 'HEMAT2K');
  assert.equal(validFixed.discount, 2000);

  const ineligible = evaluateVoucher('MANIFEST5', 20000, VOUCHERS);
  assert.equal(ineligible.status, 'ineligible');
  assert.equal(ineligible.discount, 0);

  const unknown = evaluateVoucher('VIPADMIN', 30000, VOUCHERS);
  assert.equal(unknown.status, 'pending_admin');
  assert.equal(unknown.discount, 0);

  const cart = [
    {
      productId: 'netflix-premium',
      productName: 'Netflix Premium',
      variantId: 'nf-1p1u',
      variantName: '1 Bulan - Sharing 1P1U',
      price: 30000,
      quantity: 1,
    },
  ];
  // Subtotal 30.000 - voucher HEMAT2K (2.000) = 28.000; +10% Pay Later = +2.800 -> 30.800
  const payLaterTotals = calculateCartTotals(cart, {
    voucherCode: 'HEMAT2K',
    vouchers: VOUCHERS,
    paymentOption: 'Bayar Belakangan (Setelah Akun Diterima)',
    payLaterRate: 0.1,
  });
  assert.equal(payLaterTotals.voucherDiscount, 2000);
  assert.equal(payLaterTotals.isPayLater, true);
  assert.equal(payLaterTotals.payLaterFee, 2800);
  assert.equal(payLaterTotals.total, 30800);
});

test('validateOrderForm and buildWhatsAppOrderMessage include voucher and 10% fee', () => {
  const emptyCheck = validateOrderForm({
    customerName: 'Tomi',
    paymentOption: 'Bayar Sekarang',
    cart: [],
  });
  assert.equal(emptyCheck.valid, false);

  const missingName = validateOrderForm({
    customerName: '  ',
    paymentOption: 'Bayar Sekarang',
    cart: [{ productId: 'a', variantId: 'b', price: 3000, quantity: 1 }],
  });
  assert.equal(missingName.valid, false);

  const cart = [
    {
      productId: 'canva-pro',
      productName: 'Canva Pro',
      variantId: 'canva-6m',
      variantName: '6 Bulan',
      price: 20000,
      quantity: 1,
    },
  ];
  const totals = calculateCartTotals(cart, {
    voucherCode: 'HEMAT2K',
    vouchers: VOUCHERS,
    paymentOption: 'Bayar Belakangan (Setelah Akun Diterima)',
    payLaterRate: 0.1,
  });
  const ok = validateOrderForm({
    customerName: 'Andi',
    paymentOption: 'Bayar Belakangan (Setelah Akun Diterima)',
    cart,
  });
  assert.equal(ok.valid, true);

  const caption = buildWhatsAppOrderCaption({
    orderCode: 'MS-261115-120000',
    customerName: 'Andi',
    whatsappNote: 'Email akun: andi@mail.com',
    paymentOption: 'Bayar Belakangan (Setelah Akun Diterima)',
    cart,
    totals,
  });
  assert.equal(caption.includes('MS-261115-120000'), true);
  assert.equal(caption.includes('HEMAT2K'), true);
  assert.equal(caption.includes('Biaya Bayar Nanti (+10%)'), true);
  assert.equal(caption.includes('Struk gambar terlampir'), true);

  const encoded = buildWhatsAppOrderMessage({
    orderCode: 'MS-261115-120000',
    customerName: 'Andi',
    whatsappNote: 'Email akun: andi@mail.com',
    paymentOption: 'Bayar Belakangan (Setelah Akun Diterima)',
    cart,
    totals,
  });
  const decoded = decodeURIComponent(encoded);
  assert.equal(decoded.includes('Rp19.800'), true);
});
