import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALL_TARGET_FORMATS,
  convertAnyFile,
  createZipArchive,
  extractTextFromPdfBuffer,
  extractZipEntries,
  formatTargetOptionDisplay,
  parseDocxBuffer,
} from './converter.js';
import {
  buildFaithfulHtmlFromRichModel,
  buildFaithfulPureJsPdfFromRichModel,
  computeSafePageSlices,
  normalizeTypographyForPdf,
  parseDocxRichModel,
} from './docx-fidelity.js';
import { extractTextFromAnyFile } from './plagiarism-engine.js';
import { buildTurnitinPdfBytes } from './plagiarism-report.js';

/**
 * Builds a realistic academic journal .docx archive mimicking the user's attached journal:
 * - Header with journal name + embedded PNG logo
 * - Footer with CC-BY-NC-SA license
 * - Centered title & author with superscript
 * - Bordered multi-paragraph ABSTRAK table positioned RIGHT BELOW authors (before section 1)
 * - Numbered headings via word/numbering.xml ("1. Pendahuluan", "2. Metode")
 * - Mendeley/Word <w:sdt> citation "(Prakoso Aji, 2021)"
 * - Smart quotes (“komunikasi digital”) and en-dash (2020–2025)
 * - References section at the bottom
 */
function buildAcademicJournalDocxBuffer() {
  // Minimal valid 1x1 PNG (67 bytes)
  const pngBytes = Uint8Array.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, 0x00, 0x00, 0x00,
    0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
    0x00, 0x03, 0x01, 0x01, 0x00, 0x18, 0xdd, 0x8d, 0xb0, 0x00, 0x00, 0x00,
    0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
  ]);

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
  <Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>
  <Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>
</Types>`;

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const docRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdImg1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/logo.png"/>
  <Relationship Id="rIdHdr1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>
  <Relationship Id="rIdFtr1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>
</Relationships>`;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="22"/></w:rPr></w:rPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:rPr><w:b/><w:sz w:val="26"/></w:rPr>
  </w:style>
</w:styles>`;

  const numberingXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:abstractNum w:abstractNumId="1">
    <w:lvl w:ilvl="0">
      <w:start w:val="1"/>
      <w:numFmt w:val="decimal"/>
      <w:lvlText w:val="%1."/>
    </w:lvl>
  </w:abstractNum>
  <w:num w:numId="1">
    <w:abstractNumId w:val="1"/>
  </w:num>
</w:numbering>`;

  const headerXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:p><w:r><w:t>SJC · Jurnal Ilmu Komunikasi (ISSN 2775-1234)</w:t></w:r></w:p>
</w:hdr>`;

  const footerXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:p><w:r><w:t>Open Access · Lisensi CC-BY-NC-SA 4.0</w:t></w:r></w:p>
</w:ftr>`;

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <w:body>
    <w:p>
      <w:pPr><w:jc w:val="center"/></w:pPr>
      <w:r><w:drawing><a:blip r:embed="rIdImg1"/></w:drawing></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:pStyle w:val="Title"/><w:jc w:val="center"/></w:pPr>
      <w:r><w:rPr><w:b/></w:rPr><w:t>Transformasi Ruang Publik Digital di Era Media Sosial</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:jc w:val="center"/></w:pPr>
      <w:r><w:t>Pradnya Putri</w:t></w:r>
      <w:r><w:rPr><w:vertAlign w:val="superscript"/></w:rPr><w:t>1</w:t></w:r>
    </w:p>
    <w:tbl>
      <w:tr>
        <w:tc>
          <w:p><w:r><w:rPr><w:b/></w:rPr><w:t>ABSTRAK</w:t></w:r></w:p>
          <w:p><w:r><w:t>Penelitian ini membahas dinamika komunikasi politik digital pada rentang 2020–2025 secara mendalam. Paragraf kedua abstrak ini sangat panjang untuk memastikan isi tabel tidak pernah terpotong menjadi satu baris saja melainkan terbungkus utuh sampai kalimat terakhir abstrak.</w:t></w:r></w:p>
        </w:tc>
      </w:tr>
    </w:tbl>
    <w:p>
      <w:pPr><w:pStyle w:val="Heading1"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr>
      <w:r><w:t>Pendahuluan</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:jc w:val="both"/></w:pPr>
      <w:r><w:t>Fenomena “komunikasi digital” mendorong aktivisme politik </w:t></w:r>
      <w:sdt>
        <w:sdtContent>
          <w:r><w:t>(Prakoso Aji, 2021)</w:t></w:r>
        </w:sdtContent>
      </w:sdt>
      <w:r><w:t> secara partisipatif di ruang publik.</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:pStyle w:val="Heading1"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr>
      <w:r><w:t>Daftar Pustaka</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>Prakoso Aji, R. (2021). Ruang Publik dan Demokrasi Digital. Jurnal Komunikasi Nusantara, 12(2), 45–60.</w:t></w:r>
    </w:p>
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  return createZipArchive([
    { name: '[Content_Types].xml', data: contentTypesXml },
    { name: '_rels/.rels', data: rootRelsXml },
    { name: 'word/_rels/document.xml.rels', data: docRelsXml },
    { name: 'word/styles.xml', data: stylesXml },
    { name: 'word/numbering.xml', data: numberingXml },
    { name: 'word/header1.xml', data: headerXml },
    { name: 'word/footer1.xml', data: footerXml },
    { name: 'word/document.xml', data: documentXml },
    { name: 'word/media/logo.png', data: pngBytes },
  ]);
}

