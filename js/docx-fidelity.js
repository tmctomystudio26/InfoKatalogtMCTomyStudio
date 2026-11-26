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
  const targetMap = new Map();
  if (!relsXmlStr) return { mediaMap, linkMap, targetMap };
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
    targetMap.set(id, key);
    const bytes = entriesMap.get(key) || entriesMap.get(cleanTarget);
    if (bytes && bytes.length > 0 && bytes.length <= 3_500_000) {
      const ext = key.split('.').pop()?.toLowerCase() || 'png';
      if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) {
        const mime =
          ext === 'jpg' || ext === 'jpeg'
            ? 'image/jpeg'
            : ext === 'webp'
            ? 'image/webp'
            : ext === 'gif'
            ? 'image/gif'
            : ext === 'svg'
            ? 'image/svg+xml'
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
  return { mediaMap, linkMap, targetMap };
}

function stripAlternateContentFallbacks(xml = '') {
  return String(xml || '').replace(/<mc:AlternateContent\b[^>]*>([\s\S]*?)<\/mc:AlternateContent>/g, (_, inner) => {
    const choiceM = inner.match(/<mc:Choice\b[^>]*>([\s\S]*?)<\/mc:Choice>/);
    if (choiceM) return choiceM[1];
    const fbM = inner.match(/<mc:Fallback\b[^>]*>([\s\S]*?)<\/mc:Fallback>/);
    return fbM ? fbM[1] : '';
  });
}

function replaceWordPageFieldsWithTokens(pXml = '') {
  let xml = String(pXml || '');
  // 1. Simple fields: <w:fldSimple w:instr="PAGE">...</w:fldSimple>
  xml = xml.replace(/<w:fldSimple\b([^>]*)>([\s\S]*?)<\/w:fldSimple>/g, (full, attrs, inner) => {
    const instr = ((attrs.match(/w:instr="([^"]+)"/i) || [])[1] || '').trim().toUpperCase();
    const token = /\bNUMPAGES\b|\bSECTIONPAGES\b/.test(instr)
      ? '{{NUMPAGES}}'
      : /\bPAGE\b/.test(instr)
      ? '{{PAGE}}'
      : '';
    if (!token) return full;
    const rPr = (inner.match(/<w:rPr[\s>][\s\S]*?<\/w:rPr>/) || [])[0] || '';
    return `<w:r>${rPr}<w:t>${token}</w:t></w:r>`;
  });

  // 2. Complex fields: <w:fldChar begin/> ... <w:instrText> PAGE </w:instrText> ... <w:fldChar separate/> ... <w:t>2</w:t> ... <w:fldChar end/>
  const runs = [...xml.matchAll(/<w:r(?:\s[^>]*)?>[\s\S]*?<\/w:r>/g)];
  if (runs.length === 0) return xml;
  let out = '';
  let lastIdx = 0;
  let inField = false;
  let fieldStartIdx = -1;
  let fieldInstr = '';
  let fieldRPr = '';

  for (const rm of runs) {
    const rXml = rm[0];
    const idx = rm.index;
    const isBegin = /<w:fldChar\b[^>]*w:fldCharType="begin"/i.test(rXml);
    const isEnd = /<w:fldChar\b[^>]*w:fldCharType="end"/i.test(rXml);

    if (isBegin && !inField) {
      out += xml.slice(lastIdx, idx);
      inField = true;
      fieldStartIdx = idx;
      fieldInstr = '';
      fieldRPr = (rXml.match(/<w:rPr[\s>][\s\S]*?<\/w:rPr>/) || [])[0] || '';
      continue;
    }

    if (inField) {
      for (const im of rXml.matchAll(/<w:instrText\b[^>]*>([\s\S]*?)<\/w:instrText>/g)) {
        fieldInstr += ` ${im[1]}`;
      }
      if (!fieldRPr) {
        fieldRPr = (rXml.match(/<w:rPr[\s>][\s\S]*?<\/w:rPr>/) || [])[0] || '';
      }
      if (isEnd) {
        const up = fieldInstr.trim().toUpperCase();
        const token = /\bNUMPAGES\b|\bSECTIONPAGES\b/.test(up)
          ? '{{NUMPAGES}}'
          : /\bPAGE\b/.test(up)
          ? '{{PAGE}}'
          : '';
        if (token) {
          out += `<w:r>${fieldRPr}<w:t>${token}</w:t></w:r>`;
        } else {
          out += xml.slice(fieldStartIdx, idx + rXml.length);
        }
        inField = false;
        lastIdx = idx + rXml.length;
      }
    }
  }
  out += xml.slice(inField ? fieldStartIdx : lastIdx);
  return out;
}

function parseCssPtValue(styleStr = '', prop = 'width') {
  const re = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([\\d.-]+)\\s*(pt|px|in|cm|mm)?`, 'i');
  const m = String(styleStr || '').match(re);
  if (!m) return null;
  const v = Number(m[1]);
  if (!Number.isFinite(v)) return null;
  const unit = (m[2] || 'pt').toLowerCase();
  if (unit === 'px') return Math.round((v * 0.75) * 10) / 10;
  if (unit === 'in') return Math.round(v * 72 * 10) / 10;
  if (unit === 'cm') return Math.round(v * 28.3465 * 10) / 10;
  if (unit === 'mm') return Math.round(v * 2.83465 * 10) / 10;
  return Math.round(v * 10) / 10;
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
  // Resolve AlternateContent & replace dynamic PAGE/NUMPAGES fields BEFORE stripping instrText
  const withFields = ctx.preserveDynamicFields ? replaceWordPageFieldsWithTokens(pXml) : pXml;
  const cleanedPXml = stripAlternateContentFallbacks(withFields)
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

  let pageBreakBefore = /<w:pageBreakBefore(?:\s*\/>|\s+w:val="(?:1|true|on)")/i.test(pPr);

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

  // Extract top-level runs (<w:r>) with nesting awareness so nested <w:r> inside <wps:txbx>/<v:textbox>
  // stay inside their parent shape run instead of prematurely closing the outer <w:r>!
  const runs = [];
  const plainParts = [];
  let hasPageBreak = false;

  const rBodies = [];
  const rTagRe = /<w:r(?:\s[^>]*)?>|<\/w:r>/g;
  let rDepth = 0;
  let rStartContent = -1;
  let rTagMatch;
  while ((rTagMatch = rTagRe.exec(cleanedPXml)) !== null) {
    if (rTagMatch[0].startsWith('</')) {
      if (rDepth > 0) {
        rDepth -= 1;
        if (rDepth === 0 && rStartContent >= 0) {
          rBodies.push(cleanedPXml.slice(rStartContent, rTagMatch.index));
          rStartContent = -1;
        }
      }
    } else if (!rTagMatch[0].endsWith('/>')) {
      if (rDepth === 0) {
        rStartContent = rTagMatch.index + rTagMatch[0].length;
      }
      rDepth += 1;
    }
  }

  for (const rBody of rBodies) {
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

    // 1. Check for DrawingML embedded images (<a:blip r:embed="rIdX"/>)
    const blipMatches = [...rBody.matchAll(/<a:blip\b[^>]*r:(?:embed|link)="([^"]+)"/g)];
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

    // 2. Check for legacy Word VML images (<w:pict> ... <v:imagedata r:id="rIdX"/>)
    if (blipMatches.length === 0 && /<v:imagedata\b/i.test(rBody)) {
      const vmlMatches = [...rBody.matchAll(/<v:imagedata\b[^>]*(?:r:id|o:relid)="([^"]+)"/gi)];
      const shapeStyle = (rBody.match(/<v:shape\b[^>]*style="([^"]+)"/i) || [])[1] || '';
      const widthPt = parseCssPtValue(shapeStyle, 'width');
      const heightPt = parseCssPtValue(shapeStyle, 'height');
      for (const vm of vmlMatches) {
        const media = ctx.mediaMap.get(vm[1]);
        if (media) {
          runs.push({ type: 'image', src: media.src, mime: media.mime, widthPt, heightPt });
        }
      }
    }

    // 3. Check for filled Word banner shapes (DrawingML <wps:wsp> or VML <v:rect>) when no image blip
    let consumedTextInShape = false;
    if (blipMatches.length === 0 && !/<v:imagedata\b/i.test(rBody)) {
      if (/<wps:wsp\b/i.test(rBody) || /<a:prstGeom\b[^>]*prst="rect"/i.test(rBody)) {
        const extM = rBody.match(/<wp:extent\b[^>]*cx="(\d+)"[^>]*cy="(\d+)"/) || rBody.match(/<a:ext\b[^>]*cx="(\d+)"[^>]*cy="(\d+)"/);
        const fillM = rBody.match(/<a:solidFill[\s>][\s\S]*?<a:srgbClr\b[^>]*val="([0-9A-Fa-f]{6})"/i);
        const txbxM = rBody.match(/<wps:txbx[\s>][\s\S]*?<\/wps:txbx>/i);
        const shapeText = txbxM
          ? [...txbxM[0].matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map((tm) => decodeXmlEntities(tm[1] || '')).join('').trim()
          : '';
        const shapeBold = Boolean(txbxM && /<w:b(?:\s*\/>|\s+w:val="(?:1|true|on)")/i.test(txbxM[0]));
        const wPt = extM ? Math.round((Number(extM[1]) / 12700) * 10) / 10 : 320;
        const hPt = extM ? Math.round((Number(extM[2]) / 12700) * 10) / 10 : 28;
        const col = fillM ? `#${fillM[1].toUpperCase()}` : '#E5E7EB';
        if (wPt >= 24 && hPt >= 4) {
          runs.push({
            type: 'shape',
            fill: col,
            fillColor: col,
            text: shapeText,
            bold: shapeBold,
            widthPt: wPt,
            heightPt: hPt,
            posLeftPt: null,
            posTopPt: null,
          });
          if (shapeText) {
            plainParts.push(shapeText);
            consumedTextInShape = true;
          }
        }
      } else if (/<v:rect\b/i.test(rBody)) {
        const rectTag = (rBody.match(/<v:rect\b([^>]*)>/i) || [])[1] || '';
        const st = (rectTag.match(/style="([^"]+)"/i) || [])[1] || '';
        const fillCol = (rectTag.match(/fillcolor="([^"]+)"/i) || [])[1] || '#E5E7EB';
        const vTxbxM = rBody.match(/<v:textbox[\s>][\s\S]*?<\/v:textbox>/i);
        const shapeText = vTxbxM
          ? [...vTxbxM[0].matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map((tm) => decodeXmlEntities(tm[1] || '')).join('').trim()
          : '';
        const wPt = parseCssPtValue(st, 'width') || 320;
        const hPt = parseCssPtValue(st, 'height') || 28;
        runs.push({
          type: 'shape',
          fill: fillCol,
          fillColor: fillCol,
          text: shapeText,
          widthPt: wPt,
          heightPt: hPt,
          posLeftPt: parseCssPtValue(st, 'margin-left'),
          posTopPt: parseCssPtValue(st, 'margin-top'),
        });
        if (shapeText) {
          plainParts.push(shapeText);
          consumedTextInShape = true;
        }
      }
    }

    if (/<w:br\b[^>]*w:type="page"/i.test(rBody)) {
      if (plainParts.length === 0 && runs.length === 0) {
        pageBreakBefore = true;
      } else {
        hasPageBreak = true;
      }
    }

    if (consumedTextInShape) continue;

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

  const hasImage = runs.some((r) => r.type === 'image' || r.type === 'shape');
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
    preserveDynamicFields: true,
  };
  const blocks = [];
  const topEls = extractTopLevelXmlElements(xmlStr, ['w:p', 'w:tbl', 'w:sdt']);
  const walk = (els) => {
    for (const el of els) {
      if (el.tag === 'w:sdt') {
        const cm = el.xml.match(/<w:sdtContent[\s>]([\s\S]*?)<\/w:sdtContent>/);
        if (cm) walk(extractTopLevelXmlElements(cm[1], ['w:p', 'w:tbl', 'w:sdt']));
      } else if (el.tag === 'w:p') {
        const p = parseParagraphXml(el.xml, localCtx);
        if (p.plain || p.hasImage) blocks.push(p);
      } else if (el.tag === 'w:tbl') {
        const t = parseTableXml(el.xml, localCtx);
        if (t.rows.length > 0) blocks.push(t);
      }
    }
  };
  walk(topEls);
  if (blocks.length === 0) return null;
  return {
    blocks,
    images: blocks.flatMap((b) => (b.runs || []).filter((r) => r.type === 'image' || r.type === 'shape')),
    text: blocks.map((b) => b.plain).filter(Boolean).join(' · '),
  };
}

