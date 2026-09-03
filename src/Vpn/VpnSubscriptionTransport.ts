import type {VpnProxyDemoResponse, VpnProxyVerifyResponse} from './types';

/**
 * Public client-side configuration. The domain/path are intentionally separate
 * so a future transport cannot accept a complete panel URL or credentials.
 */
export type VpnProxyConfiguration = Readonly<{
  domain: string;
  path: string;
}>;

export type VpnSubscriptionTransport = Readonly<{
  verify: (clientName: string) => Promise<VpnProxyVerifyResponse>;
  requestDemo: () => Promise<VpnProxyDemoResponse>;
}>;

export const isValidVpnProxyConfiguration = (configuration: VpnProxyConfiguration): boolean => {
  const domain = configuration.domain.trim();
  const path = configuration.path.trim();
  return (
    domain.length > 0
    && !domain.includes('://')
    && !domain.includes('/')
    && !domain.includes('?')
    && !domain.includes('#')
    && path.startsWith('/')
    && !path.includes('?')
    && !path.includes('#')
  );
};
