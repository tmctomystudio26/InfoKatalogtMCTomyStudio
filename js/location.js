/**
 * Smart Location Resolver for Jadwal Sholat, Prakiraan Cuaca, & Speedtest
 * Resolves Indonesian administrative hierarchy down to Kelurahan/Desa & Kecamatan:
 * 1. Browser Geolocation API (High-accuracy GPS first, balanced fallback on timeout)
 * 2. Automatic Network / IP Geolocation enriched with sub-district reverse geocoding
 * 3. Saved Browser Location History in localStorage
 * 4. Curated Default (Jakarta, Indonesia) + Manual Sub-district / City Search
 */

import { formatDetailedLocationLabel, parseIndonesianAddressHierarchy } from './tools-logic.js';

export const LOCATION_HISTORY_STORAGE_KEY = 'manifestudio_last_location_v1';

const DEFAULT_LOCATION = {
  lat: -6.2088,
  lon: 106.8456,
  kelurahan: '',
  kecamatan: 'Menteng',
  city: 'Jakarta Pusat',
  region: 'DKI Jakarta',
  country: 'Indonesia',
  source: 'default',
  hasExactCoords: false,
  updatedAt: null,
};

export const POPULAR_ID_CITIES = [
  { city: 'Jakarta Pusat', kecamatan: 'Menteng', region: 'DKI Jakarta', country: 'Indonesia', lat: -6.1944, lon: 106.8294 },
  { city: 'Kota Bandung', kecamatan: 'Sumur Bandung', region: 'Jawa Barat', country: 'Indonesia', lat: -6.9175, lon: 107.6191 },
  { city: 'Surabaya', kecamatan: 'Genteng', region: 'Jawa Timur', country: 'Indonesia', lat: -7.2575, lon: 112.7521 },
  { city: 'Yogyakarta', kecamatan: 'Gondokusuman', region: 'DI Yogyakarta', country: 'Indonesia', lat: -7.7829, lon: 110.375 },
  { city: 'Semarang', kecamatan: 'Semarang Tengah', region: 'Jawa Tengah', country: 'Indonesia', lat: -6.982, lon: 110.418 },
  { city: 'Medan', kecamatan: 'Medan Baru', region: 'Sumatera Utara', country: 'Indonesia', lat: 3.5752, lon: 98.6597 },
  { city: 'Makassar', kecamatan: 'Ujung Pandang', region: 'Sulawesi Selatan', country: 'Indonesia', lat: -5.1477, lon: 119.409 },
  { city: 'Denpasar', kecamatan: 'Denpasar Barat', region: 'Bali', country: 'Indonesia', lat: -8.6705, lon: 115.2026 },
  { city: 'Palembang', kecamatan: 'Ilir Timur I', region: 'Sumatera Selatan', country: 'Indonesia', lat: -2.9761, lon: 104.7654 },
  { city: 'Balikpapan', kecamatan: 'Balikpapan Kota', region: 'Kalimantan Timur', country: 'Indonesia', lat: -1.2675, lon: 116.8289 },
  { city: 'Jayapura', kecamatan: 'Jayapura Selatan', region: 'Papua', country: 'Indonesia', lat: -2.5616, lon: 140.699 },
];

let memoryCachedLocation = null;

export function readLocationHistory() {
  try {
    const raw = localStorage.getItem(LOCATION_HISTORY_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      Number.isFinite(Number(parsed.lat)) &&
      Number.isFinite(Number(parsed.lon))
    ) {
      return {
        lat: Number(parsed.lat),
        lon: Number(parsed.lon),
        kelurahan: String(parsed.kelurahan || ''),
        kecamatan: String(parsed.kecamatan || ''),
        city: String(parsed.city || 'Lokasi Tersimpan'),
        region: String(parsed.region || ''),
        country: String(parsed.country || 'Indonesia'),
        source: String(parsed.source || 'history'),
        hasExactCoords: Boolean(parsed.hasExactCoords),
        updatedAt: parsed.updatedAt || null,
      };
    }
  } catch {
    // Ignore storage errors
  }
  return null;
}

