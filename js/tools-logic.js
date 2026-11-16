/**
 * Pure domain logic for Prayer Times (Indonesia Kemenag), Weather (WMO codes),
 * World Clock (UTC + IANA timezones + WIB/WITA/WIT conversion), and Orthographic Globe math.
 * Zero DOM dependencies so all calculations can be unit tested directly.
 */

export const WORLD_LOCATIONS = [
  { id: 'id-wib', country: 'Indonesia (WIB)', city: 'Jakarta', code: 'ID', timeZone: 'Asia/Jakarta', lat: -6.21, lon: 106.85, region: 'Asia Tenggara' },
  { id: 'id-wita', country: 'Indonesia (WITA)', city: 'Makassar / Bali', code: 'ID', timeZone: 'Asia/Makassar', lat: -5.14, lon: 119.43, region: 'Asia Tenggara' },
  { id: 'id-wit', country: 'Indonesia (WIT)', city: 'Jayapura', code: 'ID', timeZone: 'Asia/Jayapura', lat: -2.59, lon: 140.67, region: 'Asia Tenggara' },
  { id: 'sg', country: 'Singapura', city: 'Singapura', code: 'SG', timeZone: 'Asia/Singapore', lat: 1.35, lon: 103.82, region: 'Asia Tenggara' },
  { id: 'my', country: 'Malaysia', city: 'Kuala Lumpur', code: 'MY', timeZone: 'Asia/Kuala_Lumpur', lat: 3.14, lon: 101.69, region: 'Asia Tenggara' },
  { id: 'th', country: 'Thailand', city: 'Bangkok', code: 'TH', timeZone: 'Asia/Bangkok', lat: 13.76, lon: 100.5, region: 'Asia Tenggara' },
  { id: 'vn', country: 'Vietnam', city: 'Hanoi', code: 'VN', timeZone: 'Asia/Ho_Chi_Minh', lat: 21.03, lon: 105.85, region: 'Asia Tenggara' },
  { id: 'ph', country: 'Filipina', city: 'Manila', code: 'PH', timeZone: 'Asia/Manila', lat: 14.6, lon: 120.98, region: 'Asia Tenggara' },
  { id: 'jp', country: 'Jepang', city: 'Tokyo', code: 'JP', timeZone: 'Asia/Tokyo', lat: 35.68, lon: 139.69, region: 'Asia Timur' },
  { id: 'kr', country: 'Korea Selatan', city: 'Seoul', code: 'KR', timeZone: 'Asia/Seoul', lat: 37.57, lon: 126.98, region: 'Asia Timur' },
  { id: 'cn', country: 'Tiongkok', city: 'Beijing', code: 'CN', timeZone: 'Asia/Shanghai', lat: 39.9, lon: 116.41, region: 'Asia Timur' },
  { id: 'tw', country: 'Taiwan', city: 'Taipei', code: 'TW', timeZone: 'Asia/Taipei', lat: 25.03, lon: 121.57, region: 'Asia Timur' },
  { id: 'in', country: 'India', city: 'New Delhi', code: 'IN', timeZone: 'Asia/Kolkata', lat: 28.61, lon: 77.21, region: 'Asia Selatan' },
  { id: 'sa', country: 'Arab Saudi', city: 'Riyadh / Makkah', code: 'SA', timeZone: 'Asia/Riyadh', lat: 21.42, lon: 39.83, region: 'Timur Tengah' },
  { id: 'ae', country: 'Uni Emirat Arab', city: 'Dubai', code: 'AE', timeZone: 'Asia/Dubai', lat: 25.2, lon: 55.27, region: 'Timur Tengah' },
  { id: 'qa', country: 'Qatar', city: 'Doha', code: 'QA', timeZone: 'Asia/Qatar', lat: 25.29, lon: 51.53, region: 'Timur Tengah' },
  { id: 'tr', country: 'Turki', city: 'Istanbul', code: 'TR', timeZone: 'Europe/Istanbul', lat: 41.01, lon: 28.98, region: 'Eropa & Eurasia' },
  { id: 'au-syd', country: 'Australia', city: 'Sydney', code: 'AU', timeZone: 'Australia/Sydney', lat: -33.87, lon: 151.21, region: 'Oseania' },
  { id: 'nz', country: 'Selandia Baru', city: 'Auckland', code: 'NZ', timeZone: 'Pacific/Auckland', lat: -36.85, lon: 174.76, region: 'Oseania' },
  { id: 'gb', country: 'Inggris', city: 'London', code: 'GB', timeZone: 'Europe/London', lat: 51.51, lon: -0.13, region: 'Eropa' },
  { id: 'fr', country: 'Prancis', city: 'Paris', code: 'FR', timeZone: 'Europe/Paris', lat: 48.86, lon: 2.35, region: 'Eropa' },
  { id: 'de', country: 'Jerman', city: 'Berlin', code: 'DE', timeZone: 'Europe/Berlin', lat: 52.52, lon: 13.4, region: 'Eropa' },
  { id: 'nl', country: 'Belanda', city: 'Amsterdam', code: 'NL', timeZone: 'Europe/Amsterdam', lat: 52.37, lon: 4.9, region: 'Eropa' },
  { id: 'it', country: 'Italia', city: 'Roma', code: 'IT', timeZone: 'Europe/Rome', lat: 41.9, lon: 12.5, region: 'Eropa' },
  { id: 'es', country: 'Spanyol', city: 'Madrid', code: 'ES', timeZone: 'Europe/Madrid', lat: 40.42, lon: -3.7, region: 'Eropa' },
  { id: 'ch', country: 'Swiss', city: 'Zurich', code: 'CH', timeZone: 'Europe/Zurich', lat: 47.37, lon: 8.54, region: 'Eropa' },
  { id: 'ru', country: 'Rusia', city: 'Moskow', code: 'RU', timeZone: 'Europe/Moscow', lat: 55.76, lon: 37.62, region: 'Eropa & Eurasia' },
  { id: 'eg', country: 'Mesir', city: 'Kairo', code: 'EG', timeZone: 'Africa/Cairo', lat: 30.04, lon: 31.24, region: 'Afrika' },
  { id: 'ng', country: 'Nigeria', city: 'Lagos', code: 'NG', timeZone: 'Africa/Lagos', lat: 6.52, lon: 3.38, region: 'Afrika' },
  { id: 'za', country: 'Afrika Selatan', city: 'Johannesburg', code: 'ZA', timeZone: 'Africa/Johannesburg', lat: -26.2, lon: 28.05, region: 'Afrika' },
  { id: 'us-ny', country: 'Amerika Serikat (Timur)', city: 'New York', code: 'US', timeZone: 'America/New_York', lat: 40.71, lon: -74.01, region: 'Amerika' },
  { id: 'us-la', country: 'Amerika Serikat (Barat)', city: 'Los Angeles', code: 'US', timeZone: 'America/Los_Angeles', lat: 34.05, lon: -118.24, region: 'Amerika' },
  { id: 'ca', country: 'Kanada', city: 'Toronto', code: 'CA', timeZone: 'America/Toronto', lat: 43.65, lon: -79.38, region: 'Amerika' },
  { id: 'mx', country: 'Meksiko', city: 'Mexico City', code: 'MX', timeZone: 'America/Mexico_City', lat: 19.43, lon: -99.13, region: 'Amerika' },
  { id: 'br', country: 'Brasil', city: 'Sao Paulo', code: 'BR', timeZone: 'America/Sao_Paulo', lat: -23.55, lon: -46.63, region: 'Amerika' },
  { id: 'ar', country: 'Argentina', city: 'Buenos Aires', code: 'AR', timeZone: 'America/Argentina/Buenos_Aires', lat: -34.6, lon: -58.38, region: 'Amerika' },
];

