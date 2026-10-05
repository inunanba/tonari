import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openClaimJournal} from '../tools/claim-journal.mjs';

test('claim journal atomically survives reopen and locks a second operator',async()=>{const dir=await mkdtemp(join(tmpdir(),'tonari-claim-journal-'));let first,second;try{first=await openClaimJournal(dir);assert.equal(first.state,null);await assert.rejects(()=>openClaimJournal(dir),e=>e.code==='EEXIST');await first.persistState({version:1,status:'OPEN'});await first.close();second=await openClaimJournal(dir);assert.deepEqual(second.state,{version:1,status:'OPEN'});assert.deepEqual(JSON.parse(await readFile(join(dir,'claim.json'),'utf8')),second.state);}finally{await first?.close();await second?.close();await rm(dir,{recursive:true,force:true});}});
test('claim journal corruption fails closed without overwriting evidence or trapping lock',async()=>{const dir=await mkdtemp(join(tmpdir(),'tonari-bad-claim-journal-'));try{const file=join(dir,'claim.json');await writeFile(file,'{bad json');await assert.rejects(()=>openClaimJournal(dir),/BAD_CLAIM_JOURNAL/);assert.equal(await readFile(file,'utf8'),'{bad json');await writeFile(file,'null');const journal=await openClaimJournal(dir);await assert.rejects(()=>journal.persistState(null),/DELETE_FORBIDDEN/);await journal.close();}finally{await rm(dir,{recursive:true,force:true});}});
