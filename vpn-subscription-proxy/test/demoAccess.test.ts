import assert from 'node:assert/strict';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {z} from 'zod';

import type {ProxyConfig} from '../src/config.js';
import {CreateDemoAccessService, demoConstants} from '../src/createDemoAccess.js';
import {DemoCooldownStore} from '../src/demoCooldownStore.js';
import {VpnPanelClient} from '../src/vpnPanelClient.js';

const config: ProxyConfig = {
  listenHost: '0.0.0.0',
  listenPort: 8443,
  requestPath: '/api/v1/subscription',
  panelBaseUrl: 'https://panel.example.com/hidden',
  panelToken: 'test-token',
  demoInbounds: [12, 13],
  subscriptionPort: 2087,
  subscriptionPathPrefix: '/sub',
  cooldownHmacKey: 'a-long-test-key-that-is-never-a-production-key',
  stateDirectory: '/tmp/unused-in-test',
  requestTimeoutMs: 1000,
  rateLimitMax: 10,
  rateLimitWindowMs: 60000,
  verifyCacheTtlMs: 30000,
  maxRequestBodyBytes: 1024,
  trustedReverseProxyIps: [],
  demoVlessFlow: 'xtls-rprx-vision',
};

// Wire contract from S_UI_API_V2_1_6_5_CONTRACT.md: reject unknown credential
// fields, including the name field that previously broke Naive user decoding.
const namedPasswordSchema = z.object({name: z.string().min(1), password: z.string().min(1)}).strict();
const usernamePasswordSchema = z.object({username: z.string().min(1), password: z.string().min(1)}).strict();
const base64KeySchema = (bytes: number) => z.string().refine(value => {
  const decoded = Buffer.from(value, 'base64');
  return decoded.length === bytes && decoded.toString('base64') === value;
}, `Expected a canonical base64 key of ${bytes} bytes`);
const fullClientConfigSchema = z.object({
  mixed: usernamePasswordSchema,
  socks: usernamePasswordSchema,
  http: usernamePasswordSchema,
  shadowsocks: namedPasswordSchema.extend({password: base64KeySchema(32)}),
  shadowsocks16: namedPasswordSchema.extend({password: base64KeySchema(16)}),
  shadowtls: namedPasswordSchema.extend({password: base64KeySchema(32)}),
  vmess: z.object({name: z.string().min(1), uuid: z.string().uuid(), alterId: z.literal(0)}).strict(),
  vless: z.object({name: z.string().min(1), uuid: z.string().uuid(), flow: z.enum(['', 'xtls-rprx-vision'])}).strict(),
  anytls: namedPasswordSchema,
  trojan: namedPasswordSchema,
  naive: usernamePasswordSchema,
  hysteria: z.object({name: z.string().min(1), auth_str: z.string().min(1)}).strict(),
  snell: z.object({name: z.string().min(1), userkey: z.string().regex(/^[A-Za-z0-9]{32}$/u)}).strict(),
  tuic: z.object({name: z.string().min(1), uuid: z.string().uuid(), password: z.string().min(1)}).strict(),
  hysteria2: namedPasswordSchema,
}).strict();

