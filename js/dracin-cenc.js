/**
 * Pure Browser WebCrypto CENC (AES-128-CTR) MP4 Decryptor & W3C ClearKey EME Helper.
 * Used for platforms like Melolo whose direct CDN MP4 streams are encrypted with
 * standard ISO BMFF Common Encryption (cenc-aes-ctr) and supply the contentKey + kid.
 */

export function hexToBytes(hex = '') {
  const clean = String(hex || '').replace(/[^0-9a-f]/gi, '');
  const len = Math.floor(clean.length / 2);
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function bytesToBase64Url(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 1) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function readU32(buf, off) {
  return (
    ((buf[off] << 24) | (buf[off + 1] << 16) | (buf[off + 2] << 8) | buf[off + 3]) >>> 0
  );
}

export function readU16(buf, off) {
  return ((buf[off] << 8) | buf[off + 1]) >>> 0;
}

export function readTag(buf, off) {
  return String.fromCharCode(buf[off], buf[off + 1], buf[off + 2], buf[off + 3]);
}

export function writeTag(buf, off, tag) {
  for (let i = 0; i < 4; i += 1) {
    buf[off + i] = tag.charCodeAt(i);
  }
}

export function parseMp4Boxes(buf, start = 0, end = buf.length) {
  const boxes = [];
  let pos = start;
  while (pos + 8 <= end) {
    let size = readU32(buf, pos);
    const type = readTag(buf, pos + 4);
    let headerSize = 8;
    if (size === 1 && pos + 16 <= end) {
      const hi = readU32(buf, pos + 8);
      const lo = readU32(buf, pos + 12);
      size = hi * 4294967296 + lo;
      headerSize = 16;
    } else if (size === 0) {
      size = end - pos;
    }
    if (size < headerSize || pos + size > end) break;
    boxes.push({
      type,
      offset: pos,
      size,
      dataStart: pos + headerSize,
      end: pos + size,
    });
    pos += size;
  }
  return boxes;
}

function findBox(buf, start, end, targetType) {
  const boxes = parseMp4Boxes(buf, start, end);
  return boxes.find((b) => b.type === targetType) || null;
}

function findBoxes(buf, start, end, targetType) {
  const boxes = parseMp4Boxes(buf, start, end);
  return boxes.filter((b) => b.type === targetType);
}

/**
 * Extracts sample byte offsets in a progressive MP4 track (stsz + stsc + stco/co64).
 */
function extractTrackSampleLocations(buf, stblBox) {
  const stsz = findBox(buf, stblBox.dataStart, stblBox.end, 'stsz');
  const stsc = findBox(buf, stblBox.dataStart, stblBox.end, 'stsc');
  const stco = findBox(buf, stblBox.dataStart, stblBox.end, 'stco');
  const co64 = findBox(buf, stblBox.dataStart, stblBox.end, 'co64');
  if (!stsz || !stsc || (!stco && !co64)) return [];

  const defaultSampleSize = readU32(buf, stsz.dataStart + 4);
  const sampleCount = readU32(buf, stsz.dataStart + 8);
  const sampleSizes = new Uint32Array(sampleCount);
  if (defaultSampleSize > 0) {
    sampleSizes.fill(defaultSampleSize);
  } else {
    for (let i = 0; i < sampleCount; i += 1) {
      sampleSizes[i] = readU32(buf, stsz.dataStart + 12 + i * 4);
    }
  }

  const chunkOffsets = [];
  if (stco) {
    const count = readU32(buf, stco.dataStart + 4);
    for (let i = 0; i < count; i += 1) {
      chunkOffsets.push(readU32(buf, stco.dataStart + 8 + i * 4));
    }
  } else if (co64) {
    const count = readU32(buf, co64.dataStart + 4);
    for (let i = 0; i < count; i += 1) {
      const hi = readU32(buf, co64.dataStart + 8 + i * 8);
      const lo = readU32(buf, co64.dataStart + 12 + i * 8);
      chunkOffsets.push(hi * 4294967296 + lo);
    }
  }

  const stscCount = readU32(buf, stsc.dataStart + 4);
  const stscEntries = [];
  for (let i = 0; i < stscCount; i += 1) {
    const base = stsc.dataStart + 8 + i * 12;
    stscEntries.push({
      firstChunk: readU32(buf, base),
      samplesPerChunk: readU32(buf, base + 4),
    });
  }

  const locations = [];
  let sampleIdx = 0;
  for (let chunkIdx = 0; chunkIdx < chunkOffsets.length && sampleIdx < sampleCount; chunkIdx += 1) {
    const chunkNum = chunkIdx + 1;
    let spc = 1;
    for (let e = 0; e < stscEntries.length; e += 1) {
      if (chunkNum >= stscEntries[e].firstChunk) {
        spc = stscEntries[e].samplesPerChunk;
      } else {
        break;
      }
    }
    let offset = chunkOffsets[chunkIdx];
    for (let s = 0; s < spc && sampleIdx < sampleCount; s += 1) {
      const size = sampleSizes[sampleIdx];
      locations.push({ offset, size });
      offset += size;
      sampleIdx += 1;
    }
  }
  return locations;
}

/**
 * Parses a 'senc' (Sample Encryption) box into per-sample IVs and optional subsample ranges.
 */
function parseSencBox(buf, sencBox, defaultIvSize = 8) {
  const flags =
    ((buf[sencBox.dataStart + 1] << 16) |
      (buf[sencBox.dataStart + 2] << 8) |
      buf[sencBox.dataStart + 3]) >>>
    0;
  const hasSubsamples = (flags & 0x02) !== 0;
  const count = readU32(buf, sencBox.dataStart + 4);
  const entries = [];
  let pos = sencBox.dataStart + 8;

  for (let i = 0; i < count && pos + defaultIvSize <= sencBox.end; i += 1) {
    const iv = buf.slice(pos, pos + defaultIvSize);
    pos += defaultIvSize;
    let subsamples = null;
    if (hasSubsamples && pos + 2 <= sencBox.end) {
      const subCount = readU16(buf, pos);
      pos += 2;
      subsamples = [];
      for (let j = 0; j < subCount && pos + 6 <= sencBox.end; j += 1) {
        const clearBytes = readU16(buf, pos);
        const encBytes = readU32(buf, pos + 2);
        pos += 6;
        subsamples.push({ clearBytes, encBytes });
      }
    }
    entries.push({ iv, subsamples });
  }
  return entries;
}

/**
 * Builds 16-byte AES-CTR counter block from an 8-byte or 16-byte CENC IV.
 */
function buildCtrCounter(ivBytes) {
  const counter = new Uint8Array(16);
  counter.set(ivBytes.subarray(0, Math.min(16, ivBytes.length)), 0);
  return counter;
}

function incrementCtrCounter(counter, blocks) {
  let carry = blocks;
  for (let i = 15; i >= 8 && carry > 0; i -= 1) {
    const sum = counter[i] + (carry & 0xff);
    counter[i] = sum & 0xff;
    carry = Math.floor(carry / 256) + (sum >> 8);
  }
}

/**
 * Decrypts an ISO-BMFF CENC AES-128-CTR progressive MP4 ArrayBuffer in-place
 * using WebCrypto subtle.decrypt and patches encv/enca -> original codec tag + removes sinf.
 */
export async function decryptCencMp4Buffer(arrayBuffer, contentKeyHex) {
  if (!arrayBuffer || !contentKeyHex || typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('WebCrypto tidak tersedia untuk dekripsi video');
  }
  const keyBytes = hexToBytes(contentKeyHex);
  if (keyBytes.length !== 16) {
    throw new Error('Kunci dekripsi tidak valid');
  }

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-CTR' },
    false,
    ['decrypt']
  );

  const buf = new Uint8Array(arrayBuffer);
  const moov = findBox(buf, 0, buf.length, 'moov');
  if (!moov) return buf;

  const traks = findBoxes(buf, moov.dataStart, moov.end, 'trak');
  let decryptedAny = false;

  for (const trak of traks) {
    const mdia = findBox(buf, trak.dataStart, trak.end, 'mdia');
    const minf = mdia ? findBox(buf, mdia.dataStart, mdia.end, 'minf') : null;
    const stbl = minf ? findBox(buf, minf.dataStart, minf.end, 'stbl') : null;
    if (!stbl) continue;

    const stsd = findBox(buf, stbl.dataStart, stbl.end, 'stsd');
    if (!stsd) continue;

    // Inspect sample entries in stsd (skip version/flags + entry_count = 8 bytes)
    const entries = parseMp4Boxes(buf, stsd.dataStart + 8, stsd.end);
    let defaultIvSize = 8;
    let trackEncrypted = false;

    for (const entry of entries) {
      if (entry.type !== 'encv' && entry.type !== 'enca') continue;
      // VisualSampleEntry fixed fields = 78 bytes after 8-byte header; AudioSampleEntry = 28 bytes
      const childOffset = entry.type === 'encv' ? entry.dataStart + 78 : entry.dataStart + 28;
      const sinf = findBox(buf, childOffset, entry.end, 'sinf');
      if (!sinf) continue;

      const frma = findBox(buf, sinf.dataStart, sinf.end, 'frma');
      const schi = findBox(buf, sinf.dataStart, sinf.end, 'schi');
      const tenc = schi ? findBox(buf, schi.dataStart, schi.end, 'tenc') : null;
      if (tenc && tenc.dataStart + 8 <= tenc.end) {
        // tenc fullbox: 4 bytes version/flags, 2 bytes reserved/pattern, 1 byte isProtected, 1 byte perSampleIvSize
        const perSampleIv = buf[tenc.dataStart + 7];
        if (perSampleIv === 8 || perSampleIv === 16) defaultIvSize = perSampleIv;
      }

      if (frma && frma.dataStart + 4 <= frma.end) {
        const origFormat = readTag(buf, frma.dataStart);
        // Patch encv/enca -> original codec (e.g. hvc1 / avc1 / mp4a) & neutralize sinf -> free
        writeTag(buf, entry.offset + 4, origFormat);
        writeTag(buf, sinf.offset + 4, 'free');
        trackEncrypted = true;
      }
    }

    if (!trackEncrypted) continue;

    // Locate senc box (inside stbl, or via saio/senc in trak)
    const senc =
      findBox(buf, stbl.dataStart, stbl.end, 'senc') ||
      findBox(buf, trak.dataStart, trak.end, 'senc');
    if (!senc) continue;

    const sampleLocs = extractTrackSampleLocations(buf, stbl);
    const sencEntries = parseSencBox(buf, senc, defaultIvSize);
    const count = Math.min(sampleLocs.length, sencEntries.length);

    for (let i = 0; i < count; i += 1) {
      const loc = sampleLocs[i];
      const info = sencEntries[i];
      if (!loc || !info || loc.offset + loc.size > buf.length) continue;

      const counter = buildCtrCounter(info.iv);

      if (info.subsamples && info.subsamples.length > 0) {
        // CENC subsample encryption: concatenate encrypted slices, decrypt once, write back
        let totalEnc = 0;
        for (const sub of info.subsamples) totalEnc += sub.encBytes;
        if (totalEnc === 0) continue;

        const cipher = new Uint8Array(totalEnc);
        let cursor = loc.offset;
        let outCursor = 0;
        for (const sub of info.subsamples) {
          cursor += sub.clearBytes;
          if (sub.encBytes > 0 && cursor + sub.encBytes <= buf.length) {
            cipher.set(buf.subarray(cursor, cursor + sub.encBytes), outCursor);
            outCursor += sub.encBytes;
          }
          cursor += sub.encBytes;
        }

        const plainBuf = await crypto.subtle.decrypt(
          { name: 'AES-CTR', counter, length: 64 },
          cryptoKey,
          cipher
        );
        const plain = new Uint8Array(plainBuf);

        cursor = loc.offset;
        outCursor = 0;
        for (const sub of info.subsamples) {
          cursor += sub.clearBytes;
          if (sub.encBytes > 0 && cursor + sub.encBytes <= buf.length) {
            buf.set(plain.subarray(outCursor, outCursor + sub.encBytes), cursor);
            outCursor += sub.encBytes;
          }
          cursor += sub.encBytes;
        }
        decryptedAny = true;
      } else {
        // Full-sample encryption
        const cipher = buf.subarray(loc.offset, loc.offset + loc.size);
        const plainBuf = await crypto.subtle.decrypt(
          { name: 'AES-CTR', counter, length: 64 },
          cryptoKey,
          cipher
        );
        buf.set(new Uint8Array(plainBuf), loc.offset);
        incrementCtrCounter(counter, Math.ceil(loc.size / 16));
        decryptedAny = true;
      }
    }

    // Neutralize senc/saiz/saio/pssh boxes so browser decoders treat stream as plain MP4
    for (const boxType of ['senc', 'saiz', 'saio']) {
      for (const b of findBoxes(buf, stbl.dataStart, stbl.end, boxType)) {
        writeTag(buf, b.offset + 4, 'free');
      }
    }
  }

  // Also neutralize top-level pssh inside moov if any
  for (const pssh of findBoxes(buf, moov.dataStart, moov.end, 'pssh')) {
    writeTag(buf, pssh.offset + 4, 'free');
  }

  return { buffer: buf, decrypted: decryptedAny };
}

