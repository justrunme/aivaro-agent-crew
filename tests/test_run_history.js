import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initDb, logEvent, listRuns } from '../src/audit.js';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
test('run history is newest first and summarizes persisted events',()=>{
 const db=initDb(join(tmpdir(),`crew-history-${randomUUID()}.db`));
 for(const [id,date] of [['a','2026-11-01'],['b','2026-11-02']]){
   logEvent(db,{run_id:id,occurred_at:date,event_type:'run_start',payload:{crew_name:id}});
   logEvent(db,{run_id:id,occurred_at:date,event_type:'action_approved',payload:{}});
 }
 const runs=listRuns(db);assert.deepEqual(runs.map(r=>r.run_id),['b','a']);assert.equal(runs[0].approved,1);assert.equal(runs[0].event_count,2);assert.equal(listRuns(db,1).length,1);assert.throws(()=>listRuns(db,101));db.close();
});
