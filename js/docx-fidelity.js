/**
 * Manifestudio High-Fidelity Document Layout & DOCX Engine (v100)
 * Shared by BOTH Universal File Converter (DOCX -> PDF / HTML / RTF / MD / TXT)
 * and Integrated Plagiarism Checker (DOCX Original-Document Multi-Page Viewer & Standard PDF Report).
 *
 * Design principles:
 * 1. NEVER rebuild or strip a user's original DOCX into plain text with fake Manifestudio banners/footers.
 * 2. In browser runtime: renders authentic OOXML layout via `docx-preview` + `jszip` + `html2canvas`
 *    (preserving logos, headers, footers, serif/sans fonts, bold/italic/superscript, bordered tables in exact
 *    document order, Word numbering `1. Pendahuluan`, Mendeley/Zotero `<w:sdt>` citations, and exact spacing),
 *    slices tall sections cleanly at line/row boundaries into crisp A4 pages, extracts exact normalized [0..1]
 *    word bounding boxes (`spans[]`), and assembles a true ISO PDF via `pdf-lib` with an invisible
 *    selectable/searchable text layer (`TextRenderingMode.Invisible`).
 * 3. Pure-JS OOXML fallback (Node tests & offline): parses `document.xml`, `styles.xml`, `numbering.xml`,
 *    `header*.xml`, `footer*.xml`, `media/*`, `<w:sdt>` citations, and tables in exact document order,
 *    rendering clean wrapped multi-line tables and full typography without any fake banner or truncation.
 */

const CDN_LIBS = {
  jszip: [
    'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js',
    'https://unpkg.com/jszip@3.10.1/dist/jszip.min.js',
  ],
  docxPreview: [
    'https://cdn.jsdelivr.net/npm/docx-preview@0.3.3/dist/docx-preview.min.js',
    'https://unpkg.com/docx-preview@0.3.3/dist/docx-preview.min.js',
  ],
  html2canvas: [
    'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js',
    'https://unpkg.com/html2canvas@1.4.1/dist/html2canvas.min.js',
  ],
};

const scriptLoadCache = new Map();

function loadExternalScript(urls = [], globalCheck = () => false) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve(false);
  }
  if (globalCheck()) return Promise.resolve(true);
  const key = urls.join('|');
  if (scriptLoadCache.has(key)) return scriptLoadCache.get(key);

  const promise = (async () => {
    for (const url of urls) {
      try {
        await new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = url;
          s.async = true;
          s.crossOrigin = 'anonymous';
          s.onload = () => resolve();
          s.onerror = () => reject(new Error(`Failed loading ${url}`));
          document.head.appendChild(s);
        });
        if (globalCheck()) return true;
      } catch {
        // Try next CDN mirror
      }
    }
    return globalCheck();
  })();

  scriptLoadCache.set(key, promise);
  return promise;
}

export async function ensureDocxRenderLibs() {
  if (typeof window === 'undefined') return null;
  const okZip = await loadExternalScript(CDN_LIBS.jszip, () => Boolean(window.JSZip));
  if (!okZip) return null;
  const [okDocx, okCanvas] = await Promise.all([
    loadExternalScript(CDN_LIBS.docxPreview, () => Boolean(window.docx && typeof window.docx.renderAsync === 'function')),
    loadExternalScript(CDN_LIBS.html2canvas, () => typeof window.html2canvas === 'function'),
  ]);
  if (!okDocx || !okCanvas) return null;
  return {
    JSZip: window.JSZip,
    docx: window.docx,
    html2canvas: window.html2canvas,
  };
}

/**
 * Maps smart typography characters (quotes, dashes, bullets, ellipsis, non-breaking spaces)
 * to clean ASCII/WinAnsi-safe equivalents so PDF fonts NEVER drop quotes/dashes into blank spaces!
 */
export function normalizeTypographyForPdf(str = '') {
  return String(str ?? '')
    .replace(/\u201C|\u201D|\u201E|\u00AB|\u00BB/g, '"')
    .replace(/\u2018|\u2019|\u201A|\u2032/g, "'")
    .replace(/\u2013|\u2014|\u2212/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u2022|\u25CF|\u25E6/g, '*')
    .replace(/\u00A0|\u2007|\u202F/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .normalize('NFC')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, ' ')
    .replace(/[ \t]+/g, ' ');
}

function decodeXmlEntities(str = '') {
  return String(str || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)));
}

function uint8ToBase64(u8) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < u8.length; i += chunk) {
    binary += String.fromCharCode(...u8.subarray(i, i + chunk));
  }
  if (typeof btoa === 'function') return btoa(binary);
  if (typeof Buffer !== 'undefined') return Buffer.from(u8).toString('base64');
  return '';
}

function dataUrlToUint8(dataUrl = '') {
  const parts = String(dataUrl || '').split(',');
  if (parts.length < 2) return null;
  if (typeof atob === 'function') {
    const bin = atob(parts[1]);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
    return out;
  }
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(parts[1], 'base64'));
  }
  return null;
}

