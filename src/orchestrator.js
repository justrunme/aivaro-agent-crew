/**
 * orchestrator.js — sequential crew runner.
 *
 * Runs each agent in order, passing the cumulative context forward.
 * For each proposal: audit → gateway → executor → accumulate result.
 *
 * Handles RejectedError (skips action, continues) and unexpected errors
 * (logs action_failed, skips agent, continues run).
 */

import { randomUUID } from 'node:crypto';
import { Agent } from './agent.js';
import { requestApproval } from './gateway.js';
import { execute } from './executor.js';
import { logEvent, getRunEvents } from './audit.js';
import { FIXTURES } from './mock/fixtures.js';
import { RejectedError, makeRunSummary } from './models.js';

/**
 * Run the crew.
 *
 * @param {import('./models.js').CrewDef} crew
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {() => string} clock
 * @param {Object} [opts]
 * @param {boolean} [opts.mock]
 * @param {Object}  [opts.gatewayOpts]  Passed to requestApproval (stdin/stdout overrides)
 * @returns {Promise<import('./models.js').RunSummary>}
 */
export async function runCrew(crew, db, clock, opts = {}) {
  const run_id = randomUUID();
  const { mock = false, gatewayOpts = {} } = opts;

  logEvent(db, {
    run_id,
    occurred_at: clock(),
    event_type: 'run_start',
    agent_id: null,
    payload: { crew_name: crew.name, goal: crew.goal, mock },
  });

  let agents_run = 0;
  let approved = 0;
  let rejected = 0;
  let errors = 0;
  const context = [];

  for (const agentDef of crew.agents) {
    agents_run++;
    const agent = new Agent(agentDef, mock);
    let stepIndex = 0;

    // Each agent can produce multiple proposals across sequential steps
    while (true) {
      let proposals;
      try {
        proposals = agent.step(crew.goal, context, run_id, stepIndex);
      } catch (err) {
        errors++;
        logEvent(db, {
          run_id,
          occurred_at: clock(),
          event_type: 'action_failed',
          agent_id: agentDef.id,
          payload: { error: err.message, step: stepIndex },
        });
        break; // Skip remaining steps for this agent
      }

      if (proposals.length === 0) break; // Agent is done

      for (const proposal of proposals) {
        // 1. Log the proposal
        logEvent(db, {
          run_id,
          occurred_at: clock(),
          event_type: 'action_proposed',
          agent_id: agentDef.id,
          payload: {
            action_type: proposal.action_type,
            payload_hash: proposal.payload_hash,
          },
        });

        // 2. Gateway
        let approval;
        try {
          approval = await requestApproval(proposal, crew.approval, db, clock, gatewayOpts);
          approved++;
        } catch (err) {
          if (err instanceof RejectedError) {
            rejected++;
            // Rejection is already logged by gateway; continue to next proposal
            continue;
          }
          // Unexpected gateway error
          errors++;
          logEvent(db, {
            run_id,
            occurred_at: clock(),
            event_type: 'action_failed',
            agent_id: agentDef.id,
            payload: { error: err.message, phase: 'gateway' },
          });
          continue;
        }

        // 3. Executor
        const mockResult = mock ? (FIXTURES[`${agentDef.id}:${stepIndex}`]?.tool_result) : undefined;
        const result = await execute(proposal, approval, db, clock, { mock, mockResult });

        if (result?.error) {
          errors++;
        }

        // 4. Accumulate context
        context.push({
          agent_id: agentDef.id,
          step: stepIndex,
          action_type: proposal.action_type,
          payload: proposal.payload,
          result,
        });
      }

      stepIndex++;
    }
  }

  const summary = makeRunSummary({ run_id, agents_run, approved, rejected, errors });

  logEvent(db, {
    run_id,
    occurred_at: clock(),
    event_type: 'run_end',
    agent_id: null,
    payload: { agents_run, approved, rejected, errors },
  });

  return summary;
}
