import assert from 'node:assert/strict';
import test from 'node:test';

import {addOneCalendarMonthInMoscow, getMoscowRequestDate} from '../src/time.js';

test('cooldown expiry is a calendar month in Moscow, not a fixed 30-day interval', () => {
  const now = new Date('2026-01-31T12:15:45.000Z');
  const expiry = addOneCalendarMonthInMoscow(now);
  assert.equal(getMoscowRequestDate(now), '31-01-2026');
  assert.equal(expiry.toISOString(), '2026-02-28T12:15:45.000Z');
});