function toRoman(num) {
  const pairs = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
    [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let n = Math.max(1, Math.floor(num));
  let out = '';
  for (const [val, sym] of pairs) {
    while (n >= val) {
      out += sym;
      n -= val;
    }
  }
  return out;
}

function formatNumValue(val, numFmt = 'decimal') {
  const n = Math.max(1, Number(val) || 1);
  if (numFmt === 'lowerLetter') return String.fromCharCode(96 + ((n - 1) % 26) + 1);
  if (numFmt === 'upperLetter') return String.fromCharCode(64 + ((n - 1) % 26) + 1);
  if (numFmt === 'lowerRoman') return toRoman(n).toLowerCase();
  if (numFmt === 'upperRoman') return toRoman(n);
  if (numFmt === 'bullet') return '•';
  return String(n);
}

/**
 * Parses word/numbering.xml so automatic Word numbering (`1. Pendahuluan`, `2. Metode Penelitian`, etc.)
 * is faithfully reconstructed even in pure-JS parsing!
 */
function parseNumberingXml(xmlStr = '') {
  const abstractMap = new Map();
  const numToAbstract = new Map();
  if (!xmlStr) return { abstractMap, numToAbstract };

  const absMatches = [...xmlStr.matchAll(/<w:abstractNum\b[^>]*w:abstractNumId="(\d+)"[^>]*>([\s\S]*?)<\/w:abstractNum>/g)];
  for (const m of absMatches) {
    const absId = m[1];
    const body = m[2];
    const levels = new Map();
    const lvlMatches = [...body.matchAll(/<w:lvl\b[^>]*w:ilvl="(\d+)"[^>]*>([\s\S]*?)<\/w:lvl>/g)];
    for (const lm of lvlMatches) {
      const ilvl = Number(lm[1]);
      const lBody = lm[2];
      const start = Number((lBody.match(/<w:start\b[^>]*w:val="(\d+)"/) || [])[1] || 1);
      const numFmt = (lBody.match(/<w:numFmt\b[^>]*w:val="([^"]+)"/) || [])[1] || 'decimal';
      const lvlText = decodeXmlEntities((lBody.match(/<w:lvlText\b[^>]*w:val="([^"]*)"/) || [])[1] || `%${ilvl + 1}.`);
      levels.set(ilvl, { start, numFmt, lvlText });
    }
    abstractMap.set(absId, levels);
  }

  const numMatches = [...xmlStr.matchAll(/<w:num\b[^>]*w:numId="(\d+)"[^>]*>([\s\S]*?)<\/w:num>/g)];
  for (const nm of numMatches) {
    const numId = nm[1];
    const absId = (nm[2].match(/<w:abstractNumId\b[^>]*w:val="(\d+)"/) || [])[1];
    if (absId) numToAbstract.set(numId, absId);
  }

  return { abstractMap, numToAbstract };
}

/**
 * Parses word/styles.xml to extract default font, font sizes, alignment, bold/italic,
 * and style-bound numbering (`numId`/`ilvl`) for Heading1..6, Title, Subtitle, Normal.
 */
function parseStylesXml(xmlStr = '') {
  const styles = new Map();
  let defaultFont = 'Times New Roman';
  let defaultFontSize = 11;
  if (!xmlStr) return { styles, defaultFont, defaultFontSize };

  const docDefaults = (xmlStr.match(/<w:docDefaults[\s>][\s\S]*?<\/w:docDefaults>/) || [])[0] || '';
  if (docDefaults) {
    const fMatch = docDefaults.match(/<w:rFonts\b[^>]*(?:w:ascii|w:hAnsi)="([^"]+)"/);
    if (fMatch) defaultFont = fMatch[1];
    const szMatch = docDefaults.match(/<w:sz\b[^>]*w:val="(\d+)"/);
    if (szMatch) defaultFontSize = Math.max(8, Math.min(24, Number(szMatch[1]) / 2));
  }

  const styleMatches = [...xmlStr.matchAll(/<w:style\b([^>]*)>([\s\S]*?)<\/w:style>/g)];
  for (const sm of styleMatches) {
    const attrs = sm[1] || '';
    const body = sm[2] || '';
    const styleId = (attrs.match(/w:styleId="([^"]+)"/) || [])[1];
    if (!styleId) continue;
    const name = (body.match(/<w:name\b[^>]*w:val="([^"]+)"/) || [])[1] || styleId;
    const basedOn = (body.match(/<w:basedOn\b[^>]*w:val="([^"]+)"/) || [])[1] || '';
    const jc = (body.match(/<w:jc\b[^>]*w:val="([^"]+)"/) || [])[1] || '';
    const numId = (body.match(/<w:numId\b[^>]*w:val="(\d+)"/) || [])[1] || '';
    const ilvl = (body.match(/<w:ilvl\b[^>]*w:val="(\d+)"/) || [])[1] || '0';
    const szVal = (body.match(/<w:sz\b[^>]*w:val="(\d+)"/) || [])[1];
    const rPrBlock = (body.match(/<w:rPr[\s>][\s\S]*?<\/w:rPr>/) || [])[0] || '';
    const bold = /<w:b(?:\s*\/>|\s+w:val="(?:1|true|on)")/i.test(rPrBlock);
    const italic = /<w:i(?:\s*\/>|\s+w:val="(?:1|true|on)")/i.test(rPrBlock);
    const fontFamily = (rPrBlock.match(/<w:rFonts\b[^>]*(?:w:ascii|w:hAnsi)="([^"]+)"/) || [])[1] || '';
    const outlineLvl = (body.match(/<w:outlineLvl\b[^>]*w:val="(\d+)"/) || [])[1];
    styles.set(styleId, {
      styleId,
      name,
      basedOn,
      jc,
      numId,
      ilvl: Number(ilvl) || 0,
      fontSize: szVal ? Number(szVal) / 2 : null,
      bold,
      italic,
      fontFamily,
      outlineLvl: outlineLvl != null ? Number(outlineLvl) : null,
    });
  }

  return { styles, defaultFont, defaultFontSize };
}

function parseRelsMediaMap(relsXmlStr = '', entriesMap = new Map(), baseDir = 'word/') {
  const mediaMap = new Map();
  const linkMap = new Map();
  if (!relsXmlStr) return { mediaMap, linkMap };
  const relMatches = [...relsXmlStr.matchAll(/<Relationship\b([^>]+)\/?>/g)];
  for (const rm of relMatches) {
    const attrs = rm[1] || '';
    const id = (attrs.match(/\bId="([^"]+)"/) || [])[1] || '';
    const target = (attrs.match(/\bTarget="([^"]+)"/) || [])[1] || '';
    const type = (attrs.match(/\bType="([^"]+)"/) || [])[1] || '';
    const targetMode = (attrs.match(/\bTargetMode="([^"]+)"/) || [])[1] || '';
    if (!id || !target) continue;
    if (targetMode.toLowerCase() === 'external' || type.includes('/hyperlink')) {
      linkMap.set(id, decodeXmlEntities(target));
      continue;
    }
    const cleanTarget = target.replace(/^\/+/, '').replace(/^\.\.\//, '');
    const key = cleanTarget.startsWith('word/') ? cleanTarget : `${baseDir}${cleanTarget}`;
    const bytes = entriesMap.get(key) || entriesMap.get(cleanTarget);
    if (bytes && bytes.length > 0 && bytes.length <= 3_500_000) {
      const ext = key.split('.').pop()?.toLowerCase() || 'png';
      if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'].includes(ext)) {
        const mime =
          ext === 'jpg' || ext === 'jpeg'
            ? 'image/jpeg'
            : ext === 'webp'
            ? 'image/webp'
            : ext === 'gif'
            ? 'image/gif'
            : 'image/png';
        mediaMap.set(id, {
          src: `data:${mime};base64,${uint8ToBase64(bytes)}`,
          mime,
          ext,
          bytes,
        });
      }
    }
  }
  return { mediaMap, linkMap };
}

/**
 * Extracts balanced top-level child XML blocks matching tagNames inside a parent XML string.
 * Crucial so nested tables/paragraphs/SDTs are parsed in EXACT document order!
 */
function extractTopLevelXmlElements(xml = '', tagNames = ['w:p', 'w:tbl', 'w:sdt']) {
  const results = [];
  const tagSet = new Set(tagNames);
  let i = 0;
  const len = xml.length;
  while (i < len) {
    const lt = xml.indexOf('<', i);
    if (lt === -1) break;
    if (xml.startsWith('<!--', lt)) {
      const endC = xml.indexOf('-->', lt + 4);
      i = endC === -1 ? len : endC + 3;
      continue;
    }
    if (xml[lt + 1] === '/' || xml[lt + 1] === '?' || xml[lt + 1] === '!') {
      const gt = xml.indexOf('>', lt + 2);
      i = gt === -1 ? len : gt + 1;
      continue;
    }
    const m = xml.slice(lt + 1, lt + 40).match(/^([a-zA-Z0-9_:-]+)/);
    if (!m) {
      i = lt + 1;
      continue;
    }
    const tag = m[1];
    const gt = xml.indexOf('>', lt + 1 + tag.length);
    if (gt === -1) break;
    const isSelfClosing = xml[gt - 1] === '/';

    if (!tagSet.has(tag)) {
      i = gt + 1;
      continue;
    }

    if (isSelfClosing) {
      results.push({ tag, xml: xml.slice(lt, gt + 1) });
      i = gt + 1;
      continue;
    }

    // Walk balanced nested tags of same name
    let depth = 1;
    let pos = gt + 1;
    const openRe = new RegExp(`<(\\/?)${tag.replace(':', '\\:')}(?=[\\s/>])([^>]*)>`, 'g');
    openRe.lastIndex = pos;
    let match;
    let endPos = len;
    while ((match = openRe.exec(xml)) !== null) {
      const isClose = match[1] === '/';
      const selfClose = match[2].trim().endsWith('/');
      if (isClose) {
        depth -= 1;
        if (depth === 0) {
          endPos = openRe.lastIndex;
          break;
        }
      } else if (!selfClose) {
        depth += 1;
      }
    }
    results.push({ tag, xml: xml.slice(lt, endPos) });
    i = endPos;
  }
  return results;
}

/**
 * Parses a single `<w:p>` XML fragment, recursively preserving ALL inline runs including
 * Mendeley/Zotero/Word citations inside `<w:sdt>`, `<w:fldSimple>`, `<w:hyperlink>`, `<w:ins>`,
 * while excluding deleted track changes (`<w:del>`) and raw field instructions (`<w:instrText>`).
 */
function parseParagraphXml(pXml, ctx) {
  // Remove deleted track-changes & field instruction codes so only actual visible document text remains
  const cleanedPXml = pXml
    .replace(/<w:del\b[\s\S]*?<\/w:del>/g, '')
    .replace(/<w:instrText\b[^>]*>[\s\S]*?<\/w:instrText>/g, '')
    .replace(/<w:delInstrText\b[^>]*>[\s\S]*?<\/w:delInstrText>/g, '');

  // Paragraph properties (<w:pPr>)
  const pPr = (cleanedPXml.match(/<w:pPr[\s>][\s\S]*?<\/w:pPr>/) || [])[0] || '';
  const styleId = (pPr.match(/<w:pStyle\b[^>]*w:val="([^"]+)"/) || [])[1] || '';
  const styleObj = ctx.styles.get(styleId) || null;
  const parentStyleObj = styleObj?.basedOn ? ctx.styles.get(styleObj.basedOn) : null;

  const rawJc = (pPr.match(/<w:jc\b[^>]*w:val="([^"]+)"/) || [])[1] || styleObj?.jc || parentStyleObj?.jc || '';
  const align =
    rawJc === 'center'
      ? 'center'
      : rawJc === 'right' || rawJc === 'end'
      ? 'right'
      : rawJc === 'both' || rawJc === 'distribute'
      ? 'justify'
      : 'left';

  const indTag = (pPr.match(/<w:ind\b[^>]*\/?>/) || [])[0] || '';
  const leftTwips = Number((indTag.match(/w:(?:left|start)="(-?\d+)"/) || [])[1] || 0);
  const firstLineTwips = Number((indTag.match(/w:firstLine="(-?\d+)"/) || [])[1] || 0);
  const hangingTwips = Number((indTag.match(/w:hanging="(-?\d+)"/) || [])[1] || 0);

  const spacingTag = (pPr.match(/<w:spacing\b[^>]*\/?>/) || [])[0] || '';
  const spaceBeforePt = Number((spacingTag.match(/w:before="(\d+)"/) || [])[1] || 0) / 20;
  const spaceAfterPt = Number((spacingTag.match(/w:after="(\d+)"/) || [])[1] || 0) / 20;

  const pageBreakBefore = /<w:pageBreakBefore(?:\s*\/>|\s+w:val="(?:1|true|on)")/i.test(pPr);

  // Heading level detection
  let headingLevel = 0;
  const styleName = `${styleId} ${styleObj?.name || ''}`;
  if (/title/i.test(styleName) && !/subtitle/i.test(styleName)) headingLevel = 1;
  else if (/heading\s*1|judul\s*1/i.test(styleName) || styleObj?.outlineLvl === 0) headingLevel = 1;
  else if (/heading\s*2|subtitle/i.test(styleName) || styleObj?.outlineLvl === 1) headingLevel = 2;
  else if (/heading\s*3/i.test(styleName) || styleObj?.outlineLvl === 2) headingLevel = 3;
  else if (/heading\s*[4-6]/i.test(styleName)) headingLevel = 4;

  // Numbering prefix resolution (direct <w:numPr> or style-inherited numId)
  let numId = (pPr.match(/<w:numId\b[^>]*w:val="(\d+)"/) || [])[1] || '';
  let ilvl = Number((pPr.match(/<w:ilvl\b[^>]*w:val="(\d+)"/) || [])[1] || 0);
  if (!numId && styleObj?.numId) {
    numId = styleObj.numId;
    ilvl = styleObj.ilvl || 0;
  }

  let listPrefix = '';
  if (numId && numId !== '0') {
    const absId = ctx.numbering.numToAbstract.get(numId);
    const levels = absId ? ctx.numbering.abstractMap.get(absId) : null;
    const lvlDef = levels ? levels.get(ilvl) : null;
    const counterKey = `${numId}:${ilvl}`;
    const startVal = lvlDef?.start ?? 1;
    const nextVal = ctx.numCounters.has(counterKey) ? ctx.numCounters.get(counterKey) + 1 : startVal;
    ctx.numCounters.set(counterKey, nextVal);
    // Reset deeper levels
    for (let d = ilvl + 1; d <= 8; d += 1) {
      ctx.numCounters.delete(`${numId}:${d}`);
    }
    if (lvlDef) {
      if (lvlDef.numFmt === 'bullet') {
        listPrefix = '• ';
      } else {
        let formatted = lvlDef.lvlText || `%${ilvl + 1}.`;
        formatted = formatted.replace(/%(\d+)/g, (_, idxStr) => {
          const refLvl = Number(idxStr) - 1;
          const refVal = ctx.numCounters.get(`${numId}:${refLvl}`) ?? 1;
          const refFmt = levels.get(refLvl)?.numFmt || 'decimal';
          return formatNumValue(refVal, refFmt);
        });
        listPrefix = `${formatted.trim()} `;
      }
    } else {
      listPrefix = '• ';
    }
  }

  // Extract all runs (<w:r>) anywhere inside the paragraph (including <w:sdt>, <w:hyperlink>, <w:fldSimple>, <w:ins>)
  const runs = [];
  const plainParts = [];
  let hasPageBreak = false;

  const rMatches = [...cleanedPXml.matchAll(/<w:r(?:\s[^>]*)?>([\s\S]*?)<\/w:r>/g)];
  for (const rm of rMatches) {
    const rBody = rm[1] || '';
    const rPr = (rBody.match(/<w:rPr[\s>][\s\S]*?<\/w:rPr>/) || [])[0] || '';
    const bExplicitOff = /<w:b\b[^>]*w:val="(?:0|false|none)"/i.test(rPr);
    const iExplicitOff = /<w:i\b[^>]*w:val="(?:0|false|none)"/i.test(rPr);
    const bold = bExplicitOff ? false : /<w:b(?:\s*\/>|\s+w:val="(?:1|true|on)")/i.test(rPr) || Boolean(styleObj?.bold);
    const italic = iExplicitOff ? false : /<w:i(?:\s*\/>|\s+w:val="(?:1|true|on)")/i.test(rPr) || Boolean(styleObj?.italic);
    const underline = /<w:u(?:\s*\/>|\s+w:val="(?!none)[^"]+")/i.test(rPr);
    const vertAlign = (rPr.match(/<w:vertAlign\b[^>]*w:val="([^"]+)"/) || [])[1] || '';
    const superscript = vertAlign === 'superscript';
    const subscript = vertAlign === 'subscript';
    const szVal = (rPr.match(/<w:sz\b[^>]*w:val="(\d+)"/) || [])[1];
    const fontSize = szVal ? Number(szVal) / 2 : styleObj?.fontSize || ctx.defaultFontSize;
    const colorHex = (rPr.match(/<w:color\b[^>]*w:val="([0-9A-Fa-f]{6})"/) || [])[1] || '';

    // Check for embedded drawing / image (<a:blip r:embed="rIdX"/>)
    const blipMatches = [...rBody.matchAll(/<a:blip\b[^>]*r:embed="([^"]+)"/g)];
    if (blipMatches.length > 0) {
      const extentMatch = rBody.match(/<wp:extent\b[^>]*cx="(\d+)"[^>]*cy="(\d+)"/);
      const widthPt = extentMatch ? Math.round((Number(extentMatch[1]) / 12700) * 10) / 10 : null;
      const heightPt = extentMatch ? Math.round((Number(extentMatch[2]) / 12700) * 10) / 10 : null;
      for (const bm of blipMatches) {
        const media = ctx.mediaMap.get(bm[1]);
        if (media) {
          runs.push({ type: 'image', src: media.src, mime: media.mime, widthPt, heightPt });
        }
      }
    }

    if (/<w:br\b[^>]*w:type="page"/i.test(rBody)) {
      hasPageBreak = true;
    }

    // Extract text, tabs, line breaks in sequence inside this run
    const tokenRe = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\s*\/>|<w:br(?:\s[^>]*)?\/>/g;
    let tok;
    let runText = '';
    while ((tok = tokenRe.exec(rBody)) !== null) {
      if (tok[0].startsWith('<w:tab')) runText += '    ';
      else if (tok[0].startsWith('<w:br')) {
        if (!/w:type="page"/i.test(tok[0])) runText += '\n';
      } else {
        runText += decodeXmlEntities(tok[1] || '');
      }
    }

    if (runText) {
      runs.push({
        type: 'text',
        text: runText,
        bold,
        italic,
        underline,
        superscript,
        subscript,
        fontSize,
        color: colorHex ? `#${colorHex}` : '',
      });
      plainParts.push(runText);
    }
  }

  let plain = plainParts.join('').replace(/[ \t]+/g, ' ').trim();
  if (listPrefix && plain && !plain.startsWith(listPrefix.trim())) {
    plain = `${listPrefix}${plain}`;
    runs.unshift({
      type: 'text',
      text: listPrefix,
      bold: headingLevel > 0 || Boolean(styleObj?.bold),
      italic: false,
      underline: false,
      superscript: false,
      subscript: false,
      fontSize: styleObj?.fontSize || ctx.defaultFontSize,
      color: '',
    });
  }

  const hasImage = runs.some((r) => r.type === 'image');
  return {
    type: headingLevel > 0 ? 'heading' : numId && numId !== '0' ? 'list-item' : 'paragraph',
    level: headingLevel,
    align,
    indentLeftPt: Math.max(0, leftTwips / 20),
    firstLineIndentPt: Math.max(0, firstLineTwips / 20),
    hangingIndentPt: Math.max(0, hangingTwips / 20),
    spaceBeforePt,
    spaceAfterPt,
    fontSize: styleObj?.fontSize || (runs.find((r) => r.type === 'text')?.fontSize ?? ctx.defaultFontSize),
    bold: Boolean(headingLevel > 0 || styleObj?.bold || (runs.length > 0 && runs.filter((r) => r.type === 'text').every((r) => r.bold))),
    pageBreakBefore,
    hasPageBreak,
    runs,
    plain,
    hasImage,
  };
}

/**
 * Parses a `<w:tbl>` XML element into rich rows/cells preserving full multi-paragraph content,
 * runs, borders, shading, and column widths (NEVER truncating cell text!).
 */
function parseTableXml(tblXml, ctx) {
  const gridCols = [...tblXml.matchAll(/<w:gridCol\b[^>]*w:w="(\d+)"/g)].map((m) => Number(m[1]) / 20);
  const rows = [];
  const plainRowStrings = [];
  const trEls = extractTopLevelXmlElements(tblXml, ['w:tr']);

  for (const tr of trEls) {
    const tcEls = extractTopLevelXmlElements(tr.xml, ['w:tc']);
    const cells = [];
    const plainCells = [];

    for (const tc of tcEls) {
      const shdMatch = tc.xml.match(/<w:shd\b[^>]*w:fill="([0-9A-Fa-f]{6})"/);
      const shading = shdMatch && shdMatch[1].toUpperCase() !== 'AUTO' ? `#${shdMatch[1]}` : '';
      const pEls = extractTopLevelXmlElements(tc.xml, ['w:p']);
      const cellParas = [];
      for (const pEl of pEls) {
        const parsedP = parseParagraphXml(pEl.xml, ctx);
        if (parsedP.plain || parsedP.hasImage) {
          cellParas.push(parsedP);
        }
      }
      const fullText = cellParas.map((p) => p.plain).filter(Boolean).join('\n');
      cells.push({
        text: fullText,
        paragraphs: cellParas,
        shading,
      });
      plainCells.push(fullText);
    }

    if (cells.length > 0) {
      rows.push(cells);
      plainRowStrings.push(plainCells);
    }
  }

  return {
    type: 'table',
    gridCols,
    rows,
    plainRows: plainRowStrings,
    plain: plainRowStrings.map((r) => r.filter(Boolean).join('\n')).filter(Boolean).join('\n'),
  };
}

function parseHeaderOrFooterXml(xmlStr = '', entriesMap = new Map(), relsXmlStr = '', baseCtx) {
  if (!xmlStr) return null;
  const { mediaMap } = parseRelsMediaMap(relsXmlStr, entriesMap, 'word/');
  const localCtx = {
    ...baseCtx,
    mediaMap: new Map([...baseCtx.mediaMap, ...mediaMap]),
    numCounters: new Map(),
  };
  const blocks = [];
  const topEls = extractTopLevelXmlElements(xmlStr, ['w:p', 'w:tbl']);
  for (const el of topEls) {
    if (el.tag === 'w:p') {
      const p = parseParagraphXml(el.xml, localCtx);
      if (p.plain || p.hasImage) blocks.push(p);
    } else if (el.tag === 'w:tbl') {
      const t = parseTableXml(el.xml, localCtx);
      if (t.rows.length > 0) blocks.push(t);
    }
  }
  if (blocks.length === 0) return null;
  return {
    blocks,
    images: blocks.flatMap((b) => (b.runs || []).filter((r) => r.type === 'image')),
    text: blocks.map((b) => b.plain).filter(Boolean).join(' · '),
  };
}

/**
 * Pure-JS High-Fidelity OOXML Document Model Parser.
 * Works identically in Node.js (unit tests) and Browser (fallback + text extraction).
 * Preserves exact document order (paragraphs, tables, SDTs, images, headers/footers, numbering, styles).
 */
export async function parseDocxRichModel(arrayBuffer, extractZipEntriesFn) {
  const decoder = new TextDecoder('utf-8', { fatal: false });
  const bytes = new Uint8Array(arrayBuffer);
  const emptyModel = {
    pageWidthPt: 595.28,
    pageHeightPt: 841.89,
    margins: { top: 72, right: 72, bottom: 72, left: 72, header: 36, footer: 36 },
    defaultFont: 'Times New Roman',
    defaultFontSize: 11,
    headers: [],
    footers: [],
    blocks: [],
    paragraphs: [],
    tables: [],
    plainText: '',
  };

  if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    return emptyModel;
  }

  const entriesRaw = await extractZipEntriesFn(arrayBuffer);
  const entriesMap =
    entriesRaw instanceof Map
      ? entriesRaw
      : new Map((Array.isArray(entriesRaw) ? entriesRaw : []).map((e) => [e.name, e.data]));

  const docBytes = entriesMap.get('word/document.xml');
  if (!docBytes) return emptyModel;

  const docXml = decoder.decode(docBytes);
  const stylesXml = entriesMap.has('word/styles.xml') ? decoder.decode(entriesMap.get('word/styles.xml')) : '';
  const numberingXml = entriesMap.has('word/numbering.xml') ? decoder.decode(entriesMap.get('word/numbering.xml')) : '';
  const relsXml = entriesMap.has('word/_rels/document.xml.rels') ? decoder.decode(entriesMap.get('word/_rels/document.xml.rels')) : '';

  const { styles, defaultFont, defaultFontSize } = parseStylesXml(stylesXml);
  const numbering = parseNumberingXml(numberingXml);
  const { mediaMap, linkMap } = parseRelsMediaMap(relsXml, entriesMap, 'word/');

  // Page size & margins from <w:sectPr>
  let pageWidthPt = 595.28;
  let pageHeightPt = 841.89;
  const margins = { top: 68, right: 64, bottom: 68, left: 64, header: 32, footer: 32 };
  const sectMatch = docXml.match(/<w:sectPr[\s>][\s\S]*?<\/w:sectPr>/);
  if (sectMatch) {
    const sectXml = sectMatch[0];
    const pgSz = (sectXml.match(/<w:pgSz\b[^>]*\/?>/) || [])[0] || '';
    const wTwips = Number((pgSz.match(/w:w="(\d+)"/) || [])[1] || 0);
    const hTwips = Number((pgSz.match(/w:h="(\d+)"/) || [])[1] || 0);
    if (wTwips > 2000 && hTwips > 2000) {
      pageWidthPt = Math.round((wTwips / 20) * 100) / 100;
      pageHeightPt = Math.round((hTwips / 20) * 100) / 100;
    }
    const pgMar = (sectXml.match(/<w:pgMar\b[^>]*\/?>/) || [])[0] || '';
    const mTop = Number((pgMar.match(/w:top="(\d+)"/) || [])[1] || 0);
    const mRight = Number((pgMar.match(/w:right="(\d+)"/) || [])[1] || 0);
    const mBottom = Number((pgMar.match(/w:bottom="(\d+)"/) || [])[1] || 0);
    const mLeft = Number((pgMar.match(/w:left="(\d+)"/) || [])[1] || 0);
    if (mTop > 0) margins.top = Math.min(130, Math.max(36, mTop / 20));
    if (mRight > 0) margins.right = Math.min(110, Math.max(36, mRight / 20));
    if (mBottom > 0) margins.bottom = Math.min(130, Math.max(36, mBottom / 20));
    if (mLeft > 0) margins.left = Math.min(110, Math.max(36, mLeft / 20));
  }

  const ctx = {
    styles,
    numbering,
    mediaMap,
    linkMap,
    defaultFont,
    defaultFontSize,
    numCounters: new Map(),
  };

  // Parse headers & footers
  const headers = [];
  const footers = [];
  for (const [name, data] of entriesMap.entries()) {
    if (/^word\/header\d*\.xml$/i.test(name)) {
      const baseName = name.split('/').pop();
      const relKey = `word/_rels/${baseName}.rels`;
      const relStr = entriesMap.has(relKey) ? decoder.decode(entriesMap.get(relKey)) : '';
      const parsed = parseHeaderOrFooterXml(decoder.decode(data), entriesMap, relStr, ctx);
      if (parsed) headers.push({ name, ...parsed });
    } else if (/^word\/footer\d*\.xml$/i.test(name)) {
      const baseName = name.split('/').pop();
      const relKey = `word/_rels/${baseName}.rels`;
      const relStr = entriesMap.has(relKey) ? decoder.decode(entriesMap.get(relKey)) : '';
      const parsed = parseHeaderOrFooterXml(decoder.decode(data), entriesMap, relStr, ctx);
      if (parsed) footers.push({ name, ...parsed });
    }
  }

  // Extract <w:body> content IN EXACT DOCUMENT ORDER
  const bodyMatch = docXml.match(/<w:body[^>]*>([\s\S]*?)<\/w:body>/);
  const bodyXml = bodyMatch ? bodyMatch[1] : docXml;
  const blocks = [];
  const paragraphs = [];
  const tables = [];

  const processBodyElements = (xmlChunk) => {
    const topEls = extractTopLevelXmlElements(xmlChunk, ['w:p', 'w:tbl', 'w:sdt']);
    for (const el of topEls) {
      if (el.tag === 'w:sdt') {
        const contentMatch = el.xml.match(/<w:sdtContent[\s>]([\s\S]*?)<\/w:sdtContent>/);
        if (contentMatch) processBodyElements(contentMatch[1]);
      } else if (el.tag === 'w:p') {
        const p = parseParagraphXml(el.xml, ctx);
        if (p.plain || p.hasImage || p.hasPageBreak || p.pageBreakBefore) {
          blocks.push(p);
          if (p.plain) {
            paragraphs.push({
              text: p.plain,
              isHeading: p.type === 'heading',
              level: p.level,
              align: p.align,
              runs: p.runs,
            });
          }
        }
      } else if (el.tag === 'w:tbl') {
        const tbl = parseTableXml(el.xml, ctx);
        if (tbl.rows.length > 0) {
          blocks.push(tbl);
          tables.push(tbl.plainRows);
        }
      }
    }
  };

  processBodyElements(bodyXml);

  const plainText = blocks
    .map((b) => b.plain || '')
    .filter(Boolean)
    .join('\n\n');

  return {
    pageWidthPt,
    pageHeightPt,
    margins,
    defaultFont,
    defaultFontSize,
    headers,
    footers,
    headerLines: headers.map((h) => h.text).filter(Boolean),
    footerLines: footers.map((f) => f.text).filter(Boolean),
    blocks,
    paragraphs,
    tables,
    plainText,
  };
}

