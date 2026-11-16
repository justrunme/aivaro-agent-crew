/**
 * tests/test_parser.js — unit tests for the YAML crew file parser.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseYaml, parseCrew } from '../src/parser.js';
import { resolve } from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

function tmpYaml(content) {
  const dir = join(tmpdir(), `aivaro-parser-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, 'crew.yaml');
  writeFileSync(path, content, 'utf8');
  return path;
}

// ---------------------------------------------------------------------------
// YAML parser unit tests
// ---------------------------------------------------------------------------

test('parseYaml: simple key-value', () => {
  const result = parseYaml('name: My Crew\ngoal: Do something');
  assert.equal(result.name, 'My Crew');
  assert.equal(result.goal, 'Do something');
});

test('parseYaml: quoted strings', () => {
  const result = parseYaml('goal: "Summarize the latest research"');
  assert.equal(result.goal, 'Summarize the latest research');
});

test('parseYaml: inline sequence', () => {
  const result = parseYaml('tools: [web_search, fetch_url]');
  assert.deepEqual(result.tools, ['web_search', 'fetch_url']);
});

test('parseYaml: comments are stripped', () => {
  const result = parseYaml('name: Test # this is a comment\ngoal: Work');
  assert.equal(result.name, 'Test');
});

test('parseYaml: nested mapping', () => {
  const result = parseYaml('approval:\n  mode: cli\n  safe_actions: []');
  assert.equal(result.approval.mode, 'cli');
  assert.deepEqual(result.approval.safe_actions, []);
});

test('parseYaml: block sequence of mappings', () => {
  const yaml = `agents:
  - id: agent1
    role: Researcher
    tools: [web_search]
    model: mock
  - id: agent2
    role: Writer
    tools: [write_file]
    model: mock
`;
  const result = parseYaml(yaml);
  assert.equal(result.agents.length, 2);
  assert.equal(result.agents[0].id, 'agent1');
  assert.equal(result.agents[1].id, 'agent2');
});

// ---------------------------------------------------------------------------
// parseCrew integration tests
// ---------------------------------------------------------------------------

test('parseCrew: valid research-crew.yaml parses successfully', () => {
  const path = resolve('examples/research-crew.yaml');
  const crew = parseCrew(path);
  assert.equal(crew.name, 'Research Crew');
  assert.ok(crew.goal.length > 0);
  assert.equal(crew.agents.length, 3);
  assert.equal(crew.agents[0].id, 'researcher');
  assert.equal(crew.agents[1].id, 'analyst');
  assert.equal(crew.agents[2].id, 'writer');
  assert.equal(crew.approval.mode, 'auto-approve-safe');
});

test('parseCrew: rejects file that does not exist', () => {
  assert.throws(() => parseCrew('/nonexistent/path/crew.yaml'), /not found/);
});

test('parseCrew: rejects crew with duplicate agent IDs', () => {
  const path = tmpYaml(`
name: Bad Crew
goal: Test
agents:
  - id: alpha
    role: First
    tools: [web_search]
    model: mock
  - id: alpha
    role: Duplicate
    tools: [web_search]
    model: mock
approval:
  mode: cli
  safe_actions: []
`);
  assert.throws(() => parseCrew(path), /duplicate agent id/);
});

test('parseCrew: rejects crew with unknown tool name', () => {
  const path = tmpYaml(`
name: Bad Crew
goal: Test
agents:
  - id: alpha
    role: First
    tools: [nonexistent_tool]
    model: mock
approval:
  mode: cli
  safe_actions: []
`);
  assert.throws(() => parseCrew(path), /unknown tool/);
});

test('parseCrew: rejects crew missing required "goal" field', () => {
  const path = tmpYaml(`
name: Incomplete
agents:
  - id: alpha
    role: First
    tools: [web_search]
    model: mock
approval:
  mode: cli
  safe_actions: []
`);
  assert.throws(() => parseCrew(path), /goal/);
});

test('parseCrew: rejects crew with invalid approval mode', () => {
  const path = tmpYaml(`
name: Bad Mode
goal: Test
agents:
  - id: alpha
    role: First
    tools: [web_search]
    model: mock
approval:
  mode: invalid_mode
  safe_actions: []
`);
  assert.throws(() => parseCrew(path), /mode/);
});
