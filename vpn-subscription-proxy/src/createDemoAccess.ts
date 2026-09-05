import {randomBytes, randomUUID} from 'node:crypto';

import type {ProxyConfig} from './config.js';
import type {DemoCooldownStore} from './demoCooldownStore.js';
import {getMoscowRequestDate} from './time.js';
import type {VpnPanelClient} from './vpnPanelClient.js';

export type CreateDemoRequest = Readonly<{
  clientIp: string;
  deviceId: string;
}>;

export type CreateDemoResult = Readonly<{
  demoSubURL: string;
}>;

const DEMO_VOLUME_BYTES = 2 * 1024 * 1024 * 1024;
const DEMO_DURATION_MS = 3 * 24 * 60 * 60 * 1000;
const NAME_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

const createRandomSuffix = (): string => {
  let suffix = '';
  while (suffix.length < 5) {
    for (const byte of randomBytes(8)) {
      // 252 is divisible by 36, so modulo selection stays unbiased.
      if (byte < 252) {
        suffix += NAME_ALPHABET[byte % NAME_ALPHABET.length];
        if (suffix.length === 5) {
          return suffix;
        }
      }
    }
  }
  return suffix;
};

const createDemoName = (now: Date): string => `MpeiApp-demo-${getMoscowRequestDate(now)}-${createRandomSuffix()}`;

const createSubscriptionUrl = (
  hostname: string,
  port: number,
  pathPrefix: string,
  clientName: string,
): string => {
  const endpoint = `${pathPrefix}/${encodeURIComponent(clientName)}`;
  const url = new URL(`https://${hostname}`);
  if (port !== 443) {
    url.port = String(port);
  }
  url.pathname = endpoint;
  return url.toString();
};

const createPanelClientData = (
  config: ProxyConfig,
  clientName: string,
  now: Date,
): Readonly<Record<string, unknown>> => {
  const password = randomBytes(24).toString('base64url');
  const uuid = randomUUID();
  const named = <T extends Record<string, string>>(identity: T): T & {name: string} => ({...identity, name: clientName});
  return {
    enable: true,
    name: clientName,
    group: "Dragon's clients",
    inbounds: config.demoInbounds,
    links: [],
    config: {
      trojan: named({password}),
      anytls: named({password}),
      hysteria2: named({password}),
      tuic: named({password, uuid}),
      vless: named({uuid, flow: config.demoVlessFlow}),
    },
    volume: DEMO_VOLUME_BYTES,
    expiry: Math.floor((now.getTime() + DEMO_DURATION_MS) / 1000),
    down: 0,
    up: 0,
    totalUp: 0,
    totalDown: 0,
    desc: 'demo access via MpeiApp',
    delayStart: false,
    autoReset: true,
    resetDays: 1,
  };
};

export class CreateDemoAccessService {
  public constructor(
    private readonly config: ProxyConfig,
    private readonly hostname: string,
    private readonly panelClient: VpnPanelClient,
    private readonly cooldownStore: DemoCooldownStore,
  ) {}

  public async create(request: CreateDemoRequest, now = new Date()): Promise<CreateDemoResult | undefined> {
    const reservation = this.cooldownStore.reserve(request.clientIp, request.deviceId, now);
    if (!reservation) {
      return undefined;
    }

    const clientName = createDemoName(now);
    let created: boolean;
    try {
      created = await this.panelClient.createClient(createPanelClientData(this.config, clientName, now));
    } catch {
      // An unknown panel result deliberately keeps the reservation in SQLite.
      return undefined;
    }

    if (!created) {
      this.cooldownStore.releaseKnownFailure(reservation);
      return undefined;
    }

    try {
      this.cooldownStore.markIssued(reservation, now);
    } catch {
      // Do not return a link if local issuance could not be committed.
      return undefined;
    }

    return {
      demoSubURL: createSubscriptionUrl(
        this.hostname,
        this.config.subscriptionPort,
        this.config.subscriptionPathPrefix,
        clientName,
      ),
    };
  }
}

export const demoConstants = Object.freeze({
  volumeBytes: DEMO_VOLUME_BYTES,
  durationMs: DEMO_DURATION_MS,
});