/**
 * Extracts normalized [0..1] word bounding boxes from a rendered DOM element using Range.getClientRects().
 * Used both for pixel-accurate Plagiarism highlight overlays on DOCX pages AND invisible searchable PDF text!
 */
function extractDomWordRectsRelativeTo(rootEl, originLeft, originTop) {
  const words = [];
  if (typeof document === 'undefined' || !rootEl) return words;

  const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT, null);
  let node;
  const range = document.createRange();

  while ((node = walker.nextNode())) {
    const val = node.nodeValue || '';
    if (!val.trim()) continue;
    const parent = node.parentElement;
    if (!parent) continue;
    const style = window.getComputedStyle(parent);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;

    const wordRe = /\S+/g;
    let m;
    while ((m = wordRe.exec(val)) !== null) {
      try {
        range.setStart(node, m.index);
        range.setEnd(node, m.index + m[0].length);
        const rect = range.getBoundingClientRect();
        if (!rect || rect.width < 0.5 || rect.height < 0.5) continue;
        words.push({
          text: m[0],
          left: rect.left - originLeft,
          top: rect.top - originTop,
          right: rect.right - originLeft,
          bottom: rect.bottom - originTop,
          width: rect.width,
          height: rect.height,
        });
      } catch {
        // Skip detached text node
      }
    }
  }
  return words;
}

