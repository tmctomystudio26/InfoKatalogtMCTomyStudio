/**
 * Pure Logic Module for Manifestudio SSH & VPN Studio (v95)
 * Decoupled from DOM so every rule, filter, validator, and history operation is unit-tested via node:test.
 */

export const SSHVPN_HISTORY_KEY = 'manifestudio_sshvpn_history_v1';
export const MAX_HISTORY_ITEMS = 60;

export const SSHVPN_PROTOCOLS = Object.freeze([
  { id: 'all', label: 'Semua Protokol', short: 'Semua', needsPassword: false, apps: 'HTTP Custom, WireGuard, V2RayNG, Nekobox, Hiddify, OpenVPN' },
  { id: 'ssh', label: 'SSH Tunnel (WS / SSL / UDP / SlowDNS)', short: 'SSH', needsPassword: true, apps: 'HTTP Custom, HTTP Injector, Dark Tunnel, NapsternetV' },
  { id: 'wireguard', label: 'WireGuard VIP', short: 'WireGuard', needsPassword: false, apps: 'WireGuard, AmneziaWG, Nekobox, Sing-Box' },
  { id: 'vmess', label: 'V2Ray VMess', short: 'VMess', needsPassword: false, apps: 'V2RayNG, Nekobox, Hiddify, Clash Meta' },
  { id: 'vless', label: 'Xray VLess', short: 'VLess', needsPassword: false, apps: 'V2RayNG, Hiddify, Streisand, Sing-Box' },
  { id: 'trojan', label: 'Trojan GFW/WS', short: 'Trojan', needsPassword: false, apps: 'V2RayNG, Clash, Shadowrocket, Hiddify' },
  { id: 'shadowsocks', label: 'Shadowsocks', short: 'Shadowsocks', needsPassword: false, apps: 'Shadowsocks, Outline, Nekobox, Clash' },
  { id: 'hysteria2', label: 'Hysteria2 QUIC', short: 'Hysteria2', needsPassword: false, apps: 'Hiddify, Nekobox, Sing-Box, Shadowrocket' },
  { id: 'openvpn', label: 'OpenVPN / L2TP', short: 'OpenVPN', needsPassword: false, apps: 'OpenVPN Connect, L2TP Android/iOS, SSTP' },
]);

export const DURATION_OPTIONS = Object.freeze([
  { days: 3, label: '3 Hari', note: 'Cepat & Ringan' },
  { days: 7, label: '7 Hari', note: 'Standar VIP' },
  { days: 14, label: '14 Hari', note: 'Stabil Menengah' },
  { days: 30, label: '30 Hari', note: 'Maksimal Gratis' },
]);

export function getProtocolMeta(protocolId) {
  const id = String(protocolId || '').toLowerCase();
  if (id === 'ssh' || id.startsWith('ssh-')) {
    return SSHVPN_PROTOCOLS.find((p) => p.id === 'ssh') || SSHVPN_PROTOCOLS[1];
  }
  return SSHVPN_PROTOCOLS.find((p) => p.id === id) || SSHVPN_PROTOCOLS[0];
}

export function protocolRequiresPassword(protocolId) {
  return !!getProtocolMeta(protocolId).needsPassword;
}

export function validateSshVpnForm({ server, username, password, sni, durationDays }) {
  const errors = [];
  if (!server || !server.id) {
    errors.push('Pilih server terlebih dahulu dari daftar server aktif.');
  }
  const cleanUser = String(username || '').trim();
  const cleanPass = String(password || '').trim();
  const cleanSni = String(sni || '').trim();
  const proto = String(server?.protocol || '').toLowerCase();

  if (!/^[a-zA-Z0-9._-]{3,24}$/.test(cleanUser)) {
    errors.push('Username harus 3–24 karakter (huruf, angka, titik, strip, atau garis bawah).');
  }
  if (protocolRequiresPassword(proto) && !/^[a-zA-Z0-9!@#$%^&*._-]{3,32}$/.test(cleanPass)) {
    errors.push('Password SSH minimal 3 karakter (tanpa spasi).');
  }
  if (cleanSni && !/^[a-zA-Z0-9.-]{3,120}$/.test(cleanSni)) {
    errors.push('Bug Host / SNI harus berupa nama domain valid (contoh: m.zoom.us).');
  }

  const parsedDuration = Number(durationDays || 7);
  const validDuration = [1, 3, 7, 14, 30].includes(parsedDuration) ? parsedDuration : 7;

  return {
    ok: errors.length === 0,
    errors,
    clean: {
      username: cleanUser,
      password: cleanPass,
      sni: cleanSni,
      durationDays: validDuration,
    },
  };
}

export function generateRandomCredentials(prefix = 'vip') {
  const safePrefix = String(prefix || 'vip')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 8) || 'vip';
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  const rand = (len) => {
    let out = '';
    for (let i = 0; i < len; i++) {
      out += chars[Math.floor(Math.random() * chars.length)];
    }
    return out;
  };
  return {
    username: `${safePrefix}${rand(5)}`,
    password: `Mf${rand(6)}9`,
  };
}