/**
 * Fetches and decrypts a CENC-AES-CTR MP4 URL into a playable Blob URL.
 */
export async function fetchAndDecryptCencMp4(url, contentKeyHex, signal = null) {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Gagal memuat video (${res.status})`);
  const arr = await res.arrayBuffer();
  const { buffer } = await decryptCencMp4Buffer(arr, contentKeyHex);
  const blob = new Blob([buffer], { type: 'video/mp4' });
  return URL.createObjectURL(blob);
}

/**
 * Attaches native W3C ClearKey EME (org.w3.clearkey) to a <video> element as an instant
 * streaming fallback when hardware/browser EME ClearKey is available.
 */
export function attachClearKeyEme(videoEl, kidHex, contentKeyHex) {
  if (!videoEl || !kidHex || !contentKeyHex || !navigator.requestMediaKeySystemAccess) {
    return () => {};
  }
  const kidB64 = bytesToBase64Url(hexToBytes(kidHex));
  const keyB64 = bytesToBase64Url(hexToBytes(contentKeyHex));
  let active = true;

  const onEncrypted = async (event) => {
    if (!active) return;
    try {
      const access = await navigator.requestMediaKeySystemAccess('org.w3.clearkey', [
        {
          initDataTypes: ['cenc'],
          videoCapabilities: [
            { contentType: 'video/mp4; codecs="hev1.1.6.L93.B0"' },
            { contentType: 'video/mp4; codecs="hvc1.1.6.L93.B0"' },
            { contentType: 'video/mp4; codecs="avc1.64001f"' },
          ],
          audioCapabilities: [{ contentType: 'audio/mp4; codecs="mp4a.40.2"' }],
        },
      ]);
      const mediaKeys = await access.createMediaKeys();
      await videoEl.setMediaKeys(mediaKeys);
      const session = mediaKeys.createSession();
      session.addEventListener('message', async () => {
        const jwk = JSON.stringify({
          keys: [{ kty: 'oct', k: keyB64, kid: kidB64 }],
          type: 'temporary',
        });
        await session.update(new TextEncoder().encode(jwk));
      });
      await session.generateRequest(event.initDataType, event.initData);
    } catch {
      // Caller falls back cleanly if EME not supported
    }
  };

  videoEl.addEventListener('encrypted', onEncrypted);
  return () => {
    active = false;
    videoEl.removeEventListener('encrypted', onEncrypted);
  };
}
