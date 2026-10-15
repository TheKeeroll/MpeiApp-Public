import assert from 'node:assert/strict';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import test from 'node:test';
import Database from 'better-sqlite3';

import {DemoCooldownStore} from '../src/demoCooldownStore.js';
import {hmacIdentity} from '../src/requestGate.js';

const hmacKey = 'a-long-test-key-that-is-never-a-production-key';

test('demo cooldown is keyed by both IP and device and expires after exactly 14 days', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'dragonet-cooldown-'));
  const store = new DemoCooldownStore(path.join(directory, 'cooldowns.sqlite'), hmacKey);
  const now = new Date('2026-01-31T12:15:00.000Z');

  try {
    const reservation = store.reserve('198.51.100.20', 'Pixel 9', now);
    assert.ok(reservation);
    assert.equal(store.reserve('198.51.100.20', 'Another device', now), undefined);
    assert.equal(store.reserve('198.51.100.21', 'Pixel 9', now), undefined);

    const expiry = new Date(reservation.expiresAt);
    assert.equal(expiry.toISOString(), '2026-02-14T12:15:00.000Z');
    assert.equal(store.reserve('198.51.100.20', 'Pixel 9', new Date(expiry.getTime() - 1)), undefined);
    assert.ok(store.reserve('198.51.100.20', 'Pixel 9', expiry));
  } finally {
    store.close();
    await rm(directory, {recursive: true, force: true});
  }
});

test('legacy issued deadlines shrink without resetting identities; unknown legacy reservations retain their original deadline', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'dragonet-migration-'));
  const filename = path.join(directory, 'cooldowns.sqlite');
  const legacy = new Database(filename);
  const issuedAt = new Date('2026-01-31T12:15:00Z').getTime();
  const oldExpiry = new Date('2026-02-28T12:15:00Z').getTime();
  legacy.exec(`CREATE TABLE demo_cooldowns (
    identity_type TEXT NOT NULL, identity_hash TEXT NOT NULL, issued_at INTEGER,
    expires_at INTEGER NOT NULL, state TEXT NOT NULL, PRIMARY KEY(identity_type, identity_hash)
  )`);
  for (const identity of ['ip', 'device']) {
    const value = identity === 'ip' ? '198.51.100.50' : 'legacy-device';
    legacy.prepare('INSERT INTO demo_cooldowns VALUES (?, ?, ?, ?, ?)')
      .run(identity, hmacIdentity(hmacKey, `demo-${identity}`, value), issuedAt, oldExpiry, 'issued');
  }
  legacy.prepare('INSERT INTO demo_cooldowns VALUES (?, ?, NULL, ?, ?)')
    .run('device', hmacIdentity(hmacKey, 'demo-device', 'legacy-pending'), oldExpiry, 'reservation');
  legacy.close();
  let store = new DemoCooldownStore(filename, hmacKey);
  try {
    const blocked = store.tryReserve('198.51.100.51', 'legacy-device', new Date('2026-02-13T12:15:00Z'));
    assert.equal(blocked.kind, 'blocked');
    if (blocked.kind === 'blocked') assert.equal(blocked.blocking[0]!.expiresAt, new Date('2026-02-14T12:15:00Z').getTime());
    const pending = store.tryReserve('198.51.100.51', 'legacy-pending', new Date('2026-02-13T12:15:00Z'));
    assert.equal(pending.kind, 'blocked');
    if (pending.kind === 'blocked') {
      assert.equal(pending.blocking[0]!.legacyReservation, true);
      assert.equal(pending.blocking[0]!.expiresAt, oldExpiry);
    }
    store.close();
    store = new DemoCooldownStore(filename, hmacKey);
    assert.ok(store.reserve('198.51.100.50', 'legacy-device', new Date('2026-02-14T12:15:00Z')));
    // Old code can still use its explicit INSERT column list after this migration.
    const oldCode = new Database(filename);
    oldCode.prepare('INSERT INTO demo_cooldowns (identity_type, identity_hash, issued_at, expires_at, state) VALUES (?, ?, NULL, ?, ?)')
      .run('device', 'old-code-compatible', oldExpiry, 'reservation');
    oldCode.close();
  } finally {
    store.close();
    await rm(directory, {recursive: true, force: true});
  }
});

test('an old reservation cannot release or finalize a newer reservation for the same device/IP', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'dragonet-lease-'));
  const store = new DemoCooldownStore(path.join(directory, 'cooldowns.sqlite'), hmacKey);
  try {
    const first = store.reserve('198.51.100.60', 'device', new Date('2026-01-01T00:00:00Z'))!;
    const second = store.reserve('198.51.100.60', 'device', new Date('2026-01-15T00:00:00Z'))!;
    assert.ok(second);
    store.releaseKnownFailure(first);
    assert.throws(() => store.markIssued(first), /could not be finalized/u);
    assert.equal(store.reserve('198.51.100.60', 'device', new Date('2026-01-15T00:00:00Z')), undefined);
    store.markIssued(second, new Date('2026-01-15T00:00:00Z'));
  } finally { store.close(); await rm(directory, {recursive: true, force: true}); }
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
