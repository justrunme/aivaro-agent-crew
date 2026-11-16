#!/usr/bin/env node
/**
 * cli.js — Aivaro Agent Crew CLI entrypoint.
 *
 * Usage:
 *   aivaro-crew run <crew-file> [--mock] [--dry-run] [--log-level LEVEL]
 *
 * Pre-alpha / hackathon prototype. Not for production use.
 */

import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { parseCrew } from './parser.js';
import { initDb, DEFAULT_DB_PATH } from './audit.js';
import { runCrew } from './orchestrator.js';
import { liveClock, mockClock } from './mock/clock.js';

const USAGE = `
Aivaro Agent Crew — Kiroween 2026 prototype (pre-alpha)

Usage:
  aivaro-crew run <crew-file> [options]

Options:
  --mock          Replace LLM and tool calls with deterministic fixtures
  --dry-run       Validate crew file and print plan; no execution or DB write
  --log-level     Log level: debug | info | warn | error  (default: info)
  --help, -h      Print this help

Examples:
  aivaro-crew run examples/research-crew.yaml --mock
  aivaro-crew run examples/research-crew.yaml --dry-run
`.trimStart();

async function main() {
  const argv = process.argv.slice(2);

  if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h') {
    process.stdout.write(USAGE);
    process.exit(0);
  }

  const subcommand = argv[0];
  if (subcommand !== 'run') {
    process.stderr.write(`Unknown subcommand "${subcommand}". Try: aivaro-crew run --help\n`);
    process.exit(1);
  }

  // Parse flags after the subcommand
  let values, positionals;
  try {
    ({ values, positionals } = parseArgs({
      args: argv.slice(1),
      options: {
        mock:      { type: 'boolean', default: false },
        'dry-run': { type: 'boolean', default: false },
        'log-level': { type: 'string', default: 'info' },
        help:      { type: 'boolean', default: false, short: 'h' },
      },
      allowPositionals: true,
      strict: true,
    }));
  } catch (err) {
    process.stderr.write(`Argument error: ${err.message}\n`);
    process.exit(1);
  }

  if (values.help) {
    process.stdout.write(USAGE);
    process.exit(0);
  }

  if (positionals.length === 0) {
    process.stderr.write('Error: crew file path is required.\n  Usage: aivaro-crew run <crew-file>\n');
    process.exit(1);
  }

  const crewPath = resolve(positionals[0]);
  const isMock   = values['mock'];
  const isDryRun = values['dry-run'];

  // --- Parse and validate crew file ---
  let crew;
  try {
    crew = parseCrew(crewPath);
  } catch (err) {
    process.stderr.write(`Error: ${err.message}\n`);
    process.exit(1);
  }

  if (isDryRun) {
    process.stdout.write(`Crew: ${crew.name}\n`);
    process.stdout.write(`Goal: ${crew.goal}\n`);
    process.stdout.write(`Approval mode: ${crew.approval.mode}\n`);
    process.stdout.write(`\nAgents (${crew.agents.length}):\n`);
    for (const a of crew.agents) {
      process.stdout.write(`  [${a.id}] ${a.role}  tools=[${a.tools.join(', ')}]  model=${a.model}\n`);
    }
    process.stdout.write(`\nDry-run complete. No agents executed.\n`);
    process.exit(0);
  }

  // Pre-alpha safety boundary: no live tool execution until reviewed.
  if (!isMock) {
    process.stderr.write('Live execution is disabled in this pre-alpha build. Use --mock or --dry-run.\n');
    process.exit(2);
  }

  // --- Run ---
  if (isMock) {
    process.stdout.write(`Running in mock mode — no LLM or network calls.\n`);
  }

  // Mock mode does not imply permission to execute real tools.
  const db    = initDb();
  const clock = isMock ? mockClock() : liveClock();

  let summary;
  try {
    summary = await runCrew(crew, db, clock, { mock: isMock });
  } catch (err) {
    process.stderr.write(`Fatal error during run: ${err.message}\n`);
    process.exit(1);
  }

  process.stdout.write('\n');
  process.stdout.write('─'.repeat(60) + '\n');
  process.stdout.write(`Run complete\n`);
  process.stdout.write(`  Run ID   : ${summary.run_id}\n`);
  process.stdout.write(`  Agents   : ${summary.agents_run}\n`);
  process.stdout.write(`  Approved : ${summary.approved}\n`);
  process.stdout.write(`  Rejected : ${summary.rejected}\n`);
  process.stdout.write(`  Errors   : ${summary.errors}\n`);
  process.stdout.write(`  Audit DB : ${DEFAULT_DB_PATH}\n`);
  process.stdout.write('─'.repeat(60) + '\n');

  process.exit(0);
}

main();