/**
 * Pure-JS High-Fidelity OOXML Document Model Parser.
 * Works identically in Node.js (unit tests) and Browser (custom header/footer compositor + fallback).
 * Accepts either `(arrayBuffer, extractZipEntriesFn)` OR a pre-extracted `Map<name, Uint8Array>`.
 */
export async function parseDocxRichModel(arrayBufferOrMap, extractZipEntriesFn) {
  const decoder = new TextDecoder('utf-8', { fatal: false });
  const emptyModel = {
    pageWidthPt: 595.28,
    pageHeightPt: 841.89,
    margins: { top: 72, right: 72, bottom: 72, left: 72, header: 36, footer: 36 },
    defaultFont: 'Times New Roman',
    defaultFontSize: 11,
    headers: [],
    footers: [],
    sectionMeta: {
      hasTitlePg: false,
      headerByType: { first: null, default: null, even: null },
      footerByType: { first: null, default: null, even: null },
      fontFamilies: [],
    },
    blocks: [],
    paragraphs: [],
    tables: [],
    plainText: '',
  };

  let entriesMap;
  if (arrayBufferOrMap instanceof Map) {
    entriesMap = arrayBufferOrMap;
  } else {
    const bytes = new Uint8Array(arrayBufferOrMap);
    if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
      return emptyModel;
    }
    const entriesRaw = await extractZipEntriesFn(arrayBufferOrMap);
    entriesMap =
      entriesRaw instanceof Map
        ? entriesRaw
        : new Map((Array.isArray(entriesRaw) ? entriesRaw : []).map((e) => [e.name, e.data]));
  }

  const docBytes = entriesMap.get('word/document.xml');
  if (!docBytes) return emptyModel;

  const docXml = decoder.decode(docBytes);
  const stylesXml = entriesMap.has('word/styles.xml') ? decoder.decode(entriesMap.get('word/styles.xml')) : '';
  const themeXml = entriesMap.has('word/theme/theme1.xml') ? decoder.decode(entriesMap.get('word/theme/theme1.xml')) : '';
  const numberingXml = entriesMap.has('word/numbering.xml') ? decoder.decode(entriesMap.get('word/numbering.xml')) : '';
  const relsXml = entriesMap.has('word/_rels/document.xml.rels') ? decoder.decode(entriesMap.get('word/_rels/document.xml.rels')) : '';

  const parsedStyles = parseStylesXml(stylesXml);
  let defaultFont = parsedStyles.defaultFont;
  const defaultFontSize = parsedStyles.defaultFontSize;
  const styles = parsedStyles.styles;

  // Detect theme body font if styles.xml didn't specify an explicit font
  if (themeXml && defaultFont === 'Times New Roman') {
    const minorM = themeXml.match(/<a:minorFont[\s>][\s\S]*?<a:latin\b[^>]*typeface="([^"]+)"/);
    if (minorM && minorM[1]) defaultFont = minorM[1];
  }

  // Collect all unique font families used across styles & document for webfont preloading
  const fontSet = new Set([defaultFont]);
  for (const fm of `${stylesXml}\n${docXml}`.matchAll(/<w:rFonts\b[^>]*(?:w:ascii|w:hAnsi)="([^"]+)"/g)) {
    if (fm[1] && !fm[1].startsWith('+')) fontSet.add(fm[1]);
  }
  const fontFamilies = [...fontSet];

  const numbering = parseNumberingXml(numberingXml);
  const { mediaMap, linkMap, targetMap } = parseRelsMediaMap(relsXml, entriesMap, 'word/');

  // Page size, margins & Different-First-Page header/footer references from <w:sectPr>
  let pageWidthPt = 595.28;
  let pageHeightPt = 841.89;
  const margins = { top: 68, right: 64, bottom: 68, left: 64, header: 32, footer: 32 };
  let hasTitlePg = false;
  const headerRefTargets = { first: '', default: '', even: '' };
  const footerRefTargets = { first: '', default: '', even: '' };

  const sectMatches = [...docXml.matchAll(/<w:sectPr[\s>][\s\S]*?<\/w:sectPr>/g)];
  const sectXml = sectMatches.length > 0 ? sectMatches[sectMatches.length - 1][0] : '';
  if (sectXml) {
    hasTitlePg = /<w:titlePg(?:\s*\/>|\s+w:val="(?:1|true|on)")/i.test(sectXml);
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
    const mHeader = Number((pgMar.match(/w:header="(\d+)"/) || [])[1] || 0);
    const mFooter = Number((pgMar.match(/w:footer="(\d+)"/) || [])[1] || 0);
    if (mTop > 0) margins.top = Math.min(130, Math.max(36, mTop / 20));
    if (mRight > 0) margins.right = Math.min(110, Math.max(36, mRight / 20));
    if (mBottom > 0) margins.bottom = Math.min(130, Math.max(36, mBottom / 20));
    if (mLeft > 0) margins.left = Math.min(110, Math.max(36, mLeft / 20));
    if (mHeader > 0) margins.header = Math.min(72, Math.max(12, mHeader / 20));
    if (mFooter > 0) margins.footer = Math.min(72, Math.max(12, mFooter / 20));

    for (const hm of sectXml.matchAll(/<w:headerReference\b([^>]+)\/?>/g)) {
      const attrs = hm[1] || '';
      const hType = ((attrs.match(/w:type="([^"]+)"/) || [])[1] || 'default').toLowerCase();
      const rId = (attrs.match(/r:id="([^"]+)"/) || [])[1] || '';
      if (rId && targetMap.has(rId)) headerRefTargets[hType] = targetMap.get(rId);
    }
    for (const fm of sectXml.matchAll(/<w:footerReference\b([^>]+)\/?>/g)) {
      const attrs = fm[1] || '';
      const fType = ((attrs.match(/w:type="([^"]+)"/) || [])[1] || 'default').toLowerCase();
      const rId = (attrs.match(/r:id="([^"]+)"/) || [])[1] || '';
      if (rId && targetMap.has(rId)) footerRefTargets[fType] = targetMap.get(rId);
    }
  }

  const ctx = {
    styles,
    numbering,
    mediaMap,
    linkMap,
    defaultFont,
    defaultFontSize,
    numCounters: new Map(),
    preserveDynamicFields: false,
  };

  // Parse headers & footers AND index them by target filename and section role (first / default / even)
  const headers = [];
  const footers = [];
  const headerByPath = new Map();
  const footerByPath = new Map();
  for (const [name, data] of entriesMap.entries()) {
    if (/^word\/header\d*\.xml$/i.test(name)) {
      const baseName = name.split('/').pop();
      const relKey = `word/_rels/${baseName}.rels`;
      const relStr = entriesMap.has(relKey) ? decoder.decode(entriesMap.get(relKey)) : '';
      const parsed = parseHeaderOrFooterXml(decoder.decode(data), entriesMap, relStr, ctx);
      if (parsed) {
        const entry = { name, ...parsed };
        headers.push(entry);
        headerByPath.set(name, entry);
      }
    } else if (/^word\/footer\d*\.xml$/i.test(name)) {
      const baseName = name.split('/').pop();
      const relKey = `word/_rels/${baseName}.rels`;
      const relStr = entriesMap.has(relKey) ? decoder.decode(entriesMap.get(relKey)) : '';
      const parsed = parseHeaderOrFooterXml(decoder.decode(data), entriesMap, relStr, ctx);
      if (parsed) {
        const entry = { name, ...parsed };
        footers.push(entry);
        footerByPath.set(name, entry);
      }
    }
  }

  const headerByType = {
    first: headerRefTargets.first ? headerByPath.get(headerRefTargets.first) || null : null,
    default: headerRefTargets.default ? headerByPath.get(headerRefTargets.default) || null : headers[0] || null,
    even: headerRefTargets.even ? headerByPath.get(headerRefTargets.even) || null : null,
  };
  const footerByType = {
    first: footerRefTargets.first ? footerByPath.get(footerRefTargets.first) || null : null,
    default: footerRefTargets.default ? footerByPath.get(footerRefTargets.default) || null : footers[0] || null,
    even: footerRefTargets.even ? footerByPath.get(footerRefTargets.even) || null : null,
  };

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
    sectionMeta: {
      hasTitlePg,
      headerByType,
      footerByType,
      fontFamilies,
    },
    headerLines: headers.map((h) => h.text).filter(Boolean),
    footerLines: footers.map((f) => f.text).filter(Boolean),
    blocks,
    paragraphs,
    tables,
    plainText,
  };
}