export function saveLocationHistory(loc) {
  if (!loc || !Number.isFinite(Number(loc.lat)) || !Number.isFinite(Number(loc.lon))) return;
  const payload = {
    lat: Number(loc.lat),
    lon: Number(loc.lon),
    kelurahan: String(loc.kelurahan || ''),
    kecamatan: String(loc.kecamatan || ''),
    city: String(loc.city || 'Lokasi Anda'),
    region: String(loc.region || ''),
    country: String(loc.country || 'Indonesia'),
    source: String(loc.source || 'gps'),
    hasExactCoords: Boolean(loc.hasExactCoords ?? (loc.source === 'gps' || loc.source === 'manual')),
    updatedAt: new Date().toISOString(),
  };
  memoryCachedLocation = payload;
  try {
    localStorage.setItem(LOCATION_HISTORY_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage errors
  }
}

async function fetchWithTimeout(url, timeoutMs = 6000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJsonSafe(url, timeoutMs = 4800) {
  try {
    const res = await fetchWithTimeout(url, timeoutMs);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function reverseGeocode(lat, lon) {
  const latStr = encodeURIComponent(lat);
  const lonStr = encodeURIComponent(lon);

  const [nomRes, bdcRes, phoRes] = await Promise.allSettled([
    fetchJsonSafe(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latStr}&lon=${lonStr}&zoom=18&addressdetails=1&accept-language=id`,
      4800
    ),
    fetchJsonSafe(
      `https://api-bdc.io/data/reverse-geocode-client?latitude=${latStr}&longitude=${lonStr}&localityLanguage=id`,
      4500
    ),
    fetchJsonSafe(`https://photon.komoot.io/reverse?lat=${latStr}&lon=${lonStr}`, 4500),
  ]);

  const nominatim = nomRes.status === 'fulfilled' ? nomRes.value : null;
  const bigdatacloud = bdcRes.status === 'fulfilled' ? bdcRes.value : null;
  const photonRaw = phoRes.status === 'fulfilled' ? phoRes.value : null;
  const photon = Array.isArray(photonRaw?.features) ? photonRaw.features[0] : null;

  const parsed = parseIndonesianAddressHierarchy({ nominatim, bigdatacloud, photon });
  if (parsed.city || parsed.kecamatan || parsed.kelurahan) {
    return parsed;
  }

  return {
    kelurahan: '',
    kecamatan: '',
    city: `${Number(lat).toFixed(3)}, ${Number(lon).toFixed(3)}`,
    region: 'Koordinat GPS',
    country: 'Indonesia',
  };
}

function getCurrentPositionPromise(options) {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Geolocation tidak didukung browser.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      (err) => {
        reject(err || new Error('Izin lokasi ditolak.'));
      },
      options
    );
  });
}

async function requestBrowserGeolocation(timeoutMs = 8000) {
  try {
    return await getCurrentPositionPromise({
      enableHighAccuracy: true,
      timeout: timeoutMs,
      maximumAge: 120000,
    });
  } catch (err) {
    // Retry once without high-accuracy if GPS timed out / position unavailable (never re-prompt if PERMISSION_DENIED = 1)
    if (err && Number(err.code) !== 1) {
      return await getCurrentPositionPromise({
        enableHighAccuracy: false,
        timeout: Math.max(4500, timeoutMs - 2000),
        maximumAge: 300000,
      });
    }
    throw err;
  }
}

