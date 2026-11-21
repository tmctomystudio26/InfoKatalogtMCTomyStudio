import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PLAGIARISM_DEMO_TEXT,
  analyzeStylometricAiSignals,
  applyReportFilters,
  assessExtractedTextQuality,
  buildPlagiarismDownloadFilename,
  buildPlagiarismSearchQueries,
  detectDocumentLanguage,
  detectInternalSelfDuplication,
  extractReadableTextFromBinaryBytes,
  fusePlagiarismReport,
  parseAiPlagiarismAuditJson,
  reconstructOpenAlexAbstract,
  scoreSentenceAgainstSource,
  segmentDocumentSentences,
  stripHtmlOrXmlToPlainText,
  stripRtfToPlainText,
} from './plagiarism-logic.js';
import {
  buildTurnitinPdfBytes,
  generateTurnitinHtmlReport,
  generateTurnitinJsonReport,
} from './plagiarism-report.js';

test('segmentDocumentSentences preserves offsets, handles ID/EN abbreviations, quotes, and bibliography', () => {
  const sample = `Menurut Dr. Budi Santoso dkk. penelitian AI di Indonesia meningkat 3.14 kali lipat. "Pendidikan adalah kunci kemajuan bangsa Indonesia" (Mandela, 2003).\n\nDaftar Pustaka\nMandela, N. (2003). Pendidikan dan Masa Depan.`;
  const sents = segmentDocumentSentences(sample);
  assert.ok(sents.length >= 3, 'Should segment into at least 3 blocks');
  assert.ok(sents[0].text.includes('Dr. Budi Santoso dkk.'), 'Must not split on Dr. or dkk.');
  assert.ok(sents[0].text.includes('3.14'), 'Must not split on decimal 3.14');
  assert.equal(sents[1].isQuote, true, 'Direct quote sentence should be flagged isQuote=true');
  assert.equal(sents[1].hasCitation, true, 'APA inline citation should be detected');
  const bibSents = sents.filter((s) => s.isBibliography);
  assert.ok(bibSents.length >= 1, 'Bibliography section lines must be flagged isBibliography=true');
});

test('scoreSentenceAgainstSource detects exact verbatim copy vs completely original text', () => {
  const sents = segmentDocumentSentences(PLAGIARISM_DEMO_TEXT);
  const wikiIdSource =
    'Kecerdasan buatan atau Akal Imitasi (dari bahasa Inggris: artificial intelligence atau AI) adalah kemampuan sistem komputasi untuk melaksanakan tugas-tugas yang umumnya dikaitkan dengan kecerdasan manusia, seperti pembelajaran, penalaran, pemecahan masalah, persepsi, dan pengambilan keputusan.';
  const exactRes = scoreSentenceAgainstSource(sents[0], wikiIdSource);
  assert.equal(exactRes.matchType, 'exact');
  assert.ok(exactRes.score >= 0.75, `Expected high score for exact copy, got ${exactRes.score}`);

  const originalSentence = sents.find((s) => s.text.includes('pengamatan langsung kami di kelas praktikum'));
  assert.ok(originalSentence);
  const origRes = scoreSentenceAgainstSource(originalSentence, wikiIdSource);
  assert.equal(origRes.score, 0, 'Unrelated original sentence must score 0 against Wikipedia AI definition');
});

