import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const names=['PITCH_2MIN_JA_EN.md','TECH_DEMO_2MIN.md','FORM_ANSWERS.md','EVIDENCE_MATRIX.md','FINAL_REVIEW.md','SCRIPT_DELTAS.md'];
const load=async name=>readFile(new URL(`../submission/${name}`,import.meta.url),'utf8');
const schema=JSON.parse(await load('form-schema.json'));
const mediaEvidence=JSON.parse(await load('public-media-evidence.json'));

test('submission kit retains truthful status and authority boundaries',async()=>{
  for(const name of names){
    const text=await load(name);
    assert.match(text,/(DRAFT|WORK FINAL GO|COLOSSEUM SUBMITTED)/,name);
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
  assert.equal(c.telegram,'@hiyoko0329');
});

test('media URLs and Colosseum receipt are exact while Earn authority stays closed',async()=>{
  const c=schema.colosseum,e=schema.earn,matrix=await load('EVIDENCE_MATRIX.md');
  assert.equal(c.pitch_video,'https://youtu.be/FS4sn8_zRHU');
  assert.equal(c.demo_video,'https://youtu.be/eZR5a1Bb414');
  assert.equal(e.pitch,c.pitch_video);
  assert.equal(e.submitted_to_colosseum,'Yes');
  assert.equal(e.submission_link,'https://colosseum.com/arena/projects/tonari');
  assert.equal(e.colosseum_project,e.submission_link);
  assert.equal(e.colosseum_profile,'https://colosseum.com/arena/profiles/inunanba');
  assert.match(matrix,/Completion PDA fallback.*Proven on Devnet/i);
  assert.match(matrix,/Completion cNFT.*Not implemented/i);
  assert.match(matrix,/cNFT\/non-transferability kept `NOT_VERIFIED`/i);
  assert.match(matrix,/replacement demo.*recheck pending/i);
  assert.match(matrix,/\[x\] Work final integrated score and GO/);
  assert.match(matrix,/\[x\] Owner final OK/);
  assert.match(matrix,/\[ \] Superteam Earn owner submit/);
  assert.equal(mediaEvidence.pitch.url,c.pitch_video);
  assert.equal(mediaEvidence.demo.url,c.demo_video);
  assert.ok(mediaEvidence.pitch.duration_seconds<=c.pitch_max_seconds);
  assert.ok(mediaEvidence.demo.duration_seconds<=c.demo_max_seconds);
  assert.equal(mediaEvidence.submission_authorized,false);
  assert.equal(mediaEvidence.colosseum_submitted,true);
  assert.equal(mediaEvidence.earn_submitted,false);
});

test('logo source is original, venue-neutral and raster export exists',async()=>{
  const svg=await load('tonari-logo.svg');
  const png=await readFile(new URL('../submission/tonari-logo.png',import.meta.url));
  assert.match(svg,/<title[^>]*>TONARI logo<\/title>/);
  assert.doesNotMatch(svg,/Tokyo|Dome|artist|sponsor/i);
  assert.deepEqual([...png.subarray(0,8)],[137,80,78,71,13,10,26,10]);
  assert.ok(png.length<500_000,`logo too large: ${png.length}`);
});

test('pitch centres collection desire while labelling future benefits',async()=>{
  const pitch=await load('PITCH_2MIN_JA_EN.md');
  assert.match(pitch,/推しのものを集めたい、そろえたい/);
  assert.match(pitch,/空いているエリアほど手に入りやすく/);
  assert.match(pitch,/混雑しているエリアでは控えめ/);
  assert.match(pitch,/記念の完成絵と「完成した記録」/);
  assert.match(pitch,/提案 \/ proposal — no existing artist or venue partnership/);
  assert.match(pitch,/Roadmap only/i);
  assert.match(pitch,/cNFT and non-transferability remain open/);
  assert.doesNotMatch(pitch,/最悪待ち時間/);
});

test('R2p pitch keeps the owner-fixed order and current tier truth boundaries',async()=>{
  const pitch=await load('PITCH_2MIN_JA_EN.md'),form=await load('form-schema.json');
  const ordered=['① 解決したい問題','② どんな考えで作ったか','③ ピースの手に入れ方','④ 集めるとどうなるか','⑤ なぜ人が分散するのか','⑥ 両方にとってのいいこと'];
  let cursor=-1;
  for(const heading of ordered){const next=pitch.indexOf(heading);assert(next>cursor,`${heading} must appear in fixed order`);cursor=next;}
  assert.match(pitch,/3%/);assert.match(pitch,/1%/);assert.match(pitch,/18%/);
  assert.match(pitch,/まだ持っていないピース/);assert.match(pitch,/今回のデモでは運営画面で混雑を設定/);
  assert.match(pitch,/Roadmap only:[\s\S]*cameras/i);
  assert.doesNotMatch(pitch,/(レア|rare piece)/i);
  assert.match(form,/3%/);assert.match(form,/1%/);assert.match(form,/18%/);
  assert.match(form,/camera.*roadmap/i);
});

test('owner-final Japanese pitch is preserved verbatim without the R2r omissions',async()=>{
  const pitch=await load('PITCH_2MIN_JA_EN.md');
  const required=[
    '人はお願いでは動かないけど、欲しいものがあれば自分から動きます。',
    '会場に来るファンには「推しのものを集めたい、そろえたい」という気持ちがあります。',
    '全員が一斉に動くのではなく、一部の人が少しずつ動くことで、会場全体の混雑がならされます。',
    '今回のデモでは運営画面で混雑を設定していますが、将来は会場のカメラで人の動きを読み取り、混雑に合わせて手に入りやすい場所を自動で変えるような使い方もできます。'
  ];
  for(const line of required)assert.ok(pitch.includes(line),`missing owner-final line: ${line}`);
  assert.match(pitch,/owner-final 2026-10-06 12:35 JST script verbatim/);
  assert.match(pitch,/1:58\.30/);
  assert.match(pitch,/提案 \/ proposal — no existing artist or venue partnership/);
});
