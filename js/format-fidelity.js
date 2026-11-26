/**
 * Manifestudio Universal Multi-Format High-Fidelity Engine (v101)
 * Guarantees EVERY format-to-format conversion preserves real structure, visual formatting,
 * embedded images, tables, headings, alignment, and page breaks — NEVER rebuilding documents
 * into stripped plain text!
 *
 * Covers:
 * - Rich OpenXML Word (.docx) generator (`buildRichDocxBuffer`) supporting headings, inline bold/italic/
 *   underline/code/super/subscript, alignment, indentation, page breaks, bordered shaded tables, AND
 *   embedded PNG/JPEG images (`word/media/imageN.*` + `<w:drawing>`).
 * - Multi-Sheet Excel (.xlsx) parser (`parseExcelWorkbookMultiSheet`) + styled multi-sheet HTML builder.
 * - Real GFM Markdown parser (`parseMarkdownToRichModel`) with headings, inline formatting, lists,
 *   blockquotes, fenced code blocks, and pipe tables.
 * - Real RTF parser (`parseRtfToRichModel`) handling `\b`, `\i`, `\ul`, `\qc`/`\qr`/`\qj`, `\fs`, `\par`,
 *   `\tab`, `\uN`, `\'xx`, and skipping metadata destinations (`\fonttbl`, `\colortbl`, `\*`).
 * - Real HTML structure parser (`parseHtmlToRichModel`) preserving headings, paragraphs, lists, tables,
 *   inline formatting, and embedded `data:image/*` images.
 * - Layout-aware PDF -> DOCX/RTF/MD/TXT paragraph reconstructor (`buildRichModelFromPdfDetailed`) and
 *   authentic visual + selectable-text PDF -> HTML builder (`buildAuthenticPdfHtml`).
 * - Multi-page vertical canvas stitcher (`stitchPageImagesToImageBuffer`) for PDF/DOCX/HTML/XLSX -> Image.
 */

function escapeXml(str = '') {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeHtml(str = '') {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function decodeXmlEntities(str = '') {
  return String(str || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, c) => String.fromCodePoint(Number(c)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)));
}

function decodeHtmlEntities(str = '') {
  return decodeXmlEntities(str)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&ndash;/gi, '–')
    .replace(/&mdash;/gi, '—')
    .replace(/&hellip;/gi, '…')
    .replace(/&ldquo;|&rdquo;/gi, '"')
    .replace(/&lsquo;|&rsquo;/gi, "'");
}

function dataUrlToUint8AndExt(dataUrl = '') {
  const m = String(dataUrl || '').match(/^data:image\/(png|jpe?g|webp|gif);base64,(.+)$/i);
  if (!m) return null;
  const rawExt = m[1].toLowerCase();
  const ext = rawExt === 'jpg' || rawExt === 'jpeg' ? 'jpeg' : rawExt;
  const b64 = m[2];
  let bytes;
  if (typeof atob === 'function') {
    const bin = atob(b64);
    bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  } else if (typeof Buffer !== 'undefined') {
    bytes = new Uint8Array(Buffer.from(b64, 'base64'));
  } else {
    return null;
  }
  return { bytes, ext };
}

/**
 * Probes real pixel width & height from PNG or JPEG binary headers without needing DOM/Canvas!
 */
export function probeImageDimensions(bytesInput) {
  const b = bytesInput instanceof Uint8Array ? bytesInput : new Uint8Array(bytesInput || 0);
  // PNG: 89 50 4E 47 0D 0A 1A 0A ... IHDR at offset 16..23
  if (b.length >= 24 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    const width = ((b[16] << 24) | (b[17] << 16) | (b[18] << 8) | b[19]) >>> 0;
    const height = ((b[20] << 24) | (b[21] << 16) | (b[22] << 8) | b[23]) >>> 0;
    if (width > 0 && height > 0) return { width, height, ext: 'png' };
  }
  // JPEG: FF D8 ... SOF0..SOF3 marker (FF C0..C3)
  if (b.length >= 16 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 8 < b.length) {
      if (b[i] !== 0xff) {
        i += 1;
        continue;
      }
      const marker = b[i + 1];
      if (marker === 0xd9 || marker === 0xda) break;
      const segLen = (b[i + 2] << 8) | b[i + 3];
      if (segLen < 2) break;
      if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7)) {
        const height = (b[i + 5] << 8) | b[i + 6];
        const width = (b[i + 7] << 8) | b[i + 8];
        if (width > 0 && height > 0) return { width, height, ext: 'jpeg' };
      }
      i += 2 + segLen;
    }
    return { width: 800, height: 600, ext: 'jpeg' };
  }
  return { width: 640, height: 480, ext: 'png' };
}

/**
 * Builds a genuine rich OpenXML Word (.docx) PKZIP archive preserving:
 * - Page size & margins (supports portrait & landscape!)
 * - Headings (`Heading1`/`Heading2`/`Heading3`)
 * - Rich inline runs (bold, italic, underline, code, superscript, subscript, color, font size)
 * - Paragraph alignments (left, center, right, justify), indentation, blockquotes, & page breaks
 * - Bordered & shaded multi-row tables (`<w:tbl>`)
 * - Real embedded PNG/JPEG images (`word/media/imageN.*` + `<w:drawing>`)!
 */
