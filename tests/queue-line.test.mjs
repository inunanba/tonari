import test from 'node:test';
import assert from 'node:assert/strict';
import {QueueLineRun,validateQueuePuzzle,validateGhost,ghostAt} from '../packages/games/queue-line.mjs';

const solution=[0,1,2,3,4,9,8,7,6,5,10,11,12,13,14,19,18,17,16,15,20,21,22,23,24];
const puzzle={id:'chapter-1-small',size:5,clues:[{cell:0,number:1},{cell:9,number:2},{cell:10,number:3},{cell:14,number:4},{cell:20,number:5},{cell:24,number:6}]};

test('Queue Line solves only an orthogonal all-cell path through ordered poles',()=>{const run=new QueueLineRun(puzzle);for(const cell of solution)assert.equal(run.move(cell).changed,true);assert.equal(run.solved,true);assert.deepEqual(run.path,solution);assert.equal(run.move(0).changed,false);});
test('wrong start, jump, early pole, revisit and early finish are ignored',()=>{const run=new QueueLineRun(puzzle);assert.equal(run.move(1).changed,false);run.move(0);assert.equal(run.move(5).changed,true);assert.equal(run.move(10).changed,false);assert.equal(run.move(24).changed,false);assert.deepEqual(run.path,[0,5]);});
test('tap/back-drag cuts to a prior cell and undo is instant',()=>{const run=new QueueLineRun(puzzle);for(const cell of [0,1,2,3])run.move(cell);assert.equal(run.move(1).kind,'backtrack');assert.deepEqual(run.path,[0,1]);assert.equal(run.undo(),true);assert.deepEqual(run.path,[0]);run.reset();assert.deepEqual(run.path,[]);});
test('puzzle schema rejects gaps, duplicate cells, unknown fields and bad bounds',()=>{for(const bad of [{...puzzle,extra:1},{...puzzle,size:8},{...puzzle,clues:[{cell:0,number:1},{cell:1,number:3}]},{...puzzle,clues:[{cell:0,number:1},{cell:0,number:2}]}])assert.throws(()=>validateQueuePuzzle(bad));});
test('ghost must be a solved path with strictly increasing integer times',()=>{const ghost=validateGhost(puzzle,{path:solution,times:solution.map((_,i)=>(i+1)*900)});assert.equal(ghostAt(ghost,899),null);assert.deepEqual(ghostAt(ghost,900),{index:0,cell:0,finished:false});assert.equal(ghostAt(ghost,22500).finished,true);assert.throws(()=>validateGhost(puzzle,{path:solution,times:solution.map(()=>1)}),/BAD_QUEUE_GHOST/);});
