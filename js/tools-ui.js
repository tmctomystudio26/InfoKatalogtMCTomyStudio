/**
 * UI Controller for "Menu Utilitas" (Jadwal Sholat, Prakiraan Cuaca Presisi Tinggi,
 * Jam Dunia & Bola Dunia Interaktif, Speedtest, Downloader Video/Foto/Story/Caption,
 * & Kompresor Foto/Video HD Anti-Pecah Sosmed)
 * Zero external runtime dependencies; designed for both desktop & mobile touch ergonomics.
 */

import {
  COMPRESSION_METHODS,
  COMPRESSION_PLATFORM_PRESETS,
  INDONESIA_ZONES,
  WORLD_LOCATIONS,
  convertWorldTime,
  describeWeatherCode,
  detectDownloaderContentType,
  detectDownloaderPlatform,
  formatBytes,
  formatDetailedLocationLabel,
  getNextPrayerInfo,
  getZoneTimeParts,
  isIndonesiaLocation,
  matchIndonesianCityQuery,
  planMediaCompression,
  resolveAccurateWeatherCondition,
} from './tools-logic.js?v=45';
import {
  describeLocationSource,
  resolveUserLocation,
  searchCitiesOnline,
  setManualLocation,
} from './location.js?v=45';
import { createInteractiveGlobe } from './globe.js?v=45';
import {
  createSpeedometerGauge,
  fetchSpeedtestEnvironment,
  readClientDeviceTelemetry,
  runInternetSpeedtest,
} from './speedtest.js?v=45';
import {
  extractAudioFromVideoUrl,
  fetchMediaDownload,
  triggerBatchPhotoDownload,
  triggerDirectMediaSave,
} from './downloader.js?v=45';
import { compressMediaFile, inspectMediaFile } from './compressor.js?v=45';
import {
  ALL_TARGET_FORMATS,
  convertAnyFile,
  detectSourceFormat,
  getAvailableTargetFormats,
} from './converter.js?v=45';
import {
  detectMediaFileKind,
  identifyMediaSongAndVideo,
} from './song-finder.js?v=45';
import { formatAudioTime, getLoadingProgressMeta, isTrackInWatchLater } from './music-logic.js?v=45';
import { MUSIC_PRESET_CATEGORIES, getMusicController, initMusicPlayer } from './music.js?v=45';
import { normalizeUtilityConfig } from './store.js?v=45';