test('v100: parseDocxRichModel & parseDocxBuffer preserve exact block order, <w:sdt> citations, numbering, headers/footers, logo, and full multi-paragraph ABSTRAK table', async () => {
  const docxBuf = buildAcademicJournalDocxBuffer();
  const model = await parseDocxRichModel(docxBuf, extractZipEntries);

  assert.equal(model.headerLines.some((l) => l.includes('SJC')), true, 'Header text should be extracted');
  assert.equal(model.footerLines.some((l) => l.includes('CC-BY-NC-SA')), true, 'Footer text should be extracted');

  const tableIdx = model.blocks.findIndex((b) => b.type === 'table');
  const introIdx = model.blocks.findIndex((b) => b.plain && b.plain.includes('Pendahuluan'));
  const refIdx = model.blocks.findIndex((b) => b.plain && b.plain.includes('Daftar Pustaka'));

  assert.ok(tableIdx >= 0, 'ABSTRAK table must be preserved');
  assert.ok(introIdx > tableIdx, `ABSTRAK table (idx ${tableIdx}) must remain BEFORE 1. Pendahuluan (idx ${introIdx}), never moved to the end`);
  assert.ok(refIdx > introIdx, 'References section must remain after Pendahuluan');

  // Verify automatic Word numbering from numbering.xml
  assert.equal(model.blocks[introIdx].plain, '1. Pendahuluan');
  assert.equal(model.blocks[refIdx].plain, '2. Daftar Pustaka');

  // Verify <w:sdt> Mendeley/Word citation is preserved completely
  assert.equal(model.plainText.includes('(Prakoso Aji, 2021)'), true, 'Must preserve <w:sdt> citation');

  // Verify ABSTRAK table cell is NOT truncated (both rich cell object and plainRows string matrix)
  const abstrakCell = model.blocks[tableIdx].plainRows[0][0];
  assert.equal(abstrakCell.includes('sampai kalimat terakhir abstrak'), true, 'ABSTRAK cell must not be truncated');

  // Verify embedded PNG logo was resolved
  const hasLogo = model.blocks.some((b) => Array.isArray(b.runs) && b.runs.some((r) => r.type === 'image' && r.src.startsWith('data:image/png;base64,')));
  assert.equal(hasLogo, true, 'Embedded PNG logo must be resolved as data URL');

  // Verify parseDocxBuffer retains backward-compatible { paragraphs, tables } AND rich { blocks, model }
  const parsed = await parseDocxBuffer(docxBuf);
  assert.ok(parsed.paragraphs.length >= 4);
  assert.equal(parsed.tables.length, 1);
  assert.equal(typeof parsed.tables[0][0][0], 'string', 'parsed.tables cells must be strings, never [object Object]');
  assert.equal(parsed.tables[0][0][0].includes('sampai kalimat terakhir abstrak'), true);
  assert.ok(Array.isArray(parsed.blocks) && parsed.blocks.length >= 6);
});

test('v100: DOCX -> PDF and DOCX -> HTML preserve original document content without fake Manifestudio banner/footer or truncated tables', async () => {
  const docxBuf = buildAcademicJournalDocxBuffer();
  const docxFile = new File([docxBuf], 'Jurnal_Pradnya_Putri-JSC.docx', {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });

  const pdfRes = await convertAnyFile(docxFile, { targetFormat: 'pdf' });
  assert.equal(pdfRes.verified, true);
  assert.equal(pdfRes.targetFormat, 'PDF');

  const pdfLines = extractTextFromPdfBuffer(await pdfRes.blob.arrayBuffer());
  const pdfJoined = pdfLines.join(' ');

  assert.equal(pdfJoined.includes('Manifestudio Universal File Converter'), false, 'Converted PDF must NOT inject fake Manifestudio footer');
  assert.equal(pdfJoined.includes('Dikonversi dengan Manifestudio'), false, 'Converted PDF must NOT inject fake Manifestudio header banner');
  assert.equal(pdfJoined.includes('(Prakoso Aji, 2021)'), true, 'Converted PDF must keep <w:sdt> citations');
  assert.equal(pdfJoined.includes('1. Pendahuluan'), true, 'Converted PDF must keep section numbering');
  assert.equal(pdfJoined.includes('sampai kalimat terakhir abstrak'), true, 'Converted PDF must wrap full ABSTRAK table without truncating');
  assert.equal(pdfJoined.includes('"komunikasi digital"'), true, 'Converted PDF must normalize smart quotes cleanly');
  assert.equal(pdfJoined.includes('2020-2025'), true, 'Converted PDF must normalize en-dash cleanly');
  assert.equal(pdfJoined.includes('Jurnal Komunikasi Nusantara'), true, 'Converted PDF must keep References section');

  // Order check in extracted PDF text: ABSTRAK appears BEFORE 1. Pendahuluan
  assert.ok(
    pdfJoined.indexOf('ABSTRAK') < pdfJoined.indexOf('1. Pendahuluan'),
    'ABSTRAK table must appear BEFORE 1. Pendahuluan in converted PDF'
  );

  // Faithful HTML check
  const htmlRes = await convertAnyFile(docxFile, { targetFormat: 'html' });
  const htmlText = await htmlRes.blob.text();
  assert.equal(htmlText.includes('data:image/png;base64,'), true, 'HTML output should embed original logo image');
  assert.equal(htmlText.includes('(Prakoso Aji, 2021)'), true, 'HTML output should preserve citations');
  assert.ok(htmlText.indexOf('<table') < htmlText.indexOf('1. Pendahuluan'), 'HTML output should keep table in exact order');
});