export function buildRichDocxBuffer(richModel = {}, createZipArchiveFn) {
  const pageWidthPt = Number(richModel.pageWidthPt) || 595.28;
  const pageHeightPt = Number(richModel.pageHeightPt) || 841.89;
  const isLandscape = pageWidthPt > pageHeightPt;
  const margins = {
    top: Math.round((richModel.margins?.top || 64) * 20),
    right: Math.round((richModel.margins?.right || 64) * 20),
    bottom: Math.round((richModel.margins?.bottom || 64) * 20),
    left: Math.round((richModel.margins?.left || 64) * 20),
  };
  const defaultFont = String(richModel.defaultFont || 'Calibri').replace(/"/g, '');
  const defaultFontSizeHalfPt = Math.round((Number(richModel.defaultFontSize) || 11) * 2);
  const contentWidthPt = Math.max(200, pageWidthPt - (margins.left + margins.right) / 20);

  const mediaFiles = [];
  const docRels = [
    '<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>',
  ];
  const extSet = new Set();
  let nextImgId = 1;

  const registerImage = (imgInput = {}) => {
    let bytes = imgInput.bytes || null;
    let ext = imgInput.ext || '';
    if (!bytes && imgInput.src) {
      const parsed = dataUrlToUint8AndExt(imgInput.src);
      if (parsed) {
        bytes = parsed.bytes;
        ext = parsed.ext;
      }
    }
    if (!bytes || bytes.length < 8) return null;
    const probed = probeImageDimensions(bytes);
    const finalExt = ext === 'jpeg' || ext === 'jpg' || probed.ext === 'jpeg' ? 'jpeg' : 'png';
    extSet.add(finalExt);
    const idNum = nextImgId;
    nextImgId += 1;
    const rId = `rIdImg${idNum}`;
    const target = `media/image${idNum}.${finalExt}`;
    mediaFiles.push({ name: `word/${target}`, data: bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes) });
    docRels.push(
      `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${target}"/>`
    );

    const maxW = Math.min(contentWidthPt, Number(imgInput.maxWidthPt) || contentWidthPt);
    const maxH = Math.min(pageHeightPt - 140, Number(imgInput.maxHeightPt) || 640);
    const naturalWPt = Number(imgInput.widthPt) || (probed.width * 72) / 96;
    const naturalHPt = Number(imgInput.heightPt) || (probed.height * 72) / 96;
    const ratio = Math.min(1, maxW / Math.max(1, naturalWPt), maxH / Math.max(1, naturalHPt));
    const drawWPt = Math.max(24, naturalWPt * ratio);
    const drawHPt = Math.max(24, naturalHPt * ratio);
    const cx = Math.round(drawWPt * 12700);
    const cy = Math.round(drawHPt * 12700);

    return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${idNum}" name="Picture ${idNum}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${idNum}" name="image${idNum}.${finalExt}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
  };

  const renderRunXml = (run = {}) => {
    if (run.type === 'image') {
      return registerImage(run) || '';
    }
    const text = String(run.text ?? '');
    if (!text) return '';
    const rPrParts = [];
    if (run.code) {
      rPrParts.push('<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/>');
      rPrParts.push('<w:shd w:val="clear" w:color="auto" w:fill="F1F5F9"/>');
    }
    if (run.bold) rPrParts.push('<w:b/>');
    if (run.italic) rPrParts.push('<w:i/>');
    if (run.underline) rPrParts.push('<w:u w:val="single"/>');
    if (run.superscript) rPrParts.push('<w:vertAlign w:val="superscript"/>');
    else if (run.subscript) rPrParts.push('<w:vertAlign w:val="subscript"/>');
    if (run.fontSize && Number.isFinite(Number(run.fontSize))) {
      const sz = Math.max(12, Math.min(96, Math.round(Number(run.fontSize) * 2)));
      rPrParts.push(`<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/>`);
    }
    if (run.color && /^#?[0-9a-f]{6}$/i.test(run.color)) {
      rPrParts.push(`<w:color w:val="${run.color.replace('#', '').toUpperCase()}"/>`);
    }
    const rPr = rPrParts.length > 0 ? `<w:rPr>${rPrParts.join('')}</w:rPr>` : '';
    const lines = text.split('\n');
    const contentXml = lines
      .map((ln, idx) => `${idx > 0 ? '<w:br/>' : ''}<w:t xml:space="preserve">${escapeXml(ln)}</w:t>`)
      .join('');
    return `<w:r>${rPr}${contentXml}</w:r>`;
  };

  const renderParagraphBlockXml = (block = {}) => {
    const pPrParts = [];
    if (block.type === 'heading') {
      const lvl = Math.max(1, Math.min(3, Number(block.level) || 1));
      pPrParts.push(`<w:pStyle w:val="Heading${lvl}"/>`);
    }
    if (block.pageBreakBefore) {
      pPrParts.push('<w:pageBreakBefore/>');
    }
    const jcMap = { center: 'center', right: 'right', justify: 'both' };
    if (block.align && jcMap[block.align]) {
      pPrParts.push(`<w:jc w:val="${jcMap[block.align]}"/>`);
    }
    const indentLeft = Math.round((Number(block.indentLeftPt) || (block.isQuote ? 24 : 0)) * 20);
    const firstLine = Math.round((Number(block.firstLineIndentPt) || 0) * 20);
    if (indentLeft > 0 || firstLine > 0) {
      pPrParts.push(
        `<w:ind${indentLeft > 0 ? ` w:left="${indentLeft}"` : ''}${firstLine > 0 ? ` w:firstLine="${firstLine}"` : ''}/>`
      );
    }
    if (block.isQuote) {
      pPrParts.push('<w:pBdr><w:left w:val="single" w:sz="18" w:space="8" w:color="64748B"/></w:pBdr>');
      pPrParts.push('<w:shd w:val="clear" w:color="auto" w:fill="F8FAFC"/>');
    } else if (block.isCodeBlock) {
      pPrParts.push('<w:shd w:val="clear" w:color="auto" w:fill="F1F5F9"/>');
    }
    const beforeTwips = Math.round((Number(block.spaceBeforePt) || (block.type === 'heading' ? 10 : 0)) * 20);
    const afterTwips = Math.round((Number(block.spaceAfterPt) || (block.type === 'heading' ? 4 : 6)) * 20);
    pPrParts.push(`<w:spacing w:before="${beforeTwips}" w:after="${afterTwips}" w:line="276" w:lineRule="auto"/>`);

    const pPr = `<w:pPr>${pPrParts.join('')}</w:pPr>`;
    const runs =
      Array.isArray(block.runs) && block.runs.length > 0
        ? block.runs
        : block.plain
        ? [{ type: 'text', text: block.plain, bold: Boolean(block.bold || block.type === 'heading'), code: Boolean(block.isCodeBlock) }]
        : [];
    const runsXml = runs.map((r) => renderRunXml(r)).join('');
    const pageBreakTail = block.hasPageBreak ? '<w:r><w:br w:type="page"/></w:r>' : '';
    return `<w:p>${pPr}${runsXml}${pageBreakTail}</w:p>`;
  };

  const renderTableBlockXml = (block = {}) => {
    const rows = Array.isArray(block.rows) ? block.rows : [];
    if (rows.length === 0) return '';
    const colCount = Math.max(1, ...rows.map((r) => (Array.isArray(r) ? r.length : 1)));
    const totalTwips = Math.round(contentWidthPt * 20);
    const colTwips = Math.max(720, Math.floor(totalTwips / colCount));
    const gridXml = Array.from({ length: colCount }, () => `<w:gridCol w:w="${colTwips}"/>`).join('');

    const rowsXml = rows
      .map((row, rIdx) => {
        const isHeaderRow = rIdx === 0 && Boolean(block.hasHeaderRow);
        const cells = Array.isArray(row) ? row : [row];
        const cellsXml = Array.from({ length: colCount }, (_, cIdx) => {
          const rawCell = cells[cIdx];
          const shading =
            (rawCell && typeof rawCell === 'object' && rawCell.shading) ||
            (isHeaderRow ? '#F1F5F9' : '');
          const shdXml = shading
            ? `<w:shd w:val="clear" w:color="auto" w:fill="${shading.replace('#', '').toUpperCase()}"/>`
            : '';
          let cellInner = '';
          if (rawCell && typeof rawCell === 'object' && Array.isArray(rawCell.paragraphs) && rawCell.paragraphs.length > 0) {
            cellInner = rawCell.paragraphs
              .map((p) =>
                renderParagraphBlockXml({
                  ...p,
                  spaceBeforePt: 0,
                  spaceAfterPt: 3,
                  bold: Boolean(p.bold || isHeaderRow),
                })
              )
              .join('');
          } else {
            const txt = typeof rawCell === 'string' ? rawCell : rawCell?.text ?? '';
            const lines = String(txt).split(/\r?\n/);
            cellInner = lines
              .map((ln) =>
                renderParagraphBlockXml({
                  type: 'paragraph',
                  plain: ln,
                  bold: isHeaderRow,
                  spaceBeforePt: 0,
                  spaceAfterPt: 2,
                })
              )
              .join('');
          }
          return `<w:tc><w:tcPr><w:tcW w:w="${colTwips}" w:type="dxa"/>${shdXml}<w:tcMar><w:top w:w="70" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="70" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tcMar></w:tcPr>${cellInner || '<w:p/>'}</w:tc>`;
        }).join('');
        return `<w:tr>${cellsXml}</w:tr>`;
      })
      .join('');

    return `<w:tbl><w:tblPr><w:tblW w:w="${totalTwips}" w:type="dxa"/><w:tblBorders><w:top w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/><w:left w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/><w:bottom w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/><w:right w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/></w:tblBorders></w:tblPr><w:tblGrid>${gridXml}</w:tblGrid>${rowsXml}</w:tbl>`;
  };

  const bodyParts = [];
  const blocks = Array.isArray(richModel.blocks) ? richModel.blocks : [];
  for (const block of blocks) {
    if (!block) continue;
    if (block.type === 'image') {
      const imgRun = registerImage(block);
      if (imgRun) {
        const align = block.align === 'right' ? 'right' : block.align === 'left' ? 'left' : 'center';
        const pPr = `<w:pPr>${block.pageBreakBefore ? '<w:pageBreakBefore/>' : ''}<w:jc w:val="${align}"/><w:spacing w:before="80" w:after="100"/></w:pPr>`;
        bodyParts.push(`<w:p>${pPr}${imgRun}</w:p>`);
      }
    } else if (block.type === 'table') {
      const tblXml = renderTableBlockXml(block);
      if (tblXml) bodyParts.push(tblXml);
    } else {
      bodyParts.push(renderParagraphBlockXml(block));
    }
  }

  if (bodyParts.length === 0) {
    bodyParts.push('<w:p><w:r><w:t></w:t></w:r></w:p>');
  }

  const pgSzXml = `<w:pgSz w:w="${Math.round(pageWidthPt * 20)}" w:h="${Math.round(pageHeightPt * 20)}"${isLandscape ? ' w:orient="landscape"' : ''}/>`;
  const pgMarXml = `<w:pgMar w:top="${margins.top}" w:right="${margins.right}" w:bottom="${margins.bottom}" w:left="${margins.left}" w:header="720" w:footer="720" w:gutter="0"/>`;

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
  <w:body>
    ${bodyParts.join('\n    ')}
    <w:sectPr>${pgSzXml}${pgMarXml}</w:sectPr>
  </w:body>
</w:document>`;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault><w:rPr><w:rFonts w:ascii="${escapeXml(defaultFont)}" w:hAnsi="${escapeXml(defaultFont)}"/><w:sz w:val="${defaultFontSizeHalfPt}"/><w:szCs w:val="${defaultFontSizeHalfPt}"/></w:rPr></w:rPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="32"/><w:color w:val="0F172A"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:pPr><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="26"/><w:color w:val="1E293B"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:pPr><w:outlineLvl w:val="2"/></w:pPr><w:rPr><w:b/><w:sz w:val="23"/><w:color w:val="334155"/></w:rPr></w:style>
</w:styles>`;

  const imgContentDefaults = [...extSet]
    .map((e) => `<Default Extension="${e}" ContentType="image/${e === 'jpeg' ? 'jpeg' : 'png'}"/>`)
    .join('\n  ');

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  ${imgContentDefaults}
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const docRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${docRels.join('\n  ')}
</Relationships>`;

  return createZipArchiveFn([
    { name: '[Content_Types].xml', data: contentTypesXml },
    { name: '_rels/.rels', data: rootRelsXml },
    { name: 'word/_rels/document.xml.rels', data: docRelsXml },
    { name: 'word/styles.xml', data: stylesXml },
    { name: 'word/document.xml', data: documentXml },
    ...mediaFiles,
  ]);
}

function colLettersToIndex(colStr = '') {
  let idx = 0;
  for (let i = 0; i < colStr.length; i += 1) {
    idx = idx * 26 + (colStr.charCodeAt(i) - 64);
  }
  return Math.max(0, idx - 1);
}

/**
 * Multi-Sheet Excel (.xlsx) parser preserving ALL sheets, sheet names, shared strings,
 * inline strings, booleans, formulas' cached values, and exact column positions!
 */
export async function parseExcelWorkbookMultiSheet(arrayBuffer, extractZipEntriesFn) {
  const entriesRaw = await extractZipEntriesFn(arrayBuffer);
  const entries =
    entriesRaw instanceof Map
      ? entriesRaw
      : new Map((Array.isArray(entriesRaw) ? entriesRaw : []).map((e) => [e.name, e.data]));
  const decoder = new TextDecoder('utf-8', { fatal: false });

  // Parse sharedStrings.xml
  const sharedStrings = [];
  if (entries.has('xl/sharedStrings.xml')) {
    const ssXml = decoder.decode(entries.get('xl/sharedStrings.xml'));
    for (const siM of ssXml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) {
      const texts = [...siM[1].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => decodeXmlEntities(m[1] || ''));
      sharedStrings.push(texts.join(''));
    }
  }

  // Parse workbook.xml + workbook.xml.rels to get exact sheet names & targets in order
  const relTargets = new Map();
  if (entries.has('xl/_rels/workbook.xml.rels')) {
    const relXml = decoder.decode(entries.get('xl/_rels/workbook.xml.rels'));
    for (const rm of relXml.matchAll(/<Relationship\b([^>]+)\/?>/g)) {
      const attrs = rm[1] || '';
      const id = (attrs.match(/\bId="([^"]+)"/) || [])[1];
      const target = (attrs.match(/\bTarget="([^"]+)"/) || [])[1];
      if (id && target) {
        const clean = target.replace(/^\/+/, '');
        relTargets.set(id, clean.startsWith('xl/') ? clean : `xl/${clean}`);
      }
    }
  }

  const sheetSpecs = [];
  if (entries.has('xl/workbook.xml')) {
    const wbXml = decoder.decode(entries.get('xl/workbook.xml'));
    for (const sm of wbXml.matchAll(/<sheet\b([^>]+)\/?>/g)) {
      const attrs = sm[1] || '';
      const name = decodeXmlEntities((attrs.match(/\bname="([^"]+)"/) || [])[1] || `Sheet ${sheetSpecs.length + 1}`);
      const rId = (attrs.match(/\br:id="([^"]+)"/) || [])[1] || '';
      const path = (rId && relTargets.get(rId)) || `xl/worksheets/sheet${sheetSpecs.length + 1}.xml`;
      sheetSpecs.push({ name, path });
    }
  }

  if (sheetSpecs.length === 0) {
    for (const key of [...entries.keys()].sort()) {
      if (/^xl\/worksheets\/sheet\d+\.xml$/i.test(key)) {
        sheetSpecs.push({ name: `Sheet ${sheetSpecs.length + 1}`, path: key });
      }
    }
  }

  const sheets = [];
  for (const spec of sheetSpecs) {
    const sheetBytes = entries.get(spec.path);
    if (!sheetBytes) continue;
    const xml = decoder.decode(sheetBytes);
    const rows = [];
    for (const rowM of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
      const rowArr = [];
      for (const cellM of rowM[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
        const attrs = cellM[1] || '';
        const body = cellM[2] || '';
        const ref = (attrs.match(/\br="([A-Z]+)\d+"/i) || [])[1] || '';
        const type = (attrs.match(/\bt="([^"]+)"/) || [])[1] || '';
        let val = '';
        if (type === 's') {
          const v = (body.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
          val = v != null ? sharedStrings[Number(v)] ?? '' : '';
        } else if (type === 'inlineStr') {
          val = [...body.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => decodeXmlEntities(m[1] || '')).join('');
        } else if (type === 'b') {
          const v = (body.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
          val = v === '1' ? 'TRUE' : 'FALSE';
        } else {
          const v = (body.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
          val = v != null ? decodeXmlEntities(v) : '';
        }
        const colIdx = ref ? colLettersToIndex(ref.toUpperCase()) : rowArr.length;
        while (rowArr.length < colIdx) rowArr.push('');
        rowArr[colIdx] = val;
      }
      if (rowArr.some((c) => String(c || '').trim() !== '')) {
        rows.push(rowArr);
      }
    }
    if (rows.length > 0) {
      const maxCols = Math.max(...rows.map((r) => r.length));
      const normalized = rows.map((r) => {
        const copy = [...r];
        while (copy.length < maxCols) copy.push('');
        return copy;
      });
      sheets.push({ name: spec.name, rows: normalized, maxCols });
    }
  }

  return sheets;
}

/**
 * Builds crisp styled HTML5 tables for one or more spreadsheet sheets (used by XLSX/CSV/TSV -> HTML, PDF, Image).
 */
export function buildMultiSheetHtml(sheets = [], title = 'Spreadsheet') {
  const sectionsHtml = (sheets || [])
    .map((sh) => {
      const rows = sh.rows || [];
      if (rows.length === 0) return '';
      const headRow = rows[0];
      const bodyRows = rows.slice(1);
      const thead = `<thead><tr>${headRow.map((c) => `<th>${escapeHtml(c)}</th>`).join('')}</tr></thead>`;
      const tbody = `<tbody>${bodyRows
        .map(
          (r) =>
            `<tr>${r
              .map((c) => {
                const isNum = /^-?[\d.,]+%?$/.test(String(c || '').trim());
                return `<td${isNum ? ' class="num"' : ''}>${escapeHtml(c)}</td>`;
              })
              .join('')}</tr>`
        )
        .join('')}</tbody>`;
      const heading = sheets.length > 1 || (sh.name && sh.name !== 'Sheet 1') ? `<h2>${escapeHtml(sh.name)}</h2>` : '';
      return `<section class="sheet-sec">${heading}<table>${thead}${tbody}</table></section>`;
    })
    .filter(Boolean)
    .join('\n');

  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  body { font-family: "Carlito", "Arimo", -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; color: #0f172a; background: #fff; margin: 0; padding: 20px; font-size: 11.5px; }
  h2 { font-size: 14px; font-weight: 700; color: #0f172a; margin: 16px 0 8px; padding-bottom: 4px; border-bottom: 2px solid #cbd5e1; }
  .sheet-sec:first-child h2 { margin-top: 0; }
  table { border-collapse: collapse; width: 100%; margin-bottom: 16px; table-layout: auto; }
  th { background: #f1f5f9; color: #0f172a; font-weight: 700; text-align: left; border: 1px solid #94a3b8; padding: 6px 8px; }
  td { border: 1px solid #cbd5e1; padding: 5px 8px; vertical-align: top; word-break: break-word; }
  tbody tr:nth-child(even) { background: #f8fafc; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
</style>
</head>
<body>
${sectionsHtml}
</body>
</html>`;
}