/**
 * Computes exact safe vertical slice ranges `[startY, endY]` inside a tall rendered `<section>`
 * so page breaks NEVER cut through a line of text or an embedded image!
 */
export function computeSafePageSlices({
  contentStartY = 0,
  contentEndY = 1000,
  usableHeight = 900,
  atomicBoxes = [],
}) {
  const slices = [];
  const safeUsable = Math.max(120, Number(usableHeight) || 900);
  const totalEnd = Math.max(contentStartY + 1, Number(contentEndY) || contentStartY + 1);

  // Filter valid boxes within content range
  const boxes = (atomicBoxes || [])
    .filter((b) => Number.isFinite(b.top) && Number.isFinite(b.bottom) && b.bottom > b.top + 1)
    .sort((a, b) => a.top - b.top);

  let curStart = contentStartY;
  let guard = 0;

  while (curStart < totalEnd - 4 && guard < 120) {
    guard += 1;
    const idealEnd = curStart + safeUsable;
    if (idealEnd >= totalEnd - 4) {
      slices.push({ startY: curStart, endY: totalEnd });
      break;
    }

    // Find any line/image straddling `idealEnd` and snap cut cleanly ABOVE it!
    let cutY = idealEnd;
    for (const box of boxes) {
      if (box.top < cutY - 1 && box.bottom > cutY + 1) {
        // Only snap upward if the box itself fits on a page and leaves meaningful content on current page
        if (box.top > curStart + safeUsable * 0.22) {
          cutY = Math.min(cutY, Math.floor(box.top) - 2);
        }
      }
    }

    if (cutY <= curStart + 40) {
      cutY = idealEnd;
    }

    slices.push({ startY: curStart, endY: cutY });
    curStart = cutY;
  }

  return slices.length > 0 ? slices : [{ startY: contentStartY, endY: totalEnd }];
}

