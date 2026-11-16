#!/usr/bin/env node
/** Local-only human confirmation demo. Ephemeral signer is NOT an enrolled phone. */
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { randomUUID } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { resolve, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initDb, logEvent } from '../src/audit.js';
import { hashPayload } from '../src/gateway.js';
import { generateDemoSigner, issueCapability } from '../src/security/capabilities.js';
import { execute } from '../src/executor.js';
const clock=()=>new Date().toISOString();
export function makeReadProposal(path){
  if(typeof path!=='string'||!path.trim())throw Error('File path required');
  const full=resolve(path), rel=relative(process.cwd(),full);
  if(rel==='..'||rel.startsWith(`..${sep}`)||isAbsolute(rel))throw Error('File must be inside current workspace');
  const actual=realpathSync(full), base=realpathSync(process.cwd());
  const physical=relative(base,actual);
  if(physical==='..'||physical.startsWith(`..${sep}`)||isAbsolute(physical))throw Error('Symlink target escapes current workspace');
  const payload={path:rel};
  return {run_id:randomUUID(),agent_id:'local-human-demo',action_type:'read_file',payload,payload_hash:hashPayload(payload)};
}
export async function performSignedRead(proposal,{confirmed=false,db=initDb(),signer=generateDemoSigner()}={}){
  if(!confirmed){
    logEvent(db,{run_id:proposal.run_id,occurred_at:clock(),event_type:'action_rejected',agent_id:proposal.agent_id,payload:{reason:'human_denied'}});
    return {error:'Denied by local operator',reason:'human_denied'};
  }
  const capability=issueCapability(proposal,signer.privateKey,{issuer:'ephemeral-local-demo'});
  const approval={approved_at:clock(),approved_by:'local-human-demo',proposal_hash:proposal.payload_hash};
  logEvent(db,{run_id:proposal.run_id,occurred_at:clock(),event_type:'action_approved',agent_id:proposal.agent_id,payload:{proposal_hash:proposal.payload_hash,approved_by:'local-human-demo',issuer:'ephemeral-local-demo'}});
  return execute(proposal,approval,db,clock,{capability,trustedPublicKey:signer.publicKey});
}
async function main(){
  if(process.argv.length!==3){console.error('Usage: node demos/signed-read.js <workspace-file>');process.exitCode=2;return;}
  const proposal=makeReadProposal(process.argv[2]);
  console.log(`LOCAL DEMO ONLY — ephemeral key, no Android pairing.\nAction: ${proposal.action_type}\nPath: ${proposal.payload.path}\nResolved path: ${realpathSync(resolve(proposal.payload.path))}\nPayload SHA-256: ${proposal.payload_hash}`);
  if(!stdin.isTTY){console.error('Interactive terminal required; denying.');process.exitCode=1;return;}
  const rl=createInterface({input:stdin,output:stdout});
  let response;
  try{response=await rl.question('Approve this exact read? Type YES: ');}finally{rl.close();}
  const db=initDb();
  try{
    const result=await performSignedRead(proposal,{confirmed:response==='YES',db});
    if(result.error){console.error(`DENIED/FAILED: ${result.error}`);process.exitCode=1;}
    else console.log(`SIGNED READ COMPLETE — ${Buffer.byteLength(result.content||'','utf8')} bytes.\n${(result.content||'').slice(0,500)}`);
  }finally{db.close();}
}
if(process.argv[1] && resolve(process.argv[1])===resolve(fileURLToPath(import.meta.url)))main().catch(e=>{console.error(e.message);process.exitCode=1});
