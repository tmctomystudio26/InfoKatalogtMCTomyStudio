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