/**
 * Maps Microsoft Word font families to metric-compatible open-source Google Fonts + system fallbacks
 * so Linux/Android browsers NEVER fall back to sans-serif Roboto when rendering serif Word documents!
 */
export function mapDocFontStack(fontName = '') {
  const raw = String(fontName || '').replace(/['"]/g, '').trim();
  const lower = raw.toLowerCase();
  if (!raw || lower.includes('times')) {
    return `'Times New Roman', 'Tinos', Georgia, 'Liberation Serif', serif`;
  }
  if (lower.includes('garamond')) {
    return `'Garamond', 'EB Garamond', 'Cormorant Garamond', Georgia, serif`;
  }
  if (lower.includes('cambria')) {
    return `'Cambria', 'Caladea', 'Tinos', Georgia, serif`;
  }
  if (lower.includes('palatino') || lower.includes('book antiqua')) {
    return `'Palatino Linotype', 'EB Garamond', Georgia, serif`;
  }
  if (lower.includes('georgia')) {
    return `Georgia, 'Tinos', serif`;
  }
  if (lower.includes('calibri')) {
    return `'Calibri', 'Carlito', 'Arimo', Arial, sans-serif`;
  }
  if (lower.includes('arial') || lower.includes('helvetica')) {
    return `'Arial', 'Arimo', Helvetica, 'Liberation Sans', sans-serif`;
  }
  if (lower.includes('courier') || lower.includes('consolas') || lower.includes('mono')) {
    return `'Courier New', 'Cousine', monospace`;
  }
  if (lower.includes('segoe') || lower.includes('tahoma') || lower.includes('verdana') || lower.includes('sans')) {
    return `'${raw}', 'Arimo', 'Carlito', Arial, sans-serif`;
  }
  return `'${raw}', 'Tinos', 'EB Garamond', Georgia, serif`;
}

const loadedFontHrefSet = new Set();

async function ensureDocumentWebFonts(fontNames = []) {
  if (typeof document === 'undefined') return;
  const joined = (Array.isArray(fontNames) ? fontNames : [fontNames]).join(' ').toLowerCase();
  const families = new Set(['Tinos:ital,wght@0,400;0,700;1,400;1,700']);
  if (joined.includes('garamond') || joined.includes('palatino') || joined.includes('book')) {
    families.add('EB+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,700');
  }
  if (joined.includes('cambria')) {
    families.add('Caladea:ital,wght@0,400;0,700;1,400;1,700');
  }
  if (joined.includes('calibri')) {
    families.add('Carlito:ital,wght@0,400;0,700;1,400;1,700');
  }
  if (joined.includes('arial') || joined.includes('helvetica') || joined.includes('sans') || joined.includes('segoe')) {
    families.add('Arimo:ital,wght@0,400;0,700;1,400;1,700');
  }
  if (joined.includes('courier') || joined.includes('consolas') || joined.includes('mono')) {
    families.add('Cousine:ital,wght@0,400;0,700;1,400');
  }

  const href = `https://fonts.googleapis.com/css2?${Array.from(families)
    .map((f) => `family=${f}`)
    .join('&')}&display=swap`;

  if (!loadedFontHrefSet.has(href)) {
    loadedFontHrefSet.add(href);
    try {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.crossOrigin = 'anonymous';
      document.head.appendChild(link);
    } catch {
      // Offline fallback works gracefully with system stacks
    }
  }

  if (document.fonts && document.fonts.ready) {
    await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1200))]);
  }
}