export const INDONESIA_ZONES = [
  { id: 'wib', label: 'WIB', city: 'Jakarta / Jawa / Sumatra', timeZone: 'Asia/Jakarta', utcLabel: 'UTC+07:00' },
  { id: 'wita', label: 'WITA', city: 'Makassar / Bali / Kalimantan T.', timeZone: 'Asia/Makassar', utcLabel: 'UTC+08:00' },
  { id: 'wit', label: 'WIT', city: 'Jayapura / Maluku / Papua', timeZone: 'Asia/Jayapura', utcLabel: 'UTC+09:00' },
];

export function parsePrayerMinutes(timeStr) {
  const match = String(timeStr || '').match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hh = Number(match[1]);
  const mm = Number(match[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) {
    return null;
  }
  return hh * 60 + mm;
}

const PRAYER_SEQUENCE = [
  { key: 'imsak', label: 'Imsak' },
  { key: 'subuh', label: 'Subuh' },
  { key: 'dzuhur', label: 'Dzuhur' },
  { key: 'ashar', label: 'Ashar' },
  { key: 'maghrib', label: 'Maghrib' },
  { key: 'isya', label: 'Isya' },
];

export function getNextPrayerInfo(timings = {}, now = new Date()) {
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const nowSecondsTotal = nowMinutes * 60 + now.getSeconds();

  const entries = PRAYER_SEQUENCE.map((item) => {
    const raw = String(timings[item.key] || '').trim();
    const mins = parsePrayerMinutes(raw);
    return { ...item, timeStr: raw.slice(0, 5), minutes: mins };
  }).filter((item) => item.minutes !== null);

  if (entries.length === 0) {
    return null;
  }

  let next = entries.find((entry) => entry.minutes * 60 > nowSecondsTotal);
  let allPassedToday = false;

  if (!next) {
    next = entries[0];
    allPassedToday = true;
  }

  let targetSeconds = next.minutes * 60;
  if (allPassedToday) {
    targetSeconds += 24 * 3600;
  }

  const diffSeconds = Math.max(0, targetSeconds - nowSecondsTotal);
  const hh = String(Math.floor(diffSeconds / 3600)).padStart(2, '0');
  const mm = String(Math.floor((diffSeconds % 3600) / 60)).padStart(2, '0');
  const ss = String(diffSeconds % 60).padStart(2, '0');

  return {
    key: next.key,
    label: next.label,
    timeStr: next.timeStr,
    remainingMs: diffSeconds * 1000,
    countdownText: `${hh}:${mm}:${ss}`,
    allPassedToday,
  };
}

export function matchIndonesianCityQuery(cities = [], query = '') {
  const clean = String(query || '')
    .toLowerCase()
    .replace(/\b(kota|kab\.?|kabupaten|special capital region of|daerah khusus ibukota|daerah istimewa)\b/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!clean || !Array.isArray(cities) || cities.length === 0) return null;

  const exact = cities.find((c) => c.lokasi.toLowerCase() === clean);
  if (exact) return exact;

  const kotaMatch = cities.find((c) => {
    const loc = c.lokasi.toLowerCase();
    return loc === `kota ${clean}` || loc === `kab. ${clean}`;
  });
  if (kotaMatch) return kotaMatch;

  const partial = cities.find((c) => c.lokasi.toLowerCase().includes(clean));
  if (partial) return partial;

  const tokens = clean.split(' ').filter((t) => t.length >= 3);
  for (const token of tokens) {
    const tokenMatch = cities.find((c) => c.lokasi.toLowerCase().includes(token));
    if (tokenMatch) return tokenMatch;
  }

  return null;
}

function cleanGeoToken(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isRtRwLabel(value) {
  return /^(rt|rw)\s*\d+/i.test(cleanGeoToken(value));
}

export function isIndonesiaLocation(loc = {}) {
  const country = String(loc?.country || '').toLowerCase();
  if (country.includes('indonesia')) return true;
  const lat = Number(loc?.lat);
  const lon = Number(loc?.lon);
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -11.5 &&
    lat <= 6.5 &&
    lon >= 94.5 &&
    lon <= 141.5
  );
}

export function parseIndonesianAddressHierarchy(sources = {}) {
  const nom = sources.nominatim?.address || sources.nominatim || null;
  const bdc = sources.bigdatacloud || null;
  const pho = sources.photon?.properties || sources.photon || null;

  let kelurahan = '';
  let kecamatan = '';
  let city = '';
  let region = '';
  let country = '';

  if (nom && typeof nom === 'object') {
    const rawKel = nom.village || nom.suburb || nom.quarter || nom.neighbourhood || '';
    if (rawKel && !isRtRwLabel(rawKel)) kelurahan = cleanGeoToken(rawKel);

    const rawKec =
      nom.district ||
      nom.municipality ||
      nom.subdistrict ||
      nom.city_district ||
      '';
    if (rawKec && !isRtRwLabel(rawKec)) kecamatan = cleanGeoToken(rawKec);

    city = cleanGeoToken(
      nom.city ||
        nom.town ||
        nom.county ||
        nom.regency ||
        nom.state_district ||
        nom.city_district ||
        ''
    );
    region = cleanGeoToken(nom.state || nom.province || '');
    country = cleanGeoToken(nom.country || '');
  }

  if (bdc && typeof bdc === 'object') {
    const admins = Array.isArray(bdc.localityInfo?.administrative)
      ? bdc.localityInfo.administrative
      : [];
    const byDesc = (pattern) =>
      admins.find((a) => pattern.test(String(a?.description || '')));
    const bdcKel =
      byDesc(/kelurahan|desa|sub-district|village/i)?.name || '';
    const bdcKec =
      byDesc(/kecamatan|district of/i)?.name || bdc.locality || '';
    const bdcCity =
      byDesc(/kota\b|kabupaten|city|regency/i)?.name || bdc.city || '';
    const bdcRegion =
      byDesc(/provinsi|province/i)?.name || bdc.principalSubdivision || '';

    if (!kelurahan && bdcKel && !isRtRwLabel(bdcKel) && bdcKel !== bdcKec) {
      kelurahan = cleanGeoToken(bdcKel);
    }
    if (!kecamatan && bdcKec && !isRtRwLabel(bdcKec)) {
      kecamatan = cleanGeoToken(bdcKec);
    }
    if (!city && bdcCity) city = cleanGeoToken(bdcCity);
    if (!region && bdcRegion) region = cleanGeoToken(bdcRegion);
    if (!country && bdc.countryName) country = cleanGeoToken(bdc.countryName);
  }

  if (pho && typeof pho === 'object') {
    const phoDistrict = cleanGeoToken(pho.district || '');
    const phoCity = cleanGeoToken(pho.city || pho.county || '');
    const phoState = cleanGeoToken(pho.state || '');
    if (!kelurahan && phoDistrict && !isRtRwLabel(phoDistrict) && phoDistrict !== kecamatan) {
      kelurahan = phoDistrict;
    }
    if (!city && phoCity) city = phoCity;
    if (!region && phoState) region = phoState;
    if (!country && pho.country) country = cleanGeoToken(pho.country);
  }

  // Avoid duplicating same label across levels (e.g. Gambir = Gambir or Jakarta = DKI Jakarta)
  if (kelurahan && kecamatan && kelurahan.toLowerCase() === kecamatan.toLowerCase()) {
    kelurahan = '';
  }
  if (kecamatan && city && kecamatan.toLowerCase() === city.toLowerCase()) {
    kecamatan = '';
  }

  return {
    kelurahan,
    kecamatan,
    city: city || kecamatan || region || '',
    region,
    country: country || 'Indonesia',
  };
}

export function formatDetailedLocationLabel(loc = {}) {
  const parts = [];
  const seen = new Set();
  const pushUnique = (prefix, rawVal) => {
    const clean = cleanGeoToken(rawVal);
    if (!clean) return;
    const key = clean
      .toLowerCase()
      .replace(/^(kel\.?|desa|kec\.?|kota|kab\.?)\s+/i, '');
    if (seen.has(key)) return;
    seen.add(key);
    const hasPrefix = /^(kel\.?|desa|kec\.?|kota|kab\.?)\s+/i.test(clean);
    parts.push(prefix && !hasPrefix ? `${prefix} ${clean}` : clean);
  };

  pushUnique('Kel.', loc.kelurahan);
  pushUnique('Kec.', loc.kecamatan);
  pushUnique('', loc.city);
  if (parts.length < 2) {
    pushUnique('', loc.region);
  }
  return parts.join(', ') || cleanGeoToken(loc.city) || 'Lokasi Anda';
}

export function describeWeatherCode(code, isDay = 1) {
  const numeric = Number(code);
  const day = Boolean(Number(isDay));
  if (numeric === 0) {
    return {
      label: day ? 'Cerah' : 'Cerah Malam',
      iconKey: day ? 'sun' : 'moon',
      tone: 'clear',
    };
  }
  if (numeric === 1 || numeric === 2) {
    return {
      label: numeric === 1 ? 'Umumnya Cerah' : 'Berawan Sebagian',
      iconKey: day ? 'partly-cloudy' : 'cloudy-night',
      tone: 'partly',
    };
  }
  if (numeric === 3) {
    return { label: 'Berawan Tebal', iconKey: 'cloud', tone: 'cloudy' };
  }
  if (numeric === 45 || numeric === 48) {
    return { label: 'Berkabut', iconKey: 'fog', tone: 'fog' };
  }
  if (numeric >= 51 && numeric <= 57) {
    return { label: 'Gerimis', iconKey: 'drizzle', tone: 'rain' };
  }
  if ((numeric >= 61 && numeric <= 67) || (numeric >= 80 && numeric <= 82)) {
    const heavy = numeric === 65 || numeric === 82;
    return {
      label: heavy ? 'Hujan Lebat' : numeric === 61 || numeric === 80 ? 'Hujan Ringan' : 'Hujan Sedang',
      iconKey: 'rain',
      tone: 'rain',
    };
  }
  if (numeric >= 71 && numeric <= 77) {
    return { label: 'Salju / Dingin Ekstrem', iconKey: 'snow', tone: 'cloudy' };
  }
  if (numeric >= 95 && numeric <= 99) {
    return { label: 'Hujan Disertai Petir', iconKey: 'storm', tone: 'storm' };
  }
  return { label: 'Berawan', iconKey: 'cloud', tone: 'cloudy' };
}

function extractFormatterParts(date, timeZone) {
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const map = {};
  for (const part of dtf.formatToParts(date)) {
    if (part.type !== 'literal') {
      map[part.type] = part.value;
    }
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour === '24' ? 0 : map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

export function getZoneOffsetMinutes(date = new Date(), timeZone = 'UTC') {
  if (timeZone === 'UTC' || timeZone === 'Etc/UTC') return 0;
  const utcParts = extractFormatterParts(date, 'UTC');
  const zoneParts = extractFormatterParts(date, timeZone);

  const utcMs = Date.UTC(
    utcParts.year,
    utcParts.month - 1,
    utcParts.day,
    utcParts.hour,
    utcParts.minute,
    utcParts.second
  );
  const zoneMs = Date.UTC(
    zoneParts.year,
    zoneParts.month - 1,
    zoneParts.day,
    zoneParts.hour,
    zoneParts.minute,
    zoneParts.second
  );
  return Math.round((zoneMs - utcMs) / 60000);
}

export function formatUtcOffsetLabel(offsetMinutes = 0) {
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(Math.round(offsetMinutes));
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  return `UTC${sign}${hh}:${mm}`;
}

export function getZoneTimeParts(date = new Date(), timeZone = 'UTC') {
  const p = extractFormatterParts(date, timeZone);
  const offsetMinutes = getZoneOffsetMinutes(date, timeZone);
  const pad = (n) => String(n).padStart(2, '0');

  const dateLabel = new Intl.DateTimeFormat('id-ID', {
    timeZone,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);

  const weekdayLabel = new Intl.DateTimeFormat('id-ID', {
    timeZone,
    weekday: 'long',
  }).format(date);

  return {
    ...p,
    isoDate: `${p.year}-${pad(p.month)}-${pad(p.day)}`,
    time24: `${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}`,
    timeShort: `${pad(p.hour)}:${pad(p.minute)}`,
    dateLabel,
    weekdayLabel,
    offsetMinutes,
    offsetLabel: formatUtcOffsetLabel(offsetMinutes),
  };
}

function zonedWallTimeToInstant(dateStr, timeStr, sourceTimeZone) {
  const [y, m, d] = String(dateStr || '').split('-').map(Number);
  const [hh, mm] = String(timeStr || '00:00').split(':').map(Number);
  if (!y || !m || !d || !Number.isFinite(hh) || !Number.isFinite(mm)) {
    return new Date();
  }
  const approxUtc = Date.UTC(y, m - 1, d, hh, mm, 0);
  const initialOffset = getZoneOffsetMinutes(new Date(approxUtc), sourceTimeZone);
  let candidate = new Date(approxUtc - initialOffset * 60000);
  const refinedOffset = getZoneOffsetMinutes(candidate, sourceTimeZone);
  if (refinedOffset !== initialOffset) {
    candidate = new Date(approxUtc - refinedOffset * 60000);
  }
  return candidate;
}

function computeDayDelta(sourceIsoDate, targetIsoDate) {
  const [sy, sm, sd] = sourceIsoDate.split('-').map(Number);
  const [ty, tm, td] = targetIsoDate.split('-').map(Number);
  const diffDays = Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(sy, sm - 1, sd)) / 86400000);
  if (diffDays === 0) return { diffDays: 0, dayDeltaLabel: 'Hari yang sama' };
  if (diffDays > 0) return { diffDays, dayDeltaLabel: `+${diffDays} hari` };
  return { diffDays, dayDeltaLabel: `${diffDays} hari` };
}

export function convertWorldTime({
  dateStr,
  timeStr,
  sourceTimeZone = 'Asia/Jakarta',
  targetTimeZone = 'Asia/Tokyo',
}) {
  const instant = zonedWallTimeToInstant(dateStr, timeStr, sourceTimeZone);
  const sourceParts = getZoneTimeParts(instant, sourceTimeZone);

  const buildEntry = (tz) => {
    const parts = getZoneTimeParts(instant, tz);
    const delta = computeDayDelta(sourceParts.isoDate, parts.isoDate);
    return { ...parts, ...delta, timeZone: tz };
  };

  return {
    instantIso: instant.toISOString(),
    source: { ...sourceParts, timeZone: sourceTimeZone },
    target: buildEntry(targetTimeZone),
    utc: buildEntry('UTC'),
    wib: buildEntry('Asia/Jakarta'),
    wita: buildEntry('Asia/Makassar'),
    wit: buildEntry('Asia/Jayapura'),
  };
}

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

export function normalizeLongitude(lon) {
  let res = ((lon + 180) % 360 + 360) % 360 - 180;
  if (res === -180) res = 180;
  return res;
}

export function projectOrthographic(latDeg, lonDeg, centerLatDeg, centerLonDeg, radius, cx, cy) {
  const phi = latDeg * DEG2RAD;
  const lambda = lonDeg * DEG2RAD;
  const phi0 = centerLatDeg * DEG2RAD;
  const lambda0 = centerLonDeg * DEG2RAD;
  const dLambda = lambda - lambda0;

  const sinPhi = Math.sin(phi);
  const cosPhi = Math.cos(phi);
  const sinPhi0 = Math.sin(phi0);
  const cosPhi0 = Math.cos(phi0);
  const cosDLambda = Math.cos(dLambda);

  const z = sinPhi0 * sinPhi + cosPhi0 * cosPhi * cosDLambda;
  const x = cx + radius * cosPhi * Math.sin(dLambda);
  const y = cy - radius * (cosPhi0 * sinPhi - sinPhi0 * cosPhi * cosDLambda);

  return { x, y, z, visible: z >= 0 };
}

export function inverseOrthographic(px, py, centerLatDeg, centerLonDeg, radius, cx, cy) {
  const dx = (px - cx) / radius;
  const dy = (cy - py) / radius;
  const rho = Math.hypot(dx, dy);
  if (rho > 1) return null;

  const phi0 = centerLatDeg * DEG2RAD;
  const lambda0 = centerLonDeg * DEG2RAD;

  if (rho < 1e-6) {
    return { lat: centerLatDeg, lon: normalizeLongitude(centerLonDeg) };
  }

  const c = Math.asin(Math.min(1, rho));
  const sinC = Math.sin(c);
  const cosC = Math.cos(c);

  const phi = Math.asin(cosC * Math.sin(phi0) + (dy * sinC * Math.cos(phi0)) / rho);
  const lambda =
    lambda0 +
    Math.atan2(
      dx * sinC,
      rho * Math.cos(phi0) * cosC - dy * Math.sin(phi0) * sinC
    );

  return {
    lat: phi * RAD2DEG,
    lon: normalizeLongitude(lambda * RAD2DEG),
  };
}

export function findNearestLocationOnGlobe(
  px,
  py,
  locations = WORLD_LOCATIONS,
  centerLatDeg,
  centerLonDeg,
  radius,
  cx,
  cy,
  maxDistPx = 28
) {
  let best = null;
  let bestDist = Infinity;

  for (const loc of locations) {
    const proj = projectOrthographic(loc.lat, loc.lon, centerLatDeg, centerLonDeg, radius, cx, cy);
    if (!proj.visible) continue;
    const dist = Math.hypot(px - proj.x, py - proj.y);
    if (dist <= maxDistPx && dist < bestDist) {
      best = { location: loc, distance: dist, x: proj.x, y: proj.y };
      bestDist = dist;
    }
  }

  if (best) return best;

  // Fallback: if click is inside globe sphere, pick nearest visible country by spherical distance
  const clickedCoords = inverseOrthographic(px, py, centerLatDeg, centerLonDeg, radius, cx, cy);
  if (!clickedCoords) return null;

  const toRad = (d) => d * DEG2RAD;
  let nearestByAngle = null;
  let minAngle = Infinity;

  for (const loc of locations) {
    const proj = projectOrthographic(loc.lat, loc.lon, centerLatDeg, centerLonDeg, radius, cx, cy);
    if (!proj.visible) continue;
    const dLat = toRad(loc.lat - clickedCoords.lat);
    const dLon = toRad(loc.lon - clickedCoords.lon);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(clickedCoords.lat)) * Math.cos(toRad(loc.lat)) * Math.sin(dLon / 2) ** 2;
    const angularDist = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    if (angularDist < 0.42 && angularDist < minAngle) {
      minAngle = angularDist;
      nearestByAngle = { location: loc, distance: angularDist * radius, x: proj.x, y: proj.y };
    }
  }

  return nearestByAngle;
}

const CLOUDFLARE_COLOS = {
  CGK: 'Jakarta, Indonesia',
  SUB: 'Surabaya, Indonesia',
  DPS: 'Denpasar, Indonesia',
  KNO: 'Medan, Indonesia',
  UPG: 'Makassar, Indonesia',
  SIN: 'Singapura',
  KUL: 'Kuala Lumpur, Malaysia',
  BKK: 'Bangkok, Thailand',
  MNL: 'Manila, Filipina',
  HKG: 'Hong Kong',
  TPE: 'Taipei, Taiwan',
  NRT: 'Tokyo, Jepang',
  KIX: 'Osaka, Jepang',
  ICN: 'Seoul, Korea Selatan',
  BOM: 'Mumbai, India',
  DEL: 'New Delhi, India',
  DXB: 'Dubai, UEA',
  SYD: 'Sydney, Australia',
  MEL: 'Melbourne, Australia',
  LHR: 'London, Inggris',
  AMS: 'Amsterdam, Belanda',
  FRA: 'Frankfurt, Jerman',
  LAX: 'Los Angeles, AS',
  SJC: 'San Jose, AS',
  EWR: 'Newark, AS',
};

export function describeCloudflareColo(code) {
  const clean = String(code || '').trim().toUpperCase();
  if (!clean) return 'Server CDN Global';
  const city = CLOUDFLARE_COLOS[clean];
  return city ? `${city} (${clean})` : `Node ${clean}`;
}

export function computeMbps(bytesTransferred, durationMs) {
  const bytes = Number(bytesTransferred);
  const ms = Number(durationMs);
  if (!Number.isFinite(bytes) || !Number.isFinite(ms) || bytes <= 0 || ms <= 0) {
    return 0;
  }
  const mbps = (bytes * 8) / (ms / 1000) / 1_000_000;
  return Number(mbps.toFixed(2));
}

export function computeSustainedAverageMbps({ stages = [], samples = [] } = {}) {
  const validStages = (Array.isArray(stages) ? stages : []).filter(
    (s) => s && Number(s.bytes) > 0 && Number(s.durationMs) > 0
  );
  if (validStages.length > 0) {
    // Discard tiny warmup stage (index 0) when sustained larger stages ran
    const measured = validStages.length >= 2 ? validStages.slice(1) : validStages;
    const totalBytes = measured.reduce((sum, s) => sum + Number(s.bytes), 0);
    const totalMs = measured.reduce((sum, s) => sum + Number(s.durationMs), 0);
    if (totalBytes > 0 && totalMs > 0) {
      return computeMbps(totalBytes, totalMs);
    }
  }

  const validSamples = (Array.isArray(samples) ? samples : [])
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0);
  if (validSamples.length === 0) return 0;

  if (validSamples.length >= 5) {
    const sorted = [...validSamples].sort((a, b) => a - b);
    const trim = Math.max(1, Math.floor(sorted.length * 0.1));
    const core = sorted.slice(trim, sorted.length - trim);
    const avg = core.reduce((a, b) => a + b, 0) / core.length;
    return Number(avg.toFixed(2));
  }

  const avg = validSamples.reduce((a, b) => a + b, 0) / validSamples.length;
  return Number(avg.toFixed(2));
}