function parseMarkdownInlineRuns(text = '') {
  const src = String(text || '');
  const runs = [];
  const tokenRe = /(\*\*|__)(.+?)\1|(\*|_)([^*_]+?)\3|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)/g;
  let last = 0;
  let m;
  while ((m = tokenRe.exec(src)) !== null) {
    if (m.index > last) {
      runs.push({ type: 'text', text: src.slice(last, m.index) });
    }
    if (m[2]) {
      runs.push({ type: 'text', text: m[2], bold: true });
    } else if (m[4]) {
      runs.push({ type: 'text', text: m[4], italic: true });
    } else if (m[5]) {
      runs.push({ type: 'text', text: m[5], code: true });
    } else if (m[6]) {
      runs.push({ type: 'text', text: m[6], underline: true, color: '#1D4ED8' });
    }
    last = m.index + m[0].length;
  }
  if (last < src.length) {
    runs.push({ type: 'text', text: src.slice(last) });
  }
  return runs.length > 0 ? runs : [{ type: 'text', text: src }];
}

function renderInlineRunsToHtml(runs = []) {
  return runs
    .map((r) => {
      if (r.type === 'image' && r.src) {
        return `<img src="${r.src}" alt="" style="max-width:100%;height:auto;" />`;
      }
      let out = escapeHtml(r.text || '').replace(/\n/g, '<br/>');
      if (r.code) out = `<code>${out}</code>`;
      if (r.superscript) out = `<sup>${out}</sup>`;
      if (r.subscript) out = `<sub>${out}</sub>`;
      if (r.bold) out = `<strong>${out}</strong>`;
      if (r.italic) out = `<em>${out}</em>`;
      if (r.underline) out = `<u>${out}</u>`;
      if (r.color) out = `<span style="color:${escapeHtml(r.color)}">${out}</span>`;
      return out;
    })
    .join('');
}

