import {hmacIdentity} from './requestGate.js';
import type {PanelApiResponse, VpnPanelClient} from './vpnPanelClient.js';

export type VerifySubscriptionResult = Readonly<{
  isClientFound: boolean;
  isClientActive: boolean;
}>;

type PanelClient = Readonly<{
  name: string;
  enable: boolean;
}>;

type CachedVerification = Readonly<{
  expiresAt: number;
  result: VerifySubscriptionResult;
}>;

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const extractClients = (response: PanelApiResponse): readonly PanelClient[] | undefined => {
  if (response.success !== true) {
    return undefined;
  }
  const source = isRecord(response.obj) ? response.obj.clients : response.obj;
  if (!Array.isArray(source)) {
    return undefined;
  }
  return source.flatMap(value => {
    if (!isRecord(value) || typeof value.name !== 'string' || typeof value.enable !== 'boolean') {
      return [];
    }
    return [{name: value.name, enable: value.enable}];
  });
};

/** Keeps only an HMAC of the requested name in memory. */
export class VerifySubscriptionService {
  private readonly cache = new Map<string, CachedVerification>();

  public constructor(
    private readonly panelClient: VpnPanelClient,
    private readonly hmacKey: string,
    private readonly cacheTtlMs: number,
  ) {}

  public async verify(clientName: string, now = Date.now()): Promise<VerifySubscriptionResult> {
    const cacheKey = hmacIdentity(this.hmacKey, 'verify-name', clientName);
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.result;
    }

    const clients = extractClients(await this.panelClient.getClients());
    if (!clients) {
      throw new Error('Panel client list is unavailable');
    }

    const client = clients.find(candidate => candidate.name === clientName);
    const result: VerifySubscriptionResult = client
      ? {isClientFound: true, isClientActive: client.enable === true}
      : {isClientFound: false, isClientActive: false};
    this.cache.set(cacheKey, {expiresAt: now + this.cacheTtlMs, result});
    this.removeExpiredEntries(now);
    return result;
  }

  private removeExpiredEntries(now: number): void {
    for (const [key, entry] of this.cache) {
      if (entry.expiresAt <= now) {
        this.cache.delete(key);
      }
    }
  }
}
