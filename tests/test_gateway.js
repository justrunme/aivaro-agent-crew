/**
 * tests/test_gateway.js — unit tests for gateway hash protocol and approval flow.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { hashPayload, requestApproval } from '../src/gateway.js';
import { initDb } from '../src/audit.js';
import { mockClock } from '../src/mock/clock.js';
import { makeActionProposal, RejectedError } from '../src/models.js';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

// ---------------------------------------------------------------------------
// Hash protocol tests (T-05)
// ---------------------------------------------------------------------------

test('hashPayload: same payload same order → same hash', () => {
  const a = hashPayload({ query: 'hello', limit: 5 });
  const b = hashPayload({ query: 'hello', limit: 5 });
  assert.equal(a, b);
});

test('hashPayload: same payload different insertion order → same hash (sort_keys)', () => {
  const a = hashPayload({ limit: 5, query: 'hello' });
  const b = hashPayload({ query: 'hello', limit: 5 });
  assert.equal(a, b);
});

test('hashPayload: mutated value → different hash', () => {
  const a = hashPayload({ query: 'hello' });
  const b = hashPayload({ query: 'world' });
  assert.notEqual(a, b);
});

test('hashPayload: extra key → different hash', () => {
  const a = hashPayload({ query: 'hello' });
  const b = hashPayload({ query: 'hello', extra: true });
  assert.notEqual(a, b);
});

test('hashPayload: nested objects are also key-sorted', () => {
  const a = hashPayload({ z: { b: 2, a: 1 }, a: 1 });
  const b = hashPayload({ a: 1, z: { a: 1, b: 2 } });
  assert.equal(a, b);
});

test('hashPayload: returns a 64-char hex string', () => {
  const h = hashPayload({ x: 1 });
  assert.match(h, /^[0-9a-f]{64}$/);
});

// ---------------------------------------------------------------------------
// Gateway request flow tests (T-06)
// ---------------------------------------------------------------------------

function makeTestDb() {
  const path = join(tmpdir(), `aivaro-test-${randomUUID()}.db`);
  return initDb(path);
}

function makeTestProposal(overrides = {}) {
  const payload = overrides.payload ?? { query: 'test' };
  return makeActionProposal({
    run_id: 'run-test',
    agent_id: 'test-agent',
    action_type: overrides.action_type ?? 'web_search',
    payload,
    payload_hash: hashPayload(payload),
    ...overrides,
  });
}

function makeInput(text) {
  return Readable.from([text]);
}

test('requestApproval: auto-approve-safe approves listed action without prompting', async () => {
  const db = makeTestDb();
  const clock = mockClock();
  const proposal = makeTestProposal({ action_type: 'web_search' });
  const config = { mode: 'auto-approve-safe', safe_actions: ['web_search'] };

  const record = await requestApproval(proposal, config, db, clock, {
    input: makeInput(''),  // should not be read
    output: { write: () => {} },
  });

  assert.equal(record.proposal_hash, proposal.payload_hash);
  assert.equal(record.approved_by, 'auto-safe');
  assert.ok(record.approved_at);
});

test('requestApproval: auto-approve-safe falls through to CLI for unlisted action', async () => {
  const db = makeTestDb();
  const clock = mockClock();
  const proposal = makeTestProposal({ action_type: 'write_file', payload: { path: 'x.txt', content: '' } });
  // write_file is NOT in safe_actions, so CLI prompt should fire
  const config = { mode: 'auto-approve-safe', safe_actions: ['web_search'] };

  const outputBuf = [];
  const record = await requestApproval(proposal, config, db, clock, {
    input: makeInput('y\n'),
    output: { write: s => outputBuf.push(s) },
  });

  assert.equal(record.proposal_hash, proposal.payload_hash);
  assert.match(record.approved_by, /^cli:/);
  assert.ok(outputBuf.some(s => s.includes('Approval Gateway')));
});

test('requestApproval: CLI "y" → approved', async () => {
  const db = makeTestDb();
  const clock = mockClock();
  const proposal = makeTestProposal();
  const config = { mode: 'cli', safe_actions: [] };

  const record = await requestApproval(proposal, config, db, clock, {
    input: makeInput('y\n'),
    output: { write: () => {} },
  });

  assert.equal(record.proposal_hash, proposal.payload_hash);
  assert.match(record.approved_by, /^cli:/);
});

test('requestApproval: CLI "n" → RejectedError', async () => {
  const db = makeTestDb();
  const clock = mockClock();
  const proposal = makeTestProposal();
  const config = { mode: 'cli', safe_actions: [] };

  await assert.rejects(
    () => requestApproval(proposal, config, db, clock, {
      input: makeInput('n\n'),
      output: { write: () => {} },
    }),
    err => {
      assert.ok(err instanceof RejectedError);
      assert.equal(err.proposal_hash, proposal.payload_hash);
      return true;
    }
  );
});

test('requestApproval: EOF (empty input) → RejectedError (fail-closed)', async () => {
  const db = makeTestDb();
  const clock = mockClock();
  const proposal = makeTestProposal();
  const config = { mode: 'cli', safe_actions: [] };

  await assert.rejects(
    () => requestApproval(proposal, config, db, clock, {
      input: makeInput(''),
      output: { write: () => {} },
    }),
    RejectedError
  );
});

test('requestApproval: CLI approval writes action_approved event to DB', async () => {
  const db = makeTestDb();
  const clock = mockClock();
  const proposal = makeTestProposal();
  const config = { mode: 'cli', safe_actions: [] };

  await requestApproval(proposal, config, db, clock, {
    input: makeInput('y\n'),
    output: { write: () => {} },
  });

  const rows = db.prepare("SELECT * FROM events WHERE event_type='action_approved'").all();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].agent_id, 'test-agent');
});

test('requestApproval: rejection writes action_rejected event to DB', async () => {
  const db = makeTestDb();
  const clock = mockClock();
  const proposal = makeTestProposal();
  const config = { mode: 'cli', safe_actions: [] };

  await assert.rejects(
    () => requestApproval(proposal, config, db, clock, {
      input: makeInput('n\n'),
      output: { write: () => {} },
    }),
    RejectedError
  );

  const rows = db.prepare("SELECT * FROM events WHERE event_type='action_rejected'").all();
  assert.equal(rows.length, 1);
});
