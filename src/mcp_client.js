/**
 * mcp_client.js — optional Aivaro MCP adapter.
 *
 * Reads AIVARO_MCP_URL on first call. If set and reachable, makes real tool
 * calls (not implemented in MVP — this is wired for future use). Otherwise
 * falls back to a stub that returns { status: 'mcp_unavailable' }.
 *
 * Rules:
 *  - Never throws from callTool() — always returns a dict.
 *  - Logs exactly one INFO line when falling back (never a stack trace).
 *  - Never blocks the mock demo path (this module is lazy-imported).
 */

let _initialised = false;
let _stub = true;

function ensureInitialised() {
  if (_initialised) return;
  _initialised = true;
  const url = process.env.AIVARO_MCP_URL;
  if (!url) {
    process.stderr.write('[mcp_client] AIVARO_MCP_URL not set; using stub (mcp_unavailable).\n');
    _stub = true;
    return;
  }
  // Health check would go here; for MVP we always stub.
  process.stderr.write(`[mcp_client] AIVARO_MCP_URL=${url} found but live MCP not implemented in MVP; using stub.\n`);
  _stub = true;
}

/**
 * Call an MCP tool.
 *
 * @param {string} toolName
 * @param {Object} params
 * @returns {Promise<Object>}  Always resolves; never throws.
 */
export async function callTool(toolName, params) {
  ensureInitialised();
  if (_stub) {
    return { status: 'mcp_unavailable', tool: toolName };
  }
  // Live path not implemented in MVP
  return { status: 'mcp_unavailable', tool: toolName };
}
