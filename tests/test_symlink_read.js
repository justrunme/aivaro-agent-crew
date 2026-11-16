import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,symlinkSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {readFileTool} from '../src/tools/fs.js';
test('read_file refuses symlink pointing outside workspace',async()=>{
 const folder=mkdtempSync(join(process.cwd(),'.crew-symlink-test-'));
 const outside=join(tmpdir(),`crew-external-${process.pid}.txt`);
 try{writeFileSync(outside,'secret');symlinkSync(outside,join(folder,'escape'));await assert.rejects(readFileTool({path:join(folder,'escape')}),/symlink escapes workspace/);}finally{rmSync(folder,{recursive:true,force:true});rmSync(outside,{force:true});}
});
