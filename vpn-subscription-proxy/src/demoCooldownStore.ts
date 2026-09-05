import {mkdirSync, chmodSync} from 'node:fs';
import path from 'node:path';

import Database from 'better-sqlite3';

import {hmacIdentity, normaliseDeviceId} from './requestGate.js';
import {addOneCalendarMonthInMoscow} from './time.js';

export type DemoReservation = Readonly<{
  ipHash: string;
  deviceHash: string;
  expiresAt: number;
}>;

type ExistingCooldownRow = Readonly<{
  present: number;
}>;

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS demo_cooldowns (
    identity_type TEXT NOT NULL CHECK (identity_type IN ('ip', 'device')),
    identity_hash TEXT NOT NULL,
    issued_at INTEGER,
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
  }

  public reserve(clientIp: string, deviceId: string, now = new Date()): DemoReservation | undefined {
    const ipHash = hmacIdentity(this.hmacKey, 'demo-ip', clientIp.trim().toLowerCase());
    const deviceHash = hmacIdentity(this.hmacKey, 'demo-device', normaliseDeviceId(deviceId));
    const expiresAt = addOneCalendarMonthInMoscow(now).getTime();
    const nowMs = now.getTime();

    const transaction = this.database.transaction(() => {
      this.database.prepare('DELETE FROM demo_cooldowns WHERE expires_at <= ?').run(nowMs);
      const existing = this.database.prepare(`
        SELECT 1 AS present
        FROM demo_cooldowns
        WHERE (identity_type = 'ip' AND identity_hash = ?)
           OR (identity_type = 'device' AND identity_hash = ?)
        LIMIT 1
      `).get(ipHash, deviceHash) as ExistingCooldownRow | undefined;

      if (existing) {
        return undefined;
      }

      const insert = this.database.prepare(`
        INSERT INTO demo_cooldowns (identity_type, identity_hash, issued_at, expires_at, state)
        VALUES (?, ?, NULL, ?, 'reservation')
      `);
      insert.run('ip', ipHash, expiresAt);
      insert.run('device', deviceHash, expiresAt);
      return {ipHash, deviceHash, expiresAt} satisfies DemoReservation;
    });

    return transaction();
  }

  public markIssued(reservation: DemoReservation, now = new Date()): void {
    const transaction = this.database.transaction(() => {
      const result = this.database.prepare(`
        UPDATE demo_cooldowns
        SET state = 'issued', issued_at = ?
        WHERE state = 'reservation'
          AND ((identity_type = 'ip' AND identity_hash = ?)
            OR (identity_type = 'device' AND identity_hash = ?))
      `).run(now.getTime(), reservation.ipHash, reservation.deviceHash);
      if (result.changes !== 2) {
        throw new Error('Demo reservation could not be finalized');
      }
    });
    transaction();
  }

  /** Releases only a known panel rejection; transport uncertainty stays blocked. */
  public releaseKnownFailure(reservation: DemoReservation): void {
    this.database.prepare(`
      DELETE FROM demo_cooldowns
      WHERE state = 'reservation'
        AND ((identity_type = 'ip' AND identity_hash = ?)
          OR (identity_type = 'device' AND identity_hash = ?))
    `).run(reservation.ipHash, reservation.deviceHash);
  }

  public close(): void {
    this.database.close();
  }
}
