import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {assessSubmissionReadiness} from '../tools/check-submission-readiness.mjs';

const schema=JSON.parse(await readFile(new URL('../submission/form-schema.json',import.meta.url),'utf8'));

test('submission readiness separates pre-submit gates from receipt evidence that cannot exist yet',()=>{
  const result=assessSubmissionReadiness(schema);
  assert.equal(result.verdict,'READY_FOR_WORK_FINAL_REVIEW');
  assert.deepEqual(result.blockers,[]);
  assert.deepEqual(result.postSubmissionEvidencePending,[
    'colosseum_submission_receipt','colosseum_project','colosseum_profile','colosseum_receipt_confirmed'
  ]);
  assert.equal(result.ownerFinalOk,false);
  assert.equal(result.submissionAuthorized,false);
  assert.equal(result.cNFT,'NOT_VERIFIED');
  assert.equal(result.nonTransferability,'NOT_VERIFIED');
});

test('owner-supplied media and Telegram values are wired exactly',()=>{
  assert.equal(schema.colosseum.telegram,'@hiyoko0329');
  assert.equal(schema.colosseum.pitch_video,'https://youtu.be/FS4sn8_zRHU');
  assert.equal(schema.colosseum.demo_video,'https://youtu.be/yHdKe_2xoMI');
  assert.equal(schema.earn.pitch,schema.colosseum.pitch_video);
});

test('complete evidence only advances to Work final review, never submission authorization',()=>{
  const ready=structuredClone(schema);
  ready.colosseum.telegram='@verified_contact';
  ready.colosseum.pitch_video='https://youtube.com/watch?v=pitch';
  ready.colosseum.demo_video='https://vimeo.com/123456';
  ready.earn.pitch='https://loom.com/share/demo';
  ready.earn.submission_link='https://arena.colosseum.org/projects/tonari';
  ready.earn.colosseum_project='https://arena.colosseum.org/projects/tonari';
  ready.earn.colosseum_profile='https://arena.colosseum.org/profile/owner';
  ready.earn.submitted_to_colosseum='Yes';
  const result=assessSubmissionReadiness(ready);
  assert.equal(result.verdict,'READY_FOR_WORK_FINAL_REVIEW');
  assert.deepEqual(result.blockers,[]);
  assert.deepEqual(result.postSubmissionEvidencePending,[]);
  assert.equal(result.ownerFinalOk,false);
  assert.equal(result.submissionAuthorized,false);
});

test('missing pre-submit media still blocks final review even when receipt evidence exists',()=>{
  const invalid=structuredClone(schema);
  invalid.colosseum.pitch_video='<PITCH_VIDEO>';
  invalid.earn.submission_link='https://arena.colosseum.org/projects/tonari';
  invalid.earn.colosseum_project='https://arena.colosseum.org/projects/tonari';
  invalid.earn.colosseum_profile='https://arena.colosseum.org/profile/owner';
  invalid.earn.submitted_to_colosseum='Yes';
  const result=assessSubmissionReadiness(invalid);
  assert.equal(result.verdict,'FULL_NO_GO');
  assert.deepEqual(result.blockers,['pitch_video']);
  assert.deepEqual(result.postSubmissionEvidencePending,[]);
  assert.equal(result.submissionAuthorized,false);
});

test('media URLs fail closed when the host is not approved',()=>{
  const unsafe=structuredClone(schema);
  unsafe.colosseum.pitch_video='https://example.com/pitch.mp4';
  unsafe.colosseum.demo_video='https://example.com/demo.mp4';
  unsafe.earn.pitch='https://example.com/pitch.mp4';
  const result=assessSubmissionReadiness(unsafe);
  assert.ok(result.blockers.includes('pitch_video'));
  assert.ok(result.blockers.includes('demo_video'));
  assert.ok(result.blockers.includes('earn_pitch'));
});
