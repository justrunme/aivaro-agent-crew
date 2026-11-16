/** Browser demo controller. Same-process ephemeral signer, NEVER a real identity gate. */
import { randomUUID } from 'node:crypto';
import { getRunEvents, logEvent } from '../src/audit.js';
import { remediationProposal, proof } from '../demos/kiro-approval-proof.js';
const clock=()=>new Date().toISOString();
const pending=new Map();
function source(db,id){
  const events=getRunEvents(db,id);
  const start=events.find(e=>e.event_type==='run_start');
  if(!start||JSON.parse(start.payload).crew_name!=='Kiro Two-Agent Incident Review')return null;
  const output=agent=>events.find(e=>e.agent_id===agent&&e.event_type==='action_executed');
  const a=output('kiro-triage'),b=output('kiro-reviewer');
  if(!a||!b)return null;
  return {triage:JSON.parse(a.payload).result_summary,review:JSON.parse(b.payload).result_summary};
}
export function preparePlan(db,runId){
  if(typeof runId!=='string'||!/^[0-9a-f-]{36}$/.test(runId))return {error:'invalid_run'};
  const s=source(db,runId);if(!s)return {error:'ineligible_run'};
  const token=randomUUID(),proposal=remediationProposal(runId,s.triage,s.review);
  pending.set(token,{runId,proposal,expires:Date.now()+120000});
  if(pending.size>100){for(const [k,v] of pending){if(v.expires<Date.now()||pending.size>100)pending.delete(k)}}
  return {token,expires_in_seconds:120,proposal,warning:'DEMO ONLY: approval of a non-executable plan, not identity verification or cluster permission'};
}
export function decidePlan(db,{token,decision}={}){
  if(typeof token!=='string'||!['DENY','APPROVE'].includes(decision))return {ok:false,reason:'invalid_request'};
  const item=pending.get(token);if(!item)return {ok:false,reason:'missing_or_consumed_token'};
  pending.delete(token);
  if(Date.now()>=item.expires)return {ok:false,reason:'expired'};
  if(!source(db,item.runId))return {ok:false,reason:'ineligible_run'};
  logEvent(db,{run_id:item.runId,occurred_at:clock(),event_type:'action_proposed',agent_id:'remediation-planner',payload:{action_type:'browser_demo_decision',decision,non_executable:true}});
  const result=proof(item.proposal,{db,approved:decision==='APPROVE'});
  return result;
}
