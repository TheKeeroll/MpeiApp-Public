import assert from 'node:assert/strict';
import test from 'node:test';

import {RequestRateLimiter, parseRequestGate} from '../src/requestGate.js';
import {getMoscowRequestDate} from '../src/time.js';

const now = new Date('2026-09-05T10:15:00.000Z');
const requestId = `DragoNet-${getMoscowRequestDate(now)}-Pixel_9-Android_16`;

test('request gate accepts only the current Moscow date and a direct socket identity', () => {
  const gate = parseRequestGate({
    requestId,
    remoteAddress: '::ffff:198.51.100.15',
    forwardedFor: '203.0.113.9',
    trustedReverseProxyIps: [],
    now,
  });

  assert.deepEqual(gate, {
    clientIp: '198.51.100.15',
    deviceId: 'pixel_9-android_16',
  });
});

test('request gate rejects stale dates, controls, and untrusted X-Forwarded-For', () => {
  assert.equal(parseRequestGate({
    requestId: 'DragoNet-04-09-2026-device',
    remoteAddress: '198.51.100.15',
    forwardedFor: undefined,
    trustedReverseProxyIps: [],
    now,
  }), undefined);
  assert.equal(parseRequestGate({
    requestId: `DragoNet-${getMoscowRequestDate(now)}-device\nother`,
    remoteAddress: '198.51.100.15',
    forwardedFor: undefined,
    trustedReverseProxyIps: [],
    now,
  }), undefined);
  assert.equal(parseRequestGate({
    requestId,
    remoteAddress: undefined,
    forwardedFor: undefined,
    trustedReverseProxyIps: [],
    now,
  }), undefined);
  assert.equal(parseRequestGate({
    requestId: [requestId],
    remoteAddress: '198.51.100.15',
    forwardedFor: undefined,
    trustedReverseProxyIps: [],
    now,
  }), undefined);
});

test('request gate reads X-Forwarded-For only from an explicitly trusted reverse proxy', () => {
  assert.deepEqual(parseRequestGate({
    requestId,
    remoteAddress: '198.51.100.1',
    forwardedFor: '198.51.100.15, 198.51.100.1',
    trustedReverseProxyIps: ['198.51.100.1'],
    now,
  }), {
    clientIp: '198.51.100.15',
    deviceId: 'pixel_9-android_16',
  });
});

test('rate limiter stores a keyed identity and starts a new fixed window', () => {
  const limiter = new RequestRateLimiter('a-long-test-key-that-is-never-a-production-key', 2, 1000);
  assert.equal(limiter.tryConsume('198.51.100.15', 100), true);
  assert.equal(limiter.tryConsume('198.51.100.15', 101), true);
  assert.equal(limiter.tryConsume('198.51.100.15', 102), false);
  assert.equal(limiter.tryConsume('198.51.100.15', 1100), true);
});
