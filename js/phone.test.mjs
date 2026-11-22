import test from 'node:test';
import assert from 'node:assert/strict';
import {
  VERIFIED_OFFICIAL_DIRECTORY,
  aggregateCallerIntelligence,
  analyzeScamMessagePatterns,
  computeSha256Hex,
  findOfficialDirectoryMatch,
  mergeCommunityVaultJson,
  normalizeCommunityVault,
  parsePhoneNumberInput,
  toggleBlockedNumber,
  upsertCheckHistory,
  upsertCommunityTag,
} from './phone-logic.js';

test('parsePhoneNumberInput identifies Indonesian mobile HLR operators, PSTN area codes, shortcodes, and E.164', () => {
  const tsel = parsePhoneNumberInput('0812-3456-7890', 'ID');
  assert.equal(tsel.valid, true);
  assert.equal(tsel.e164, '+6281234567890');
  assert.equal(tsel.carrier, 'Telkomsel');
  assert.equal(tsel.lineType, 'SELULER (MOBILE)');
  assert.equal(tsel.isIndonesian, true);

  const jkt = parsePhoneNumberInput('021 2927 8888', 'ID');
  assert.equal(jkt.valid, true);
  assert.equal(jkt.e164, '+622129278888');
  assert.equal(jkt.lineType, 'TELEPON TETAP (PSTN / KANTOR)');
  assert.ok(jkt.regionLabel.includes('Jabodetabek'));

  const bca = parsePhoneNumberInput('1500888', 'ID');
  assert.equal(bca.valid, true);
  assert.equal(bca.isShortCode, true);
  assert.equal(bca.e164, '1500888');

  const us = parsePhoneNumberInput('+1 201 230 2420', 'ID');
  assert.equal(us.valid, true);
  assert.equal(us.e164, '+12012302420');
  assert.equal(us.country?.iso, 'US');

  const bad = parsePhoneNumberInput('12', 'ID');
  assert.equal(bad.valid, false);
});

test('findOfficialDirectoryMatch verifies OJK WA, Halo BCA, and Manifestudio Admin accurately', () => {
  assert.ok(VERIFIED_OFFICIAL_DIRECTORY.length >= 40);

  const ojkParsed = parsePhoneNumberInput('081157157157', 'ID');
  const ojkMatch = findOfficialDirectoryMatch(ojkParsed);
  assert.ok(ojkMatch);
  assert.ok(ojkMatch.name.includes('OJK'));

  const bcaParsed = parsePhoneNumberInput('1500888', 'ID');
  const bcaMatch = findOfficialDirectoryMatch(bcaParsed);
  assert.ok(bcaMatch);
  assert.ok(bcaMatch.name.includes('BCA'));

  const randomParsed = parsePhoneNumberInput('081299988877', 'ID');
  assert.equal(findOfficialDirectoryMatch(randomParsed), null);
});

test('computeSha256Hex produces CallShield 256-shard prefix 00 for +12012302420', async () => {
  const hash = await computeSha256Hex('+12012302420');
  assert.equal(hash.length, 64);
  assert.equal(hash.slice(0, 2), '00');
});

test('analyzeScamMessagePatterns catches .APK courier scams, BI-FAST phishing, and bank spoofing from personal 08xx', () => {
  const mobileCaller = parsePhoneNumberInput('081234567890', 'ID');
  const scam = analyzeScamMessagePatterns(
    'Saya dari BCA, ada perubahan tarif BI-FAST Rp150.000, silakan kirim kode OTP atau instal resi-paket.apk',
    mobileCaller
  );
  assert.equal(scam.analyzed, true);
  assert.ok(scam.riskPoints >= 80);
  assert.equal(scam.verdict, 'Risiko Penipuan Tinggi');
  assert.ok(scam.matchedSignals.length >= 3);

  const clean = analyzeScamMessagePatterns('Permisi paket sudah di depan pagar rumah ya pak.', mobileCaller);
  assert.equal(clean.riskPoints, 0);
  assert.equal(clean.verdict, 'Tidak Terdeteksi Pola Phishing Umum');
});

test('community vault CRUD handles tags, vote increments, blocklist, history, and JSON merge safely', () => {
  let vault = normalizeCommunityVault();
  vault = upsertCommunityTag(vault, '+6281234567890', {
    tag: 'Kurir J&T Express',
    sentiment: 'business',
    note: 'Pengantar paket COD',
  });
  vault = upsertCommunityTag(vault, '+6281234567890', {
    tag: 'kurir j&t express',
    sentiment: 'business',
  });
  assert.equal(vault.tagsByNumber['+6281234567890'].length, 1);
  assert.equal(vault.tagsByNumber['+6281234567890'][0].votes, 2);

  vault = toggleBlockedNumber(vault, '+628999999999', { reason: 'Spam Pinjol' });
  assert.equal(vault.blockedNumbers.length, 1);
  vault = toggleBlockedNumber(vault, '+628999999999');
  assert.equal(vault.blockedNumbers.length, 0);

  vault = upsertCheckHistory(vault, {
    e164: '+6281234567890',
    nationalFormat: '0812-3456-7890',
    carrier: 'Telkomsel',
    verdictKey: 'neutral',
    verdictLabel: 'Belum Ada Laporan Spam',
  });
  assert.equal(vault.history.length, 1);

  const merged = mergeCommunityVaultJson(vault, {
    tagsByNumber: {
      '+6281234567890': [{ tag: 'Sales Kartu', sentiment: 'nuisance', votes: 3 }],
    },
    blockedNumbers: [{ e164: '+12012302420', reason: 'Robocall' }],
  });
  assert.equal(merged.tagsByNumber['+6281234567890'].length, 2);
  assert.equal(merged.blockedNumbers.length, 1);
});

test('aggregateCallerIntelligence combines Official Directory, CallShield Spam DB, OSINT, Wikidata, and Community Tags', () => {
  const ojkParsed = parsePhoneNumberInput('081157157157', 'ID');
  const officialRes = aggregateCallerIntelligence({
    parsed: ojkParsed,
    officialMatch: findOfficialDirectoryMatch(ojkParsed),
  });
  assert.equal(officialRes.verdictKey, 'verified_official');
  assert.equal(officialRes.verdictTone, 'safe');
  assert.ok(officialRes.trustScore >= 95);

  const spamParsed = parsePhoneNumberInput('+12012302420', 'ID');
  const spamRes = aggregateCallerIntelligence({
    parsed: spamParsed,
    callShieldMatch: {
      found: true,
      shardId: '00',
      type: 'Scam / Robocall',
      reports: 8,
      description: 'Reported IRS scammer',
    },
  });
  assert.equal(spamRes.verdictKey, 'high_risk_spam');
  assert.equal(spamRes.verdictTone, 'danger');
  assert.ok(spamRes.riskScore >= 65);
  assert.ok(spamRes.tags.some((t) => t.sources.includes('CallShield GitHub')));
});
