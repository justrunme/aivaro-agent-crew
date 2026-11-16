/**
 * tools/fs.js — file system tools sandboxed to the current working directory.
 *
 * Both read_file and write_file resolve the given path relative to process.cwd()
 * and reject any path that would escape it (path traversal protection).
 */

import { readFileSync, writeFileSync, mkdirSync, realpathSync } from 'node:fs';
import { resolve, relative, dirname, sep as requireSeparator, isAbsolute } from 'node:path';

function sandboxedPath(inputPath) {
  const cwd = process.cwd();
  const resolved = resolve(cwd, inputPath);
  const rel = relative(cwd, resolved);
  // Reject absolute paths or any path that starts with ".." (escapes CWD)
  if (rel.startsWith('..') || resolve(rel) === rel) {
    throw new Error(`Path "${inputPath}" escapes the working directory`);
  }
  return resolved;
}

/**
 * Read a file. Returns { content: string }.
 * @param {{ path: string }} params
 */
export async function readFileTool({ path }) {
  if (!path) throw new Error('read_file: "path" is required');
  const safe = sandboxedPath(path);
  // Resolve symlinks before reading. This blocks ordinary symlink escapes; it is
  // not a race-free OS sandbox against a concurrently hostile filesystem.
  const actual = realpathSync(safe);
  const base = realpathSync(process.cwd());
  const rel = relative(base, actual);
  if (rel === '..' || rel.startsWith(`..${requireSeparator}`) || isAbsolute(rel)) throw new Error('read_file: symlink escapes workspace');
  const content = readFileSync(actual, 'utf8');
  return { content };
}

/**
 * Write a file. Creates parent directories as needed. Returns { written: true }.
 * @param {{ path: string, content: string }} params
 */
export async function writeFileTool({ path, content }) {
  if (!path) throw new Error('write_file: "path" is required');
  if (content === undefined) throw new Error('write_file: "content" is required');
  const safe = sandboxedPath(path);
  mkdirSync(dirname(safe), { recursive: true });
  writeFileSync(safe, content, 'utf8');
  return { written: true, path: safe };
}
