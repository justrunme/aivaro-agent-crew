#!/usr/bin/env node
/** Proof of human approval boundary: signs a NON-EXECUTABLE remediation plan. */
import { randomUUID, createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { stdin,stdout } from 'node:process';
import { initDb, logEvent } from '../src/audit.js';
import { hashPayload } from '../src/gateway.js';
import { generateDemoSigner, issueCapability } from '../src/security/capabilities.js';
import { authorizeSignedProposal } from '../src/security/verified_gateway.js';
import { runKiroCrew } from './kiro-crew.js';
const clock=()=>new Date().toISOString();
const sha=s=>createHash('sha256').update(s).digest('hex');
export function remediationProposal(run_id,triage,review){
  const payload={kind:'NON_EXECUTABLE_REMEDIATION_PLAN',target:'synthetic:demo-store/checkout-api',recommendation_sha256:sha(triage),review_sha256:sha(review),human_review_required:true};
  return {run_id,agent_id:'remediation-planner',action_type:'approve_plan_only',payload,payload_hash:hashPayload(payload)};
}
export function proof(proposal,{db,approved=false,signer=generateDemoSigner()}={}){
  if(!db)throw Error('Audit database required');
  if(proposal.action_type!=='approve_plan_only'||proposal.payload?.kind!=='NON_EXECUTABLE_REMEDIATION_PLAN'||proposal.payload?.human_review_required!==true)return {ok:false,reason:'plan_only_policy'};
  if(!approved){logEvent(db,{run_id:proposal.run_id,occurred_at:clock(),event_type:'action_rejected',agent_id:proposal.agent_id,payload:{reason:'human_denied'}});return {ok:false,reason:'human_denied'};}
  const capability=issueCapability(proposal,signer.privateKey,{issuer:'ephemeral-demo-only'});
  const verified=authorizeSignedProposal(proposal,capability,signer.publicKey,db);
  if(!verified.ok)return verified;
  logEvent(db,{run_id:proposal.run_id,occurred_at:clock(),event_type:'action_approved',agent_id:proposal.agent_id,payload:{action_type:'approve_plan_only',proposal_digest:capability.claims.proposal_digest,nonce:verified.nonce,issuer:'ephemeral-demo-only'}});
  const replay=authorizeSignedProposal(proposal,capability,signer.publicKey,db);
  const tampered={...proposal,payload:{...proposal.payload,target:'synthetic:other-workload'},payload_hash:hashPayload({...proposal.payload,target:'synthetic:other-workload'})};
  const tamper=authorizeSignedProposal(tampered,capability,signer.publicKey,db);
  logEvent(db,{run_id:proposal.run_id,occurred_at:clock(),event_type:'action_rejected',agent_id:proposal.agent_id,payload:{reason:'replay_proof',verification:replay.reason}});
  logEvent(db,{run_id:proposal.run_id,occurred_at:clock(),event_type:'action_rejected',agent_id:proposal.agent_id,payload:{reason:'tamper_proof',verification:tamper.reason}});
  return {ok:true,action:'PLAN APPROVED FOR HUMAN REVIEW ONLY',replay_denied:replay.reason==='replayed',tamper_denied:tamper.reason==='proposal_mismatch',no_actions_executed:true};
}
async function main(){
  if(process.argv.length!==3||process.argv[2]!=='--sample')throw Error('Use: node demos/kiro-approval-proof.js --sample');
  if(!stdin.isTTY)throw Error('Interactive terminal required: fail closed');
  const incident=JSON.parse(readFileSync(new URL('../examples/incidents/pod-crashloop.json',import.meta.url),'utf8'));
  const db=initDb();
  try{
    const crew=await runKiroCrew(incident,{db});
    const proposal=remediationProposal(crew.run_id,crew.triage,crew.review);
    console.log(`KIRO TRIAGE:\n${crew.triage}\n\nKIRO SAFETY REVIEW:\n${crew.review}\n\nPLAN ONLY (NO CLUSTER EXECUTION)\nTarget: ${proposal.payload.target}\nProposal SHA-256: ${proposal.payload_hash}`);
    const rl=createInterface({input:stdin,output:stdout});let response;
    try{response=await rl.question('Approve the non-executable plan for review? Type YES: ');}finally{rl.close();}
    const result=proof(proposal,{db,approved:response==='YES'});
    console.log(JSON.stringify(result,null,2));
    if(!result.ok)process.exitCode=1;
  }finally{db.close();}
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(fileURLToPath(import.meta.url)))main().catch(e=>{console.error(e.message);process.exitCode=1});
