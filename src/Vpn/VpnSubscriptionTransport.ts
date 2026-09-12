import type {VpnProxyDemoResponse, VpnProxyVerifyResponse} from './types';
import {createVpnRequestId} from './VpnRequestId';

/**
 * Public client-side configuration. The domain, port and path stay separate
 * so the transport can never receive a panel URL or credentials.
 */
export type VpnProxyConfiguration = Readonly<{
  domain: string;
  port: number;
  path: string;
}>;

export type VpnSubscriptionTransport = Readonly<{
  isConfigured: boolean;
  verify: (clientName: string) => Promise<VpnProxyVerifyResponse>;
  requestDemo: () => Promise<VpnProxyDemoResponse>;
}>;

export type VpnTransportOptions = Readonly<{
  fetchImplementation?: typeof fetch;
  createRequestId?: () => string;
  timeoutMs?: number;
}>;

const DEFAULT_TIMEOUT_MS = 12_000;

const isValidPath = (path: string): boolean => (
  path.length > 1
  && path === path.trim()
  && path.startsWith('/')
  && !path.includes('//')
  && !path.includes('?')
  && !path.includes('#')
  && !/[\u0000-\u001F\u007F-\u009F]/.test(path)
);

export const isValidVpnProxyConfiguration = (configuration: VpnProxyConfiguration): boolean => {
  const domain = configuration.domain.trim();
  const {path, port} = configuration;
  if (!domain || domain !== configuration.domain || !Number.isSafeInteger(port) || port < 1 || port > 65_535 || !isValidPath(path)) {
    return false;
  }

  try {
    const url = new URL(`https://${domain}`);
    return url.protocol === 'https:'
      && url.hostname === domain
      && url.host === domain
      && !url.port
      && url.pathname === '/'
      && !url.username
      && !url.password
      && !url.search
      && !url.hash;
  } catch {
    return false;
  }
};

export const buildVpnProxyEndpoint = (configuration: VpnProxyConfiguration): string | undefined => {
  if (!isValidVpnProxyConfiguration(configuration)) {
    return undefined;
  }

  const port = configuration.port === 443 ? '' : `:${configuration.port}`;
  return `https://${configuration.domain}${port}${configuration.path}`;
};

const failedVerifyResponse: VpnProxyVerifyResponse = {reqStatus: 'failed'};
const failedDemoResponse: VpnProxyDemoResponse = {reqStatus: 'failed'};

const isValidDemoUrl = (value: unknown): value is string => {
  if (typeof value !== 'string' || value.length === 0 || value.length > 2_048) {
    return false;
  }

  try {
    const url = new URL(value);
    return url.protocol === 'https:'
      && !url.username
      && !url.password
      && !url.hash
      && url.pathname.length > 1;
  } catch {
    return false;
  }
};

const parseVerifyResponse = (value: unknown): VpnProxyVerifyResponse => {
  if (!value || typeof value !== 'object') {
    return failedVerifyResponse;
  }

  const response = value as Partial<VpnProxyVerifyResponse>;
  if (response.reqStatus === 'failed') {
    return failedVerifyResponse;
  }
  if (
    response.reqStatus === 'success'
    && typeof response.isClientFound === 'boolean'
    && typeof response.isClientActive === 'boolean'
  ) {
    return {
      reqStatus: 'success',
      isClientFound: response.isClientFound,
      isClientActive: response.isClientActive,
    };
  }
  return failedVerifyResponse;
};

const parseDemoResponse = (value: unknown): VpnProxyDemoResponse => {
  if (!value || typeof value !== 'object') {
    return failedDemoResponse;
  }

  const response = value as Partial<VpnProxyDemoResponse>;
  if (response.reqStatus === 'failed') {
    return failedDemoResponse;
  }
  if (response.reqStatus === 'success' && isValidDemoUrl(response.demoSubURL)) {
    return {reqStatus: 'success', demoSubURL: response.demoSubURL};
  }
  return failedDemoResponse;
};

const post = async (
  endpoint: string,
  body: Readonly<Record<string, string>>,
  options: Required<Pick<VpnTransportOptions, 'fetchImplementation' | 'createRequestId' | 'timeoutMs'>>,
): Promise<unknown> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
  try {
    const response = await options.fetchImplementation(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Mpei-App-Req-Id': options.createRequestId(),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) {
      return undefined;
    }
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
};

/**
 * Creates the only mobile transport used for both verify and demo requests.
 * Network exceptions intentionally propagate to the service, where they are
 * classified as transient rather than an absent subscription.
 */
export const createVpnSubscriptionTransport = (
  configuration: VpnProxyConfiguration,
  options: VpnTransportOptions = {},
): VpnSubscriptionTransport => {
  const endpoint = buildVpnProxyEndpoint(configuration);
  const fetchImplementation = options.fetchImplementation ?? fetch;
  const createRequestId = options.createRequestId ?? createVpnRequestId;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const isConfigured = !!endpoint && Number.isSafeInteger(timeoutMs) && timeoutMs >= 1_000;

  if (!isConfigured || !endpoint) {
    return {
      isConfigured: false,
      verify: async () => failedVerifyResponse,
      requestDemo: async () => failedDemoResponse,
    };
  }

  const requestOptions = {fetchImplementation, createRequestId, timeoutMs};
  return {
    isConfigured: true,
    verify: async clientName => parseVerifyResponse(await post(endpoint, {purpose: 'verify', clientName}, requestOptions)),
    requestDemo: async () => parseDemoResponse(await post(endpoint, {purpose: 'demo'}, requestOptions)),
  };
};