async function detectNetworkLocation() {
  let rawIpLoc = null;

  try {
    const res = await fetchWithTimeout('https://get.geojs.io/v1/ip/geo.json', 5000);
    if (res.ok) {
      const data = await res.json();
      const lat = Number(data?.latitude);
      const lon = Number(data?.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        rawIpLoc = {
          lat,
          lon,
          city: data.city || data.region || 'Lokasi Jaringan',
          region: data.region || '',
          country: data.country || 'Indonesia',
          source: 'network',
          hasExactCoords: false,
        };
      }
    }
  } catch {
    // Try secondary IP provider
  }

  if (!rawIpLoc) {
    try {
      const res = await fetchWithTimeout(
        'https://api-bdc.io/data/reverse-geocode-client?localityLanguage=id',
        5000
      );
      if (res.ok) {
        const data = await res.json();
        const lat = Number(data?.latitude);
        const lon = Number(data?.longitude);
        if (Number.isFinite(lat) && Number.isFinite(lon)) {
          rawIpLoc = {
            lat,
            lon,
            city: data.city || data.locality || data.principalSubdivision || 'Lokasi Jaringan',
            region: data.principalSubdivision || '',
            country: data.countryName || 'Indonesia',
            source: 'network',
            hasExactCoords: false,
          };
        }
      }
    } catch {
      // Both IP providers failed
    }
  }

  if (!rawIpLoc) return null;

  // Enrich IP coordinates with sub-district info (Kecamatan/Kelurahan) best-effort
  try {
    const rev = await reverseGeocode(rawIpLoc.lat, rawIpLoc.lon);
    return {
      ...rawIpLoc,
      kelurahan: rev.kelurahan || '',
      kecamatan: rev.kecamatan || '',
      city: rev.city || rawIpLoc.city,
      region: rev.region || rawIpLoc.region,
      country: rev.country || rawIpLoc.country,
    };
  } catch {
    return rawIpLoc;
  }
}

export async function resolveUserLocation({ forceRefresh = false } = {}) {
  if (!forceRefresh && memoryCachedLocation) {
    return memoryCachedLocation;
  }

  // 1. Prioritize Browser Geolocation Permission First (High Accuracy)
  try {
    const coords = await requestBrowserGeolocation(8000);
    const geo = await reverseGeocode(coords.lat, coords.lon);
    const gpsLoc = {
      lat: coords.lat,
      lon: coords.lon,
      kelurahan: geo.kelurahan || '',
      kecamatan: geo.kecamatan || '',
      city: geo.city,
      region: geo.region,
      country: geo.country,
      source: 'gps',
      hasExactCoords: true,
    };
    saveLocationHistory(gpsLoc);
    return memoryCachedLocation;
  } catch {
    // Permission denied, blocked, timed out, or unavailable -> automatic fallback
  }

  // 2. Fallback to Automatic Network / IP Geolocation
  const networkLoc = await detectNetworkLocation();
  if (networkLoc) {
    saveLocationHistory(networkLoc);
    return memoryCachedLocation;
  }

  // 3. Fallback to Saved Browser Location History
  const saved = readLocationHistory();
  if (saved) {
    memoryCachedLocation = { ...saved, source: 'history' };
    return memoryCachedLocation;
  }

  // 4. Final Safe Default (Jakarta)
  memoryCachedLocation = { ...DEFAULT_LOCATION };
  return memoryCachedLocation;
}

export function setManualLocation(loc) {
  saveLocationHistory({
    lat: loc.lat,
    lon: loc.lon,
    kelurahan: loc.kelurahan || '',
    kecamatan: loc.kecamatan || '',
    city: loc.city,
    region: loc.region || '',
    country: loc.country || 'Indonesia',
    source: 'manual',
    hasExactCoords: loc.hasExactCoords ?? true,
  });
  return memoryCachedLocation;
}

export function describeLocationSource(source) {
  switch (source) {
    case 'gps':
      return 'Lokasi GPS Presisi (Izin Aktif)';
    case 'network':
      return 'Deteksi Otomatis Jaringan (IP)';
    case 'history':
      return 'Riwayat Lokasi Tersimpan';
    case 'manual':
      return 'Pilihan Wilayah Manual';
    default:
      return 'Lokasi Default (Jakarta)';
  }
}

