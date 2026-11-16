#!/usr/bin/env node
// Local-only, mock-only demo dashboard. No access to live tools or MCP actions.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { initDb, getRunEvents, listRuns } from '../src/audit.js';
import { runCrew } from '../src/orchestrator.js';
import { mockClock } from '../src/mock/clock.js';
import { parseCrew } from '../src/parser.js';
import { preparePlan, decidePlan } from './approval.js';
const here=dirname(fileURLToPath(import.meta.url));
const html=readFileSync(join(here,'index.html'));
const crew=parseCrew(join(here,'../examples/research-crew.yaml'));
const db=initDb(process.env.AIVARO_CREW_DB_PATH || undefined);
let latest=null, busy=false;
const port=Number(process.env.AIVARO_CREW_DASHBOARD_PORT||4317);
if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Invalid port');
function json(res,status,body){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','content-security-policy':"default-src 'none'"});res.end(JSON.stringify(body));}
const server=createServer(async(req,res)=>{
  if(req.headers.host!==`127.0.0.1:${port}`&&req.headers.host!==`localhost:${port}`)return json(res,403,{error:'Host denied'});
  if(req.method==='GET'&&req.url==='/'){res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff', 'content-security-policy':"default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'"});return res.end(html);}
  if(req.method==='GET'&&req.url==='/api/runs')return json(res,200,{runs:listRuns(db)});
  if(req.method==='GET'&&req.url?.startsWith('/api/run/')){
    const id=req.url.slice('/api/run/'.length);
    if(!/^[a-f0-9-]{36}$/.test(id))return json(res,400,{error:'Invalid run ID'});
    const found=listRuns(db,100).some(r=>r.run_id===id);
    if(!found)return json(res,404,{error:'Run not found'});
    return json(res,200,{run_id:id,events:getRunEvents(db,id).map(e=>({event_type:e.event_type,agent_id:e.agent_id,occurred_at:e.occurred_at,payload:JSON.parse(e.payload)}))});
  }
  if(req.method==='GET'&&req.url==='/api/state'){
    const events=latest?getRunEvents(db,latest.run_id).map(e=>({event_type:e.event_type,agent_id:e.agent_id,occurred_at:e.occurred_at,detail:(()=>{try{const p=JSON.parse(e.payload);return p.action_type||p.reason||p.payload_hash||''}catch{return ''}})()})):[];
    return json(res,200,{run_id:latest?.run_id||null,agents:latest?crew.agents:[],events});
  }
  if(req.method==='POST'&&(req.url==='/api/plan/prepare'||req.url==='/api/plan/decide')){
    const origin=`http://${req.headers.host}`;
    if(req.headers.origin!==origin||!['127.0.0.1','localhost'].includes(req.headers.host.split(':')[0])||req.headers['content-type']!=='application/json'||req.headers['sec-fetch-site']==='cross-site')return json(res,403,{error:'Origin/content type denied'});
    let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>2048)return json(res,413,{error:'Too large'});}
    let input;try{input=JSON.parse(raw);}catch{return json(res,400,{error:'Invalid JSON'});}
    const result=req.url==='/api/plan/prepare'?preparePlan(db,input.run_id):decidePlan(db,input);
    return json(res,result.error||result.ok===false?400:200,result);
  }
  if(req.method==='POST'&&req.url==='/api/demo'){
    if(req.headers.origin&&req.headers.origin!==`http://127.0.0.1:${port}`&&req.headers.origin!==`http://localhost:${port}`)return json(res,403,{error:'Origin denied'});
    if(busy)return json(res,409,{error:'Demo already running'});
    busy=true;try{latest=await runCrew(crew,db,mockClock(),{mock:true});return json(res,200,{run_id:latest.run_id,summary:latest});}catch(e){return json(res,500,{error:'Demo failed'});}finally{busy=false;}
  }
  return json(res,404,{error:'Not found'});
});
server.listen(port,'127.0.0.1',()=>process.stdout.write(`Agent Crew dashboard: http://127.0.0.1:${port}\n`));
