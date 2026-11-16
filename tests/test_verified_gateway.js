import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateDemoSigner,issueCapability} from '../src/security/capabilities.js';
import {authorizeSignedProposal} from '../src/security/verified_gateway.js';
import {initDb} from '../src/audit.js';
import {hashPayload} from '../src/gateway.js';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
test('persistent replay protection survives a new SQLite connection',()=>{
 const path=join(tmpdir(),`crew-replay-${randomUUID()}.db`);
 const db1=initDb(path);const keys=generateDemoSigner();const p={run_id:'r',agent_id:'a',action_type:'terminal_read',payload:{session_id:'s'},payload_hash:hashPayload({session_id:'s'})};const c=issueCapability(p,keys.privateKey,{now:1000,ttlMs:10000});
 assert.equal(authorizeSignedProposal(p,c,keys.publicKey,db1,{now:2000}).ok,true);db1.close();const db2=initDb(path);assert.equal(authorizeSignedProposal(p,c,keys.publicKey,db2,{now:2000}).reason,'replayed');db2.close();
});
test('missing trusted key is fail closed',()=>{assert.equal(authorizeSignedProposal({},null,null,null).ok,false)});