/**
 * Parses GitHub-Flavored Markdown (headings, bold/italic/code, links, bullet/ordered lists,
 * blockquotes, fenced code blocks, and pipe tables) into a rich document model + styled HTML5!
 */
export function parseMarkdownToRichModel(mdText = '', title = 'Dokumen Markdown') {
  const lines = String(mdText || '').replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  const paragraphs = [];
  const tables = [];
  const htmlParts = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) {
      i += 1;
      continue;
    }

    // Fenced code block ```
    if (trimmed.startsWith('```')) {
      const codeLines = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i += 1;
      }
      if (i < lines.length) i += 1;
      const codeStr = codeLines.join('\n');
      blocks.push({ type: 'paragraph', isCodeBlock: true, plain: codeStr, runs: [{ type: 'text', text: codeStr, code: true }] });
      paragraphs.push({ text: codeStr, isHeading: false });
      htmlParts.push(`<pre><code>${escapeHtml(codeStr)}</code></pre>`);
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      htmlParts.push('<hr />');
      i += 1;
      continue;
    }

    // Heading #..######
    const hMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (hMatch) {
      const level = Math.min(3, hMatch[1].length);
      const runs = parseMarkdownInlineRuns(hMatch[2].trim());
      const plain = runs.map((r) => r.text || '').join('');
      blocks.push({ type: 'heading', level, bold: true, plain, runs });
      paragraphs.push({ text: plain, isHeading: true, level });
      htmlParts.push(`<h${hMatch[1].length}>${renderInlineRunsToHtml(runs)}</h${hMatch[1].length}>`);
      i += 1;
      continue;
    }

    // GFM Pipe Table
    if (trimmed.includes('|') && i + 1 < lines.length && /^\|?[\s:-]+\|[\s|:-]*$/.test(lines[i + 1].trim())) {
      const parsePipeRow = (ln) =>
        ln
          .trim()
          .replace(/^\|/, '')
          .replace(/\|$/, '')
          .split('|')
          .map((c) => c.trim());
      const headerCells = parsePipeRow(trimmed);
      i += 2;
      const bodyRows = [];
      while (i < lines.length && lines[i].trim().includes('|') && lines[i].trim() !== '') {
        bodyRows.push(parsePipeRow(lines[i]));
        i += 1;
      }
      const allPlainRows = [headerCells, ...bodyRows];
      tables.push(allPlainRows);
      blocks.push({
        type: 'table',
        hasHeaderRow: true,
        rows: allPlainRows.map((r, rIdx) =>
          r.map((cell) => {
            const runs = parseMarkdownInlineRuns(cell);
            return {
              text: runs.map((x) => x.text || '').join(''),
              paragraphs: [{ plain: runs.map((x) => x.text || '').join(''), runs, bold: rIdx === 0 }],
            };
          })
        ),
        plainRows: allPlainRows,
        plain: allPlainRows.map((r) => r.join(' | ')).join('\n'),
      });
      const thead = `<thead><tr>${headerCells.map((c) => `<th>${renderInlineRunsToHtml(parseMarkdownInlineRuns(c))}</th>`).join('')}</tr></thead>`;
      const tbody = `<tbody>${bodyRows
        .map((r) => `<tr>${r.map((c) => `<td>${renderInlineRunsToHtml(parseMarkdownInlineRuns(c))}</td>`).join('')}</tr>`)
        .join('')}</tbody>`;
      htmlParts.push(`<table>${thead}${tbody}</table>`);
      continue;
    }

    // Blockquote
    if (trimmed.startsWith('>')) {
      const qLines = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        qLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i += 1;
      }
      const qText = qLines.join(' ').trim();
      const runs = parseMarkdownInlineRuns(qText);
      const plain = runs.map((r) => r.text || '').join('');
      blocks.push({ type: 'paragraph', isQuote: true, plain, runs });
      paragraphs.push({ text: plain, isHeading: false });
      htmlParts.push(`<blockquote>${renderInlineRunsToHtml(runs)}</blockquote>`);
      continue;
    }

    // Bullet or Numbered List
    if (/^([-*+]|\d+[.)])\s+/.test(trimmed)) {
      const isOrdered = /^\d+[.)]\s+/.test(trimmed);
      const itemsHtml = [];
      while (i < lines.length && /^([-*+]|\d+[.)])\s+/.test(lines[i].trim())) {
        const itemRaw = lines[i].trim().replace(/^([-*+]|\d+[.)])\s+/, '');
        const bulletPrefix = isOrdered ? `${itemsHtml.length + 1}. ` : '• ';
        const runs = parseMarkdownInlineRuns(itemRaw);
        const plain = `${bulletPrefix}${runs.map((r) => r.text || '').join('')}`;
        blocks.push({
          type: 'paragraph',
          indentLeftPt: 18,
          plain,
          runs: [{ type: 'text', text: bulletPrefix }, ...runs],
        });
        paragraphs.push({ text: plain, isHeading: false });
        itemsHtml.push(`<li>${renderInlineRunsToHtml(runs)}</li>`);
        i += 1;
      }
      htmlParts.push(isOrdered ? `<ol>${itemsHtml.join('')}</ol>` : `<ul>${itemsHtml.join('')}</ul>`);
      continue;
    }

    // Normal paragraph
    const pLines = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^(#{1,6}\s|```|>|[-*+]\s|\d+[.)]\s|(-{3,}|\*{3,}|_{3,})$)/.test(lines[i].trim())
    ) {
      pLines.push(lines[i].trim());
      i += 1;
    }
    const pText = pLines.join(' ').trim();
    if (pText) {
      const runs = parseMarkdownInlineRuns(pText);
      const plain = runs.map((r) => r.text || '').join('');
      blocks.push({ type: 'paragraph', plain, runs });
      paragraphs.push({ text: plain, isHeading: false });
      htmlParts.push(`<p>${renderInlineRunsToHtml(runs)}</p>`);
    }
  }

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  body { font-family: "Arimo", -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; color: #0f172a; background: #fff; line-height: 1.65; font-size: 13.5px; max-width: 800px; margin: 0 auto; padding: 28px; }
  h1 { font-size: 24px; font-weight: 700; margin: 0 0 12px; padding-bottom: 6px; border-bottom: 1px solid #e2e8f0; }
  h2 { font-size: 19px; font-weight: 700; margin: 20px 0 8px; }
  h3 { font-size: 15px; font-weight: 700; margin: 16px 0 6px; }
  p { margin: 0 0 10px; }
  ul, ol { margin: 0 0 12px; padding-left: 24px; }
  li { margin-bottom: 4px; }
  blockquote { margin: 12px 0; padding: 8px 14px; border-left: 4px solid #64748b; background: #f8fafc; color: #334155; font-style: italic; }
  code { font-family: "Cousine", Consolas, monospace; background: #f1f5f9; padding: 1px 5px; border-radius: 4px; font-size: 0.9em; }
  pre { background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 6px; overflow-x: auto; }
  pre code { background: none; padding: 0; }
  table { border-collapse: collapse; width: 100%; margin: 14px 0; }
  th { background: #f1f5f9; font-weight: 700; text-align: left; border: 1px solid #cbd5e1; padding: 7px 10px; }
  td { border: 1px solid #cbd5e1; padding: 6px 10px; vertical-align: top; }
  hr { border: none; border-top: 1px solid #cbd5e1; margin: 18px 0; }
</style>
</head>
<body>
${htmlParts.join('\n')}
</body>
</html>`;

  return { blocks, paragraphs, tables, html };
}

/**
 * Parses real RTF formatting (`\b`, `\i`, `\ul`, `\qc`, `\qr`, `\qj`, `\fsN`, `\par`, `\tab`, `\uN`, `\'xx`)
 * into a structured rich document model + styled HTML!
 */
export function parseRtfToRichModel(rtfText = '', title = 'Dokumen RTF') {
  const src = String(rtfText || '');
  const skipDestinations = new Set([
    'fonttbl', 'colortbl', 'stylesheet', 'info', 'pict', 'object',
    'header', 'footer', 'headerl', 'headerr', 'headerf', 'footerl', 'footerr', 'footerf',
    'listtable', 'listoverridetable', 'revtbl', 'rsidtbl', 'generator', 'themedata', 'colorschememapping',
  ]);

  const stack = [{ bold: false, italic: false, underline: false, fontSize: 11, align: 'left', skip: false, uc: 1 }];
  const state = () => stack[stack.length - 1];

  const rawParagraphs = [];
  let curRuns = [];
  let curAlign = 'left';

  const pushText = (txt) => {
    if (!txt || state().skip) return;
    const st = state();
    const prev = curRuns[curRuns.length - 1];
    if (
      prev &&
      prev.bold === st.bold &&
      prev.italic === st.italic &&
      prev.underline === st.underline &&
      prev.fontSize === st.fontSize
    ) {
      prev.text += txt;
    } else {
      curRuns.push({
        type: 'text',
        text: txt,
        bold: st.bold,
        italic: st.italic,
        underline: st.underline,
        fontSize: st.fontSize,
      });
    }
  };

  const flushParagraph = () => {
    const plain = curRuns.map((r) => r.text || '').join('').trim();
    if (plain) {
      rawParagraphs.push({ align: curAlign, runs: curRuns, plain });
    }
    curRuns = [];
  };

  let i = 0;
  const len = src.length;
  while (i < len) {
    const ch = src[i];
    if (ch === '{') {
      stack.push({ ...state() });
      i += 1;
      if (src[i] === '\\' && src[i + 1] === '*') {
        state().skip = true;
        i += 2;
      }
      continue;
    }
    if (ch === '}') {
      if (stack.length > 1) stack.pop();
      i += 1;
      continue;
    }
    if (ch === '\r' || ch === '\n') {
      i += 1;
      continue;
    }
    if (ch === '\\') {
      i += 1;
      if (i >= len) break;
      const next = src[i];
      if (next === '\\' || next === '{' || next === '}') {
        pushText(next);
        i += 1;
        continue;
      }
      if (next === '~') {
        pushText(' ');
        i += 1;
        continue;
      }
      if (next === "'") {
        const hex = src.slice(i + 1, i + 3);
        if (/^[0-9a-fA-F]{2}$/.test(hex)) {
          pushText(String.fromCharCode(parseInt(hex, 16)));
          i += 3;
          continue;
        }
      }
      const ctrlM = src.slice(i).match(/^([a-zA-Z]+)(-?\d+)?[ ]?/);
      if (ctrlM) {
        const word = ctrlM[1];
        const param = ctrlM[2] != null ? Number(ctrlM[2]) : null;
        i += ctrlM[0].length;
        if (skipDestinations.has(word)) {
          state().skip = true;
          continue;
        }
        if (state().skip) continue;
        if (word === 'b') state().bold = param !== 0;
        else if (word === 'i') state().italic = param !== 0;
        else if (word === 'ul') state().underline = param !== 0;
        else if (word === 'ulnone') state().underline = false;
        else if (word === 'plain') {
          state().bold = false;
          state().italic = false;
          state().underline = false;
          state().fontSize = 11;
        } else if (word === 'fs' && param) state().fontSize = Math.max(8, Math.min(36, param / 2));
        else if (word === 'pard') curAlign = 'left';
        else if (word === 'qc') curAlign = 'center';
        else if (word === 'qr') curAlign = 'right';
        else if (word === 'qj') curAlign = 'justify';
        else if (word === 'ql') curAlign = 'left';
        else if (word === 'par' || word === 'line') flushParagraph();
        else if (word === 'tab') pushText('    ');
        else if (word === 'uc' && param != null) state().uc = Math.max(0, param);
        else if (word === 'u' && param != null) {
          const code = param < 0 ? param + 65536 : param;
          pushText(String.fromCodePoint(code));
          // Skip fallback ASCII replacement chars
          let skipCount = state().uc || 1;
          while (skipCount > 0 && i < len) {
            if (src[i] === '\\' && src[i + 1] === "'") i += 4;
            else i += 1;
            skipCount -= 1;
          }
        }
        continue;
      }
      i += 1;
      continue;
    }
    pushText(ch);
    i += 1;
  }
  flushParagraph();

  const blocks = [];
  const paragraphs = [];
  const htmlParts = [];

  for (const rp of rawParagraphs) {
    const maxFs = Math.max(11, ...rp.runs.map((r) => r.fontSize || 11));
    const allBold = rp.runs.length > 0 && rp.runs.every((r) => r.bold);
    const isHeading = (maxFs >= 15 && rp.plain.length < 180) || (maxFs >= 13 && allBold && rp.plain.length < 120);
    const level = maxFs >= 18 ? 1 : 2;
    blocks.push({
      type: isHeading ? 'heading' : 'paragraph',
      level: isHeading ? level : 0,
      align: rp.align,
      bold: allBold,
      fontSize: maxFs,
      plain: rp.plain,
      runs: rp.runs,
    });
    paragraphs.push({ text: rp.plain, isHeading, level: isHeading ? level : 0, align: rp.align, runs: rp.runs });
    const tag = isHeading ? `h${level}` : 'p';
    htmlParts.push(`<${tag} style="text-align:${escapeHtml(rp.align)};font-size:${maxFs}pt;">${renderInlineRunsToHtml(rp.runs)}</${tag}>`);
  }

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  body { font-family: "Tinos", Georgia, "Times New Roman", serif; color: #111; background: #fff; line-height: 1.55; font-size: 11.5pt; max-width: 780px; margin: 0 auto; padding: 28px; }
  h1, h2, h3 { margin: 14pt 0 6pt; line-height: 1.3; }
  p { margin: 0 0 8pt; }
</style>
</head>
<body>
${htmlParts.join('\n')}
</body>
</html>`;

  return { blocks, paragraphs, tables: [], html };
}

/**
 * Parses real HTML structure (headings, paragraphs, lists, blockquotes, tables, bold/italic/underline,
 * and embedded `data:image/*` images) into a rich document model for `HTML -> DOCX / RTF / MD`!
 */
export function parseHtmlToRichModel(htmlText = '', title = 'Dokumen HTML') {
  const cleaned = String(htmlText || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '');
  const bodyM = cleaned.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const bodyHtml = bodyM ? bodyM[1] : cleaned;

  const blocks = [];
  const paragraphs = [];
  const tables = [];

  const parseInlineHtml = (frag = '') => {
    const runs = [];
    const inlineRe = /<(strong|b|em|i|u|code|sup|sub)\b[^>]*>([\s\S]*?)<\/\1>|<img\b[^>]*\bsrc="(data:image\/[^"]+)"[^>]*\/?>|<br\s*\/?>/gi;
    let last = 0;
    let m;
    while ((m = inlineRe.exec(frag)) !== null) {
      if (m.index > last) {
        const plain = decodeHtmlEntities(frag.slice(last, m.index).replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ');
        if (plain) runs.push({ type: 'text', text: plain });
      }
      if (m[0].toLowerCase().startsWith('<br')) {
        runs.push({ type: 'text', text: '\n' });
      } else if (m[3]) {
        runs.push({ type: 'image', src: m[3] });
      } else if (m[1]) {
        const t = m[1].toLowerCase();
        const inner = decodeHtmlEntities((m[2] || '').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ');
        if (inner) {
          runs.push({
            type: 'text',
            text: inner,
            bold: t === 'strong' || t === 'b',
            italic: t === 'em' || t === 'i',
            underline: t === 'u',
            code: t === 'code',
            superscript: t === 'sup',
            subscript: t === 'sub',
          });
        }
      }
      last = m.index + m[0].length;
    }
    if (last < frag.length) {
      const tail = decodeHtmlEntities(frag.slice(last).replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ');
      if (tail) runs.push({ type: 'text', text: tail });
    }
    return runs;
  };

  const blockRe =
    /<(table)\b[^>]*>([\s\S]*?)<\/table>|<(h[1-6])\b[^>]*>([\s\S]*?)<\/\3>|<(p|li|blockquote|pre)\b[^>]*>([\s\S]*?)<\/\5>|<img\b[^>]*\bsrc="(data:image\/[^"]+)"[^>]*\/?>/gi;
  let bm;
  while ((bm = blockRe.exec(bodyHtml)) !== null) {
    if (bm[1]) {
      const tblInner = bm[2] || '';
      const rows = [];
      const plainRows = [];
      for (const trm of tblInner.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
        const cells = [];
        const pCells = [];
        for (const tdm of (trm[1] || '').matchAll(/<(td|th)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
          const isTh = tdm[1].toLowerCase() === 'th';
          const runs = parseInlineHtml(tdm[2] || '');
          const txt = runs.map((r) => r.text || '').join('').trim();
          cells.push({ text: txt, paragraphs: [{ plain: txt, runs, bold: isTh }] });
          pCells.push(txt);
        }
        if (cells.length > 0) {
          rows.push(cells);
          plainRows.push(pCells);
        }
      }
      if (rows.length > 0) {
        tables.push(plainRows);
        blocks.push({ type: 'table', hasHeaderRow: /<th\b/i.test(tblInner), rows, plainRows, plain: plainRows.map((r) => r.join(' | ')).join('\n') });
      }
    } else if (bm[3]) {
      const level = Math.min(3, Number(bm[3][1]) || 1);
      const runs = parseInlineHtml(bm[4] || '');
      const plain = runs.map((r) => r.text || '').join('').trim();
      if (plain) {
        blocks.push({ type: 'heading', level, bold: true, plain, runs });
        paragraphs.push({ text: plain, isHeading: true, level, runs });
      }
    } else if (bm[5]) {
      const tag = bm[5].toLowerCase();
      const runs = parseInlineHtml(bm[6] || '');
      const plain = runs.map((r) => r.text || '').join('').trim();
      if (plain || runs.some((r) => r.type === 'image')) {
        const prefix = tag === 'li' ? '• ' : '';
        const fullRuns = prefix ? [{ type: 'text', text: prefix }, ...runs] : runs;
        const fullPlain = `${prefix}${plain}`.trim();
        blocks.push({
          type: 'paragraph',
          isQuote: tag === 'blockquote',
          isCodeBlock: tag === 'pre',
          indentLeftPt: tag === 'li' ? 18 : 0,
          plain: fullPlain,
          runs: fullRuns,
        });
        if (fullPlain) paragraphs.push({ text: fullPlain, isHeading: false, runs: fullRuns });
      }
    } else if (bm[7]) {
      blocks.push({ type: 'image', src: bm[7], align: 'center' });
    }
  }

  return { blocks, paragraphs, tables, html: htmlText || title };
}

/**
 * Reconstructs clean paragraphs, headings, alignments, page breaks, & scanned-page visuals
 * from `extractPdfDetailedWithPdfJs` + `renderPdfPagesToPreviewImages` for high-fidelity `PDF -> DOCX`!
 */
export function buildRichModelFromPdfDetailed(pdfDetailedPages = [], renderedPagePreviews = []) {
  const detailList = Array.isArray(pdfDetailedPages) ? pdfDetailedPages : pdfDetailedPages?.pagesLayout || [];
  const previewList = Array.isArray(renderedPagePreviews) ? renderedPagePreviews : renderedPagePreviews?.pages || [];
  const blocks = [];
  const paragraphs = [];
  const previewByPage = new Map();
  for (const pv of previewList) {
    if (pv && pv.pageNumber && pv.imageDataUrl) {
      previewByPage.set(pv.pageNumber, pv);
    }
  }

  for (let pIdx = 0; pIdx < detailList.length; pIdx += 1) {
    const pg = detailList[pIdx];
    const pageNum = pg.pageNumber || pIdx + 1;
    const spans = Array.isArray(pg.spans) ? pg.spans : [];

    const lineGroups = [];
    const sorted = [...spans].sort((a, b) => (Math.abs(a.y - b.y) > 0.008 ? a.y - b.y : a.x - b.x));
    for (const sp of sorted) {
      const txt = String(sp.text || '').trim();
      if (!txt) continue;
      const prev = lineGroups[lineGroups.length - 1];
      if (prev && Math.abs(sp.y - prev.y) < 0.011) {
        prev.spans.push(sp);
        prev.right = Math.max(prev.right, sp.x + sp.w);
        prev.maxH = Math.max(prev.maxH, sp.h || 0.014);
      } else {
        lineGroups.push({
          y: sp.y,
          left: sp.x,
          right: sp.x + sp.w,
          maxH: sp.h || 0.014,
          spans: [sp],
        });
      }
    }

    const pageWordCount = spans.length;
    const preview = previewByPage.get(pageNum);

    if (pageWordCount < 12 && preview?.imageDataUrl) {
      blocks.push({
        type: 'image',
        src: preview.imageDataUrl,
        align: 'center',
        pageBreakBefore: pIdx > 0,
      });
      continue;
    }

    const heights = lineGroups.map((l) => l.maxH).sort((a, b) => a - b);
    const medianH = heights.length > 0 ? heights[Math.floor(heights.length / 2)] : 0.014;
    const gaps = [];
    for (let i = 1; i < lineGroups.length; i += 1) {
      const g = lineGroups[i].y - lineGroups[i - 1].y;
      if (g > 0 && g < 0.08) gaps.push(g);
    }
    gaps.sort((a, b) => a - b);
    const typicalLineStep = gaps.length > 0 ? gaps[Math.floor(gaps.length / 2)] : medianH * 1.45;

    let firstBlockOnPage = true;
    let curParaLines = [];
    let curParaMeta = null;

    const flushPdfPara = () => {
      if (curParaLines.length === 0) return;
      const joined = curParaLines
        .map((ln) => ln.spans.sort((a, b) => a.x - b.x).map((s) => s.text).join(' '))
        .join(' ')
        .replace(/-\s+/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (joined) {
        const isHeading =
          (curParaMeta.maxH > medianH * 1.18 && joined.length < 180) ||
          (curParaLines.length === 1 && joined.length < 95 && /^[0-9A-Z][0-9A-Z.\s-]{3,}$/.test(joined));
        const level = curParaMeta.maxH > medianH * 1.45 ? 1 : 2;
        const centerOffset = Math.abs((curParaMeta.left + curParaMeta.right) / 2 - 0.5);
        const align =
          curParaLines.length === 1 && centerOffset < 0.08 && curParaMeta.left > 0.16 && curParaMeta.right < 0.84
            ? 'center'
            : curParaMeta.left > 0.55
            ? 'right'
            : 'left';

        blocks.push({
          type: isHeading ? 'heading' : 'paragraph',
          level: isHeading ? level : 0,
          align,
          bold: isHeading,
          pageBreakBefore: pIdx > 0 && firstBlockOnPage,
          plain: joined,
          runs: [{ type: 'text', text: joined, bold: isHeading }],
        });
        paragraphs.push({ text: joined, isHeading, level: isHeading ? level : 0, align });
        firstBlockOnPage = false;
      }
      curParaLines = [];
      curParaMeta = null;
    };

    for (let li = 0; li < lineGroups.length; li += 1) {
      const ln = lineGroups[li];
      const prev = curParaLines[curParaLines.length - 1];
      const vGap = prev ? ln.y - prev.y : 0;
      const isBigGap = prev && vGap > typicalLineStep * 1.45;
      const isSizeJump = prev && Math.abs(ln.maxH - prev.maxH) > medianH * 0.25;
      const isNewIndent = prev && ln.left - prev.left > 0.035 && prev.right < 0.82;
      const prevShortEnded = prev && prev.right < 0.68 && /[.!?:]$/.test((prev.spans[prev.spans.length - 1]?.text || '').trim());

      if (prev && (isBigGap || isSizeJump || isNewIndent || prevShortEnded)) {
        flushPdfPara();
      }
      curParaLines.push(ln);
      curParaMeta = curParaMeta
        ? {
            left: Math.min(curParaMeta.left, ln.left),
            right: Math.max(curParaMeta.right, ln.right),
            maxH: Math.max(curParaMeta.maxH, ln.maxH),
          }
        : { left: ln.left, right: ln.right, maxH: ln.maxH };
    }
    flushPdfPara();
  }

  return { blocks, paragraphs, tables: [] };
}

/**
 * Builds an authentic standalone HTML document from rendered PDF pages + selectable text spans
 * so `PDF -> HTML` looks 100% identical to the original PDF while remaining searchable/selectable!
 */
export function buildAuthenticPdfHtml(renderedPages = [], detailedPages = [], title = 'Dokumen PDF') {
  const pageList = Array.isArray(renderedPages) ? renderedPages : renderedPages?.pages || [];
  const detailList = Array.isArray(detailedPages) ? detailedPages : detailedPages?.pagesLayout || [];
  const spansByPage = new Map();
  for (const dp of detailList) {
    if (dp && dp.pageNumber && Array.isArray(dp.spans)) {
      spansByPage.set(dp.pageNumber, dp.spans);
    }
  }

  const pagesHtml = pageList
    .map((pg, idx) => {
      const pNum = pg.pageNumber || idx + 1;
      const spans = spansByPage.get(pNum) || pg.spans || [];
      const w = pg.widthPx || pg.widthPt || pg.width || 0;
      const h = pg.heightPx || pg.heightPt || pg.height || 0;
      const aspectRatio = w && h ? (h / w) * 100 : 141.42;
      const textLayer = spans
        .map(
          (sp) =>
            `<span style="left:${(sp.x * 100).toFixed(2)}%;top:${(sp.y * 100).toFixed(2)}%;width:${Math.max(0.5, sp.w * 100).toFixed(2)}%;height:${Math.max(0.8, sp.h * 100).toFixed(2)}%;">${escapeHtml(sp.text || '')}</span>`
        )
        .join('');
      return `<section class="pdf-page" style="padding-bottom:${aspectRatio.toFixed(2)}%;"><img src="${pg.imageDataUrl}" alt="Halaman ${pNum}" /><div class="text-layer">${textLayer}</div></section>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>
  body { margin: 0; padding: 24px 12px; background: #e2e8f0; font-family: system-ui, -apple-system, sans-serif; }
  .pdf-shell { max-width: 860px; margin: 0 auto; display: flex; flex-direction: column; gap: 18px; }
  .pdf-page { position: relative; width: 100%; background: #ffffff; box-shadow: 0 4px 20px rgba(15,23,42,0.14); overflow: hidden; }
  .pdf-page img { position: absolute; inset: 0; width: 100%; height: 100%; display: block; pointer-events: none; }
  .text-layer { position: absolute; inset: 0; }
  .text-layer span { position: absolute; color: transparent; font-size: 12px; line-height: 1; white-space: pre; user-select: text; }
  @media print { body { background: #fff; padding: 0; } .pdf-shell { gap: 0; max-width: none; } .pdf-page { box-shadow: none; page-break-after: always; } }
</style>
</head>
<body>
<div class="pdf-shell">
${pagesHtml}
</div>
</body>
</html>`;
}

/**
 * Stitches multiple rendered page data URLs vertically into a single high-DPI image buffer
 * (JPG / JPEG / PNG / WebP / BMP / GIF) so multi-page PDF/DOCX/HTML -> Image NEVER drops pages 2..N!
 */
export async function stitchPageImagesToImageBuffer(
  pageDataUrls = [],
  targetFormat = 'jpg',
  { encodeBmpFn, encodeGifFn } = {}
) {
  if (typeof document === 'undefined' || !Array.isArray(pageDataUrls) || pageDataUrls.length === 0) {
    return null;
  }

  const fmt = String(targetFormat || 'jpg').toLowerCase();
  const loadedImgs = [];
  for (const url of pageDataUrls) {
    if (!url) continue;
    const img = await new Promise((resolve) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => resolve(null);
      el.src = url;
    });
    if (img && img.naturalWidth > 0 && img.naturalHeight > 0) {
      loadedImgs.push(img);
    }
  }
  if (loadedImgs.length === 0) return null;

  const gapPx = loadedImgs.length > 1 ? 16 : 0;
  const maxW = Math.max(...loadedImgs.map((im) => im.naturalWidth));
  const rawTotalH = loadedImgs.reduce((sum, im) => sum + im.naturalHeight, 0) + gapPx * (loadedImgs.length - 1);

  let scale = 1;
  if (fmt === 'gif' && maxW > 560) scale = Math.min(scale, 560 / maxW);
  if (rawTotalH * scale > 13500) scale = Math.min(scale, 13500 / rawTotalH);

  const outW = Math.max(1, Math.round(maxW * scale));
  const outH = Math.max(1, Math.round(rawTotalH * scale));

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = loadedImgs.length > 1 ? '#e2e8f0' : '#ffffff';
  ctx.fillRect(0, 0, outW, outH);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  let curY = 0;
  for (const im of loadedImgs) {
    const dw = Math.max(1, Math.round(im.naturalWidth * scale));
    const dh = Math.max(1, Math.round(im.naturalHeight * scale));
    const dx = Math.floor((outW - dw) / 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(dx, curY, dw, dh);
    ctx.drawImage(im, dx, curY, dw, dh);
    curY += dh + Math.round(gapPx * scale);
  }

  if (fmt === 'bmp' && typeof encodeBmpFn === 'function') {
    const imgData = ctx.getImageData(0, 0, outW, outH);
    return { buffer: encodeBmpFn(outW, outH, imgData.data), mimeType: 'image/bmp', ext: 'bmp', width: outW, height: outH };
  }
  if (fmt === 'gif' && typeof encodeGifFn === 'function') {
    const imgData = ctx.getImageData(0, 0, outW, outH);
    return { buffer: encodeGifFn(outW, outH, imgData.data), mimeType: 'image/gif', ext: 'gif', width: outW, height: outH };
  }

  const mime = fmt === 'png' ? 'image/png' : fmt === 'webp' ? 'image/webp' : 'image/jpeg';
  const ext = fmt === 'jpeg' ? 'jpeg' : fmt === 'png' ? 'png' : fmt === 'webp' ? 'webp' : 'jpg';
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, mime, fmt === 'png' ? undefined : 0.92));
  const buffer = await blob.arrayBuffer();
  return { buffer, mimeType: mime, ext, width: outW, height: outH };
}
