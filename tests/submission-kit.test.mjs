import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const names=['PITCH_2MIN_JA_EN.md','TECH_DEMO_2MIN.md','FORM_ANSWERS.md','EVIDENCE_MATRIX.md'];
const load=async name=>readFile(new URL(`../submission/${name}`,import.meta.url),'utf8');
const schema=JSON.parse(await load('form-schema.json'));

test('submission kit retains truthful status and authority boundaries',async()=>{
  for(const name of names){
    const text=await load(name);
    assert.match(text,/(DRAFT|FULL NO-GO)/,name);
    assert.match(text,/(NOT SUBMITTED|submission authority|submit)/i,name);
  }
  const all=(await Promise.all(names.map(load))).join('\n');
  assert.match(all,/(simulat|stylised|模擬|モデル)/i);
  assert.match(all,/Devnet/i);
  assert.match(all,/(not .*partnership|提携.*主張|partnership)/i);
});

test('public identifiers and fixed owner decisions are preserved',async()=>{
  const all=(await Promise.all(names.map(load))).join('\n');
  assert.match(all,/2XaNubDkBJx8d9V3YRqDyetLh3XuoKh7qVSEJSgK63iA/);
  assert.match(all,/qfTeQ1TryvERBEVJCsgiqSSfYusHSBGhN5cmVko4j3uZoLbFVRYd1V5zbh1hAipeFXwBHS3tvusCcAn8koVT7Zd/);
  assert.match(all,/Solo builder/);
  assert.match(all,/VOICEVOX:四国めたん/);
  assert.match(all,/X\/Tweet links: blank|X Link \| Blank/);
  assert.match(all,/Earn submit remains owner-only/);
});

test('Colosseum answers fit captured live limits and required choices',()=>{
  const c=schema.colosseum;
  const limits={project_name:100,brief_description:500,what_building:1000,why_now:1000,technologies:500,chain_use:500,contributors:600,judges_note:500,repo_context:500,access_instructions:300};
  for(const [field,max] of Object.entries(limits)) assert.ok(c[field].trim().length<=max,`${field} ${c[field].length}/${max}`);
  assert.deepEqual(c.chains,['Solana']);
  assert.equal(c.category,'Consumer Apps');
  assert.equal(c.mobile_focused_dapp,true);
  assert.equal(c.country,'Japan');
  assert.equal(c.accelerator_opt_in,'No');
  assert.equal(c.pitch_max_seconds,120);
  assert.equal(c.demo_max_seconds,180);
  assert.match(c.technologies,/ChatGPT\/Codex.*Grok\/GrokBot.*VOICEVOX/);
  assert.match(c.telegram,/OWNER_TELEGRAM_REQUIRED/);
});

test('media URLs and unfinished gates fail closed',async()=>{
  const c=schema.colosseum,e=schema.earn,matrix=await load('EVIDENCE_MATRIX.md');
  assert.match(c.pitch_video,/YOUTUBE_OR_LOOM_OR_VIMEO/);
  assert.match(c.demo_video,/YOUTUBE_OR_LOOM_OR_VIMEO/);
  assert.match(e.submitted_to_colosseum,/ONLY_AFTER.*RECEIPT/);
  assert.match(matrix,/Completion cNFT.*Open blocker/i);
  assert.match(matrix,/\[ \] Work final integrated score and GO/);
  assert.match(matrix,/\[ \] Owner final OK/);
});

test('logo source is original, venue-neutral and raster export exists',async()=>{
  const svg=await load('tonari-logo.svg');
  const png=await readFile(new URL('../submission/tonari-logo.png',import.meta.url));
  assert.match(svg,/<title[^>]*>TONARI logo<\/title>/);
  assert.doesNotMatch(svg,/Tokyo|Dome|artist|sponsor/i);
  assert.deepEqual([...png.subarray(0,8)],[137,80,78,71,13,10,26,10]);
  assert.ok(png.length<500_000,`logo too large: ${png.length}`);
});
