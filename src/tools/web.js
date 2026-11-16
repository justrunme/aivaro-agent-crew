/**
 * tools/web.js — web tools (live stubs).
 *
 * In a real deployment these would use fetch() or an HTTP client.
 * In mock mode the executor short-circuits tool calls via fixture data,
 * so these functions are never called during --mock runs.
 *
 * Live stubs return an empty result set rather than throwing, matching FR-4.4
 * (tool exceptions are caught at the executor level; stubs just return empty).
 */

/**
 * @param {{ query: string }} params
 */
export async function webSearch({ query }) {
  if (!query) throw new Error('web_search: "query" is required');
  // Live stub: would call a search API here.
  return { results: [], note: 'web_search is a stub in this build — use --mock for demo' };
}

/**
 * @param {{ url: string }} params
 */
export async function fetchUrl({ url }) {
  if (!url) throw new Error('fetch_url: "url" is required');
  // Live stub: would call fetch(url) here.
  return { body: '', note: 'fetch_url is a stub in this build — use --mock for demo' };
}
