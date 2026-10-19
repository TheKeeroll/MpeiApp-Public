import {createSecureContext} from 'node:tls';
import {pathToFileURL} from 'node:url';

import Fastify, {type FastifyInstance} from 'fastify';

import {loadConfig, type ProxyConfig} from './config.js';
import {CreateDemoAccessService} from './createDemoAccess.js';
import {DemoCooldownStore} from './demoCooldownStore.js';
import {RequestRateLimiter} from './requestGate.js';
import {RuntimeStats} from './runtimeStats.js';
import {registerProxyApi} from './httpApi.js';
import {discoverStartupTls, type StartupTlsMaterial} from './startupDiscovery.js';
import {VerifySubscriptionService} from './verifySubscription.js';
import {VpnPanelClient} from './vpnPanelClient.js';

const serviceStartedAt = Date.now();

type ProxyServer = Readonly<{
  app: FastifyInstance;
  cooldownStore: DemoCooldownStore;
}>;

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

  registerProxyApi(app, config, tls.hostname, {
    verificationService, demoService, rateLimiter, runtimeStats,
  });

  return {app, cooldownStore};
};

const start = async (): Promise<void> => {
  const config = loadConfig();
  const tls = await discoverStartupTls(config.publicHostname ? {preferredHostname: config.publicHostname} : {});
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
  void start().catch((error: unknown) => {
    // Startup errors are deliberately limited to controlled configuration,
    // discovery, and socket messages; no secret values or request data appear.
    const reason = error instanceof Error ? error.message : 'Unknown startup error';
    console.error(`DragoNet proxy startup failed before opening its public listener: ${reason}`);
    process.exitCode = 1;
  });
}
