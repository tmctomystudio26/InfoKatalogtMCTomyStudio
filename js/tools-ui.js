/**
 * UI Controller for "Menu Lainnya" (Jadwal Sholat, Prakiraan Cuaca, Jam Dunia & Bola Dunia Interaktif)
 * Zero external runtime dependencies; designed for both desktop & mobile touch ergonomics.
 */

import {
  INDONESIA_ZONES,
  WORLD_LOCATIONS,
  convertWorldTime,
  describeWeatherCode,
  getNextPrayerInfo,
  getZoneTimeParts,
  matchIndonesianCityQuery,
} from './tools-logic.js';
import {
  describeLocationSource,
  resolveUserLocation,
  searchCitiesOnline,
  setManualLocation,
} from './location.js';
import { createInteractiveGlobe } from './globe.js';
import {
  createSpeedometerGauge,
  fetchSpeedtestEnvironment,
  readClientDeviceTelemetry,
  runInternetSpeedtest,
} from './speedtest.js';

const PRAYER_CACHE_KEY = 'manifestudio_prayer_cache_v1';
const MYQURAN_CITIES_KEY = 'manifestudio_myquran_cities_v1';
const WEATHER_CACHE_KEY = 'manifestudio_weather_cache_v1';

function escapeHtml(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function getTodayParts(now = new Date()) {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return { yyyy, mm, dd, iso: `${yyyy}-${mm}-${dd}` };
}

function getWeatherSvg(iconKey) {
  switch (iconKey) {
    case 'sun':
      return `<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`;
    case 'moon':
      return `<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`;
    case 'partly-cloudy':
    case 'cloudy-night':
      return `<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="M20 12h2"/><path d="m19.07 4.93-1.41 1.41"/><path d="M15.947 12.65a4 4 0 0 0-5.925-4.128"/><path d="M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z"/></svg>`;
    case 'drizzle':
    case 'rain':
      return `<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M16 14v6"/><path d="M8 14v6"/><path d="M12 16v6"/></svg>`;
    case 'storm':
      return `<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 16.326A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 .5 8.973"/><path d="m13 12-3 5h4l-3 5"/></svg>`;
    case 'fog':
      return `<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M16 17H7"/><path d="M17 21H9"/></svg>`;
    default:
      return `<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>`;
  }
}

async function fetchMyQuranCities() {
  try {
    const cachedRaw = localStorage.getItem(MYQURAN_CITIES_KEY);
    if (cachedRaw) {
      const cached = JSON.parse(cachedRaw);
      if (cached && Array.isArray(cached.data) && Date.now() - cached.ts < 7 * 86400000) {
        return cached.data;
      }
    }
  } catch {
    // Ignore cache read error
  }

  const res = await fetch('https://api.myquran.com/v2/sholat/kota/semua');
  if (!res.ok) throw new Error('Gagal mengambil daftar kota Kemenag');
  const json = await res.json();
  if (!json?.status || !Array.isArray(json.data)) {
    throw new Error('Respons daftar kota tidak valid');
  }

  try {
    localStorage.setItem(MYQURAN_CITIES_KEY, JSON.stringify({ ts: Date.now(), data: json.data }));
  } catch {
    // Ignore storage quota
  }
  return json.data;
}

async function fetchPrayerSchedule(loc, explicitCityId = null) {
  const { yyyy, mm, dd, iso } = getTodayParts();

  // 1. Primary Best & Most Accurate Free Indonesian API: MyQuran v2 (Bimas Islam Kemenag RI)
  try {
    const cities = await fetchMyQuranCities();
    let matchedCity = explicitCityId
      ? cities.find((c) => c.id === explicitCityId)
      : matchIndonesianCityQuery(cities, loc.city) || matchIndonesianCityQuery(cities, loc.region);

    const isIndonesia = String(loc.country || '').toLowerCase().includes('indonesia') ||
      (loc.lat >= -11.5 && loc.lat <= 6.5 && loc.lon >= 94.5 && loc.lon <= 141.5);

    if (!matchedCity && isIndonesia && loc.source === 'default') {
      matchedCity = cities.find((c) => c.id === '1301') || cities[0];
    }

    if (matchedCity) {
      const url = `https://api.myquran.com/v2/sholat/jadwal/${encodeURIComponent(matchedCity.id)}/${yyyy}/${mm}/${dd}`;
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        const j = json?.data?.jadwal;
        if (json?.status && j) {
          const payload = {
            isoDate: iso,
            provider: 'Kemenag RI (MyQuran v2)',
            cityLabel: json.data.lokasi || matchedCity.lokasi,
            daerahLabel: json.data.daerah || loc.region || 'Indonesia',
            dateReadable: j.tanggal || iso,
            hijriDate: '',
            timings: {
              imsak: j.imsak,
              subuh: j.subuh,
              terbit: j.terbit,
              dhuha: j.dhuha,
              dzuhur: j.dzuhur,
              ashar: j.ashar,
              maghrib: j.maghrib,
              isya: j.isya,
            },
          };
          try {
            localStorage.setItem(PRAYER_CACHE_KEY, JSON.stringify(payload));
          } catch {
            // Ignore
          }
          return payload;
        }
      }
    }
  } catch {
    // Fall through to coordinate-exact Kemenag method=20 API
  }

  // 2. Coordinate-Exact Fallback: AlAdhan API with method=20 (Kementerian Agama RI)
  try {
    const url = `https://api.aladhan.com/v1/timings/${dd}-${mm}-${yyyy}?latitude=${encodeURIComponent(loc.lat)}&longitude=${encodeURIComponent(loc.lon)}&method=20`;
    const res = await fetch(url, { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      const t = json?.data?.timings;
      const d = json?.data?.date;
      if (t) {
        const clean = (val) => String(val || '').replace(/\s*\(.*\)/, '').trim();
        const payload = {
          isoDate: iso,
          provider: 'Kemenag RI (Koordinat Presisi)',
          cityLabel: loc.city,
          daerahLabel: loc.region || loc.country,
          dateReadable: d?.readable || iso,
          hijriDate: d?.hijri
            ? `${d.hijri.day} ${d.hijri.month?.en || ''} ${d.hijri.year} H`
            : '',
          timings: {
            imsak: clean(t.Imsak),
            subuh: clean(t.Fajr),
            terbit: clean(t.Sunrise),
            dhuha: clean(t.Sunrise),
            dzuhur: clean(t.Dhuhr),
            ashar: clean(t.Asr),
            maghrib: clean(t.Maghrib),
            isya: clean(t.Isha),
          },
        };
        try {
          localStorage.setItem(PRAYER_CACHE_KEY, JSON.stringify(payload));
        } catch {
          // Ignore
        }
        return payload;
      }
    }
  } catch {
    // Offline fallback check below
  }

  // 3. Offline localStorage cache
  try {
    const cachedRaw = localStorage.getItem(PRAYER_CACHE_KEY);
    if (cachedRaw) {
      const cached = JSON.parse(cachedRaw);
      if (cached && cached.timings) {
        return { ...cached, provider: `${cached.provider} (Cache Offline)` };
      }
    }
  } catch {
    // Ignore
  }

  throw new Error('Tidak dapat memuat jadwal sholat. Periksa koneksi internet Anda.');
}

async function fetchWeatherForecast(loc) {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(loc.lat)}&longitude=${encodeURIComponent(loc.lon)}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,is_day` +
    `&hourly=temperature_2m,precipitation_probability,weather_code,is_day` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset` +
    `&timezone=auto&forecast_days=7`;

  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      if (json && json.current) {
        const payload = {
          fetchedAt: new Date().toISOString(),
          cityLabel: loc.city,
          regionLabel: loc.region || loc.country,
          timezone: json.timezone || 'Asia/Jakarta',
          current: json.current,
          hourly: json.hourly,
          daily: json.daily,
          offline: false,
        };
        try {
          localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(payload));
        } catch {
          // Ignore
        }
        return payload;
      }
    }
  } catch {
    // Try cache
  }

  try {
    const cachedRaw = localStorage.getItem(WEATHER_CACHE_KEY);
    if (cachedRaw) {
      const cached = JSON.parse(cachedRaw);
      if (cached && cached.current) {
        return { ...cached, offline: true };
      }
    }
  } catch {
    // Ignore
  }

  throw new Error('Tidak dapat memuat prakiraan cuaca. Periksa koneksi internet Anda.');
}

