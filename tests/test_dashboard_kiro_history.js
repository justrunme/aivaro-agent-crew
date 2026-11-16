import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../dashboard/index.html',import.meta.url),'utf8');
test('dashboard displays real Kiro agents from audit instead of scripted crew',()=>{assert.match(html,/new Set\(past\.events\.map/);assert.match(html,/Kiro Skeptical Reviewer/);assert.match(html,/model inference/)});
test('dashboard labels mock-only launch and does not trigger model from browser',()=>{assert.match(html,/dashboard launches mock runs only/i);assert.doesNotMatch(html,/fetch\('\/api\/kiro/)});
test('dashboard escapes displayed audit output',()=>{assert.match(html,/esc\(e\.detail\|\|''\)/);assert.match(html,/result_summary/)});
