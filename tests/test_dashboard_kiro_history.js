import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const html=readFileSync(new URL('../dashboard/index.html',import.meta.url),'utf8');
test('dashboard renders historical Kiro agents from audit events',()=>{assert.match(html,/new Set\(events\.map/);assert.match(html,/Kiro Skeptical Reviewer/);assert.match(html,/REAL MODEL/)});
test('dashboard clearly labels mock-only launch and does not trigger model from browser',()=>{assert.match(html,/launch button runs scripted mock agents only/i);assert.doesNotMatch(html,/fetch\('\/api\/kiro/)});
test('dashboard escapes all displayed audit output',()=>{assert.match(html,/esc\(detail\)/);assert.match(html,/result_summary/);assert.match(html,/esc\(a\.role\)/)});
test('dashboard embedded JS parses',()=>{const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];assert.ok(script);assert.doesNotThrow(()=>new Script(script))});
