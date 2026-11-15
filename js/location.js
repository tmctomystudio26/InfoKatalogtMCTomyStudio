/**
 * Smart Location Resolver for Jadwal Sholat & Prakiraan Cuaca
 * Priority order:
 * 1. Browser Geolocation API (explicit user permission first)
 * 2. Automatic Network / IP Geolocation (if permission denied/unavailable/timed out)
 * 3. Saved Browser Location History in localStorage
 * 4. Curated Default (Jakarta, Indonesia) + Manual City Search
 */

export const LOCATION_HISTORY_STORAGE_KEY = 'manifestudio_last_location_v1';

const DEFAULT_LOCATION = {
  lat: -6.2088,
  lon: 106.8456,
  city: 'Jakarta',
  region: 'DKI Jakarta',
  country: 'Indonesia',
  source: 'default',
  updatedAt: null,
};

export const POPULAR_ID_CITIES = [
  { city: 'Jakarta', region: 'DKI Jakarta', country: 'Indonesia', lat: -6.2088, lon: 106.8456 },
  { city: 'Bandung', region: 'Jawa Barat', country: 'Indonesia', lat: -6.9175, lon: 107.6191 },
  { city: 'Surabaya', region: 'Jawa Timur', country: 'Indonesia', lat: -7.2575, lon: 112.7521 },
  { city: 'Yogyakarta', region: 'DI Yogyakarta', country: 'Indonesia', lat: -7.7956, lon: 110.3695 },
  { city: 'Semarang', region: 'Jawa Tengah', country: 'Indonesia', lat: -6.9667, lon: 110.4167 },
  { city: 'Medan', region: 'Sumatera Utara', country: 'Indonesia', lat: 3.5952, lon: 98.6722 },
  { city: 'Makassar', region: 'Sulawesi Selatan', country: 'Indonesia', lat: -5.1477, lon: 119.4327 },
  { city: 'Denpasar', region: 'Bali', country: 'Indonesia', lat: -8.6705, lon: 115.2126 },
  { city: 'Palembang', region: 'Sumatera Selatan', country: 'Indonesia', lat: -2.9761, lon: 104.7754 },
  { city: 'Balikpapan', region: 'Kalimantan Timur', country: 'Indonesia', lat: -1.2379, lon: 116.8529 },
  { city: 'Jayapura', region: 'Papua', country: 'Indonesia', lat: -2.5916, lon: 140.669 },
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
        city: String(parsed.city || 'Lokasi Tersimpan'),
        region: String(parsed.region || ''),
        country: String(parsed.country || 'Indonesia'),
        source: String(parsed.source || 'history'),
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
    city: String(loc.city || 'Lokasi Anda'),
    region: String(loc.region || ''),
    country: String(loc.country || 'Indonesia'),
    source: String(loc.source || 'gps'),
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

async function reverseGeocode(lat, lon) {
  try {
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&localityLanguage=id`;
    const res = await fetchWithTimeout(url, 4500);
    if (res.ok) {
      const data = await res.json();
      const city = data.city || data.locality || data.principalSubdivision || '';
      const region = data.principalSubdivision || '';
      const country = data.countryName || 'Indonesia';
      if (city) return { city, region, country };
    }
  } catch {
    // Ignore reverse geocode errors
  }
  return {
    city: `${Number(lat).toFixed(2)}, ${Number(lon).toFixed(2)}`,
    region: 'Koordinat GPS',
    country: 'Indonesia',
  };
}

function requestBrowserGeolocation(timeoutMs = 7000) {
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
        });
      },
      (err) => {
        reject(err || new Error('Izin lokasi ditolak.'));
      },
      {
        enableHighAccuracy: false,
        timeout: timeoutMs,
        maximumAge: 300000,
      }
    );
  });
}

async function detectNetworkLocation() {
  // Primary CORS-friendly IP geolocation
  try {
    const res = await fetchWithTimeout('https://ipwho.is/', 5000);
    if (res.ok) {
      const data = await res.json();
      if (data && data.success !== false && Number.isFinite(Number(data.latitude)) && Number.isFinite(Number(data.longitude))) {
        return {
          lat: Number(data.latitude),
          lon: Number(data.longitude),
          city: data.city || data.region || 'Lokasi Jaringan',
          region: data.region || '',
          country: data.country || 'Indonesia',
          source: 'network',
        };
      }
    }
  } catch {
    // Try secondary IP provider
  }

  try {
    const res = await fetchWithTimeout('https://get.geojs.io/v1/ip/geo.json', 5000);
    if (res.ok) {
      const data = await res.json();
      const lat = Number(data?.latitude);
      const lon = Number(data?.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        return {
          lat,
          lon,
          city: data.city || data.region || 'Lokasi Jaringan',
          region: data.region || '',
          country: data.country || 'Indonesia',
          source: 'network',
        };
      }
    }
  } catch {
    // Both IP providers failed
  }

  return null;
}

export async function resolveUserLocation({ forceRefresh = false } = {}) {
  if (!forceRefresh && memoryCachedLocation) {
    return memoryCachedLocation;
  }

  // 1. Prioritize Browser Geolocation Permission First
  try {
    const coords = await requestBrowserGeolocation(7000);
    const geo = await reverseGeocode(coords.lat, coords.lon);
    const gpsLoc = {
      lat: coords.lat,
      lon: coords.lon,
      city: geo.city,
      region: geo.region,
      country: geo.country,
      source: 'gps',
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
    city: loc.city,
    region: loc.region || '',
    country: loc.country || 'Indonesia',
    source: 'manual',
  });
  return memoryCachedLocation;
}

export function describeLocationSource(source) {
  switch (source) {
    case 'gps':
      return 'Lokasi GPS Perangkat (Izin Aktif)';
    case 'network':
      return 'Deteksi Otomatis Jaringan (IP)';
    case 'history':
      return 'Riwayat Lokasi Tersimpan di Browser';
    case 'manual':
      return 'Pilihan Kota Manual';
    default:
      return 'Lokasi Default (Jakarta)';
  }
}

export async function searchCitiesOnline(query) {
  const clean = String(query || '').trim();
  if (clean.length < 2) return POPULAR_ID_CITIES.slice(0, 6);

  const localMatches = POPULAR_ID_CITIES.filter(
    (c) =>
      c.city.toLowerCase().includes(clean.toLowerCase()) ||
      c.region.toLowerCase().includes(clean.toLowerCase())
  );

  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(clean)}&count=6&language=id&format=json`;
    const res = await fetchWithTimeout(url, 5000);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.results) && data.results.length > 0) {
        return data.results.map((r) => ({
          city: r.name,
          region: r.admin1 || '',
          country: r.country || '',
          lat: r.latitude,
          lon: r.longitude,
        }));
      }
    }
  } catch {
    // Fallback to curated list
  }

  return localMatches;
}