test('fusePlagiarismReport unifies multiple APIs + Multi-AI + Turnitin and live filters recalculate cleanly', () => {
  const report = fusePlagiarismReport({
    text: PLAGIARISM_DEMO_TEXT,
    fileName: 'Skripsi_AI_2026.docx',
    fileFormat: 'DOCX',
    fileSize: 42000,
    candidates: [
      {
        title: 'Kecerdasan buatan — Wikipedia (ID)',
        url: 'https://id.wikipedia.org/wiki/Kecerdasan_buatan',
        category: 'internet',
        engine: 'Wikipedia ID',
        content:
          'Kecerdasan buatan atau Akal Imitasi (dari bahasa Inggris: artificial intelligence atau AI) adalah kemampuan sistem komputasi untuk melaksanakan tugas-tugas yang umumnya dikaitkan dengan kecerdasan manusia, seperti pembelajaran, penalaran, pemecahan masalah, persepsi, dan pengambilan keputusan.',
      },
      {
        title: 'Machine learning — Academic Survey',
        url: 'https://doi.org/10.1000/ml-survey',
        doi: '10.1000/ml-survey',
        category: 'publication',
        engine: 'OpenAlex',
        content:
          'Machine learning is a field of study in artificial intelligence concerned with the development and study of statistical algorithms that can learn from data and generalize to unseen data, and thus perform tasks without explicit instructions.',
      },
    ],
    aiAudits: [
      {
        providerLabel: 'ChatGPT + Gemini',
        parsed: parseAiPlagiarismAuditJson(
          JSON.stringify({
            semanticPlagiarismScore: 42,
            aiWritingScore: 34,
            summary: 'Ditemukan dua segmen definisi ensiklopedia verbatim dan bagian pengamatan orisinal.',
            flaggedSentences: [
              {
                index: 0,
                type: 'exact',
                confidence: 92,
                suspectedSource: 'Wikipedia ID',
                reason: 'Definisi disalin langsung dari ensiklopedia daring.',
                suggestion: 'Rumuskan ulang definisi kecerdasan buatan dengan sudut pandang riset Anda.',
              },
            ],
            recommendations: ['Parafrase paragraf pembuka secara mandiri.'],
          })
        ),
      },
    ],
    options: { excludeQuotes: false, excludeBibliography: true, excludeSmallWords: 0 },
  });

  assert.ok(report.similarityPct >= 20 && report.similarityPct <= 85, `Unexpected fused similarity: ${report.similarityPct}%`);
  assert.ok(report.internetPct > 0, 'Internet sources percentage should be > 0');
  assert.ok(report.publicationsPct > 0, 'Publications percentage should be > 0');
  assert.equal(report.primarySources.length, 2, 'Should rank both deduplicated sources');
  assert.equal(report.primarySources[0].rank, 1);
  assert.ok(report.primarySources[0].colorHex.startsWith('#'));

  // Test live Turnitin filter exclusion of large threshold reduces matches
  const strictFiltered = applyReportFilters(report, { excludeSmallWords: 25, excludeQuotes: true, excludeBibliography: true });
  assert.ok(strictFiltered.similarityPct <= report.similarityPct);
  assert.equal(strictFiltered.filters.excludeQuotes, true);
});

test('detectInternalSelfDuplication catches copy-pasted internal paragraphs', () => {
  const dupText =
    'Pemanfaatan teknologi pembelajaran adaptif berbasis kecerdasan buatan meningkatkan partisipasi siswa di sekolah menengah secara terukur. ' +
    'Hasil wawancara guru menunjukkan antusiasme tinggi selama uji coba lapangan. ' +
    'Pemanfaatan teknologi pembelajaran adaptif berbasis kecerdasan buatan meningkatkan partisipasi siswa di sekolah menengah secara terukur.';
  const sents = segmentDocumentSentences(dupText);
  const dups = detectInternalSelfDuplication(sents);
  assert.equal(dups.length, 1);
  assert.equal(dups[0].sentenceIndex, 2);
});

test('OpenAlex abstract reconstruction, language detection, query builder, and stylometry work reliably', () => {
  const abs = reconstructOpenAlexAbstract({ Machine: [0], learning: [1], improves: [2], diagnostics: [3] });
  assert.equal(abs, 'Machine learning improves diagnostics');

  assert.equal(detectDocumentLanguage('Penelitian ini membahas sistem informasi akademik di Indonesia.').code, 'id');
  assert.equal(detectDocumentLanguage('This research investigates distributed algorithms in modern computing systems.').code, 'en');

  const sents = segmentDocumentSentences(PLAGIARISM_DEMO_TEXT);
  const queries = buildPlagiarismSearchQueries(sents, 5);
  assert.ok(queries.length >= 3 && queries.length <= 5);

  const stylo = analyzeStylometricAiSignals(PLAGIARISM_DEMO_TEXT, sents);
  assert.ok(stylo.aiProbability >= 0 && stylo.aiProbability <= 100);
});

