import assert from 'node:assert/strict';
import test from 'node:test';

import {demoCooldownResponse, failedResponse, proxyRequestSchema, serviceErrorResponse} from '../src/schema.js';

test('request schema is a strict discriminated union', () => {
  assert.equal(proxyRequestSchema.safeParse({purpose: 'verify', clientName: 'MpeiApp-user_123'}).success, true);
  assert.equal(proxyRequestSchema.safeParse({purpose: 'demo'}).success, true);
  assert.equal(proxyRequestSchema.safeParse({purpose: 'demo', clientName: 'must-not-be-sent'}).success, false);
  assert.equal(proxyRequestSchema.safeParse({purpose: 'verify', clientName: 'a/b'}).success, false);
  assert.equal(proxyRequestSchema.safeParse({purpose: 'verify'}).success, false);
});

test('new failure reasons are additive to the legacy reqStatus contract and contain no internal details', () => {
  assert.deepEqual(demoCooldownResponse, {reqStatus: 'failed', reason: 'demo_cooldown'});
  assert.deepEqual(serviceErrorResponse, {reqStatus: 'failed', reason: 'service_error'});
  for (const response of [demoCooldownResponse, serviceErrorResponse]) assert.equal(response.reqStatus, failedResponse.reqStatus);
});

test('the public failed response has no diagnostic or identity fields', () => {
  assert.deepEqual(failedResponse, {reqStatus: 'failed'});
  assert.deepEqual(Object.keys(failedResponse), ['reqStatus']);
});