export function calculatePingStats(samplesMs = []) {
  const valid = (Array.isArray(samplesMs) ? samplesMs : [])
    .map(Number)
    .filter((n) => Number.isFinite(n) && n >= 0);

  if (valid.length === 0) {
    return { minMs: 0, avgMs: 0, maxMs: 0, jitterMs: 0, sampleCount: 0 };
  }

  const minMs = Math.min(...valid);
  const maxMs = Math.max(...valid);
  const avgMs = valid.reduce((sum, val) => sum + val, 0) / valid.length;

  let jitterMs = 0;
  if (valid.length > 1) {
    let diffSum = 0;
    for (let i = 1; i < valid.length; i += 1) {
      diffSum += Math.abs(valid[i] - valid[i - 1]);
    }
    jitterMs = diffSum / (valid.length - 1);
  }

  return {
    minMs: Math.round(minMs),
    avgMs: Math.round(avgMs),
    maxMs: Math.round(maxMs),
    jitterMs: Number(jitterMs.toFixed(1)),
    sampleCount: valid.length,
  };
}

const GAUGE_SCALE_STOPS = [0, 5, 10, 25, 50, 100, 250, 500, 1000];

export function speedToGaugeRatio(mbps = 0) {
  const val = Math.max(0, Number(mbps) || 0);
  if (val <= 0) return 0;
  const maxStop = GAUGE_SCALE_STOPS[GAUGE_SCALE_STOPS.length - 1];
  if (val >= maxStop) return 1;

  const segments = GAUGE_SCALE_STOPS.length - 1;
  for (let i = 0; i < segments; i += 1) {
    const low = GAUGE_SCALE_STOPS[i];
    const high = GAUGE_SCALE_STOPS[i + 1];
    if (val <= high) {
      const localProgress = (val - low) / (high - low);
      return (i + localProgress) / segments;
    }
  }
  return 1;
}

