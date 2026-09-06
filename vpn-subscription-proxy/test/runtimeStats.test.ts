import assert from 'node:assert/strict';
import test from 'node:test';

import {RuntimeStats} from '../src/runtimeStats.js';

test('runtime stats count terminal proxy results and format uptime in days, hours, and minutes', () => {
  const startedAt = Date.UTC(2026, 8, 6, 8, 0, 0);
  const stats = new RuntimeStats(startedAt);
  stats.recordSuccessfulVerify();
  stats.recordSuccessfulVerify();
  stats.recordSuccessfulDemo();
  stats.recordFailedRequest();
  stats.recordFailedRequest();
  stats.recordFailedRequest();

  assert.deepEqual(stats.snapshot(startedAt + (((2 * 24 + 5) * 60 + 17) * 60000)), {
    successfulVerifyRequests: 2,
    successfulDemoRequests: 1,
    failedRequests: 3,
    uptime: {
      days: 2,
      hours: 5,
      minutes: 17,
      formatted: '2 суток 5 часов 17 минут',
    },
  });
});
