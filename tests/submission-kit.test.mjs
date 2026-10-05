import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const files=['PITCH_3MIN_JA_EN.md','TECH_DEMO_2MIN.md','FORM_ANSWERS.md','EVIDENCE_MATRIX.md'];
const load=async name=>readFile(new URL(`../submission/${name}`,import.meta.url),'utf8');

test('submission kit has truthful status and authority boundaries',async()=>{
  for(const name of files){
    const text=await load(name);
    assert.match(text,/(DRAFT|FULL NO-GO)/,name);
    assert.match(text,/(NOT SUBMITTED|submission authority|提出権限|submit)/i,name);
  }
});

test('pitch and forms distinguish simulation from real evidence',async()=>{
  const pitch=await load(files[0]),form=await load(files[2]),matrix=await load(files[3]);
  for(const text of [pitch,form,matrix]){
    assert.match(text,/(simulat|stylised|模擬|モデル)/i);
    assert.match(text,/(Devnet|デブネット)/i);
    assert.match(text,/(no .*partnership|提携.*主張|partnership.*unproven|venue partnership)/i);
  }
  assert.match(pitch,/4\.2 s figure is harness|human three-minute pacing|実測ではなく/i);
});

test('public identifiers and required owner decisions are preserved',async()=>{
  const all=(await Promise.all(files.map(load))).join('\n');
  assert.match(all,/2XaNubDkBJx8d9V3YRqDyetLh3XuoKh7qVSEJSgK63iA/);
  assert.match(all,/qfTeQ1TryvERBEVJCsgiqSSfYusHSBGhN5cmVko4j3uZoLbFVRYd1V5zbh1hAipeFXwBHS3tvusCcAn8koVT7Zd/);
  assert.match(all,/Solo builder/);
  assert.match(all,/VOICEVOX:<[^>]+>/);
  assert.match(all,/X: leave blank|X \| Blank/);
  assert.match(all,/Earn submit remains owner-only/);
});

test('unfinished completion and media gates cannot be mistaken for done',async()=>{
  const form=await load(files[2]),matrix=await load(files[3]);
  assert.match(form,/<PUBLIC_PITCH_VIDEO_URL>/);
  assert.match(form,/<PUBLIC_TECH_DEMO_URL>/);
  assert.match(matrix,/Completion cNFT.*Open blocker/i);
  assert.match(matrix,/\[ \] Work final integrated score and GO/);
  assert.match(matrix,/\[ \] Owner final OK/);
});