const PRAYER_CACHE_KEY = 'manifestudio_prayer_cache_v1';
const MYQURAN_CITIES_KEY = 'manifestudio_myquran_cities_v1';
const WEATHER_CACHE_KEY = 'manifestudio_weather_cache_v2';
const WEATHER_CALIBRATION_KEY = 'manifestudio_weather_cal_v1';

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
  const detailedLabel = formatDetailedLocationLabel(loc);
  const inIndonesia = isIndonesiaLocation(loc);
  const hasSubDistrictPrecision =
    !explicitCityId &&
    inIndonesia &&
    Boolean(loc.kelurahan || loc.kecamatan || loc.source === 'gps' || loc.hasExactCoords);

  const fetchAlAdhanPrecision = async () => {
    const url = `https://api.aladhan.com/v1/timings/${dd}-${mm}-${yyyy}?latitude=${encodeURIComponent(loc.lat)}&longitude=${encodeURIComponent(loc.lon)}&method=20`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    const json = await res.json();
    const t = json?.data?.timings;
    const d = json?.data?.date;
    if (!t) return null;
    const clean = (val) => String(val || '').replace(/\s*\(.*\)/, '').trim();
    const payload = {
      isoDate: iso,
      provider: inIndonesia ? 'Kemenag RI (Presisi Wilayah)' : 'Metode Kemenag RI (Koordinat)',
      cityLabel: detailedLabel,
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
  };

  const fetchMyQuranCitySchedule = async () => {
    const cities = await fetchMyQuranCities();
    let matchedCity = explicitCityId
      ? cities.find((c) => c.id === explicitCityId)
      : matchIndonesianCityQuery(cities, loc.city) || matchIndonesianCityQuery(cities, loc.region);

    if (!matchedCity && inIndonesia && loc.source === 'default') {
      matchedCity = cities.find((c) => c.id === '1301') || cities[0];
    }
    if (!matchedCity) return null;

    const url = `https://api.myquran.com/v2/sholat/jadwal/${encodeURIComponent(matchedCity.id)}/${yyyy}/${mm}/${dd}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    const json = await res.json();
    const j = json?.data?.jadwal;
    if (!json?.status || !j) return null;

    const payload = {
      isoDate: iso,
      provider: 'Kemenag RI (MyQuran v2)',
      cityLabel: detailedLabel && !explicitCityId ? detailedLabel : json.data.lokasi || matchedCity.lokasi,
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
  };

  if (hasSubDistrictPrecision) {
    try {
      const exact = await fetchAlAdhanPrecision();
      if (exact) return exact;
    } catch {
      // Fall through to MyQuran Kab/Kota
    }
  }

  try {
    const citySched = await fetchMyQuranCitySchedule();
    if (citySched) return citySched;
  } catch {
    // Fall through
  }

  if (!hasSubDistrictPrecision) {
    try {
      const exact = await fetchAlAdhanPrecision();
      if (exact) return exact;
    } catch {
      // Offline fallback below
    }
  }

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

async function fetchLiveStationObservation(lat, lon) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3600);
  try {
    const res = await fetch(
      `https://wttr.in/${encodeURIComponent(lat)},${encodeURIComponent(lon)}?format=j1`,
      { cache: 'no-store', signal: controller.signal }
    );
    if (!res.ok) return null;
    const json = await res.json();
    const cur = json?.current_condition?.[0];
    if (!cur) return null;
    return {
      precipMM: Number(cur.precipMM) || 0,
      weatherCode: Number(cur.weatherCode) || 0,
      weatherDesc: cur.weatherDesc?.[0]?.value || '',
      humidity: Number(cur.humidity) || 0,
      windspeedKmph: Number(cur.windspeedKmph) || 0,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchWeatherForecast(loc) {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(loc.lat)}&longitude=${encodeURIComponent(loc.lon)}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,showers,weather_code,wind_speed_10m,wind_gusts_10m,is_day` +
    `&hourly=temperature_2m,precipitation_probability,precipitation,rain,showers,weather_code,wind_gusts_10m,is_day` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,sunrise,sunset` +
    `&timezone=auto&forecast_days=7`;

  try {
    const [meteoSettled, stationSettled] = await Promise.allSettled([
      fetch(url, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)),
      fetchLiveStationObservation(loc.lat, loc.lon),
    ]);

    const json = meteoSettled.status === 'fulfilled' ? meteoSettled.value : null;
    const stationObs = stationSettled.status === 'fulfilled' ? stationSettled.value : null;

    if (json && json.current) {
      const payload = {
        fetchedAt: new Date().toISOString(),
        cityLabel: loc.city,
        regionLabel: loc.region || loc.country,
        timezone: json.timezone || 'Asia/Jakarta',
        current: json.current,
        hourly: json.hourly,
        daily: json.daily,
        stationObs,
        offline: false,
      };
      try {
        localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(payload));
      } catch {
        // Ignore
      }
      return payload;
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

function loadSavedWeatherCalibration() {
  try {
    const raw = localStorage.getItem(WEATHER_CALIBRATION_KEY);
    if (!raw) return 'auto';
    const parsed = JSON.parse(raw);
    if (parsed && parsed.mode && Date.now() - Number(parsed.ts || 0) < 3 * 3600 * 1000) {
      return parsed.mode;
    }
  } catch {
    // Ignore
  }
  return 'auto';
}

function saveWeatherCalibration(mode) {
  try {
    if (!mode || mode === 'auto') {
      localStorage.removeItem(WEATHER_CALIBRATION_KEY);
    } else {
      localStorage.setItem(
        WEATHER_CALIBRATION_KEY,
        JSON.stringify({ mode, ts: Date.now() })
      );
    }
  } catch {
    // Ignore
  }
}

export function createToolsHubController({
  rootEl,
  utilitiesConfig = null,
  onToast = () => {},
  onSubTabChange = () => {},
}) {
  const today = getTodayParts();
  const initialClock = getZoneTimeParts(new Date(), 'Asia/Jakarta');

  const toolState = {
    activeSubTab: 'prayer', // 'prayer' | 'weather' | 'worldclock' | 'speedtest' | 'downloader' | 'compressor' | 'music'
    utilities: normalizeUtilityConfig(utilitiesConfig),
    location: null,
    locationLoading: false,
    prayerData: null,
    prayerLoading: false,
    prayerError: '',
    prayerCities: [],
    prayerSearchQuery: '',
    prayerSubSuggestions: [],
    weatherData: null,
    weatherLoading: false,
    weatherError: '',
    weatherSearchQuery: '',
    weatherSuggestions: [],
    weatherCalibration: loadSavedWeatherCalibration(), // 'auto' | 'heavy-rain' | 'storm' | 'light-rain' | 'clear'
    selectedWorldId: 'jp',
    worldSearchQuery: '',
    globeAutoRotate: false,
    convDate: initialClock.isoDate || today.iso,
    convTime: initialClock.timeShort || '12:00',
    convSourceZone: 'Asia/Jakarta',
    speedRunning: false,
    speedPhase: 'idle',
    speedPhaseLabel: 'Siap menguji koneksi',
    speedProgress: 0,
    speedLiveMbps: 0,
    speedSamples: [],
    speedResult: null,
    speedEnv: null,
    speedEnvLoading: false,
    speedError: '',
    speedDevice: readClientDeviceTelemetry(),
    dlUrl: '',
    dlLoading: false,
    dlConvPercent: 0,
    dlConvLabel: '',
    dlConvStage: '',
    dlSavingIdx: -1,
    dlSaveActive: false,
    dlSavePercent: 0,
    dlSaveLabel: '',
    dlSaveStage: '',
    dlBatchSaving: false,
    dlBatchProgressText: '',
    dlError: '',
    dlResult: null,
    compMethodId: 'social-shield',
    compPresetId: 'tiktok-hd',
    compFile: null,
    compInspect: null,
    compLoading: false,
    compProgressPct: 0,
    compProgressLabel: '',
    compError: '',
    compResult: null,
    convCategoryId: 'all',
    convPresetId: 'docx-to-pdf',
    convFile: null,
    convSourceInfo: null,
    convTargetFormat: 'pdf',
    convLoading: false,
    convProgressPct: 0,
    convProgressLabel: '',
    convError: '',
    convResult: null,
    sfFile: null,
    sfKindInfo: null,
    sfPreviewUrl: '',
    sfUserHint: '',
    sfLoading: false,
    sfProgressPct: 0,
    sfProgressLabel: '',
    sfError: '',
    sfResult: null,
    musicBrowserTab: 'queue', // 'queue' | 'playlists' | 'watch-later'
    musicCategoryDrawerOpen: false,
    musicSelectedPlaylistId: '',
    musicStagePlaylistPickerOpen: false,
    musicRowPlaylistPickerId: '',
    musicEditingPlaylistId: '',
    musicPlaylistFeedback: '',
  };

  let clockTimer = null;
  let globeInstance = null;
  let gaugeInstance = null;
  let speedAbort = null;
  let prayerSearchTimer = null;
  let mounted = false;
  let musicUnsub = null;
  let isHubSeeking = false;

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
    if (musicUnsub) {
      musicUnsub();
      musicUnsub = null;
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
        const detailed = formatDetailedLocationLabel(loc);
        onToast(
          loc.source === 'gps'
            ? `Lokasi GPS diperbarui: ${detailed}`
            : `Lokasi terdeteksi: ${detailed}`
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
    const cityText = loc ? formatDetailedLocationLabel(loc) : 'Meminta izin lokasi...';
    const coordMeta =
      loc && Number.isFinite(Number(loc.lat)) && Number.isFinite(Number(loc.lon))
        ? ` · ${Number(loc.lat).toFixed(4)}, ${Number(loc.lon).toFixed(4)}`
        : '';

    return `
      <div class="tool-location-bar">
        <div class="tool-loc-info">
          <div class="tool-loc-title-row">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
            <strong>${escapeHtml(cityText)}</strong>
          </div>
          <span class="tool-loc-meta">${escapeHtml(sourceText)}${escapeHtml(coordMeta)}</span>
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
          .slice(0, 5)
      : [];
    const subDistrictResults = toolState.prayerSearchQuery.trim().length >= 2
      ? toolState.prayerSubSuggestions.slice(0, 6)
      : [];
    const prayerResultsHtml = renderPrayerSearchResultsHtml(subDistrictResults, filteredCities);

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
              placeholder="Cari Kelurahan, Kecamatan, atau Kab/Kota (cth: Sumur Bandung, Coblong)..."
              value="${escapeHtml(toolState.prayerSearchQuery)}"
              aria-label="Cari kelurahan, kecamatan, atau kota jadwal sholat Indonesia"
            />
          </div>
        </div>

        <div id="prayer-search-results-slot">${prayerResultsHtml}</div>

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
    const curDesc = current
      ? resolveAccurateWeatherCondition({
          current,
          hourly: w.hourly,
          nowIso: current.time || new Date().toISOString(),
          stationObs: w.stationObs,
          manualCalibration: toolState.weatherCalibration === 'auto' ? '' : toolState.weatherCalibration,
        })
      : null;

    const hourlyItems = [];
    if (w?.hourly?.time && w?.hourly?.temperature_2m) {
      const nowMs = Date.now();
      for (let i = 0; i < w.hourly.time.length; i += 1) {
        const tMs = Date.parse(w.hourly.time[i]);
        if (tMs >= nowMs - 3600000 && hourlyItems.length < 12) {
          const hourMm = Math.max(
            Number(w.hourly.precipitation?.[i]) || 0,
            Number(w.hourly.rain?.[i]) || 0,
            Number(w.hourly.showers?.[i]) || 0
          );
          const hourCode = Number(w.hourly.weather_code?.[i] ?? 0);
          const hourDesc =
            hourMm >= 4.0 && hourCode < 65
              ? describeWeatherCode(65, w.hourly.is_day?.[i] ?? 1)
              : hourMm >= 1.5 && hourCode < 63
              ? describeWeatherCode(63, w.hourly.is_day?.[i] ?? 1)
              : describeWeatherCode(hourCode, w.hourly.is_day?.[i] ?? 1);
          hourlyItems.push({
            hour: String(w.hourly.time[i]).slice(11, 16),
            temp: Math.round(w.hourly.temperature_2m[i]),
            rain: w.hourly.precipitation_probability?.[i] ?? 0,
            rainMm: Math.round(hourMm * 10) / 10,
            desc: hourDesc,
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

    const calModes = [
      { id: 'auto', label: 'Otomatis (Multi-Sensor Radar)' },
      { id: 'heavy-rain', label: 'Hujan Lebat Sekarang' },
      { id: 'storm', label: 'Hujan Badai / Petir' },
      { id: 'light-rain', label: 'Hujan Ringan / Gerimis' },
      { id: 'clear', label: 'Cerah / Berawan' },
    ];

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
              placeholder="Cari kelurahan, kecamatan, atau kota (cth: Coblong, Yogyakarta, Tokyo)..."
              value="${escapeHtml(toolState.weatherSearchQuery)}"
              aria-label="Cari kota prakiraan cuaca"
            />
          </div>
          <button type="button" class="btn btn-secondary btn-sm" id="weather-search-btn">
            Cari Lokasi
          </button>
        </div>

        ${
          toolState.weatherSuggestions.length > 0
            ? `<div class="tool-city-results" role="listbox" aria-label="Hasil pencarian kota cuaca">
                ${toolState.weatherSuggestions
                  .map(
                    (c, idx) => `
                  <button type="button" class="tool-city-option" data-weather-city-idx="${idx}">
                    <span>${escapeHtml(c.displayLabel || c.city)}</span>
                    <span class="tool-city-sub">${escapeHtml(c.region || c.country || 'Indonesia')}</span>
                  </button>
                `
                  )
                  .join('')}
              </div>`
            : ''
        }

        ${
          toolState.weatherLoading && !w
            ? `<div class="tool-loading-box">Mengambil data radar curah hujan &amp; stasiun cuaca real-time...</div>`
            : toolState.weatherError && !w
            ? `<div class="form-error" role="alert">${escapeHtml(toolState.weatherError)}</div>`
            : w && current && curDesc
            ? `
              <div class="weather-hero-card tone-${escapeHtml(curDesc.tone)}">
                <div class="weather-hero-main">
                  <div class="weather-icon-wrap">
                    ${getWeatherSvg(curDesc.iconKey)}
                  </div>
                  <div class="weather-hero-copy">
                    <span class="tool-kicker">
                      ${escapeHtml(formatDetailedLocationLabel(toolState.location || { city: w.cityLabel, region: w.regionLabel }))} · ${escapeHtml(w.timezone)}${w.offline ? ' · Cache Offline' : ' · Multi-Sensor Presisi'}
                    </span>
                    <div class="weather-temp-row">
                      <strong class="weather-temp-big mono-num">${Math.round(current.temperature_2m)}°C</strong>
                      <span class="weather-condition" data-testid="weather-condition-label">${escapeHtml(curDesc.label)}</span>
                    </div>
                    <p class="weather-sub">
                      Terasa seperti ${Math.round(current.apparent_temperature)}°C
                      ${curDesc.intensityText ? ` · <strong>${escapeHtml(curDesc.intensityText)}</strong>` : ''}
                    </p>
                  </div>
                </div>

                <div class="weather-metrics-grid weather-metrics-grid-4">
                  <div class="weather-metric">
                    <span>Kelembapan Udara</span>
                    <strong class="mono-num">${Math.round(current.relative_humidity_2m)}%</strong>
                  </div>
                  <div class="weather-metric">
                    <span>Angin &amp; Hembusan</span>
                    <strong class="mono-num">${Math.round(current.wind_speed_10m)} km/j${curDesc.gustKmh > current.wind_speed_10m ? ` (Gust ${curDesc.gustKmh})` : ''}</strong>
                  </div>
                  <div class="weather-metric">
                    <span>Intensitas Hujan</span>
                    <strong class="mono-num">${curDesc.effectiveRainMm ?? (current.precipitation ?? 0)} mm/jam</strong>
                  </div>
                  <div class="weather-metric">
                    <span>Peluang Hujan Jam Ini</span>
                    <strong class="mono-num">${curDesc.rainProb ?? (hourlyItems[0]?.rain ?? 0)}%</strong>
                  </div>
                </div>

                <div class="weather-calibration-bar" aria-label="Kalibrasi kondisi cuaca aktual di titik lokasi Anda">
                  <div class="weather-cal-head">
                    <span class="weather-cal-title">Kalibrasi Kondisi Aktual di Titik Anda:</span>
                    <span class="weather-cal-hint">Sesuaikan jika hujan lokal mendadak berbeda dari satelit</span>
                  </div>
                  <div class="weather-cal-pills">
                    ${calModes
                      .map(
                        (m) => `
                      <button
                        type="button"
                        class="weather-cal-pill ${toolState.weatherCalibration === m.id ? 'is-active' : ''}"
                        data-weather-cal="${escapeHtml(m.id)}"
                      >
                        ${escapeHtml(m.label)}
                      </button>
                    `
                      )
                      .join('')}
                  </div>
                </div>
              </div>

              ${
                hourlyItems.length > 0
                  ? `
                <div class="weather-block">
                  <h3 class="tool-subhead">Prakiraan Per Jam &amp; Intensitas Hujan</h3>
                  <div class="weather-hourly-strip">
                    ${hourlyItems
                      .map(
                        (h) => `
                      <div class="weather-hour-card">
                        <span class="mono-num weather-hour-time">${escapeHtml(h.hour)}</span>
                        <span class="weather-hour-icon">${getWeatherSvg(h.desc.iconKey)}</span>
                        <strong class="mono-num weather-hour-temp">${h.temp}°</strong>
                        <span class="weather-hour-rain mono-num">${h.rain}%${h.rainMm > 0 ? ` · ${h.rainMm}mm` : ''}</span>
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
      ? formatDetailedLocationLabel(loc)
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
                <span class="speed-kpi-sub">Rata-rata berkelanjutan</span>
              </div>
              <div class="speed-kpi-card">
                <span class="speed-kpi-label">Upload</span>
                <strong id="speed-kpi-ul" class="speed-kpi-val mono-num">${ulDisplay != null ? ulDisplay.toFixed(1) : '--'} <small>Mbps</small></strong>
                <span class="speed-kpi-sub">Rata-rata berkelanjutan</span>
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

  function renderDownloaderPanel() {
    const detected = detectDownloaderPlatform(toolState.dlUrl);
    const contentMeta = detectDownloaderContentType(toolState.dlUrl);
    const res = toolState.dlResult;
    const platformLabels = {
      tiktok: 'TikTok · Video / Foto / Story',
      youtube: 'YouTube · Video & MP3',
      instagram: 'Instagram · Reels / Foto / Carousel / Story',
      facebook: 'Facebook · Video / Foto / Story',
    };
    const previewVideo = res?.links?.find((l) => !l.isAudio && !l.isImage && l.ext === 'mp4') || null;
    const previewAudio = res?.links?.find((l) => l.isAudio && !l.extractAudioFromVideo) || null;
    const photos = Array.isArray(res?.photos) ? res.photos : [];
    const captionText = String(res?.caption || '').trim();

    const mediaTypeBadge = res
      ? res.isStory || res.mediaType === 'story'
        ? 'Story Sosmed'
        : photos.length > 1
        ? `Slide Carousel (${photos.length} Foto)`
        : photos.length === 1 && !previewVideo
        ? 'Postingan Foto HD'
        : 'Video HD No Watermark'
      : '';

    return `
      <div class="tool-panel" data-testid="downloader-panel">
        <div class="dl-hero-card">
          <div class="dl-head">
            <div>
              <span class="tool-kicker">Video · Foto · Multi-Slide · Story · Salin Caption</span>
              <h3 class="tool-subhead">Downloader Media Sosial All-in-One</h3>
              <p class="tool-hint">
                Unduh Video HD, Postingan Foto, Slide Carousel (Banyak Foto), Story Sosmed, &amp; Salin Caption dari TikTok, Instagram, YouTube, dan Facebook.
              </p>
            </div>
            <div class="dl-platform-pills" aria-label="Platform didukung">
              <span class="dl-plat-pill ${detected === 'tiktok' ? 'is-detected' : ''}">TikTok</span>
              <span class="dl-plat-pill ${detected === 'instagram' ? 'is-detected' : ''}">Instagram</span>
              <span class="dl-plat-pill ${detected === 'youtube' ? 'is-detected' : ''}">YouTube</span>
              <span class="dl-plat-pill ${detected === 'facebook' ? 'is-detected' : ''}">Facebook</span>
              ${
                contentMeta.isStory
                  ? `<span class="dl-plat-pill is-detected">Mode Story</span>`
                  : contentMeta.isPhotoUrl || contentMeta.isPhotoPost
                  ? `<span class="dl-plat-pill is-detected">Mode Foto/Carousel</span>`
                  : ''
              }
            </div>
          </div>

          <form id="dl-fetch-form" class="dl-input-row">
            <div class="search-box dl-url-box">
              <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
              <input
                type="url"
                id="dl-url-input"
                class="search-input"
                placeholder="Tempel link Video, Foto, Carousel, atau Story (TikTok / IG / YT / FB)..."
                value="${escapeHtml(toolState.dlUrl)}"
                aria-label="Tautan video, foto, atau story TikTok, YouTube, Instagram, atau Facebook"
                required
              />
            </div>
            <div class="dl-form-actions">
              <button type="button" class="btn btn-secondary btn-sm" id="dl-paste-btn">
                Tempel
              </button>
              <button type="submit" class="btn btn-primary btn-sm" id="dl-submit-btn" ${toolState.dlLoading ? 'disabled' : ''}>
                ${toolState.dlLoading ? 'Memproses...' : 'Ambil Media'}
              </button>
              ${
                toolState.dlUrl || res || toolState.dlError
                  ? `<button type="button" class="btn btn-ghost btn-sm" id="dl-clear-btn">Reset</button>`
                  : ''
              }
            </div>
          </form>

          <div class="dl-feature-chips" aria-label="Fitur downloader yang didukung">
            <span class="dl-feature-chip">✓ Video HD Tanpa Watermark</span>
            <span class="dl-feature-chip">✓ Postingan Foto &amp; Multi-Slide Carousel</span>
            <span class="dl-feature-chip">✓ Story IG / TikTok / FB</span>
            <span class="dl-feature-chip">✓ Salin Caption &amp; Hashtag 1-Klik</span>
          </div>

          ${
            toolState.dlError
              ? `<div class="form-error" role="alert">${escapeHtml(toolState.dlError)}</div>`
              : ''
          }
        </div>

        ${
          toolState.dlLoading
            ? `
              <div class="dl-progress-card" id="dl-conv-progress-card" data-testid="dl-conv-progress" role="status" aria-live="polite">
                <div class="dl-progress-head">
                  <span id="dl-conv-progress-label">${escapeHtml(toolState.dlConvLabel || 'Menganalisis tautan & mengonversi media...')}</span>
                  <strong class="mono-num" id="dl-conv-progress-pct">${Math.round(toolState.dlConvPercent || 10)}%</strong>
                </div>
                <div
                  class="dl-progress-track"
                  id="dl-conv-progress-bar"
                  role="progressbar"
                  aria-valuemin="0"
                  aria-valuemax="100"
                  aria-valuenow="${Math.round(toolState.dlConvPercent || 10)}"
                >
                  <div class="dl-progress-fill" id="dl-conv-progress-fill" style="width: ${Math.max(6, Math.round(toolState.dlConvPercent || 10))}%"></div>
                </div>
                <span class="dl-progress-sub">Sedang mengambil &amp; menyiapkan format Video MP4 + Audio MP3 agar siap diunduh...</span>
              </div>
            `
            : res
            ? `
              ${
                toolState.dlSaveActive
                  ? `
                    <div class="dl-progress-card is-download" id="dl-save-progress-card" data-testid="dl-save-progress" role="status" aria-live="polite">
                      <div class="dl-progress-head">
                        <span id="dl-save-progress-label">${escapeHtml(toolState.dlSaveLabel || 'Menyiapkan unduhan file...')}</span>
                        <strong class="mono-num" id="dl-save-progress-pct">${Math.round(toolState.dlSavePercent || 0)}%</strong>
                      </div>
                      <div
                        class="dl-progress-track"
                        id="dl-save-progress-bar"
                        role="progressbar"
                        aria-valuemin="0"
                        aria-valuemax="100"
                        aria-valuenow="${Math.round(toolState.dlSavePercent || 0)}"
                      >
                        <div class="dl-progress-fill is-download" id="dl-save-progress-fill" style="width: ${Math.max(4, Math.round(toolState.dlSavePercent || 0))}%"></div>
                      </div>
                    </div>
                  `
                  : ''
              }
              <div class="dl-result-card" data-testid="dl-result-card">
                <div class="dl-result-media">
                  ${
                    previewVideo
                      ? `<video class="dl-video-preview" controls playsinline preload="metadata" poster="${escapeHtml(res.thumbnail || '')}" src="${escapeHtml(previewVideo.url)}"></video>`
                      : photos.length > 0
                      ? `<img src="${escapeHtml(photos[0].url)}" alt="${escapeHtml(res.title)}" class="dl-thumb-img" />`
                      : res.thumbnail
                      ? `<img src="${escapeHtml(res.thumbnail)}" alt="" class="dl-thumb-img" />`
                      : `<div class="dl-thumb-fallback">Media Siap Diunduh</div>`
                  }
                </div>
                <div class="dl-result-info">
                  <div class="dl-result-badges">
                    <span class="dl-plat-pill is-detected">${escapeHtml(platformLabels[res.platform] || res.platform)}</span>
                    ${
                      mediaTypeBadge
                        ? `<span class="dl-dur-pill">${escapeHtml(mediaTypeBadge)}</span>`
                        : ''
                    }
                    ${
                      res.durationSec > 0
                        ? `<span class="mono-num dl-dur-pill">${Math.floor(res.durationSec / 60)}:${String(Math.floor(res.durationSec % 60)).padStart(2, '0')}</span>`
                        : ''
                    }
                  </div>
                  <h4 class="dl-result-title">${escapeHtml(res.title)}</h4>
                  <p class="dl-result-author">${escapeHtml(res.author)}</p>

                  ${
                    captionText
                      ? `
                    <div class="dl-caption-box" data-testid="dl-caption-box">
                      <div class="dl-caption-head">
                        <span>Caption / Deskripsi Postingan</span>
                        <button type="button" class="btn btn-secondary btn-sm" id="dl-copy-caption-btn" data-testid="dl-copy-caption-btn">
                          Salin Caption
                        </button>
                      </div>
                      <pre class="dl-caption-text">${escapeHtml(captionText)}</pre>
                    </div>
                  `
                      : ''
                  }

                  ${
                    photos.length > 0
                      ? `
                    <div class="dl-photo-gallery" data-testid="dl-photo-gallery">
                      <div class="dl-photo-gallery-head">
                        <strong>Galeri Foto (${photos.length} Slide HD)</strong>
                        ${
                          photos.length > 1
                            ? `<button type="button" class="btn btn-primary btn-sm" id="dl-batch-photos-btn" ${toolState.dlBatchSaving ? 'disabled' : ''}>
                                ${toolState.dlBatchSaving ? escapeHtml(toolState.dlBatchProgressText || 'Mengunduh Semua...') : `Unduh Semua Foto (${photos.length})`}
                              </button>`
                            : ''
                        }
                      </div>
                      <div class="dl-photo-grid">
                        ${photos
                          .map(
                            (p, pIdx) => `
                          <div class="dl-photo-item">
                            <img src="${escapeHtml(p.url)}" alt="${escapeHtml(p.label || `Foto ${pIdx + 1}`)}" class="dl-photo-thumb" loading="lazy" />
                            <button
                              type="button"
                              class="btn btn-secondary btn-sm dl-photo-save-btn"
                              data-dl-photo-url="${escapeHtml(p.url)}"
                              data-dl-photo-ext="${escapeHtml(p.ext || 'jpg')}"
                              data-dl-photo-idx="${pIdx}"
                            >
                              Unduh Foto #${pIdx + 1}
                            </button>
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
                    previewAudio
                      ? `<div class="dl-audio-wrap">
                          <span class="dl-audio-label">Putar Audio Langsung (${escapeHtml(previewAudio.quality)})</span>
                          <audio class="dl-audio-preview" controls preload="none" src="${escapeHtml(previewAudio.url)}"></audio>
                        </div>`
                      : ''
                  }

                  <div class="dl-links-grid">
                    ${res.links
                      .map(
                        (item, idx) => `
                      <button
                        type="button"
                        class="btn ${idx === 0 ? 'btn-primary' : 'btn-secondary'} btn-sm dl-save-btn"
                        data-dl-save-idx="${idx}"
                        data-dl-url="${escapeHtml(item.url)}"
                        data-dl-ext="${escapeHtml(item.ext)}"
                        ${toolState.dlSavingIdx === idx ? 'disabled' : ''}
                      >
                        ${toolState.dlSavingIdx === idx ? 'Mengunduh...' : escapeHtml(item.label)}
                        <span class="dl-quality-tag">${escapeHtml(item.quality)}</span>
                      </button>
                    `
                      )
                      .join('')}
                  </div>
                </div>
              </div>
            `
            : ''
        }
      </div>
    `;
  }

  function renderCompressorPanel() {
    const inspect = toolState.compInspect;
    const res = toolState.compResult;
    const previewPlan = inspect
      ? planMediaCompression({
          mediaKind: inspect.mediaKind,
          methodId: toolState.compMethodId,
          presetId: toolState.compPresetId,
          originalWidth: inspect.width,
          originalHeight: inspect.height,
          originalBytes: inspect.sizeBytes,
          durationSec: inspect.durationSec,
        })
      : null;

    const showCompProgress = Boolean(toolState.compLoading || res || inspect);
    const compPct = toolState.compLoading
      ? Math.max(4, Math.min(99, Math.round(toolState.compProgressPct || 12)))
      : res
      ? 100
      : 0;
    const compProgressText = toolState.compLoading
      ? toolState.compProgressLabel || 'Mengompresi berkas media...'
      : res
      ? `Kompresi selesai! Hemat -${res.savedPercent}% (${res.savedBytesLabel})`
      : inspect
      ? `File siap dikompres (${formatBytes(inspect.sizeBytes)}) — Tekan "Kompres Sekarang"`
      : 'Masukkan file foto atau video untuk memulai kompresi';

    return `
      <div class="tool-panel" data-testid="compressor-panel">
        <div class="compressor-hero-card">
          <div class="compressor-head">
            <div>
              <span class="tool-kicker">Open-Source Compression Engine · FFmpeg WebAssembly / Squoosh / UPNG</span>
              <h3 class="tool-subhead">Kompres Foto &amp; Video HD Nyata Tanpa Pecah di Sosmed</h3>
              <p class="tool-hint">
                Menggunakan algoritma pencarian biner kualitas adaptif &amp; kuantisasi palet open-source untuk <strong>memangkas ukuran byte foto &amp; video secara nyata (30%–80% lebih ringan)</strong> agar lolos kompresi paksa TikTok, Instagram, dan WhatsApp.
              </p>
            </div>
          </div>

          <!-- 1. File Upload / Dropzone right at the top after Title & Description -->
          <div class="comp-section-block" style="margin-top:0.35rem;">
            <label class="comp-block-label">1. Masukkan atau Pilih File Foto / Video yang Ingin Dikompres:</label>
            <div class="comp-dropzone" id="comp-dropzone" data-testid="comp-dropzone">
              <input
                type="file"
                id="comp-file-input"
                data-testid="comp-file-input"
                class="visually-hidden-file"
                accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
              />
              <div class="comp-dropzone-inner">
                <div class="comp-dropzone-icon">
                  <img src="./assets/icons/tool-compressor.svg" alt="" width="44" height="44" />
                </div>
                <div class="comp-dropzone-copy">
                  <strong>${inspect ? escapeHtml(inspect.name) : 'Pilih atau Tarik File Foto / Video ke Sini'}</strong>
                  <span>
                    ${
                      inspect
                        ? `${inspect.mediaKind === 'video' ? 'Video' : 'Foto'} · ${inspect.width}×${inspect.height}px · ${formatBytes(inspect.sizeBytes)}${inspect.durationSec ? ` · ${inspect.durationSec}s` : ''}`
                        : 'Mendukung Foto (JPG, JPEG, PNG, WebP) & Video (MP4, MOV, WebM) — Kompresi Nyata Berbasis Engine Open-Source'
                    }
                  </span>
                </div>
                <div class="comp-dropzone-actions">
                  <label for="comp-file-input" class="btn btn-secondary btn-sm admin-file-trigger">
                    ${inspect ? 'Ganti File' : 'Pilih Foto / Video'}
                  </label>
                  ${
                    inspect
                      ? `<button type="button" class="btn btn-primary btn-sm" id="comp-run-btn" data-testid="comp-run-btn" ${toolState.compLoading ? 'disabled' : ''}>
                          ${toolState.compLoading ? 'Mengompresi...' : 'Kompres Sekarang'}
                        </button>`
                      : ''
                  }
                </div>
              </div>
            </div>

            ${
              showCompProgress
                ? `
              <div
                class="tool-live-progress-box ${toolState.compLoading ? 'is-active' : res ? 'is-done' : ''}"
                id="comp-progress-box"
                data-testid="comp-progress-box"
                role="progressbar"
                aria-valuemin="0"
                aria-valuemax="100"
                aria-valuenow="${compPct}"
              >
                <div class="tool-live-progress-head">
                  <span class="tool-live-progress-label" id="comp-progress-label">${escapeHtml(compProgressText)}</span>
                  <strong class="tool-live-progress-pct mono-num" id="comp-progress-pct" data-testid="comp-progress-pct">${compPct}%</strong>
                </div>
                <div class="tool-live-progress-track">
                  <div class="tool-live-progress-fill" id="comp-progress-fill" style="width: ${compPct}%"></div>
                </div>
              </div>
            `
                : ''
            }

            ${
              previewPlan && !res && !toolState.compLoading
                ? `
              <div class="comp-plan-preview">
                <span>Rencana Optimasi: <strong>${escapeHtml(previewPlan.methodLabel)}</strong> (${escapeHtml(previewPlan.presetLabel)})</span>
                <span class="mono-num">Resolusi: ${previewPlan.originalWidth}×${previewPlan.originalHeight} → ${previewPlan.targetWidth}×${previewPlan.targetHeight} · Target Hemat ~${previewPlan.estimatedSavedPercent}%</span>
              </div>
            `
                : ''
            }

            ${
              toolState.compError
                ? `<div class="form-error" role="alert">${escapeHtml(toolState.compError)}</div>`
                : ''
            }
          </div>

          ${
            res
              ? `
            <div class="comp-result-card" data-testid="comp-result-card" style="margin-top:0.85rem;">
              <div class="comp-result-preview">
                ${
                  res.mediaKind === 'video'
                    ? `<video class="dl-video-preview" controls playsinline src="${escapeHtml(res.outputUrl)}"></video>`
                    : `<img src="${escapeHtml(res.outputUrl)}" alt="Hasil kompresi HD" class="dl-thumb-img" />`
                }
              </div>
              <div class="comp-result-body">
                <div class="dl-result-badges">
                  <span class="dl-plat-pill is-detected">${escapeHtml(res.qualityBadge)}</span>
                  <span class="dl-dur-pill">${escapeHtml(res.plan.methodLabel)}</span>
                  <span class="dl-dur-pill">${escapeHtml(res.plan.presetLabel)}</span>
                </div>

                <h4 class="dl-result-title">${escapeHtml(res.fileName)}</h4>

                <div class="comp-stats-grid">
                  <div class="comp-stat-box">
                    <span>Ukuran Awal</span>
                    <strong class="mono-num" data-testid="comp-orig-size">${escapeHtml(res.originalSizeLabel)}</strong>
                    <small class="mono-num">${res.originalWidth}×${res.originalHeight}px (${res.originalSize} B)</small>
                  </div>
                  <div class="comp-stat-box is-highlight">
                    <span>Ukuran Hasil Kompres</span>
                    <strong class="mono-num" data-testid="comp-new-size">${escapeHtml(res.compressedSizeLabel)}</strong>
                    <small class="mono-num">${res.targetWidth}×${res.targetHeight}px (${res.compressedSize} B)</small>
                  </div>
                  <div class="comp-stat-box">
                    <span>Penghematan Nyata</span>
                    <strong class="mono-num" data-testid="comp-saved-pct">${res.savedBytes > 0 ? `-${res.savedPercent}% (${escapeHtml(res.savedBytesLabel)})` : 'Bit-Exact Optimal'}</strong>
                    <small>${escapeHtml(res.engineLabel || 'Open-Source Squoosh/UPNG Engine')}</small>
                  </div>
                </div>

                <ul class="comp-guard-list">
                  ${(res.plan.guardrails || [])
                    .map((g) => `<li>✓ ${escapeHtml(g)}</li>`)
                    .join('')}
                </ul>

                <div class="comp-result-actions">
                  <a
                    href="${escapeHtml(res.outputUrl)}"
                    download="${escapeHtml(res.fileName)}"
                    class="btn btn-primary btn-sm"
                    data-testid="comp-download-btn"
                  >
                    Unduh Hasil Kompres HD (${escapeHtml(res.compressedSizeLabel)})
                  </a>
                  <button type="button" class="btn btn-ghost btn-sm" id="comp-reset-btn">
                    Kompres File Lain
                  </button>
                </div>
              </div>
            </div>
          `
              : ''
          }

          <!-- 2. Method Selector -->
          <div class="comp-section-block">
            <label class="comp-block-label">2. Pilih Metode Kompresi Open-Source (Tanpa Blur / Pecah):</label>
            <div class="comp-methods-grid" role="radiogroup" aria-label="Metode kompresi tanpa kurangi kualitas">
              ${COMPRESSION_METHODS.map((m) => {
                const isSelected = toolState.compMethodId === m.id;
                return `
                  <button
                    type="button"
                    class="comp-method-card ${isSelected ? 'is-active' : ''}"
                    data-comp-method="${escapeHtml(m.id)}"
                    aria-pressed="${isSelected}"
                  >
                    <div class="comp-method-top">
                      <strong>${escapeHtml(m.label)}</strong>
                      <span class="comp-method-badge">${escapeHtml(m.badge)}</span>
                    </div>
                    <p class="comp-method-desc">${escapeHtml(m.description)}</p>
                  </button>
                `;
              }).join('')}
            </div>
          </div>

          <!-- 3. Target Platform Preset -->
          <div class="comp-section-block">
            <label class="comp-block-label">3. Pilih Standar Platform Tujuan (Anti-Recompress Guard):</label>
            <div class="comp-presets-row" role="radiogroup" aria-label="Target platform media sosial">
              ${COMPRESSION_PLATFORM_PRESETS.map((p) => {
                const isSelected = toolState.compPresetId === p.id;
                return `
                  <button
                    type="button"
                    class="comp-preset-pill ${isSelected ? 'is-active' : ''}"
                    data-comp-preset="${escapeHtml(p.id)}"
                    aria-pressed="${isSelected}"
                  >
                    <strong>${escapeHtml(p.label)}</strong>
                    <span>Maks ${p.maxDimension === 99999 ? 'Asli 1:1' : `${p.maxDimension}px`} · ${p.targetVideoMbps} Mbps</span>
                  </button>
                `;
              }).join('')}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderConverterPanel() {
    const sourceInfo = toolState.convSourceInfo;
    const availableTargets = sourceInfo
      ? getAvailableTargetFormats(sourceInfo)
      : ALL_TARGET_FORMATS;
    const res = toolState.convResult;

    // Group target formats by their group category for clean <optgroup> dropdown rendering
    const groupedMap = new Map();
    for (const item of availableTargets) {
      const grp = item.group || 'Format Tujuan';
      if (!groupedMap.has(grp)) groupedMap.set(grp, []);
      groupedMap.get(grp).push(item);
    }

    const dropdownOptionsHtml = Array.from(groupedMap.entries())
      .map(
        ([groupName, items]) => `
        <optgroup label="${escapeHtml(groupName)}">
          ${items
            .map(
              (t) => `
            <option value="${escapeHtml(t.id)}" ${toolState.convTargetFormat === t.id ? 'selected' : ''}>
              → .${escapeHtml(t.id.toUpperCase())} — ${escapeHtml(t.label)}
            </option>
          `
            )
            .join('')}
        </optgroup>
      `
      )
      .join('');

    const showConvProgress = Boolean(toolState.convLoading || res || toolState.convFile);
    const convPct = toolState.convLoading
      ? Math.max(4, Math.min(99, Math.round(toolState.convProgressPct || 14)))
      : res
      ? 100
      : 0;
    const convProgressText = toolState.convLoading
      ? toolState.convProgressLabel || 'Mengonversi format berkas...'
      : res
      ? `Konversi ke .${res.targetFormat} selesai & terverifikasi (${res.outputSizeLabel})`
      : toolState.convFile && sourceInfo
      ? `Terdeteksi ${sourceInfo.label} — Pilih format tujuan di dropdown lalu klik "Konversi Sekarang"`
      : 'Masukkan file apa saja untuk mendeteksi format otomatis';

    return `
      <div class="tool-panel" data-testid="converter-panel">
        <div class="compressor-hero-card">
          <div class="compressor-head">
            <div>
              <span class="tool-kicker">All-in-One File Converter · 85+ Konversi Multi-Format &amp; OpenXML</span>
              <h3 class="tool-subhead">Konversi Semua Format File (DOCX, Excel, PDF, Foto, Video, Audio &amp; ZIP)</h3>
              <p class="tool-hint">
                Masukkan file apa saja di bawah ini — sistem otomatis mendeteksi format berkas asal Anda dan menampilkan pilihan format konversi tujuan dalam daftar dropdown ringkas.
              </p>
            </div>
          </div>

          <!-- 1. File Upload / Dropzone at the very top right after Title & Description -->
          <div class="comp-section-block" style="margin-top:0.35rem;">
            <label class="comp-block-label">1. Masukkan atau Pilih File yang Ingin Dikonversi:</label>
            <div class="comp-dropzone" id="conv-dropzone" data-testid="conv-dropzone">
              <input
                type="file"
                id="conv-file-input"
                data-testid="conv-file-input"
                class="visually-hidden-file"
                accept="*/*"
              />
              <div class="comp-dropzone-inner">
                <div class="comp-dropzone-icon">
                  <img src="./assets/icons/tool-converter.svg" alt="" width="44" height="44" />
                </div>
                <div class="comp-dropzone-copy">
                  <strong>${toolState.convFile ? escapeHtml(toolState.convFile.name) : 'Pilih atau Tarik File Apa Saja ke Sini'}</strong>
                  <span>
                    ${
                      toolState.convFile && sourceInfo
                        ? `${escapeHtml(sourceInfo.label)} · ${formatBytes(toolState.convFile.size)} → Siap diubah ke .${escapeHtml(toolState.convTargetFormat.toUpperCase())}`
                        : 'Mendukung DOCX, XLSX, CSV, TSV, PDF, RTF, MD, TXT, HTML, JSON, XML, YAML, JPG, JPEG, PNG, WebP, BMP, GIF, ICO, SVG, MP4, MOV, WebM, MP3, WAV, M4A, AAC, OGG, FLAC & ZIP'
                    }
                  </span>
                </div>
                <div class="comp-dropzone-actions">
                  <label for="conv-file-input" class="btn btn-secondary btn-sm admin-file-trigger">
                    ${toolState.convFile ? 'Ganti File' : 'Pilih File'}
                  </label>
                </div>
              </div>
            </div>

            <!-- 2. Auto-Detected Format Box & Target Format Dropdown Selector -->
            <div class="conv-auto-dropdown-bar">
              <div class="conv-detected-box ${sourceInfo ? 'is-detected' : ''}" data-testid="conv-detected-box">
                <span class="conv-detected-icon mono-num">
                  ${sourceInfo ? `.${escapeHtml(sourceInfo.ext.toUpperCase().slice(0, 4))}` : 'AUTO'}
                </span>
                <div class="conv-detected-copy">
                  <span class="conv-detected-kicker">
                    ${sourceInfo ? '✓ Format File Terdeteksi Otomatis' : 'Deteksi Format Otomatis'}
                  </span>
                  <strong class="conv-detected-title" data-testid="conv-detected-label">
                    ${
                      toolState.convFile && sourceInfo
                        ? `${escapeHtml(sourceInfo.label)} (${formatBytes(toolState.convFile.size)})`
                        : 'Belum ada file dipilih'
                    }
                  </strong>
                  <span class="conv-detected-sub">
                    ${
                      sourceInfo
                        ? `${availableTargets.length} format konversi kompatibel tersedia di dropdown`
                        : 'Format asal akan terdeteksi otomatis begitu file dimasukkan'
                    }
                  </span>
                </div>
              </div>

              <div class="conv-select-controls">
                <label for="conv-target-select" class="conv-select-label">
                  2. Pilih Format Hasil Konversi (${availableTargets.length} Format Tersedia):
                </label>
                <div class="conv-select-row">
                  <select
                    id="conv-target-select"
                    class="conv-target-select"
                    data-testid="conv-target-select"
                    aria-label="Pilih format hasil konversi"
                  >
                    ${dropdownOptionsHtml}
                  </select>
                  <button
                    type="button"
                    class="btn btn-primary btn-sm"
                    id="conv-run-btn"
                    data-testid="conv-run-btn"
                    ${!toolState.convFile || toolState.convLoading ? 'disabled' : ''}
                  >
                    ${
                      toolState.convLoading
                        ? 'Mengonversi...'
                        : `Konversi ke .${escapeHtml(toolState.convTargetFormat.toUpperCase())}`
                    }
                  </button>
                </div>
              </div>
            </div>

            ${
              showConvProgress
                ? `
              <div
                class="tool-live-progress-box ${toolState.convLoading ? 'is-active' : res ? 'is-done' : ''}"
                id="conv-progress-box"
                data-testid="conv-progress-box"
                role="progressbar"
                aria-valuemin="0"
                aria-valuemax="100"
                aria-valuenow="${convPct}"
              >
                <div class="tool-live-progress-head">
                  <span class="tool-live-progress-label" id="conv-progress-label">${escapeHtml(convProgressText)}</span>
                  <strong class="tool-live-progress-pct mono-num" id="conv-progress-pct" data-testid="conv-progress-pct">${convPct}%</strong>
                </div>
                <div class="tool-live-progress-track">
                  <div class="tool-live-progress-fill" id="conv-progress-fill" style="width: ${convPct}%"></div>
                </div>
              </div>
            `
                : ''
            }

            ${
              toolState.convError
                ? `<div class="form-error" role="alert">${escapeHtml(toolState.convError)}</div>`
                : ''
            }
          </div>

          ${
            res
              ? `
            <div class="comp-result-card" data-testid="conv-result-card" style="margin-top:0.85rem;">
              <div class="comp-result-preview">
                ${
                  res.mimeType.startsWith('image/')
                    ? `<img src="${escapeHtml(res.outputUrl)}" alt="Hasil konversi" class="dl-thumb-img" />`
                    : res.mimeType.startsWith('video/')
                    ? `<video class="dl-video-preview" controls playsinline preload="metadata" src="${escapeHtml(res.outputUrl)}"></video>`
                    : res.mimeType.startsWith('audio/')
                    ? `<div style="padding:1rem;width:100%;text-align:center;">
                        <img src="./assets/icons/tool-converter.svg" alt="" width="52" height="52" style="margin:0 auto 0.65rem;" />
                        <audio controls preload="metadata" src="${escapeHtml(res.outputUrl)}" style="width:100%;max-width:260px;"></audio>
                      </div>`
                    : `<div style="padding:1.25rem;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0.5rem;color:#F8FAFC;">
                        <img src="./assets/icons/tool-converter.svg" alt="" width="56" height="56" />
                        <strong class="mono-num" style="font-size:1.05rem;color:#F8FAFC;">.${escapeHtml(res.targetFormat)}</strong>
                        <span style="font-size:0.75rem;color:#CBD5E1;">${escapeHtml(res.signatureLabel)}</span>
                      </div>`
                }
              </div>
              <div class="comp-result-body">
                <div class="dl-result-badges">
                  <span class="dl-plat-pill is-detected" data-testid="conv-verified-badge">
                    ${res.verified ? '✓ Terverifikasi &amp; Siap Putar' : 'Selesai'} · ${escapeHtml(res.sourceFormat)} → ${escapeHtml(res.targetFormat)}
                  </span>
                  <span class="dl-dur-pill">${escapeHtml(res.engineLabel)}</span>
                  <span class="dl-dur-pill">${escapeHtml(res.signatureLabel)}</span>
                </div>

                <h4 class="dl-result-title" data-testid="conv-output-filename">${escapeHtml(res.fileName)}</h4>

                <div class="comp-stats-grid">
                  <div class="comp-stat-box">
                    <span>Berkas Sumber</span>
                    <strong class="mono-num">${escapeHtml(res.inputSizeLabel)}</strong>
                    <small>${escapeHtml(res.sourceLabel)}</small>
                  </div>
                  <div class="comp-stat-box is-highlight">
                    <span>Hasil Konversi (.${escapeHtml(res.targetFormat)})</span>
                    <strong class="mono-num" data-testid="conv-output-size">${escapeHtml(res.outputSizeLabel)}</strong>
                    <small class="mono-num">${res.outputBytes} Bytes</small>
                  </div>
                  <div class="comp-stat-box">
                    <span>Status Verifikasi</span>
                    <strong class="mono-num">${res.verified ? '100% Valid' : 'Siap Unduh'}</strong>
                    <small>${escapeHtml(res.summaryNote || 'Siap dibuka di perangkat Anda')}</small>
                  </div>
                </div>

                <div class="comp-result-actions">
                  <a
                    href="${escapeHtml(res.outputUrl)}"
                    download="${escapeHtml(res.fileName)}"
                    class="btn btn-primary btn-sm"
                    data-testid="conv-download-btn"
                  >
                    Unduh ${escapeHtml(res.fileName)} (${escapeHtml(res.outputSizeLabel)})
                  </a>
                  <button type="button" class="btn btn-ghost btn-sm" id="conv-reset-btn">
                    Konversi File Lain
                  </button>
                </div>
              </div>
            </div>
          `
              : ''
          }
        </div>
      </div>
    `;
  }

  function renderSongFinderPanel() {
    const file = toolState.sfFile;
    const kindInfo = toolState.sfKindInfo;
    const res = toolState.sfResult;
    const showProgress = Boolean(toolState.sfLoading || res || file);
    const pct = toolState.sfLoading
      ? Math.max(6, Math.min(99, Math.round(toolState.sfProgressPct || 12)))
      : res
      ? 100
      : 0;
    const progressText = toolState.sfLoading
      ? toolState.sfProgressLabel || 'Mengidentifikasi sidik jari lagu & video...'
      : res
      ? `Identifikasi selesai! "${res.bestMatch.title}" — ${res.bestMatch.artist} (${res.bestMatch.similarityPercent}% cocok)`
      : file && kindInfo
      ? `Terdeteksi ${kindInfo.formatLabel} — Klik "Cari Judul Lagu & Sumber Sekarang"`
      : 'Masukkan file audio atau video untuk membaca jenis media & mencari judul lagu otomatis';

    return `
      <div class="tool-panel" data-testid="songfinder-panel">
        <div class="compressor-hero-card">
          <div class="compressor-head">
            <div>
              <span class="tool-kicker">Multi-API &amp; Public AI Music + Social Video Identifier · 7 Engine Paralel</span>
              <h3 class="tool-subhead">Cari Judul Lagu, Musik &amp; Sumber Video Mirip (Audio / Video Otomatis)</h3>
              <p class="tool-hint">
                Masukkan file <strong>Audio</strong> (MP3, WAV, M4A, AAC, OGG, FLAC) maupun <strong>Video</strong> (MP4, MOV, WebM, MKV). Sistem otomatis mendeteksi jenis file, menganalisis sidik jari akustik + metadata + AI publik + multi-API musik (iTunes, YouTube Music, Spotify, Audius, MusicBrainz), serta khusus untuk file <strong>Video</strong> juga menganalisis kemiripan frame visual lintas <strong>YouTube, TikTok, Instagram Reels, &amp; Sosmed</strong>.
              </p>
            </div>
          </div>

          <!-- 1. File Upload / Dropzone at the very top right after Title & Description -->
          <div class="comp-section-block" style="margin-top:0.35rem;">
            <label class="comp-block-label">1. Masukkan atau Pilih File Audio / Video yang Ingin Dicari Judul Lagu &amp; Sumbernya:</label>
            <div class="comp-dropzone" id="sf-dropzone" data-testid="sf-dropzone">
              <input
                type="file"
                id="sf-file-input"
                data-testid="sf-file-input"
                class="visually-hidden-file"
                accept="audio/*,video/*,.mp3,.wav,.m4a,.mp4a,.aac,.ogg,.flac,.opus,.mp4,.mov,.webm,.mkv,.avi"
              />
              <div class="comp-dropzone-inner">
                <div class="comp-dropzone-icon">
                  <img src="./assets/icons/tool-songfinder.svg" alt="" width="44" height="44" />
                </div>
                <div class="comp-dropzone-copy">
                  <strong>${file ? escapeHtml(file.name) : 'Pilih atau Tarik File Audio / Video ke Sini'}</strong>
                  <span>
                    ${
                      file && kindInfo
                        ? `${escapeHtml(kindInfo.badge)} · ${escapeHtml(kindInfo.formatLabel)} · ${formatBytes(file.size)}`
                        : 'Mendukung semua Audio (MP3, M4A, WAV, AAC, OGG, FLAC) & Video (MP4, MOV, WebM, MKV) — Deteksi Otomatis Audio vs Video'
                    }
                  </span>
                </div>
                <div class="comp-dropzone-actions">
                  <label for="sf-file-input" class="btn btn-secondary btn-sm admin-file-trigger">
                    ${file ? 'Ganti File' : 'Pilih Audio / Video'}
                  </label>
                  ${
                    file
                      ? `<button type="button" class="btn btn-primary btn-sm" id="sf-run-btn" data-testid="sf-run-btn" ${toolState.sfLoading ? 'disabled' : ''}>
                          ${toolState.sfLoading ? 'Mengidentifikasi...' : 'Cari Judul Lagu & Sumber'}
                        </button>`
                      : ''
                  }
                </div>
              </div>
            </div>

            <!-- Auto-detected Media Type & Optional Lyrics/Caption Context Input -->
            <div class="conv-auto-dropdown-bar">
              <div class="conv-detected-box ${kindInfo ? 'is-detected' : ''}" data-testid="sf-detected-box">
                <span class="conv-detected-icon mono-num">
                  ${kindInfo ? (kindInfo.mediaKind === 'video' ? 'VID' : 'AUD') : 'AUTO'}
                </span>
                <div class="conv-detected-copy">
                  <span class="conv-detected-kicker" data-testid="sf-detected-kind">
                    ${
                      kindInfo
                        ? kindInfo.mediaKind === 'video'
                          ? '✓ FILE VIDEO TERDETEKSI (Mode Lagu + Analisis Kemiripan Video Sosmed)'
                          : '✓ FILE AUDIO TERDETEKSI (Mode Identifikasi Lagu & Sumber Musik)'
                        : 'Deteksi Otomatis Audio / Video'
                    }
                  </span>
                  <strong class="conv-detected-title" data-testid="sf-detected-label">
                    ${
                      file && kindInfo
                        ? `${escapeHtml(kindInfo.formatLabel)} (${formatBytes(file.size)})`
                        : 'Belum ada file audio/video dipilih'
                    }
                  </strong>
                  <span class="conv-detected-sub">
                    ${
                      kindInfo?.mediaKind === 'video'
                        ? 'Mengekstrak spektrum audio + 3 keyframe visual untuk mencari lagu & sumber video mirip di YT, TikTok, IG'
                        : 'Menggabungkan Acoustic Chromagram, ID3/MP4 Tag, Apple iTunes, YT Music, Audius, MusicBrainz & AI Publik'
                    }
                  </span>
                </div>
              </div>

              <div class="conv-select-controls">
                <label for="sf-hint-input" class="conv-select-label">
                  2. Petunjuk Tambahan / Potongan Lirik / Konteks Video (Opsional, Memperkuat Akurasi AI):
                </label>
                <div class="conv-select-row">
                  <input
                    type="text"
                    id="sf-hint-input"
                    data-testid="sf-hint-input"
                    class="conv-target-select"
                    placeholder="Contoh: potongan lirik, nama penyanyi, atau tren TikTok/Reels (kosongkan jika tidak tahu)..."
                    value="${escapeHtml(toolState.sfUserHint)}"
                  />
                  <button
                    type="button"
                    class="btn btn-primary btn-sm"
                    id="sf-run-secondary-btn"
                    data-testid="sf-run-secondary-btn"
                    ${!file || toolState.sfLoading ? 'disabled' : ''}
                  >
                    ${toolState.sfLoading ? 'Mencari...' : 'Identifikasi Sekarang'}
                  </button>
                </div>
              </div>
            </div>

            ${
              showProgress
                ? `
              <div
                class="tool-live-progress-box ${toolState.sfLoading ? 'is-active' : res ? 'is-done' : ''}"
                id="sf-progress-box"
                data-testid="sf-progress-box"
                role="progressbar"
                aria-valuemin="0"
                aria-valuemax="100"
                aria-valuenow="${pct}"
              >
                <div class="tool-live-progress-head">
                  <span class="tool-live-progress-label" id="sf-progress-label">${escapeHtml(progressText)}</span>
                  <strong class="tool-live-progress-pct mono-num" id="sf-progress-pct" data-testid="sf-progress-pct">${pct}%</strong>
                </div>
                <div class="tool-live-progress-track">
                  <div class="tool-live-progress-fill" id="sf-progress-fill" style="width: ${pct}%"></div>
                </div>
              </div>
            `
                : ''
            }

            ${
              toolState.sfError
                ? `<div class="form-error" role="alert">${escapeHtml(toolState.sfError)}</div>`
                : ''
            }
          </div>

          ${
            res
              ? `
            <div class="comp-result-card sf-result-card" data-testid="sf-result-card" style="margin-top:0.9rem;">
              <div class="comp-result-preview sf-result-preview">
                ${
                  res.mediaKind === 'video' && toolState.sfPreviewUrl
                    ? `<video class="dl-video-preview" controls playsinline preload="metadata" src="${escapeHtml(toolState.sfPreviewUrl)}"></video>`
                    : `<img src="${escapeHtml(res.bestMatch.thumbnail || './assets/icons/tool-songfinder.svg')}" alt="${escapeHtml(res.bestMatch.title)}" class="dl-thumb-img" />`
                }
                ${
                  res.mediaKind === 'audio' && toolState.sfPreviewUrl
                    ? `<div style="padding:0.65rem 0.75rem;width:100%;">
                        <audio controls preload="metadata" src="${escapeHtml(toolState.sfPreviewUrl)}" style="width:100%;"></audio>
                      </div>`
                    : ''
                }
              </div>

              <div class="comp-result-body">
                <div class="dl-result-badges">
                  <span class="dl-plat-pill is-detected" data-testid="sf-similarity-badge">
                    ✓ Kemiripan ${res.bestMatch.similarityPercent}% · ${res.mediaKind === 'video' ? 'VIDEO + AUDIO COCOK' : 'AUDIO LAGU COCOK'}
                  </span>
                  <span class="dl-dur-pill">${escapeHtml(res.formatLabel)}</span>
                  <span class="dl-dur-pill">${escapeHtml(res.bestMatch.provider || 'Multi-API Music Engine')}</span>
                  <span class="dl-dur-pill mono-num">${escapeHtml(res.acoustic.fingerprintHex)}</span>
                </div>

                <h4 class="dl-result-title" data-testid="sf-song-title" style="font-size:1.22rem;margin-top:0.25rem;">
                  ${escapeHtml(res.bestMatch.title)}
                </h4>
                <p style="margin:0.15rem 0 0.65rem;font-size:0.94rem;font-weight:600;color:var(--accent);" data-testid="sf-song-artist">
                  Penyanyi / Artis: ${escapeHtml(res.bestMatch.artist)}
                </p>

                <div class="comp-stats-grid">
                  <div class="comp-stat-box is-highlight">
                    <span>Judul Lagu &amp; Album</span>
                    <strong data-testid="sf-album-label">${escapeHtml(res.bestMatch.album || 'Single Resmi')}</strong>
                    <small>${escapeHtml(res.bestMatch.genre || 'Pop / Musik')} ${res.bestMatch.releaseYear ? `· ${escapeHtml(String(res.bestMatch.releaseYear))}` : ''}</small>
                  </div>
                  <div class="comp-stat-box">
                    <span>Analisis Spektrum Audio</span>
                    <strong class="mono-num">${res.acoustic.bpm} BPM · Nada ${escapeHtml(res.acoustic.dominantPitch)}</strong>
                    <small class="mono-num">Durasi ${res.durationSec || 0}s · ${res.sampleRate} Hz</small>
                  </div>
                  <div class="comp-stat-box">
                    <span>Tingkat Kecocokan</span>
                    <strong class="mono-num">${res.bestMatch.similarityPercent}% Valid</strong>
                    <small>${res.activeEngines.length} Metode &amp; API Digabungkan</small>
                  </div>
                </div>

                ${
                  res.bestMatch.aiSummary
                    ? `<div class="sf-ai-summary-box" data-testid="sf-ai-summary">
                        <strong>Ringkasan Identifikasi Multi-API &amp; AI:</strong>
                        <p>${escapeHtml(res.bestMatch.aiSummary)}</p>
                      </div>`
                    : ''
                }

                <!-- Music / Audio Platform Sources (Always Shown for Both Audio & Video) -->
                <div class="sf-links-section">
                  <h5 class="sf-section-title">
                    Sumber Musik &amp; Lagu yang Relevan 100% (YouTube, Spotify, Apple Music, YT Music, TikTok):
                  </h5>
                  <div class="sf-sources-grid" data-testid="sf-music-sources">
                    ${res.musicSources
                      .map(
                        (src) => `
                      <a
                        href="${escapeHtml(src.url)}"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="sf-source-card"
                        data-testid="sf-music-link-${escapeHtml(src.id)}"
                      >
                        <div class="sf-source-top">
                          <strong>${escapeHtml(src.platform)}</strong>
                          <span class="comp-method-badge">${escapeHtml(src.badge)}</span>
                        </div>
                        <span class="sf-source-label">${escapeHtml(src.label)} ↗</span>
                      </a>
                    `
                      )
                      .join('')}
                  </div>
                </div>

                ${
                  res.mediaKind === 'video'
                    ? `
                  <!-- Video-Exclusive Visual & Social Media Similarity Section -->
                  <div class="sf-links-section sf-video-exclusive-box" data-testid="sf-video-analysis-section">
                    <div class="sf-video-head">
                      <h5 class="sf-section-title">
                        Analisis Kecocokan &amp; Kemiripan Video Lintas Sosmed (YouTube, TikTok, Instagram Reels, FB):
                      </h5>
                      ${
                        res.videoAnalysis
                          ? `<span class="mono-num sf-video-hash-pill">
                              ${res.videoAnalysis.width}×${res.videoAnalysis.height}px · ${escapeHtml(res.videoAnalysis.orientationLabel)} · Hash ${escapeHtml(res.videoAnalysis.visualHash)}
                            </span>`
                          : ''
                      }
                    </div>

                    ${
                      res.videoAnalysis?.frames?.length
                        ? `
                      <div class="sf-keyframes-strip" data-testid="sf-video-keyframes">
                        ${res.videoAnalysis.frames
                          .map(
                            (f, idx) => `
                          <div class="sf-keyframe-item">
                            <img src="${escapeHtml(f.dataUrl)}" alt="Keyframe ${idx + 1}" />
                            <span class="mono-num">Frame #${idx + 1} (${f.timestampSec}s)</span>
                          </div>
                        `
                          )
                          .join('')}
                      </div>
                    `
                        : ''
                    }

                    <div class="sf-sources-grid" data-testid="sf-video-platform-links" style="margin-top:0.6rem;">
                      ${res.videoSources
                        .map(
                          (vsrc) => `
                        <a
                          href="${escapeHtml(vsrc.url)}"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="sf-source-card is-video-source"
                          data-testid="sf-video-link-${escapeHtml(vsrc.id)}"
                        >
                          <div class="sf-source-top">
                            <strong>${escapeHtml(vsrc.platform)}</strong>
                            <span class="comp-method-badge">${escapeHtml(vsrc.badge)}</span>
                          </div>
                          <span class="sf-source-label">${escapeHtml(vsrc.label)} ↗</span>
                        </a>
                      `
                        )
                        .join('')}
                    </div>

                    ${
                      res.matchedVideos?.length
                        ? `
                      <h6 class="sf-sublist-title">Daftar Sumber Video yang Mirip / Menggunakan Lagu &amp; Visual Serupa:</h6>
                      <div class="sf-matched-videos-list" data-testid="sf-matched-videos-list">
                        ${res.matchedVideos
                          .map(
                            (mv) => `
                          <a
                            href="${escapeHtml(mv.url)}"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="sf-matched-video-row"
                          >
                            <img src="${escapeHtml(mv.thumbnail || './assets/icons/tool-songfinder.svg')}" alt="" class="sf-matched-video-thumb" />
                            <div class="sf-matched-video-copy">
                              <div class="sf-matched-video-badges">
                                <span class="comp-method-badge">${escapeHtml(mv.platform)}</span>
                                <span class="mono-num sf-sim-pill">${mv.similarityPercent}% Mirip</span>
                                <span class="mono-num">${escapeHtml(mv.durationLabel)}</span>
                              </div>
                              <strong>${escapeHtml(mv.title)}</strong>
                              <small>${escapeHtml(mv.author)} · ${escapeHtml(mv.viewsLabel)}</small>
                            </div>
                          </a>
                        `
                          )
                          .join('')}
                      </div>
                    `
                        : ''
                    }
                  </div>
                `
                    : ''
                }

                ${
                  res.alternativeMatches?.length
                    ? `
                  <div class="sf-links-section">
                    <h5 class="sf-section-title">Kandidat Lagu / Versi Lain yang Mirip (Remix / Cover / Rilis Terkait):</h5>
                    <div class="sf-alt-list" data-testid="sf-alt-matches">
                      ${res.alternativeMatches
                        .map(
                          (alt) => `
                        <div class="sf-alt-row">
                          <div>
                            <strong>${escapeHtml(alt.title)}</strong>
                            <span> — ${escapeHtml(alt.artist)} (${escapeHtml(alt.provider || 'Music API')})</span>
                          </div>
                          <span class="mono-num sf-sim-pill">${alt.similarityPercent}%</span>
                        </div>
                      `
                        )
                        .join('')}
                    </div>
                  </div>
                `
                    : ''
                }

                <div class="comp-result-actions" style="margin-top:0.85rem;">
                  <button
                    type="button"
                    class="btn btn-primary btn-sm"
                    id="sf-play-in-ytmusic-btn"
                    data-testid="sf-play-in-ytmusic-btn"
                  >
                    Putar "${escapeHtml(res.bestMatch.title)}" di Pemutar YT Music Web Ini
                  </button>
                  <button type="button" class="btn btn-ghost btn-sm" id="sf-reset-btn">
                    Cari Lagu / Video Lain
                  </button>
                </div>
              </div>
            </div>
          `
              : ''
          }
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

  function syncCompressorProgressDom(pct, label) {
    if (!mounted || toolState.activeSubTab !== 'compressor') return;
    const safePct = Math.max(0, Math.min(100, Math.round(Number(pct) || 0)));
    const box = rootEl.querySelector('#comp-progress-box');
    const lblEl = rootEl.querySelector('#comp-progress-label');
    const pctEl = rootEl.querySelector('#comp-progress-pct');
    const fillEl = rootEl.querySelector('#comp-progress-fill');
    if (box) box.setAttribute('aria-valuenow', String(safePct));
    if (lblEl && label) lblEl.textContent = label;
    if (pctEl) pctEl.textContent = `${safePct}%`;
    if (fillEl) fillEl.style.width = `${safePct}%`;
  }

  function syncConverterProgressDom(pct, label) {
    if (!mounted || toolState.activeSubTab !== 'converter') return;
    const safePct = Math.max(0, Math.min(100, Math.round(Number(pct) || 0)));
    const box = rootEl.querySelector('#conv-progress-box');
    const lblEl = rootEl.querySelector('#conv-progress-label');
    const pctEl = rootEl.querySelector('#conv-progress-pct');
    const fillEl = rootEl.querySelector('#conv-progress-fill');
    if (box) box.setAttribute('aria-valuenow', String(safePct));
    if (lblEl && label) lblEl.textContent = label;
    if (pctEl) pctEl.textContent = `${safePct}%`;
    if (fillEl) fillEl.style.width = `${safePct}%`;
  }

  async function handleSelectCompressorFile(file) {
    if (!file) return;
    toolState.compError = '';
    toolState.compResult = null;
    toolState.compProgressPct = 0;
    toolState.compProgressLabel = '';
    try {
      const info = await inspectMediaFile(file);
      toolState.compFile = file;
      toolState.compInspect = info;
      render();
    } catch (err) {
      toolState.compError = err?.message || 'File tidak dapat diproses.';
      render();
    }
  }

  async function runActiveCompression() {
    if (!toolState.compFile || toolState.compLoading) return;
    toolState.compLoading = true;
    toolState.compError = '';
    toolState.compProgressPct = 12;
    toolState.compProgressLabel = 'Memulai analisis bitstream media...';
    render();

    try {
      const result = await compressMediaFile(toolState.compFile, {
        methodId: toolState.compMethodId,
        presetId: toolState.compPresetId,
        onProgress: (p) => {
          toolState.compProgressPct = p.percent || 50;
          toolState.compProgressLabel = p.label || 'Memproses...';
          syncCompressorProgressDom(toolState.compProgressPct, toolState.compProgressLabel);
        },
      });
      toolState.compProgressPct = 100;
      toolState.compProgressLabel = `Kompresi selesai! Hemat -${result.savedPercent}% (${result.savedBytesLabel})`;
      toolState.compResult = result;
      onToast(`Kompresi selesai! Hemat -${result.savedPercent}% (${result.savedBytesLabel}).`);
    } catch (err) {
      toolState.compError = err?.message || 'Gagal mengoptimalkan file media.';
    } finally {
      toolState.compLoading = false;
      render();
    }
  }

  async function handleSelectConverterFile(file, forcedTargetFormat = '') {
    if (!file) return;
    toolState.convError = '';
    toolState.convResult = null;
    toolState.convProgressPct = 0;
    toolState.convProgressLabel = '';
    let headerBytes = null;
    try {
      const sliceBuf = await file.slice(0, 16).arrayBuffer();
      headerBytes = new Uint8Array(sliceBuf);
    } catch {
      // Ignore header slice failure
    }
    const info = detectSourceFormat(file.name, file.type, headerBytes);
    const targets = getAvailableTargetFormats(info);
    toolState.convFile = file;
    toolState.convSourceInfo = info;
    if (forcedTargetFormat && targets.some((t) => t.id === forcedTargetFormat)) {
      toolState.convTargetFormat = forcedTargetFormat;
    } else if (!targets.some((t) => t.id === toolState.convTargetFormat)) {
      toolState.convTargetFormat = targets[0]?.id || 'pdf';
    }
    render();
  }

  async function runActiveConversion() {
    if (!toolState.convFile || toolState.convLoading) return;
    toolState.convLoading = true;
    toolState.convError = '';
    toolState.convProgressPct = 14;
    toolState.convProgressLabel = 'Memulai konversi format berkas...';
    render();

    try {
      const result = await convertAnyFile(toolState.convFile, {
        targetFormat: toolState.convTargetFormat,
        onProgress: (p) => {
          toolState.convProgressPct = p.percent || 55;
          toolState.convProgressLabel = p.label || 'Mengonversi...';
          syncConverterProgressDom(toolState.convProgressPct, toolState.convProgressLabel);
        },
      });
      toolState.convProgressPct = 100;
      toolState.convProgressLabel = `Konversi ke .${result.targetFormat} selesai & terverifikasi!`;
      toolState.convResult = result;
      onToast(`Konversi ke .${result.targetFormat} berhasil & terverifikasi!`);
    } catch (err) {
      toolState.convError = err?.message || 'Gagal mengonversi berkas.';
    } finally {
      toolState.convLoading = false;
      render();
    }
  }

  function syncSongFinderProgressDom(pct, label) {
    if (!mounted || toolState.activeSubTab !== 'songfinder') return;
    const safePct = Math.max(0, Math.min(100, Math.round(Number(pct) || 0)));
    const box = rootEl.querySelector('#sf-progress-box');
    const lblEl = rootEl.querySelector('#sf-progress-label');
    const pctEl = rootEl.querySelector('#sf-progress-pct');
    const fillEl = rootEl.querySelector('#sf-progress-fill');
    if (box) box.setAttribute('aria-valuenow', String(safePct));
    if (lblEl && label) lblEl.textContent = label;
    if (pctEl) pctEl.textContent = `${safePct}%`;
    if (fillEl) fillEl.style.width = `${safePct}%`;
  }

  async function handleSelectSongFinderFile(file) {
    if (!file) return;
    toolState.sfError = '';
    toolState.sfResult = null;
    toolState.sfProgressPct = 0;
    toolState.sfProgressLabel = '';
    if (toolState.sfPreviewUrl) {
      try {
        URL.revokeObjectURL(toolState.sfPreviewUrl);
      } catch {
        // Ignore
      }
    }
    let headerBytes = null;
    try {
      const sliceBuf = await file.slice(0, 32).arrayBuffer();
      headerBytes = new Uint8Array(sliceBuf);
    } catch {
      // Ignore
    }
    toolState.sfFile = file;
    toolState.sfKindInfo = detectMediaFileKind(file.name, file.type, headerBytes);
    try {
      toolState.sfPreviewUrl = URL.createObjectURL(file);
    } catch {
      toolState.sfPreviewUrl = '';
    }
    render();
    // Automatically run identification immediately when user inserts an audio or video file
    await runActiveSongFinder();
  }

  async function runActiveSongFinder() {
    if (!toolState.sfFile || toolState.sfLoading) return;
    toolState.sfLoading = true;
    toolState.sfError = '';
    toolState.sfProgressPct = 10;
    toolState.sfProgressLabel = 'Membaca jenis berkas (Audio/Video) & mengekstrak sidik jari musik...';
    render();

    try {
      const result = await identifyMediaSongAndVideo(toolState.sfFile, {
        userHint: toolState.sfUserHint,
        onProgress: (p) => {
          toolState.sfProgressPct = p.percent || 50;
          toolState.sfProgressLabel = p.label || 'Mencari kecocokan lagu & video...';
          syncSongFinderProgressDom(toolState.sfProgressPct, toolState.sfProgressLabel);
        },
      });
      toolState.sfProgressPct = 100;
      toolState.sfProgressLabel = `Identifikasi berhasil: ${result.bestMatch.title} — ${result.bestMatch.artist} (${result.bestMatch.similarityPercent}% cocok)`;
      toolState.sfResult = result;
      onToast(`Lagu teridentifikasi: ${result.bestMatch.title} — ${result.bestMatch.artist}`);
    } catch (err) {
      toolState.sfError = err?.message || 'Gagal mengidentifikasi lagu dari file media.';
    } finally {
      toolState.sfLoading = false;
      render();
    }
  }

  function ensureMusicHubController() {
    return getMusicController() || initMusicPlayer();
  }

  function getRepeatLabel(mode) {
    if (mode === 'one') return 'Ulang 1 Lagu';
    if (mode === 'off') return 'Ulang Mati';
    return 'Ulang Semua';
  }

  function getActiveQueueListFromState(mState) {
    if (mState.activeQueueMode === 'watch-later') {
      return mState.watchLater || [];
    }
    if (mState.activeQueueMode === 'playlist' && mState.activeQueuePlaylistId) {
      const pl = (mState.playlists || []).find((p) => p.id === mState.activeQueuePlaylistId);
      if (pl) return pl.tracks || [];
    }
    return mState.searchResults?.length > 0 ? mState.searchResults : mState.tracks || [];
  }

  function findTrackByIdInState(mState, trackId) {
    if (!trackId) return null;
    const all = [
      ...(mState.searchResults || []),
      ...(mState.tracks || []),
      ...(mState.watchLater || []),
      ...(mState.playlists || []).flatMap((p) => p.tracks || []),
    ];
    return all.find((t) => t && t.id === trackId) || null;
  }

  function getMusicCategorySvg(iconKey = 'music') {
    switch (iconKey) {
      case 'flame':
        return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>';
      case 'sparkles':
        return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/></svg>';
      case 'heart':
        return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>';
      case 'disc':
        return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>';
      case 'guitar':
        return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m11.9 12.1 4.5-4.5"/><path d="M18 2l4 4-2 2-4-4Z"/><path d="M5.5 14.5a4.5 4.5 0 1 0 4 4L14 14l-4-4Z"/></svg>';
      case 'globe':
        return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z"/></svg>';
      case 'star':
        return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 15.1 8.3 22 9.3 17 14.1 18.2 21 12 17.8 5.8 21 7 14.1 2 9.3 8.9 8.3 12 2"/></svg>';
      case 'mic':
        return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>';
      case 'bolt':
        return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>';
      case 'moon':
        return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>';
      case 'headphones':
        return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>';
      case 'clock':
        return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>';
      case 'compass':
        return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>';
      default:
        return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';
    }
  }

  function buildMusicCategoryBarAndDrawerHtml(mState) {
    const categories =
      Array.isArray(mState.categories) && mState.categories.length > 0
        ? mState.categories
        : MUSIC_PRESET_CATEGORIES;
    const activeCat = categories.find((c) => c.id === mState.activeCategory) || categories[0];
    const isOpen = Boolean(toolState.musicCategoryDrawerOpen);
    const chips = Array.isArray(mState.liveTrendChips) ? mState.liveTrendChips : [];
    const updatedLabel = mState.trendUpdatedAt
      ? `Tren Live · ${new Date(mState.trendUpdatedAt).toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
        })}`
      : 'Tren Live YT Music';

    return `
      <div class="ytm-cat-toolbar" role="region" aria-label="Kontrol Kategori YT Music">
        <button
          type="button"
          id="music-hub-cat-toggle-btn"
          class="ytm-cat-icon-trigger ${isOpen ? 'is-open' : ''}"
          data-music-control="true"
          aria-expanded="${isOpen}"
          aria-controls="music-hub-cat-drawer"
          title="${isOpen ? 'Minimize daftar kategori' : 'Buka daftar kategori YT Music & tren live'}"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
          <span>Kategori (${categories.length})</span>
          <svg class="ytm-cat-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
        </button>

        <button
          type="button"
          id="music-hub-active-cat-pill"
          class="ytm-active-cat-pill"
          data-music-control="true"
          title="Ketuk untuk ganti kategori lagu"
        >
          ${getMusicCategorySvg(activeCat.iconKey)}
          <span>${escapeHtml(activeCat.label)}</span>
          ${activeCat.isLiveTrend || activeCat.isHot ? '<span class="ytm-hot-dot" title="Sedang tren"></span>' : ''}
        </button>

        <button
          type="button"
          id="music-hub-refresh-trends-btn"
          class="ytm-trend-sync-btn ${mState.isSyncingTrends ? 'is-syncing' : ''}"
          data-music-control="true"
          title="Perbarui kategori & tren real-time YT Music"
          aria-label="Perbarui tren real-time YT Music"
        >
          <svg class="${mState.isSyncingTrends ? 'ytm-spin' : ''}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
          <span class="ytm-trend-sync-text">${mState.isSyncingTrends ? 'Sinkron...' : 'Live'}</span>
        </button>
      </div>

      <div
        id="music-hub-cat-drawer"
        class="ytm-cat-slide-shell ${isOpen ? 'is-open' : ''}"
        aria-hidden="${!isOpen}"
      >
        <div class="ytm-cat-slide-inner">
          <div class="ytm-cat-drawer-head">
            <div class="ytm-cat-drawer-title">
              <span class="ytm-bg-dot"></span>
              <strong>Eksplorasi Kategori YT Music</strong>
              <span class="ytm-cat-sync-time">${escapeHtml(updatedLabel)}</span>
            </div>
            <button
              type="button"
              id="music-hub-cat-minimize-btn"
              class="ytm-cat-minimize-btn"
              data-music-control="true"
              aria-label="Minimize kategori"
              title="Minimize kategori"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>
              <span>Minimize</span>
            </button>
          </div>

          <div class="ytm-cat-scroll-rail" role="group" aria-label="Pilih kategori lagu YT Music">
            ${categories
              .map(
                (cat) => `
              <button
                type="button"
                class="ytm-cat-rail-btn ${mState.activeCategory === cat.id && !mState.searchQuery ? 'is-active' : ''}"
                data-hub-music-preset="${escapeHtml(cat.id)}"
                data-music-control="true"
                ${cat.trendSummary ? `title="${escapeHtml(cat.trendSummary)}"` : ''}
              >
                ${getMusicCategorySvg(cat.iconKey)}
                <span>${escapeHtml(cat.label)}</span>
                ${
                  cat.isLiveTrend
                    ? '<span class="ytm-cat-tag is-live">LIVE</span>'
                    : cat.isHot
                    ? '<span class="ytm-cat-tag is-hot">HOT</span>'
                    : ''
                }
              </button>
            `
              )
              .join('')}
          </div>

          ${
            chips.length > 0
              ? `<div class="ytm-live-trends-row" aria-label="Pencarian Tren Real-Time YT Music">
                  <span class="ytm-trends-kicker">🔥 Tren Saat Ini:</span>
                  ${chips
                    .map(
                      (chip) => `
                    <button
                      type="button"
                      class="ytm-trend-chip-btn"
                      data-hub-trend-query="${escapeHtml(chip.query)}"
                      data-music-control="true"
                    >
                      ${escapeHtml(chip.label)}
                    </button>
                  `
                    )
                    .join('')}
                </div>`
              : ''
          }
        </div>
      </div>
    `;
  }

  function buildMusicHubStageHtml(mState) {
    const active = mState.currentTrack || mState.tracks?.[0] || null;
    const dur = mState.duration || active?.duration || 180;
    const cur = Math.min(dur, Math.max(0, mState.currentTime || 0));
    const pct = dur > 0 ? Math.min(100, Math.round((cur / dur) * 100)) : 0;
    const volPct = Math.round((mState.isMuted ? 0 : (mState.volume ?? 0.72)) * 100);
    const activeList = getActiveQueueListFromState(mState);
    const posNum = mState.queueIndex >= 0 ? mState.queueIndex + 1 : 1;
    const totalNum = activeList.length || 1;
    const inWatchLater = Boolean(active && isTrackInWatchLater({ watchLater: mState.watchLater }, active));
    const activePlaylist =
      mState.activeQueueMode === 'playlist' && mState.activeQueuePlaylistId
        ? (mState.playlists || []).find((p) => p.id === mState.activeQueuePlaylistId)
        : null;
    const queueLabel =
      mState.activeQueueMode === 'watch-later'
        ? 'Antrean: Tonton Nanti'
        : activePlaylist
        ? `Playlist: ${activePlaylist.name}`
        : '';
    const statusLabel = mState.isLoading
      ? 'Memuat Stream...'
      : mState.isPlaying
      ? 'Sedang Diputar'
      : mState.currentTrack
      ? 'Dijeda'
      : 'Siap Putar';

    return `
      <div class="ytm-stage-card ${mState.isPlaying ? 'is-playing' : ''}" id="music-hub-stage-slot">
        <div class="ytm-stage-topbar">
          <div class="ytm-brand-pill">
            <span class="ytm-logo-circle" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><polygon points="10,8 16,12 10,16"/></svg>
            </span>
            <span>Music</span>
            <span class="ytm-live-dot ${mState.isPlaying ? 'is-live' : ''}">${escapeHtml(statusLabel)}</span>
          </div>

          <div class="ytm-topbar-actions">
            <button
              type="button"
              id="music-hub-pip-btn"
              class="ytm-chip-btn ${mState.isPipOpen && !mState.pipHeadsetMode ? 'is-active' : ''}"
              data-music-control="true"
              aria-pressed="${Boolean(mState.isPipOpen && !mState.pipHeadsetMode)}"
              title="Buka atau tutup Gambar dalam Gambar (Picture-in-Picture)"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><rect x="11" y="11" width="9" height="7" rx="1" fill="currentColor"/></svg>
              <span>${mState.isPipOpen && !mState.pipHeadsetMode ? 'PiP Aktif' : 'Gambar dlm Gambar'}</span>
            </button>
            <button
              type="button"
              id="music-hub-headset-btn"
              class="ytm-chip-btn ${mState.pipHeadsetMode ? 'is-headset-active' : ''}"
              data-music-control="true"
              aria-pressed="${Boolean(mState.pipHeadsetMode)}"
              title="Mode Headset: Sembunyikan Gambar dalam Gambar namun lagu tetap berputar di latar belakang"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>
              <span>${mState.pipHeadsetMode ? 'Headset ON' : 'Mode Headset'}</span>
            </button>
            <button
              type="button"
              id="music-hub-autoclick-btn"
              class="ytm-chip-btn ${mState.autoClickPlayEnabled !== false ? 'is-active' : ''}"
              data-music-control="true"
              aria-pressed="${mState.autoClickPlayEnabled !== false}"
              title="Otomatis putar lagu saat menekan tombol di web"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>
              <span>${mState.autoClickPlayEnabled !== false ? 'Auto-Klik ON' : 'Auto-Klik OFF'}</span>
            </button>
            <button
              type="button"
              id="music-hub-random-viral-btn"
              class="ytm-chip-btn"
              data-music-control="true"
              title="Putar lagu viral acak berikutnya"
            >
              <span>Acak Viral</span>
            </button>
          </div>
        </div>

        <div class="ytm-artwork-showcase">
          <div class="ytm-art-frame ${mState.isPlaying ? 'is-playing' : ''}">
            ${
              active?.artwork
                ? `<img src="${escapeHtml(active.artwork)}" alt="${escapeHtml(active.title)}" width="240" height="240" class="ytm-art-img" onerror="this.src='${escapeHtml(active.artworkFallback || '')}'" />`
                : `<span class="ytm-art-fallback" aria-hidden="true">♪</span>`
            }
            <div class="ytm-eq-pill" aria-hidden="true">
              <span></span><span></span><span></span><span></span>
            </div>
          </div>

          <div class="ytm-track-header">
            <div class="ytm-track-titles">
              <h3 class="ytm-track-title" id="music-hub-track-title">
                ${escapeHtml(active?.title || 'Pilih atau Putar Lagu Viral Indonesia')}
              </h3>
              <p class="ytm-track-artist" id="music-hub-track-artist">
                ${escapeHtml(active?.artist || 'Artis YT Music')} • <span>${escapeHtml(active?.genre || 'Viral Indonesia')}</span>
              </p>
            </div>
            <div class="ytm-track-badges">
              <span class="ytm-queue-pill mono-num">${posNum} / ${totalNum}</span>
              ${queueLabel ? `<span class="ytm-queue-pill is-mode">${escapeHtml(queueLabel)}</span>` : ''}
              ${
                active?.watchUrl
                  ? `<a href="${escapeHtml(active.watchUrl)}" target="_blank" rel="noopener noreferrer" class="ytm-watch-pill" title="Buka di YouTube Music">YT ↗</a>`
                  : ''
              }
              <button
                type="button"
                id="music-hub-watchlater-btn"
                class="ytm-chip-btn ${inWatchLater ? 'is-active' : ''}"
                data-music-control="true"
                aria-pressed="${inWatchLater}"
                title="${inWatchLater ? 'Hapus dari Tonton Nanti' : 'Simpan ke Tonton Nanti'}"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">${
                  inWatchLater
                    ? '<circle cx="12" cy="12" r="9" fill="currentColor" stroke="currentColor"/><polyline points="12 7 12 12 15 14" stroke="#ffffff"/>'
                    : '<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/>'
                }</svg>
                <span>${inWatchLater ? 'Di Tonton Nanti' : 'Tonton Nanti'}</span>
              </button>
              <button
                type="button"
                id="music-hub-stage-pl-btn"
                class="ytm-chip-btn ${toolState.musicStagePlaylistPickerOpen ? 'is-active' : ''}"
                data-music-control="true"
                aria-expanded="${toolState.musicStagePlaylistPickerOpen}"
                title="Simpan lagu ini ke Playlist"
              >
                <span>+ Playlist</span>
              </button>
            </div>
          </div>
        </div>

        ${
          toolState.musicStagePlaylistPickerOpen && active
            ? `<div class="ytm-hub-pl-picker" id="music-hub-stage-pl-picker" data-music-control="true">
                <div class="ytm-hub-pl-picker-head">
                  <strong>Simpan "${escapeHtml(active.title)}" ke Playlist</strong>
                  <button type="button" id="music-hub-stage-pl-close" class="ytm-row-action-btn" data-music-control="true" aria-label="Tutup pemilih playlist">✕</button>
                </div>
                <form id="music-hub-stage-create-pl-form" class="ytm-playlist-create-form">
                  <input
                    type="text"
                    id="music-hub-stage-new-pl-input"
                    class="music-search-input"
                    placeholder="Buat playlist baru & langsung simpan..."
                    maxlength="60"
                    aria-label="Nama playlist baru"
                  />
                  <button type="submit" class="btn btn-primary btn-xs" data-music-control="true">Buat &amp; Simpan</button>
                </form>
                ${
                  (mState.playlists || []).length > 0
                    ? `<div class="ytm-hub-pl-quicklist">
                        ${mState.playlists
                          .map((pl) => {
                            const hasTrack = pl.tracks.some((t) => t.id === active.id);
                            return `
                              <button
                                type="button"
                                class="music-search-hit ${hasTrack ? 'is-active' : ''}"
                                data-hub-stage-add-pl="${escapeHtml(pl.id)}"
                                data-music-control="true"
                              >
                                <span class="music-search-hit-title">${escapeHtml(pl.name)} (${pl.tracks.length} lagu)</span>
                                <span class="music-search-hit-dur">${hasTrack ? '✓ Tersimpan' : '+ Tambah'}</span>
                              </button>
                            `;
                          })
                          .join('')}
                      </div>`
                    : `<div class="music-search-note">Belum ada playlist tersimpan. Ketik nama playlist baru di atas.</div>`
                }
              </div>`
            : ''
        }

        <div class="ytm-scrubber-wrap">
          <input
            type="range"
            id="music-hub-seek-slider"
            class="ytm-scrubber"
            style="--ytm-progress: ${pct}%"
            data-music-control="true"
            min="0"
            max="100"
            step="0.25"
            value="${pct}"
            aria-label="Geser posisi waktu lagu"
          />
          <div class="ytm-time-row mono-num">
            <span id="music-hub-cur-time">${formatAudioTime(cur)}</span>
            <span id="music-hub-dur-time">${formatAudioTime(dur)}</span>
          </div>
        </div>

        <div class="ytm-transport-toolbar" role="toolbar" aria-label="Kontrol Pemutar YouTube Music">
          <button
            type="button"
            id="music-hub-shuffle-btn"
            class="ytm-icon-btn ${mState.shuffleEnabled ? 'is-active' : ''}"
            data-music-control="true"
            aria-pressed="${mState.shuffleEnabled}"
            aria-label="Mode Putar Acak"
            title="${mState.shuffleEnabled ? 'Acak: Aktif' : 'Acak: Nonaktif'}"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>
          </button>

          <button
            type="button"
            id="music-hub-prev-btn"
            class="ytm-icon-btn ytm-step-btn"
            data-music-control="true"
            aria-label="Putar lagu sebelumnya"
            title="Lagu Sebelumnya"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/></svg>
          </button>

          <button
            type="button"
            id="music-hub-play-btn"
            class="ytm-play-fab ${mState.isPlaying ? 'is-playing' : ''}"
            data-music-control="true"
            aria-label="${mState.isPlaying ? 'Jeda lagu' : 'Putar lagu'}"
            title="${mState.isPlaying ? 'Jeda' : 'Putar'}"
          >
            ${
              mState.isLoading
                ? `<svg class="ytm-spin" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 2v4"/><path d="m16.2 7.8 2.9-2.9"/><path d="M18 12h4"/><path d="M4.9 19.1 7.8 16.2"/><path d="M2 12h4"/></svg>`
                : mState.isPlaying
                ? `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="4" width="4.5" height="16" rx="1.2"/><rect x="13.5" y="4" width="4.5" height="16" rx="1.2"/></svg>`
                : `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="7,4 20,12 7,20"/></svg>`
            }
          </button>

          <button
            type="button"
            id="music-hub-next-btn"
            class="ytm-icon-btn ytm-step-btn"
            data-music-control="true"
            aria-label="Putar lagu berikutnya"
            title="Lagu Berikutnya"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m6 18 8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
          </button>

          <button
            type="button"
            id="music-hub-repeat-btn"
            class="ytm-icon-btn ${mState.repeatMode !== 'off' ? 'is-active' : ''}"
            data-music-control="true"
            aria-label="${escapeHtml(getRepeatLabel(mState.repeatMode))}"
            title="${escapeHtml(getRepeatLabel(mState.repeatMode))}"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
            ${mState.repeatMode === 'one' ? `<span class="ytm-repeat-one-badge">1</span>` : ''}
          </button>
        </div>

        <div class="ytm-bottom-toolbar">
          <div class="ytm-volume-group">
            <button
              type="button"
              id="music-hub-mute-btn"
              class="ytm-icon-btn ytm-mute-btn ${mState.isMuted ? 'is-muted' : ''}"
              data-music-control="true"
              aria-label="${mState.isMuted ? 'Nyalakan suara' : 'Bisukan suara'}"
            >
              ${
                mState.isMuted || volPct === 0
                  ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="22" y1="9" x2="16" y2="15"/><line x1="16" y1="9" x2="22" y2="15"/></svg>`
                  : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`
              }
            </button>
            <input
              type="range"
              id="music-hub-volume-slider"
              class="ytm-volume-slider"
              data-music-control="true"
              min="0"
              max="100"
              step="1"
              value="${volPct}"
              aria-label="Atur volume pemutar musik"
            />
            <span class="ytm-vol-pct mono-num" id="music-hub-vol-pct">${volPct}%</span>
          </div>

          <span class="ytm-bg-badge" title="Tetap memutar otomatis di latar belakang, layar mati & Gambar dalam Gambar">
            <span class="ytm-bg-dot"></span><span>${mState.pipHeadsetMode ? '🎧 Mode Headset (Tanpa PiP)' : 'Latar Belakang &amp; PiP Aktif'}</span>
          </span>
        </div>

        ${
          mState.pipHeadsetMode
            ? `<div class="ytm-headset-status-banner" id="music-hub-headset-banner" role="status">
                <span>🎧 Gambar dalam Gambar disembunyikan — Lagu tetap berputar di latar belakang &amp; layar terkunci.</span>
                <button type="button" id="music-hub-reopen-pip-btn" class="ytm-chip-btn" data-music-control="true">Tampilkan PiP</button>
              </div>`
            : ''
        }

        ${
          mState.isLoading
            ? (() => {
                const loader = getLoadingProgressMeta({
                  isLoading: mState.isLoading,
                  isSearching: false,
                  phase: mState.loadingPhase === 'buffering' ? 'buffering' : 'buffering',
                  label: mState.loadingLabel || 'Menyiapkan stream audio latar belakang...',
                  progress: mState.loadingProgress || 48,
                });
                return `
                  <div class="ytm-stage-buffer-bar" role="status">
                    <div class="ytm-progress-banner-head">
                      <span class="ytm-progress-spin-wrap">
                        <span class="ytm-inline-spinner" aria-hidden="true"></span>
                        <span>${escapeHtml(loader.label)}</span>
                      </span>
                      <span class="ytm-progress-pct mono-num">${loader.percent}%</span>
                    </div>
                    <div class="ytm-progress-track">
                      <div class="ytm-progress-fill" style="width: ${loader.percent}%"></div>
                    </div>
                  </div>
                `;
              })()
            : ''
        }

        ${
          mState.lastError
            ? `<div class="music-search-note" role="status">${escapeHtml(mState.lastError)}</div>`
            : ''
        }
      </div>
    `;
  }

  function renderMusicTrackRowHtml(track, mState, { playAttr = 'data-hub-music-pick', playlistIdForRemove = '' } = {}) {
    const isCurrent = mState.currentTrack?.id === track.id;
    const inWl = isTrackInWatchLater({ watchLater: mState.watchLater }, track);
    const pickerOpen = toolState.musicRowPlaylistPickerId === track.id;
    const playlists = mState.playlists || [];

    return `
      <div class="ytm-track-row-block">
        <div
          class="ytm-track-row ${isCurrent ? 'is-active' : ''}"
          role="option"
          aria-selected="${isCurrent}"
        >
          <button
            type="button"
            class="ytm-track-row-main"
            ${playAttr}="${escapeHtml(track.id)}"
            data-music-control="true"
          >
            <div class="ytm-row-thumb-wrap">
              <img
                src="${escapeHtml(track.artwork)}"
                alt=""
                width="46"
                height="46"
                loading="lazy"
                class="ytm-row-thumb"
                onerror="this.src='${escapeHtml(track.artworkFallback || '')}'"
              />
              <span class="ytm-row-overlay-icon" aria-hidden="true">
                ${isCurrent && mState.isPlaying ? '❚❚' : '▶'}
              </span>
            </div>
            <span class="ytm-row-info">
              <span class="ytm-row-title">${escapeHtml(track.title)}</span>
              <span class="ytm-row-sub">${escapeHtml(track.artist)} • ${escapeHtml(track.genre || 'YT Music')}</span>
            </span>
          </button>
          <div class="ytm-row-actions">
            <span class="ytm-row-dur mono-num">${formatAudioTime(track.duration)}</span>
            <button
              type="button"
              class="ytm-row-action-btn ${inWl ? 'is-active' : ''}"
              data-hub-wl-id="${escapeHtml(track.id)}"
              data-music-control="true"
              title="${inWl ? 'Hapus dari Tonton Nanti' : 'Simpan ke Tonton Nanti'}"
              aria-label="${inWl ? 'Hapus dari Tonton Nanti' : 'Simpan ke Tonton Nanti'}"
              aria-pressed="${inWl}"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">${
                inWl
                  ? '<circle cx="12" cy="12" r="9" fill="currentColor" stroke="currentColor"/><polyline points="12 7 12 12 15 14" stroke="#ffffff"/>'
                  : '<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/>'
              }</svg>
            </button>
            ${
              playlistIdForRemove
                ? `<button
                    type="button"
                    class="ytm-row-action-btn is-danger"
                    data-hub-pl-remove-track="${escapeHtml(track.id)}"
                    data-hub-pl-id="${escapeHtml(playlistIdForRemove)}"
                    data-music-control="true"
                    title="Hapus lagu dari playlist ini"
                    aria-label="Hapus ${escapeHtml(track.title)} dari playlist"
                  >✕</button>`
                : `<button
                    type="button"
                    class="ytm-row-action-btn ${pickerOpen ? 'is-active' : ''}"
                    data-hub-pl-row-open="${escapeHtml(track.id)}"
                    data-music-control="true"
                    title="Tambahkan ke Playlist"
                    aria-label="Tambahkan ${escapeHtml(track.title)} ke Playlist"
                    aria-expanded="${pickerOpen}"
                  >+</button>`
            }
          </div>
        </div>
        ${
          pickerOpen && !playlistIdForRemove
            ? `<div class="ytm-hub-pl-picker ytm-hub-pl-picker-inline" data-music-control="true">
                <form class="ytm-playlist-create-form" data-hub-row-create-pl="${escapeHtml(track.id)}">
                  <input
                    type="text"
                    class="music-search-input"
                    data-hub-row-new-pl-input="${escapeHtml(track.id)}"
                    placeholder="Nama playlist baru..."
                    maxlength="60"
                    aria-label="Nama playlist baru"
                  />
                  <button type="submit" class="btn btn-primary btn-xs" data-music-control="true">Buat</button>
                </form>
                ${
                  playlists.length > 0
                    ? `<div class="ytm-hub-pl-quicklist">
                        ${playlists
                          .map((pl) => {
                            const hasTrack = pl.tracks.some((t) => t.id === track.id);
                            return `
                              <button
                                type="button"
                                class="music-search-hit ${hasTrack ? 'is-active' : ''}"
                                data-hub-row-add-pl="${escapeHtml(pl.id)}"
                                data-hub-row-track="${escapeHtml(track.id)}"
                                data-music-control="true"
                              >
                                <span class="music-search-hit-title">${escapeHtml(pl.name)} (${pl.tracks.length})</span>
                                <span class="music-search-hit-dur">${hasTrack ? '✓ Ada' : '+ Tambah'}</span>
                              </button>
                            `;
                          })
                          .join('')}
                      </div>`
                    : ''
                }
              </div>`
            : ''
        }
      </div>
    `;
  }

  function buildMusicHubQueueHtml(mState) {
    const watchLater = mState.watchLater || [];
    const playlists = mState.playlists || [];
    const activeTab = toolState.musicBrowserTab || 'queue';
    const isSearchView = Boolean(mState.searchQuery && mState.searchResults);
    const list =
      mState.searchQuery && mState.searchResults?.length > 0
        ? mState.searchResults
        : mState.searchQuery && !mState.isSearching
        ? []
        : mState.tracks || [];
    const activeCat =
      MUSIC_PRESET_CATEGORIES.find((c) => c.id === mState.activeCategory) || MUSIC_PRESET_CATEGORIES[0];

    const selectedPlaylist =
      toolState.musicSelectedPlaylistId
        ? playlists.find((p) => p.id === toolState.musicSelectedPlaylistId) || null
        : null;

    const tabsNavHtml = `
      <div class="ytm-browser-tabs" role="tablist" aria-label="Pustaka Musik Pengguna">
        <button
          type="button"
          role="tab"
          class="ytm-browser-tab-btn ${activeTab === 'queue' ? 'is-active' : ''}"
          data-hub-music-tab="queue"
          data-music-control="true"
          aria-selected="${activeTab === 'queue'}"
        >
          <span>${isSearchView ? 'Hasil Cari' : 'Antrean'}</span>
        </button>
        <button
          type="button"
          role="tab"
          class="ytm-browser-tab-btn ${activeTab === 'playlists' ? 'is-active' : ''}"
          data-hub-music-tab="playlists"
          data-music-control="true"
          aria-selected="${activeTab === 'playlists'}"
        >
          <span>Playlist (${playlists.length})</span>
        </button>
        <button
          type="button"
          role="tab"
          class="ytm-browser-tab-btn ${activeTab === 'watch-later' ? 'is-active' : ''}"
          data-hub-music-tab="watch-later"
          data-music-control="true"
          aria-selected="${activeTab === 'watch-later'}"
        >
          <span class="ytm-tab-desktop">Tonton Nanti (${watchLater.length})</span>
          <span class="ytm-tab-mobile">Nanti (${watchLater.length})</span>
        </button>
      </div>
    `;

    if (activeTab === 'playlists') {
      return `
        <div class="ytm-queue-panel" id="music-hub-queue-slot">
          ${tabsNavHtml}

          <form id="music-hub-create-playlist-form" class="ytm-playlist-create-form" data-music-control="true">
            <input
              type="text"
              id="music-hub-new-playlist-name"
              class="music-search-input"
              placeholder="Buat playlist baru (contoh: Santai Malam)..."
              maxlength="60"
              aria-label="Nama playlist baru"
            />
            <button type="submit" class="btn btn-primary btn-sm" data-music-control="true">Buat Playlist</button>
          </form>

          ${
            toolState.musicPlaylistFeedback
              ? `<div class="music-search-note" role="status">${escapeHtml(toolState.musicPlaylistFeedback)}</div>`
              : ''
          }

          ${
            selectedPlaylist
              ? `<div class="ytm-playlist-detail-head">
                  <button type="button" id="music-hub-pl-back" class="btn btn-secondary btn-xs" data-music-control="true">← Semua Playlist</button>
                  <div class="ytm-playlist-detail-title">
                    <strong>${escapeHtml(selectedPlaylist.name)}</strong>
                    <span>${selectedPlaylist.tracks.length} lagu · Tersimpan otomatis</span>
                  </div>
                  <div class="ytm-playlist-detail-actions">
                    <button type="button" class="btn btn-primary btn-xs" data-hub-pl-play="${escapeHtml(selectedPlaylist.id)}" data-music-control="true" ${selectedPlaylist.tracks.length === 0 ? 'disabled' : ''}>Putar</button>
                    <button type="button" class="btn btn-secondary btn-xs" data-hub-pl-shuffle="${escapeHtml(selectedPlaylist.id)}" data-music-control="true" ${selectedPlaylist.tracks.length === 0 ? 'disabled' : ''}>Acak</button>
                  </div>
                </div>
                <div class="ytm-tracklist" role="listbox" aria-label="Lagu di playlist ${escapeHtml(selectedPlaylist.name)}">
                  ${
                    selectedPlaylist.tracks.length === 0
                      ? `<div class="music-hub-empty">Playlist ini masih kosong. Buka tab Antrean atau putar lagu lalu klik tombol <strong>+</strong> untuk menambahkannya ke sini.</div>`
                      : selectedPlaylist.tracks
                          .map((track) =>
                            renderMusicTrackRowHtml(track, mState, {
                              playAttr: 'data-hub-pl-play-track',
                              playlistIdForRemove: selectedPlaylist.id,
                            })
                          )
                          .join('')
                  }
                </div>`
              : `<div class="ytm-playlist-list">
                  ${
                    playlists.length === 0
                      ? `<div class="music-hub-empty">Belum ada playlist pribadi. Buat playlist di atas — semua playlist &amp; lagu tersimpan otomatis di perangkat Anda.</div>`
                      : playlists
                          .map((pl) => {
                            const totalSec = pl.tracks.reduce((sum, t) => sum + (Number(t.duration) || 0), 0);
                            const isRenaming = toolState.musicEditingPlaylistId === pl.id;
                            const isPlayingThis =
                              mState.activeQueueMode === 'playlist' && mState.activeQueuePlaylistId === pl.id;
                            return `
                              <div class="ytm-playlist-card ${isPlayingThis ? 'is-active' : ''}">
                                ${
                                  isRenaming
                                    ? `<form class="ytm-playlist-create-form" data-hub-pl-rename-form="${escapeHtml(pl.id)}">
                                        <input
                                          type="text"
                                          class="music-search-input"
                                          data-hub-pl-rename-input="${escapeHtml(pl.id)}"
                                          value="${escapeHtml(pl.name)}"
                                          maxlength="60"
                                          aria-label="Ubah nama playlist"
                                        />
                                        <button type="submit" class="btn btn-primary btn-xs" data-music-control="true">Simpan</button>
                                        <button type="button" class="btn btn-secondary btn-xs" data-hub-pl-rename-cancel="true" data-music-control="true">Batal</button>
                                      </form>`
                                    : `<div class="ytm-playlist-card-top">
                                        <button type="button" class="ytm-playlist-card-main" data-hub-pl-open="${escapeHtml(pl.id)}" data-music-control="true">
                                          <strong>${escapeHtml(pl.name)}</strong>
                                          <span>${pl.tracks.length} lagu${totalSec > 0 ? ` · ${formatAudioTime(totalSec)}` : ''}</span>
                                        </button>
                                        <div class="ytm-playlist-card-actions">
                                          <button type="button" class="btn btn-primary btn-xs" data-hub-pl-play="${escapeHtml(pl.id)}" data-music-control="true" ${pl.tracks.length === 0 ? 'disabled' : ''}>Putar</button>
                                          <button type="button" class="btn btn-secondary btn-xs" data-hub-pl-open="${escapeHtml(pl.id)}" data-music-control="true">Buka</button>
                                          <button type="button" class="ytm-row-action-btn" data-hub-pl-rename-open="${escapeHtml(pl.id)}" data-music-control="true" title="Ubah nama playlist" aria-label="Ubah nama playlist">✎</button>
                                          <button type="button" class="ytm-row-action-btn is-danger" data-hub-pl-delete="${escapeHtml(pl.id)}" data-music-control="true" title="Hapus playlist" aria-label="Hapus playlist ${escapeHtml(pl.name)}">✕</button>
                                        </div>
                                      </div>`
                                }
                              </div>
                            `;
                          })
                          .join('')
                  }
                </div>`
          }
        </div>
      `;
    }

    if (activeTab === 'watch-later') {
      return `
        <div class="ytm-queue-panel" id="music-hub-queue-slot">
          ${tabsNavHtml}
          <div class="ytm-queue-tabs-head">
            <div class="ytm-queue-tab-title">
              <span class="ytm-queue-tab-indicator"></span>
              <strong>TONTON NANTI (${watchLater.length})</strong>
            </div>
            <div class="ytm-playlist-detail-actions">
              <button type="button" id="music-hub-wl-play-all" class="btn btn-primary btn-xs" data-music-control="true" ${watchLater.length === 0 ? 'disabled' : ''}>Putar Semua</button>
              <button type="button" id="music-hub-wl-shuffle-all" class="btn btn-secondary btn-xs" data-music-control="true" ${watchLater.length === 0 ? 'disabled' : ''}>Acak</button>
            </div>
          </div>
          <div class="ytm-tracklist" role="listbox" aria-label="Daftar lagu Tonton Nanti">
            ${
              watchLater.length === 0
                ? `<div class="music-hub-empty">Daftar Tonton Nanti masih kosong. Tekan ikon jam <strong>(Tonton Nanti)</strong> di lagu mana saja untuk menyimpannya otomatis.</div>`
                : watchLater
                    .map((track) =>
                      renderMusicTrackRowHtml(track, mState, {
                        playAttr: 'data-hub-wl-play-track',
                      })
                    )
                    .join('')
            }
          </div>
        </div>
      `;
    }

    const catList =
      Array.isArray(mState.categories) && mState.categories.length > 0
        ? mState.categories
        : MUSIC_PRESET_CATEGORIES;
    const activeCatInfo = catList.find((c) => c.id === mState.activeCategory) || catList[0];
    const progressMeta = getLoadingProgressMeta({
      isSearching: mState.isSearching,
      isLoading: false,
      isSyncingTrends: mState.isSyncingTrends && !mState.isSearching,
      phase: mState.loadingPhase,
      label: mState.loadingLabel,
      progress: mState.loadingProgress,
    });

    return `
      <div class="ytm-queue-panel" id="music-hub-queue-slot">
        ${tabsNavHtml}
        <div class="ytm-queue-tabs-head">
          <div class="ytm-queue-tab-title">
            <span class="ytm-queue-tab-indicator"></span>
            <strong>${
              isSearchView
                ? `HASIL PENCARIAN "${escapeHtml(mState.searchQuery)}"`
                : `BERIKUTNYA · ${escapeHtml(activeCatInfo.label.toUpperCase())}`
            }</strong>
          </div>
          <span class="ytm-queue-count mono-num">${
            mState.isSearching
              ? `<span class="ytm-loading-pill"><span class="ytm-inline-spinner" aria-hidden="true"></span> ${progressMeta.percent}%</span>`
              : `${list.length} lagu`
          }</span>
        </div>

        ${
          mState.isSearching || mState.isSyncingTrends
            ? `<div class="ytm-progress-banner" id="music-hub-progress-banner" role="status" aria-live="polite">
                <div class="ytm-progress-banner-head">
                  <span class="ytm-progress-spin-wrap">
                    <span class="ytm-inline-spinner" aria-hidden="true"></span>
                    <span>${escapeHtml(
                      mState.isSearching
                        ? progressMeta.label || 'Mencari lagu di YT Music...'
                        : 'Menyinkronkan tren real-time YT Music...'
                    )}</span>
                  </span>
                  <span class="ytm-progress-pct mono-num">${mState.isSearching ? progressMeta.percent : 64}%</span>
                </div>
                <div class="ytm-progress-track">
                  <div class="ytm-progress-fill" style="width: ${mState.isSearching ? progressMeta.percent : 64}%"></div>
                </div>
              </div>`
            : ''
        }

        ${
          mState.searchFeedback
            ? `<div class="music-search-note" role="status">${escapeHtml(mState.searchFeedback)}</div>`
            : ''
        }

        <div class="ytm-tracklist" role="listbox" aria-label="Daftar putar YouTube Music">
          ${
            mState.isSearching && list.length === 0
              ? `<div class="ytm-skeleton-list" aria-hidden="true">
                  ${Array.from({ length: 5 })
                    .map(
                      () => `
                    <div class="ytm-skeleton-row">
                      <div class="ytm-skeleton-thumb"></div>
                      <div class="ytm-skeleton-lines">
                        <span class="ytm-skeleton-bar is-title"></span>
                        <span class="ytm-skeleton-bar is-sub"></span>
                      </div>
                    </div>`
                    )
                    .join('')}
                </div>`
              : list.length === 0
              ? `<div class="music-hub-empty">Belum ada lagu yang cocok. Coba kata kunci atau pilih kategori lain.</div>`
              : list
                  .map((track) =>
                    renderMusicTrackRowHtml(track, mState, {
                      playAttr: 'data-hub-music-pick',
                    })
                  )
                  .join('')
          }
        </div>
      </div>
    `;
  }

  function syncMusicHubTimeDom(mState) {
    if (!mounted || toolState.activeSubTab !== 'music' || isHubSeeking) return;
    const dur = mState.duration || mState.currentTrack?.duration || 180;
    const cur = Math.min(dur, Math.max(0, mState.currentTime || 0));
    const pct = dur > 0 ? Math.min(100, (cur / dur) * 100) : 0;
    const slider = rootEl.querySelector('#music-hub-seek-slider');
    const curEl = rootEl.querySelector('#music-hub-cur-time');
    const durEl = rootEl.querySelector('#music-hub-dur-time');
    if (slider) {
      slider.value = String(pct);
      slider.style.setProperty('--ytm-progress', `${pct}%`);
    }
    if (curEl) curEl.textContent = formatAudioTime(cur);
    if (durEl) durEl.textContent = formatAudioTime(dur);
  }

  function refreshMusicHubPanels(ctrl) {
    const mState = ctrl.getState();
    const stageWrap = rootEl.querySelector('.music-hub-stage-wrap');
    const queueWrap = rootEl.querySelector('#music-hub-queue-wrap');
    const catSlot = rootEl.querySelector('#music-hub-category-slot');
    if (stageWrap) stageWrap.innerHTML = buildMusicHubStageHtml(mState);
    if (catSlot) catSlot.innerHTML = buildMusicCategoryBarAndDrawerHtml(mState);
    if (queueWrap) queueWrap.innerHTML = buildMusicHubQueueHtml(mState);
    bindMusicStageAndQueueEvents(ctrl);
    bindMusicCategoryDrawerEvents(ctrl);
  }

  function bindMusicCategoryDrawerEvents(ctrl) {
    const searchInput = rootEl.querySelector('#music-hub-search-input');
    const toggleDrawer = (forceState = null) => {
      toolState.musicCategoryDrawerOpen =
        typeof forceState === 'boolean' ? forceState : !toolState.musicCategoryDrawerOpen;
      const drawer = rootEl.querySelector('#music-hub-cat-drawer');
      const toggleBtn = rootEl.querySelector('#music-hub-cat-toggle-btn');
      if (drawer) {
        drawer.classList.toggle('is-open', toolState.musicCategoryDrawerOpen);
        drawer.setAttribute('aria-hidden', String(!toolState.musicCategoryDrawerOpen));
      }
      if (toggleBtn) {
        toggleBtn.classList.toggle('is-open', toolState.musicCategoryDrawerOpen);
        toggleBtn.setAttribute('aria-expanded', String(toolState.musicCategoryDrawerOpen));
      }
    };

    rootEl.querySelector('#music-hub-cat-toggle-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleDrawer();
    });

    rootEl.querySelector('#music-hub-active-cat-pill')?.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleDrawer();
    });

    rootEl.querySelector('#music-hub-cat-minimize-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleDrawer(false);
    });

    rootEl.querySelector('#music-hub-refresh-trends-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      ctrl.refreshCategories?.();
      onToast('Menyinkronkan kategori & tren real-time YT Music...');
    });

    rootEl.querySelectorAll('[data-hub-music-preset]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const presetId = btn.getAttribute('data-hub-music-preset');
        if (!presetId) return;
        if (searchInput) searchInput.value = '';
        toolState.musicBrowserTab = 'queue';
        ctrl.loadPresetPlaylist(presetId);
      });
    });

    rootEl.querySelectorAll('[data-hub-trend-query]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const tq = btn.getAttribute('data-hub-trend-query');
        if (!tq) return;
        if (searchInput) searchInput.value = tq;
        toolState.musicBrowserTab = 'queue';
        ctrl.search(tq, { autoPlayFirst: false });
      });
    });
  }

  function bindMusicStageAndQueueEvents(ctrl) {
    rootEl.querySelector('#music-hub-play-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      ctrl.togglePlayPause();
    });

    rootEl.querySelector('#music-hub-next-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      ctrl.playNext({ userInitiated: true });
    });

    rootEl.querySelector('#music-hub-prev-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      ctrl.playPrev();
    });

    rootEl.querySelector('#music-hub-shuffle-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      ctrl.toggleShuffle();
    });

    rootEl.querySelector('#music-hub-repeat-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      ctrl.cycleRepeatMode();
    });

    rootEl.querySelector('#music-hub-mute-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      ctrl.toggleMute();
    });

    rootEl.querySelector('#music-hub-pip-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const opened = ctrl.togglePiP?.();
      onToast(
        opened
          ? 'Gambar dalam Gambar (PiP) aktif. Klik ikon 🎧 Headset di PiP untuk menyembunyikan PiP tanpa menghentikan lagu.'
          : 'Gambar dalam Gambar ditutup.'
      );
    });
    rootEl.querySelector('#music-hub-headset-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const headsetOn = ctrl.toggleHeadsetMode?.();
      onToast(
        headsetOn
          ? '🎧 Mode Headset aktif: Gambar dalam Gambar disembunyikan & lagu tetap berputar.'
          : 'Mode Headset dinonaktifkan.'
      );
    });
    rootEl.querySelector('#music-hub-reopen-pip-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      ctrl.enterPiP?.();
    });
    rootEl.querySelector('#music-hub-autoclick-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      ctrl.toggleAutoClickPlay?.();
    });
    rootEl.querySelector('#music-hub-random-viral-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      ctrl.playNext({ reason: 'any-button-click' });
    });

    rootEl.querySelector('#music-hub-watchlater-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const snap = ctrl.getState();
      const target = snap.currentTrack || snap.tracks?.[0];
      if (!target) return;
      const added = ctrl.toggleWatchLater(target);
      onToast(added ? `"${target.title}" disimpan ke Tonton Nanti.` : `"${target.title}" dihapus dari Tonton Nanti.`);
    });

    rootEl.querySelector('#music-hub-stage-pl-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      toolState.musicStagePlaylistPickerOpen = !toolState.musicStagePlaylistPickerOpen;
      refreshMusicHubPanels(ctrl);
    });

    rootEl.querySelector('#music-hub-stage-pl-close')?.addEventListener('click', (e) => {
      e.stopPropagation();
      toolState.musicStagePlaylistPickerOpen = false;
      refreshMusicHubPanels(ctrl);
    });

    rootEl.querySelector('#music-hub-stage-create-pl-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const input = rootEl.querySelector('#music-hub-stage-new-pl-input');
      const name = String(input?.value || '').trim();
      const snap = ctrl.getState();
      const active = snap.currentTrack || snap.tracks?.[0] || null;
      if (!name) return;
      const pl = ctrl.createPlaylist(name, active);
      if (pl) {
        toolState.musicStagePlaylistPickerOpen = false;
        onToast(active ? `Playlist "${pl.name}" dibuat & "${active.title}" disimpan.` : `Playlist "${pl.name}" dibuat.`);
      }
    });

    rootEl.querySelectorAll('[data-hub-stage-add-pl]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const plId = btn.getAttribute('data-hub-stage-add-pl');
        const snap = ctrl.getState();
        const active = snap.currentTrack || snap.tracks?.[0];
        if (!plId || !active) return;
        const added = ctrl.addTrackToPlaylist(plId, active);
        onToast(added ? `"${active.title}" ditambahkan ke playlist.` : 'Lagu sudah ada di playlist tersebut.');
      });
    });

    const seekSlider = rootEl.querySelector('#music-hub-seek-slider');
    seekSlider?.addEventListener('input', () => {
      isHubSeeking = true;
      const snap = ctrl.getState();
      const dur = snap.duration || snap.currentTrack?.duration || 180;
      const pctVal = Number(seekSlider.value) || 0;
      const targetSec = (pctVal / 100) * dur;
      seekSlider.style.setProperty('--ytm-progress', `${pctVal}%`);
      const curEl = rootEl.querySelector('#music-hub-cur-time');
      if (curEl) curEl.textContent = formatAudioTime(targetSec);
    });
    seekSlider?.addEventListener('change', () => {
      ctrl.seekToPercent(Number(seekSlider.value));
      isHubSeeking = false;
    });

    const volSlider = rootEl.querySelector('#music-hub-volume-slider');
    volSlider?.addEventListener('input', () => {
      const val = Number(volSlider.value) / 100;
      ctrl.setVolume(val);
      const pctEl = rootEl.querySelector('#music-hub-vol-pct');
      if (pctEl) pctEl.textContent = `${Math.round(val * 100)}%`;
    });

    // Browser library tabs (Antrean & Cari | Playlist | Tonton Nanti)
    rootEl.querySelectorAll('[data-hub-music-tab]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        toolState.musicBrowserTab = btn.getAttribute('data-hub-music-tab') || 'queue';
        toolState.musicPlaylistFeedback = '';
        refreshMusicHubPanels(ctrl);
      });
    });

    // Queue & Search track play
    rootEl.querySelectorAll('[data-hub-music-pick]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const pickId = btn.getAttribute('data-hub-music-pick');
        ctrl.playTrackById(pickId, { queueMode: 'catalog' });
      });
    });

    // Row Watch Later toggle
    rootEl.querySelectorAll('[data-hub-wl-id]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const wlId = btn.getAttribute('data-hub-wl-id');
        const target = findTrackByIdInState(ctrl.getState(), wlId);
        if (!target) return;
        const added = ctrl.toggleWatchLater(target);
        onToast(added ? `"${target.title}" disimpan ke Tonton Nanti.` : `"${target.title}" dihapus dari Tonton Nanti.`);
      });
    });

    // Row + Playlist inline picker
    rootEl.querySelectorAll('[data-hub-pl-row-open]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const tid = btn.getAttribute('data-hub-pl-row-open') || '';
        toolState.musicRowPlaylistPickerId = toolState.musicRowPlaylistPickerId === tid ? '' : tid;
        refreshMusicHubPanels(ctrl);
      });
    });

    rootEl.querySelectorAll('[data-hub-row-create-pl]').forEach((form) => {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const tid = form.getAttribute('data-hub-row-create-pl');
        const input = form.querySelector('[data-hub-row-new-pl-input]');
        const name = String(input?.value || '').trim();
        const track = findTrackByIdInState(ctrl.getState(), tid);
        if (!name) return;
        const pl = ctrl.createPlaylist(name, track);
        if (pl) {
          toolState.musicRowPlaylistPickerId = '';
          onToast(track ? `Playlist "${pl.name}" dibuat & lagu disimpan.` : `Playlist "${pl.name}" dibuat.`);
        }
      });
    });

    rootEl.querySelectorAll('[data-hub-row-add-pl]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const plId = btn.getAttribute('data-hub-row-add-pl');
        const tid = btn.getAttribute('data-hub-row-track');
        const track = findTrackByIdInState(ctrl.getState(), tid);
        if (!plId || !track) return;
        const added = ctrl.addTrackToPlaylist(plId, track);
        toolState.musicRowPlaylistPickerId = '';
        onToast(added ? `"${track.title}" ditambahkan ke playlist.` : 'Lagu sudah ada di playlist ini.');
      });
    });

    // Playlist Management tab events
    rootEl.querySelector('#music-hub-create-playlist-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const input = rootEl.querySelector('#music-hub-new-playlist-name');
      const name = String(input?.value || '').trim();
      if (!name) return;
      const pl = ctrl.createPlaylist(name);
      if (pl) {
        toolState.musicPlaylistFeedback = `Playlist "${pl.name}" berhasil dibuat & tersimpan.`;
        toolState.musicSelectedPlaylistId = pl.id;
        refreshMusicHubPanels(ctrl);
      }
    });

    rootEl.querySelector('#music-hub-pl-back')?.addEventListener('click', (e) => {
      e.stopPropagation();
      toolState.musicSelectedPlaylistId = '';
      toolState.musicEditingPlaylistId = '';
      refreshMusicHubPanels(ctrl);
    });

    rootEl.querySelectorAll('[data-hub-pl-open]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        toolState.musicSelectedPlaylistId = btn.getAttribute('data-hub-pl-open') || '';
        toolState.musicPlaylistFeedback = '';
        refreshMusicHubPanels(ctrl);
      });
    });

    rootEl.querySelectorAll('[data-hub-pl-play]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const plId = btn.getAttribute('data-hub-pl-play');
        if (plId) ctrl.playPlaylist(plId, { shuffle: false });
      });
    });

    rootEl.querySelectorAll('[data-hub-pl-shuffle]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const plId = btn.getAttribute('data-hub-pl-shuffle');
        if (plId) ctrl.playPlaylist(plId, { shuffle: true });
      });
    });

    rootEl.querySelectorAll('[data-hub-pl-play-track]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const tid = btn.getAttribute('data-hub-pl-play-track');
        if (tid && toolState.musicSelectedPlaylistId) {
          ctrl.playPlaylist(toolState.musicSelectedPlaylistId, { startTrackId: tid });
        }
      });
    });

    rootEl.querySelectorAll('[data-hub-pl-remove-track]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const tid = btn.getAttribute('data-hub-pl-remove-track');
        const plId = btn.getAttribute('data-hub-pl-id');
        if (plId && tid) {
          ctrl.removeTrackFromPlaylist(plId, tid);
          onToast('Lagu dihapus dari playlist.');
        }
      });
    });

    rootEl.querySelectorAll('[data-hub-pl-rename-open]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        toolState.musicEditingPlaylistId = btn.getAttribute('data-hub-pl-rename-open') || '';
        refreshMusicHubPanels(ctrl);
      });
    });

    rootEl.querySelectorAll('[data-hub-pl-rename-cancel]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        toolState.musicEditingPlaylistId = '';
        refreshMusicHubPanels(ctrl);
      });
    });

    rootEl.querySelectorAll('[data-hub-pl-rename-form]').forEach((form) => {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const plId = form.getAttribute('data-hub-pl-rename-form');
        const input = form.querySelector('[data-hub-pl-rename-input]');
        const nextName = String(input?.value || '').trim();
        if (plId && nextName) {
          toolState.musicEditingPlaylistId = '';
          ctrl.renamePlaylist(plId, nextName);
          onToast(`Nama playlist diperbarui menjadi "${nextName}".`);
        }
      });
    });

    rootEl.querySelectorAll('[data-hub-pl-delete]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const plId = btn.getAttribute('data-hub-pl-delete');
        if (!plId) return;
        if (toolState.musicSelectedPlaylistId === plId) {
          toolState.musicSelectedPlaylistId = '';
        }
        ctrl.deletePlaylist(plId);
        onToast('Playlist dihapus.');
      });
    });

    // Watch Later tab events
    rootEl.querySelector('#music-hub-wl-play-all')?.addEventListener('click', (e) => {
      e.stopPropagation();
      ctrl.playWatchLater({ shuffle: false });
    });

    rootEl.querySelector('#music-hub-wl-shuffle-all')?.addEventListener('click', (e) => {
      e.stopPropagation();
      ctrl.playWatchLater({ shuffle: true });
    });

    rootEl.querySelectorAll('[data-hub-wl-play-track]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const tid = btn.getAttribute('data-hub-wl-play-track');
        if (tid) ctrl.playWatchLater({ startTrackId: tid });
      });
    });
  }

  function renderMusicPanel() {
    const ctrl = ensureMusicHubController();
    const mState = ctrl?.getState() || {
      tracks: [],
      searchResults: [],
      activeCategory: 'viral-indo',
      shuffleEnabled: true,
      repeatMode: 'all',
      volume: 0.72,
      isMuted: false,
      currentTime: 0,
      duration: 180,
    };

    const musicHero = toolState.utilities?.musicHero || {
      icon: './assets/icons/tool-music.svg',
      title: 'YT Music Hub — Viral Indonesia & Pencarian Lengkap',
      subtitle:
        'Sumber resmi YT Music API komunitas open-source. Pemutaran acak otomatis memprioritaskan lagu Indonesia viral setiap kali tombol apa saja ditekan, tanpa bergantung pada riwayat pencarian.',
    };

    return `
      <section class="tool-panel music-hub-panel" data-testid="music-hub-panel">
        <div class="music-hub-hero-card" id="music-hub-hero-card">
          <div class="music-hub-hero-head">
            <img src="${escapeHtml(musicHero.icon || './assets/icons/tool-music.svg')}" alt="" width="44" height="44" class="music-hub-hero-icon" id="music-hub-hero-icon" />
            <div>
              <h2 class="music-hub-hero-title" id="music-hub-hero-title">${escapeHtml(musicHero.title)}</h2>
              <p class="music-hub-hero-sub" id="music-hub-hero-sub">${escapeHtml(musicHero.subtitle)}</p>
            </div>
          </div>
        </div>

        <div class="music-hub-grid">
          <div class="music-hub-stage-wrap">
            ${buildMusicHubStageHtml(mState)}
          </div>

          <div class="tool-card music-hub-browser-wrap">
            <form id="music-hub-search-form" class="music-hub-search-form" data-music-control="true">
              <div class="music-hub-search-input-wrap">
                <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                <input
                  type="search"
                  id="music-hub-search-input"
                  class="music-hub-search-input"
                  placeholder="Cari judul lagu, artis, remix di YT Music..."
                  value="${escapeHtml(mState.searchQuery || '')}"
                  aria-label="Cari lagu YT Music"
                />
              </div>
              <button type="submit" class="btn btn-primary btn-sm" data-music-control="true">Cari</button>
              <button type="button" id="music-hub-clear-search" class="btn btn-secondary btn-sm" data-music-control="true">Reset</button>
            </form>

            <div id="music-hub-category-slot" class="music-hub-category-slot">
              ${buildMusicCategoryBarAndDrawerHtml(mState)}
            </div>

            <div id="music-hub-queue-wrap" class="music-hub-queue-wrap">
              ${buildMusicHubQueueHtml(mState)}
            </div>
          </div>
        </div>
      </section>
    `;
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
    const refreshPrayerSearchDom = () => {
      const slot = rootEl.querySelector('#prayer-search-results-slot');
      if (!slot) return;
      const q = toolState.prayerSearchQuery.trim().toLowerCase();
      const cities = q
        ? toolState.prayerCities
            .filter((c) => c.lokasi.toLowerCase().includes(q))
            .slice(0, 5)
        : [];
      const subs = q.length >= 2 ? toolState.prayerSubSuggestions.slice(0, 6) : [];
      slot.innerHTML = renderPrayerSearchResultsHtml(subs, cities);
      bindPrayerSearchOptionHandlers();
    };

    const bindPrayerSearchOptionHandlers = () => {
      rootEl.querySelectorAll('[data-prayer-sub-idx]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const idx = Number(btn.getAttribute('data-prayer-sub-idx'));
          const chosen = toolState.prayerSubSuggestions[idx];
          if (!chosen) return;
          toolState.location = setManualLocation({ ...chosen, hasExactCoords: true });
          toolState.prayerSearchQuery = '';
          toolState.prayerSubSuggestions = [];
          loadPrayerForCurrentLocation(null);
          loadWeatherForCurrentLocation();
        });
      });

      rootEl.querySelectorAll('[data-prayer-city-id]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-prayer-city-id');
          const name = btn.getAttribute('data-prayer-city-name');
          toolState.prayerSearchQuery = '';
          toolState.prayerSubSuggestions = [];
          if (name) {
            toolState.location = setManualLocation({
              ...(toolState.location || { lat: -6.2088, lon: 106.8456 }),
              kelurahan: '',
              kecamatan: '',
              city: name,
              region: 'Indonesia',
              country: 'Indonesia',
              hasExactCoords: false,
            });
          }
          loadPrayerForCurrentLocation(id);
        });
      });
    };

    const prayerSearch = rootEl.querySelector('#prayer-city-search');
    prayerSearch?.addEventListener('input', (e) => {
      toolState.prayerSearchQuery = e.target.value;
      clearTimeout(prayerSearchTimer);
      refreshPrayerSearchDom();
      const clean = toolState.prayerSearchQuery.trim();
      if (clean.length >= 2) {
        prayerSearchTimer = setTimeout(async () => {
          const hits = await searchCitiesOnline(clean, { indonesiaOnly: true });
          if (toolState.prayerSearchQuery.trim() === clean && mounted && toolState.activeSubTab === 'prayer') {
            toolState.prayerSubSuggestions = hits;
            refreshPrayerSearchDom();
          }
        }, 280);
      } else {
        toolState.prayerSubSuggestions = [];
        refreshPrayerSearchDom();
      }
    });

    bindPrayerSearchOptionHandlers();

    // Weather search & real-time micro-climate calibration
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

    rootEl.querySelectorAll('[data-weather-cal]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-weather-cal') || 'auto';
        toolState.weatherCalibration = mode;
        saveWeatherCalibration(mode);
        render();
        onToast(
          mode === 'auto'
            ? 'Mode sensor cuaca otomatis diaktifkan.'
            : 'Kondisi cuaca aktual di titik lokasi Anda berhasil dikalibrasi.'
        );
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

    if (toolState.activeSubTab === 'downloader') {
      const urlInput = rootEl.querySelector('#dl-url-input');
      urlInput?.addEventListener('input', (e) => {
        toolState.dlUrl = e.target.value;
        const detected = detectDownloaderPlatform(toolState.dlUrl);
        rootEl.querySelectorAll('.dl-platform-pills .dl-plat-pill').forEach((el) => {
          const text = el.textContent?.trim().toLowerCase() || '';
          el.classList.toggle('is-detected', Boolean(detected && text === detected));
        });
      });

      rootEl.querySelector('#dl-paste-btn')?.addEventListener('click', async () => {
        try {
          const clip = await navigator.clipboard.readText();
          if (clip) {
            toolState.dlUrl = clip.trim();
            render();
            onToast('Tautan ditempel dari clipboard.');
          }
        } catch {
          onToast('Izinkan akses clipboard atau tempel manual pada kolom link.');
        }
      });

      const updateConvProgressDom = ({ percent, label, stage }) => {
        toolState.dlConvPercent = percent;
        toolState.dlConvLabel = label;
        toolState.dlConvStage = stage || 'processing';
        const labelEl = rootEl.querySelector('#dl-conv-progress-label');
        const pctEl = rootEl.querySelector('#dl-conv-progress-pct');
        const barEl = rootEl.querySelector('#dl-conv-progress-bar');
        const fillEl = rootEl.querySelector('#dl-conv-progress-fill');
        if (labelEl) labelEl.textContent = label;
        if (pctEl) pctEl.textContent = `${percent}%`;
        if (barEl) barEl.setAttribute('aria-valuenow', String(percent));
        if (fillEl) fillEl.style.width = `${Math.max(6, percent)}%`;
      };

      const updateSaveProgressDom = ({ percent, label, stage }) => {
        toolState.dlSaveActive = true;
        toolState.dlSavePercent = percent;
        toolState.dlSaveLabel = label;
        toolState.dlSaveStage = stage || 'downloading';
        const labelEl = rootEl.querySelector('#dl-save-progress-label');
        const pctEl = rootEl.querySelector('#dl-save-progress-pct');
        const barEl = rootEl.querySelector('#dl-save-progress-bar');
        const fillEl = rootEl.querySelector('#dl-save-progress-fill');
        if (labelEl) labelEl.textContent = label;
        if (pctEl) pctEl.textContent = `${percent}%`;
        if (barEl) barEl.setAttribute('aria-valuenow', String(percent));
        if (fillEl) fillEl.style.width = `${Math.max(4, percent)}%`;
      };

      rootEl.querySelector('#dl-clear-btn')?.addEventListener('click', () => {
        toolState.dlUrl = '';
        toolState.dlError = '';
        toolState.dlResult = null;
        toolState.dlConvPercent = 0;
        toolState.dlConvLabel = '';
        toolState.dlSavingIdx = -1;
        toolState.dlSaveActive = false;
        toolState.dlSavePercent = 0;
        toolState.dlSaveLabel = '';
        toolState.dlBatchSaving = false;
        render();
      });

      rootEl.querySelector('#dl-fetch-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const url = String(urlInput?.value || toolState.dlUrl || '').trim();
        toolState.dlUrl = url;
        if (!url || toolState.dlLoading) return;
        toolState.dlLoading = true;
        toolState.dlConvPercent = 10;
        toolState.dlConvLabel = 'Memulai analisis tautan...';
        toolState.dlError = '';
        toolState.dlResult = null;
        toolState.dlSaveActive = false;
        render();
        rootEl.querySelector('#dl-conv-progress-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        try {
          const result = await fetchMediaDownload(url, updateConvProgressDom);
          toolState.dlResult = result;
          const photoCount = result.photos?.length || 0;
          onToast(
            photoCount > 1
              ? `Berhasil! ${photoCount} slide foto HD & caption siap diunduh.`
              : `Berhasil! ${result.links.length} opsi unduhan siap.`
          );
        } catch (err) {
          toolState.dlError = err?.message || 'Gagal mengambil tautan unduhan.';
        } finally {
          toolState.dlLoading = false;
          toolState.dlConvPercent = 0;
          render();
        }
      });

      rootEl.querySelector('#dl-copy-caption-btn')?.addEventListener('click', async () => {
        const cap = String(toolState.dlResult?.caption || toolState.dlResult?.title || '').trim();
        if (!cap) return;
        try {
          await navigator.clipboard.writeText(cap);
          onToast('Caption berhasil disalin ke clipboard!');
        } catch {
          const ta = document.createElement('textarea');
          ta.value = cap;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          ta.remove();
          onToast('Caption berhasil disalin!');
        }
      });

      rootEl.querySelector('#dl-batch-photos-btn')?.addEventListener('click', async () => {
        const photos = toolState.dlResult?.photos || [];
        if (photos.length === 0 || toolState.dlBatchSaving) return;
        toolState.dlBatchSaving = true;
        toolState.dlSaveActive = true;
        toolState.dlSavePercent = 5;
        toolState.dlSaveLabel = `Menyiapkan unduhan ${photos.length} foto HD...`;
        toolState.dlBatchProgressText = `Mengunduh 1/${photos.length}...`;
        render();
        rootEl.querySelector('#dl-save-progress-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        try {
          await triggerBatchPhotoDownload(
            photos,
            `${toolState.dlResult.platform}-${toolState.dlResult.title}`,
            ({ current, total, percent, label }) => {
              toolState.dlBatchProgressText = `Mengunduh ${current}/${total} (${percent}%)`;
              const btn = rootEl.querySelector('#dl-batch-photos-btn');
              if (btn) btn.textContent = toolState.dlBatchProgressText;
              updateSaveProgressDom({
                percent,
                label: label || toolState.dlBatchProgressText,
                stage: 'downloading',
              });
            }
          );
          onToast(`Berhasil mengunduh ${photos.length} foto HD!`);
        } catch (err) {
          toolState.dlError = err?.message || 'Sebagian foto gagal diunduh.';
        } finally {
          toolState.dlBatchSaving = false;
          toolState.dlBatchProgressText = '';
          render();
        }
      });

      rootEl.querySelectorAll('[data-dl-photo-url]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const url = btn.getAttribute('data-dl-photo-url');
          const ext = btn.getAttribute('data-dl-photo-ext') || 'jpg';
          const idx = Number(btn.getAttribute('data-dl-photo-idx')) || 0;
          if (!url) return;
          toolState.dlSaveActive = true;
          toolState.dlSavePercent = 10;
          toolState.dlSaveLabel = `Mengunduh Foto #${idx + 1}...`;
          render();
          rootEl.querySelector('#dl-save-progress-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          try {
            await triggerDirectMediaSave(
              url,
              `${toolState.dlResult?.platform || 'sosmed'}-foto-${idx + 1}`,
              ext,
              updateSaveProgressDom
            );
            onToast(`Foto #${idx + 1} berhasil diunduh!`);
          } catch (err) {
            toolState.dlSaveActive = false;
            toolState.dlError = err?.message || 'Gagal mengunduh foto.';
            render();
          }
        });
      });

      rootEl.querySelectorAll('.dl-video-preview, .dl-audio-preview').forEach((mediaEl) => {
        mediaEl.addEventListener('play', () => {
          window.dispatchEvent(new CustomEvent('manifestudio:external-media-play'));
          rootEl.querySelectorAll('.dl-video-preview, .dl-audio-preview').forEach((other) => {
            if (other !== mediaEl && !other.paused) {
              other.pause();
            }
          });
        });
      });

      rootEl.querySelectorAll('[data-dl-save-idx]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const idx = Number(btn.getAttribute('data-dl-save-idx'));
          const item = toolState.dlResult?.links?.[idx];
          if (!item || toolState.dlSavingIdx >= 0) return;
          window.dispatchEvent(new CustomEvent('manifestudio:external-media-play'));
          toolState.dlSavingIdx = idx;
          toolState.dlSaveActive = true;
          toolState.dlSavePercent = 10;
          toolState.dlSaveLabel = `Menyiapkan & mengonversi ${item.label}...`;
          toolState.dlError = '';
          render();
          rootEl.querySelector('#dl-save-progress-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          try {
            if (item.extractAudioFromVideo) {
              await extractAudioFromVideoUrl(
                item.url,
                `${toolState.dlResult.platform}-${toolState.dlResult.title}`,
                updateSaveProgressDom
              );
            } else {
              await triggerDirectMediaSave(
                item.url,
                `${toolState.dlResult.platform}-${toolState.dlResult.title}`,
                item.ext,
                updateSaveProgressDom
              );
            }
            onToast(`${item.label} berhasil diproses!`);
          } catch (err) {
            toolState.dlSaveActive = false;
            toolState.dlError = err?.message || 'Gagal mengunduh file media langsung.';
          } finally {
            toolState.dlSavingIdx = -1;
            render();
          }
        });
      });
    }

    if (toolState.activeSubTab === 'compressor') {
      rootEl.querySelectorAll('[data-comp-method]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-comp-method');
          if (!id) return;
          toolState.compMethodId = id;
          render();
        });
      });

      rootEl.querySelectorAll('[data-comp-preset]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-comp-preset');
          if (!id) return;
          toolState.compPresetId = id;
          render();
        });
      });

      const fileInput = rootEl.querySelector('#comp-file-input');
      fileInput?.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (file) handleSelectCompressorFile(file);
      });

      const dropzone = rootEl.querySelector('#comp-dropzone');
      dropzone?.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('is-dragover');
      });
      dropzone?.addEventListener('dragleave', () => {
        dropzone.classList.remove('is-dragover');
      });
      dropzone?.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('is-dragover');
        const file = e.dataTransfer?.files?.[0];
        if (file) handleSelectCompressorFile(file);
      });

      rootEl.querySelector('#comp-run-btn')?.addEventListener('click', () => {
        runActiveCompression();
      });

      rootEl.querySelector('#comp-reset-btn')?.addEventListener('click', () => {
        toolState.compFile = null;
        toolState.compInspect = null;
        toolState.compResult = null;
        toolState.compError = '';
        toolState.compProgressPct = 0;
        toolState.compProgressLabel = '';
        render();
      });
    }

    if (toolState.activeSubTab === 'converter') {
      const targetSelect = rootEl.querySelector('#conv-target-select');
      targetSelect?.addEventListener('change', (e) => {
        const targetId = e.target.value;
        if (!targetId) return;
        toolState.convTargetFormat = targetId;
        toolState.convResult = null;
        render();
      });

      const fileInput = rootEl.querySelector('#conv-file-input');
      fileInput?.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (file) handleSelectConverterFile(file);
      });

      const dropzone = rootEl.querySelector('#conv-dropzone');
      dropzone?.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('is-dragover');
      });
      dropzone?.addEventListener('dragleave', () => {
        dropzone.classList.remove('is-dragover');
      });
      dropzone?.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('is-dragover');
        const file = e.dataTransfer?.files?.[0];
        if (file) handleSelectConverterFile(file);
      });

      rootEl.querySelector('#conv-run-btn')?.addEventListener('click', () => {
        runActiveConversion();
      });

      rootEl.querySelector('#conv-reset-btn')?.addEventListener('click', () => {
        toolState.convFile = null;
        toolState.convSourceInfo = null;
        toolState.convResult = null;
        toolState.convError = '';
        toolState.convProgressPct = 0;
        toolState.convProgressLabel = '';
        render();
      });
    }

    if (toolState.activeSubTab === 'songfinder') {
      const fileInput = rootEl.querySelector('#sf-file-input');
      fileInput?.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (file) handleSelectSongFinderFile(file);
      });

      const dropzone = rootEl.querySelector('#sf-dropzone');
      dropzone?.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('is-dragover');
      });
      dropzone?.addEventListener('dragleave', () => {
        dropzone.classList.remove('is-dragover');
      });
      dropzone?.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('is-dragover');
        const file = e.dataTransfer?.files?.[0];
        if (file) handleSelectSongFinderFile(file);
      });

      const hintInput = rootEl.querySelector('#sf-hint-input');
      hintInput?.addEventListener('input', (e) => {
        toolState.sfUserHint = e.target.value;
      });
      hintInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && toolState.sfFile && !toolState.sfLoading) {
          e.preventDefault();
          runActiveSongFinder();
        }
      });

      rootEl.querySelector('#sf-run-btn')?.addEventListener('click', () => {
        runActiveSongFinder();
      });
      rootEl.querySelector('#sf-run-secondary-btn')?.addEventListener('click', () => {
        runActiveSongFinder();
      });

      rootEl.querySelector('#sf-play-in-ytmusic-btn')?.addEventListener('click', () => {
        const best = toolState.sfResult?.bestMatch;
        if (!best) return;
        const query = `${best.artist || ''} ${best.title || ''}`.trim();
        toolState.activeSubTab = 'music';
        toolState.musicBrowserTab = 'queue';
        onSubTabChange('music');
        render();
        const ctrl = ensureMusicHubController();
        ctrl?.search(query, { autoPlayFirst: true });
      });

      rootEl.querySelector('#sf-reset-btn')?.addEventListener('click', () => {
        if (toolState.sfPreviewUrl) {
          try {
            URL.revokeObjectURL(toolState.sfPreviewUrl);
          } catch {
            // Ignore
          }
        }
        toolState.sfFile = null;
        toolState.sfKindInfo = null;
        toolState.sfPreviewUrl = '';
        toolState.sfUserHint = '';
        toolState.sfResult = null;
        toolState.sfError = '';
        toolState.sfProgressPct = 0;
        toolState.sfProgressLabel = '';
        render();
      });
    }

    if (toolState.activeSubTab === 'music') {
      const ctrl = ensureMusicHubController();
      if (ctrl) {
        bindMusicStageAndQueueEvents(ctrl);
        bindMusicCategoryDrawerEvents(ctrl);

        const searchForm = rootEl.querySelector('#music-hub-search-form');
        const searchInput = rootEl.querySelector('#music-hub-search-input');

        searchForm?.addEventListener('submit', (e) => {
          e.preventDefault();
          e.stopPropagation();
          toolState.musicBrowserTab = 'queue';
          ctrl.search(searchInput?.value || '', { autoPlayFirst: false });
        });

        rootEl.querySelector('#music-hub-clear-search')?.addEventListener('click', (e) => {
          e.stopPropagation();
          if (searchInput) searchInput.value = '';
          toolState.musicBrowserTab = 'queue';
          ctrl.clearSearch();
        });

        if (musicUnsub) {
          musicUnsub();
          musicUnsub = null;
        }
        musicUnsub = ctrl.subscribe((nextState, kind) => {
          if (!mounted || toolState.activeSubTab !== 'music') return;
          if (kind === 'time' || kind === 'seek') {
            syncMusicHubTimeDom(nextState);
            return;
          }
          if (kind === 'init') return;

          if (kind === 'progress') {
            const pBanner = rootEl.querySelector('#music-hub-progress-banner');
            const pct = Math.max(8, Math.min(99, Number(nextState.loadingProgress) || 32));
            if (pBanner) {
              const fill = pBanner.querySelector('.ytm-progress-fill');
              const pctEl = pBanner.querySelector('.ytm-progress-pct');
              const lbl = pBanner.querySelector('.ytm-progress-spin-wrap > span:last-child');
              if (fill) fill.style.width = `${pct}%`;
              if (pctEl) pctEl.textContent = `${pct}%`;
              if (lbl && nextState.loadingLabel) lbl.textContent = nextState.loadingLabel;
            }
            const stageBuf = rootEl.querySelector('.ytm-stage-buffer-bar');
            if (stageBuf && nextState.isLoading) {
              const fill = stageBuf.querySelector('.ytm-progress-fill');
              const pctEl = stageBuf.querySelector('.ytm-progress-pct');
              if (fill) fill.style.width = `${pct}%`;
              if (pctEl) pctEl.textContent = `${pct}%`;
            }
            const qPill = rootEl.querySelector('.ytm-queue-count .ytm-loading-pill');
            if (qPill) {
              qPill.innerHTML = `<span class="ytm-inline-spinner" aria-hidden="true"></span> ${pct}%`;
            }
            return;
          }

          const activeEl = document.activeElement;
          const typingInStagePicker = Boolean(activeEl?.closest('#music-hub-stage-pl-picker'));
          const typingInQueueInput = Boolean(
            activeEl?.closest('#music-hub-queue-wrap') &&
              (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')
          );

          const stageWrap = rootEl.querySelector('.music-hub-stage-wrap');
          const catSlot = rootEl.querySelector('#music-hub-category-slot');
          const queueWrap = rootEl.querySelector('#music-hub-queue-wrap');
          if (
            stageWrap &&
            kind !== 'trends' &&
            !isHubSeeking &&
            !typingInStagePicker &&
            activeEl?.id !== 'music-hub-volume-slider'
          ) {
            stageWrap.innerHTML = buildMusicHubStageHtml(nextState);
          }
          if (catSlot && (kind === 'trends' || kind === 'pool' || kind === 'search')) {
            catSlot.innerHTML = buildMusicCategoryBarAndDrawerHtml(nextState);
            bindMusicCategoryDrawerEvents(ctrl);
          }
          if (queueWrap && kind !== 'trends' && (!typingInQueueInput || kind === 'library')) {
            queueWrap.innerHTML = buildMusicHubQueueHtml(nextState);
          }
          bindMusicStageAndQueueEvents(ctrl);
        });
      }
    }
  }

  function renderPrayerSearchResultsHtml(subDistrictResults = [], filteredCities = []) {
    if (subDistrictResults.length === 0 && filteredCities.length === 0) return '';
    return `
      <div class="tool-city-results" role="listbox" aria-label="Pilih kecamatan atau kota jadwal sholat">
        ${subDistrictResults
          .map(
            (c, idx) => `
          <button type="button" class="tool-city-option" data-prayer-sub-idx="${idx}">
            <span>${escapeHtml(c.displayLabel || c.city)}</span>
            <span class="tool-city-sub">Presisi Wilayah (${c.lat.toFixed(3)}, ${c.lon.toFixed(3)})</span>
          </button>
        `
          )
          .join('')}
        ${filteredCities
          .map(
            (c) => `
          <button type="button" class="tool-city-option" data-prayer-city-id="${escapeHtml(c.id)}" data-prayer-city-name="${escapeHtml(c.lokasi)}">
            <span>${escapeHtml(c.lokasi)}</span>
            <span class="tool-city-sub">Markaz Kab/Kota (Kemenag RI)</span>
          </button>
        `
          )
          .join('')}
      </div>
    `;
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
        : toolState.activeSubTab === 'speedtest'
        ? renderSpeedtestPanel()
        : toolState.activeSubTab === 'compressor'
        ? renderCompressorPanel()
        : toolState.activeSubTab === 'converter'
        ? renderConverterPanel()
        : toolState.activeSubTab === 'songfinder'
        ? renderSongFinderPanel()
        : toolState.activeSubTab === 'music'
        ? renderMusicPanel()
        : renderDownloaderPanel();

    const subnavButtonsHtml = (toolState.utilities?.items || [])
      .map(
        (item) => `
          <button
            type="button"
            role="tab"
            class="tools-subtab ${toolState.activeSubTab === item.id ? 'is-active' : ''}"
            data-tool-subtab="${escapeHtml(item.id)}"
            aria-selected="${toolState.activeSubTab === item.id}"
          >
            <img src="${escapeHtml(item.icon || `./assets/icons/tool-${item.id}.svg`)}" alt="" width="28" height="28" class="tools-subtab-icon" />
            <span>${escapeHtml(item.label)}</span>
          </button>
        `
      )
      .join('');

    rootEl.innerHTML = `
      <div class="tools-hub">
        <div class="tools-subnav" role="tablist" aria-label="Menu Tambahan">
          ${subnavButtonsHtml}
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
        subTab === 'speedtest' ||
        subTab === 'downloader' ||
        subTab === 'compressor' ||
        subTab === 'converter' ||
        subTab === 'songfinder' ||
        subTab === 'music'
      ) {
        toolState.activeSubTab = subTab;
      }
      render();
      if (
        (toolState.activeSubTab === 'prayer' ||
          toolState.activeSubTab === 'weather' ||
          toolState.activeSubTab === 'speedtest') &&
        !toolState.location &&
        !toolState.locationLoading
      ) {
        ensureLocationAndLoad();
      }
      if (toolState.activeSubTab === 'speedtest') {
        ensureSpeedtestEnv();
      }
    },
    setUtilitiesConfig(nextUtilities) {
      toolState.utilities = normalizeUtilityConfig(nextUtilities);
      if (
        mounted &&
        !toolState.dlLoading &&
        !toolState.compLoading &&
        !toolState.convLoading &&
        !toolState.sfLoading &&
        !toolState.speedRunning
      ) {
        render();
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
