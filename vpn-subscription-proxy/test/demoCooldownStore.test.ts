import assert from 'node:assert/strict';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {DemoCooldownStore} from '../src/demoCooldownStore.js';

const hmacKey = 'a-long-test-key-that-is-never-a-production-key';

test('demo cooldown is keyed by both IP and device and expires by Moscow calendar month', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'dragonet-cooldown-'));
  const store = new DemoCooldownStore(path.join(directory, 'cooldowns.sqlite'), hmacKey);
  const now = new Date('2026-01-31T12:15:00.000Z');

  try {
    const reservation = store.reserve('198.51.100.20', 'Pixel 9', now);
    assert.ok(reservation);
    assert.equal(store.reserve('198.51.100.20', 'Another device', now), undefined);
    assert.equal(store.reserve('198.51.100.21', 'Pixel 9', now), undefined);

    const expiry = new Date(reservation.expiresAt);
    assert.equal(expiry.toISOString(), '2026-02-28T12:15:00.000Z');
    assert.ok(store.reserve('198.51.100.20', 'Pixel 9', expiry));
  } finally {
    store.close();
    await rm(directory, {recursive: true, force: true});
  }
});

test('only one simultaneous demo reservation can win for an identity', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'dragonet-cooldown-race-'));
  const store = new DemoCooldownStore(path.join(directory, 'cooldowns.sqlite'), hmacKey);
  try {
    const reservations = await Promise.all(Array.from({length: 12}, async () => (
      store.reserve('198.51.100.30', 'Pixel 10', new Date('2026-09-05T10:15:00.000Z'))
    )));
    assert.equal(reservations.filter(Boolean).length, 1);
  } finally {
    store.close();
    await rm(directory, {recursive: true, force: true});
  }
});
