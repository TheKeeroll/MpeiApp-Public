import assert from 'node:assert/strict';
import {mkdtemp, rm} from 'node:fs/promises';
import {request as httpRequest} from 'node:http';
import {tmpdir} from 'node:os';
import path from 'node:path';
import test from 'node:test';
import Fastify from 'fastify';
import type {ProxyConfig} from '../src/config.js';
import {CreateDemoAccessService} from '../src/createDemoAccess.js';
import {DemoCooldownStore} from '../src/demoCooldownStore.js';
import {registerProxyApi} from '../src/httpApi.js';
import {RequestRateLimiter} from '../src/requestGate.js';
import {RuntimeStats} from '../src/runtimeStats.js';
import {getMoscowRequestDate} from '../src/time.js';
import {VerifySubscriptionService} from '../src/verifySubscription.js';
import {VpnPanelClient} from '../src/vpnPanelClient.js';

const createHarness = async (options: {
  panelResponse?: (data: Record<string, unknown>) => Response | Promise<Response>;
  rateLimitMax?: number;
  onAudit?: (record: Readonly<Record<string, unknown>>) => void;
} = {}) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'dragonet-http-'));
  const config: ProxyConfig = {
    listenHost: '127.0.0.1', listenPort: 8443, requestPath: '/api/v1/subscription',
    panelBaseUrl: 'https://panel.example.com/private', panelToken: 'private-panel-token',
    demoInbounds: [12], subscriptionPort: 443, subscriptionPathPrefix: '/sub',
    cooldownHmacKey: 'private-test-hmac-key-not-for-production', stateDirectory: directory,
    requestTimeoutMs: 1000, rateLimitMax: options.rateLimitMax ?? 30, rateLimitWindowMs: 60000,
    verifyCacheTtlMs: 1000, maxRequestBodyBytes: 1024, trustedReverseProxyIps: [], demoVlessFlow: 'xtls-rprx-vision',
  };
  const records: Readonly<Record<string, unknown>>[] = [];
  const panelData: Record<string, unknown>[] = [];
  const panel = new VpnPanelClient(config.panelBaseUrl, config.panelToken, 1000, async (url, init) => {
    if (String(url).endsWith('/clients')) return Response.json({success: true, obj: [{name: 'private-client-name', enable: true}]});
    const data = JSON.parse((init!.body as URLSearchParams).get('data')!) as Record<string, unknown>;
    panelData.push(data);
    return options.panelResponse?.(data) ?? Response.json({success: true});
  });
  const store = new DemoCooldownStore(path.join(directory, 'cooldowns.sqlite'), config.cooldownHmacKey);
  const app = Fastify({bodyLimit: config.maxRequestBodyBytes, logger: false});
  // Only the test transport supplies TLS metadata; production uses a real TLS socket.
  app.addHook('onRequest', (request, _reply, done) => {
    (request.raw.socket as {servername?: string}).servername = String(request.headers['x-test-sni'] ?? 'proxy.example.com');
    done();
  });
  registerProxyApi(app, config, 'proxy.example.com', {
    verificationService: new VerifySubscriptionService(panel, config.cooldownHmacKey, 1000),
    demoService: new CreateDemoAccessService(config, 'proxy.example.com', panel, store),
    rateLimiter: new RequestRateLimiter(config.cooldownHmacKey, config.rateLimitMax, config.rateLimitWindowMs),
    runtimeStats: new RuntimeStats(Date.now()), audit: record => { records.push(record); options.onAudit?.(record); },
  });
  const headers = {host: 'proxy.example.com:8443', 'mpei-app-req-id': `DragoNet-${getMoscowRequestDate()}-private-device`};
  const post = (payload: Record<string, unknown>) => app.inject({method: 'POST', url: config.requestPath, headers, payload, remoteAddress: '198.51.100.8'});
  const cleanup = async () => {
    await app.close(); store.close();
    assert.equal(path.dirname(directory), path.resolve(tmpdir()));
    assert.ok(path.basename(directory).startsWith('dragonet-http-'));
    await rm(directory, {recursive: true, force: true});
  };
  return {app, config, headers, post, records, panelData, cleanup};
};

test('HTTP contract stays compatible with 2.5.0, with an additive reason and one terminal audit per admitted request', async () => {
  const h = await createHarness();
  try {
    const verify = await h.post({purpose: 'verify', clientName: 'private-client-name'});
    assert.equal(verify.statusCode, 200);
    assert.deepEqual(verify.json(), {reqStatus: 'success', isClientFound: true, isClientActive: true});
    const demo = await h.post({purpose: 'demo'});
    assert.equal(demo.statusCode, 200);
    assert.deepEqual(Object.keys(demo.json()), ['reqStatus', 'demoSubURL']);
    assert.equal(demo.json().reqStatus, 'success');
    const repeat = await h.post({purpose: 'demo'});
    assert.equal(repeat.statusCode, 200);
    assert.deepEqual(repeat.json(), {reqStatus: 'failed', reason: 'demo_cooldown'});
    assert.equal(h.records.filter(row => row.event === 'request_received').length, 3);
    const results = h.records.filter(row => row.event === 'request_completed');
    assert.deepEqual(results.map(row => row.outcome), ['accepted', 'accepted', 'rejected']);
    assert.equal(new Set(results.map(row => row.requestId)).size, 3);
    assert.ok(results.every(row => typeof row.ipHash === 'string' && typeof row.deviceHash === 'string'));
    const audit = JSON.stringify(h.records);
    for (const secret of ['private-client-name', 'private-device', '198.51.100.8', h.config.panelToken, String(h.panelData[0]!.name), demo.json().demoSubURL]) {
      assert.equal(audit.includes(secret), false);
    }
    const stats = await h.app.inject({url: '/stats', remoteAddress: '127.0.0.1'});
    assert.equal(stats.json().successfulDemoRequests, 1);
    assert.equal(stats.json().failedRequests, 1);
  } finally { await h.cleanup(); }
});

