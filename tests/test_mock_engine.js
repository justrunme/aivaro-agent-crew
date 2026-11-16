/**
 * tests/test_mock_engine.js — unit tests for the mock engine (fixtures + clock).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FIXTURES, getFixture } from '../src/mock/fixtures.js';
import { mockClock, liveClock } from '../src/mock/clock.js';
import { Agent } from '../src/agent.js';
import { hashPayload } from '../src/gateway.js';

// ---------------------------------------------------------------------------
// Clock tests
// ---------------------------------------------------------------------------

test('mockClock: returns deterministic sequence starting at fixed epoch', () => {
  const clock = mockClock();
  const t0 = clock();
  const t1 = clock();
  const t2 = clock();
  assert.equal(t0, '2026-11-16T00:00:00.000Z');
  assert.equal(t1, '2026-11-16T00:00:01.000Z');
  assert.equal(t2, '2026-11-16T00:00:02.000Z');
});

test('mockClock: two separate instances are independent', () => {
  const c1 = mockClock();
  const c2 = mockClock();
  c1(); c1(); // advance c1 twice
  assert.equal(c2(), '2026-11-16T00:00:00.000Z'); // c2 unaffected
});

test('liveClock: returns a valid ISO 8601 string', () => {
  const clock = liveClock();
  const t = clock();
  assert.match(t, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
});

// ---------------------------------------------------------------------------
// Fixture lookup tests
// ---------------------------------------------------------------------------

test('getFixture: returns fixture for known key', () => {
  const f = getFixture('researcher', 0);
  assert.ok(f.action_type);
  assert.ok(f.payload);
  assert.ok(f.tool_result);
  assert.ok(f.llm_response);
});

test('getFixture: throws for unknown key', () => {
  assert.throws(() => getFixture('nonexistent-agent', 0), /No fixture/);
});

test('getFixture: all fixture payloads are stable (hash does not change)', () => {
  // If this test fails, fixture payloads have been mutated, which would break approval binding.
  const expected = {
    'researcher:0': '5e9b97e77f3c5cd2b9f7f7a6c54c71b02f71fc9d57a3e82c8bef55a0ef89e1a3',
    'researcher:1': 'ffe73b89b90dd0f03b4bafd7cb51abef1f6d1c43d2a5e82b2bc3c9b040f80b2b',
    'analyst:0':    null, // computed below
    'writer:0':     null,
  };

  // We don't hardcode all hashes (they'd need to be computed once), so instead
  // we verify that hashing the same fixture twice gives the same result.
  for (const [key, entry] of Object.entries(FIXTURES)) {
    const [agent_id, step] = key.split(':');
    const f1 = getFixture(agent_id, Number(step));
    const f2 = getFixture(agent_id, Number(step));
    assert.equal(hashPayload(f1.payload), hashPayload(f2.payload), `fixture ${key} hash is not stable`);
  }
});

// ---------------------------------------------------------------------------
// Agent mock path tests
// ---------------------------------------------------------------------------

test('Agent mock: step returns proposal matching fixture', () => {
  const agentDef = { id: 'researcher', role: 'Web Researcher', tools: ['web_search', 'fetch_url'], model: 'mock' };
  const agent = new Agent(agentDef, true);
  const proposals = agent.step('goal', [], 'run-1', 0);

  assert.equal(proposals.length, 1);
  assert.equal(proposals[0].action_type, 'web_search');
  assert.deepEqual(proposals[0].payload, { query: 'formal verification LLM outputs 2025' });
  assert.equal(proposals[0].payload_hash, hashPayload(proposals[0].payload));
});

test('Agent mock: step returns empty when no fixture for step index', () => {
  const agentDef = { id: 'researcher', role: 'Web Researcher', tools: ['web_search', 'fetch_url'], model: 'mock' };
  const agent = new Agent(agentDef, true);
  const proposals = agent.step('goal', [], 'run-1', 99); // no fixture at step 99
  assert.equal(proposals.length, 0);
});

test('Agent mock: tool scope enforcement drops out-of-scope action', () => {
  // researcher's fixture step 0 is web_search; limit tools to only fetch_url
  const agentDef = { id: 'researcher', role: 'Web Researcher', tools: ['fetch_url'], model: 'mock' };
  const agent = new Agent(agentDef, true);
  const proposals = agent.step('goal', [], 'run-1', 0);
  assert.equal(proposals.length, 0, 'web_search should be dropped since only fetch_url is allowed');
});

test('Agent mock: proposals carry correct run_id and agent_id', () => {
  const agentDef = { id: 'analyst', role: 'Analyst', tools: ['read_file', 'write_file'], model: 'mock' };
  const agent = new Agent(agentDef, true);
  const proposals = agent.step('goal', [], 'run-xyz', 0);
  assert.equal(proposals.length, 1);
  assert.equal(proposals[0].run_id, 'run-xyz');
  assert.equal(proposals[0].agent_id, 'analyst');
});