export function createToolsHubController({
  rootEl,
  onToast = () => {},
  onSubTabChange = () => {},
}) {
  const today = getTodayParts();
  const initialClock = getZoneTimeParts(new Date(), 'Asia/Jakarta');

  const toolState = {
    activeSubTab: 'prayer', // 'prayer' | 'weather' | 'worldclock' | 'speedtest'
    location: null,
    locationLoading: false,
    prayerData: null,
    prayerLoading: false,
    prayerError: '',
    prayerCities: [],
    prayerSearchQuery: '',
    weatherData: null,
    weatherLoading: false,
    weatherError: '',
    weatherSearchQuery: '',
    weatherSuggestions: [],
    selectedWorldId: 'jp',
    worldSearchQuery: '',
    globeAutoRotate: false,
    convDate: initialClock.isoDate || today.iso,
    convTime: initialClock.timeShort || '12:00',
    convSourceZone: 'Asia/Jakarta',
    speedRunning: false,
    speedPhase: 'idle', // 'idle' | 'ping' | 'download' | 'upload' | 'done'
    speedPhaseLabel: 'Siap menguji koneksi',
    speedProgress: 0,
    speedLiveMbps: 0,
    speedSamples: [],
    speedResult: null,
    speedEnv: null,
    speedEnvLoading: false,
    speedError: '',
    speedDevice: readClientDeviceTelemetry(),
  };

  let clockTimer = null;
  let globeInstance = null;
  let gaugeInstance = null;
  let speedAbort = null;
  let mounted = false;

  function stopLiveTimers() {
    if (clockTimer) {
      clearInterval(clockTimer);
      clockTimer = null;
    }
    if (globeInstance) {
      globeInstance.destroy();
      globeInstance = null;
    }
    if (gaugeInstance) {
      gaugeInstance.destroy();
      gaugeInstance = null;
    }
  }

  function updateDynamicTicks() {
    if (!mounted) return;
    const now = new Date();

    if (toolState.activeSubTab === 'prayer' && toolState.prayerData?.timings) {
      const nextInfo = getNextPrayerInfo(toolState.prayerData.timings, now);
      const nextNameEl = rootEl.querySelector('#prayer-next-name');
      const nextTimeEl = rootEl.querySelector('#prayer-next-time');
      const countdownEl = rootEl.querySelector('#prayer-countdown');
      if (nextInfo) {
        if (nextNameEl) {
          nextNameEl.textContent = nextInfo.allPassedToday
            ? `${nextInfo.label} (Besok)`
            : nextInfo.label;
        }
        if (nextTimeEl) nextTimeEl.textContent = nextInfo.timeStr;
        if (countdownEl) countdownEl.textContent = nextInfo.countdownText;
      }
    }

    if (toolState.activeSubTab === 'worldclock') {
      const utcEl = rootEl.querySelector('#live-utc-clock');
      const utcDateEl = rootEl.querySelector('#live-utc-date');
      if (utcEl) {
        const utc = getZoneTimeParts(now, 'UTC');
        utcEl.textContent = utc.time24;
        if (utcDateEl) utcDateEl.textContent = `${utc.weekdayLabel}, ${utc.dateLabel}`;
      }

      for (const iz of INDONESIA_ZONES) {
        const el = rootEl.querySelector(`#live-id-${iz.id}`);
        if (el) {
          el.textContent = getZoneTimeParts(now, iz.timeZone).time24;
        }
      }

      const targetLoc =
        WORLD_LOCATIONS.find((l) => l.id === toolState.selectedWorldId) || WORLD_LOCATIONS[0];
      const targetClockEl = rootEl.querySelector('#live-target-clock');
      const targetDateEl = rootEl.querySelector('#live-target-date');
      if (targetClockEl && targetLoc) {
        const tp = getZoneTimeParts(now, targetLoc.timeZone);
        targetClockEl.textContent = tp.time24;
        if (targetDateEl) {
          targetDateEl.textContent = `${tp.weekdayLabel}, ${tp.dateLabel} · ${tp.offsetLabel}`;
        }
      }
    }
  }

  function startLiveTimers() {
    if (clockTimer) clearInterval(clockTimer);
    updateDynamicTicks();
    clockTimer = setInterval(updateDynamicTicks, 1000);
  }

  async function ensureLocationAndLoad({ forceRefresh = false } = {}) {
    toolState.locationLoading = true;
    render();
    try {
      const loc = await resolveUserLocation({ forceRefresh });
      toolState.location = loc;
      if (forceRefresh) {
        onToast(
          loc.source === 'gps'
            ? `Lokasi GPS diperbarui: ${loc.city}`
            : `Lokasi terdeteksi: ${loc.city}`
        );
      }
    } finally {
      toolState.locationLoading = false;
    }

    await Promise.all([loadPrayerForCurrentLocation(), loadWeatherForCurrentLocation()]);
  }

  async function ensureSpeedtestEnv() {
    if (toolState.speedEnv || toolState.speedEnvLoading) return;
    toolState.speedEnvLoading = true;
    try {
      const env = await fetchSpeedtestEnvironment();
      toolState.speedEnv = env;
      if (mounted && toolState.activeSubTab === 'speedtest' && !toolState.speedRunning) {
        render();
      }
    } catch {
      // Ignore optional prefill failure
    } finally {
      toolState.speedEnvLoading = false;
    }
  }

  async function loadPrayerForCurrentLocation(explicitCityId = null) {
    if (!toolState.location) return;
    toolState.prayerLoading = true;
    toolState.prayerError = '';
    render();
    try {
      const [schedule, cities] = await Promise.all([
        fetchPrayerSchedule(toolState.location, explicitCityId),
        fetchMyQuranCities().catch(() => []),
      ]);
      toolState.prayerData = schedule;
      if (Array.isArray(cities) && cities.length > 0) {
        toolState.prayerCities = cities;
      }
    } catch (err) {
      toolState.prayerError = err.message || 'Gagal memuat jadwal sholat.';
    } finally {
      toolState.prayerLoading = false;
      render();
    }
  }

  async function loadWeatherForCurrentLocation() {
    if (!toolState.location) return;
    toolState.weatherLoading = true;
    toolState.weatherError = '';
    render();
    try {
      toolState.weatherData = await fetchWeatherForecast(toolState.location);
    } catch (err) {
      toolState.weatherError = err.message || 'Gagal memuat prakiraan cuaca.';
    } finally {
      toolState.weatherLoading = false;
      render();
    }
  }

  function renderLocationBar(mode) {
    const loc = toolState.location;
    const sourceText = loc ? describeLocationSource(loc.source) : 'Mendeteksi lokasi...';
    const cityText = loc ? `${loc.city}${loc.region ? `, ${loc.region}` : ''}` : 'Meminta izin lokasi...';

    return `
      <div class="tool-location-bar">
        <div class="tool-loc-info">
          <div class="tool-loc-title-row">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
            <strong>${escapeHtml(cityText)}</strong>
          </div>
          <span class="tool-loc-meta">${escapeHtml(sourceText)}</span>
        </div>
        <div class="tool-loc-actions">
          <button
            type="button"
            class="btn btn-secondary btn-sm"
            data-tool-gps-refresh="${mode}"
            ${toolState.locationLoading ? 'disabled' : ''}
          >
            ${toolState.locationLoading ? 'Mendeteksi...' : 'Gunakan Lokasi GPS'}
          </button>
        </div>
      </div>
    `;
  }

  function renderPrayerPanel() {
    const data = toolState.prayerData;
    const now = new Date();
    const nextInfo = data?.timings ? getNextPrayerInfo(data.timings, now) : null;

    const prayerSlots = data?.timings
      ? [
          { key: 'imsak', label: 'Imsak', time: data.timings.imsak },
          { key: 'subuh', label: 'Subuh', time: data.timings.subuh },
          { key: 'terbit', label: 'Terbit', time: data.timings.terbit },
          { key: 'dhuha', label: 'Dhuha', time: data.timings.dhuha },
          { key: 'dzuhur', label: 'Dzuhur', time: data.timings.dzuhur },
          { key: 'ashar', label: 'Ashar', time: data.timings.ashar },
          { key: 'maghrib', label: 'Maghrib', time: data.timings.maghrib },
          { key: 'isya', label: 'Isya', time: data.timings.isya },
        ]
      : [];

    const filteredCities = toolState.prayerSearchQuery.trim()
      ? toolState.prayerCities
          .filter((c) => c.lokasi.toLowerCase().includes(toolState.prayerSearchQuery.trim().toLowerCase()))
          .slice(0, 8)
      : [];

    return `
      <div class="tool-panel" data-testid="prayer-panel">
        ${renderLocationBar('prayer')}

        <div class="tool-city-search-row">
          <div class="search-box tool-search-box">
            <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <input
              type="search"
              id="prayer-city-search"
              class="search-input"
              placeholder="Cari Kab/Kota (contoh: Bandung, Sleman, Surabaya)..."
              value="${escapeHtml(toolState.prayerSearchQuery)}"
              aria-label="Cari kota jadwal sholat Indonesia"
            />
          </div>
        </div>

        ${
          filteredCities.length > 0
            ? `<div class="tool-city-results" role="listbox" aria-label="Pilih kota jadwal sholat">
                ${filteredCities
                  .map(
                    (c) => `
                  <button type="button" class="tool-city-option" data-prayer-city-id="${escapeHtml(c.id)}" data-prayer-city-name="${escapeHtml(c.lokasi)}">
                    ${escapeHtml(c.lokasi)}
                  </button>
                `
                  )
                  .join('')}
              </div>`
            : ''
        }

        ${
          toolState.prayerLoading && !data
            ? `<div class="tool-loading-box">Memuat jadwal sholat resmi Kemenag RI...</div>`
            : toolState.prayerError && !data
            ? `<div class="form-error" role="alert">${escapeHtml(toolState.prayerError)}</div>`
            : data
            ? `
              <div class="prayer-hero-card">
                <div class="prayer-hero-left">
                  <span class="tool-kicker">${escapeHtml(data.provider)} · ${escapeHtml(data.cityLabel)}</span>
                  <h3 class="prayer-next-title">
                    Menuju <span id="prayer-next-name">${escapeHtml(nextInfo ? (nextInfo.allPassedToday ? `${nextInfo.label} (Besok)` : nextInfo.label) : 'Waktu Sholat')}</span>
                    <span id="prayer-next-time" class="mono-num">${escapeHtml(nextInfo?.timeStr || '')}</span>
                  </h3>
                  <p class="prayer-date-sub">
                    ${escapeHtml(data.dateReadable)}${data.hijriDate ? ` · ${escapeHtml(data.hijriDate)}` : ''}
                  </p>
                </div>
                <div class="prayer-countdown-box">
                  <span class="prayer-countdown-label">Hitung Mundur</span>
                  <strong id="prayer-countdown" class="prayer-countdown-value mono-num">${escapeHtml(nextInfo?.countdownText || '--:--:--')}</strong>
                </div>
              </div>

              <div class="prayer-grid">
                ${prayerSlots
                  .map((slot) => {
                    const isNext = nextInfo && nextInfo.key === slot.key;
                    return `
                      <div class="prayer-slot-card ${isNext ? 'is-next' : ''}">
                        <span class="prayer-slot-name">${escapeHtml(slot.label)}</span>
                        <strong class="prayer-slot-time mono-num">${escapeHtml(slot.time || '--:--')}</strong>
                      </div>
                    `;
                  })
                  .join('')}
              </div>
            `
            : ''
        }
      </div>
    `;
  }

  function renderWeatherPanel() {
    const w = toolState.weatherData;
    const current = w?.current;
    const curDesc = current ? describeWeatherCode(current.weather_code, current.is_day) : null;

    const hourlyItems = [];
    if (w?.hourly?.time && w?.hourly?.temperature_2m) {
      const nowMs = Date.now();
      for (let i = 0; i < w.hourly.time.length; i += 1) {
        const tMs = Date.parse(w.hourly.time[i]);
        if (tMs >= nowMs - 3600000 && hourlyItems.length < 12) {
          hourlyItems.push({
            hour: String(w.hourly.time[i]).slice(11, 16),
            temp: Math.round(w.hourly.temperature_2m[i]),
            rain: w.hourly.precipitation_probability?.[i] ?? 0,
            desc: describeWeatherCode(w.hourly.weather_code?.[i], w.hourly.is_day?.[i] ?? 1),
          });
        }
      }
    }

    const dailyItems = [];
    if (w?.daily?.time) {
      for (let i = 0; i < w.daily.time.length; i += 1) {
        const dateObj = new Date(`${w.daily.time[i]}T00:00:00`);
        const dayLabel =
          i === 0
            ? 'Hari Ini'
            : new Intl.DateTimeFormat('id-ID', { weekday: 'short', day: 'numeric', month: 'short' }).format(dateObj);
        dailyItems.push({
          dayLabel,
          min: Math.round(w.daily.temperature_2m_min?.[i] ?? 0),
          max: Math.round(w.daily.temperature_2m_max?.[i] ?? 0),
          rain: w.daily.precipitation_probability_max?.[i] ?? 0,
          desc: describeWeatherCode(w.daily.weather_code?.[i], 1),
        });
      }
    }

    return `
      <div class="tool-panel" data-testid="weather-panel">
        ${renderLocationBar('weather')}

        <div class="tool-city-search-row">
          <div class="search-box tool-search-box">
            <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <input
              type="search"
              id="weather-city-search"
              class="search-input"
              placeholder="Cari kota (contoh: Yogyakarta, Tokyo, Bali)..."
              value="${escapeHtml(toolState.weatherSearchQuery)}"
              aria-label="Cari kota prakiraan cuaca"
            />
          </div>
          <button type="button" class="btn btn-secondary btn-sm" id="weather-search-btn">
            Cari Kota
          </button>
        </div>

        ${
          toolState.weatherSuggestions.length > 0
            ? `<div class="tool-city-results" role="listbox" aria-label="Hasil pencarian kota cuaca">
                ${toolState.weatherSuggestions
                  .map(
                    (c, idx) => `
                  <button type="button" class="tool-city-option" data-weather-city-idx="${idx}">
                    ${escapeHtml(c.city)}${c.region ? ` · ${escapeHtml(c.region)}` : ''} (${escapeHtml(c.country)})
                  </button>
                `
                  )
                  .join('')}
              </div>`
            : ''
        }

        ${
          toolState.weatherLoading && !w
            ? `<div class="tool-loading-box">Mengambil prakiraan cuaca real-time...</div>`
            : toolState.weatherError && !w
            ? `<div class="form-error" role="alert">${escapeHtml(toolState.weatherError)}</div>`
            : w && current
            ? `
              <div class="weather-hero-card tone-${escapeHtml(curDesc.tone)}">
                <div class="weather-hero-main">
                  <div class="weather-icon-wrap">
                    ${getWeatherSvg(curDesc.iconKey)}
                  </div>
                  <div>
                    <span class="tool-kicker">${escapeHtml(w.cityLabel)} · ${escapeHtml(w.timezone)}${w.offline ? ' · Cache Offline' : ''}</span>
                    <div class="weather-temp-row">
                      <strong class="weather-temp-big mono-num">${Math.round(current.temperature_2m)}°C</strong>
                      <span class="weather-condition">${escapeHtml(curDesc.label)}</span>
                    </div>
                    <p class="weather-sub">Terasa seperti ${Math.round(current.apparent_temperature)}°C</p>
                  </div>
                </div>
                <div class="weather-metrics-grid">
                  <div class="weather-metric">
                    <span>Kelembapan</span>
                    <strong class="mono-num">${Math.round(current.relative_humidity_2m)}%</strong>
                  </div>
                  <div class="weather-metric">
                    <span>Kecepatan Angin</span>
                    <strong class="mono-num">${Math.round(current.wind_speed_10m)} km/j</strong>
                  </div>
                  <div class="weather-metric">
                    <span>Curah Hujan</span>
                    <strong class="mono-num">${current.precipitation ?? 0} mm</strong>
                  </div>
                </div>
              </div>

              ${
                hourlyItems.length > 0
                  ? `
                <div class="weather-block">
                  <h3 class="tool-subhead">Prakiraan Per Jam</h3>
                  <div class="weather-hourly-strip">
                    ${hourlyItems
                      .map(
                        (h) => `
                      <div class="weather-hour-card">
                        <span class="mono-num weather-hour-time">${escapeHtml(h.hour)}</span>
                        <span class="weather-hour-icon">${getWeatherSvg(h.desc.iconKey)}</span>
                        <strong class="mono-num weather-hour-temp">${h.temp}°</strong>
                        <span class="weather-hour-rain mono-num">${h.rain}%</span>
                      </div>
                    `
                      )
                      .join('')}
                  </div>
                </div>
              `
                  : ''
              }

              ${
                dailyItems.length > 0
                  ? `
                <div class="weather-block">
                  <h3 class="tool-subhead">Prakiraan 7 Hari Ke Depan</h3>
                  <div class="weather-daily-list">
                    ${dailyItems
                      .map(
                        (d) => `
                      <div class="weather-daily-row">
                        <span class="weather-daily-day">${escapeHtml(d.dayLabel)}</span>
                        <span class="weather-daily-cond">
                          ${getWeatherSvg(d.desc.iconKey)}
                          <span>${escapeHtml(d.desc.label)}</span>
                        </span>
                        <span class="weather-daily-rain mono-num">Hujan ${d.rain}%</span>
                        <strong class="weather-daily-temps mono-num">${d.min}° / ${d.max}°C</strong>
                      </div>
                    `
                      )
                      .join('')}
                  </div>
                </div>
              `
                  : ''
              }
            `
            : ''
        }
      </div>
    `;
  }

  function renderWorldClockPanel() {
    const now = new Date();
    const utcNow = getZoneTimeParts(now, 'UTC');
    const targetLoc =
      WORLD_LOCATIONS.find((l) => l.id === toolState.selectedWorldId) || WORLD_LOCATIONS[0];
    const targetNow = getZoneTimeParts(now, targetLoc.timeZone);

    const conv = convertWorldTime({
      dateStr: toolState.convDate,
      timeStr: toolState.convTime,
      sourceTimeZone: toolState.convSourceZone,
      targetTimeZone: targetLoc.timeZone,
    });

    const filteredCountries = toolState.worldSearchQuery.trim()
      ? WORLD_LOCATIONS.filter((l) => {
          const q = toolState.worldSearchQuery.trim().toLowerCase();
          return (
            l.country.toLowerCase().includes(q) ||
            l.city.toLowerCase().includes(q) ||
            l.region.toLowerCase().includes(q)
          );
        })
      : WORLD_LOCATIONS;

    const quickIds = ['jp', 'sa', 'gb', 'us-ny', 'sg', 'kr', 'au-syd', 'ae'];

    return `
      <div class="tool-panel" data-testid="worldclock-panel">
        <!-- UTC Master + Indonesia Zones Strip -->
        <div class="world-master-grid">
          <div class="world-clock-card is-utc">
            <span class="tool-kicker">Standar Internasional</span>
            <div class="world-clock-title">UTC / GMT</div>
            <strong id="live-utc-clock" class="world-clock-digits mono-num">${escapeHtml(utcNow.time24)}</strong>
            <span id="live-utc-date" class="world-clock-sub">${escapeHtml(utcNow.weekdayLabel)}, ${escapeHtml(utcNow.dateLabel)}</span>
          </div>

          ${INDONESIA_ZONES.map((iz) => {
            const p = getZoneTimeParts(now, iz.timeZone);
            return `
              <div class="world-clock-card">
                <span class="tool-kicker">${escapeHtml(iz.utcLabel)}</span>
                <div class="world-clock-title">${escapeHtml(iz.label)}</div>
                <strong id="live-id-${escapeHtml(iz.id)}" class="world-clock-digits mono-num">${escapeHtml(p.time24)}</strong>
                <span class="world-clock-sub">${escapeHtml(iz.city)}</span>
              </div>
            `;
          }).join('')}
        </div>

        <!-- Interactive Rotatable Globe + Time Converter Split -->
        <div class="world-workspace-grid">
          <div class="globe-card">
            <div class="globe-card-head">
              <div>
                <h3 class="tool-subhead">Bola Dunia Interaktif</h3>
                <p class="tool-hint">Geser untuk memutar, klik negara target.</p>
              </div>
              <div class="globe-toolbar">
                <button type="button" class="btn btn-ghost btn-sm" id="globe-focus-id-btn">
                  Indonesia
                </button>
                <button type="button" class="btn ${toolState.globeAutoRotate ? 'btn-primary' : 'btn-secondary'} btn-sm" id="globe-autorotate-btn">
                  ${toolState.globeAutoRotate ? 'Putar: ON' : 'Auto Putar'}
                </button>
              </div>
            </div>

            <div class="globe-canvas-wrap">
              <canvas
                id="world-globe-canvas"
                class="world-globe-canvas"
                data-testid="world-globe-canvas"
                aria-label="Bola dunia interaktif untuk memilih negara target jam dunia"
              ></canvas>
            </div>

            <div class="globe-target-readout">
              <div>
                <span class="tool-kicker">Negara Target Terpilih</span>
                <strong class="globe-target-name">${escapeHtml(targetLoc.country)} · ${escapeHtml(targetLoc.city)}</strong>
                <span id="live-target-date" class="world-clock-sub">${escapeHtml(targetNow.weekdayLabel)}, ${escapeHtml(targetNow.dateLabel)} · ${escapeHtml(targetNow.offsetLabel)}</span>
              </div>
              <strong id="live-target-clock" class="world-clock-digits mono-num">${escapeHtml(targetNow.time24)}</strong>
            </div>

            <div class="globe-search-box">
              <input
                type="search"
                id="world-country-search"
                class="search-input globe-search-input"
                placeholder="Cari negara atau kota (Jepang, London, Arab, New York)..."
                value="${escapeHtml(toolState.worldSearchQuery)}"
                aria-label="Cari negara pada bola dunia"
              />
            </div>

            <div class="world-quick-countries" aria-label="Negara populer">
              ${quickIds
                .map((id) => {
                  const loc = WORLD_LOCATIONS.find((l) => l.id === id);
                  if (!loc) return '';
                  return `
                    <button
                      type="button"
                      class="cat-tab ${toolState.selectedWorldId === loc.id ? 'is-active' : ''}"
                      data-world-pick="${escapeHtml(loc.id)}"
                    >
                      ${escapeHtml(loc.country)}
                    </button>
                  `;
                })
                .join('')}
            </div>

            <div class="world-country-select-row">
              <label for="world-country-select">Semua Negara &amp; Zona Waktu:</label>
              <select id="world-country-select" class="admin-select">
                ${filteredCountries
                  .map(
                    (loc) => `
                  <option value="${escapeHtml(loc.id)}" ${loc.id === toolState.selectedWorldId ? 'selected' : ''}>
                    ${escapeHtml(loc.country)} — ${escapeHtml(loc.city)} (${escapeHtml(loc.region)})
                  </option>
                `
                  )
                  .join('')}
              </select>
            </div>
          </div>

          <!-- Two-way Time Converter (Target + UTC + WIB/WITA/WIT) -->
          <div class="converter-card">
            <div class="converter-head">
              <div>
                <h3 class="tool-subhead">Konversi Waktu</h3>
                <p class="tool-hint">Konversi WIB/WITA/WIT, UTC, dan negara target.</p>
              </div>
              <button type="button" class="btn btn-secondary btn-sm" id="conv-now-btn">
                Waktu Sekarang
              </button>
            </div>

            <div class="converter-inputs-grid">
              <div class="form-field">
                <label for="conv-source-zone">Zona Waktu Asal</label>
                <select id="conv-source-zone" class="admin-select">
                  <option value="Asia/Jakarta" ${toolState.convSourceZone === 'Asia/Jakarta' ? 'selected' : ''}>Indonesia WIB (UTC+7)</option>
                  <option value="Asia/Makassar" ${toolState.convSourceZone === 'Asia/Makassar' ? 'selected' : ''}>Indonesia WITA (UTC+8)</option>
                  <option value="Asia/Jayapura" ${toolState.convSourceZone === 'Asia/Jayapura' ? 'selected' : ''}>Indonesia WIT (UTC+9)</option>
                  <option value="UTC" ${toolState.convSourceZone === 'UTC' ? 'selected' : ''}>UTC Internasional (UTC+0)</option>
                  <option value="${escapeHtml(targetLoc.timeZone)}" ${toolState.convSourceZone === targetLoc.timeZone ? 'selected' : ''}>
                    ${escapeHtml(targetLoc.country)} (${escapeHtml(targetLoc.city)})
                  </option>
                </select>
              </div>

              <div class="form-field">
                <label for="conv-time-input">Jam Asal</label>
                <input
                  type="time"
                  id="conv-time-input"
                  class="tool-native-input"
                  value="${escapeHtml(toolState.convTime)}"
                />
              </div>

              <div class="form-field">
                <label for="conv-date-input">Tanggal</label>
                <input
                  type="date"
                  id="conv-date-input"
                  class="tool-native-input"
                  value="${escapeHtml(toolState.convDate)}"
                />
              </div>
            </div>

            <div class="converter-results-list" data-testid="converter-results">
              <div class="converter-result-row is-highlight">
                <div>
                  <span class="conv-zone-name">${escapeHtml(targetLoc.country)} · ${escapeHtml(targetLoc.city)}</span>
                  <span class="conv-zone-meta">${escapeHtml(conv.target.offsetLabel)} · ${escapeHtml(conv.target.weekdayLabel)}, ${escapeHtml(conv.target.dateLabel)}</span>
                </div>
                <div class="conv-time-col">
                  <strong class="mono-num">${escapeHtml(conv.target.timeShort)}</strong>
                  <span>${escapeHtml(conv.target.dayDeltaLabel)}</span>
                </div>
              </div>

              <div class="converter-result-row">
                <div>
                  <span class="conv-zone-name">WIB (Jakarta / Jawa / Sumatra)</span>
                  <span class="conv-zone-meta">${escapeHtml(conv.wib.offsetLabel)} · ${escapeHtml(conv.wib.weekdayLabel)}, ${escapeHtml(conv.wib.dateLabel)}</span>
                </div>
                <div class="conv-time-col">
                  <strong class="mono-num">${escapeHtml(conv.wib.timeShort)}</strong>
                  <span>${escapeHtml(conv.wib.dayDeltaLabel)}</span>
                </div>
              </div>

              <div class="converter-result-row">
                <div>
                  <span class="conv-zone-name">WITA (Makassar / Bali / Kaltim)</span>
                  <span class="conv-zone-meta">${escapeHtml(conv.wita.offsetLabel)} · ${escapeHtml(conv.wita.weekdayLabel)}, ${escapeHtml(conv.wita.dateLabel)}</span>
                </div>
                <div class="conv-time-col">
                  <strong class="mono-num">${escapeHtml(conv.wita.timeShort)}</strong>
                  <span>${escapeHtml(conv.wita.dayDeltaLabel)}</span>
                </div>
              </div>

              <div class="converter-result-row">
                <div>
                  <span class="conv-zone-name">WIT (Jayapura / Maluku / Papua)</span>
                  <span class="conv-zone-meta">${escapeHtml(conv.wit.offsetLabel)} · ${escapeHtml(conv.wit.weekdayLabel)}, ${escapeHtml(conv.wit.dateLabel)}</span>
                </div>
                <div class="conv-time-col">
                  <strong class="mono-num">${escapeHtml(conv.wit.timeShort)}</strong>
                  <span>${escapeHtml(conv.wit.dayDeltaLabel)}</span>
                </div>
              </div>

              <div class="converter-result-row">
                <div>
                  <span class="conv-zone-name">Standar UTC Internasional</span>
                  <span class="conv-zone-meta">${escapeHtml(conv.utc.offsetLabel)} · ${escapeHtml(conv.utc.weekdayLabel)}, ${escapeHtml(conv.utc.dateLabel)}</span>
                </div>
                <div class="conv-time-col">
                  <strong class="mono-num">${escapeHtml(conv.utc.timeShort)}</strong>
                  <span>${escapeHtml(conv.utc.dayDeltaLabel)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderSpeedtestPanel() {
    const res = toolState.speedResult;
    const env = res?.env || toolState.speedEnv;
    const loc = toolState.location;
    const dev = toolState.speedDevice;

    const pingDisplay = res?.pingMs ?? (toolState.speedRunning ? toolState.speedResult?.pingMs : null);
    const jitterDisplay = res?.jitterMs ?? null;
    const dlDisplay = res?.downloadMbps ?? null;
    const ulDisplay = res?.uploadMbps ?? null;

    const locText = loc
      ? `${loc.city}${loc.region ? `, ${loc.region}` : ''}`
      : env?.networkCity || 'Mendeteksi lokasi...';
    const locSub = loc
      ? describeLocationSource(loc.source)
      : 'Estimasi jaringan';

    const waveBarsHtml = Array.from({ length: 28 }, (_, idx) => {
      const val = toolState.speedSamples[idx] || 0;
      const maxRef = Math.max(10, ...toolState.speedSamples);
      const pct = val > 0 ? Math.max(14, Math.min(100, Math.round((val / maxRef) * 100))) : 8;
      return `<span class="speed-wave-bar ${val > 0 ? 'is-live' : ''}" style="height: ${pct}%"></span>`;
    }).join('');

    const quality = res?.quality || null;

    return `
      <div class="tool-panel" data-testid="speedtest-panel">
        ${renderLocationBar('speedtest')}

        <div class="speedtest-workspace">
          <div class="speed-gauge-card">
            <div class="speed-gauge-head">
              <div>
                <span class="tool-kicker">Cloudflare Speed Edge</span>
                <h3 class="tool-subhead">Tes Kecepatan Internet</h3>
              </div>
              <span id="speed-phase-badge" class="speed-phase-text ${toolState.speedRunning ? 'is-running' : ''}">
                ${escapeHtml(toolState.speedPhaseLabel)}
              </span>
            </div>

            <div class="speed-canvas-wrap">
              <canvas
                id="speedtest-gauge-canvas"
                class="speedtest-gauge-canvas"
                data-testid="speedtest-gauge-canvas"
                aria-label="Meter pengukur kecepatan internet"
              ></canvas>
            </div>

            <div class="speed-progress-track" aria-hidden="true">
              <div
                id="speed-progress-fill"
                class="speed-progress-fill"
                style="width: ${Math.round(toolState.speedProgress * 100)}%"
              ></div>
            </div>

            <div id="speed-wave-strip" class="speed-wave-strip" aria-hidden="true">
              ${waveBarsHtml}
            </div>

            ${
              toolState.speedError
                ? `<div class="form-error" role="alert">${escapeHtml(toolState.speedError)}</div>`
                : ''
            }

            <div class="speed-cta-row">
              ${
                toolState.speedRunning
                  ? `<button type="button" class="btn btn-secondary btn-full" id="speedtest-cancel-btn">Batalkan Tes</button>`
                  : `<button type="button" class="btn btn-primary btn-full" id="speedtest-start-btn" data-testid="speedtest-start-btn">${res ? 'Uji Ulang Kecepatan' : 'Mulai Speedtest'}</button>`
              }
            </div>
          </div>

          <div class="speed-details-col">
            <div class="speed-kpi-grid">
              <div class="speed-kpi-card">
                <span class="speed-kpi-label">Download</span>
                <strong id="speed-kpi-dl" class="speed-kpi-val mono-num">${dlDisplay != null ? dlDisplay.toFixed(1) : '--'} <small>Mbps</small></strong>
              </div>
              <div class="speed-kpi-card">
                <span class="speed-kpi-label">Upload</span>
                <strong id="speed-kpi-ul" class="speed-kpi-val mono-num">${ulDisplay != null ? ulDisplay.toFixed(1) : '--'} <small>Mbps</small></strong>
              </div>
              <div class="speed-kpi-card">
                <span class="speed-kpi-label">Ping / Latensi</span>
                <strong id="speed-kpi-ping" class="speed-kpi-val mono-num">${pingDisplay != null ? pingDisplay : '--'} <small>ms</small></strong>
                <span id="speed-kpi-loaded" class="speed-kpi-sub mono-num">${res?.loadedLatencyMs != null ? `Beban: ${res.loadedLatencyMs} ms` : 'Idle RTT'}</span>
              </div>
              <div class="speed-kpi-card">
                <span class="speed-kpi-label">Jitter</span>
                <strong id="speed-kpi-jitter" class="speed-kpi-val mono-num">${jitterDisplay != null ? jitterDisplay : '--'} <small>ms</small></strong>
                <span id="speed-kpi-minping" class="speed-kpi-sub mono-num">${res?.minPingMs != null ? `Min: ${res.minPingMs} ms` : 'Stabilitas'}</span>
              </div>
            </div>

            ${
              quality
                ? `
              <div class="speed-quality-card">
                <div class="speed-quality-head">
                  <span>Kualitas Koneksi</span>
                  <strong>${escapeHtml(quality.grade)}</strong>
                </div>
                <div class="speed-suit-grid">
                  ${quality.suitability
                    .map(
                      (s) => `
                    <div class="speed-suit-item ${s.ok ? 'is-ok' : 'is-limit'}">
                      <span>${escapeHtml(s.label)}</span>
                      <strong>${s.ok ? 'Lancar' : 'Terbatas'}</strong>
                    </div>
                  `
                    )
                    .join('')}
                </div>
              </div>
            `
                : ''
            }

            <div class="speed-meta-card">
              <h4 class="speed-meta-title">Info Jaringan &amp; Perangkat</h4>
              <div class="speed-meta-list">
                <div class="speed-meta-row">
                  <span>Lokasi</span>
                  <strong>${escapeHtml(locText)} · ${escapeHtml(locSub)}</strong>
                </div>
                <div class="speed-meta-row">
                  <span>Server Tes</span>
                  <strong>${escapeHtml(env?.serverLabel || 'Mendeteksi server...')}</strong>
                </div>
                <div class="speed-meta-row">
                  <span>Provider (ISP)</span>
                  <strong>${escapeHtml(env?.isp || 'Mendeteksi ISP...')}${env?.asn ? ` (${escapeHtml(env.asn)})` : ''}</strong>
                </div>
                <div class="speed-meta-row">
                  <span>Alamat IP &amp; Protokol</span>
                  <strong class="mono-num">${escapeHtml(env?.ip || '--')}${env?.protocol ? ` · ${escapeHtml(env.protocol)}` : ''}</strong>
                </div>
                <div class="speed-meta-row">
                  <span>Perangkat &amp; OS</span>
                  <strong>${escapeHtml(dev.deviceType)} · ${escapeHtml(dev.os)} (${escapeHtml(dev.browser)})</strong>
                </div>
                <div class="speed-meta-row">
                  <span>Layar &amp; Hardware</span>
                  <strong class="mono-num">${escapeHtml(dev.screenText)} · ${escapeHtml(dev.cores)} · ${escapeHtml(dev.memory)}</strong>
                </div>
                <div class="speed-meta-row">
                  <span>Tipe Koneksi</span>
                  <strong>${escapeHtml(dev.networkType)}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function syncSpeedtestLiveDom(update) {
    if (!mounted || toolState.activeSubTab !== 'speedtest') return;
    const phaseBadge = rootEl.querySelector('#speed-phase-badge');
    if (phaseBadge && update.phaseLabel) {
      phaseBadge.textContent = update.phaseLabel;
    }
    const progressFill = rootEl.querySelector('#speed-progress-fill');
    if (progressFill && typeof update.progress === 'number') {
      progressFill.style.width = `${Math.round(update.progress * 100)}%`;
    }

    const pingEl = rootEl.querySelector('#speed-kpi-ping');
    if (pingEl && update.pingMs != null) {
      pingEl.innerHTML = `${update.pingMs} <small>ms</small>`;
    }
    const jitterEl = rootEl.querySelector('#speed-kpi-jitter');
    if (jitterEl && update.jitterMs != null) {
      jitterEl.innerHTML = `${update.jitterMs} <small>ms</small>`;
    }
    const minPingEl = rootEl.querySelector('#speed-kpi-minping');
    if (minPingEl && update.minPingMs != null) {
      minPingEl.textContent = `Min: ${update.minPingMs} ms`;
    }
    const loadedEl = rootEl.querySelector('#speed-kpi-loaded');
    if (loadedEl && update.loadedLatencyMs != null) {
      loadedEl.textContent = `Beban: ${update.loadedLatencyMs} ms`;
    }
    const dlEl = rootEl.querySelector('#speed-kpi-dl');
    if (dlEl && update.downloadMbps != null) {
      dlEl.innerHTML = `${update.downloadMbps.toFixed(1)} <small>Mbps</small>`;
    }
    const ulEl = rootEl.querySelector('#speed-kpi-ul');
    if (ulEl && update.uploadMbps != null) {
      ulEl.innerHTML = `${update.uploadMbps.toFixed(1)} <small>Mbps</small>`;
    }

    if (Array.isArray(update.samples)) {
      toolState.speedSamples = update.samples;
      const waveStrip = rootEl.querySelector('#speed-wave-strip');
      if (waveStrip) {
        const maxRef = Math.max(25, ...update.samples);
        waveStrip.innerHTML = Array.from({ length: 28 }, (_, idx) => {
          const val = update.samples[idx] || 0;
          const pct = val > 0 ? Math.max(12, Math.min(100, Math.round((val / maxRef) * 100))) : 8;
          return `<span class="speed-wave-bar ${val > 0 ? 'is-live' : ''}" style="height: ${pct}%"></span>`;
        }).join('');
      }
    }

    if (gaugeInstance && typeof update.liveMbps === 'number') {
      gaugeInstance.setValue(update.liveMbps, update.phase || 'idle');
    }
  }

  async function startSpeedtest() {
    if (toolState.speedRunning) return;
    if (speedAbort) speedAbort.abort();
    speedAbort = new AbortController();

    toolState.speedRunning = true;
    toolState.speedPhase = 'ping';
    toolState.speedPhaseLabel = 'Memulai pengujian...';
    toolState.speedProgress = 0.03;
    toolState.speedLiveMbps = 0;
    toolState.speedSamples = [];
    toolState.speedResult = null;
    toolState.speedError = '';
    render();

    try {
      const result = await runInternetSpeedtest({
        signal: speedAbort.signal,
        onUpdate: (upd) => {
          toolState.speedPhase = upd.phase;
          toolState.speedPhaseLabel = upd.phaseLabel;
          toolState.speedProgress = upd.progress ?? toolState.speedProgress;
          toolState.speedLiveMbps = upd.liveMbps ?? toolState.speedLiveMbps;
          syncSpeedtestLiveDom(upd);
        },
      });
      toolState.speedResult = result;
      toolState.speedEnv = result.env;
      toolState.speedPhase = 'done';
      toolState.speedPhaseLabel = 'Pengujian selesai';
      toolState.speedProgress = 1;
      toolState.speedLiveMbps = result.downloadMbps;
    } catch (err) {
      if (err?.name === 'AbortError') {
        toolState.speedPhase = 'idle';
        toolState.speedPhaseLabel = 'Tes dibatalkan';
        toolState.speedProgress = 0;
      } else {
        toolState.speedPhase = 'idle';
        toolState.speedPhaseLabel = 'Pengujian gagal';
        toolState.speedError = err?.message || 'Gagal menguji koneksi internet.';
      }
    } finally {
      toolState.speedRunning = false;
      speedAbort = null;
      render();
    }
  }

  function bindToolEvents() {
    rootEl.querySelectorAll('[data-tool-subtab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const nextTab = btn.getAttribute('data-tool-subtab') || 'prayer';
        if (speedAbort && nextTab !== 'speedtest') {
          speedAbort.abort();
          speedAbort = null;
          toolState.speedRunning = false;
        }
        toolState.activeSubTab = nextTab;
        onSubTabChange(nextTab);
        render();
        if ((nextTab === 'prayer' || nextTab === 'weather') && !toolState.location && !toolState.locationLoading) {
          ensureLocationAndLoad();
        } else if (nextTab === 'speedtest') {
          ensureSpeedtestEnv();
          if (!toolState.location && !toolState.locationLoading) {
            ensureLocationAndLoad();
          }
        }
      });
    });

    rootEl.querySelectorAll('[data-tool-gps-refresh]').forEach((btn) => {
      btn.addEventListener('click', () => {
        ensureLocationAndLoad({ forceRefresh: true });
      });
    });

    // Prayer search
    const prayerSearch = rootEl.querySelector('#prayer-city-search');
    prayerSearch?.addEventListener('input', (e) => {
      toolState.prayerSearchQuery = e.target.value;
      render();
      const restored = rootEl.querySelector('#prayer-city-search');
      if (restored) {
        restored.focus();
        restored.setSelectionRange(restored.value.length, restored.value.length);
      }
    });

    rootEl.querySelectorAll('[data-prayer-city-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-prayer-city-id');
        const name = btn.getAttribute('data-prayer-city-name');
        toolState.prayerSearchQuery = '';
        if (name) {
          toolState.location = {
            ...(toolState.location || { lat: -6.2088, lon: 106.8456 }),
            city: name,
            region: 'Indonesia',
            country: 'Indonesia',
            source: 'manual',
          };
        }
        loadPrayerForCurrentLocation(id);
      });
    });

    // Weather search
    const weatherSearch = rootEl.querySelector('#weather-city-search');
    weatherSearch?.addEventListener('input', (e) => {
      toolState.weatherSearchQuery = e.target.value;
    });
    const runWeatherSearch = async () => {
      const q = toolState.weatherSearchQuery.trim();
      toolState.weatherSuggestions = await searchCitiesOnline(q);
      render();
    };
    weatherSearch?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        runWeatherSearch();
      }
    });
    rootEl.querySelector('#weather-search-btn')?.addEventListener('click', runWeatherSearch);

    rootEl.querySelectorAll('[data-weather-city-idx]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.getAttribute('data-weather-city-idx'));
        const chosen = toolState.weatherSuggestions[idx];
        if (!chosen) return;
        toolState.location = setManualLocation(chosen);
        toolState.weatherSuggestions = [];
        toolState.weatherSearchQuery = '';
        loadWeatherForCurrentLocation();
        loadPrayerForCurrentLocation();
      });
    });

    // World clock & Globe
    if (toolState.activeSubTab === 'worldclock') {
      const canvas = rootEl.querySelector('#world-globe-canvas');
      if (canvas) {
        globeInstance = createInteractiveGlobe(canvas, {
          initialTargetId: toolState.selectedWorldId,
          onSelectLocation: (loc) => {
            toolState.selectedWorldId = loc.id;
            render();
          },
        });
        if (toolState.globeAutoRotate) {
          globeInstance?.toggleAutoRotate(true);
        }
      }

      rootEl.querySelector('#globe-focus-id-btn')?.addEventListener('click', () => {
        toolState.selectedWorldId = 'id-wib';
        render();
      });

      rootEl.querySelector('#globe-autorotate-btn')?.addEventListener('click', () => {
        toolState.globeAutoRotate = !toolState.globeAutoRotate;
        globeInstance?.toggleAutoRotate(toolState.globeAutoRotate);
        render();
      });

      rootEl.querySelectorAll('[data-world-pick]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-world-pick');
          if (!id) return;
          toolState.selectedWorldId = id;
          render();
        });
      });

      rootEl.querySelector('#world-country-select')?.addEventListener('change', (e) => {
        toolState.selectedWorldId = e.target.value;
        render();
      });

      const worldSearch = rootEl.querySelector('#world-country-search');
      worldSearch?.addEventListener('input', (e) => {
        toolState.worldSearchQuery = e.target.value;
        const q = toolState.worldSearchQuery.trim().toLowerCase();
        const filtered = q
          ? WORLD_LOCATIONS.filter(
              (l) =>
                l.country.toLowerCase().includes(q) ||
                l.city.toLowerCase().includes(q) ||
                l.region.toLowerCase().includes(q)
            )
          : WORLD_LOCATIONS;

        const firstMatch = filtered[0];
        if (firstMatch && q.length >= 2) {
          toolState.selectedWorldId = firstMatch.id;
          globeInstance?.setTarget(firstMatch.id, { animate: true });
          const targetNameEl = rootEl.querySelector('.globe-target-name');
          if (targetNameEl) {
            targetNameEl.textContent = `${firstMatch.country} · ${firstMatch.city}`;
          }
          const conv = convertWorldTime({
            dateStr: toolState.convDate,
            timeStr: toolState.convTime,
            sourceTimeZone: toolState.convSourceZone,
            targetTimeZone: firstMatch.timeZone,
          });
          const firstRow = rootEl.querySelector('[data-testid="converter-results"] .converter-result-row.is-highlight');
          if (firstRow) {
            firstRow.innerHTML = `
              <div>
                <span class="conv-zone-name">${escapeHtml(firstMatch.country)} · ${escapeHtml(firstMatch.city)}</span>
                <span class="conv-zone-meta">${escapeHtml(conv.target.offsetLabel)} · ${escapeHtml(conv.target.weekdayLabel)}, ${escapeHtml(conv.target.dateLabel)}</span>
              </div>
              <div class="conv-time-col">
                <strong class="mono-num">${escapeHtml(conv.target.timeShort)}</strong>
                <span>${escapeHtml(conv.target.dayDeltaLabel)}</span>
              </div>
            `;
          }
          updateDynamicTicks();
        }

        const selectEl = rootEl.querySelector('#world-country-select');
        if (selectEl) {
          selectEl.innerHTML = (filtered.length > 0 ? filtered : WORLD_LOCATIONS)
            .map(
              (loc) =>
                `<option value="${escapeHtml(loc.id)}" ${loc.id === toolState.selectedWorldId ? 'selected' : ''}>${escapeHtml(loc.country)} — ${escapeHtml(loc.city)} (${escapeHtml(loc.region)})</option>`
            )
            .join('');
        }
      });

      rootEl.querySelector('#conv-source-zone')?.addEventListener('change', (e) => {
        toolState.convSourceZone = e.target.value;
        render();
      });

      rootEl.querySelector('#conv-time-input')?.addEventListener('input', (e) => {
        toolState.convTime = e.target.value || '12:00';
        render();
      });

      rootEl.querySelector('#conv-date-input')?.addEventListener('input', (e) => {
        toolState.convDate = e.target.value || getTodayParts().iso;
        render();
      });

      rootEl.querySelector('#conv-now-btn')?.addEventListener('click', () => {
        const nowParts = getZoneTimeParts(new Date(), toolState.convSourceZone);
        toolState.convDate = nowParts.isoDate;
        toolState.convTime = nowParts.timeShort;
        render();
      });
    }

    if (toolState.activeSubTab === 'speedtest') {
      const gaugeCanvas = rootEl.querySelector('#speedtest-gauge-canvas');
      if (gaugeCanvas) {
        gaugeInstance = createSpeedometerGauge(gaugeCanvas);
        const initialGaugeVal = toolState.speedRunning
          ? toolState.speedLiveMbps
          : toolState.speedResult?.downloadMbps || 0;
        const initialMode = toolState.speedRunning ? toolState.speedPhase : toolState.speedResult ? 'download' : 'idle';
        gaugeInstance.setValue(initialGaugeVal, initialMode);
      }
      rootEl.querySelector('#speedtest-start-btn')?.addEventListener('click', startSpeedtest);
      rootEl.querySelector('#speedtest-cancel-btn')?.addEventListener('click', () => {
        if (speedAbort) speedAbort.abort();
      });
    }
  }

  function render() {
    if (!rootEl || !mounted) return;
    stopLiveTimers();

    const activeTabHtml =
      toolState.activeSubTab === 'prayer'
        ? renderPrayerPanel()
        : toolState.activeSubTab === 'weather'
        ? renderWeatherPanel()
        : toolState.activeSubTab === 'worldclock'
        ? renderWorldClockPanel()
        : renderSpeedtestPanel();

    rootEl.innerHTML = `
      <div class="tools-hub">
        <div class="tools-subnav" role="tablist" aria-label="Menu Tambahan">
          <button
            type="button"
            role="tab"
            class="tools-subtab ${toolState.activeSubTab === 'prayer' ? 'is-active' : ''}"
            data-tool-subtab="prayer"
            aria-selected="${toolState.activeSubTab === 'prayer'}"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
            <span>Jadwal Sholat</span>
          </button>
          <button
            type="button"
            role="tab"
            class="tools-subtab ${toolState.activeSubTab === 'weather' ? 'is-active' : ''}"
            data-tool-subtab="weather"
            aria-selected="${toolState.activeSubTab === 'weather'}"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>
            <span>Prakiraan Cuaca</span>
          </button>
          <button
            type="button"
            role="tab"
            class="tools-subtab ${toolState.activeSubTab === 'worldclock' ? 'is-active' : ''}"
            data-tool-subtab="worldclock"
            aria-selected="${toolState.activeSubTab === 'worldclock'}"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
            <span>Jam Dunia &amp; Globe</span>
          </button>
          <button
            type="button"
            role="tab"
            class="tools-subtab ${toolState.activeSubTab === 'speedtest' ? 'is-active' : ''}"
            data-tool-subtab="speedtest"
            aria-selected="${toolState.activeSubTab === 'speedtest'}"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/></svg>
            <span>Speedtest</span>
          </button>
        </div>

        ${activeTabHtml}
      </div>
    `;

    bindToolEvents();
    startLiveTimers();
  }

  return {
    mount(subTab = null) {
      mounted = true;
      if (
        subTab === 'prayer' ||
        subTab === 'weather' ||
        subTab === 'worldclock' ||
        subTab === 'speedtest'
      ) {
        toolState.activeSubTab = subTab;
      }
      render();
      if (!toolState.location && !toolState.locationLoading) {
        ensureLocationAndLoad();
      }
      if (toolState.activeSubTab === 'speedtest') {
        ensureSpeedtestEnv();
      }
    },
    unmount() {
      mounted = false;
      if (speedAbort) {
        speedAbort.abort();
        speedAbort = null;
        toolState.speedRunning = false;
      }
      stopLiveTimers();
      if (rootEl) rootEl.innerHTML = '';
    },
    redrawTheme() {
      globeInstance?.redraw();
      gaugeInstance?.redraw();
    },
  };
}
