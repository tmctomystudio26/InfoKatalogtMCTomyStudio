import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import {
  DURATION_OPTIONS,
  SSHVPN_PROTOCOLS,
  addAccountToHistory,
  buildCopyableSummary,
  clearSshVpnHistory,
  computeAccountExpiry,
  computeSlotHealth,
  extractAvailableCountries,
  filterAndSortServers,
  generateRandomCredentials,
  loadSshVpnHistory,
  protocolRequiresPassword,
  removeAccountFromHistory,
  sanitizeExternalPortalUrl,
  validateSshVpnForm,
} from './sshvpn-logic.js';

import {
  createPortalSshPreparation,
  extractJagoVpnRealHostFromPage,
  generateWireGuardKeyPair,
  isAllowedUpstreamUrl,
  parseFreeVpnStatusHtml,
  parseJagoVpnStatusHtml,
  parseProxyConfigLine,
  parseSshMaxStatusHtml,
  parseSshOceanStatusHtml,
  parseVpnGateCsv,
  validateCreatePayload,
  x25519ScalarMult,
} from '../functions/api/ssh-vpn.js';

function createMemoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

test('v95 SSH & VPN Studio: RFC 7748 X25519 keypair matches Node crypto native X25519 exactly', () => {
  // RFC 7748 Section 6.1 test vector
  const scalarHex = 'a546e36bf0527c9d3b16154b82465edd62144c0ac1fc5a18506a2244ba449ac4';
  const uHex = 'e6db6867583030db3594c1a424b15f7c726624ec26b3353b10a903a6d0ab1c4c';
  const expectedHex = 'c3da55379de9c6908e94ea4df28d084f32eccf03491c71f754b4075577a28552';
  const actual = Buffer.from(
    x25519ScalarMult(Buffer.from(scalarHex, 'hex'), Buffer.from(uHex, 'hex'))
  ).toString('hex');
  assert.equal(actual, expectedHex);

  // Verify generated keypair derives identical public key in Node's native X25519 implementation
  const pair = generateWireGuardKeyPair();
  const privRaw = Buffer.from(pair.privateKey, 'base64');
  assert.equal(privRaw.length, 32);
  const pkcs8Prefix = Buffer.from('302e020100300506032b656e04220420', 'hex');
  const nodePrivKey = crypto.createPrivateKey({
    key: Buffer.concat([pkcs8Prefix, privRaw]),
    format: 'der',
    type: 'pkcs8',
  });
  const nodePubRaw = crypto
    .createPublicKey(nodePrivKey)
    .export({ format: 'der', type: 'spki' })
    .subarray(-32)
    .toString('base64');
  assert.equal(pair.publicKey, nodePubRaw);
});

test('v95 SSH & VPN Studio: Backend enforces strict SSRF upstream allowlist & input validation', () => {
  assert.equal(isAllowedUpstreamUrl('https://api.cloudflareclient.com/v0a2158/reg'), true);
  assert.equal(isAllowedUpstreamUrl('https://www.vpngate.net/api/iphone/'), true);
  assert.equal(isAllowedUpstreamUrl('https://sshocean.com/server-status'), true);
  assert.equal(isAllowedUpstreamUrl('https://raw.githubusercontent.com/barry-far/V2ray-Config/main/test.txt'), true);
  assert.equal(isAllowedUpstreamUrl('http://127.0.0.1/admin'), false);
  assert.equal(isAllowedUpstreamUrl('http://169.254.169.254/latest/meta-data/'), false);
  assert.equal(isAllowedUpstreamUrl('https://evil.example.com/steal'), false);
  assert.equal(isAllowedUpstreamUrl('javascript:alert(1)'), false);

  const badUser = validateCreatePayload({ protocol: 'wireguard', serverId: 'warp-sg-vip', username: 'ab' });
  assert.equal(badUser.ok, false);

  const badSshPass = validateCreatePayload({
    protocol: 'ssh-ws',
    serverId: 'sshocean-sg1',
    username: 'tomyvip',
    password: '12',
  });
  assert.equal(badSshPass.ok, false);

  const badSni = validateCreatePayload({
    protocol: 'vmess',
    serverId: 'vmess-sg-1',
    username: 'tomyvip',
    sni: 'https://evil.com/path',
  });
  assert.equal(badSni.ok, false);

  const good = validateCreatePayload({
    protocol: 'ssh-ws',
    serverId: 'sshocean-sg1',
    username: 'tomyvip01',
    password: 'SecretPassword123',
    sni: 'm.zoom.us',
    durationDays: 30,
  });
  assert.equal(good.ok, true);
  assert.equal(good.clean.durationDays, 30);
});

