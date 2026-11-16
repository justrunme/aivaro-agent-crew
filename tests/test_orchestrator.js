/**
 * tests/test_orchestrator.js — integration tests for the orchestrator.
 *
 * Uses mock mode and auto-approve-safe so no stdin interaction is needed.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runCrew } from '../src/orchestrator.js';
import { initDb, getRunEvents } from '../src/audit.js';
import { mockClock } from '../src/mock/clock.js';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

function tmpDb() {
  return initDb(join(tmpdir(), `aivaro-orch-test-${randomUUID()}.db`));
}

// Full three-agent research crew definition matching the fixtures
const RESEARCH_CREW = {
  name: 'Research Crew',
  goal: 'Summarize formal verification of LLM outputs',
  agents: [
    { id: 'researcher', role: 'Web Researcher',   tools: ['web_search', 'fetch_url'], model: 'mock' },
    { id: 'analyst',    role: 'Analyst',           tools: ['read_file', 'write_file'], model: 'mock' },
    { id: 'writer',     role: 'Technical Writer',  tools: ['write_file'],              model: 'mock' },
  ],
  approval: { mode: 'auto-approve-safe', safe_actions: ['web_search', 'fetch_url', 'write_file', 'read_file'] },
};

test('orchestrator: mock run completes with correct summary counts', async () => {
  const db = tmpDb();
  const clock = mockClock();

  const summary = await runCrew(RESEARCH_CREW, db, clock, { mock: true });

  assert.ok(summary.run_id);
  assert.equal(summary.agents_run, 3);
  // researcher has 2 steps, analyst has 1, writer has 1 → 4 approved actions
  assert.equal(summary.approved, 4);
  assert.equal(summary.rejected, 0);
  assert.equal(summary.errors, 0);
});

test('orchestrator: audit log contains run_start and run_end', async () => {
  const db = tmpDb();
  const clock = mockClock();

  const summary = await runCrew(RESEARCH_CREW, db, clock, { mock: true });
  const events = getRunEvents(db, summary.run_id);

  const types = events.map(e => e.event_type);
  assert.ok(types.includes('run_start'));
  assert.ok(types.includes('run_end'));
});

test('orchestrator: audit log contains action_proposed and action_executed for each approved action', async () => {
  const db = tmpDb();
  const clock = mockClock();

  const summary = await runCrew(RESEARCH_CREW, db, clock, { mock: true });
  const events = getRunEvents(db, summary.run_id);
  const types = events.map(e => e.event_type);

  const proposed = types.filter(t => t === 'action_proposed').length;
  const executed = types.filter(t => t === 'action_executed').length;
  const approved = types.filter(t => t === 'action_approved').length;

  assert.equal(proposed, 4);
  assert.equal(approved, 4);
  assert.equal(executed, 4);
});

test('orchestrator: rejected action does not crash run', async () => {
  const db = tmpDb();
  const clock = mockClock();

  // Use a crew where the first action is NOT in safe_actions, backed by a mock input that says 'n'
  const crew = {
    ...RESEARCH_CREW,
    approval: { mode: 'auto-approve-safe', safe_actions: [] }, // nothing auto-approved
  };

  // All proposals will fall through to CLI; we supply 'n' for all of them
  const { Readable } = await import('node:stream');
  // 4 proposals → 4 prompts → supply 4 'n' answers
  const input = Readable.from(['n\n', 'n\n', 'n\n', 'n\n'].join(''));

  const summary = await runCrew(crew, db, clock, {
    mock: true,
    gatewayOpts: { input, output: { write: () => {} } },
  });

  assert.equal(summary.rejected, 4);
  assert.equal(summary.approved, 0);
  assert.equal(summary.errors, 0);
  assert.equal(summary.agents_run, 3);
});

test('orchestrator: mock mode is deterministic across two runs', async () => {
  const db1 = tmpDb();
  const clock1 = mockClock();
  const s1 = await runCrew(RESEARCH_CREW, db1, clock1, { mock: true });

  const db2 = tmpDb();
  const clock2 = mockClock();
  const s2 = await runCrew(RESEARCH_CREW, db2, clock2, { mock: true });

  // Summary counts must be identical (run_id differs because it's a UUID)
  assert.equal(s1.agents_run, s2.agents_run);
  assert.equal(s1.approved,   s2.approved);
  assert.equal(s1.rejected,   s2.rejected);
  assert.equal(s1.errors,     s2.errors);

  // Event sequences must have same types in same order
  const e1 = getRunEvents(db1, s1.run_id).map(e => e.event_type);
  const e2 = getRunEvents(db2, s2.run_id).map(e => e.event_type);
  assert.deepEqual(e1, e2);
});

test('orchestrator: single-agent crew runs correctly', async () => {
  const db = tmpDb();
  const clock = mockClock();
  const crew = {
    name: 'Mini Crew',
    goal: 'Test single agent',
    agents: [
      { id: 'writer', role: 'Technical Writer', tools: ['write_file'], model: 'mock' },
    ],
    approval: { mode: 'auto-approve-safe', safe_actions: ['write_file'] },
  };

  const summary = await runCrew(crew, db, clock, { mock: true });
  assert.equal(summary.agents_run, 1);
  assert.equal(summary.approved, 1);
  assert.equal(summary.errors, 0);
});
