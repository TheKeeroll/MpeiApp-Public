import {isIP} from 'node:net';
import path from 'node:path';

export type ProxyConfig = Readonly<{
  listenHost: string;
  listenPort: number;
  requestPath: string;
  panelBaseUrl: string;
  panelToken: string;
  demoInbounds: readonly number[];
  subscriptionPort: number;
  subscriptionPathPrefix: string;
  cooldownHmacKey: string;
  stateDirectory: string;
  requestTimeoutMs: number;
  rateLimitMax: number;
  rateLimitWindowMs: number;
  verifyCacheTtlMs: number;
  maxRequestBodyBytes: number;
  trustedReverseProxyIps: readonly string[];
  demoVlessFlow: string;
}>;

const readRequired = (env: NodeJS.ProcessEnv, name: string): string => {
  const value = env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing ${name}`);
  }
  return value.trim();
};

const readInteger = (
  env: NodeJS.ProcessEnv,
  name: string,
  minimum: number,
  maximum: number,
): number => {
  const value = Number.parseInt(readRequired(env, name), 10);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`Invalid ${name}`);
  }
  return value;
};

const readPath = (env: NodeJS.ProcessEnv, name: string): string => {
  const value = readRequired(env, name);
  if (!value.startsWith('/') || value.includes('//') || value.includes('?') || value.includes('#')) {
    throw new Error(`Invalid ${name}`);
  }
  return value.length > 1 && value.endsWith('/') ? value.slice(0, -1) : value;
};

const readHttpsUrl = (env: NodeJS.ProcessEnv, name: string): string => {
  const value = readRequired(env, name);
  try {
    const url = new URL(value);
    if (
      url.protocol !== 'https:'
      || url.username
      || url.password
      || url.search
      || url.hash
    ) {
      throw new Error('Unsupported URL');
    }
    return url.href.endsWith('/') ? url.href.slice(0, -1) : url.href;
  } catch {
    throw new Error(`Invalid ${name}`);
  }
};

const readDemoInbounds = (env: NodeJS.ProcessEnv): readonly number[] => {
  const raw = readRequired(env, 'VPN_DEMO_INBOUNDS');
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      !Array.isArray(parsed)
      || parsed.length === 0
      || parsed.some(value => !Number.isSafeInteger(value) || value < 1)
    ) {
      throw new Error('Invalid inbounds');
    }
    return [...new Set(parsed)];
  } catch {
    throw new Error('Invalid VPN_DEMO_INBOUNDS');
  }
};

const normaliseIp = (value: string): string | undefined => {
  const trimmed = value.trim().toLowerCase();
  const ipv4Mapped = trimmed.startsWith('::ffff:') ? trimmed.slice(7) : trimmed;
  return isIP(ipv4Mapped) === 0 ? undefined : ipv4Mapped;
};

const readTrustedProxyIps = (env: NodeJS.ProcessEnv): readonly string[] => {
  const raw = env.TRUSTED_REVERSE_PROXY_IPS?.trim() ?? '';
  if (!raw) {
    return [];
  }
  const ips = raw.split(',').map(normaliseIp);
  if (ips.some(ip => !ip)) {
    throw new Error('Invalid TRUSTED_REVERSE_PROXY_IPS');
  }
  return [...new Set(ips as string[])];
};

export const loadConfig = (env: NodeJS.ProcessEnv = process.env): ProxyConfig => {
  const stateDirectory = readRequired(env, 'STATE_DIRECTORY');
  if (!path.isAbsolute(stateDirectory)) {
    throw new Error('STATE_DIRECTORY must be absolute');
  }

  const cooldownHmacKey = readRequired(env, 'DEMO_COOLDOWN_HMAC_KEY');
  if (Buffer.byteLength(cooldownHmacKey, 'utf8') < 32) {
    throw new Error('DEMO_COOLDOWN_HMAC_KEY is too short');
  }

  const listenHost = readRequired(env, 'PROXY_LISTEN_HOST');
  if (listenHost.length > 255 || /[\u0000-\u001F\u007F\s]/.test(listenHost)) {
    throw new Error('Invalid PROXY_LISTEN_HOST');
  }

  const demoVlessFlow = readRequired(env, 'DEMO_VLESS_FLOW');
  if (demoVlessFlow.length > 128 || /[\u0000-\u001F\u007F]/.test(demoVlessFlow)) {
    throw new Error('Invalid DEMO_VLESS_FLOW');
  }

  return {
    listenHost,
    listenPort: readInteger(env, 'PROXY_LISTEN_PORT', 1, 65535),
    requestPath: readPath(env, 'PROXY_REQUEST_PATH'),
    panelBaseUrl: readHttpsUrl(env, 'VPN_PANEL_BASE_URL'),
    panelToken: readRequired(env, 'VPN_PANEL_TOKEN'),
    demoInbounds: readDemoInbounds(env),
    subscriptionPort: readInteger(env, 'VPN_SUBSCRIPTION_PORT', 1, 65535),
    subscriptionPathPrefix: readPath(env, 'VPN_SUBSCRIPTION_PATH_PREFIX'),
    cooldownHmacKey,
    stateDirectory,
    requestTimeoutMs: readInteger(env, 'REQUEST_TIMEOUT_MS', 1000, 60000),
    rateLimitMax: readInteger(env, 'REQUEST_RATE_LIMIT_MAX', 1, 1000),
    rateLimitWindowMs: readInteger(env, 'REQUEST_RATE_LIMIT_WINDOW_SECONDS', 1, 3600) * 1000,
    verifyCacheTtlMs: readInteger(env, 'VERIFY_CACHE_TTL_SECONDS', 1, 300) * 1000,
    maxRequestBodyBytes: readInteger(env, 'MAX_REQUEST_BODY_BYTES', 128, 16384),
    trustedReverseProxyIps: readTrustedProxyIps(env),
    demoVlessFlow,
  };
};
