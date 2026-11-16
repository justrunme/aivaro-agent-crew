/**
 * clock.js — deterministic clock for mock/test mode.
 *
 * Production code gets a live clock; mock/test code gets a seeded sequence.
 * The epoch starts at 2026-11-16T00:00:00.000Z and advances by 1 second
 * on each call, making mock timestamps fully deterministic.
 */

// Fixed epoch: opening day of Kiroween 2026 window
const MOCK_EPOCH_MS = new Date('2026-11-16T00:00:00.000Z').getTime();

/**
 * Returns a live clock function that returns the real UTC time.
 * @returns {() => string}
 */
export function liveClock() {
  return () => new Date().toISOString();
}

/**
 * Returns a deterministic clock function.
 * Each call returns MOCK_EPOCH_MS + (call_count * 1000) ms as ISO 8601.
 * @param {number} [startMs] Override the starting millisecond.
 * @returns {() => string}
 */
export function mockClock(startMs = MOCK_EPOCH_MS) {
  let counter = 0;
  return () => new Date(startMs + counter++ * 1000).toISOString();
}
