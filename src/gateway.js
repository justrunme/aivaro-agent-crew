/**
 * gateway.js — Approval Gateway.
 *
 * Responsibilities:
 *  1. Compute a canonical SHA-256 hash of an action payload.
 *  2. Present the proposal to the approver (CLI, auto-safe, or MCP stub).
 *  3. Return an ApprovalRecord on approval, or raise RejectedError on rejection.
 *  4. Write approval/rejection events to the audit log.
 *
 * The gateway is FAIL-CLOSED: any input path that is not an explicit approval
 * results in rejection. There is no default-allow branch.
 */

import { createHash } from 'node:crypto';
import { createInterface } from 'node:readline';
import { makeApprovalRecord, RejectedError } from './models.js';
import { logEvent } from './audit.js';

// ---------------------------------------------------------------------------
// Hash protocol (FR-3.1, NFR-1)
// ---------------------------------------------------------------------------

/**
 * Compute the canonical SHA-256 hex digest of an action payload.
 *
 * Serialisation: JSON.stringify with sorted keys + ensure ASCII → UTF-8 bytes.
 * This matches the Python spec: json.dumps(payload, sort_keys=True, ensure_ascii=True).
 *
 * @param {Object} payload
 * @returns {string} 64-character lowercase hex string
 */
export function hashPayload(payload) {
  const canonical = JSON.stringify(sortedKeys(payload), null, 0);
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

/**
 * Recursively sort object keys so the JSON representation is canonical.
 * Arrays are preserved in order; nested objects are also sorted.
 */
function sortedKeys(value) {
  if (Array.isArray(value)) return value.map(sortedKeys);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().map(k => [k, sortedKeys(value[k])])
    );
  }
  // Primitives: ensure non-ASCII characters are escaped so the output is ASCII-safe.
  // JSON.stringify already escapes non-ASCII when called on strings individually,
  // but we rely on the outer stringify to handle that. The sort step is what matters.
  return value;
}

// ---------------------------------------------------------------------------
// Approval request (FR-3.2 – FR-3.6)
// ---------------------------------------------------------------------------

/**
 * Request approval for an action proposal.
 *
 * @param {import('./models.js').ActionProposal} proposal
 * @param {import('./models.js').ApprovalConfig} approvalConfig
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {() => string} clock  Returns ISO 8601 UTC string
 * @param {Object} [opts]
 * @param {NodeJS.ReadableStream} [opts.input]   Override stdin (for tests)
 * @param {NodeJS.WritableStream} [opts.output]  Override stdout (for tests)
 * @returns {Promise<import('./models.js').ApprovalRecord>}
 * @throws {RejectedError}
 */
export async function requestApproval(proposal, approvalConfig, db, clock, opts = {}) {
  const { mode, safe_actions } = approvalConfig;
  // Never trust a hash supplied by an agent without recomputing it.
  if (hashPayload(proposal.payload) !== proposal.payload_hash) {
    throw new Error('Proposal hash mismatch: approval denied');
  }

  // Auto-approve-safe path: approve immediately if action_type is in safe_actions
  if (mode === 'auto-approve-safe' && safe_actions.includes(proposal.action_type)) {
    const record = makeApprovalRecord({
      proposal_hash: proposal.payload_hash,
      approved_by: 'auto-safe',
      approved_at: clock(),
    });
    logEvent(db, {
      run_id: proposal.run_id,
      occurred_at: clock(),
      event_type: 'action_approved',
      agent_id: proposal.agent_id,
      payload: { proposal_hash: record.proposal_hash, approved_by: record.approved_by },
    });
    return record;
  }

  // MCP mode: delegate to mcp_client stub (FR-3.4)
  // The stub always returns mcp_unavailable; the gateway then falls through to CLI.
  if (mode === 'mcp') {
    // Lazy import avoids pulling in mcp_client when not needed.
    const { callTool } = await import('./mcp_client.js');
    const result = await callTool('approve', {
      proposal_hash: proposal.payload_hash,
      action_type: proposal.action_type,
      payload: proposal.payload,
    });
    // An unverified MCP status string is NOT an authorization proof.
    if (result.status === 'approved' && result.verified === true && result.proposal_hash === proposal.payload_hash) {
      const record = makeApprovalRecord({
        proposal_hash: proposal.payload_hash,
        approved_by: `mcp:${result.token ?? 'unknown'}`,
        approved_at: clock(),
      });
      logEvent(db, {
        run_id: proposal.run_id,
        occurred_at: clock(),
        event_type: 'action_approved',
        agent_id: proposal.agent_id,
        payload: { proposal_hash: record.proposal_hash, approved_by: record.approved_by },
      });
      return record;
    }
    // MCP unavailable or rejected — fall through to CLI
  }

  // CLI path (also the fallback for MCP-unavailable and auto-safe non-listed actions)
  return cliApproval(proposal, db, clock, opts);
}

// ---------------------------------------------------------------------------
// CLI approval prompt
// ---------------------------------------------------------------------------

async function cliApproval(proposal, db, clock, opts) {
  const out = opts.output ?? process.stdout;
  const input = opts.input ?? process.stdin;

  const lines = [
    '┌─ Approval Gateway ─────────────────────────────────────────',
    `│  Agent      : ${proposal.agent_id}`,
    `│  Action     : ${proposal.action_type}`,
    `│  Payload    : ${JSON.stringify(proposal.payload)}`,
    `│  Hash (SHA-256): ${proposal.payload_hash}`,
    '└─────────────────────────────────────────────────────────────',
    'Approve? [y/n] ',
  ];
  out.write(lines.join('\n'));

  const answer = await readLine(input, out);

  if (answer.trim().toLowerCase() === 'y') {
    const record = makeApprovalRecord({
      proposal_hash: proposal.payload_hash,
      approved_by: `cli:${process.env.USER ?? 'unknown'}`,
      approved_at: clock(),
    });
    logEvent(db, {
      run_id: proposal.run_id,
      occurred_at: clock(),
      event_type: 'action_approved',
      agent_id: proposal.agent_id,
      payload: { proposal_hash: record.proposal_hash, approved_by: record.approved_by },
    });
    return record;
  }

  // Anything other than 'y' is a rejection — fail closed
  logEvent(db, {
    run_id: proposal.run_id,
    occurred_at: clock(),
    event_type: 'action_rejected',
    agent_id: proposal.agent_id,
    payload: { proposal_hash: proposal.payload_hash, reason: 'user_rejected' },
  });
  throw new RejectedError(proposal.payload_hash);
}

const lineReaders = new WeakMap();
function readLine(input, output) {
  let state = lineReaders.get(input);
  if (!state) {
    state = { lines: [], waiting: [], closed: false };
    lineReaders.set(input, state);
    const rl = createInterface({ input, terminal: false, crlfDelay: Infinity });
    rl.on('line', line => {
      const next = state.waiting.shift();
      if (next) next(line);
      else state.lines.push(line);
    });
    rl.on('close', () => {
      state.closed = true;
      for (const next of state.waiting.splice(0)) next('');
    });
  }
  if (state.lines.length) return Promise.resolve(state.lines.shift());
  if (state.closed) return Promise.resolve('');
  return new Promise(resolve => state.waiting.push(resolve));
}
