/**
 * tests/test_audit.js — unit tests for the audit log module.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initDb, logEvent, getRunEvents } from '../src/audit.js';
import { mockClock } from '../src/mock/clock.js';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

function tmpDb() {
  return join(tmpdir(), `aivaro-audit-test-${randomUUID()}.db`);
}

test('initDb: creates schema idempotently', () => {
  const path = tmpDb();
  const db1 = initDb(path);
  const db2 = initDb(path); // second call on same file
  // Both should succeed; table should exist
  const rows = db1.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  assert.ok(rows.some(r => r.name === 'events'));
  db1.close();
  db2.close();
});

test('logEvent: appends a row with correct fields', () => {
  const db = initDb(tmpDb());
  const clock = mockClock();
  const run_id = randomUUID();

  const event = logEvent(db, {
    run_id,
    occurred_at: clock(),
    event_type: 'run_start',
    agent_id: null,
    payload: { crew_name: 'Test Crew' },
  });

  assert.ok(event.event_id);
  assert.equal(event.run_id, run_id);
  assert.equal(event.event_type, 'run_start');
  assert.equal(event.agent_id, null);

  const rows = db.prepare('SELECT * FROM events').all();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].run_id, run_id);
  assert.equal(rows[0].event_type, 'run_start');
  assert.deepEqual(JSON.parse(rows[0].payload), { crew_name: 'Test Crew' });
  db.close();
});

test('logEvent: multiple appends accumulate (no UPDATE/DELETE)', () => {
  const db = initDb(tmpDb());
  const clock = mockClock();
  const run_id = randomUUID();

  const types = ['run_start', 'action_proposed', 'action_approved', 'action_executed', 'run_end'];
  for (const event_type of types) {
    logEvent(db, { run_id, occurred_at: clock(), event_type, agent_id: null, payload: {} });
  }

  const rows = db.prepare('SELECT event_type FROM events ORDER BY occurred_at').all();
  assert.deepEqual(rows.map(r => r.event_type), types);
  db.close();
});

test('logEvent: each event has a unique event_id', () => {
  const db = initDb(tmpDb());
  const clock = mockClock();
  const run_id = randomUUID();

  for (let i = 0; i < 5; i++) {
    logEvent(db, { run_id, occurred_at: clock(), event_type: 'run_start', agent_id: null, payload: {} });
  }

  const ids = db.prepare('SELECT event_id FROM events').all().map(r => r.event_id);
  assert.equal(new Set(ids).size, 5);
  db.close();
});

test('getRunEvents: returns only events for the given run_id', () => {
  const db = initDb(tmpDb());
  const clock = mockClock();
  const run_a = randomUUID();
  const run_b = randomUUID();

  logEvent(db, { run_id: run_a, occurred_at: clock(), event_type: 'run_start', agent_id: null, payload: {} });
  logEvent(db, { run_id: run_b, occurred_at: clock(), event_type: 'run_start', agent_id: null, payload: {} });
  logEvent(db, { run_id: run_a, occurred_at: clock(), event_type: 'run_end',   agent_id: null, payload: {} });

  const events = getRunEvents(db, run_a);
  assert.equal(events.length, 2);
  assert.ok(events.every(e => e.run_id === run_a));
  db.close();
});

test('logEvent: rejects unknown event_type', () => {
  const db = initDb(tmpDb());
  const clock = mockClock();
  assert.throws(
    () => logEvent(db, { run_id: 'x', occurred_at: clock(), event_type: 'not_a_real_type', agent_id: null, payload: {} }),
    /unknown event_type/
  );
  db.close();
});
