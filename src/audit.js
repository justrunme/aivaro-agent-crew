/**
 * audit.js — append-only SQLite audit log.
 *
 * Uses node:sqlite (Node.js ≥ 22.5). No external dependencies.
 *
 * Rules:
 *  - initDb() is idempotent; safe to call multiple times.
 *  - logEvent() appends; never updates or deletes.
 *  - A SQLite write failure throws — audit integrity is non-negotiable.
 */

import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { makeAuditEvent } from './models.js';

const DEFAULT_DB_PATH = join(homedir(), '.aivaro-crew', 'audit.db');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS events (
  event_id    TEXT PRIMARY KEY,
  run_id      TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  event_type  TEXT NOT NULL,
  agent_id    TEXT,
  payload     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_run  ON events(run_id);
CREATE INDEX IF NOT EXISTS idx_type ON events(event_type);
`;

/**
 * Open (or create) the audit database and apply the schema.
 *
 * @param {string} [dbPath] Override for tests; defaults to ~/.aivaro-crew/audit.db
 * @returns {DatabaseSync} Open database handle
 */
export function initDb(dbPath = DEFAULT_DB_PATH) {
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec(SCHEMA);
  return db;
}

/**
 * Append one audit event.
 *
 * @param {DatabaseSync} db  Open database returned by initDb()
 * @param {Object} eventFields Fields passed to makeAuditEvent()
 * @returns {import('./models.js').AuditEvent} The persisted event
 * @throws If the SQLite write fails
 */
export function logEvent(db, eventFields) {
  const event = makeAuditEvent(eventFields);
  const stmt = db.prepare(
    'INSERT INTO events (event_id, run_id, occurred_at, event_type, agent_id, payload) VALUES (?,?,?,?,?,?)'
  );
  stmt.run(
    event.event_id,
    event.run_id,
    event.occurred_at,
    event.event_type,
    event.agent_id,
    JSON.stringify(event.payload),
  );
  return event;
}

/**
 * Read all events for a run, ordered by occurred_at.
 * Convenience function for tests and the CLI summary.
 *
 * @param {DatabaseSync} db
 * @param {string} run_id
 * @returns {Object[]}
 */
export function getRunEvents(db, run_id) {
  const stmt = db.prepare('SELECT * FROM events WHERE run_id = ? ORDER BY occurred_at');
  return stmt.all(run_id);
}

export { DEFAULT_DB_PATH };
