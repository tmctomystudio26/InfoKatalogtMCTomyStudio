/**
 * Client-side encrypted admin vault using Web Crypto API (PBKDF2-SHA256 + AES-GCM-256)
 * and GitHub write-permission verification. Zero plaintext credentials stored.
 */

const KDF_ITERATIONS = 150000;

function getSubtleCrypto() {
  const cryptoObj = globalThis.crypto;
  if (!cryptoObj || !cryptoObj.subtle) {
    throw new Error('Browser tidak mendukung enkripsi Web Crypto API (gunakan HTTPS).');
  }
  return cryptoObj;
}

function bytesToBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(base64Str) {
  const binary = atob(String(base64Str || '').trim());
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveAesKey(password, saltBytes, iterations = KDF_ITERATIONS) {
  const { subtle } = getSubtleCrypto();
  const keyMaterial = await subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptVault(secretPayload, password) {
  const cleanPassword = String(password || '');
  if (cleanPassword.length < 6) {
    throw new Error('Password brankas minimal 6 karakter.');
  }

  const cryptoObj = getSubtleCrypto();
  const salt = cryptoObj.getRandomValues(new Uint8Array(16));
  const iv = cryptoObj.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(cleanPassword, salt, KDF_ITERATIONS);

  const plaintext = new TextEncoder().encode(JSON.stringify(secretPayload));
  const cipherBuffer = await cryptoObj.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plaintext
  );

  return {
    v: 1,
    alg: 'AES-GCM-256',
    kdf: 'PBKDF2-SHA256',
    iterations: KDF_ITERATIONS,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ct: bytesToBase64(new Uint8Array(cipherBuffer)),
  };
}

export async function decryptVault(vaultRecord, password) {
  if (
    !vaultRecord ||
    vaultRecord.v !== 1 ||
    !vaultRecord.salt ||
    !vaultRecord.iv ||
    !vaultRecord.ct
  ) {
    throw new Error('Format brankas terenkripsi tidak valid.');
  }

  const cleanPassword = String(password || '');
  if (!cleanPassword) {
    throw new Error('Masukkan password brankas terlebih dahulu.');
  }

  const { subtle } = getSubtleCrypto();
  const salt = base64ToBytes(vaultRecord.salt);
  const iv = base64ToBytes(vaultRecord.iv);
  const ct = base64ToBytes(vaultRecord.ct);
  const iterations = Number(vaultRecord.iterations) || KDF_ITERATIONS;
  const key = await deriveAesKey(cleanPassword, salt, iterations);

  try {
    const plainBuffer = await subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ct
    );
    const jsonText = new TextDecoder().decode(plainBuffer);
    return JSON.parse(jsonText);
  } catch {
    throw new Error('Password brankas salah atau data terenkripsi rusak.');
  }
}

export async function verifyGitHubTokenAccess({
  owner,
  repo,
  token,
  fetchImpl = globalThis.fetch,
}) {
  const cleanOwner = String(owner || '').trim();
  const cleanRepo = String(repo || '').trim();
  const cleanToken = String(token || '').trim();

  if (!cleanOwner || !cleanRepo) {
    return { ok: false, error: 'Pemilik GitHub dan nama repositori wajib diisi.' };
  }
  if (!cleanToken) {
    return { ok: false, error: 'Token GitHub (PAT) wajib diisi untuk verifikasi admin.' };
  }

  try {
    const res = await fetchImpl(
      `https://api.github.com/repos/${encodeURIComponent(cleanOwner)}/${encodeURIComponent(cleanRepo)}`,
      {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${cleanToken}`,
        },
        cache: 'no-store',
      }
    );

    if (res.status === 401) {
      return { ok: false, error: 'Token GitHub ditolak (tidak valid atau kedaluwarsa).' };
    }
    if (res.status === 403) {
      return { ok: false, error: 'Token GitHub tidak memiliki izin akses ke repositori ini.' };
    }
    if (res.status === 404) {
      return { ok: false, error: 'Repositori tidak ditemukan atau token belum diberi akses repo.' };
    }
    if (!res.ok) {
      return { ok: false, error: `Verifikasi GitHub gagal (HTTP ${res.status}).` };
    }

    const repoData = await res.json();
    if (!repoData?.permissions?.push) {
      return {
        ok: false,
        error: 'Token ini hanya memiliki akses baca. Aktifkan izin Contents: Read and Write.',
      };
    }

    return { ok: true, repoFullName: repoData.full_name || `${cleanOwner}/${cleanRepo}` };
  } catch {
    return { ok: false, error: 'Tidak dapat menghubungi GitHub API. Periksa koneksi internet.' };
  }
}