test('Pure file extractors handle RTF, HTML/XML, and binary fallback cleanly', () => {
  const rtf = '{\\rtf1\\ansi{\\fonttbl\\f0 Arial;}Halo dunia \\b plagiarisme\\b0\\par Baris kedua.}';
  const rtfOut = stripRtfToPlainText(rtf);
  assert.ok(rtfOut.includes('Halo dunia') && rtfOut.includes('Baris kedua'));

  const html = '<html><head><style>body{color:red}</style></head><body><h1>Judul</h1><p>Paragraf &amp; uji.</p></body></html>';
  const htmlOut = stripHtmlOrXmlToPlainText(html);
  assert.ok(htmlOut.includes('Judul') && htmlOut.includes('Paragraf & uji.'));
  assert.ok(!htmlOut.includes('color:red'));

  const utf8Bytes = new TextEncoder().encode('Dokumen penelitian mahasiswa informatika tahun 2026.');
  assert.equal(extractReadableTextFromBinaryBytes(utf8Bytes), 'Dokumen penelitian mahasiswa informatika tahun 2026.');
});

test('Turnitin PDF, HTML, and JSON exporters produce valid standards-compliant & XSS-safe outputs', () => {
  const report = fusePlagiarismReport({
    text: 'Test <script>alert(1)</script> kecerdasan buatan modern untuk analisis karya ilmiah di universitas Indonesia.',
    fileName: 'Makalah_<uji>.pdf',
    fileFormat: 'PDF',
    candidates: [
      {
        title: 'Sumber <img src=x onerror=alert(1)> Akademik',
        url: 'https://example.org/paper',
        category: 'publication',
        engine: 'Crossref DOI',
        content: 'kecerdasan buatan modern untuk analisis karya ilmiah di universitas Indonesia',
      },
    ],
  });

  const pdfBytes = buildTurnitinPdfBytes(report);
  const pdfStr = new TextDecoder('latin1').decode(pdfBytes);
  assert.ok(pdfStr.startsWith('%PDF-1.4'), 'PDF must start with %PDF-1.4 header');
  assert.ok(pdfStr.trim().endsWith('%%EOF'), 'PDF must terminate with %%EOF');
  assert.ok(pdfStr.includes('ORIGINALITY REPORT'), 'PDF must include Turnitin Originality Report section');
  assert.ok(pdfStr.includes('PRIMARY SOURCES'), 'PDF must include Primary Sources table');

  const html = generateTurnitinHtmlReport(report);
  assert.ok(!html.includes('<script>alert(1)</script>'), 'HTML report must escape script tags');
  assert.ok(!html.includes('<img src=x onerror=alert(1)>'), 'HTML report must escape malicious source titles');
  assert.ok(html.includes('Similarity Index'), 'HTML report must contain Turnitin Similarity Index header');

  const jsonParsed = JSON.parse(generateTurnitinJsonReport(report));
  assert.equal(jsonParsed.submissionId, report.submissionId);
});

test('Utility registration in store.js and catalog.json includes plagiarism alongside all 13 utilities', async () => {
  const { DEFAULT_UTILITY_CONFIG, normalizeUtilityConfig } = await import('./store.js');
  const util = normalizeUtilityConfig();
  assert.equal(DEFAULT_UTILITY_CONFIG.items.length, 13);
  assert.equal(util.items.length, 13);
  const plg = util.items.find((it) => it.id === 'plagiarism');
  assert.ok(plg, 'plagiarism utility must be registered');
  assert.equal(plg.label, 'Cek Plagiarisme');
  assert.equal(plg.icon, './assets/icons/tool-plagiarism.svg');
});

