/**
 * parser.js — YAML crew file parser.
 *
 * Uses only Node.js built-ins. Implements a minimal recursive-descent YAML
 * parser covering the crew file schema:
 *   - Top-level and nested key: value mappings
 *   - Block sequences (- item and - followed by nested mapping)
 *   - Inline sequences [a, b, c]
 *   - Quoted strings (single and double), unquoted strings, booleans, integers
 *   - Comments (#)
 */

import { readFileSync } from 'node:fs';
import { makeCrewDef } from './models.js';
import { KNOWN_TOOLS } from './tools/index.js';

// ---------------------------------------------------------------------------
// Tokeniser: strip comments, produce (indent, content) pairs
// ---------------------------------------------------------------------------

function tokenise(text) {
  return text.split('\n').map((raw, idx) => {
    // Strip inline comments but preserve quoted content
    const stripped = stripComment(raw).trimEnd();
    const indent   = stripped.length - stripped.trimStart().length;
    const content  = stripped.trimStart();
    return { lineNo: idx + 1, indent, content };
  }).filter(t => t.content !== '');
}

function stripComment(line) {
  // Walk the string; ignore # inside single or double quotes
  let inSingle = false, inDouble = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === "'" && !inDouble) inSingle = !inSingle;
    else if (c === '"' && !inSingle) inDouble = !inDouble;
    else if (c === '#' && !inSingle && !inDouble) return line.slice(0, i);
  }
  return line;
}

// ---------------------------------------------------------------------------
// Recursive-descent parser
// ---------------------------------------------------------------------------

/**
 * Parse a YAML string into a plain JS object.
 * @param {string} text
 * @returns {Object}
 */
export function parseYaml(text) {
  const tokens = tokenise(text);
  let pos = 0;

  function peek() { return tokens[pos]; }
  function consume() { return tokens[pos++]; }

  /**
   * Parse a mapping at a given indent level.
   * Returns when a token with indent <= parentIndent is encountered (or EOF).
   */
  function parseMapping(minIndent) {
    const obj = {};
    while (pos < tokens.length) {
      const tok = peek();
      if (tok.indent < minIndent) break;
      if (tok.indent > minIndent) {
        // Unexpected deeper indent — skip (shouldn't happen in well-formed YAML)
        pos++;
        continue;
      }

      // Expect "key: ..." or "key:" (value on next lines)
      const colonIdx = tok.content.indexOf(':');
      if (colonIdx === -1) { pos++; continue; }

      const key  = tok.content.slice(0, colonIdx).trim();
      const rest = tok.content.slice(colonIdx + 1).trim();
      consume();

      if (rest === '') {
        // Value is on subsequent lines — either a nested mapping or a sequence
        if (pos < tokens.length && tokens[pos].indent > minIndent) {
          const childIndent = tokens[pos].indent;
          if (tokens[pos].content.startsWith('- ') || tokens[pos].content === '-') {
            obj[key] = parseSequence(childIndent);
          } else {
            obj[key] = parseMapping(childIndent);
          }
        } else {
          obj[key] = null;
        }
      } else if (rest.startsWith('[')) {
        obj[key] = parseInlineSeq(rest);
      } else {
        obj[key] = parseScalar(rest);
      }
    }
    return obj;
  }

  /**
   * Parse a block sequence at exactly seqIndent.
   */
  function parseSequence(seqIndent) {
    const arr = [];
    while (pos < tokens.length) {
      const tok = peek();
      if (tok.indent < seqIndent) break;
      if (tok.indent !== seqIndent) { pos++; continue; }
      if (!tok.content.startsWith('- ') && tok.content !== '-') break;

      consume();
      const itemContent = tok.content.slice(2).trim(); // strip "- "

      if (itemContent === '' || itemContent === null) {
        // Nested mapping starts on next line
        if (pos < tokens.length && tokens[pos].indent > seqIndent) {
          arr.push(parseMapping(tokens[pos].indent));
        } else {
          arr.push(null);
        }
      } else {
        // The "- " line might start a mini-mapping: "- id: foo"
        const colonIdx = itemContent.indexOf(':');
        if (colonIdx !== -1) {
          // First key-value pair of an inline map item
          const key  = itemContent.slice(0, colonIdx).trim();
          const rest = itemContent.slice(colonIdx + 1).trim();
          const item = {};
          if (rest === '') {
            if (pos < tokens.length && tokens[pos].indent > seqIndent) {
              Object.assign(item, parseMapping(tokens[pos].indent));
            }
          } else if (rest.startsWith('[')) {
            item[key] = parseInlineSeq(rest);
          } else {
            item[key] = parseScalar(rest);
          }
          // Collect additional keys at itemIndent (seqIndent + 2 or whatever the next lines use)
          if (pos < tokens.length && tokens[pos].indent > seqIndent && rest !== '') {
            Object.assign(item, parseMapping(tokens[pos].indent));
          }
          arr.push(item);
        } else {
          arr.push(parseScalar(itemContent));
        }
      }
    }
    return arr;
  }

  const root = parseMapping(0);
  return root;
}

function parseScalar(s) {
  if (s === 'null' || s === '~') return null;
  if (s === 'true')  return true;
  if (s === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  if ((s.startsWith('"') && s.endsWith('"')) ||
      (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

function parseInlineSeq(s) {
  const inner = s.replace(/^\[/, '').replace(/\]$/, '').trim();
  if (inner === '') return [];
  return inner.split(',').map(item => parseScalar(item.trim()));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse and validate a crew YAML file.
 *
 * @param {string} filePath  Absolute or relative path to the YAML file
 * @returns {import('./models.js').CrewDef}
 * @throws On file-not-found, parse error, or validation failure
 */
export function parseCrew(filePath) {
  let text;
  try {
    text = readFileSync(filePath, 'utf8');
  } catch (err) {
    throw new Error(`Crew file not found: "${filePath}". Check the path and try again.`);
  }

  let raw;
  try {
    raw = parseYaml(text);
  } catch (err) {
    throw new Error(`Failed to parse crew file "${filePath}": ${err.message}`);
  }

  // makeCrewDef validates structure and raises descriptive errors
  return makeCrewDef(raw, KNOWN_TOOLS);
}