test('a client disconnect has one terminal audit even when the panel completes a creation afterwards', {timeout: 5000}, async () => {
  let beginPanel!: () => void;
  const began = new Promise<void>(resolve => {beginPanel = resolve;});
  let finishPanel!: (response: Response) => void;
  let completeRequest!: () => void;
  let createdDemo!: () => void;
  const completed = new Promise<void>(resolve => {completeRequest = resolve;});
  const created = new Promise<void>(resolve => {createdDemo = resolve;});
  const h = await createHarness({
    panelResponse: () => {beginPanel(); return new Promise<Response>(resolve => {finishPanel = resolve;});},
    onAudit: record => {
      if (record.event === 'request_completed') completeRequest();
      if (record.event === 'demo_created') createdDemo();
    },
  });
  try {
    await h.app.listen({host: '127.0.0.1', port: 0});
    const address = h.app.server.address();
    assert.ok(address && typeof address !== 'string');
    const request = httpRequest({hostname: '127.0.0.1', port: address.port, method: 'POST', path: h.config.requestPath,
      headers: {...h.headers, 'content-type': 'application/json'}});
    request.on('error', () => {});
    request.end(JSON.stringify({purpose: 'demo'}));
    await began;
    request.destroy();
    await completed;
    assert.equal(h.records.filter(row => row.event === 'request_completed')[0]!.reason, 'client_disconnected');
    finishPanel(Response.json({success: true}));
    await created;
    assert.equal(h.records.filter(row => row.event === 'request_completed').length, 1);
  } finally { await h.cleanup(); }
});

test('network, malformed JSON and missing success flags retain uncertainty and produce detailed demo diagnostics', async () => {
  for (const item of [
    {category: 'panel_network_error', respond: () => { throw Object.assign(new Error('private-panel-token'), {cause: {code: 'ECONNRESET'}}); }},
    {category: 'panel_timeout', respond: () => { throw new DOMException('private-panel-token', 'TimeoutError'); }},
    {category: 'panel_invalid_json', respond: () => new Response('private-panel-token: not JSON')},
    {category: 'panel_timeout', respond: () => {
      const response = Response.json({success: true});
      Object.defineProperty(response, 'json', {value: async () => { throw new DOMException('private-panel-token', 'TimeoutError'); }});
      return response;
    }},
    {category: 'panel_invalid_response', respond: () => Response.json({message: 'no explicit success flag'})},
  ]) {
    const h = await createHarness({panelResponse: item.respond});
    try {
      assert.deepEqual((await h.post({purpose: 'demo'})).json(), {reqStatus: 'failed', reason: 'service_error'});
      const failure = h.records.find(row => row.event === 'demo_failed')!;
      assert.equal(failure.category, item.category);
      assert.equal(failure.stage, 'panel_create');
      assert.equal(failure.reservationRetained, true);
      if (item.category === 'panel_network_error') assert.equal(failure.code, 'ECONNRESET');
      assert.equal(JSON.stringify(h.records).includes('private-panel-token'), false);
      assert.deepEqual((await h.post({purpose: 'demo'})).json(), {reqStatus: 'failed', reason: 'service_error'});
      assert.equal(h.panelData.length, 1);
    } finally { await h.cleanup(); }
  }
});

test('known panel rejection logs the sanitized panel message and releases the reservation', async () => {
  let calls = 0;
  const rejectedSecrets: string[] = [];
  const h = await createHarness({panelResponse: data => {
    const protocols = data.config as Record<string, Record<string, string>>;
    if (++calls === 1) {
      rejectedSecrets.push(protocols.naive!.password!, protocols.snell!.userkey!,
        protocols.shadowsocks!.password!, protocols.shadowsocks16!.password!,
        protocols.hysteria!.auth_str!, protocols.vmess!.uuid!);
      return Response.json({success: false, msg: `Rejected ${data.name}; ${rejectedSecrets.join('; ')}; private-panel-token\nhttps://secret.example/token`});
    }
    return Response.json({success: true});
  }});
  try {
    assert.deepEqual((await h.post({purpose: 'demo'})).json(), {reqStatus: 'failed', reason: 'service_error'});
    const failure = h.records.find(row => row.event === 'demo_failed')!;
    assert.equal(failure.category, 'panel_rejected');
    assert.equal(failure.stage, 'panel_create');
    assert.equal(failure.httpStatus, 200);
    assert.equal(failure.reservationRetained, false);
    assert.match(String(failure.panelMessage), /Rejected \[redacted\]/u);
    assert.doesNotMatch(JSON.stringify(h.records), /private-panel-token|secret\.example|MpeiApp-demo-/u);
    for (const secret of rejectedSecrets) {
      assert.ok(secret);
      assert.equal(JSON.stringify(h.records).includes(secret), false);
    }
    assert.equal((await h.post({purpose: 'demo'})).json().reqStatus, 'success');
  } finally { await h.cleanup(); }
});