export function evaluateConnectionQuality({
  downloadMbps = 0,
  uploadMbps = 0,
  pingMs = 0,
  jitterMs = 0,
} = {}) {
  const dl = Number(downloadMbps) || 0;
  const ul = Number(uploadMbps) || 0;
  const ping = Number(pingMs) || 0;
  const jitter = Number(jitterMs) || 0;

  let grade = 'Sangat Cepat';
  let tone = 'excellent';
  if (dl >= 100 && ul >= 25 && ping <= 45) {
    grade = 'Sangat Cepat';
    tone = 'excellent';
  } else if (dl >= 40 && ul >= 10 && ping <= 75) {
    grade = 'Cepat & Stabil';
    tone = 'good';
  } else if (dl >= 15 && ul >= 5 && ping <= 120) {
    grade = 'Cukup Stabil';
    tone = 'fair';
  } else {
    grade = 'Perlu Optimasi';
    tone = 'slow';
  }

  return {
    grade,
    tone,
    suitability: [
      { label: 'Streaming 4K', ok: dl >= 25 },
      { label: 'Video Call HD', ok: dl >= 5 && ul >= 3 && jitter <= 30 },
      { label: 'Gaming Online', ok: ping > 0 && ping <= 65 && jitter <= 20 },
      { label: 'Upload File Besar', ok: ul >= 15 },
    ],
  };
}

