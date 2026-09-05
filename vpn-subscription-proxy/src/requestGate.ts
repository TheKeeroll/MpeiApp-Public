import {createHmac} from 'node:crypto';
import {isIP} from 'node:net';

import {getMoscowRequestDate} from './time.js';

export type RequestGateContext = Readonly<{
  deviceId: string;
  clientIp: string;
}>;

type RequestGateInput = Readonly<{
  requestId: string | string[] | undefined;
  remoteAddress: string | undefined;
  forwardedFor: string | string[] | undefined;
  trustedReverseProxyIps: readonly string[];
  now?: Date;
}>;

const REQUEST_ID_PREFIX = 'DragoNet-';
const REQUEST_ID_PATTERN = /^DragoNet-(\d{2}-\d{2}-\d{4})-(.+)$/u;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F\u007F-\u009F]/u;

const normaliseIp = (value: string | undefined): string | undefined => {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim().toLowerCase();
  const ipv4Mapped = trimmed.startsWith('::ffff:') ? trimmed.slice(7) : trimmed;
  return isIP(ipv4Mapped) === 0 ? undefined : ipv4Mapped;
};

const parseForwardedFor = (value: string | string[] | undefined): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const first = value.split(',', 1)[0];
  return normaliseIp(first);
};

export const normaliseDeviceId = (value: string): string => value.normalize('NFKC').trim().toLowerCase();

export const parseRequestGate = (input: RequestGateInput): RequestGateContext | undefined => {
  if (typeof input.requestId !== 'string' || !input.requestId.startsWith(REQUEST_ID_PREFIX)) {
    return undefined;
  }

  const matches = REQUEST_ID_PATTERN.exec(input.requestId);
  if (!matches) {
    return undefined;
  }

  const requestDate = matches[1];
  const rawDeviceId = matches[2];
  if (
    !requestDate
    || !rawDeviceId
    || requestDate !== getMoscowRequestDate(input.now)
    || rawDeviceId.length > 160
    || rawDeviceId.trim().length === 0
    || CONTROL_CHARACTER_PATTERN.test(rawDeviceId)
  ) {
    return undefined;
  }

  const remoteIp = normaliseIp(input.remoteAddress);
  if (!remoteIp) {
    return undefined;
  }

  const clientIp = input.trustedReverseProxyIps.includes(remoteIp)
    ? parseForwardedFor(input.forwardedFor) ?? remoteIp
    : remoteIp;

  return {
    deviceId: normaliseDeviceId(rawDeviceId),
    clientIp,
  };
};

export const hmacIdentity = (key: string, namespace: string, value: string): string => createHmac('sha256', key)
  .update(namespace)
  .update('\u0000')
  .update(value)
  .digest('hex');

type RateLimitBucket = {
  startedAt: number;
  count: number;
};

export class RequestRateLimiter {
  private readonly buckets = new Map<string, RateLimitBucket>();

  public constructor(
    private readonly hmacKey: string,
    private readonly maximum: number,
    private readonly windowMs: number,
  ) {}

  public tryConsume(clientIp: string, now = Date.now()): boolean {
    const key = hmacIdentity(this.hmacKey, 'rate-limit-ip', clientIp);
    const bucket = this.buckets.get(key);
    if (!bucket || now - bucket.startedAt >= this.windowMs) {
      this.buckets.set(key, {startedAt: now, count: 1});
      this.removeExpiredBuckets(now);
      return true;
    }

    if (bucket.count >= this.maximum) {
      return false;
    }

    bucket.count += 1;
    return true;
  }

  private removeExpiredBuckets(now: number): void {
    for (const [key, bucket] of this.buckets) {
      if (now - bucket.startedAt >= this.windowMs) {
        this.buckets.delete(key);
      }
    }
  }
}