export function computeSlotHealth(server) {
  const rem = Number(server?.remainingSlots ?? 0);
  const max = Math.max(1, Number(server?.maxSlots ?? 100));
  if (rem >= 999 || max >= 999) {
    return {
      remaining: 999,
      max: 999,
      percent: 100,
      status: 'unlimited',
      label: 'Slot Tak Terbatas',
    };
  }
  const pct = Math.max(0, Math.min(100, Math.round((rem / max) * 100)));
  const status = rem <= 0 ? 'full' : pct <= 20 ? 'low' : 'available';
  return {
    remaining: rem,
    max,
    percent: pct,
    status,
    label: rem <= 0 ? 'Slot Penuh' : `${rem} / ${max} slot`,
  };
}

export function extractAvailableCountries(servers = []) {
  const map = new Map();
  for (const srv of servers) {
    const code = String(srv?.countryCode || 'GLOBAL').toUpperCase();
    const existing = map.get(code);
    if (existing) {
      existing.count += 1;
    } else {
      map.set(code, {
        code,
        name: srv?.country || code,
        flag: srv?.flag || '🌐',
        count: 1,
      });
    }
  }
  return [...map.values()].sort((a, b) => {
    // Prioritize Indonesia & Singapore at top for Indonesian users
    const priority = { ID: 0, SG: 1, JP: 2, US: 3, DE: 4, NL: 5 };
    const pa = priority[a.code] ?? 99;
    const pb = priority[b.code] ?? 99;
    if (pa !== pb) return pa - pb;
    return b.count - a.count || a.name.localeCompare(b.name);
  });
}