export function parseDeviceTelemetry(env = {}) {
  const ua = String(env.userAgent || '');
  const uad = env.userAgentData || null;
  const platformRaw = String(uad?.platform || env.platform || '');

  let os = 'Perangkat Lain';
  if (/android/i.test(ua)) os = 'Android';
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS / iPadOS';
  else if (/windows/i.test(ua) || /win/i.test(platformRaw)) os = 'Windows';
  else if (/mac/i.test(ua) || /mac/i.test(platformRaw)) os = 'macOS';
  else if (/linux/i.test(ua) || /linux/i.test(platformRaw)) os = 'Linux';

  let browser = 'Browser Web';
  if (/edg\//i.test(ua)) browser = 'Microsoft Edge';
  else if (/opr\/|opera/i.test(ua)) browser = 'Opera';
  else if (/chrome|crios/i.test(ua)) browser = 'Google Chrome';
  else if (/firefox|fxios/i.test(ua)) browser = 'Mozilla Firefox';
  else if (/safari/i.test(ua)) browser = 'Safari';

  const isMobile = Boolean(uad?.mobile) || /android|iphone|ipad|ipod|mobile/i.test(ua);
  const deviceType = isMobile ? 'Mobile / HP' : 'Desktop / Laptop';

  const cores = Number(env.hardwareConcurrency) > 0 ? `${env.hardwareConcurrency} Core` : '-';
  const memory = Number(env.deviceMemory) > 0 ? `${env.deviceMemory} GB RAM` : '-';
  const screenText =
    Number(env.screenWidth) > 0 && Number(env.screenHeight) > 0
      ? `${env.screenWidth}×${env.screenHeight}`
      : '-';

  const conn = env.connection || null;
  let networkType = 'Tidak terdeteksi';
  if (conn) {
    const parts = [];
    if (conn.type && conn.type !== 'unknown') parts.push(String(conn.type).toUpperCase());
    if (conn.effectiveType) parts.push(String(conn.effectiveType).toUpperCase());
    if (Number(conn.downlink) > 0) parts.push(`~${conn.downlink} Mbps`);
    if (parts.length > 0) networkType = parts.join(' · ');
  }

  return {
    os,
    browser,
    deviceType,
    cores,
    memory,
    screenText,
    networkType,
  };
}

export function detectDownloaderPlatform(rawUrl) {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) return null;
  const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let host = '';
  try {
    host = new URL(normalized).hostname.toLowerCase();
  } catch {
    return null;
  }

  if (host === 'tiktok.com' || host.endsWith('.tiktok.com')) return 'tiktok';
  if (
    host === 'youtube.com' ||
    host.endsWith('.youtube.com') ||
    host === 'youtu.be' ||
    host.endsWith('.youtu.be')
  ) {
    return 'youtube';
  }
  if (host === 'instagram.com' || host.endsWith('.instagram.com') || host === 'instagr.am') {
    return 'instagram';
  }
  if (host === 'facebook.com' || host.endsWith('.facebook.com') || host === 'fb.watch') {
    return 'facebook';
  }
  return null;
}

