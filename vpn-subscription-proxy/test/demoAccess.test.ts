import assert from 'node:assert/strict';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import test from 'node:test';

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

test('demo uses the S-UI form payload, named protocol credentials, 2 GiB, three days, and cooldown', async () => {
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
    const clientConfig = sentData?.config as Record<string, Record<string, string>> | undefined;
    assert.ok(clientConfig);
    for (const protocol of ['trojan', 'anytls', 'hysteria2', 'tuic', 'vless', 'naive', 'snell']) {
      assert.equal(clientConfig[protocol]?.name, sentData?.name, `${protocol} must use the demo client's name`);
    }
    const password = clientConfig.trojan?.password;
    assert.ok(password);
    for (const protocol of ['anytls', 'hysteria2', 'tuic', 'naive']) {
      assert.equal(clientConfig[protocol]?.password, password, `${protocol} must share the demo password`);
    }
    const userkey = clientConfig.snell?.userkey;
    assert.ok(userkey);
    assert.match(userkey, /^[A-Za-z0-9]{32}$/u);
    assert.equal(clientConfig?.vless?.flow, 'xtls-rprx-vision');

    const repeat = await service.create({clientIp: '198.51.100.15', deviceId: 'Pixel-9'}, now);
    assert.ok('failure' in repeat);
    assert.equal(repeat.failure, 'demo_cooldown');
    assert.equal(panelCalls, 1);

    const next = await service.create({clientIp: '198.51.100.18', deviceId: 'Pixel-10'}, now);
    assert.ok('demoSubURL' in next);
    const nextConfig = sentData?.config as Record<string, Record<string, string>>;
    assert.match(nextConfig.snell!.userkey!, /^[A-Za-z0-9]{32}$/u);
    assert.notEqual(nextConfig.snell!.userkey, userkey);
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
