import {mkdirSync, chmodSync} from 'node:fs';
import path from 'node:path';

import Database from 'better-sqlite3';

import {hmacIdentity, normaliseDeviceId} from './requestGate.js';
export const DEMO_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;

export type DemoReservation = Readonly<{
  ipHash: string;
  deviceHash: string;
  expiresAt: number;
  reservedAt: number;
}>;

export type DemoBlockingIdentity = Readonly<{
  identity: 'ip' | 'device';
  state: 'reservation' | 'issued';
  expiresAt: number;
  legacyReservation: boolean;
}>;

export type DemoReservationAttempt =
  | {kind: 'reserved'; reservation: DemoReservation}
  | {kind: 'blocked'; blocking: readonly DemoBlockingIdentity[]};

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS demo_cooldowns (
    identity_type TEXT NOT NULL CHECK (identity_type IN ('ip', 'device')),
    identity_hash TEXT NOT NULL,
    issued_at INTEGER,
    reserved_at INTEGER,
    expires_at INTEGER NOT NULL,
    state TEXT NOT NULL CHECK (state IN ('reservation', 'issued')),
    PRIMARY KEY (identity_type, identity_hash)
  );
  CREATE INDEX IF NOT EXISTS demo_cooldowns_expires_at_idx
    ON demo_cooldowns (expires_at);
`;

/**
 * Stores only keyed HMACs. A reservation survives a process crash on purpose:
 * retrying after an unknown panel result must not grant an extra demo period.
 */
export class DemoCooldownStore {
  private readonly database: Database.Database;

  public constructor(databasePath: string, private readonly hmacKey: string) {
    mkdirSync(path.dirname(databasePath), {recursive: true, mode: 0o700});
    this.database = new Database(databasePath);
    chmodSync(databasePath, 0o600);
    this.database.pragma('journal_mode = WAL');
    this.database.pragma('synchronous = FULL');
    this.database.exec(CREATE_TABLE_SQL);
    this.database.transaction(() => {
      const columns = this.database.prepare('PRAGMA table_info(demo_cooldowns)').all() as {name: string}[];
      if (!columns.some(column => column.name === 'reserved_at')) {
        this.database.exec('ALTER TABLE demo_cooldowns ADD COLUMN reserved_at INTEGER');
      }
      // Idempotently shorten known legacy issuances; never reset the HMACs.
      this.database.prepare(`
        UPDATE demo_cooldowns SET expires_at = MIN(expires_at, issued_at + ?)
        WHERE state = 'issued' AND issued_at IS NOT NULL
      `).run(DEMO_COOLDOWN_MS);
      // Legacy pending rows have no creation timestamp. Keep their deadline
      // rather than inventing an issuance; they are reported as service errors.
    }).immediate();
  }

  public reserve(clientIp: string, deviceId: string, now = new Date()): DemoReservation | undefined {
    const attempt = this.tryReserve(clientIp, deviceId, now);
    return attempt.kind === 'reserved' ? attempt.reservation : undefined;
  }

  public tryReserve(clientIp: string, deviceId: string, now = new Date()): DemoReservationAttempt {
    const ipHash = hmacIdentity(this.hmacKey, 'demo-ip', clientIp.trim().toLowerCase());
    const deviceHash = hmacIdentity(this.hmacKey, 'demo-device', normaliseDeviceId(deviceId));
    const expiresAt = now.getTime() + DEMO_COOLDOWN_MS;
    const nowMs = now.getTime();

    const transaction = this.database.transaction(() => {
      this.database.prepare('DELETE FROM demo_cooldowns WHERE expires_at <= ?').run(nowMs);
      const existing = this.database.prepare(`
        SELECT identity_type, state, expires_at, reserved_at
        FROM demo_cooldowns
        WHERE (identity_type = 'ip' AND identity_hash = ?)
           OR (identity_type = 'device' AND identity_hash = ?)
      `).all(ipHash, deviceHash) as {identity_type: 'ip' | 'device'; state: 'reservation' | 'issued'; expires_at: number; reserved_at: number | null}[];

      if (existing.length > 0) {
        return {kind: 'blocked', blocking: existing.map(row => ({
          identity: row.identity_type, state: row.state, expiresAt: row.expires_at,
          legacyReservation: row.state === 'reservation' && row.reserved_at === null,
        }))} as const;
      }

      const insert = this.database.prepare(`
        INSERT INTO demo_cooldowns (identity_type, identity_hash, issued_at, reserved_at, expires_at, state)
        VALUES (?, ?, NULL, ?, ?, 'reservation')
      `);
      insert.run('ip', ipHash, nowMs, expiresAt);
      insert.run('device', deviceHash, nowMs, expiresAt);
      return {kind: 'reserved', reservation: {ipHash, deviceHash, expiresAt, reservedAt: nowMs}} as const;
    });

    return transaction.immediate();
  }

  public markIssued(reservation: DemoReservation, now = new Date()): void {
    const transaction = this.database.transaction(() => {
      const result = this.database.prepare(`
        UPDATE demo_cooldowns
        SET state = 'issued', issued_at = ?, expires_at = ?
        WHERE state = 'reservation'
          AND reserved_at = ? AND expires_at = ?
          AND ((identity_type = 'ip' AND identity_hash = ?)
            OR (identity_type = 'device' AND identity_hash = ?))
      `).run(now.getTime(), now.getTime() + DEMO_COOLDOWN_MS, reservation.reservedAt, reservation.expiresAt, reservation.ipHash, reservation.deviceHash);
      if (result.changes !== 2) {
        throw new Error('Demo reservation could not be finalized');
      }
    });
    transaction.immediate();
  }

  /** Releases only a known panel rejection; transport uncertainty stays blocked. */
  public releaseKnownFailure(reservation: DemoReservation): void {
    this.database.prepare(`
      DELETE FROM demo_cooldowns
      WHERE state = 'reservation'
        AND reserved_at = ? AND expires_at = ?
        AND ((identity_type = 'ip' AND identity_hash = ?)
          OR (identity_type = 'device' AND identity_hash = ?))
    `).run(reservation.reservedAt, reservation.expiresAt, reservation.ipHash, reservation.deviceHash);
  }

  public close(): void {
    this.database.close();
  }
}