export function isBlockedRedirectDownloadUrl(rawUrl) {
  const s = String(rawUrl || '').trim();
  if (!/^https?:\/\//i.test(s)) return true;
  let parsed;
  try {
    parsed = new URL(s);
  } catch {
    return true;
  }
  const host = parsed.hostname.toLowerCase();
  const blockedHosts = [
    'ytshortdown.com',
    'savetube.vip',
    'cdn401.savetube.vip',
    'cdn402.savetube.vip',
    'cdn403.savetube.vip',
    'cdn404.savetube.vip',
    'cdn405.savetube.vip',
    'y2mate.com',
    'ssyoutube.com',
  ];
  if (blockedHosts.some((b) => host === b || host.endsWith(`.${b}`))) {
    return true;
  }
  if (/\.html?(\?|$)/i.test(parsed.pathname)) {
    return true;
  }
  return false;
}

function inferAudioExtFromUrl(url, fallback = 'mp3') {
  const raw = String(url || '');
  if (/mime=audio(?:%2F|\/)webm|\.webm(\?|$)/i.test(raw)) return 'webm';
  if (/mime=audio(?:%2F|\/)mp4|\.m4a(\?|$)/i.test(raw)) return 'm4a';
  if (/\.ogg(\?|$)/i.test(raw)) return 'ogg';
  return fallback;
}

function normalizeCobaltEntry(entry, { isAudio = false, quality = '' } = {}) {
  if (!entry || typeof entry !== 'object') return null;
  if (entry.status === 'error') return null;

  if (entry.status === 'picker' && Array.isArray(entry.picker)) {
    return entry.picker
      .map((p) => {
        const u = String(p?.url || '').trim();
        if (!u || isBlockedRedirectDownloadUrl(u)) return null;
        const isImg = p.type === 'photo' || /\.(jpg|jpeg|png|webp)(\?|$)/i.test(u);
        return {
          label: isImg ? 'Foto Media' : isAudio ? 'Audio Media' : 'Video Media',
          quality: isImg ? 'JPG' : quality || 'HD MP4',
          ext: isImg ? 'jpg' : isAudio ? inferAudioExtFromUrl(u, 'mp3') : 'mp4',
          url: u,
          isAudio: !isImg && isAudio,
          thumb: p.thumb || '',
        };
      })
      .filter(Boolean);
  }

  const u = String(entry.url || '').trim();
  if (!u || isBlockedRedirectDownloadUrl(u)) return null;
  const filename = String(entry.filename || '');
  const ext = isAudio
    ? filename.match(/\.(mp3|m4a|ogg|webm|opus)$/i)?.[1]?.toLowerCase() || inferAudioExtFromUrl(u, 'mp3')
    : filename.match(/\.(mp4|webm|jpg|jpeg|png)$/i)?.[1]?.toLowerCase() || 'mp4';

  return [
    {
      label: isAudio ? `Audio ${ext.toUpperCase()} Langsung` : `Video ${quality || 'HD'} MP4`,
      quality: quality || ext.toUpperCase(),
      ext,
      url: u,
      isAudio,
      filename,
    },
  ];
}

export function normalizeDownloaderResult(raw, platform) {
  const safePlatform = String(platform || '').toLowerCase();
  if (!raw || typeof raw !== 'object') return null;

  if (safePlatform === 'tiktok') {
    const d = raw.data || null;
    if (d && (d.hdplay || d.play || d.music)) {
      const links = [];
      if (d.hdplay && !isBlockedRedirectDownloadUrl(d.hdplay)) {
        links.push({ label: 'Video HD Tanpa Watermark', quality: 'HD MP4', ext: 'mp4', url: String(d.hdplay), isAudio: false });
      }
      if (d.play && d.play !== d.hdplay && !isBlockedRedirectDownloadUrl(d.play)) {
        links.push({ label: 'Video MP4 Tanpa Watermark', quality: 'SD MP4', ext: 'mp4', url: String(d.play), isAudio: false });
      }
      if (d.music && !isBlockedRedirectDownloadUrl(d.music)) {
        links.push({ label: 'Audio / Sound TikTok', quality: 'MP3', ext: 'mp3', url: String(d.music), isAudio: true });
      }
      if (links.length === 0) return null;
      return {
        platform: 'tiktok',
        title: String(d.title || 'Video TikTok'),
        author: String(d.author?.nickname || d.author?.unique_id || 'Kreator TikTok'),
        thumbnail: String(d.cover || d.origin_cover || ''),
        durationSec: Number(d.duration || 0),
        links,
      };
    }

    // Cobalt fallback for TikTok
    const cobaltTt = normalizeCobaltEntry(raw, { isAudio: false, quality: 'HD MP4' });
    if (cobaltTt && cobaltTt.length > 0) {
      return {
        platform: 'tiktok',
        title: String(raw.filename || 'Video TikTok').replace(/\.[a-z0-9]{2,4}$/i, ''),
        author: 'TikTok',
        thumbnail: '',
        durationSec: 0,
        links: cobaltTt,
      };
    }

    const r = raw.result || null;
    if (r && (r.video || r.music)) {
      const links = [];
      if (r.video && !isBlockedRedirectDownloadUrl(r.video)) {
        links.push({ label: 'Video Tanpa Watermark', quality: 'MP4', ext: 'mp4', url: String(r.video), isAudio: false });
      }
      if (r.music && !isBlockedRedirectDownloadUrl(r.music)) {
        links.push({ label: 'Audio / Sound TikTok', quality: 'MP3', ext: 'mp3', url: String(r.music), isAudio: true });
      }
      if (links.length === 0) return null;
      return {
        platform: 'tiktok',
        title: String(r.desc || r.title || 'Video TikTok'),
        author: String(r.author?.nickname || 'Kreator TikTok'),
        thumbnail: String(r.author?.avatar || ''),
        durationSec: 0,
        links,
      };
    }
  }

  if (safePlatform === 'youtube') {
    const links = [];
    let title = String(raw.oembed?.title || raw.tioo?.title || '');
    let author = String(raw.oembed?.author_name || raw.tioo?.author || 'YouTube');
    let thumbnail = String(raw.oembed?.thumbnail_url || raw.tioo?.thumbnail || '');
    let durationSec = 0;

    // 1. Video candidates: Cobalt video -> Tioo MP4 -> DavidCyril MP4
    const cobaltVideo = normalizeCobaltEntry(raw.cobaltVideo, { isAudio: false, quality: '720p MP4' });
    if (cobaltVideo?.[0]) {
      links.push({ ...cobaltVideo[0], label: 'Video YouTube (HD MP4)', quality: '720p MP4' });
      if (!title && cobaltVideo[0].filename) {
        title = cobaltVideo[0].filename.replace(/\s*\([^)]*\)\.[a-z0-9]+$/i, '');
      }
    } else if (raw.tioo?.mp4 && !isBlockedRedirectDownloadUrl(raw.tioo.mp4)) {
      links.push({ label: 'Video YouTube (MP4)', quality: 'MP4', ext: 'mp4', url: String(raw.tioo.mp4), isAudio: false });
    } else if (raw.mp4?.result?.download_url && !isBlockedRedirectDownloadUrl(raw.mp4.result.download_url)) {
      const mp4 = raw.mp4.result;
      links.push({
        label: `Video YouTube (${mp4.quality || 'HD'})`,
        quality: String(mp4.quality || 'MP4'),
        ext: 'mp4',
        url: String(mp4.download_url),
        isAudio: false,
      });
      if (!title) title = String(mp4.title || '');
      if (!thumbnail) thumbnail = String(mp4.thumbnail || '');
      durationSec = Number(mp4.duration || 0);
    }

    // 2. Direct Audio candidates: Cobalt MP3 tunnel (never savetube/ytshortdown redirect) -> Tioo audio
    const cobaltAudio = normalizeCobaltEntry(raw.cobaltAudio, { isAudio: true, quality: 'MP3' });
    if (cobaltAudio?.[0]) {
      links.push({
        ...cobaltAudio[0],
        label: 'Musik / Audio YouTube (MP3)',
        quality: cobaltAudio[0].ext.toUpperCase(),
      });
      if (!title && cobaltAudio[0].filename) {
        title = cobaltAudio[0].filename.replace(/\.[a-z0-9]+$/i, '');
      }
    } else if (raw.tioo?.mp3 && !isBlockedRedirectDownloadUrl(raw.tioo.mp3)) {
      const ext = inferAudioExtFromUrl(raw.tioo.mp3, 'mp3');
      links.push({
        label: `Musik / Audio YouTube (${ext.toUpperCase()})`,
        quality: ext.toUpperCase(),
        ext,
        url: String(raw.tioo.mp3),
        isAudio: true,
      });
    } else if (raw.mp3?.result?.download_url && !isBlockedRedirectDownloadUrl(raw.mp3.result.download_url)) {
      const mp3 = raw.mp3.result;
      const ext = inferAudioExtFromUrl(mp3.download_url, 'mp3');
      links.push({
        label: `Audio YouTube (${mp3.quality || ext.toUpperCase()})`,
        quality: String(mp3.quality || ext.toUpperCase()),
        ext,
        url: String(mp3.download_url),
        isAudio: true,
      });
    }

    if (links.length === 0) return null;
    return {
      platform: 'youtube',
      title: title || 'Video & Audio YouTube',
      author,
      thumbnail,
      durationSec,
      links,
    };
  }

  if (safePlatform === 'facebook') {
    const cobaltFb = normalizeCobaltEntry(raw, { isAudio: false, quality: 'HD MP4' });
    if (cobaltFb && cobaltFb.length > 0) {
      return {
        platform: 'facebook',
        title: String(raw.filename || 'Video Facebook').replace(/\.[a-z0-9]{2,4}$/i, ''),
        author: 'Facebook',
        thumbnail: '',
        durationSec: 0,
        links: cobaltFb,
      };
    }

    const r = raw.result || raw;
    const dl = r?.downloads || null;
    const links = [];
    if (dl?.hd?.url && !isBlockedRedirectDownloadUrl(dl.hd.url)) {
      links.push({ label: 'Video Facebook HD', quality: 'HD MP4', ext: 'mp4', url: String(dl.hd.url), isAudio: false });
    }
    if (dl?.sd?.url && !isBlockedRedirectDownloadUrl(dl.sd.url)) {
      links.push({ label: 'Video Facebook SD', quality: 'SD MP4', ext: 'mp4', url: String(dl.sd.url), isAudio: false });
    }
    if (typeof r?.hd === 'string' && r.hd && !isBlockedRedirectDownloadUrl(r.hd)) {
      links.push({ label: 'Video Facebook HD', quality: 'HD MP4', ext: 'mp4', url: r.hd, isAudio: false });
    }
    if (typeof r?.sd === 'string' && r.sd && !isBlockedRedirectDownloadUrl(r.sd)) {
      links.push({ label: 'Video Facebook SD', quality: 'SD MP4', ext: 'mp4', url: r.sd, isAudio: false });
    }
    if (typeof r?.HD === 'string' && r.HD && !isBlockedRedirectDownloadUrl(r.HD)) {
      links.push({ label: 'Video Facebook HD', quality: 'HD MP4', ext: 'mp4', url: r.HD, isAudio: false });
    }
    if (typeof r?.Normal_video === 'string' && r.Normal_video && !isBlockedRedirectDownloadUrl(r.Normal_video)) {
      links.push({ label: 'Video Facebook SD', quality: 'SD MP4', ext: 'mp4', url: r.Normal_video, isAudio: false });
    }
    if (links.length === 0) return null;
    return {
      platform: 'facebook',
      title: String(r.title || 'Video Facebook'),
      author: 'Facebook',
      thumbnail: String(r.thumbnail || ''),
      durationSec: 0,
      links,
    };
  }

  if (safePlatform === 'instagram') {
    const cobaltIg = normalizeCobaltEntry(raw, { isAudio: false, quality: 'HD MP4' });
    if (cobaltIg && cobaltIg.length > 0) {
      return {
        platform: 'instagram',
        title: String(raw.filename || 'Reels / Post Instagram').replace(/\.[a-z0-9]{2,4}$/i, ''),
        author: 'Instagram',
        thumbnail: cobaltIg[0]?.thumb || '',
        durationSec: 0,
        links: cobaltIg,
      };
    }

    const list = Array.isArray(raw)
      ? raw
      : Array.isArray(raw.result)
      ? raw.result
      : Array.isArray(raw.data)
      ? raw.data
      : raw.result?.downloadUrl || raw.result?.url || raw.result?.download_url
      ? [raw.result]
      : [];
    const links = [];
    const seenUrls = new Set();
    let thumb = '';
    list.forEach((item) => {
      const mediaUrl = item?.downloadUrl || item?.url || item?.download_url || item?.video || item?.image;
      if (!mediaUrl || isBlockedRedirectDownloadUrl(mediaUrl)) return;
      const cleanMediaUrl = String(mediaUrl).trim();
      if (seenUrls.has(cleanMediaUrl)) return;
      seenUrls.add(cleanMediaUrl);
      if (!thumb && item?.thumbnail) thumb = String(item.thumbnail);
      const isImg =
        item?.type === 'image' ||
        (/\.(jpg|jpeg|png|webp)(\?|$)/i.test(cleanMediaUrl) && !/\.mp4|video/i.test(cleanMediaUrl));
      const idx = links.length;
      links.push({
        label: isImg ? `Foto Instagram #${idx + 1}` : `Video Reels Instagram #${idx + 1}`,
        quality: isImg ? 'JPG' : 'HD MP4',
        ext: isImg ? 'jpg' : 'mp4',
        url: cleanMediaUrl,
        isAudio: false,
      });
    });
    if (links.length === 0) return null;
    return {
      platform: 'instagram',
      title: String(raw.result?.title || raw.title || 'Post / Reels Instagram'),
      author: 'Instagram',
      thumbnail: thumb || String(raw.result?.thumbnail || ''),
      durationSec: 0,
      links,
    };
  }

  return null;
}