test('HTTP errors and uncertain pending creations are technical failures, never reported as a demo cooldown', async () => {
  const h = await createHarness({panelResponse: () => Response.json({success: true}, {status: 503})});
  try {
    for (let i = 0; i < 2; i++) {
      assert.deepEqual((await h.post({purpose: 'demo'})).json(), {reqStatus: 'failed', reason: 'service_error'});
    }
    assert.equal(h.panelData.length, 1);
    const failures = h.records.filter(row => row.event === 'demo_failed');
    assert.equal(failures[0]!.category, 'panel_http_error');
    assert.equal(failures[0]!.httpStatus, 503);
    assert.equal(failures[0]!.reservationRetained, true);
    assert.equal(failures[1]!.category, 'reservation_pending');
  } finally { await h.cleanup(); }
});

test('all admitted malformed bodies and rate-limit rejections receive a detailed audit', async () => {
  const h = await createHarness({rateLimitMax: 1});
  try {
    const malformed = [
      {payload: '{', contentType: 'application/json', reason: 'invalid_json'},
      {payload: JSON.stringify({purpose: 'demo', secret: 'do-not-log-this-body'}), contentType: 'application/json', reason: 'invalid_body'},
      {payload: JSON.stringify({purpose: 'demo', padding: 'x'.repeat(2048)}), contentType: 'application/json', reason: 'body_too_large'},
      {payload: '<secret/>', contentType: 'application/xml', reason: 'unsupported_content_type'},
    ];
    for (const item of malformed) {
      const response = await h.app.inject({method: 'POST', url: h.config.requestPath, headers: {...h.headers, 'content-type': item.contentType}, payload: item.payload});
      assert.equal(response.statusCode, 200);
      assert.deepEqual(response.json(), {reqStatus: 'failed', reason: 'service_error'});
      assert.equal(h.records.filter(row => row.event === 'request_completed').at(-1)!.reason, item.reason);
    }
    await h.post({purpose: 'verify', clientName: 'private-client-name'});
    assert.deepEqual((await h.post({purpose: 'demo'})).json(), {reqStatus: 'failed', reason: 'service_error'});
    assert.equal(h.records.filter(row => row.event === 'request_completed').at(-1)!.reason, 'rate_limited');
    assert.equal(h.records.filter(row => row.event === 'request_completed').length, 6);
    assert.equal(JSON.stringify(h.records).includes('do-not-log-this-body'), false);
    assert.equal(h.panelData.length, 0);
  } finally { await h.cleanup(); }
});

test('invalid headers remain silent; admitted requests with a wrong method/path/Host/SNI are audited before socket closure', {timeout: 5000}, async () => {
  const h = await createHarness();
  try {
    await h.app.listen({host: '127.0.0.1', port: 0});
    const address = h.app.server.address();
    assert.ok(address && typeof address !== 'string');
    const expectClosed = (method: string, url: string, headers: Record<string, string>) => new Promise<void>((resolve, reject) => {
      const request = httpRequest({hostname: '127.0.0.1', port: address.port, method, path: url, headers}, response => {
        response.resume(); reject(new Error(`Unexpected HTTP ${response.statusCode}`));
      });
      request.on('error', error => {
        if ('code' in error && error.code === 'ECONNRESET') resolve(); else reject(error);
      });
      request.setTimeout(1000, () => request.destroy(new Error('Socket did not close')));
      request.end();
    });
    await expectClosed('POST', h.config.requestPath, {...h.headers, 'mpei-app-req-id': 'invalid'});
    assert.equal(h.records.length, 0);
    for (const item of [
      {method: 'GET', url: h.config.requestPath, headers: h.headers, reason: 'wrong_method'},
      {method: 'POST', url: '/wrong', headers: h.headers, reason: 'wrong_path'},
      {method: 'POST', url: h.config.requestPath, headers: {...h.headers, host: 'wrong.example'}, reason: 'host_mismatch'},
      {method: 'POST', url: h.config.requestPath, headers: {...h.headers, 'x-test-sni': 'wrong.example'}, reason: 'sni_mismatch'},
    ]) {
      await expectClosed(item.method, item.url, item.headers);
      assert.equal(h.records.filter(row => row.event === 'request_completed').at(-1)!.reason, item.reason);
    }
    assert.equal(h.records.filter(row => row.event === 'request_received').length, 4);
    assert.equal(h.records.filter(row => row.event === 'request_completed').length, 4);
  } finally { await h.cleanup(); }
});
