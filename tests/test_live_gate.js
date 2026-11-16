import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execute } from '../src/executor.js';
import { initDb, getRunEvents } from '../src/audit.js';
import { hashPayload } from '../src/gateway.js';
import { generateDemoSigner, issueCapability } from '../src/security/capabilities.js';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
const clock=()=>new Date().toISOString();
function setup(){const db=initDb(join(tmpdir(),`crew-live-${randomUUID()}.db`));const payload={path:'missing.txt'};const proposal={run_id:randomUUID(),agent_id:'a',action_type:'read_file',payload,payload_hash:hashPayload(payload)};const approval={approved_at:clock(),approved_by:'cli',proposal_hash:proposal.payload_hash};return {db,proposal,approval};}
test('live action without trusted signed capability fails closed',async()=>{const {db,proposal,approval}=setup();const result=await execute(proposal,approval,db,clock);assert.equal(result.reason,'missing_trust_configuration');assert.equal(getRunEvents(db,proposal.run_id)[0].event_type,'action_failed');db.close();});
test('signed capability executes once and rejects replay',async()=>{const {db,proposal,approval}=setup();const keys=generateDemoSigner();const capability=issueCapability(proposal,keys.privateKey);const opts={capability,trustedPublicKey:keys.publicKey};const first=await execute(proposal,approval,db,clock,opts);assert.equal(first.action_type,'read_file');const second=await execute(proposal,approval,db,clock,opts);assert.equal(second.reason,'replayed');db.close();});
test('signature cannot authorize a modified payload',async()=>{const {db,proposal,approval}=setup();const keys=generateDemoSigner();const capability=issueCapability(proposal,keys.privateKey);proposal.payload={path:'other.txt'};const result=await execute(proposal,approval,db,clock,{capability,trustedPublicKey:keys.publicKey});assert.equal(result.reason,'hash_mismatch');db.close();});

test('signed capability cannot execute live writes',async()=>{const {db,proposal,approval}=setup();proposal.action_type='write_file';const keys=generateDemoSigner();const capability=issueCapability(proposal,keys.privateKey);const result=await execute(proposal,approval,db,clock,{capability,trustedPublicKey:keys.publicKey});assert.equal(result.reason,'live_tool_not_allowlisted');db.close();});
test('bad approval cannot consume valid signed capability',async()=>{const {db,proposal,approval}=setup();const keys=generateDemoSigner();const capability=issueCapability(proposal,keys.privateKey);const opts={capability,trustedPublicKey:keys.publicKey};const invalid=await execute(proposal,{...approval,proposal_hash:'0'.repeat(64)},db,clock,opts);assert.equal(invalid.reason,'hash_mismatch');const valid=await execute(proposal,approval,db,clock,opts);assert.notEqual(valid.reason,'replayed');db.close();});
