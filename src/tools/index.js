/**
 * tools/index.js — Tool registry.
 *
 * Maps tool name → async callable.
 * Tools are registered at module load time.
 * The registry raises UnknownToolError for unregistered names.
 */

import { UnknownToolError } from '../models.js';
import { readFileTool, writeFileTool } from './fs.js';
import { webSearch, fetchUrl } from './web.js';

/** @type {Map<string, (params: Object) => Promise<Object>>} */
const REGISTRY = new Map([
  ['read_file',  readFileTool],
  ['write_file', writeFileTool],
  ['web_search', webSearch],
  ['fetch_url',  fetchUrl],
]);

/**
 * Look up a tool by name.
 * @param {string} name
 * @returns {(params: Object) => Promise<Object>}
 * @throws {UnknownToolError}
 */
export function getTool(name) {
  const fn = REGISTRY.get(name);
  if (!fn) throw new UnknownToolError(name);
  return fn;
}

/** All registered tool names, for crew-file validation. */
export const KNOWN_TOOLS = new Set(REGISTRY.keys());
