/**
 * agent.js — single-agent wrapper.
 *
 * agent.step(goal, context, run_id, stepIndex) returns an ActionProposal.
 *
 * Live path: would call an LLM and parse its response (not implemented in MVP).
 * Mock path: looks up (agent_id, stepIndex) in fixtures.
 *
 * Tool scope enforcement: proposals whose action_type is not in agent_def.tools
 * are silently dropped with a warning (design spec requirement).
 */

import { FIXTURES } from './mock/fixtures.js';
import { hashPayload } from './gateway.js';
import { makeActionProposal, MissingFixtureError } from './models.js';

export class Agent {
  /**
   * @param {import('./models.js').AgentDef} agentDef
   * @param {boolean} mock
   */
  constructor(agentDef, mock = false) {
    this.agentDef = agentDef;
    this.mock = mock;
  }

  /**
   * Produce action proposals for the current step.
   *
   * Returns an array of ActionProposal objects (may be empty if the agent
   * has no more steps or the action is out of scope).
   *
   * @param {string} goal
   * @param {Object[]} context  Accumulated results from prior agents/steps
   * @param {string} run_id
   * @param {number} stepIndex  0-based step counter for this agent
   * @returns {import('./models.js').ActionProposal[]}
   */
  step(goal, context, run_id, stepIndex) {
    if (this.mock) {
      return this._mockStep(run_id, stepIndex);
    }
    // Live path: not implemented in MVP — return empty proposals
    process.stderr.write(`[agent:${this.agentDef.id}] Live LLM path not implemented; no proposals generated.\n`);
    return [];
  }

  _mockStep(run_id, stepIndex) {
    const key = `${this.agentDef.id}:${stepIndex}`;
    const entry = FIXTURES[key];

    if (!entry) {
      // No fixture for this step → agent is done (not an error)
      return [];
    }

    const { action_type, payload } = entry;

    // Tool scope enforcement
    if (!this.agentDef.tools.includes(action_type)) {
      process.stderr.write(
        `[agent:${this.agentDef.id}] Dropping out-of-scope action "${action_type}" ` +
        `(allowed: ${this.agentDef.tools.join(', ')})\n`
      );
      return [];
    }

    const proposal = makeActionProposal({
      run_id,
      agent_id: this.agentDef.id,
      action_type,
      payload,
      payload_hash: hashPayload(payload),
    });

    return [proposal];
  }
}
