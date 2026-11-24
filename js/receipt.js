/**
 * Zero-dependency HTML5 Canvas 2D Receipt Image Generator
 * Anime Aesthetic Theme + National Standard Invoice Layout
 * Produces lightweight (~35-50 KB) high-contrast JPEG receipts
 * optimized for instant sharing via WhatsApp.
 */

import { formatRupiah } from './store.js';

function wrapLines(ctx, text, maxWidth) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];
  const lines = [];
  let current = words[0];

  for (let i = 1; i < words.length; i += 1) {
    const candidate = `${current} ${words[i]}`;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = words[i];
    }
  }
  lines.push(current);
  return lines;
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

function formatReceiptDate(date = new Date()) {
  try {
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 16).replace('T', ' ');
  }
}

export async function generateReceiptImage({
  orderCode,
  brandName = 'Manifestudio',
  footerText = '',
  customerName,
  whatsappNote = '',
  paymentOption,
  cart = [],
  totals,
  createdAt = new Date(),
}) {
  const safeBrand = String(brandName || 'Manifestudio').trim() || 'Manifestudio';
  const safeBrandUpper = safeBrand.toUpperCase();
  const safeFooter =
    String(footerText || '').trim() || `Dikelola oleh ${safeBrand} by Tomy © 2026`;
  const width = 580;
  const padX = 26;
  const innerW = width - padX * 2;
  const sans = '"Plus Jakarta Sans", "Inter", system-ui, -apple-system, sans-serif';
  const mono = '"JetBrains Mono", "SFMono-Regular", Consolas, monospace';

  // Measure pass using offscreen scratch canvas
  const measureCanvas = document.createElement('canvas');
  measureCanvas.width = width;
  measureCanvas.height = 100;
  const mctx = measureCanvas.getContext('2d');

  mctx.font = `600 14px ${sans}`;
  const itemLayouts = cart.map((item) => {
    const titleLines = wrapLines(mctx, `${item.productName}`, innerW - 130);
    mctx.font = `400 12px ${sans}`;
    const variantLines = wrapLines(mctx, `${item.variantName} · Qty ${item.quantity}`, innerW - 130);
    mctx.font = `600 14px ${sans}`;
    const rowHeight = Math.max(42, titleLines.length * 18 + variantLines.length * 16 + 12);
    return { item, titleLines, variantLines, rowHeight };
  });

  mctx.font = `500 12px ${sans}`;
  const noteText = whatsappNote.trim();
  const noteLines = noteText ? wrapLines(mctx, noteText, innerW - 120) : [];
  const paymentLines = wrapLines(mctx, paymentOption, innerW - 120);

  const headerH = 124;
  const metaH =
    74 +
    paymentLines.length * 18 +
    (totals.voucherCode ? 22 : 0) +
    (noteLines.length > 0 ? noteLines.length * 18 + 6 : 0);
  const itemsH = 34 + itemLayouts.reduce((sum, l) => sum + l.rowHeight, 0) + 12;

  let breakdownRows = 2; // Subtotal + Total
  if (totals.discount > 0) breakdownRows += 1;
  if (totals.voucherCode) breakdownRows += 1;
  if (totals.serviceFee > 0) breakdownRows += 1;
  if (totals.isPayLater) breakdownRows += 1;
  const summaryH = 32 + breakdownRows * 24 + (totals.isPayLater ? 42 : 0) + 16;
  const footerH = 68;

  const totalH = headerH + metaH + itemsH + summaryH + footerH;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = totalH;
  const ctx = canvas.getContext('2d');

  // Crisp invoice paper background
  ctx.fillStyle = '#FAFAFC';
  ctx.fillRect(0, 0, width, totalH);

  // Header band
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(0, 0, width, headerH);

  // Accent top bars
  ctx.fillStyle = '#06B6D4';
  ctx.fillRect(0, 0, width, 5);
  ctx.fillStyle = '#EC4899';
  ctx.fillRect(0, 5, width, 3);

  // Store title
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `800 21px ${sans}`;
  ctx.fillText(safeBrandUpper, padX, 42);

  ctx.fillStyle = '#94A3B8';
  ctx.font = `500 11px ${sans}`;
  ctx.fillText('FAKTUR PEMBAYARAN DIGITAL RESMI · PREMIUM ACCOUNT BY TOMY', padX, 64);

  // Invoice Code & Timestamp
  ctx.fillStyle = '#E2E8F0';
  ctx.font = `600 12px ${mono}`;
  ctx.fillText(`FAKTUR NO: ${orderCode}`, padX, 98);

  const dateText = formatReceiptDate(createdAt);
  const dateW = ctx.measureText(dateText).width;
  ctx.fillText(dateText, width - padX - dateW, 98);

  // Meta block
  let y = headerH + 22;
  const drawMetaRow = (label, valueLines, valueColor = '#0F172A') => {
    ctx.fillStyle = '#64748B';
    ctx.font = `500 12px ${sans}`;
    ctx.fillText(label, padX, y);

    ctx.fillStyle = valueColor;
    ctx.font = `600 12px ${sans}`;
    valueLines.forEach((line, idx) => {
      ctx.fillText(line, padX + 120, y + idx * 18);
    });
    y += Math.max(22, valueLines.length * 18 + 6);
  };

  drawMetaRow('Pemesan', [customerName.trim()]);
  drawMetaRow('Metode Bayar', paymentLines, totals.isPayLater ? '#B45309' : '#0F172A');
  if (totals.voucherCode) {
    const voucherTag =
      totals.voucherDiscount > 0
        ? `${totals.voucherCode} (-${formatRupiah(totals.voucherDiscount)})`
        : `${totals.voucherCode} (Verifikasi Admin)`;
    drawMetaRow('Kode Voucher', [voucherTag], '#047857');
  }
  if (noteLines.length > 0) {
    drawMetaRow('Catatan / Email', noteLines);
  }

  // Divider line
  y += 4;
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padX, y);
  ctx.lineTo(width - padX, y);
  ctx.stroke();

  // Items table header
  y += 22;
  ctx.fillStyle = '#475569';
  ctx.font = `700 11px ${sans}`;
  ctx.fillText('RINCIAN PRODUK & VARIAN', padX, y);
  const rightHead = 'SUBTOTAL';
  ctx.fillText(rightHead, width - padX - ctx.measureText(rightHead).width, y);
  y += 12;

  // Items rows
  for (const layout of itemLayouts) {
    const { item, titleLines, variantLines, rowHeight } = layout;
    const rowTop = y + 12;

    ctx.fillStyle = '#0F172A';
    ctx.font = `600 14px ${sans}`;
    titleLines.forEach((line, idx) => {
      ctx.fillText(line, padX, rowTop + idx * 18);
    });

    const variantStart = rowTop + titleLines.length * 18;
    ctx.fillStyle = '#64748B';
    ctx.font = `400 12px ${sans}`;
    variantLines.forEach((line, idx) => {
      ctx.fillText(line, padX, variantStart + idx * 16);
    });

    const lineTotalText =
      item.price === 0 ? 'Custom' : formatRupiah(item.price * item.quantity);
    ctx.fillStyle = '#0F172A';
    ctx.font = `600 13px ${mono}`;
    const priceW = ctx.measureText(lineTotalText).width;
    ctx.fillText(lineTotalText, width - padX - priceW, rowTop);

    y += rowHeight;
    ctx.strokeStyle = '#F1F5F9';
    ctx.beginPath();
    ctx.moveTo(padX, y);
    ctx.lineTo(width - padX, y);
    ctx.stroke();
  }

  // Summary box
  y += 14;
  const summaryBoxTop = y;
  const summaryBoxH = summaryH - 14;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(padX, summaryBoxTop, innerW, summaryBoxH);
  ctx.strokeStyle = '#E2E8F0';
  ctx.strokeRect(padX, summaryBoxTop, innerW, summaryBoxH);

  let sy = summaryBoxTop + 22;
  const drawSummaryRow = (label, valText, color = '#334155', bold = false) => {
    ctx.fillStyle = color;
    ctx.font = `${bold ? '700' : '500'} ${bold ? 15 : 12}px ${sans}`;
    ctx.fillText(label, padX + 14, sy);

    ctx.font = `${bold ? '700' : '600'} ${bold ? 16 : 12}px ${mono}`;
    const w = ctx.measureText(valText).width;
    ctx.fillText(valText, width - padX - 14 - w, sy);
    sy += bold ? 26 : 22;
  };

  const payLaterPct =
    totals.payLaterPercent !== undefined
      ? totals.payLaterPercent
      : Math.round(Number(totals.payLaterRate ?? 0.1) * 1000) / 10;

  drawSummaryRow('Subtotal', formatRupiah(totals.subtotal));
  if (totals.discount > 0) {
    drawSummaryRow('Diskon Belanja Otomatis', `-${formatRupiah(totals.discount)}`, '#047857');
  }
  if (totals.voucherCode) {
    const vText =
      totals.voucherDiscount > 0
        ? `-${formatRupiah(totals.voucherDiscount)}`
        : 'Verifikasi Admin';
    drawSummaryRow(`Voucher (${totals.voucherCode})`, vText, '#047857');
  }
  if (totals.serviceFee > 0) {
    drawSummaryRow(
      totals.serviceFeeLabel || 'Biaya Layanan',
      `+${formatRupiah(totals.serviceFee)}`,
      '#334155'
    );
  }
  if (totals.isPayLater) {
    const feeText =
      totals.payLaterFee > 0 ? `+${formatRupiah(totals.payLaterFee)}` : `+${payLaterPct}% Final`;
    drawSummaryRow(`Biaya Bayar Nanti (+${payLaterPct}%)`, feeText, '#B45309');
  }

  // Separator inside summary
  ctx.strokeStyle = '#CBD5E1';
  ctx.beginPath();
  ctx.moveTo(padX + 14, sy - 8);
  ctx.lineTo(width - padX - 14, sy - 8);
  ctx.stroke();
  sy += 8;

  drawSummaryRow('TOTAL PEMBAYARAN', formatRupiah(totals.total), '#0F172A', true);

  if (totals.isPayLater) {
    ctx.fillStyle = '#92400E';
    ctx.font = `500 11px ${sans}`;
    ctx.fillText(
      `* Sudah termasuk biaya layanan ${payLaterPct}% untuk metode Bayar Setelah Akun Diterima.`,
      padX + 14,
      sy + 2
    );
  }

  // Footer
  const fy = totalH - 36;
  ctx.fillStyle = '#64748B';
  ctx.font = `500 11px ${sans}`;
  ctx.fillText(`Kirim bukti faktur ini ke WhatsApp Admin ${safeBrand}`, padX, fy);
  ctx.fillStyle = '#94A3B8';
  ctx.font = `400 10px ${sans}`;
  ctx.fillText(`Faktur digital resmi divalidasi otomatis · ${safeFooter}`, padX, fy + 16);

  // Encode as lightweight JPEG (~35-50 KB)
  let blob = await canvasToBlob(canvas, 'image/jpeg', 0.85);
  let ext = 'jpg';
  let mimeType = 'image/jpeg';
  if (!blob) {
    blob = await canvasToBlob(canvas, 'image/png');
    ext = 'png';
    mimeType = 'image/png';
  }

  const brandSlug = safeBrand.toLowerCase().replace(/[^a-z0-9]+/g, '') || 'manifestore';
  const fileName = `faktur-${brandSlug}-${String(orderCode || 'order').toLowerCase()}.${ext}`;
  const file = new File([blob], fileName, { type: mimeType });
  const objectUrl = URL.createObjectURL(blob);
  const sizeKb = Math.max(1, Math.round(blob.size / 1024));

  const getPngBlob = () => canvasToBlob(canvas, 'image/png');

  return {
    blob,
    file,
    fileName,
    objectUrl,
    sizeKb,
    mimeType,
    width,
    height: totalH,
    getPngBlob,
  };
}
