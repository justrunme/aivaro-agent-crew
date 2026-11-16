// Explicitly read-only Aivaro MCP discovery. No tools/call capability.
// Uses the local, user-configured adapter. Never reads or prints credentials.
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { homedir } from 'node:os';
import { join } from 'node:path';
export async function discoverAivaroTools({ timeoutMs=4000 }={}) {
  const adapter=join(homedir(),'.local/share/aivaro-kiro/terminal-stdio.cjs');
  return new Promise(resolve=>{
    const child=spawn(process.execPath,[adapter],{stdio:['pipe','pipe','ignore'],env:{...process.env}});
    let finished=false;
    const finish=result=>{if(finished)return;finished=true;clearTimeout(timer);child.kill();resolve(result)};
    const timer=setTimeout(()=>finish({status:'unavailable',tools:[]}),timeoutMs);
    child.on('error',()=>finish({status:'unavailable',tools:[]}));
    const rl=createInterface({input:child.stdout});
    rl.on('line',line=>{try{const reply=JSON.parse(line);if(reply.id!==1)return;if(reply.error)return finish({status:'unavailable',tools:[]});const tools=reply.result?.tools;if(!Array.isArray(tools))return finish({status:'unavailable',tools:[]});finish({status:'connected-read-only',tools:tools.map(t=>({name:t.name,description:t.description||''}))});}catch{finish({status:'unavailable',tools:[]})}});
    child.stdin.end(JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/list',params:{}})+'\n');
  });
}
