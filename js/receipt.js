/**
 * Zero-dependency HTML5 Canvas 2D Receipt Image Generator
 * Produces lightweight (~25-55 KB) high-contrast JPEG/PNG order receipts
 * directly inside static GitHub Pages browsers (even offline).
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
  customerName,
  whatsappNote = '',
  paymentOption,
  cart = [],
  totals,
  createdAt = new Date(),
}) {
  const width = 580;
  const padX = 28;
  const innerW = width - padX * 2;
  const sans = '"Plus Jakarta Sans", "Inter", system-ui, -apple-system, sans-serif';
  const mono = '"JetBrains Mono", "SFMono-Regular", Consolas, monospace';

  // Measure pass using offscreen scratch canvas
  const measureCanvas = document.createElement('canvas');
  measureCanvas.width = width;
  measureCanvas.height = 100;
  const mctx = measureCanvas.getContext('2d');

  mctx.font = `600 15px ${sans}`;
  const itemLayouts = cart.map((item) => {
    const titleLines = wrapLines(mctx, `${item.productName}`, innerW - 140);
    mctx.font = `400 13px ${sans}`;
    const variantLines = wrapLines(mctx, `${item.variantName} · Qty ${item.quantity}`, innerW - 140);
    mctx.font = `600 15px ${sans}`;
    const rowHeight = Math.max(46, titleLines.length * 19 + variantLines.length * 17 + 14);
    return { item, titleLines, variantLines, rowHeight };
  });

  mctx.font = `500 13px ${sans}`;
  const noteText = whatsappNote.trim();
  const noteLines = noteText ? wrapLines(mctx, noteText, innerW - 125) : [];
  const paymentLines = wrapLines(mctx, paymentOption, innerW - 125);

  const headerH = 112;
  const metaH =
    78 +
    paymentLines.length * 18 +
    (totals.voucherCode ? 24 : 0) +
    (noteLines.length > 0 ? noteLines.length * 18 + 8 : 0);
  const itemsH = 38 + itemLayouts.reduce((sum, l) => sum + l.rowHeight, 0) + 12;

  let breakdownRows = 2; // Subtotal + Total
  if (totals.discount > 0) breakdownRows += 1;
  if (totals.voucherCode) breakdownRows += 1;
  if (totals.isPayLater) breakdownRows += 1;
  const summaryH = 36 + breakdownRows * 26 + (totals.isPayLater ? 46 : 0) + 20;
  const footerH = 74;

  const totalH = headerH + metaH + itemsH + summaryH + footerH;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = totalH;
  const ctx = canvas.getContext('2d');

  // Crisp paper background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, totalH);

  // Header band
  ctx.fillStyle = '#0B1220';
  ctx.fillRect(0, 0, width, headerH);
  ctx.fillStyle = '#2563EB';
  ctx.fillRect(0, 0, width, 6);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = `800 22px ${sans}`;
  ctx.fillText('MANIFESTUDIO', padX, 44);

  ctx.fillStyle = '#94A3B8';
  ctx.font = `500 12px ${sans}`;
  ctx.fillText('STRUK PEMESANAN DIGITAL RESMI · BUKTI CHECKOUT', padX, 66);

  ctx.fillStyle = '#E2E8F0';
  ctx.font = `600 12px ${mono}`;
  ctx.fillText(`NO: ${orderCode}`, padX, 92);

  const dateText = formatReceiptDate(createdAt);
  const dateW = ctx.measureText(dateText).width;
  ctx.fillText(dateText, width - padX - dateW, 92);

  // Meta block
  let y = headerH + 26;
  const drawMetaRow = (label, valueLines, valueColor = '#0F172A') => {
    ctx.fillStyle = '#64748B';
    ctx.font = `500 13px ${sans}`;
    ctx.fillText(label, padX, y);

    ctx.fillStyle = valueColor;
    ctx.font = `600 13px ${sans}`;
    valueLines.forEach((line, idx) => {
      ctx.fillText(line, padX + 125, y + idx * 18);
    });
    y += Math.max(24, valueLines.length * 18 + 6);
  };

  drawMetaRow('Pemesan', [customerName.trim()]);
  drawMetaRow('Pembayaran', paymentLines, totals.isPayLater ? '#B45309' : '#0F172A');
  if (totals.voucherCode) {
    const voucherTag =
      totals.voucherDiscount > 0
        ? `${totals.voucherCode} (-${formatRupiah(totals.voucherDiscount)})`
        : `${totals.voucherCode} (Cek Admin)`;
    drawMetaRow('Kode Voucher', [voucherTag], '#047857');
  }
  if (noteLines.length > 0) {
    drawMetaRow('Catatan/Email', noteLines);
  }

  // Divider
  y += 6;
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padX, y);
  ctx.lineTo(width - padX, y);
  ctx.stroke();

  // Items header
  y += 24;
  ctx.fillStyle = '#475569';
  ctx.font = `700 12px ${sans}`;
  ctx.fillText('RINCIAN PAKET DIPESAN', padX, y);
  const rightHead = 'SUBTOTAL';
  ctx.fillText(rightHead, width - padX - ctx.measureText(rightHead).width, y);
  y += 14;

  // Items rows
  for (const layout of itemLayouts) {
    const { item, titleLines, variantLines, rowHeight } = layout;
    const rowTop = y + 14;

    ctx.fillStyle = '#0F172A';
    ctx.font = `600 15px ${sans}`;
    titleLines.forEach((line, idx) => {
      ctx.fillText(line, padX, rowTop + idx * 19);
    });

    const variantStart = rowTop + titleLines.length * 19;
    ctx.fillStyle = '#64748B';
    ctx.font = `400 13px ${sans}`;
    variantLines.forEach((line, idx) => {
      ctx.fillText(line, padX, variantStart + idx * 17);
    });

    const lineTotalText =
      item.price === 0 ? 'Custom' : formatRupiah(item.price * item.quantity);
    ctx.fillStyle = '#0F172A';
    ctx.font = `600 14px ${mono}`;
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
  y += 16;
  const summaryBoxTop = y;
  const summaryBoxH = summaryH - 18;
  ctx.fillStyle = '#F8FAFC';
  ctx.fillRect(padX, summaryBoxTop, innerW, summaryBoxH);
  ctx.strokeStyle = '#E2E8F0';
  ctx.strokeRect(padX, summaryBoxTop, innerW, summaryBoxH);

  let sy = summaryBoxTop + 26;
  const drawSummaryRow = (label, valText, color = '#334155', bold = false) => {
    ctx.fillStyle = color;
    ctx.font = `${bold ? '700' : '500'} ${bold ? 16 : 13}px ${sans}`;
    ctx.fillText(label, padX + 16, sy);

    ctx.font = `${bold ? '700' : '600'} ${bold ? 17 : 13}px ${mono}`;
    const w = ctx.measureText(valText).width;
    ctx.fillText(valText, width - padX - 16 - w, sy);
    sy += bold ? 28 : 24;
  };

  drawSummaryRow('Subtotal', formatRupiah(totals.subtotal));
  if (totals.discount > 0) {
    drawSummaryRow('Diskon Belanja (>= Rp50.000)', `-${formatRupiah(totals.discount)}`, '#047857');
  }
  if (totals.voucherCode) {
    const vText =
      totals.voucherDiscount > 0
        ? `-${formatRupiah(totals.voucherDiscount)}`
        : 'Cek Admin';
    drawSummaryRow(`Voucher (${totals.voucherCode})`, vText, '#047857');
  }
  if (totals.isPayLater) {
    const feeText =
      totals.payLaterFee > 0 ? `+${formatRupiah(totals.payLaterFee)}` : '+10% Final';
    drawSummaryRow('Biaya Bayar Nanti (+10%)', feeText, '#B45309');
  }

  // Separator inside summary
  ctx.strokeStyle = '#CBD5E1';
  ctx.beginPath();
  ctx.moveTo(padX + 16, sy - 10);
  ctx.lineTo(width - padX - 16, sy - 10);
  ctx.stroke();
  sy += 10;

  drawSummaryRow('TOTAL BAYAR', formatRupiah(totals.total), '#0F172A', true);

  if (totals.isPayLater) {
    ctx.fillStyle = '#92400E';
    ctx.font = `500 12px ${sans}`;
    ctx.fillText(
      '* Termasuk biaya layanan 10% untuk metode Bayar Setelah Akun Diterima.',
      padX + 16,
      sy + 4
    );
  }

  // Footer
  const fy = totalH - 42;
  ctx.fillStyle = '#64748B';
  ctx.font = `500 12px ${sans}`;
  ctx.fillText('Kirim gambar struk ini ke WhatsApp Admin Manifestudio: +62 851-2293-6027', padX, fy);
  ctx.fillStyle = '#94A3B8';
  ctx.font = `400 11px ${sans}`;
  ctx.fillText('Struk dibuat otomatis oleh web statis Manifestudio (tMC Tomy Studio)', padX, fy + 18);

  // Encode as lightweight JPEG (typically 30-55 KB) with PNG fallback
  let blob = await canvasToBlob(canvas, 'image/jpeg', 0.86);
  let ext = 'jpg';
  let mimeType = 'image/jpeg';
  if (!blob) {
    blob = await canvasToBlob(canvas, 'image/png');
    ext = 'png';
    mimeType = 'image/png';
  }

  const fileName = `struk-${String(orderCode || 'manifestudio').toLowerCase()}.${ext}`;
  const file = new File([blob], fileName, { type: mimeType });
  const objectUrl = URL.createObjectURL(blob);
  const sizeKb = Math.max(1, Math.round(blob.size / 1024));

  // Also keep a lightweight PNG blob promise helper for ClipboardItem if needed
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
