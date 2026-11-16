/**
 * tests/test_executor.js — unit tests for the action executor.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execute } from '../src/executor.js';
import { hashPayload } from '../src/gateway.js';
import { initDb } from '../src/audit.js';
import { mockClock } from '../src/mock/clock.js';
import { makeActionProposal, makeApprovalRecord } from '../src/models.js';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

function tmpDb() {
  return initDb(join(tmpdir(), `aivaro-exec-test-${randomUUID()}.db`));
}

function makeProposal(payload, action_type = 'web_search') {
  return makeActionProposal({
    run_id: 'run-exec',
    agent_id: 'test-agent',
    action_type,
    payload,
    payload_hash: hashPayload(payload),
  });
}

function makeApproval(hash) {
  return makeApprovalRecord({
    proposal_hash: hash,
    approved_by: 'cli:test',
    approved_at: new Date().toISOString(),
  });
}

test('execute: mock path returns fixture tool_result', async () => {
  const db = tmpDb();
  const clock = mockClock();
  const payload = { query: 'hello' };
  const proposal = makeProposal(payload);
  const approval = makeApproval(proposal.payload_hash);

  const result = await execute(proposal, approval, db, clock, {
    mock: true,
    mockResult: { results: [{ title: 'Test', url: 'https://test.example' }] },
  });

  assert.deepEqual(result, { results: [{ title: 'Test', url: 'https://test.example' }] });
});

test('execute: logs action_executed on success', async () => {
  const db = tmpDb();
  const clock = mockClock();
  const payload = { query: 'hello' };
  const proposal = makeProposal(payload);
  const approval = makeApproval(proposal.payload_hash);

  await execute(proposal, approval, db, clock, { mock: true, mockResult: { ok: true } });

  const rows = db.prepare("SELECT * FROM events WHERE event_type='action_executed'").all();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].agent_id, 'test-agent');
});

test('execute: hash mismatch → returns error dict and logs action_failed', async () => {
  const db = tmpDb();
  const clock = mockClock();
  const payload = { query: 'hello' };
  const proposal = makeProposal(payload);
  // Approval has the wrong hash
  const tampered = makeApprovalRecord({
    proposal_hash: hashPayload({ query: 'different payload' }),
    approved_by: 'cli:test',
    approved_at: new Date().toISOString(),
  });

  const result = await execute(proposal, tampered, db, clock, { mock: true });

  assert.ok(result.error, 'should return error dict');
  assert.equal(result.reason, 'hash_mismatch');

  const rows = db.prepare("SELECT * FROM events WHERE event_type='action_failed'").all();
  assert.equal(rows.length, 1);
  const p = JSON.parse(rows[0].payload);
  assert.equal(p.reason, 'hash_mismatch');
});

test('execute: tool exception → returns error dict, logs action_failed, does not rethrow', async () => {
  const db = tmpDb();
  const clock = mockClock();
  const payload = { query: 'boom' };
  const proposal = makeProposal(payload, 'web_search');
  const approval = makeApproval(proposal.payload_hash);

  // Live mode; web_search stub succeeds normally, so we craft a mock that throws
  // by passing an opts.mock=false and a tool that doesn't exist
  const badProposal = makeActionProposal({
    run_id: 'run-exec',
    agent_id: 'test-agent',
    action_type: 'nonexistent_tool',
    payload,
    payload_hash: hashPayload(payload),
  });
  const badApproval = makeApproval(badProposal.payload_hash);

  const result = await execute(badProposal, badApproval, db, clock, { mock: false });

  assert.ok(result.error);
  const rows = db.prepare("SELECT * FROM events WHERE event_type='action_failed'").all();
  assert.equal(rows.length, 1);
});

test('execute: approved hash is proposal_hash (non-transferable)', async () => {
  const db = tmpDb();
  const clock = mockClock();
  const payload_a = { action: 'a' };
  const payload_b = { action: 'b' };
  const proposal_a = makeProposal(payload_a, 'web_search');
  // Approval from action_a used on action_b
  const wrong_approval = makeApproval(proposal_a.payload_hash);
  const proposal_b = makeProposal(payload_b, 'web_search');

  const result = await execute(proposal_b, wrong_approval, db, clock, { mock: true });
  assert.equal(result.reason, 'hash_mismatch');
});
