import assert from 'node:assert/strict';
import test from 'node:test';

import {getMoscowRequestDate} from '../src/time.js';

test('request header date follows Moscow midnight across month and year boundaries', () => {
  assert.equal(getMoscowRequestDate(new Date('2026-01-31T20:59:59Z')), '31-01-2026');
  assert.equal(getMoscowRequestDate(new Date('2026-01-31T21:00:00Z')), '01-02-2026');
  assert.equal(getMoscowRequestDate(new Date('2026-12-31T21:00:00Z')), '01-01-2027');
});