export function filterAndSortServers(
  servers = [],
  { protocol = 'all', country = 'ALL', instantOnly = false, query = '', sortBy = 'recommended' } = {}
) {
  const q = String(query || '').trim().toLowerCase();
  const proto = String(protocol || 'all').toLowerCase();
  const cc = String(country || 'ALL').toUpperCase();

  const filtered = servers.filter((srv) => {
    if (!srv) return false;
    if (proto !== 'all') {
      if (proto === 'ssh') {
        if (!String(srv.protocol || '').startsWith('ssh-')) return false;
      } else if (String(srv.protocol || '').toLowerCase() !== proto) {
        return false;
      }
    }
    if (cc !== 'ALL' && String(srv.countryCode || '').toUpperCase() !== cc) {
      return false;
    }
    if (instantOnly && srv.provisioningMode !== 'instant') {
      return false;
    }
    if (q) {
      const hay = `${srv.name || ''} ${srv.country || ''} ${srv.countryCode || ''} ${srv.host || ''} ${srv.provider || ''} ${srv.protocolLabel || ''} ${srv.specs || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const sorted = [...filtered];
  sorted.sort((a, b) => {
    if (sortBy === 'ping') {
      return (Number(a.pingMs) || 999) - (Number(b.pingMs) || 999);
    }
    if (sortBy === 'slots') {
      return (Number(b.remainingSlots) || 0) - (Number(a.remainingSlots) || 0);
    }
    if (sortBy === 'speed') {
      return (Number(b.speedMbps) || 0) - (Number(a.speedMbps) || 0);
    }
    // Recommended: instant provisioning first, then lower ping, then ID/SG preference
    const instDiff = (b.provisioningMode === 'instant' ? 1 : 0) - (a.provisioningMode === 'instant' ? 1 : 0);
    if (instDiff !== 0) return instDiff;
    const regionScore = (s) => (s.countryCode === 'ID' ? 0 : s.countryCode === 'SG' ? 1 : s.countryCode === 'JP' ? 2 : 3);
    const rDiff = regionScore(a) - regionScore(b);
    if (rDiff !== 0) return rDiff;
    return (Number(a.pingMs) || 999) - (Number(b.pingMs) || 999);
  });

  return sorted;
}

export function computeAccountExpiry(expiresAtIso, nowMs = Date.now()) {
  const expMs = Date.parse(String(expiresAtIso || ''));
  if (!Number.isFinite(expMs)) {
    return { expired: false, label: 'Aktif', remainingHours: 24 };
  }
  const diffMs = expMs - nowMs;
  if (diffMs <= 0) {
    return { expired: true, label: 'Kedaluwarsa', remainingHours: 0 };
  }
  const totalHours = Math.floor(diffMs / 3600000);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  if (days >= 1) {
    return {
      expired: false,
      label: `Sisa ${days} hari ${hours} jam`,
      remainingHours: totalHours,
    };
  }
  const mins = Math.max(1, Math.floor((diffMs % 3600000) / 60000));
  return {
    expired: false,
    label: `Sisa ${hours > 0 ? `${hours} jam ` : ''}${mins} mnt`,
    remainingHours: totalHours,
  };
}

export function buildCopyableSummary(account) {
  if (!account) return '';
  const lines = [
    `=== Manifestudio SSH & VPN Studio ===`,
    `Protokol   : ${account.protocolLabel || account.protocol}`,
    `Server     : ${account.flag || ''} ${account.serverName || account.host} (${account.country || ''})`.trim(),
    `Host       : ${account.host}`,
    `Port       : ${account.ports || account.port}`,
    `Username   : ${account.username}`,
  ];
  if (account.password) {
    lines.push(`Password   : ${account.password}`);
  }
  lines.push(
    `Penyedia   : ${account.provider || 'Multi-API'}`,
    `Durasi     : ${account.durationDays || 7} Hari`,
    `Berlaku s/d: ${account.expiresAt ? new Date(account.expiresAt).toLocaleString('id-ID') : '-'}`
  );
  if (account.extraDetails && typeof account.extraDetails === 'object') {
    lines.push('');
    for (const [k, v] of Object.entries(account.extraDetails)) {
      if (v) lines.push(`${k}: ${v}`);
    }
  }
  if (account.configUri) {
    lines.push('', '--- URI / Konfigurasi ---', account.configUri);
  }
  return lines.join('\n');
}

export function sanitizeExternalPortalUrl(rawUrl) {
  try {
    const u = new URL(String(rawUrl || ''));
    if (u.protocol !== 'https:') return '';
    return u.href;
  } catch {
    return '';
  }
}

export function loadSshVpnHistory(storage = globalThis.localStorage) {
  try {
    if (!storage) return [];
    const raw = storage.getItem(SSHVPN_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item) => item && item.id && item.host) : [];
  } catch {
    return [];
  }
}

export function saveSshVpnHistory(list, storage = globalThis.localStorage) {
  try {
    if (!storage) return;
    const trimmed = Array.isArray(list) ? list.slice(0, MAX_HISTORY_ITEMS) : [];
    storage.setItem(SSHVPN_HISTORY_KEY, JSON.stringify(trimmed));
  } catch {
    // ignore quota errors
  }
}

export function addAccountToHistory(account, storage = globalThis.localStorage) {
  if (!account || !account.id) return loadSshVpnHistory(storage);
  const current = loadSshVpnHistory(storage);
  const next = [account, ...current.filter((item) => item.id !== account.id)].slice(0, MAX_HISTORY_ITEMS);
  saveSshVpnHistory(next, storage);
  return next;
}

export function removeAccountFromHistory(accountId, storage = globalThis.localStorage) {
  const current = loadSshVpnHistory(storage);
  const next = current.filter((item) => item.id !== accountId);
  saveSshVpnHistory(next, storage);
  return next;
}

export function clearSshVpnHistory(storage = globalThis.localStorage) {
  saveSshVpnHistory([], storage);
  return [];
}
