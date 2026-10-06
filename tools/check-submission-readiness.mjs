import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const PLACEHOLDER=/(?:<[^>]+>|OWNER_|ONLY_AFTER|YOUTUBE_OR_LOOM_OR_VIMEO|COLOSSEUM_)/i;
const HTTPS=/^https:\/\//;
const MEDIA_HOST=/^https:\/\/(?:www\.)?(?:youtube\.com|youtu\.be|loom\.com|vimeo\.com)\//i;

export function assessSubmissionReadiness(schema){
  const blockers=[];
  const c=schema?.colosseum||{},e=schema?.earn||{};
  const need=(name,value,predicate=(v)=>typeof v==='string'&&v.trim()&&!PLACEHOLDER.test(v))=>{
    if(!predicate(value))blockers.push(name);
  };
  need('owner_telegram',c.telegram);
  need('pitch_video',c.pitch_video,v=>typeof v==='string'&&MEDIA_HOST.test(v)&&!PLACEHOLDER.test(v));
  need('demo_video',c.demo_video,v=>typeof v==='string'&&MEDIA_HOST.test(v)&&!PLACEHOLDER.test(v));
  need('earn_pitch',e.pitch,v=>typeof v==='string'&&MEDIA_HOST.test(v)&&!PLACEHOLDER.test(v));
  need('colosseum_submission_receipt',e.submission_link,v=>typeof v==='string'&&HTTPS.test(v)&&!PLACEHOLDER.test(v));
  need('colosseum_project',e.colosseum_project,v=>typeof v==='string'&&HTTPS.test(v)&&!PLACEHOLDER.test(v));
  need('colosseum_profile',e.colosseum_profile,v=>typeof v==='string'&&HTTPS.test(v)&&!PLACEHOLDER.test(v));
  if(e.submitted_to_colosseum!=='Yes')blockers.push('colosseum_receipt_confirmed');
  return Object.freeze({
    verdict:blockers.length?'FULL_NO_GO':'READY_FOR_WORK_FINAL_REVIEW',
    blockers:Object.freeze(blockers),
    ownerFinalOk:false,
    submissionAuthorized:false,
    cNFT:'NOT_VERIFIED',
    nonTransferability:'NOT_VERIFIED'
  });
}

async function main(){
  const path=new URL('../submission/form-schema.json',import.meta.url);
  const assessment=assessSubmissionReadiness(JSON.parse(await readFile(path,'utf8')));
  process.stdout.write(`${JSON.stringify(assessment,null,2)}\n`);
  if(assessment.verdict!=='READY_FOR_WORK_FINAL_REVIEW')process.exitCode=2;
}

if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)await main();
