/**
 * executor.js — Action Executor.
 *
 * Validates that the approval record still matches the proposal (FR-4.2),
 * runs the tool, logs the outcome, and returns the result.
 *
 * Rules:
 *  - Re-hash payload before execution; abort with HashMismatchError if different.
 *  - Any tool exception is caught, logged as action_failed, and returned as an
 *    error dict — never re-raised (FR-4.4).
 *  - In mock mode the tool call is replaced by the fixture's tool_result.
 */

import { hashPayload } from './gateway.js';
import { getTool } from './tools/index.js';
import { logEvent } from './audit.js';
import { HashMismatchError } from './models.js';
import { authorizeSignedProposal } from './security/verified_gateway.js';

/**
 * Execute an approved action proposal.
 *
 * @param {import('./models.js').ActionProposal} proposal
 * @param {import('./models.js').ApprovalRecord} approval
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {() => string} clock
 * @param {Object} [opts]
 * @param {boolean} [opts.mock]           If true, use mockResult instead of real tool
 * @param {Object}  [opts.mockResult]     Pre-loaded fixture tool_result
 * @returns {Promise<Object>} Tool result dict, or error dict on failure
 */
export async function execute(proposal, approval, db, clock, opts = {}) {
  // Live execution must carry a signed, one-time capability bound to the exact proposal.
  // Legacy CLI/auto-safe approvals remain usable for mock demos only.
  if (!opts.mock) {
    if (proposal.action_type !== 'read_file') {
      logEvent(db,{run_id:proposal.run_id,occurred_at:clock(),event_type:'action_failed',agent_id:proposal.agent_id,payload:{reason:'live_tool_not_allowlisted'}});
      return {error:'Live tool not allowlisted',reason:'live_tool_not_allowlisted'};
    }
    const auth = authorizeSignedProposal(proposal, opts.capability, opts.trustedPublicKey, db);
    if (!auth.ok) {
      logEvent(db, {run_id:proposal.run_id,occurred_at:clock(),event_type:'action_failed',agent_id:proposal.agent_id,payload:{reason:'signed_capability_required',detail:auth.reason}});
      return {error:'Signed capability required for live execution',reason:auth.reason};
    }
  }
  // Re-verify hash before touching any tool (FR-4.2, NFR-1)
  const recomputed = hashPayload(proposal.payload);
  if (!approval || !approval.approved_at || !approval.approved_by || recomputed !== proposal.payload_hash || recomputed !== approval.proposal_hash) {
    const err = new HashMismatchError(approval?.proposal_hash, recomputed);
    logEvent(db, {
      run_id: proposal.run_id,
      occurred_at: clock(),
      event_type: 'action_failed',
      agent_id: proposal.agent_id,
      payload: { reason: 'hash_mismatch', expected: approval.proposal_hash, actual: recomputed },
    });
    // Return error dict — orchestrator decides what to do with it
    return { error: err.message, reason: 'hash_mismatch' };
  }

  try {
    let result;
    if (opts.mock) {
      // Mock path: return the pre-loaded fixture result without calling any tool
      result = opts.mockResult ?? { note: 'mock mode: no fixture result provided' };
    } else {
      const tool = getTool(proposal.action_type);
      result = await tool(proposal.payload);
    }

    logEvent(db, {
      run_id: proposal.run_id,
      occurred_at: clock(),
      event_type: 'action_executed',
      agent_id: proposal.agent_id,
      payload: { action_type: proposal.action_type, result_summary: summarise(result) },
    });

    return result;
  } catch (err) {
    logEvent(db, {
      run_id: proposal.run_id,
      occurred_at: clock(),
      event_type: 'action_failed',
      agent_id: proposal.agent_id,
      payload: { action_type: proposal.action_type, error: err.message },
    });
    return { error: err.message, action_type: proposal.action_type };
  }
}

/** Produce a short summary of a result object for the audit log payload. */
function summarise(result) {
  if (result === null || result === undefined) return String(result);
  if (typeof result === 'string') return result.slice(0, 200);
  const str = JSON.stringify(result);
  return str.length > 200 ? str.slice(0, 200) + '…' : str;
}