test('v95 SSH & VPN Studio: Parsers accurately extract VPNGate, V2Ray/Xray, SSHOcean, SSHMax, FreeVPN & JagoVPN live servers', () => {
  // VPNGate CSV
  const fakeOvpn = Buffer.from('client\ndev tun\nproto tcp\nremote 203.0.113.10 443\n' + 'x'.repeat(120)).toString('base64');
  const csv = [
    '*vpn_servers',
    '#HostName,IP,Score,Ping,Speed,CountryLong,CountryShort,NumVpnSessions,Uptime,TotalUsers,TotalTraffic,LogType,Operator,Message,OpenVPN_ConfigData_Base64',
    `public-vpn-10,203.0.113.10,99999,18,450000000,Japan,JP,42,36000000,1500,999999,2weeks,University Lab,,${fakeOvpn}`,
  ].join('\n');
  const vg = parseVpnGateCsv(csv, 10);
  assert.equal(vg.servers.length, 1);
  assert.equal(vg.servers[0].countryCode, 'JP');
  assert.equal(vg.servers[0].pingMs, 18);
  assert.equal(vg.servers[0].speedMbps, 450);
  assert.equal(vg.servers[0].provisioningMode, 'instant');
  assert.ok(vg.ovpnMap.get(vg.servers[0].id));

  // V2Ray VMess + VLess + Trojan + Shadowsocks
  const vmessObj = { v: '2', ps: '🇸🇬 SG VIP Node', add: 'sg.example.net', port: '443', id: '5c040f1d-45db-43bd-8d46-e4950e433735', net: 'ws', tls: 'tls', path: '/vmess', sni: 'sg.example.net' };
  const vmessParsed = parseProxyConfigLine(`vmess://${Buffer.from(JSON.stringify(vmessObj)).toString('base64')}`, 'TestAPI');
  assert.equal(vmessParsed?.server.protocol, 'vmess');
  assert.equal(vmessParsed?.server.countryCode, 'SG');
  assert.equal(vmessParsed?.server.provisioningMode, 'instant');

  const vlessParsed = parseProxyConfigLine(
    'vless://11111111-2222-3333-4444-555555555555@id.example.net:443?type=ws&security=tls&sni=id.example.net&path=%2Fvless#%F0%9F%87%AE%F0%9F%87%A9+ID+VIP',
    'TestAPI'
  );
  assert.equal(vlessParsed?.server.protocol, 'vless');
  assert.equal(vlessParsed?.server.countryCode, 'ID');

  const trojanParsed = parseProxyConfigLine('trojan://mysecret@jp.example.net:443?security=tls&type=grpc#JP-Trojan', 'TestAPI');
  assert.equal(trojanParsed?.server.protocol, 'trojan');
  assert.equal(trojanParsed?.server.countryCode, 'JP');

  // SSHOcean HTML table
  const oceanHtml = `<table><tr><td>SSH WS SG1 sg1.sshweb.site <a href="/sshws/singapore/sg1">Create</a> Online ✓ 28ms 2 minutes ago 47 slots</td></tr></table>`;
  const ocean = parseSshOceanStatusHtml(oceanHtml, 10);
  assert.equal(ocean.length, 1);
  assert.equal(ocean[0].protocol, 'ssh-ws');
  assert.equal(ocean[0].remainingSlots, 47);
  assert.equal(ocean[0].pingMs, 28);
  assert.equal(ocean[0].countryCode, 'SG');

  // FreeVPN HTML table (data-host attribute on <tr>)
  const freeVpnHtml = `<table><tr data-type="openvpn" data-host="ovpn-id-1.vpnv.cc"><td>1 <a href="/openvpn/id/server-62/">OpenVPN ID 1</a> Indonesia, Bandung 12% 540.88 G 24.5 Mb/s Online</td></tr><tr data-type="ssh-tunnel"><td>2 <a href="/ssh/us/server-1/">Missing Host</a> Online</td></tr></table>`;
  const fv = parseFreeVpnStatusHtml(freeVpnHtml, 10);
  assert.equal(fv.length, 1);
  assert.equal(fv[0].host, 'ovpn-id-1.vpnv.cc');
  assert.equal(fv[0].countryCode, 'ID');
  assert.equal(fv[0].remainingSlots, 88);

  // SSHMax HTML card: extracts REAL font-mono host, real ping & remaining slots, skips Offline or missing-host cards
  const sshMaxHtml = `
    <a href="https://sshmax.net/ssh-websocket/singapore/sg1">
      <div><span>SSH WebSocket SG1</span><div class="text-xs font-mono"> sg1.comnpmjs.com </div></div>
    </a><span>Online</span><span>Response 12ms</span><span>Remaining 5 / 25</span>
    <a href="https://sshmax.net/ssh-websocket/france/fr9">
      <div><span>SSH WebSocket FR9</span><div class="text-xs font-mono"> fr9.comnpmjs.com </div></div>
    </a><span>Offline</span>
    <a href="https://sshmax.net/ssh-websocket/germany/de9">No real host</a>
  `;
  const sshMax = parseSshMaxStatusHtml(sshMaxHtml, 10);
  assert.equal(sshMax.length, 1);
  assert.equal(sshMax[0].protocol, 'ssh-ws');
  assert.equal(sshMax[0].host, 'sg1.comnpmjs.com');
  assert.equal(sshMax[0].pingMs, 12);
  assert.equal(sshMax[0].remainingSlots, 5);
  assert.equal(sshMax[0].maxSlots, 25);
  assert.equal(sshMax[0].usernamePrefix, 'sshmax-');
  assert.equal(sshMax[0].wildcardDomain, '*.sg1.comnpmjs.com');

  // JagoVPN: never fabricates *.jagovpn.com; requires real resolved host
  const jagoHtml = '<table><tr><td><a href="https://jagovpn.com/v2ray-vmess/indonesia/26">ID1 Vmess</a> Online 2 days ago</td></tr></table>';
  assert.equal(parseJagoVpnStatusHtml(jagoHtml, 10).length, 0);
  const extractedJagoHost = extractJagoVpnRealHostFromPage('<div>Server Host: id1vpn.jagoanip.my.id</div>');
  assert.equal(extractedJagoHost, 'id1vpn.jagoanip.my.id');
  const jagoMap = new Map([['https://jagovpn.com/v2ray-vmess/indonesia/26', extractedJagoHost]]);
  const jago = parseJagoVpnStatusHtml(jagoHtml, 10, jagoMap);
  assert.equal(jago.length, 1);
  assert.equal(jago[0].host, 'id1vpn.jagoanip.my.id');
  assert.equal(jago[0].countryCode, 'ID');

  // Portal SSH preparation: accurate usernamePrefix & valid HTTP Injector CONNECT [host_port] payload
  const prep = createPortalSshPreparation(sshMax[0], { username: 'bakso', password: 'tahu', sni: '', durationDays: 7 });
  assert.equal(prep.account.host, 'sg1.comnpmjs.com');
  assert.equal(prep.account.username, 'sshmax-bakso');
  assert.equal(prep.account.portalInputUsername, 'bakso');
  assert.match(prep.account.extraDetails['Payload HTTP Injector (Mode Proxy)'], /CONNECT \[host_port\]/);
  assert.match(prep.portalMessage, /BELUM AKTIF/);
});

