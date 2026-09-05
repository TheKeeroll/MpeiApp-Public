import assert from 'node:assert/strict';
import test from 'node:test';

import {VerifySubscriptionService} from '../src/verifySubscription.js';
import {VpnPanelClient} from '../src/vpnPanelClient.js';

test('verification uses an exact panel name match and caches by HMAC', async () => {
  let calls = 0;
  const panel = new VpnPanelClient('https://panel.example.com/hidden', 'test-token', 1000, async () => {
    calls += 1;
    return new Response(JSON.stringify({
      success: true,
      obj: {
        clients: [
          {name: 'MpeiApp-user_1', enable: true},
          {name: 'mpeiapp-user_1', enable: false},
        ],
      },
    }));
  });
  const service = new VerifySubscriptionService(panel, 'a-long-test-key-that-is-never-a-production-key', 5000);

  assert.deepEqual(await service.verify('MpeiApp-user_1', 100), {isClientFound: true, isClientActive: true});
  assert.deepEqual(await service.verify('MpeiApp-user_1', 101), {isClientFound: true, isClientActive: true});
  assert.deepEqual(await service.verify('absent', 102), {isClientFound: false, isClientActive: false});
  assert.equal(calls, 2);
});
