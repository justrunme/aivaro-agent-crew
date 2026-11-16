import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {initDb,logEvent,getRunEvents} from '../src/audit.js';
import {preparePlan,decidePlan} from '../dashboard/approval.js';
const clock=()=>new Date().toISOString();
function setup(){const db=initDb(join(tmpdir(),`browser-approval-${randomUUID()}.db`)),run_id=randomUUID();for(const [event_type,agent_id,payload] of [['run_start',null,{crew_name:'Kiro Two-Agent Incident Review'}],['action_executed','kiro-triage',{result_summary:'CAUSE: memory'}],['action_executed','kiro-reviewer',{result_summary:'VERDICT: unproven'}]])logEvent(db,{run_id,occurred_at:clock(),event_type,agent_id,payload});return {db,run_id};}
test('rejects arbitrary runs and malformed identifiers',()=>{const {db,run_id}=setup();assert.equal(preparePlan(db,'no').error,'invalid_run');assert.equal(preparePlan(db,randomUUID()).error,'ineligible_run');db.close()});
test('browser approve creates one-time signed proof with tamper and replay denial',()=>{const {db,run_id}=setup(),p=preparePlan(db,run_id);assert.equal(p.proposal.action_type,'approve_plan_only');const r=decidePlan(db,{token:p.token,decision:'APPROVE'});assert.equal(r.ok,true);assert.equal(r.replay_denied,true);assert.equal(r.tamper_denied,true);assert.equal(decidePlan(db,{token:p.token,decision:'APPROVE'}).reason,'missing_or_consumed_token');assert.equal(getRunEvents(db,run_id).filter(e=>e.event_type==='action_approved').length,1);db.close()});
test('browser DENY never signs or approves',()=>{const {db,run_id}=setup(),p=preparePlan(db,run_id);const r=decidePlan(db,{token:p.token,decision:'DENY'});assert.equal(r.reason,'human_denied');assert.equal(getRunEvents(db,run_id).filter(e=>e.event_type==='action_approved').length,0);db.close()});
test('invalid decision does not consume token',()=>{const {db,run_id}=setup(),p=preparePlan(db,run_id);assert.equal(decidePlan(db,{token:p.token,decision:'EXECUTE'}).reason,'invalid_request');assert.equal(decidePlan(db,{token:p.token,decision:'DENY'}).reason,'human_denied');db.close()});
