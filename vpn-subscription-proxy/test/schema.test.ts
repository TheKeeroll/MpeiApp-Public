import assert from 'node:assert/strict';
import test from 'node:test';

import {proxyRequestSchema} from '../src/schema.js';

test('request schema is a strict discriminated union', () => {
  assert.equal(proxyRequestSchema.safeParse({purpose: 'verify', clientName: 'MpeiApp-user_123'}).success, true);
  assert.equal(proxyRequestSchema.safeParse({purpose: 'demo'}).success, true);
  assert.equal(proxyRequestSchema.safeParse({purpose: 'demo', clientName: 'must-not-be-sent'}).success, false);
  assert.equal(proxyRequestSchema.safeParse({purpose: 'verify', clientName: 'a/b'}).success, false);
  assert.equal(proxyRequestSchema.safeParse({purpose: 'verify'}).success, false);
});
