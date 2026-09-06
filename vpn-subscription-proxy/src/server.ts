import {createSecureContext} from 'node:tls';
import {pathToFileURL} from 'node:url';

import Fastify, {type FastifyInstance, type FastifyReply, type FastifyRequest} from 'fastify';

import {loadConfig, type ProxyConfig} from './config.js';
import {CreateDemoAccessService} from './createDemoAccess.js';
import {DemoCooldownStore} from './demoCooldownStore.js';
import {RequestRateLimiter, parseRequestGate, type RequestGateContext} from './requestGate.js';
import {RuntimeStats} from './runtimeStats.js';
import {failedResponse, proxyRequestSchema} from './schema.js';
import {discoverStartupTls, type StartupTlsMaterial} from './startupDiscovery.js';
import {VerifySubscriptionService} from './verifySubscription.js';
import {VpnPanelClient} from './vpnPanelClient.js';

const serviceStartedAt = Date.now();

declare module 'fastify' {
  interface FastifyRequest {
    dragonetGate?: RequestGateContext;
  }
}

type ProxyServer = Readonly<{
  app: FastifyInstance;
  cooldownStore: DemoCooldownStore;
}>;

const closeWithoutResponse = (request: FastifyRequest, reply: FastifyReply): void => {
  reply.hijack();
  request.raw.socket.destroy();
};

const isLoopback = (remoteAddress: string | undefined): boolean => (
  remoteAddress === '127.0.0.1'
  || remoteAddress === '::1'
  || remoteAddress === '::ffff:127.0.0.1'
);

const hostMatches = (header: string | string[] | undefined, expectedHostname: string): boolean => {
  if (typeof header !== 'string' || header.length === 0 || header.includes(',')) {
    return false;
  }
  try {
    const url = new URL(`https://${header}`);
    return (
      url.hostname.toLowerCase() === expectedHostname
      && url.pathname === '/'
      && !url.username
      && !url.password
      && !url.search
      && !url.hash
    );
  } catch {
    return false;
  }
};

const sniMatches = (request: FastifyRequest, expectedHostname: string): boolean => {
  const servername = (request.raw.socket as {servername?: string}).servername;
  return typeof servername === 'string' && servername.toLowerCase() === expectedHostname;
};

const sendFailed = (reply: FastifyReply, runtimeStats: RuntimeStats) => {
  runtimeStats.recordFailedRequest();
  return reply.code(200).send(failedResponse);
};

export const createProxyServer = (config: ProxyConfig, tls: StartupTlsMaterial): ProxyServer => {
  const secureContext = createSecureContext({
    key: tls.privateKeyPem,
    cert: tls.certificatePem,
    minVersion: 'TLSv1.2',
  });
  const app = Fastify({
    https: {
      key: tls.privateKeyPem,
      cert: tls.certificatePem,
      minVersion: 'TLSv1.2',
      SNICallback: (servername, callback) => {
        if (servername.toLowerCase() === tls.hostname) {
          callback(null, secureContext);
          return;
        }
        callback(new Error('Unrecognized TLS server name'));
      },
    },
    bodyLimit: config.maxRequestBodyBytes,
    logger: false,
    trustProxy: false,
  });
  const panelClient = new VpnPanelClient(config.panelBaseUrl, config.panelToken, config.requestTimeoutMs);
  const cooldownStore = new DemoCooldownStore(`${config.stateDirectory}/demo-cooldowns.sqlite`, config.cooldownHmacKey);
  const verificationService = new VerifySubscriptionService(
    panelClient,
    config.cooldownHmacKey,
    config.verifyCacheTtlMs,
  );
  const demoService = new CreateDemoAccessService(config, tls.hostname, panelClient, cooldownStore);
  const rateLimiter = new RequestRateLimiter(
    config.cooldownHmacKey,
    config.rateLimitMax,
    config.rateLimitWindowMs,
  );
  const runtimeStats = new RuntimeStats(serviceStartedAt);

  app.addHook('onRequest', (request, reply, done) => {
    const requestUrl = request.raw.url ?? '';
    const remoteAddress = request.raw.socket.remoteAddress;
    if (request.method === 'GET' && (requestUrl === '/healthz' || requestUrl === '/stats')) {
      if (!isLoopback(remoteAddress)) {
        closeWithoutResponse(request, reply);
      }
      done();
      return;
    }

    if (request.method !== 'POST' || requestUrl !== config.requestPath) {
      closeWithoutResponse(request, reply);
      done();
      return;
    }

    if (!hostMatches(request.headers.host, tls.hostname) || !sniMatches(request, tls.hostname)) {
      closeWithoutResponse(request, reply);
      done();
      return;
    }

    const gate = parseRequestGate({
      requestId: request.headers['mpei-app-req-id'],
      remoteAddress,
      forwardedFor: request.headers['x-forwarded-for'],
      trustedReverseProxyIps: config.trustedReverseProxyIps,
    });
    if (!gate) {
      closeWithoutResponse(request, reply);
      done();
      return;
    }

    request.dragonetGate = gate;
    done();
  });

  app.get('/healthz', async () => ({status: 'ok'}));
  app.get('/stats', async () => runtimeStats.snapshot());

  app.post(config.requestPath, async (request, reply) => {
    const gate = request.dragonetGate;
    const parsed = proxyRequestSchema.safeParse(request.body);
    if (!gate || !parsed.success || !rateLimiter.tryConsume(gate.clientIp)) {
      return sendFailed(reply, runtimeStats);
    }

    try {
      if (parsed.data.purpose === 'verify') {
        const verification = await verificationService.verify(parsed.data.clientName);
        runtimeStats.recordSuccessfulVerify();
        return reply.code(200).send({
          reqStatus: 'success',
          isClientFound: verification.isClientFound,
          isClientActive: verification.isClientActive,
        });
      }

      const demo = await demoService.create({clientIp: gate.clientIp, deviceId: gate.deviceId});
      if (!demo) {
        return sendFailed(reply, runtimeStats);
      }
      runtimeStats.recordSuccessfulDemo();
      return reply.code(200).send({reqStatus: 'success', demoSubURL: demo.demoSubURL});
    } catch {
      return sendFailed(reply, runtimeStats);
    }
  });

  app.setErrorHandler((_error, request, reply) => {
    if (!reply.sent) {
      if (request.dragonetGate) {
        sendFailed(reply, runtimeStats);
        return;
      }
      reply.code(200).send(failedResponse);
    }
  });

  return {app, cooldownStore};
};

const start = async (): Promise<void> => {
  const config = loadConfig();
  const tls = await discoverStartupTls();
  const {app, cooldownStore} = createProxyServer(config, tls);
  let closing = false;
  const close = async (): Promise<void> => {
    if (closing) {
      return;
    }
    closing = true;
    await app.close();
    cooldownStore.close();
  };
  process.once('SIGINT', () => { void close(); });
  process.once('SIGTERM', () => { void close(); });

  await app.listen({host: config.listenHost, port: config.listenPort});
};

const launchedFromCommandLine = process.argv[1] !== undefined
  && pathToFileURL(process.argv[1]).href === import.meta.url;

if (launchedFromCommandLine) {
  void start().catch(() => {
    // No path, certificate, panel, request, or environment value is logged.
    console.error('DragoNet proxy startup failed before opening its public listener.');
    process.exitCode = 1;
  });
}