test('assessExtractedTextQuality rejects garbled alien binary output and accepts readable prose (v68)', () => {
  const alienSample =
    `½'!]@≡≡ÎÆæ-:"q ´≡¿õ§õþg±"ã%Mò½¿¯#ú≡ÿƒq? à¦°Ïí!ðÒãö5ø·| ÷ß≡>≡ø≡®|≡â]sR²,ûUðõμé·6≡a‡≡‡OŠ]:"Ø? +Ž~QXÑ≡è]≡YŒ≡+.ïô±ýEÓ8≡™? mK≡í?Øÿö¢° ¦Hn≡gÿ≡ª¦3&ÛR≡²çÇ˜≡»šêÁK"≡Ÿ®`;
  const alienQuality = assessExtractedTextQuality(alienSample);
  assert.equal(alienQuality.isReadable, false, 'Must reject garbled alien mojibake text');
  assert.ok(alienQuality.garbageRatio > 0.2 || alienQuality.realWordRatio < 0.5);

  const cleanIndo =
    'Keputusan Rektor Universitas Siliwangi tentang Kalender Akademik Tahun Akademik 2026/2027 menetapkan jadwal perkuliahan semester ganjil dan genap secara resmi.';
  const cleanQuality = assessExtractedTextQuality(cleanIndo);
  assert.equal(cleanQuality.isReadable, true, `Clean Indonesian text must pass quality gate: ${JSON.stringify(cleanQuality)}`);
});

test('extractReadableTextFromBinaryBytes strictly rejects raw PDF and ZIP binary containers (v68)', () => {
  const fakePdf = new TextEncoder().encode('%PDF-1.4\n1 0 obj\n<< /Length 25 /Filter /FlateDecode >>\nstream\nx\x9c\x01\x02\x03\x04\nendstream\n%%EOF');
  assert.equal(extractReadableTextFromBinaryBytes(fakePdf), '', 'Raw PDF binary must never leak through binary fallback');

  const fakeZip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00, 0x08, 0x00, 0x41, 0x42, 0x43]);
  assert.equal(extractReadableTextFromBinaryBytes(fakeZip), '', 'Raw ZIP binary must never leak through binary fallback');
});

test('buildPlagiarismDownloadFilename always starts with Report_ and strips Turnitin prefix (v68)', () => {
  const f1 = buildPlagiarismDownloadFilename('964. SK Kalender Akademik di UNSIL TA 2026-2027.pdf', 18, 'pdf');
  assert.ok(f1.startsWith('Report_'), `Filename must start with Report_, got ${f1}`);
  assert.ok(!/^Turnitin/i.test(f1), `Filename must never start with Turnitin, got ${f1}`);
  assert.ok(f1.endsWith('_18pct.pdf'), `Filename must end with _18pct.pdf, got ${f1}`);

  const f2 = buildPlagiarismDownloadFilename('Turnitin_Report_Skripsi_Final.docx', 5, 'html');
  assert.ok(f2.startsWith('Report_'), `Should normalize Turnitin_ prefix to Report_, got ${f2}`);
  assert.ok(!f2.toLowerCase().includes('turnitin'), `Should strip Turnitin prefix completely, got ${f2}`);
  assert.ok(f2.endsWith('_5pct.html'));
});

test('Strict NO REPOSITORY policy is enforced across fused report, PDF, HTML, and JSON outputs (v68)', () => {
  const report = fusePlagiarismReport({
    text: PLAGIARISM_DEMO_TEXT,
    fileName: 'Skripsi_NoRepo.pdf',
    fileFormat: 'PDF',
    candidates: [],
  });
  assert.equal(report.repositoryMode, 'no-repository');
  assert.ok(/No Repository/i.test(report.repositoryLabel));

  const pdfStr = new TextDecoder('latin1').decode(buildTurnitinPdfBytes(report));
  assert.ok(pdfStr.includes('NO REPOSITORY'), 'PDF output must explicitly state NO REPOSITORY');
  assert.ok(pdfStr.includes('STANDARD SIMILARITY & ORIGINALITY REPORT'), 'PDF must use Standard Report header');

  const html = generateTurnitinHtmlReport(report);
  assert.ok(html.includes('NO REPOSITORY'), 'HTML report must display NO REPOSITORY guarantee');

  const jsonParsed = JSON.parse(generateTurnitinJsonReport(report));
  assert.equal(jsonParsed.repositoryMode, 'no-repository');
  assert.ok(/No Repository/i.test(jsonParsed.repositoryLabel));
});