/**
 * Browser True-Layout DOCX Renderer (`docx-preview` + `html2canvas`).
 * Renders the user's `.docx` with 100% original Word formatting (headers, logos, footers, fonts,
 * italics, bold, superscripts, bordered tables in exact position, Word numbering, `<w:sdt>` citations)
 * and outputs crisp A4 page JPEG images + exact normalized `[0..1]` word bounding boxes (`spans[]`).
 */
export async function renderDocxToFaithfulPages(
  arrayBuffer,
  { scale = 2.0, maxPages = 40, onProgress = () => {} } = {}
) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;

  onProgress({ percent: 22, label: 'Memuat mesin render dokumen Word asli (OOXML Fidelity)...' });
  const libs = await ensureDocxRenderLibs();
  if (!libs) return null;

  const host = document.createElement('div');
  host.setAttribute('data-docx-fidelity-sandbox', '1');
  host.style.cssText = [
    'position:fixed',
    'left:-100000px',
    'top:0',
    'width:1200px',
    'background:#ffffff',
    'color:#000000',
    'color-scheme:light',
    'z-index:-9999',
    'pointer-events:none',
    'opacity:1',
    'margin:0',
    'padding:0',
    'box-sizing:border-box',
  ].join(';');

  const styleHost = document.createElement('div');
  const bodyHost = document.createElement('div');
  host.appendChild(styleHost);
  host.appendChild(bodyHost);
  document.body.appendChild(host);

  try {
    onProgress({ percent: 34, label: 'Merender tata letak, logo, tabel & tipografi asli Word (.docx)...' });

    await libs.docx.renderAsync(arrayBuffer, bodyHost, styleHost, {
      className: 'ms-docx-render',
      inWrapper: true,
      ignoreWidth: false,
      ignoreHeight: false,
      ignoreFonts: false,
      breakPages: true,
      ignoreLastRenderedPageBreak: false,
      experimental: true,
      trimXmlWhitespace: true,
      useBase64URL: true,
      renderHeaders: true,
      renderFooters: true,
      renderFootnotes: true,
      renderEndnotes: true,
    });

    // Wait for all embedded images & fonts inside the rendered DOCX to finish loading
    const imgs = Array.from(bodyHost.querySelectorAll('img'));
    await Promise.all(
      imgs.map(
        (img) =>
          img.complete
            ? Promise.resolve()
            : new Promise((res) => {
                img.onload = res;
                img.onerror = res;
                setTimeout(res, 1500);
              })
      )
    );
    if (document.fonts && document.fonts.ready) {
      await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 800))]);
    }

    // Override docx-wrapper chrome so sections render as pure crisp white paper without gray backdrop/shadows
    const cleanStyle = document.createElement('style');
    cleanStyle.textContent = `
      [data-docx-fidelity-sandbox="1"] .ms-docx-render-wrapper {
        background: #ffffff !important;
        padding: 0 !important;
        margin: 0 !important;
        display: block !important;
      }
      [data-docx-fidelity-sandbox="1"] section.ms-docx-render {
        box-shadow: none !important;
        margin: 0 !important;
        background: #ffffff !important;
        color: #000000 !important;
        overflow: visible !important;
      }
    `;
    styleHost.appendChild(cleanStyle);

    // Let layout settle one frame
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    const sections = Array.from(bodyHost.querySelectorAll('section.ms-docx-render'));
    if (sections.length === 0) return null;

    const renderedPages = [];
    const safeScale = Math.min(2.2, Math.max(1.5, Number(scale) || 2.0));

    for (let sIdx = 0; sIdx < sections.length && renderedPages.length < maxPages; sIdx += 1) {
      const sec = sections[sIdx];
      const cs = window.getComputedStyle(sec);
      const secRect = sec.getBoundingClientRect();
      const pageW = Math.max(300, Math.round(secRect.width || parseFloat(cs.width) || 794));
      // Target single-page height from section min-height (docx-preview sets min-height to Word's pgSz.h!)
      const minH = parseFloat(cs.minHeight) || 0;
      const targetPageH = minH >= 400 && minH <= 2200 ? Math.round(minH) : Math.round(pageW * (841.89 / 595.28));
      const actualH = Math.max(targetPageH, Math.round(sec.scrollHeight || secRect.height || targetPageH));

      const padTop = Math.max(24, Math.round(parseFloat(cs.paddingTop) || 64));
      const padBottom = Math.max(24, Math.round(parseFloat(cs.paddingBottom) || 64));

      const headerEl = sec.querySelector(':scope > header');
      const footerEl = sec.querySelector(':scope > footer');
      const articleEl = sec.querySelector(':scope > article') || sec;

      const headerRect = headerEl ? headerEl.getBoundingClientRect() : null;
      const footerRect = footerEl ? footerEl.getBoundingClientRect() : null;
      const articleRect = articleEl.getBoundingClientRect();

      const headerBottomRel = headerRect && headerRect.height > 2 ? Math.max(padTop, Math.ceil(headerRect.bottom - secRect.top) + 6) : padTop;
      const footerH = footerRect && footerRect.height > 2 ? Math.max(padBottom, Math.ceil(secRect.bottom - footerRect.top) + 6) : padBottom;
      const footerTopRel = footerRect && footerRect.height > 2 ? Math.floor(footerRect.top - secRect.top) : actualH - padBottom;

      // Extract word boxes across the whole section BEFORE rasterizing
      const sectionWords = extractDomWordRectsRelativeTo(sec, secRect.left, secRect.top);
      const imgBoxes = Array.from(articleEl.querySelectorAll('img, svg, hr')).map((el) => {
        const r = el.getBoundingClientRect();
        return { top: r.top - secRect.top, bottom: r.bottom - secRect.top };
      });
      const atomicBoxes = [
        ...sectionWords.map((w) => ({ top: w.top, bottom: w.bottom })),
        ...imgBoxes,
      ];

      onProgress({
        percent: 42 + Math.round(((sIdx + 0.4) / sections.length) * 38),
        label: `Memproses halaman asli ${renderedPages.length + 1} (resolusi cetak HD)...`,
      });

      const fullCanvas = await libs.html2canvas(sec, {
        scale: safeScale,
        backgroundColor: '#ffffff',
        useCORS: true,
        allowTaint: true,
        logging: false,
        width: pageW,
        height: actualH,
        windowWidth: Math.max(1200, pageW + 80),
        windowHeight: Math.max(1200, actualH + 80),
      });

      const widthPt = Math.round((pageW * 72) / 96 * 100) / 100;
      const heightPt = Math.round((targetPageH * 72) / 96 * 100) / 100;

      // Case 1: Section already fits cleanly on a single page!
      if (actualH <= targetPageH + 18) {
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = Math.round(pageW * safeScale);
        pageCanvas.height = Math.round(targetPageH * safeScale);
        const pCtx = pageCanvas.getContext('2d');
        pCtx.fillStyle = '#ffffff';
        pCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        pCtx.drawImage(
          fullCanvas,
          0,
          0,
          fullCanvas.width,
          Math.min(fullCanvas.height, pageCanvas.height),
          0,
          0,
          pageCanvas.width,
          Math.min(fullCanvas.height, pageCanvas.height)
        );

        const spans = sectionWords
          .filter((w) => w.top >= 0 && w.top < targetPageH)
          .map((w) => ({
            text: w.text,
            x: Math.max(0, Math.min(0.99, w.left / pageW)),
            y: Math.max(0, Math.min(0.99, w.top / targetPageH)),
            w: Math.max(0.004, Math.min(1, w.width / pageW)),
            h: Math.max(0.008, Math.min(0.12, w.height / targetPageH)),
          }));

        renderedPages.push({
          pageNumber: renderedPages.length + 1,
          widthPt,
          heightPt,
          widthPx: pageCanvas.width,
          heightPx: pageCanvas.height,
          imageDataUrl: pageCanvas.toDataURL('image/jpeg', 0.92),
          spans,
          text: spans.map((s) => s.text).join(' '),
        });
        continue;
      }

      // Case 2: Tall section -> Smart Line-Aware Page Slicer (NEVER cuts through a line of text!)
      const contentStartY = Math.max(headerBottomRel, Math.floor(articleRect.top - secRect.top));
      const contentEndY = Math.min(footerTopRel, Math.ceil(articleRect.bottom - secRect.top));
      const headerHasLargeLogo = Boolean(headerEl && headerEl.querySelector('img') && headerBottomRel > 75);
      const subsequentTopMargin = headerHasLargeLogo ? Math.min(padTop, 58) : headerBottomRel;

      // Compute first slice with full header, remaining slices with clean top margin
      const slices = [];
      let curY = contentStartY;
      let sliceIdx = 0;
      while (curY < contentEndY - 6 && renderedPages.length + slices.length < maxPages && sliceIdx < 80) {
        const topMarginForSlice = sliceIdx === 0 ? headerBottomRel : subsequentTopMargin;
        const usableH = Math.max(180, targetPageH - topMarginForSlice - footerH);
        const [firstSlice] = computeSafePageSlices({
          contentStartY: curY,
          contentEndY,
          usableHeight: usableH,
          atomicBoxes,
        });
        if (!firstSlice) break;
        slices.push({
          startY: firstSlice.startY,
          endY: firstSlice.endY,
          topMargin: topMarginForSlice,
          includeHeader: sliceIdx === 0 || !headerHasLargeLogo,
        });
        curY = firstSlice.endY;
        sliceIdx += 1;
      }

      for (const sl of slices) {
        if (renderedPages.length >= maxPages) break;
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = Math.round(pageW * safeScale);
        pageCanvas.height = Math.round(targetPageH * safeScale);
        const pCtx = pageCanvas.getContext('2d');
        pCtx.fillStyle = '#ffffff';
        pCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);

        // 1. Copy original header band if applicable
        if (sl.includeHeader && headerBottomRel > 0) {
          const hSrcPx = Math.min(fullCanvas.height, Math.round(headerBottomRel * safeScale));
          if (hSrcPx > 0) {
            pCtx.drawImage(fullCanvas, 0, 0, fullCanvas.width, hSrcPx, 0, 0, pageCanvas.width, hSrcPx);
          }
        }

        // 2. Copy exact line-aligned content band
        const srcY = Math.max(0, Math.round(sl.startY * safeScale));
        const srcH = Math.max(1, Math.min(fullCanvas.height - srcY, Math.round((sl.endY - sl.startY) * safeScale)));
        const dstY = Math.round(sl.topMargin * safeScale);
        const maxDstH = Math.max(1, Math.round((targetPageH - footerH) * safeScale) - dstY);
        const drawH = Math.min(srcH, maxDstH);
        if (drawH > 0) {
          pCtx.drawImage(fullCanvas, 0, srcY, fullCanvas.width, drawH, 0, dstY, pageCanvas.width, drawH);
        }

        // 3. Copy original footer band if present
        if (footerRect && footerRect.height > 2) {
          const fSrcY = Math.max(0, Math.round(footerTopRel * safeScale));
          const fSrcH = Math.min(fullCanvas.height - fSrcY, Math.round(footerH * safeScale));
          const fDstY = Math.max(0, pageCanvas.height - fSrcH);
          if (fSrcH > 0) {
            pCtx.drawImage(fullCanvas, 0, fSrcY, fullCanvas.width, fSrcH, 0, fDstY, pageCanvas.width, fSrcH);
          }
        }

        // Map word bounding boxes into this exact page's normalized [0..1] coordinate system
        const spans = [];
        for (const w of sectionWords) {
          const midY = (w.top + w.bottom) / 2;
          let mappedTop = null;
          if (sl.includeHeader && midY < headerBottomRel) {
            mappedTop = w.top;
          } else if (midY >= sl.startY && midY < sl.endY) {
            mappedTop = sl.topMargin + (w.top - sl.startY);
          } else if (footerRect && footerRect.height > 2 && midY >= footerTopRel) {
            mappedTop = targetPageH - footerH + (w.top - footerTopRel);
          }
          if (mappedTop !== null && mappedTop >= 0 && mappedTop < targetPageH) {
            spans.push({
              text: w.text,
              x: Math.max(0, Math.min(0.99, w.left / pageW)),
              y: Math.max(0, Math.min(0.99, mappedTop / targetPageH)),
              w: Math.max(0.004, Math.min(1, w.width / pageW)),
              h: Math.max(0.008, Math.min(0.12, w.height / targetPageH)),
            });
          }
        }

        renderedPages.push({
          pageNumber: renderedPages.length + 1,
          widthPt,
          heightPt,
          widthPx: pageCanvas.width,
          heightPx: pageCanvas.height,
          imageDataUrl: pageCanvas.toDataURL('image/jpeg', 0.92),
          spans,
          text: spans.map((s) => s.text).join(' '),
        });
      }
    }

    if (renderedPages.length === 0) return null;

    // Also capture self-contained rendered HTML for DOCX -> HTML fidelity!
    const stylesHtml = styleHost.innerHTML || '';
    const contentHtml = bodyHost.innerHTML || '';

    return {
      pages: renderedPages,
      pageCount: renderedPages.length,
      stylesHtml,
      contentHtml,
    };
  } catch {
    return null;
  } finally {
    try {
      host.remove();
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Builds a true ISO PDF from rendered faithful pages using `pdf-lib`.
 * - ZERO fake Manifestudio header banner or footer!
 * - Embeds crisp high-DPI original document pages edge-to-edge.
 * - Adds an invisible selectable/searchable text layer (`TextRenderingMode.Invisible`)
 *   at exact word positions so the PDF is BOTH visually 100% identical AND searchable/copyable!
 */
export async function buildFaithfulPdfFromRenderedPages(pages = [], pdfLib) {
  if (!pdfLib || !pdfLib.PDFDocument || !Array.isArray(pages) || pages.length === 0) {
    return null;
  }

  const { PDFDocument, StandardFonts, pushGraphicsState, popGraphicsState, setTextRenderingMode, TextRenderingMode } = pdfLib;
  const pdfDoc = await PDFDocument.create();
  const hiddenFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  for (const pg of pages) {
    const wPt = Number(pg.widthPt) || 595.28;
    const hPt = Number(pg.heightPt) || 841.89;
    const page = pdfDoc.addPage([wPt, hPt]);

    const imgBytes = dataUrlToUint8(pg.imageDataUrl);
    if (imgBytes) {
      const isPng = String(pg.imageDataUrl || '').startsWith('data:image/png');
      const img = isPng ? await pdfDoc.embedPng(imgBytes) : await pdfDoc.embedJpg(imgBytes);
      page.drawImage(img, { x: 0, y: 0, width: wPt, height: hPt });
    }

    // Overlay invisible selectable/searchable text layer (PDF spec Tr=3) at exact DOM word rects
    if (Array.isArray(pg.spans) && pg.spans.length > 0 && typeof setTextRenderingMode === 'function' && TextRenderingMode) {
      try {
        page.pushOperators(pushGraphicsState(), setTextRenderingMode(TextRenderingMode.Invisible));
        for (const sp of pg.spans) {
          const clean = normalizeTypographyForPdf(sp.text || '').trim();
          if (!clean) continue;
          const x = sp.x * wPt;
          const boxH = Math.max(5, sp.h * hPt);
          const fontSize = Math.max(5, Math.min(28, boxH * 0.78));
          const y = hPt - (sp.y + sp.h) * hPt + boxH * 0.18;
          if (y < 2 || y > hPt - 2) continue;
          try {
            page.drawText(clean, { x, y, size: fontSize, font: hiddenFont });
          } catch {
            // Skip any non-WinAnsi glyph cleanly
          }
        }
        page.pushOperators(popGraphicsState());
      } catch {
        // Visual page image is already embedded cleanly
      }
    }
  }

  const outBytes = await pdfDoc.save();
  return outBytes;
}

/**
 * Pure-JS Faithful PDF builder from `parseDocxRichModel` (used when offline or in Node.js tests).
 * - ZERO fake Manifestudio banner or footer!
 * - Uses classic serif typography (Times-Roman / Bold / Italic) or Helvetica matching document font.
 * - Renders embedded images, headers/footers, alignment, indentation, numbered headings,
 *   and FULL wrapped multi-line tables in exact original document order!
 */
export function buildFaithfulPureJsPdfFromRichModel(model) {
  const W = Math.round(model?.pageWidthPt || 595);
  const H = Math.round(model?.pageHeightPt || 842);
  const mTop = Math.round(model?.margins?.top || 68);
  const mBottom = Math.round(model?.margins?.bottom || 64);
  const mLeft = Math.round(model?.margins?.left || 64);
  const mRight = Math.round(model?.margins?.right || 64);
  const contentW = Math.max(200, W - mLeft - mRight);

  const isSans = /arial|calibri|helvetica|segoe|inter|roboto|sans/i.test(model?.defaultFont || '');
  const baseRegular = isSans ? 'Helvetica' : 'Times-Roman';
  const baseBold = isSans ? 'Helvetica-Bold' : 'Times-Bold';
  const baseItalic = isSans ? 'Helvetica-Oblique' : 'Times-Italic';

  const esc = (s) =>
    normalizeTypographyForPdf(s)
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)');

  const wrapByWidth = (text, maxWidthPt, fontSize) => {
    const clean = normalizeTypographyForPdf(text).trim();
    if (!clean) return [];
    const avgCharW = fontSize * 0.47;
    const maxChars = Math.max(10, Math.floor(maxWidthPt / avgCharW));
    const words = clean.split(/\s+/).filter(Boolean);
    const lines = [];
    let cur = '';
    for (const w of words) {
      if (!cur) {
        if (w.length > maxChars) {
          for (let i = 0; i < w.length; i += maxChars) lines.push(w.slice(i, i + maxChars));
        } else {
          cur = w;
        }
      } else if (cur.length + 1 + w.length <= maxChars) {
        cur += ` ${w}`;
      } else {
        lines.push(cur);
        if (w.length > maxChars) {
          for (let i = 0; i < w.length; i += maxChars) {
            const chunk = w.slice(i, i + maxChars);
            if (i + maxChars >= w.length) cur = chunk;
            else lines.push(chunk);
          }
        } else {
          cur = w;
        }
      }
    }
    if (cur) lines.push(cur);
    return lines;
  };

  const pageStreams = [];
  let curOps = [];
  let y = H - mTop;

  const startNewPage = () => {
    if (curOps.length > 0) pageStreams.push(curOps.join('\n'));
    curOps = [];
    y = H - mTop;
  };

  const ensureSpace = (neededPt) => {
    if (y - neededPt < mBottom) {
      startNewPage();
    }
  };

  for (const block of model?.blocks || []) {
    if (block.pageBreakBefore && curOps.length > 0) {
      startNewPage();
    }

    if (block.type === 'table' && Array.isArray(block.rows)) {
      const colCount = Math.max(1, ...block.rows.map((r) => r.length));
      const colW = contentW / colCount;
      const cellPadX = 6;
      const cellPadY = 5;
      const tblFontSize = Math.max(9, Math.min(10.5, (model?.defaultFontSize || 11) - 0.5));
      const tblLineH = tblFontSize * 1.38;

      y -= 4;
      for (let ri = 0; ri < block.rows.length; ri += 1) {
        const row = block.rows[ri];
        // Pre-wrap every cell across multiple lines (NEVER truncate!)
        const wrappedCells = [];
        let maxLines = 1;
        for (let ci = 0; ci < colCount; ci += 1) {
          const cellObj = row[ci];
          const cellText = typeof cellObj === 'string' ? cellObj : cellObj?.text || '';
          const paras = String(cellText).split(/\r?\n/).filter((l) => l.trim().length > 0);
          const allLines = [];
          for (const p of paras) {
            const wLines = wrapByWidth(p, colW - cellPadX * 2, tblFontSize);
            allLines.push(...wLines);
          }
          wrappedCells.push({
            lines: allLines,
            isBold: Boolean(cellObj?.paragraphs?.[0]?.bold || (ri === 0 && allLines.length <= 2 && cellText.length < 40)),
            shading: cellObj?.shading || '',
          });
          maxLines = Math.max(maxLines, allLines.length || 1);
        }

        // Paginate very tall rows (such as a 2-page ABSTRAK cell!) line-by-line cleanly across pages
        let lineOffset = 0;
        while (lineOffset < maxLines) {
          const availH = Math.max(tblLineH + cellPadY * 2, y - mBottom);
          const fitLines = Math.max(1, Math.floor((availH - cellPadY * 2) / tblLineH));
          const takeLines = Math.min(maxLines - lineOffset, fitLines);
          const chunkH = takeLines * tblLineH + cellPadY * 2;

          if (y - chunkH < mBottom && lineOffset === 0 && curOps.length > 0) {
            startNewPage();
            continue;
          }

          const rowBottom = y - chunkH;
          // Draw crisp horizontal rules (academic journal table style)
          curOps.push('0.25 0.25 0.25 RG 0.6 w');
          if (lineOffset === 0) {
            curOps.push(`${mLeft} ${y.toFixed(1)} m ${(mLeft + contentW).toFixed(1)} ${y.toFixed(1)} l S`);
          }
          if (lineOffset + takeLines >= maxLines) {
            curOps.push(`${mLeft} ${rowBottom.toFixed(1)} m ${(mLeft + contentW).toFixed(1)} ${rowBottom.toFixed(1)} l S`);
          }

          curOps.push('0.06 0.08 0.12 rg');
          for (let ci = 0; ci < colCount; ci += 1) {
            const cellData = wrappedCells[ci];
            const cellX = mLeft + ci * colW + cellPadX;
            const fontKey = cellData.isBold ? '/F2' : '/F1';
            for (let li = 0; li < takeLines; li += 1) {
              const lineStr = cellData.lines[lineOffset + li];
              if (!lineStr) continue;
              const ly = y - cellPadY - (li + 1) * tblLineH + 3;
              curOps.push(`BT ${fontKey} ${tblFontSize.toFixed(1)} Tf ${cellX.toFixed(1)} ${ly.toFixed(1)} Td (${esc(lineStr)}) Tj ET`);
            }
          }

          y = rowBottom;
          lineOffset += takeLines;
          if (lineOffset < maxLines) {
            startNewPage();
          }
        }
      }
      y -= 8;
      continue;
    }

    const isHeading = block.type === 'heading';
    const fontSize = isHeading
      ? block.level === 1
        ? 13.5
        : block.level === 2
        ? 11.5
        : 10.5
      : Math.max(9.5, Math.min(13, block.fontSize || model?.defaultFontSize || 11));
    const lineH = fontSize * 1.42;
    const indentL = Math.min(72, block.indentLeftPt || 0);
    const firstIndent = Math.min(36, block.firstLineIndentPt || 0);
    const fontKey = isHeading || block.bold ? '/F2' : block.runs?.length && block.runs.every((r) => r.italic) ? '/F3' : '/F1';

    if (block.spaceBeforePt > 0) y -= Math.min(16, block.spaceBeforePt);

    const lines = wrapByWidth(block.plain || '', contentW - indentL, fontSize);
    for (let li = 0; li < lines.length; li += 1) {
      ensureSpace(lineH);
      const line = lines[li];
      const approxW = line.length * fontSize * 0.45;
      let drawX = mLeft + indentL + (li === 0 ? firstIndent : 0);
      if (block.align === 'center') {
        drawX = mLeft + Math.max(0, (contentW - approxW) / 2);
      } else if (block.align === 'right') {
        drawX = mLeft + Math.max(0, contentW - approxW);
      }
      curOps.push('0.05 0.07 0.10 rg');
      curOps.push(`BT ${fontKey} ${fontSize.toFixed(1)} Tf ${drawX.toFixed(1)} ${y.toFixed(1)} Td (${esc(line)}) Tj ET`);
      y -= lineH;
    }
    y -= isHeading ? 6 : Math.max(4, Math.min(10, block.spaceAfterPt || 5));

    if (block.hasPageBreak) {
      startNewPage();
    }
  }

  if (curOps.length > 0 || pageStreams.length === 0) {
    pageStreams.push(curOps.join('\n') || 'BT /F1 11 Tf 64 760 Td ( ) Tj ET');
  }

  // Assemble pure ISO %PDF-1.4 (ZERO Manifestudio watermark footer!)
  const objects = [];
  const addObj = (body) => {
    objects.push(body);
    return objects.length;
  };
  const catalogId = addObj('');
  const pagesId = addObj('');
  const f1 = addObj(`<< /Type /Font /Subtype /Type1 /BaseFont /${baseRegular} /Encoding /WinAnsiEncoding >>`);
  const f2 = addObj(`<< /Type /Font /Subtype /Type1 /BaseFont /${baseBold} /Encoding /WinAnsiEncoding >>`);
  const f3 = addObj(`<< /Type /Font /Subtype /Type1 /BaseFont /${baseItalic} /Encoding /WinAnsiEncoding >>`);

  const pageIds = [];
  for (let i = 0; i < pageStreams.length; i += 1) {
    const stream = pageStreams[i];
    const cid = addObj(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    const pid = addObj(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R /F3 ${f3} 0 R >> >> /Contents ${cid} 0 R >>`
    );
    pageIds.push(pid);
  }

  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;

  let pdfText = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const offsets = [0];
  for (let i = 0; i < objects.length; i += 1) {
    offsets.push(pdfText.length);
    pdfText += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xrefStart = pdfText.length;
  pdfText += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i += 1) {
    pdfText += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdfText += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

  const out = new Uint8Array(pdfText.length);
  for (let i = 0; i < pdfText.length; i += 1) out[i] = pdfText.charCodeAt(i) & 0xff;
  return out.buffer;
}

/**
 * Generates a faithful standalone HTML5 document directly from a rich OOXML model
 * (preserving headers, images, bold/italic/underline/superscript, alignment, numbering, & tables in order).
 */
export function buildFaithfulHtmlFromRichModel(model, title = 'Dokumen') {
  const escHtml = (s) =>
    String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const renderRuns = (runs = []) => {
    const merged = [];
    for (const r of runs) {
      const prev = merged[merged.length - 1];
      if (
        prev &&
        prev.type === 'text' &&
        r.type === 'text' &&
        Boolean(prev.bold) === Boolean(r.bold) &&
        Boolean(prev.italic) === Boolean(r.italic) &&
        Boolean(prev.underline) === Boolean(r.underline) &&
        Boolean(prev.superscript) === Boolean(r.superscript) &&
        Boolean(prev.subscript) === Boolean(r.subscript) &&
        (prev.color || '') === (r.color || '')
      ) {
        prev.text = `${prev.text || ''}${r.text || ''}`;
      } else {
        merged.push({ ...r });
      }
    }
    return merged
      .map((r) => {
        if (r.type === 'image' && r.src) {
          const wStyle = r.widthPt ? `width:${Math.round(r.widthPt)}pt;max-width:100%;height:auto;` : 'max-width:100%;height:auto;';
          return `<img src="${r.src}" alt="" style="${wStyle}" />`;
        }
        let inner = escHtml(r.text || '').replace(/\n/g, '<br/>');
        if (r.superscript) inner = `<sup>${inner}</sup>`;
        if (r.subscript) inner = `<sub>${inner}</sub>`;
        if (r.bold) inner = `<strong>${inner}</strong>`;
        if (r.italic) inner = `<em>${inner}</em>`;
        if (r.underline) inner = `<u>${inner}</u>`;
        if (r.color) inner = `<span style="color:${escHtml(r.color)}">${inner}</span>`;
        return inner;
      })
      .join('');
  };

  const bodyParts = [];
  for (const hdr of model?.headers || []) {
    for (const b of hdr.blocks || []) {
      if (b.runs?.length) {
        bodyParts.push(`<div class="doc-hdr" style="text-align:${escHtml(b.align || 'left')}">${renderRuns(b.runs)}</div>`);
      }
    }
  }

  for (const block of model?.blocks || []) {
    if (block.type === 'table' && Array.isArray(block.rows)) {
      const rowsHtml = block.rows
        .map(
          (row) =>
            `<tr>${row
              .map((cell) => {
                const bg = cell.shading ? `background:${escHtml(cell.shading)};` : '';
                const inner = (cell.paragraphs || [])
                  .map((p) => `<p style="text-align:${escHtml(p.align || 'left')};margin:0 0 6px;">${renderRuns(p.runs || [{ type: 'text', text: p.plain }])}</p>`)
                  .join('') || escHtml(cell.text || '');
                return `<td style="${bg}">${inner}</td>`;
              })
              .join('')}</tr>`
        )
        .join('');
      bodyParts.push(`<table>${rowsHtml}</table>`);
    } else {
      const align = escHtml(block.align || 'left');
      const indent = block.indentLeftPt ? `margin-left:${Math.round(block.indentLeftPt)}pt;` : '';
      const firstLine = block.firstLineIndentPt ? `text-indent:${Math.round(block.firstLineIndentPt)}pt;` : '';
      const inner = block.runs?.length ? renderRuns(block.runs) : escHtml(block.plain || '');
      if (block.type === 'heading') {
        const tag = block.level === 1 ? 'h1' : block.level === 2 ? 'h2' : 'h3';
        bodyParts.push(`<${tag} style="text-align:${align};${indent}">${inner}</${tag}>`);
      } else {
        bodyParts.push(`<p style="text-align:${align};${indent}${firstLine}">${inner}</p>`);
      }
    }
  }

  for (const ftr of model?.footers || []) {
    for (const b of ftr.blocks || []) {
      if (b.runs?.length) {
        bodyParts.push(`<div class="doc-ftr" style="text-align:${escHtml(b.align || 'left')}">${renderRuns(b.runs)}</div>`);
      }
    }
  }

  const fontStack = /arial|calibri|helvetica|sans/i.test(model?.defaultFont || '')
    ? `"${escHtml(model.defaultFont)}", Arial, sans-serif`
    : `"${escHtml(model?.defaultFont || 'Times New Roman')}", Georgia, "Times New Roman", serif`;

  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8" />
<title>${escHtml(title)}</title>
<style>
  body { font-family: ${fontStack}; font-size: ${Math.round(model?.defaultFontSize || 11)}pt; line-height: 1.5; color: #111; background: #fff; max-width: 210mm; margin: 18mm auto; padding: 0 18mm; }
  h1, h2, h3 { margin: 14pt 0 6pt; line-height: 1.3; }
  p { margin: 0 0 8pt; }
  table { border-collapse: collapse; width: 100%; margin: 10pt 0; }
  td, th { border-top: 1px solid #333; border-bottom: 1px solid #333; padding: 6pt 4pt; vertical-align: top; }
  .doc-hdr { margin-bottom: 14pt; }
  .doc-ftr { margin-top: 18pt; padding-top: 8pt; border-top: 1px solid #ccc; }
  @media print { body { margin: 0; padding: 15mm; } }
</style>
</head>
<body>
${bodyParts.join('\n')}
</body>
</html>`;
}