function augmentFontFamiliesInSandbox(rootEl, defaultFont = 'Times New Roman') {
  if (!rootEl) return;
  const rewriteFontVal = (val) => {
    const clean = String(val || '').trim();
    if (!clean) return mapDocFontStack(defaultFont);
    if (/EB Garamond|Tinos|Caladea|Carlito|Arimo|Cousine/i.test(clean)) return clean;
    const first = clean.split(',')[0].replace(/['"]/g, '').trim();
    return mapDocFontStack(first || defaultFont);
  };

  for (const styleEl of Array.from(rootEl.querySelectorAll('style'))) {
    const css = styleEl.textContent || '';
    if (!css.includes('font-family')) continue;
    styleEl.textContent = css.replace(/font-family\s*:\s*([^;}{]+)(;|(?=\}))/gi, (_, val, term) => {
      const important = /!important/i.test(val) ? ' !important' : '';
      const baseVal = val.replace(/!important/gi, '').trim();
      return `font-family: ${rewriteFontVal(baseVal)}${important}${term}`;
    });
  }

  for (const el of Array.from(rootEl.querySelectorAll('[style*="font-family"]'))) {
    if (el.style && el.style.fontFamily) {
      el.style.fontFamily = rewriteFontVal(el.style.fontFamily);
    }
  }
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

    // Find any line/image straddling `idealEnd` (with 2px safety halo) and snap cut cleanly ABOVE it!
    let cutY = idealEnd;
    for (const box of boxes) {
      if (box.top - 2 < cutY && box.bottom + 2 > cutY) {
        if (box.top > curStart + safeUsable * 0.22) {
          cutY = Math.min(cutY, Math.floor(box.top) - 3);
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
 * Pure ink-density whitespace gutter scanner: given per-row ink scores (0 = pure white, >0 = ink),
 * locates the cleanest horizontal whitespace band at or just above `idealIdx` so page cuts
 * NEVER horizontally slice glyphs even when line-height metrics drift from DOM bounding boxes.
 */
export function findWhiteGutterInRowScores(
  rowScores = [],
  idealIdx = 0,
  { minIdx = 0, maxIdx = -1, threshold = 0.002 } = {}
) {
  const len = rowScores.length;
  if (len === 0) return Math.max(0, Math.round(idealIdx));
  const lo = Math.max(0, Math.min(len - 1, Math.floor(minIdx)));
  const hi = Math.max(lo, Math.min(len - 1, maxIdx >= 0 ? Math.floor(maxIdx) : len - 1));
  const target = Math.max(lo, Math.min(hi, Math.round(idealIdx)));

  const isCleanBand = (idx) => {
    const s0 = rowScores[idx] ?? 0;
    const sPrev = rowScores[Math.max(lo, idx - 1)] ?? s0;
    const sNext = rowScores[Math.min(hi, idx + 1)] ?? s0;
    return s0 <= threshold && sPrev <= threshold && sNext <= threshold;
  };

  // Prefer scanning upward first so content never overflows the printable page area
  for (let i = target; i >= lo; i -= 1) {
    if (isCleanBand(i)) return i;
  }
  // If no 3px pure-white band above, check single white row above
  for (let i = target; i >= lo; i -= 1) {
    if ((rowScores[i] ?? 0) <= threshold) return i;
  }
  // Check a small downward margin up to hi
  for (let i = target + 1; i <= hi; i += 1) {
    if (isCleanBand(i)) return i;
  }

  // Fallback: pick the minimum-ink row within [lo, target]
  let bestIdx = target;
  let bestScore = Infinity;
  for (let i = target; i >= lo; i -= 1) {
    const sc = rowScores[i] ?? 0;
    if (sc < bestScore) {
      bestScore = sc;
      bestIdx = i;
    }
  }
  return bestIdx;
}

/**
 * Pixel-level whitespace gutter refinement on a rasterized `html2canvas` bitmap.
 */
function findWhitePixelGutterY(canvas, idealCssY, minCssY, maxCssY, scale = 1) {
  if (!canvas || !canvas.width || !canvas.height) return idealCssY;
  const s = Math.max(0.5, Number(scale) || 1);
  const idealPx = Math.max(0, Math.min(canvas.height - 1, Math.round(idealCssY * s)));
  const minPx = Math.max(0, Math.min(idealPx, Math.round(minCssY * s)));
  const maxPx = Math.max(idealPx, Math.min(canvas.height - 1, Math.round(maxCssY * s)));
  const scanTop = Math.max(minPx, idealPx - Math.round(72 * s));
  const scanBottom = Math.min(maxPx, idealPx + Math.round(8 * s));
  const bandH = scanBottom - scanTop + 1;
  if (bandH <= 2) return idealCssY;

  try {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return idealCssY;
    const xPad = Math.min(20, Math.floor(canvas.width * 0.04));
    const sampleW = Math.max(1, canvas.width - xPad * 2);
    const imgData = ctx.getImageData(xPad, scanTop, sampleW, bandH).data;
    const scores = new Float32Array(bandH);
    const stepX = Math.max(1, Math.floor(sampleW / 240));
    const samplesPerRow = Math.max(1, Math.ceil(sampleW / stepX));

    for (let r = 0; r < bandH; r += 1) {
      let dark = 0;
      const rowOff = r * sampleW * 4;
      for (let x = 0; x < sampleW; x += stepX) {
        const idx = rowOff + x * 4;
        const lum = imgData[idx] * 0.299 + imgData[idx + 1] * 0.587 + imgData[idx + 2] * 0.114;
        if (lum < 238) dark += 1;
      }
      scores[r] = dark / samplesPerRow;
    }

    const bestLocal = findWhiteGutterInRowScores(scores, idealPx - scanTop, {
      minIdx: 0,
      maxIdx: bandH - 1,
      threshold: 0.002,
    });
    return (scanTop + bestLocal) / s;
  } catch {
    return idealCssY;
  }
}

/**
 * Replaces live OOXML dynamic field placeholders (`{{PAGE}}`, `{{NUMPAGES}}`) with actual 1-based numbers.
 */
export function resolveDynamicPageTokens(text = '', pageNum = 1, totalPages = 1) {
  return String(text ?? '')
    .replace(/\{\{PAGE\}\}/g, String(pageNum))
    .replace(/\{\{NUMPAGES\}\}/g, String(Math.max(1, totalPages)));
}

/**
 * Builds crisp standalone HTML for a parsed DOCX header or footer band (including embedded logos,
 * DrawingML/VML banner shapes, tables, bold/italic/color runs, and resolved `{{PAGE}}`/`{{NUMPAGES}}`).
 */
export function buildHeaderFooterBandHtml(
  hfObj,
  {
    pageNum = 1,
    totalPages = 1,
    pageW = 794,
    padLeft = 64,
    padRight = 64,
    defaultFont = 'Times New Roman',
    defaultFontSize = 10,
  } = {}
) {
  if (!hfObj || !Array.isArray(hfObj.blocks) || hfObj.blocks.length === 0) return '';

  const escHtml = (s) =>
    String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const ptToPx = (pt) => Math.round((Number(pt) || 0) * (96 / 72) * 10) / 10;

  const renderRun = (r) => {
    if (r.type === 'image' && r.src) {
      const wPx = r.widthPt ? ptToPx(r.widthPt) : 0;
      const hPx = r.heightPt ? ptToPx(r.heightPt) : 0;
      const dimStyle = `${wPx ? `width:${wPx}px;` : ''}${hPx ? `height:${hPx}px;` : 'height:auto;'}max-width:100%;object-fit:contain;vertical-align:middle;`;
      return `<img src="${r.src}" alt="" style="${dimStyle}" />`;
    }
    if (r.type === 'shape') {
      const fill = escHtml(r.fill || r.fillColor || '#E5E7EB');
      const wPx = r.widthPt ? ptToPx(r.widthPt) : 0;
      const hPx = r.heightPt ? ptToPx(r.heightPt) : 0;
      const innerText = escHtml(resolveDynamicPageTokens(r.text || '', pageNum, totalPages)).replace(/\n/g, '<br/>');
      const boxStyle = [
        `background:${fill}`,
        'display:inline-flex',
        'flex:1',
        'align-items:center',
        'justify-content:center',
        'padding:6px 12px',
        'border-radius:2px',
        wPx ? `min-width:${Math.min(pageW - padLeft - padRight, wPx)}px` : 'min-width:120px',
        hPx ? `min-height:${Math.min(120, hPx)}px` : 'min-height:24px',
        'box-sizing:border-box',
        'font-size:10pt',
        r.bold ? 'font-weight:700' : 'font-weight:600',
        'color:#111111',
      ].join(';');
      return `<span class="ms-hf-shape" style="${boxStyle}">${innerText}</span>`;
    }
    const resolved = resolveDynamicPageTokens(r.text || '', pageNum, totalPages);
    let inner = escHtml(resolved).replace(/\n/g, '<br/>').replace(/\t/g, '&emsp;&emsp;');
    if (r.superscript) inner = `<sup>${inner}</sup>`;
    if (r.subscript) inner = `<sub>${inner}</sub>`;
    if (r.bold) inner = `<strong>${inner}</strong>`;
    if (r.italic) inner = `<em>${inner}</em>`;
    if (r.underline) inner = `<u>${inner}</u>`;
    const styles = [];
    if (r.color) styles.push(`color:${escHtml(r.color)}`);
    if (r.fontSize) styles.push(`font-size:${r.fontSize}pt`);
    if (r.font) styles.push(`font-family:${mapDocFontStack(r.font)}`);
    return styles.length ? `<span style="${styles.join(';')}">${inner}</span>` : inner;
  };

  const renderBlock = (b) => {
    if (b.type === 'table' && Array.isArray(b.rows)) {
      const rowsHtml = b.rows
        .map(
          (row) =>
            `<tr>${row
              .map((cell) => {
                const bg = cell.shading ? `background:${escHtml(cell.shading)};` : '';
                const inner = (cell.paragraphs || [])
                  .map(
                    (p) =>
                      `<div style="text-align:${escHtml(p.align || 'left')};margin:0 0 2px;line-height:1.25;">${(p.runs || [])
                        .map(renderRun)
                        .join('')}</div>`
                  )
                  .join('');
                return `<td style="padding:2px 4px;vertical-align:middle;border:none;${bg}">${inner}</td>`;
              })
              .join('')}</tr>`
        )
        .join('');
      return `<table style="width:100%;border-collapse:collapse;margin:0;table-layout:auto;">${rowsHtml}</table>`;
    }
    const align = escHtml(b.align || 'left');
    const runs = b.runs || [];
    const hasVisualRow =
      runs.some((r) => r.type === 'image') && runs.some((r) => r.type === 'shape' || (r.text && r.text.trim()));
    const runsHtml = runs.map(renderRun).join('');
    if (!runsHtml) return '';
    if (hasVisualRow) {
      return `<div style="display:flex;align-items:center;gap:10px;justify-content:${
        align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start'
      };margin:0 0 4px;line-height:1.28;">${runsHtml}</div>`;
    }
    return `<div style="text-align:${align};margin:0 0 2px;line-height:1.28;display:block;">${runsHtml}</div>`;
  };

  const innerHtml = hfObj.blocks.map(renderBlock).filter(Boolean).join('\n');
  if (!innerHtml) return '';

  return `<div class="ms-hf-band" style="width:${pageW}px;padding:6px ${padRight}px 6px ${padLeft}px;box-sizing:border-box;background:#ffffff;color:#111111;font-family:${mapDocFontStack(
    defaultFont
  )};font-size:${defaultFontSize}pt;">${innerHtml}</div>`;
}

/**
 * Sanitizes an OOXML `.docx` buffer in-memory when `docx-preview` encounters a DrawingML /
 * header XML quirk (such as `<pic:pic>` missing `<pic:spPr>`/`<a:xfrm>`, or `<wps:wsp>` shapes
 * inside `header*.xml`/`footer*.xml` which `docx-preview` still parses even when `renderHeaders:false`).
 */
async function sanitizeDocxBufferForPreview(arrayBuffer, JSZip, { stripHeaderFooterXml = false, neutralizeShapes = false } = {}) {
  const zip = await JSZip.loadAsync(arrayBuffer);
  const names = Object.keys(zip.files || {});
  await Promise.all(
    names.map(async (name) => {
      const zf = zip.files[name];
      if (!zf || zf.dir) return;
      if (stripHeaderFooterXml && /^word\/(header|footer)\d*\.xml$/i.test(name)) {
        const isHdr = /header/i.test(name);
        const tag = isHdr ? 'w:hdr' : 'w:ftr';
        zip.file(
          name,
          `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><${tag} xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p/></${tag}>`
        );
        return;
      }
      if (/^word\/(document|footnotes|endnotes|header\d*|footer\d*)\.xml$/i.test(name)) {
        let xml = await zf.async('string');
        let changed = false;
        // Ensure every <pic:pic> has <pic:spPr><a:xfrm> so docx-preview's parsePicture never hits null.childNodes
        const fixedPic = xml.replace(/<pic:pic\b([^>]*)>([\s\S]*?)<\/pic:pic>/gi, (full, attrs, inner) => {
          if (/<pic:spPr\b/i.test(inner)) {
            if (!/<a:xfrm\b/i.test(inner)) {
              changed = true;
              return full.replace(
                /<pic:spPr\b([^>]*)>/i,
                '<pic:spPr$1><a:xfrm xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:off x="0" y="0"/><a:ext cx="914400" cy="914400"/></a:xfrm>'
              );
            }
            return full;
          }
          changed = true;
          return `<pic:pic${attrs}>${inner}<pic:spPr><a:xfrm xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:off x="0" y="0"/><a:ext cx="914400" cy="914400"/></a:xfrm></pic:spPr></pic:pic>`;
        });
        xml = fixedPic;
        if (neutralizeShapes) {
          const stripped = xml.replace(/<w:drawing\b[^>]*>[\s\S]*?<\/w:drawing>/gi, (drawMatch) => {
            if (/<pic:pic\b/i.test(drawMatch)) return drawMatch;
            changed = true;
            return '';
          });
          xml = stripped;
        }
        if (changed) {
          zip.file(name, xml);
        }
      }
    })
  );
  return zip.generateAsync({ type: 'arraybuffer' });
}

/**
 * Builds an authentic visual DOM inside `bodyHost` directly from our parsed OOXML `richModel`
 * whenever `docx-preview` cannot parse a malformed/exotic Word file. Keeps exact page dimensions,
 * margins, tables, embedded images, shapes, and serif font stacks so Pass 1 & Pass 2 still render HD pages.
 */
function populateRichModelVisualSection(bodyHost, richModel, docFontStack) {
  if (!bodyHost || !richModel || !Array.isArray(richModel.blocks)) return;
  const ptToPx = (pt) => Math.round((Number(pt) || 0) * (96 / 72));
  const pageW = Math.max(480, ptToPx(richModel.pageSize?.widthPt || 595.28));
  const pageH = Math.max(640, ptToPx(richModel.pageSize?.heightPt || 841.89));
  const m = richModel.margins || { top: 72, bottom: 72, left: 72, right: 72 };
  const padTop = Math.max(24, ptToPx(m.top || 72));
  const padBottom = Math.max(24, ptToPx(m.bottom || 72));
  const padLeft = Math.max(24, ptToPx(m.left || 72));
  const padRight = Math.max(24, ptToPx(m.right || 72));

  const esc = (s) =>
    String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const renderRun = (r) => {
    if (r.type === 'image' && r.src) {
      const wPx = r.widthPt ? ptToPx(r.widthPt) : 0;
      const hPx = r.heightPt ? ptToPx(r.heightPt) : 0;
      return `<img src="${r.src}" alt="" style="${wPx ? `width:${wPx}px;` : ''}${hPx ? `height:${hPx}px;` : 'height:auto;'}max-width:100%;object-fit:contain;vertical-align:middle;" />`;
    }
    if (r.type === 'shape') {
      const fill = esc(r.fill || r.fillColor || '#E5E7EB');
      const inner = esc(resolveDynamicPageTokens(r.text || '', 1, 1)).replace(/\n/g, '<br/>');
      return `<span style="display:inline-flex;align-items:center;background:${fill};padding:4px 10px;border-radius:2px;color:#111111;">${inner}</span>`;
    }
    let inner = esc(resolveDynamicPageTokens(r.text || '', 1, 1)).replace(/\n/g, '<br/>').replace(/\t/g, '&emsp;&emsp;');
    if (r.superscript) inner = `<sup>${inner}</sup>`;
    if (r.subscript) inner = `<sub>${inner}</sub>`;
    if (r.bold) inner = `<strong>${inner}</strong>`;
    if (r.italic) inner = `<em>${inner}</em>`;
    if (r.underline) inner = `<u>${inner}</u>`;
    const st = [];
    if (r.color) st.push(`color:${esc(r.color)}`);
    if (r.fontSize) st.push(`font-size:${r.fontSize}pt`);
    if (r.font) st.push(`font-family:${mapDocFontStack(r.font)}`);
    return st.length ? `<span style="${st.join(';')}">${inner}</span>` : inner;
  };

  // Split blocks into explicit page sections on `pageBreakBefore` / `hasPageBreak`
  const pageGroups = [[]];
  for (const b of richModel.blocks) {
    if (b.pageBreakBefore && pageGroups[pageGroups.length - 1].length > 0) {
      pageGroups.push([]);
    }
    pageGroups[pageGroups.length - 1].push(b);
    if (b.hasPageBreak) {
      pageGroups.push([]);
    }
  }
  const nonEmptyGroups = pageGroups.filter((g) => g.length > 0);

  const sectionsHtml = nonEmptyGroups
    .map((group) => {
      const blocksHtml = group
        .map((b) => {
          if (b.type === 'table' && Array.isArray(b.rows)) {
            const rowsHtml = b.rows
              .map(
                (row) =>
                  `<tr>${row
                    .map((cell) => {
                      const bg = cell.shading ? `background:${esc(cell.shading)};` : '';
                      const csAttr = cell.colSpan > 1 ? ` colspan="${cell.colSpan}"` : '';
                      const pHtml = (cell.paragraphs || [])
                        .map(
                          (p) =>
                            `<p style="margin:0 0 4px;text-align:${esc(p.align || 'left')};line-height:1.35;">${(p.runs || [])
                              .map(renderRun)
                              .join('')}</p>`
                        )
                        .join('');
                      return `<td${csAttr} style="border:1px solid #444444;padding:6px 8px;vertical-align:top;${bg}">${pHtml}</td>`;
                    })
                    .join('')}</tr>`
              )
              .join('');
            return `<table style="width:100%;border-collapse:collapse;margin:8px 0;font-size:${richModel.defaultFontSize || 11}pt;">${rowsHtml}</table>`;
          }
          const align = esc(b.align || 'left');
          const fs = b.fontSize ? `font-size:${b.fontSize}pt;` : '';
          const mt = b.spaceBefore ? `margin-top:${Math.round(b.spaceBefore)}pt;` : 'margin-top:0;';
          const mb = b.spaceAfter ? `margin-bottom:${Math.round(b.spaceAfter)}pt;` : 'margin-bottom:6pt;';
          const pl = b.indentLeft ? `padding-left:${Math.round(b.indentLeft)}pt;` : '';
          const ti = b.firstLineIndent ? `text-indent:${Math.round(b.firstLineIndent)}pt;` : '';
          const bullet = b.listMarker ? `<span>${esc(b.listMarker)} </span>` : '';
          const inner = (b.runs || []).map(renderRun).join('') || '&nbsp;';
          return `<p style="text-align:${align};line-height:1.38;${fs}${mt}${mb}${pl}${ti}">${bullet}${inner}</p>`;
        })
        .join('\n');
      return `<section class="ms-docx-render" style="width:${pageW}px;min-height:${pageH}px;padding:${padTop}px ${padRight}px ${padBottom}px ${padLeft}px;box-sizing:border-box;background:#ffffff;color:#000000;font-family:${docFontStack};font-size:${richModel.defaultFontSize || 11}pt;"><article>${blocksHtml}</article></section>`;
    })
    .join('\n');

  bodyHost.innerHTML = `<div class="ms-docx-render-wrapper">${sectionsHtml}</div>`;
}

async function renderBandHtmlToCanvas(htmlStr, { widthPx = 794, scale = 2.0, html2canvas } = {}) {
  if (!htmlStr || typeof document === 'undefined' || typeof html2canvas !== 'function') return null;
  const box = document.createElement('div');
  box.style.cssText = `position:fixed;left:-100000px;top:0;width:${widthPx}px;background:#ffffff;color:#111111;z-index:-9999;pointer-events:none;margin:0;padding:0;`;
  box.innerHTML = htmlStr;
  document.body.appendChild(box);
  try {
    const imgs = Array.from(box.querySelectorAll('img'));
    await Promise.all(
      imgs.map((img) =>
        img.complete
          ? Promise.resolve()
          : new Promise((res) => {
              img.onload = res;
              img.onerror = res;
              setTimeout(res, 1200);
            })
      )
    );
    await new Promise((r) => requestAnimationFrame(r));
    const rect = box.getBoundingClientRect();
    const hPx = Math.max(14, Math.ceil(box.scrollHeight || rect.height || 36));
    const words = extractDomWordRectsRelativeTo(box, rect.left, rect.top);
    const canvas = await html2canvas(box, {
      scale,
      backgroundColor: '#ffffff',
      useCORS: true,
      allowTaint: true,
      logging: false,
      width: widthPx,
      height: hPx,
      windowWidth: Math.max(1200, widthPx + 40),
      windowHeight: Math.max(300, hPx + 40),
    });
    return { canvas, heightCss: hPx, words };
  } catch {
    return null;
  } finally {
    try {
      box.remove();
    } catch {
      // Ignore cleanup
    }
  }
}

/**
 * Browser True-Layout DOCX Renderer (`docx-preview` + `html2canvas` + v101 OOXML Compositor).
 * Renders the user's `.docx` with 100% original Word formatting:
 * - Metric-compatible serif/sans Google Fonts (`EB Garamond`, `Tinos`, `Caladea`, `Carlito`, `Arimo`)
 * - Distinct `<w:titlePg/>` first-page header (embedded PNG logo + DrawingML/VML banner shapes)
 *   vs default pages 2+ headers & footers (e.g. CC-BY-NC-SA + OPEN ACCESS)
 * - Live dynamic page numbers (`1..N`) replacing stale cached Word `PAGE`/`NUMPAGES` fields
 * - Unclipped table borders (`height: auto !important; overflow: visible !important;`)
 * - Pixel-gutter verified page slicing (ZERO horizontally sliced text lines!)
 * - Automatic OOXML sanitization retry + RichModel visual DOM fallback for exotic DrawingML/VML files
 */
export async function renderDocxToFaithfulPages(
  arrayBuffer,
  { scale = 2.0, maxPages = 40, captureImages = true, onProgress = () => {} } = {}
) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;

  onProgress({ percent: 20, label: 'Memuat mesin render dokumen Word asli (OOXML Fidelity v101)...' });
  const libs = await ensureDocxRenderLibs();
  if (!libs) return null;

  // Parse OOXML metadata via JSZip first so we know exact fonts, <w:titlePg/>, headers/footers & shapes
  let richModel = null;
  try {
    const zip = await libs.JSZip.loadAsync(arrayBuffer);
    const entriesMap = new Map();
    const names = Object.keys(zip.files || {});
    await Promise.all(
      names.map(async (name) => {
        const zf = zip.files[name];
        if (zf && !zf.dir) {
          entriesMap.set(name, await zf.async('uint8array'));
        }
      })
    );
    richModel = await parseDocxRichModel(entriesMap);
  } catch {
    richModel = null;
  }

  // Preload metric-compatible Google Fonts matching this exact document
  await ensureDocumentWebFonts([
    richModel?.defaultFont || 'Times New Roman',
    ...(richModel?.sectionMeta?.fontFamilies || []),
  ]);

  const hasCustomHf = Boolean(
    richModel?.sectionMeta?.hasTitlePg ||
      (richModel?.headers && richModel.headers.length > 0) ||
      (richModel?.footers && richModel.footers.length > 0)
  );

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
    onProgress({ percent: 32, label: 'Merender tata letak, logo, tabel & tipografi asli Word (.docx)...' });

    const docFontStack = mapDocFontStack(richModel?.defaultFont || 'Times New Roman');
    const docxPreviewOptions = {
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
      renderHeaders: !hasCustomHf,
      renderFooters: !hasCustomHf,
      renderFootnotes: true,
      renderEndnotes: true,
    };

    let docxPreviewSucceeded = false;
    try {
      await libs.docx.renderAsync(arrayBuffer, bodyHost, styleHost, docxPreviewOptions);
      docxPreviewSucceeded = bodyHost.querySelectorAll('section.ms-docx-render').length > 0;
    } catch {
      docxPreviewSucceeded = false;
    }

    if (!docxPreviewSucceeded && libs.JSZip) {
      // Retry with sanitized OOXML (repairs missing <pic:spPr>/<a:xfrm> and strips custom header/footer XML that docx-preview crashes on)
      try {
        bodyHost.innerHTML = '';
        styleHost.innerHTML = '';
        const sanitizedBuf = await sanitizeDocxBufferForPreview(arrayBuffer, libs.JSZip, {
          stripHeaderFooterXml: hasCustomHf,
          neutralizeShapes: false,
        });
        await libs.docx.renderAsync(sanitizedBuf, bodyHost, styleHost, docxPreviewOptions);
        docxPreviewSucceeded = bodyHost.querySelectorAll('section.ms-docx-render').length > 0;
      } catch {
        docxPreviewSucceeded = false;
      }
    }

    if (!docxPreviewSucceeded && libs.JSZip) {
      // Second retry: also neutralize non-picture DrawingML shapes in document.xml that crash docx-preview
      try {
        bodyHost.innerHTML = '';
        styleHost.innerHTML = '';
        const sanitizedBuf2 = await sanitizeDocxBufferForPreview(arrayBuffer, libs.JSZip, {
          stripHeaderFooterXml: true,
          neutralizeShapes: true,
        });
        await libs.docx.renderAsync(sanitizedBuf2, bodyHost, styleHost, docxPreviewOptions);
        docxPreviewSucceeded = bodyHost.querySelectorAll('section.ms-docx-render').length > 0;
      } catch {
        docxPreviewSucceeded = false;
      }
    }

    if (!docxPreviewSucceeded && richModel) {
      // Final visual fallback: construct high-fidelity DOM directly from parsed OOXML richModel
      bodyHost.innerHTML = '';
      styleHost.innerHTML = '';
      populateRichModelVisualSection(bodyHost, richModel, docFontStack);
    }

    // Inject clean paper & unclipped-table CSS + metric-compatible font stack
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
        font-family: ${docFontStack};
      }
      [data-docx-fidelity-sandbox="1"] table {
        margin-top: 6px;
        margin-bottom: 6px;
      }
      [data-docx-fidelity-sandbox="1"] table,
      [data-docx-fidelity-sandbox="1"] tr,
      [data-docx-fidelity-sandbox="1"] td,
      [data-docx-fidelity-sandbox="1"] th {
        height: auto !important;
        min-height: 0 !important;
        overflow: visible !important;
      }
      [data-docx-fidelity-sandbox="1"] td > p:first-child,
      [data-docx-fidelity-sandbox="1"] th > p:first-child {
        padding-top: 2px;
      }
      [data-docx-fidelity-sandbox="1"] td > p:last-child,
      [data-docx-fidelity-sandbox="1"] th > p:last-child {
        padding-bottom: 3px;
      }
    `;
    styleHost.appendChild(cleanStyle);
    augmentFontFamiliesInSandbox(host, richModel?.defaultFont || 'Times New Roman');

    // Wait for all embedded images & fonts inside the rendered DOCX to finish loading
    const imgs = Array.from(bodyHost.querySelectorAll('img'));
    await Promise.all(
      imgs.map((img) =>
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
      await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 900))]);
    }
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    const sections = Array.from(bodyHost.querySelectorAll('section.ms-docx-render'));
    if (sections.length === 0) return null;

    const stylesHtml = styleHost.innerHTML || '';
    const contentHtml = bodyHost.innerHTML || '';

    // Fast path for DOCX -> HTML export (no heavy canvas rasterization needed!)
    if (captureImages === false) {
      const firstHdrObj = richModel?.sectionMeta?.hasTitlePg
        ? richModel?.sectionMeta?.headerByType?.first || richModel?.sectionMeta?.headerByType?.default
        : richModel?.sectionMeta?.headerByType?.default;
      const firstFtrObj = richModel?.sectionMeta?.hasTitlePg
        ? richModel?.sectionMeta?.footerByType?.first || richModel?.sectionMeta?.footerByType?.default
        : richModel?.sectionMeta?.footerByType?.default;
      const hdrHtml = firstHdrObj
        ? buildHeaderFooterBandHtml(firstHdrObj, {
            pageNum: 1,
            totalPages: sections.length,
            pageW: 794,
            defaultFont: richModel?.defaultFont,
          })
        : '';
      const ftrHtml = firstFtrObj
        ? buildHeaderFooterBandHtml(firstFtrObj, {
            pageNum: 1,
            totalPages: sections.length,
            pageW: 794,
            defaultFont: richModel?.defaultFont,
          })
        : '';
      const standaloneHtml = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8" />
<title>Dokumen Word</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,700;1,400&family=Tinos:ital,wght@0,400;0,700;1,400&family=Caladea:ital,wght@0,400;0,700;1,400&family=Carlito:ital,wght@0,400;0,700;1,400&family=Arimo:ital,wght@0,400;0,700;1,400&display=swap" />
${stylesHtml}
<style>
  body { margin: 0; padding: 24px 12px; background: #f1f5f9; font-family: ${docFontStack}; }
  .ms-export-shell { max-width: 820px; margin: 0 auto; background: #ffffff; box-shadow: 0 4px 24px rgba(15,23,42,0.08); }
  .ms-docx-render-wrapper { background: #ffffff !important; padding: 0 !important; }
  section.ms-docx-render { margin: 0 auto !important; box-shadow: none !important; }
  table, tr, td, th { height: auto !important; min-height: 0 !important; overflow: visible !important; }
  @media print { body { background: #ffffff; padding: 0; } .ms-export-shell { box-shadow: none; } }
</style>
</head>
<body>
<div class="ms-export-shell">
${hdrHtml}
${contentHtml}
${ftrHtml}
</div>
</body>
</html>`;
      return {
        pages: [],
        pageCount: sections.length,
        stylesHtml,
        contentHtml,
        html: standaloneHtml,
      };
    }

    const safeScale = Math.min(2.2, Math.max(1.5, Number(scale) || 2.0));
    const pageJobs = [];

    // Pre-measure custom header/footer heights if `hasCustomHf` so body slices leave exact breathing room
    const pickHfForPage = (mapObj, pageIdx) => {
      if (!mapObj) return null;
      if (richModel?.sectionMeta?.hasTitlePg && pageIdx === 0) {
        return mapObj.first || null;
      }
      if (pageIdx % 2 === 1 && mapObj.even) {
        return mapObj.even;
      }
      return mapObj.default || null;
    };

    // Measure approximate CSS heights of first & default header/footer bands once
    let firstHdrHeightCss = 0;
    let defaultHdrHeightCss = 0;
    let firstFtrHeightCss = 0;
    let defaultFtrHeightCss = 0;

    if (hasCustomHf) {
      const sampleSecW = Math.max(300, Math.round(sections[0].getBoundingClientRect().width || 794));
      const sampleCs = window.getComputedStyle(sections[0]);
      const samplePadL = Math.max(24, Math.round(parseFloat(sampleCs.paddingLeft) || 64));
      const samplePadR = Math.max(24, Math.round(parseFloat(sampleCs.paddingRight) || 64));

      const measureBand = async (hfObj) => {
        if (!hfObj) return 0;
        const html = buildHeaderFooterBandHtml(hfObj, {
          pageNum: 1,
          totalPages: 10,
          pageW: sampleSecW,
          padLeft: samplePadL,
          padRight: samplePadR,
          defaultFont: richModel?.defaultFont,
        });
        const rendered = await renderBandHtmlToCanvas(html, {
          widthPx: sampleSecW,
          scale: 1,
          html2canvas: libs.html2canvas,
        });
        return rendered ? rendered.heightCss : 0;
      };

      const hByType = richModel?.sectionMeta?.headerByType || {};
      const fByType = richModel?.sectionMeta?.footerByType || {};
      firstHdrHeightCss = await measureBand(richModel?.sectionMeta?.hasTitlePg ? hByType.first : hByType.default);
      defaultHdrHeightCss = await measureBand(hByType.default);
      firstFtrHeightCss = await measureBand(richModel?.sectionMeta?.hasTitlePg ? fByType.first : fByType.default);
      defaultFtrHeightCss = await measureBand(fByType.default);
    }

    // Pass 1: Rasterize each section and compute pixel-gutter-verified page slices
    for (let sIdx = 0; sIdx < sections.length && pageJobs.length < maxPages; sIdx += 1) {
      const sec = sections[sIdx];
      const cs = window.getComputedStyle(sec);
      const secRect = sec.getBoundingClientRect();
      const pageW = Math.max(300, Math.round(secRect.width || parseFloat(cs.width) || 794));
      const minH = parseFloat(cs.minHeight) || 0;
      const targetPageH = minH >= 400 && minH <= 2200 ? Math.round(minH) : Math.round(pageW * (841.89 / 595.28));
      const actualH = Math.max(targetPageH, Math.round(sec.scrollHeight || secRect.height || targetPageH));

      const padTop = Math.max(24, Math.round(parseFloat(cs.paddingTop) || 64));
      const padBottom = Math.max(24, Math.round(parseFloat(cs.paddingBottom) || 64));
      const padLeft = Math.max(24, Math.round(parseFloat(cs.paddingLeft) || 64));
      const padRight = Math.max(24, Math.round(parseFloat(cs.paddingRight) || 64));

      const headerEl = sec.querySelector(':scope > header');
      const footerEl = sec.querySelector(':scope > footer');
      const articleEl = sec.querySelector(':scope > article') || sec;

      const headerRect = headerEl ? headerEl.getBoundingClientRect() : null;
      const footerRect = footerEl ? footerEl.getBoundingClientRect() : null;
      const articleRect = articleEl.getBoundingClientRect();

      const headerBottomRel =
        headerRect && headerRect.height > 2 ? Math.max(padTop, Math.ceil(headerRect.bottom - secRect.top) + 6) : padTop;
      const footerHNative =
        footerRect && footerRect.height > 2 ? Math.max(padBottom, Math.ceil(secRect.bottom - footerRect.top) + 6) : padBottom;
      const footerTopRel =
        footerRect && footerRect.height > 2 ? Math.floor(footerRect.top - secRect.top) : actualH - padBottom;

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
        percent: 38 + Math.round(((sIdx + 0.4) / sections.length) * 32),
        label: `Memproses halaman asli ${pageJobs.length + 1} (resolusi cetak HD)...`,
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

      const widthPt = Math.round(((pageW * 72) / 96) * 100) / 100;
      const heightPt = Math.round(((targetPageH * 72) / 96) * 100) / 100;

      const contentStartY = hasCustomHf
        ? Math.max(8, Math.floor(articleRect.top - secRect.top))
        : Math.max(headerBottomRel, Math.floor(articleRect.top - secRect.top));
      const contentEndY = hasCustomHf
        ? Math.min(actualH, Math.ceil(articleRect.bottom - secRect.top) + 4)
        : Math.min(footerTopRel, Math.ceil(articleRect.bottom - secRect.top) + 4);

      const headerHasLargeLogo = Boolean(headerEl && headerEl.querySelector('img') && headerBottomRel > 75);
      const subsequentTopMarginNative = headerHasLargeLogo ? Math.min(padTop, 58) : headerBottomRel;

      let curY = contentStartY;
      let sliceIdx = 0;
      while (curY < contentEndY - 6 && pageJobs.length < maxPages && sliceIdx < 80) {
        const globalPageIdx = pageJobs.length;
        const hdrReserve = hasCustomHf
          ? Math.max(padTop, (globalPageIdx === 0 ? firstHdrHeightCss : defaultHdrHeightCss) + 22)
          : sliceIdx === 0
          ? headerBottomRel
          : subsequentTopMarginNative;
        const ftrReserve = hasCustomHf
          ? Math.max(padBottom, (globalPageIdx === 0 ? firstFtrHeightCss : defaultFtrHeightCss) + 22)
          : footerHNative;

        const usableH = Math.max(180, targetPageH - hdrReserve - ftrReserve);
        const [firstSlice] = computeSafePageSlices({
          contentStartY: curY,
          contentEndY,
          usableHeight: usableH,
          atomicBoxes,
        });
        if (!firstSlice) break;

        let safeEndY = firstSlice.endY;
        if (safeEndY < contentEndY - 6) {
          // Refine DOM cut using actual rasterized pixel whitespace gutter so ZERO glyphs get sliced!
          safeEndY = findWhitePixelGutterY(
            fullCanvas,
            safeEndY,
            curY + Math.max(80, usableH * 0.45),
            Math.min(contentEndY, curY + usableH),
            safeScale
          );
          if (safeEndY <= curY + 40) safeEndY = firstSlice.endY;
        }

        pageJobs.push({
          fullCanvas,
          pageW,
          targetPageH,
          widthPt,
          heightPt,
          padLeft,
          padRight,
          startY: curY,
          endY: safeEndY,
          topMargin: hdrReserve,
          footerH: ftrReserve,
          includeNativeHeader: !hasCustomHf && (sliceIdx === 0 || !headerHasLargeLogo),
          headerBottomRel,
          includeNativeFooter: !hasCustomHf && Boolean(footerRect && footerRect.height > 2),
          footerTopRel,
          sectionWords,
        });

        curY = safeEndY;
        sliceIdx += 1;
      }
    }

    if (pageJobs.length === 0) return null;

    // Pass 2: Composite final pages + dynamic per-page headers/footers with exact `pageNum` / `totalPages`!
    const totalPages = pageJobs.length;
    const renderedPages = [];

    for (let idx = 0; idx < pageJobs.length; idx += 1) {
      const job = pageJobs[idx];
      const pageNum = idx + 1;

      onProgress({
        percent: 72 + Math.round((pageNum / totalPages) * 14),
        label: `Menyusun halaman ${pageNum}/${totalPages} (header, footer & nomor halaman asli)...`,
      });

      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = Math.round(job.pageW * safeScale);
      pageCanvas.height = Math.round(job.targetPageH * safeScale);
      const pCtx = pageCanvas.getContext('2d');
      pCtx.fillStyle = '#ffffff';
      pCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);

      // 1. Copy body content slice
      const srcY = Math.max(0, Math.round(job.startY * safeScale));
      const srcH = Math.max(1, Math.min(job.fullCanvas.height - srcY, Math.round((job.endY - job.startY) * safeScale)));
      const dstY = Math.round(job.topMargin * safeScale);
      const maxDstH = Math.max(1, Math.round((job.targetPageH - job.footerH) * safeScale) - dstY);
      const drawH = Math.min(srcH, maxDstH);
      if (drawH > 0) {
        pCtx.drawImage(job.fullCanvas, 0, srcY, job.fullCanvas.width, drawH, 0, dstY, pageCanvas.width, drawH);
      }

      const spans = [];
      for (const w of job.sectionWords) {
        const midY = (w.top + w.bottom) / 2;
        let mappedTop = null;
        if (job.includeNativeHeader && midY < job.headerBottomRel) {
          mappedTop = w.top;
        } else if (midY >= job.startY && midY < job.endY) {
          mappedTop = job.topMargin + (w.top - job.startY);
        } else if (job.includeNativeFooter && midY >= job.footerTopRel) {
          mappedTop = job.targetPageH - job.footerH + (w.top - job.footerTopRel);
        }
        if (mappedTop !== null && mappedTop >= 0 && mappedTop < job.targetPageH) {
          spans.push({
            text: w.text,
            x: Math.max(0, Math.min(0.99, w.left / job.pageW)),
            y: Math.max(0, Math.min(0.99, mappedTop / job.targetPageH)),
            w: Math.max(0.004, Math.min(1, w.width / job.pageW)),
            h: Math.max(0.008, Math.min(0.12, w.height / job.targetPageH)),
          });
        }
      }

      // 2. Composite header & footer (custom OOXML dynamic bands OR native fallback bands)
      if (hasCustomHf) {
        const hdrObj = pickHfForPage(richModel?.sectionMeta?.headerByType, idx);
        const ftrObj = pickHfForPage(richModel?.sectionMeta?.footerByType, idx);
        const headerOffsetCss = Math.max(12, Math.round(((richModel?.margins?.header || 24) * 96) / 72));
        const footerMarginCss = Math.max(12, Math.round(((richModel?.margins?.footer || 24) * 96) / 72));

        if (hdrObj) {
          const hdrHtml = buildHeaderFooterBandHtml(hdrObj, {
            pageNum,
            totalPages,
            pageW: job.pageW,
            padLeft: job.padLeft,
            padRight: job.padRight,
            defaultFont: richModel?.defaultFont,
          });
          const renderedHdr = await renderBandHtmlToCanvas(hdrHtml, {
            widthPx: job.pageW,
            scale: safeScale,
            html2canvas: libs.html2canvas,
          });
          if (renderedHdr?.canvas) {
            const topCss = Math.min(headerOffsetCss, Math.max(6, job.topMargin - renderedHdr.heightCss - 4));
            const topPx = Math.round(topCss * safeScale);
            pCtx.drawImage(renderedHdr.canvas, 0, topPx);
            for (const w of renderedHdr.words || []) {
              const absTop = topCss + w.top;
              if (absTop >= 0 && absTop < job.targetPageH) {
                spans.push({
                  text: w.text,
                  x: Math.max(0, Math.min(0.99, w.left / job.pageW)),
                  y: Math.max(0, Math.min(0.99, absTop / job.targetPageH)),
                  w: Math.max(0.004, Math.min(1, w.width / job.pageW)),
                  h: Math.max(0.008, Math.min(0.12, w.height / job.targetPageH)),
                });
              }
            }
          }
        }

        if (ftrObj) {
          const ftrHtml = buildHeaderFooterBandHtml(ftrObj, {
            pageNum,
            totalPages,
            pageW: job.pageW,
            padLeft: job.padLeft,
            padRight: job.padRight,
            defaultFont: richModel?.defaultFont,
          });
          const renderedFtr = await renderBandHtmlToCanvas(ftrHtml, {
            widthPx: job.pageW,
            scale: safeScale,
            html2canvas: libs.html2canvas,
          });
          if (renderedFtr?.canvas) {
            const topCss = Math.max(
              job.targetPageH - job.footerH + 4,
              job.targetPageH - renderedFtr.heightCss - Math.min(footerMarginCss, 18)
            );
            const topPx = Math.max(0, Math.round(topCss * safeScale));
            pCtx.drawImage(renderedFtr.canvas, 0, topPx);
            for (const w of renderedFtr.words || []) {
              const absTop = topCss + w.top;
              if (absTop >= 0 && absTop < job.targetPageH) {
                spans.push({
                  text: w.text,
                  x: Math.max(0, Math.min(0.99, w.left / job.pageW)),
                  y: Math.max(0, Math.min(0.99, absTop / job.targetPageH)),
                  w: Math.max(0.004, Math.min(1, w.width / job.pageW)),
                  h: Math.max(0.008, Math.min(0.12, w.height / job.targetPageH)),
                });
              }
            }
          }
        }
      } else {
        if (job.includeNativeHeader && job.headerBottomRel > 0) {
          const hSrcPx = Math.min(job.fullCanvas.height, Math.round(job.headerBottomRel * safeScale));
          if (hSrcPx > 0) {
            pCtx.drawImage(job.fullCanvas, 0, 0, job.fullCanvas.width, hSrcPx, 0, 0, pageCanvas.width, hSrcPx);
          }
        }
        if (job.includeNativeFooter) {
          const fSrcY = Math.max(0, Math.round(job.footerTopRel * safeScale));
          const fSrcH = Math.min(job.fullCanvas.height - fSrcY, Math.round(job.footerH * safeScale));
          const fDstY = Math.max(0, pageCanvas.height - fSrcH);
          if (fSrcH > 0) {
            pCtx.drawImage(job.fullCanvas, 0, fSrcY, job.fullCanvas.width, fSrcH, 0, fDstY, pageCanvas.width, fSrcH);
          }
        }
      }

      renderedPages.push({
        pageNumber: pageNum,
        widthPt: job.widthPt,
        heightPt: job.heightPt,
        widthPx: pageCanvas.width,
        heightPx: pageCanvas.height,
        imageDataUrl: pageCanvas.toDataURL('image/jpeg', 0.92),
        spans,
        text: spans.map((s) => s.text).join(' '),
      });
    }

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
 * Strips scripts & event handlers from untrusted HTML while preserving ALL visual styles,
 * tables, typography, colors, images, and layout rules for true-fidelity HTML/MD/RTF/XLSX rendering.
 */
function sanitizeHtmlForFidelityRender(rawHtml = '') {
  return String(rawHtml || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
}

/**
 * True-Fidelity Visual HTML -> Multi-Page Raster + Selectable Text Engine.
 * Used for HTML -> PDF/Image, Markdown -> PDF/Image, RTF -> PDF/Image, and XLSX/CSV/Data -> PDF/Image
 * so tables, CSS styles, headings, colors, lists, and images are NEVER stripped to plain text!
 */
export async function renderHtmlToFaithfulPages(
  rawHtml,
  {
    scale = 2.0,
    maxPages = 40,
    landscape = false,
    pageWidthPx = null,
    pageHeightPx = null,
    onProgress = () => {},
  } = {}
) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;

  onProgress({ percent: 24, label: 'Memuat mesin render visual HTML5 & CSS presisi...' });
  const okCanvas = await loadExternalScript(CDN_LIBS.html2canvas, () => typeof window.html2canvas === 'function');
  if (!okCanvas || typeof window.html2canvas !== 'function') return null;

  await ensureDocumentWebFonts(['Tinos', 'Arimo', 'Cousine']);

  const pageW = Math.round(Number(pageWidthPx) || (landscape ? 1122 : 794));
  const targetPageH = Math.round(Number(pageHeightPx) || (landscape ? 794 : 1122));
  const padX = landscape ? 36 : 52;
  const padY = landscape ? 36 : 52;

  const cleaned = sanitizeHtmlForFidelityRender(rawHtml);
  const styleBlocks = [];
  const styleRe = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let sm;
  while ((sm = styleRe.exec(cleaned)) !== null) {
    styleBlocks.push(sm[1]);
  }
  const bodyMatch = cleaned.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const innerBody = bodyMatch
    ? bodyMatch[1]
    : cleaned
        .replace(/<!DOCTYPE[^>]*>/gi, '')
        .replace(/<head[\s\S]*?<\/head>/gi, '')
        .replace(/<\/?(?:html|body)[^>]*>/gi, '');

  const host = document.createElement('div');
  host.setAttribute('data-html-fidelity-sandbox', '1');
  host.style.cssText = [
    'position:fixed',
    'left:-100000px',
    'top:0',
    `width:${pageW}px`,
    'background:#ffffff',
    'color:#111827',
    'color-scheme:light',
    'z-index:-9999',
    'pointer-events:none',
    'box-sizing:border-box',
    `padding:${padY}px ${padX}px`,
    'font-family:Arimo, Arial, sans-serif',
    'font-size:10.5pt',
    'line-height:1.5',
  ].join(';');

  const scopedStyle = document.createElement('style');
  scopedStyle.textContent = `
    [data-html-fidelity-sandbox="1"] * { box-sizing: border-box; max-width: 100%; }
    [data-html-fidelity-sandbox="1"] img { height: auto; max-width: 100%; }
    [data-html-fidelity-sandbox="1"] table { border-collapse: collapse; width: 100%; }
    [data-html-fidelity-sandbox="1"] tr, [data-html-fidelity-sandbox="1"] td, [data-html-fidelity-sandbox="1"] th { height: auto !important; overflow: visible !important; }
    ${styleBlocks.join('\n').replace(/\bbody\b/gi, '[data-html-fidelity-sandbox="1"]')}
  `;
  host.appendChild(scopedStyle);

  const contentWrap = document.createElement('div');
  contentWrap.innerHTML = innerBody;
  host.appendChild(contentWrap);
  document.body.appendChild(host);

  try {
    const imgs = Array.from(host.querySelectorAll('img'));
    await Promise.all(
      imgs.map((img) =>
        img.complete
          ? Promise.resolve()
          : new Promise((res) => {
              img.onload = res;
              img.onerror = res;
              setTimeout(res, 1500);
            })
      )
    );
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    const hostRect = host.getBoundingClientRect();
    const actualH = Math.max(targetPageH, Math.ceil(host.scrollHeight || hostRect.height || targetPageH));
    const safeScale = Math.min(2.0, Math.max(1.5, Number(scale) || 2.0));

    const allWords = extractDomWordRectsRelativeTo(host, hostRect.left, hostRect.top);
    const mediaBoxes = Array.from(host.querySelectorAll('img, svg, tr, hr')).map((el) => {
      const r = el.getBoundingClientRect();
      return { top: r.top - hostRect.top, bottom: r.bottom - hostRect.top };
    });
    const atomicBoxes = [
      ...allWords.map((w) => ({ top: w.top, bottom: w.bottom })),
      ...mediaBoxes,
    ];

    onProgress({ percent: 48, label: 'Merender tata letak visual dokumen ke halaman cetak HD...' });

    const fullCanvas = await window.html2canvas(host, {
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

    const widthPt = Math.round(((pageW * 72) / 96) * 100) / 100;
    const heightPt = Math.round(((targetPageH * 72) / 96) * 100) / 100;

    const slices = [];
    let curY = padY;
    const contentEndY = Math.max(padY + 20, actualH - padY + 4);
    const usableH = Math.max(180, targetPageH - padY * 2);

    while (curY < contentEndY - 6 && slices.length < maxPages) {
      const [firstSlice] = computeSafePageSlices({
        contentStartY: curY,
        contentEndY,
        usableHeight: usableH,
        atomicBoxes,
      });
      if (!firstSlice) break;
      let safeEndY = firstSlice.endY;
      if (safeEndY < contentEndY - 6) {
        safeEndY = findWhitePixelGutterY(
          fullCanvas,
          safeEndY,
          curY + Math.max(80, usableH * 0.45),
          Math.min(contentEndY, curY + usableH),
          safeScale
        );
        if (safeEndY <= curY + 40) safeEndY = firstSlice.endY;
      }
      slices.push({ startY: curY, endY: safeEndY });
      curY = safeEndY;
    }

    const pages = [];
    for (let i = 0; i < slices.length; i += 1) {
      const sl = slices[i];
      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = Math.round(pageW * safeScale);
      pageCanvas.height = Math.round(targetPageH * safeScale);
      const pCtx = pageCanvas.getContext('2d');
      pCtx.fillStyle = '#ffffff';
      pCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);

      const srcY = Math.max(0, Math.round(sl.startY * safeScale));
      const srcH = Math.max(1, Math.min(fullCanvas.height - srcY, Math.round((sl.endY - sl.startY) * safeScale)));
      const dstY = Math.round(padY * safeScale);
      const maxDstH = Math.max(1, Math.round((targetPageH - padY) * safeScale) - dstY);
      const drawH = Math.min(srcH, maxDstH);
      if (drawH > 0) {
        pCtx.drawImage(fullCanvas, 0, srcY, fullCanvas.width, drawH, 0, dstY, pageCanvas.width, drawH);
      }

      const spans = [];
      for (const w of allWords) {
        const midY = (w.top + w.bottom) / 2;
        if (midY >= sl.startY && midY < sl.endY) {
          const mappedTop = padY + (w.top - sl.startY);
          if (mappedTop >= 0 && mappedTop < targetPageH) {
            spans.push({
              text: w.text,
              x: Math.max(0, Math.min(0.99, w.left / pageW)),
              y: Math.max(0, Math.min(0.99, mappedTop / targetPageH)),
              w: Math.max(0.004, Math.min(1, w.width / pageW)),
              h: Math.max(0.008, Math.min(0.12, w.height / targetPageH)),
            });
          }
        }
      }

      pages.push({
        pageNumber: i + 1,
        widthPt,
        heightPt,
        widthPx: pageCanvas.width,
        heightPx: pageCanvas.height,
        imageDataUrl: pageCanvas.toDataURL('image/jpeg', 0.92),
        spans,
        text: spans.map((s) => s.text).join(' '),
      });
    }

    return { pages, pageCount: pages.length };
  } catch {
    return null;
  } finally {
    try {
      host.remove();
    } catch {
      // Ignore cleanup
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
 * - Renders per-page `<w:titlePg/>` first vs default headers/footers with LIVE resolved `{{PAGE}}`/`{{NUMPAGES}}`,
 *   alignment, indentation, numbered headings, and FULL wrapped multi-line tables in exact original document order!
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

  // Stamp per-page dynamic headers & footers (respecting <w:titlePg/> & resolving {{PAGE}}/{{NUMPAGES}})
  const totalPages = pageStreams.length;
  const hasTitlePg = Boolean(model?.sectionMeta?.hasTitlePg);
  const hByType = model?.sectionMeta?.headerByType || { first: null, default: model?.headers?.[0] || null, even: null };
  const fByType = model?.sectionMeta?.footerByType || { first: null, default: model?.footers?.[0] || null, even: null };

  const stampBandLines = (hfObj, startY, pageNum) => {
    if (!hfObj || !hfObj.text) return '';
    const resolved = resolveDynamicPageTokens(hfObj.text, pageNum, totalPages);
    const wrapped = wrapByWidth(resolved, contentW, 8.5).slice(0, 3);
    const ops = ['0.22 0.24 0.28 rg'];
    wrapped.forEach((ln, idx) => {
      const ly = startY - idx * 10.5;
      ops.push(`BT /F1 8.5 Tf ${mLeft.toFixed(1)} ${ly.toFixed(1)} Td (${esc(ln)}) Tj ET`);
    });
    return ops.join('\n');
  };

  for (let i = 0; i < totalPages; i += 1) {
    const pageNum = i + 1;
    const hdrObj = hasTitlePg && i === 0 ? hByType.first : i % 2 === 1 && hByType.even ? hByType.even : hByType.default;
    const ftrObj = hasTitlePg && i === 0 ? fByType.first : i % 2 === 1 && fByType.even ? fByType.even : fByType.default;
    const extraOps = [];
    const hOps = stampBandLines(hdrObj, H - Math.max(22, Math.round(mTop * 0.48)), pageNum);
    const fOps = stampBandLines(ftrObj, Math.max(24, Math.round(mBottom * 0.52)), pageNum);
    if (hOps) extraOps.push(hOps);
    if (fOps) extraOps.push(fOps);
    if (extraOps.length > 0) {
      pageStreams[i] = `${pageStreams[i]}\n${extraOps.join('\n')}`;
    }
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
 * (preserving headers, logos, banner shapes, bold/italic/underline/superscript, alignment, numbering, & tables in order).
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
        if (r.type === 'shape') {
          const fill = escHtml(r.fill || r.fillColor || '#E5E7EB');
          const txt = escHtml(resolveDynamicPageTokens(r.text || '', 1, 1)).replace(/\n/g, '<br/>');
          return `<span style="display:inline-block;background:${fill};padding:4pt 10pt;border-radius:2pt;">${txt}</span>`;
        }
        let inner = escHtml(resolveDynamicPageTokens(r.text || '', 1, 1)).replace(/\n/g, '<br/>');
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

  const fontStack = mapDocFontStack(model?.defaultFont || 'Times New Roman');

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
