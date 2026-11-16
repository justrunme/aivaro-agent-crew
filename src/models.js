/**
 * models.js — shared data structures for Aivaro Agent Crew.
 *
 * All "classes" here are plain objects validated by factory functions.
 * No external dependencies.
 */

import { randomUUID } from 'node:crypto';

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function requireString(obj, key, context) {
  if (typeof obj[key] !== 'string' || obj[key].trim() === '') {
    throw new Error(`${context}: "${key}" must be a non-empty string`);
  }
}

function requireArray(obj, key, context) {
  if (!Array.isArray(obj[key])) {
    throw new Error(`${context}: "${key}" must be an array`);
  }
}

// ---------------------------------------------------------------------------
// AgentDef
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} AgentDef
 * @property {string} id
 * @property {string} role
 * @property {string[]} tools
 * @property {string} model
 */

export function makeAgentDef(raw) {
  const ctx = `AgentDef(id=${raw?.id ?? '<unknown>'})`;
  requireString(raw, 'id', ctx);
  requireString(raw, 'role', ctx);
  requireString(raw, 'model', ctx);
  requireArray(raw, 'tools', ctx);
  for (const t of raw.tools) {
    if (typeof t !== 'string' || t.trim() === '') {
      throw new Error(`${ctx}: every entry in "tools" must be a non-empty string`);
    }
  }
  return { id: raw.id.trim(), role: raw.role.trim(), tools: raw.tools.map(t => t.trim()), model: raw.model.trim() };
}

// ---------------------------------------------------------------------------
// ApprovalConfig
// ---------------------------------------------------------------------------

const APPROVAL_MODES = new Set(['cli', 'mcp', 'auto-approve-safe']);

/**
 * @typedef {Object} ApprovalConfig
 * @property {'cli'|'mcp'|'auto-approve-safe'} mode
 * @property {string[]} safe_actions
 */

export function makeApprovalConfig(raw) {
  const ctx = 'ApprovalConfig';
  requireString(raw, 'mode', ctx);
  if (!APPROVAL_MODES.has(raw.mode)) {
    throw new Error(`${ctx}: "mode" must be one of ${[...APPROVAL_MODES].join(', ')}`);
  }
  const safe = raw.safe_actions ?? [];
  if (!Array.isArray(safe)) {
    throw new Error(`${ctx}: "safe_actions" must be an array`);
  }
  return { mode: raw.mode, safe_actions: safe.map(String) };
}

// ---------------------------------------------------------------------------
// CrewDef
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} CrewDef
 * @property {string} name
 * @property {string} goal
 * @property {AgentDef[]} agents
 * @property {ApprovalConfig} approval
 */

export function makeCrewDef(raw, knownTools) {
  const ctx = 'CrewDef';
  requireString(raw, 'name', ctx);
  requireString(raw, 'goal', ctx);
  requireArray(raw, 'agents', ctx);
  if (raw.agents.length === 0) {
    throw new Error(`${ctx}: "agents" must contain at least one agent`);
  }
  if (!raw.approval || typeof raw.approval !== 'object') {
    throw new Error(`${ctx}: "approval" block is required`);
  }

  const agents = raw.agents.map(a => makeAgentDef(a));

  // Reject duplicate agent IDs
  const seen = new Set();
  for (const a of agents) {
    if (seen.has(a.id)) throw new Error(`${ctx}: duplicate agent id "${a.id}"`);
    seen.add(a.id);
  }

  // Reject unknown tool names when a registry is provided
  if (knownTools) {
    for (const a of agents) {
      for (const t of a.tools) {
        if (!knownTools.has(t)) {
          throw new Error(`${ctx}: agent "${a.id}" references unknown tool "${t}"`);
        }
      }
    }
  }

  const approval = makeApprovalConfig(raw.approval);
  return { name: raw.name.trim(), goal: raw.goal.trim(), agents, approval };
}

// ---------------------------------------------------------------------------
// ActionProposal
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} ActionProposal
 * @property {string} run_id
 * @property {string} agent_id
 * @property {string} action_type
 * @property {Object} payload
 * @property {string} payload_hash  SHA-256 hex of canonical JSON of payload
 */

export function makeActionProposal({ run_id, agent_id, action_type, payload, payload_hash }) {
  if (!run_id || !agent_id || !action_type || !payload || !payload_hash) {
    throw new Error('makeActionProposal: all fields are required');
  }
  return { run_id, agent_id, action_type, payload, payload_hash };
}

// ---------------------------------------------------------------------------
// ApprovalRecord
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} ApprovalRecord
 * @property {string} proposal_hash  Must equal ActionProposal.payload_hash at execution time
 * @property {string} approved_by   e.g. "cli:alice", "auto-safe", "mcp:<token>"
 * @property {string} approved_at   ISO 8601 UTC
 */

export function makeApprovalRecord({ proposal_hash, approved_by, approved_at }) {
  if (!proposal_hash || !approved_by || !approved_at) {
    throw new Error('makeApprovalRecord: all fields are required');
  }
  return { proposal_hash, approved_by, approved_at };
}

// ---------------------------------------------------------------------------
// AuditEvent
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} AuditEvent
 * @property {string} event_id    UUID4
 * @property {string} run_id
 * @property {string} occurred_at ISO 8601 UTC
 * @property {string} event_type  one of the FR-5.3 types
 * @property {string|null} agent_id
 * @property {Object} payload
 */

const VALID_EVENT_TYPES = new Set([
  'run_start', 'run_end',
  'action_proposed', 'action_approved', 'action_rejected',
  'action_executed', 'action_failed',
]);

export function makeAuditEvent({ run_id, occurred_at, event_type, agent_id = null, payload = {} }) {
  if (!VALID_EVENT_TYPES.has(event_type)) {
    throw new Error(`makeAuditEvent: unknown event_type "${event_type}"`);
  }
  return {
    event_id: randomUUID(),
    run_id,
    occurred_at,
    event_type,
    agent_id: agent_id ?? null,
    payload,
  };
}

// ---------------------------------------------------------------------------
// RunSummary
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} RunSummary
 * @property {string} run_id
 * @property {number} agents_run
 * @property {number} approved
 * @property {number} rejected
 * @property {number} errors
 */

export function makeRunSummary({ run_id, agents_run, approved, rejected, errors }) {
  return { run_id, agents_run, approved, rejected, errors };
}

// ---------------------------------------------------------------------------
// Custom errors
// ---------------------------------------------------------------------------

export class RejectedError extends Error {
  constructor(proposal_hash) {
    super(`Action rejected (hash=${proposal_hash})`);
    this.name = 'RejectedError';
    this.proposal_hash = proposal_hash;
  }
}

export class HashMismatchError extends Error {
  constructor(expected, actual) {
    super(`Hash mismatch: approval has ${expected}, recomputed ${actual}`);
    this.name = 'HashMismatchError';
    this.expected = expected;
    this.actual = actual;
  }
}

export class UnknownToolError extends Error {
  constructor(name) {
    super(`Unknown tool: "${name}"`);
    this.name = 'UnknownToolError';
  }
}

export class MissingFixtureError extends Error {
  constructor(agent_id, step) {
    super(`No fixture for agent "${agent_id}" step ${step}`);
    this.name = 'MissingFixtureError';
  }
}