test('v95 SSH & VPN Studio: Pure UI logic handles filtering, slot health, validation, expiry, and history persistence', () => {
  assert.ok(SSHVPN_PROTOCOLS.length >= 10);
  assert.ok(DURATION_OPTIONS.some((d) => d.days === 30));
  assert.equal(protocolRequiresPassword('ssh-ws'), true);
  assert.equal(protocolRequiresPassword('wireguard'), false);

  const creds = generateRandomCredentials('tomy');
  assert.match(creds.username, /^tomy[a-z0-9]{5}$/);
  assert.ok(creds.password.length >= 8);

  const servers = [
    { id: '1', name: 'WARP SG', protocol: 'wireguard', country: 'Singapore', countryCode: 'SG', flag: '🇸🇬', host: 'engage.cloudflareclient.com', pingMs: 18, speedMbps: 1000, remainingSlots: 999, maxSlots: 999, provisioningMode: 'instant' },
    { id: '2', name: 'SSH WS ID', protocol: 'ssh-ws', country: 'Indonesia', countryCode: 'ID', flag: '🇮🇩', host: 'id1.sshweb.site', pingMs: 24, speedMbps: 500, remainingSlots: 8, maxSlots: 50, provisioningMode: 'portal' },
    { id: '3', name: 'VMess JP', protocol: 'vmess', country: 'Japan', countryCode: 'JP', flag: '🇯🇵', host: 'jp.node.net', pingMs: 45, speedMbps: 600, remainingSlots: 95, maxSlots: 100, provisioningMode: 'instant' },
  ];

  const countries = extractAvailableCountries(servers);
  assert.equal(countries[0].code, 'ID');
  assert.equal(countries[1].code, 'SG');

  const instantList = filterAndSortServers(servers, { instantOnly: true, sortBy: 'ping' });
  assert.equal(instantList.length, 2);
  assert.equal(instantList[0].id, '1');

  const sshList = filterAndSortServers(servers, { protocol: 'ssh-ws' });
  assert.equal(sshList.length, 1);
  assert.equal(sshList[0].id, '2');

  assert.equal(computeSlotHealth(servers[0]).status, 'unlimited');
  assert.equal(computeSlotHealth(servers[1]).status, 'low');
  assert.equal(computeSlotHealth(servers[2]).status, 'available');

  const formOk = validateSshVpnForm({ server: servers[0], username: 'tomyvip', password: '', sni: '', durationDays: 30 });
  assert.equal(formOk.ok, true);

  assert.equal(sanitizeExternalPortalUrl('https://sshocean.com/sshws/singapore/sg1'), 'https://sshocean.com/sshws/singapore/sg1');
  assert.equal(sanitizeExternalPortalUrl('javascript:alert(1)'), '');

  // Expiry & History persistence
  const now = Date.parse('2026-11-26T00:00:00Z');
  const activeExp = computeAccountExpiry('2026-12-03T05:00:00Z', now);
  assert.equal(activeExp.expired, false);
  assert.match(activeExp.label, /Sisa 7 hari 5 jam/);

  const expiredExp = computeAccountExpiry('2026-11-25T00:00:00Z', now);
  assert.equal(expiredExp.expired, true);

  const mem = createMemoryStorage();
  const sampleAcc = {
    id: 'acc-1',
    protocol: 'wireguard',
    protocolLabel: 'WireGuard VIP',
    username: 'tomyvip',
    host: 'engage.cloudflareclient.com',
    port: 2408,
    country: 'Singapore',
    durationDays: 30,
    configUri: 'wireguard://test',
    expiresAt: '2026-12-26T00:00:00Z',
  };
  addAccountToHistory(sampleAcc, mem);
  assert.equal(loadSshVpnHistory(mem).length, 1);
  assert.match(buildCopyableSummary(sampleAcc), /tomyvip/);

  removeAccountFromHistory('acc-1', mem);
  assert.equal(loadSshVpnHistory(mem).length, 0);

  addAccountToHistory(sampleAcc, mem);
  clearSshVpnHistory(mem);
  assert.equal(loadSshVpnHistory(mem).length, 0);
});