test('v100: computeSafePageSlices never slices horizontally through an atomic text line or image box', () => {
  const atomicBoxes = [
    { top: 100, bottom: 130 },
    { top: 985, bottom: 1020 }, // Straddles nominal slice boundary at y=1000!
    { top: 1030, bottom: 1060 },
    { top: 1990, bottom: 2030 }, // Straddles second boundary!
    { top: 2400, bottom: 2440 },
  ];
  const slices = computeSafePageSlices({
    contentStartY: 0,
    contentEndY: 2500,
    usableHeight: 1000,
    atomicBoxes,
  });
  assert.ok(slices.length >= 3);
  for (const s of slices) {
    for (const box of atomicBoxes) {
      const cutsThrough = s.endY > box.top + 1 && s.endY < box.bottom - 1 && s.endY < 2500;
      assert.equal(cutsThrough, false, `Slice endY ${s.endY} must not cut through box [${box.top}, ${box.bottom}]`);
    }
  }
});

test('v100: Plagiarism engine DOCX extraction preserves <w:sdt> citations, order, full tables & smart typography', async () => {
  const docxBuf = buildAcademicJournalDocxBuffer();
  const docxFile = new File([docxBuf], 'Jurnal_Pradnya_Putri-JSC.docx', {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });

  const extracted = await extractTextFromAnyFile(docxFile);
  assert.equal(extracted.fileFormat, 'DOCX');
  assert.equal(extracted.text.includes('(Prakoso Aji, 2021)'), true, 'Plagiarism extracted text must preserve <w:sdt> citation');
  assert.equal(extracted.text.includes('sampai kalimat terakhir abstrak'), true, 'Plagiarism extracted text must preserve full ABSTRAK');
  assert.ok(
    extracted.text.indexOf('ABSTRAK') < extracted.text.indexOf('1. Pendahuluan'),
    'Plagiarism extracted text must keep ABSTRAK before 1. Pendahuluan'
  );
  assert.ok(extracted.originalSource && Array.isArray(extracted.originalSource.pages) && extracted.originalSource.pages.length >= 1);

  const normalized = normalizeTypographyForPdf('“Uji” — 2020–2025…');
  assert.equal(normalized, '"Uji" - 2020-2025...');

  // Verify synchronous Turnitin PDF builder also preserves quotes & dashes cleanly
  const pdfBytes = buildTurnitinPdfBytes({
    submissionId: 'MS-PLG-TEST100',
    fileName: 'Jurnal_Pradnya_Putri-JSC.docx',
    fileFormat: 'DOCX',
    similarityPct: 6,
    internetPct: 6,
    publicationsPct: 0,
    studentPapersPct: 0,
    totalWords: 120,
    eligibleWords: 110,
    totalChars: 800,
    primarySources: [],
    annotatedSentences: [{ text: 'Fenomena “komunikasi digital” pada 2020–2025 (Prakoso Aji, 2021).', matched: false }],
    originalSource: extracted.originalSource,
  });
  const extractedPdfText = extractTextFromPdfBuffer(pdfBytes.buffer).join(' ');
  assert.equal(extractedPdfText.includes('"komunikasi digital"'), true);
  assert.equal(extractedPdfText.includes('(Prakoso Aji, 2021)'), true);
  assert.equal(extractedPdfText.includes('2020-2025'), true);
});

test('v100: formatTargetOptionDisplay produces clean, non-redundant labels with zero garbled arrow or \'n characters across all 30 target formats', () => {
  assert.ok(ALL_TARGET_FORMATS.length >= 25);
  for (const item of ALL_TARGET_FORMATS) {
    const d = formatTargetOptionDisplay(item);
    assert.equal(d.extBadge, `.${item.id.toUpperCase()}`);
    assert.equal(d.name.includes('→'), false, `Name for ${item.id} must not contain →`);
    assert.equal(d.name.includes("'n"), false, `Name for ${item.id} must not contain 'n`);
    assert.equal(d.desc.includes('→'), false, `Desc for ${item.id} must not contain →`);
    assert.equal(d.name.includes(`(.${item.id})`), false, `Name for ${item.id} must not duplicate (.${item.id})`);
    assert.ok(d.name.length > 0 && d.desc.length > 0 && d.group.length > 0);
  }
});