test('demo sends all 15 protocol sections with S-UI 1.6.5 credentials, 2 GiB, three days, and cooldown', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'dragonet-demo-'));
  const databasePath = path.join(directory, 'cooldowns.sqlite');
  let sentData: Record<string, unknown> | undefined;
  let panelCalls = 0;
  const fetchMock: typeof fetch = async (_input, init) => {
    panelCalls += 1;
    assert.equal(init?.method, 'POST');
    assert.equal(init?.headers instanceof Object, true);
    const body = init?.body;
    assert.ok(body instanceof URLSearchParams);
    assert.equal(body.get('object'), 'clients');
    assert.equal(body.get('action'), 'new');
    sentData = JSON.parse(body.get('data') ?? '{}') as Record<string, unknown>;
    return new Response(JSON.stringify({success: true}), {status: 200});
  };
  const panel = new VpnPanelClient(config.panelBaseUrl, config.panelToken, config.requestTimeoutMs, fetchMock);
  const store = new DemoCooldownStore(databasePath, config.cooldownHmacKey);
  const service = new CreateDemoAccessService(config, 'proxy.example.com', panel, store);
  const now = new Date('2026-09-05T10:15:00.000Z');

  try {
    const result = await service.create({clientIp: '198.51.100.15', deviceId: 'Pixel-9'}, now);
    assert.ok('demoSubURL' in result);
    assert.match(result.demoSubURL, /^https:\/\/proxy\.example\.com:2087\/sub\/MpeiApp-demo-/u);
    assert.deepEqual(Object.keys(result ?? {}), ['demoSubURL']);
    assert.doesNotMatch(JSON.stringify(result), /password|uuid|userkey/iu);
    assert.equal(sentData?.volume, demoConstants.volumeBytes);
    assert.equal(sentData?.expiry, Math.floor((now.getTime() + demoConstants.durationMs) / 1000));
    assert.equal(sentData?.group, "Dragon's clients");
    assert.deepEqual(sentData?.inbounds, [12, 13]);
    const clientConfig = fullClientConfigSchema.parse(sentData?.config);
    assert.equal(Object.keys(clientConfig).length, 15);
    assert.equal(typeof sentData?.name, 'string');
    for (const [protocol, credentials] of Object.entries(clientConfig)) {
      const identity = 'username' in credentials ? credentials.username : credentials.name;
      assert.equal(identity, sentData?.name, `${protocol} must use the demo client's identity`);
    }
    assert.equal(Object.hasOwn(clientConfig.naive, 'name'), false);
    const password = clientConfig.trojan.password;
    for (const protocol of ['mixed', 'socks', 'http', 'naive', 'anytls', 'hysteria2', 'tuic'] as const) {
      assert.equal(clientConfig[protocol].password, password, `${protocol} must share the demo password`);
    }
    assert.equal(clientConfig.hysteria.auth_str, password);
    assert.equal(clientConfig.vmess.uuid, clientConfig.vless.uuid);
    assert.equal(clientConfig.tuic.uuid, clientConfig.vless.uuid);
    assert.equal(clientConfig.shadowtls.password, clientConfig.shadowsocks.password);
    assert.equal(clientConfig.vless.flow, 'xtls-rprx-vision');

    const repeat = await service.create({clientIp: '198.51.100.15', deviceId: 'Pixel-9'}, now);
    assert.ok('failure' in repeat);
    assert.equal(repeat.failure, 'demo_cooldown');
    assert.equal(panelCalls, 1);

    const next = await service.create({clientIp: '198.51.100.18', deviceId: 'Pixel-10'}, now);
    assert.ok('demoSubURL' in next);
    const nextConfig = fullClientConfigSchema.parse(sentData?.config);
    assert.notEqual(nextConfig.snell.userkey, clientConfig.snell.userkey);
    assert.notEqual(nextConfig.shadowsocks.password, clientConfig.shadowsocks.password);
    assert.notEqual(nextConfig.shadowsocks16.password, clientConfig.shadowsocks16.password);
    assert.notEqual(nextConfig.trojan.password, password);
    assert.notEqual(nextConfig.vless.uuid, clientConfig.vless.uuid);
    assert.equal(panelCalls, 2);
  } finally {
    store.close();
    await rm(directory, {recursive: true, force: true});
  }
});

test('database commit and cleanup failures are distinguishable technical creation failures', async () => {
  for (const stage of ['commit', 'release'] as const) {
    const directory = await mkdtemp(path.join(tmpdir(), 'dragonet-demo-storage-'));
    const store = new DemoCooldownStore(path.join(directory, 'cooldowns.sqlite'), config.cooldownHmacKey);
    const panel = new VpnPanelClient(config.panelBaseUrl, config.panelToken, 1000,
      async () => Response.json({success: stage === 'commit'}));
    if (stage === 'commit') store.markIssued = () => { throw Object.assign(new Error('private filesystem path'), {code: 'SQLITE_IOERR'}); };
    else store.releaseKnownFailure = () => { throw Object.assign(new Error('private filesystem path'), {code: 'SQLITE_IOERR'}); };
    try {
      const result = await new CreateDemoAccessService(config, 'proxy.example.com', panel, store)
        .create({clientIp: '198.51.100.17', deviceId: 'device'});
      assert.ok('failure' in result);
      assert.equal(result.failure, 'service_error');
      assert.equal(result.details.stage, stage);
      assert.equal(result.details.category, 'storage_error');
      assert.equal(result.details.code, 'SQLITE_IOERR');
      assert.equal(result.details.reservationRetained, true);
      assert.equal(JSON.stringify(result).includes('private filesystem path'), false);
    } finally { store.close(); await rm(directory, {recursive: true, force: true}); }
  }
});

test('a known S-UI rejection releases only its reservation for a retry', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'dragonet-demo-retry-'));
  const databasePath = path.join(directory, 'cooldowns.sqlite');
  let panelCalls = 0;
  const panel = new VpnPanelClient(
    config.panelBaseUrl,
    config.panelToken,
    config.requestTimeoutMs,
    async () => {
      panelCalls += 1;
      return new Response(JSON.stringify({success: panelCalls > 1}));
    },
  );
  const store = new DemoCooldownStore(databasePath, config.cooldownHmacKey);
  const service = new CreateDemoAccessService(config, 'proxy.example.com', panel, store);
  const now = new Date('2026-09-05T10:15:00.000Z');

  try {
    const failure = await service.create({clientIp: '198.51.100.16', deviceId: 'Pixel-10'}, now);
    assert.ok('failure' in failure);
    assert.equal(failure.failure, 'service_error');
    const retry = await service.create({clientIp: '198.51.100.16', deviceId: 'Pixel-10'}, now);
    assert.ok('demoSubURL' in retry);
    assert.match(
      retry.demoSubURL,
      /^https:\/\/proxy\.example\.com:2087\/sub\/MpeiApp-demo-/u,
    );
    assert.equal(panelCalls, 2);
  } finally {
    store.close();
    await rm(directory, {recursive: true, force: true});
  }
});
