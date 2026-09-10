import * as Secrets from '../config/Secrets';
import type {VpnSubscriptionLinkConfiguration} from './VpnSubscriptionLink';
import type {VpnProxyConfiguration} from './VpnSubscriptionTransport';

type PublicSecrets = Record<string, unknown>;

const publicSecrets = Secrets as unknown as PublicSecrets;

const readString = (name: string, fallback = ''): string => {
  const value = publicSecrets[name];
  return typeof value === 'string' ? value.trim() : fallback;
};

const readPort = (name: string, fallback: number): number => {
  const value = publicSecrets[name];
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1 && value <= 65_535
    ? value
    : fallback;
};

export type DragoNetPublicConfiguration = Readonly<{
  proxy: VpnProxyConfiguration;
  subscriptionLink: VpnSubscriptionLinkConfiguration;
  telegramUrl: string;
}>;

/**
 * Only public values are read from Secrets.ts. The subscription host is the
 * same hostname discovered by the proxy; its port is independently public.
 */
export const getDragoNetPublicConfiguration = (): DragoNetPublicConfiguration => {
  const domain = readString('DRAGONET_PROXY_DOMAIN');
  const subscriptionPort = readPort('DRAGONET_SUBSCRIPTION_PORT', 443);
  const subscriptionPortSuffix = subscriptionPort === 443 ? '' : `:${subscriptionPort}`;
  return {
    proxy: {
      domain,
      port: readPort('DRAGONET_PROXY_PORT', 8443),
      path: readString('DRAGONET_PROXY_PATH'),
    },
    subscriptionLink: {
      origin: domain ? `https://${domain}${subscriptionPortSuffix}` : '',
      pathPrefix: readString('DRAGONET_SUBSCRIPTION_PATH_PREFIX', '/sub'),
    },
    telegramUrl: readString('DRAGONET_TELEGRAM_URL', 'https://t.me/DragonSavA'),
  };
};