function buildSearchEntry(raw) {
  const lat = Number(raw.lat);
  const lon = Number(raw.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const entry = {
    kelurahan: String(raw.kelurahan || ''),
    kecamatan: String(raw.kecamatan || ''),
    city: String(raw.city || ''),
    region: String(raw.region || ''),
    country: String(raw.country || 'Indonesia'),
    lat,
    lon,
    hasExactCoords: raw.hasExactCoords ?? true,
  };
  return {
    ...entry,
    displayLabel: formatDetailedLocationLabel(entry),
  };
}

export async function searchCitiesOnline(query, { indonesiaOnly = false } = {}) {
  const clean = String(query || '').trim();
  if (clean.length < 2) {
    return POPULAR_ID_CITIES.slice(0, 6).map((c) => buildSearchEntry(c)).filter(Boolean);
  }

  const localMatches = POPULAR_ID_CITIES.filter(
    (c) =>
      c.city.toLowerCase().includes(clean.toLowerCase()) ||
      (c.kecamatan && c.kecamatan.toLowerCase().includes(clean.toLowerCase())) ||
      c.region.toLowerCase().includes(clean.toLowerCase())
  )
    .map((c) => buildSearchEntry(c))
    .filter(Boolean);

  const nomUrl =
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(clean)}` +
    `&format=jsonv2&addressdetails=1&limit=7&accept-language=id${indonesiaOnly ? '&countrycodes=id' : ''}`;
  const photonUrl =
    `https://photon.komoot.io/api?q=${encodeURIComponent(clean)}&limit=8` +
    (indonesiaOnly ? '&lat=-2.5&lon=118.0' : '');
  const openMeteoUrl =
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(clean)}&count=6&language=id&format=json`;

  const [nomRes, photonRes, omRes] = await Promise.allSettled([
    fetchJsonSafe(nomUrl, 4800),
    fetchJsonSafe(photonUrl, 4800),
    fetchJsonSafe(openMeteoUrl, 4500),
  ]);

  const combined = [];
  const seenKeys = new Set();
  const pushUnique = (entry) => {
    if (!entry) return;
    if (
      indonesiaOnly &&
      !String(entry.country || '').toLowerCase().includes('indonesia') &&
      !(entry.lat >= -11.5 && entry.lat <= 6.5 && entry.lon >= 94.5 && entry.lon <= 141.5)
    ) {
      return;
    }
    const key = `${entry.displayLabel.toLowerCase()}|${entry.lat.toFixed(2)},${entry.lon.toFixed(2)}`;
    if (seenKeys.has(key)) return;
    seenKeys.add(key);
    combined.push(entry);
  };

  if (nomRes.status === 'fulfilled' && Array.isArray(nomRes.value)) {
    for (const item of nomRes.value) {
      const hierarchy = parseIndonesianAddressHierarchy({ nominatim: item });
      const fallbackName = String(item.name || '');
      if (!hierarchy.kelurahan && !hierarchy.kecamatan && fallbackName) {
        hierarchy.kecamatan = fallbackName;
      }
      pushUnique(
        buildSearchEntry({
          ...hierarchy,
          lat: item.lat,
          lon: item.lon,
          hasExactCoords: true,
        })
      );
    }
  }

  if (photonRes.status === 'fulfilled' && Array.isArray(photonRes.value?.features)) {
    for (const feat of photonRes.value.features) {
      const p = feat?.properties || {};
      const coords = feat?.geometry?.coordinates || [];
      if (coords.length < 2) continue;
      const hierarchy = parseIndonesianAddressHierarchy({ photon: feat });
      const name = String(p.name || '').trim();
      const osmVal = String(p.osm_value || '').toLowerCase();
      if (name && !hierarchy.kelurahan && /village|suburb|quarter|hamlet/.test(osmVal)) {
        hierarchy.kelurahan = name;
      } else if (name && !hierarchy.kecamatan && /district|town|borough/.test(osmVal)) {
        hierarchy.kecamatan = name;
      } else if (name && !hierarchy.city) {
        hierarchy.city = name;
      }
      pushUnique(
        buildSearchEntry({
          ...hierarchy,
          lat: coords[1],
          lon: coords[0],
          hasExactCoords: true,
        })
      );
    }
  }

  if (omRes.status === 'fulfilled' && Array.isArray(omRes.value?.results)) {
    for (const r of omRes.value.results) {
      pushUnique(
        buildSearchEntry({
          kelurahan: '',
          kecamatan: r.admin3 || r.admin4 || '',
          city: r.name || r.admin2 || '',
          region: r.admin1 || '',
          country: r.country || '',
          lat: r.latitude,
          lon: r.longitude,
          hasExactCoords: Boolean(r.admin3 || r.admin4),
        })
      );
    }
  }

  if (combined.length > 0) {
    return combined.slice(0, 8);
  }
  return localMatches;
}
