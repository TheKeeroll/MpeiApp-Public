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

test('demo uses the S-UI form payload, 2 GiB, three days, and cooldown', async () => {
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
    assert.match(result?.demoSubURL ?? '', /^https:\/\/proxy\.example\.com:2087\/sub\/MpeiApp-demo-/u);
    assert.deepEqual(Object.keys(result ?? {}), ['demoSubURL']);
    assert.doesNotMatch(JSON.stringify(result), /password|uuid/iu);
    assert.equal(sentData?.volume, demoConstants.volumeBytes);
    assert.equal(sentData?.expiry, Math.floor((now.getTime() + demoConstants.durationMs) / 1000));
    assert.equal(sentData?.group, "Dragon's clients");
    assert.deepEqual(sentData?.inbounds, [12, 13]);
    const clientConfig = sentData?.config as Record<string, Record<string, string>> | undefined;
    assert.equal(clientConfig?.vless?.flow, 'xtls-rprx-vision');

    const repeat = await service.create({clientIp: '198.51.100.15', deviceId: 'Pixel-9'}, now);
    assert.equal(repeat, undefined);
    assert.equal(panelCalls, 1);
  } finally {
    store.close();
    await rm(directory, {recursive: true, force: true});
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
    assert.equal(await service.create({clientIp: '198.51.100.16', deviceId: 'Pixel-10'}, now), undefined);
    assert.match(
      (await service.create({clientIp: '198.51.100.16', deviceId: 'Pixel-10'}, now))?.demoSubURL ?? '',
      /^https:\/\/proxy\.example\.com:2087\/sub\/MpeiApp-demo-/u,
    );
    assert.equal(panelCalls, 2);
  } finally {
    store.close();
    await rm(directory, {recursive: true, force: true});
  }
});
