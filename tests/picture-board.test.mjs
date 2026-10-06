import test from 'node:test';
import assert from 'node:assert/strict';
import {pictureBoard,pictureFragment,seededStartingPieces} from '../packages/protocol/picture-board.mjs';

const hex=n=>n.toString(16).padStart(2,'0').repeat(32),show=hex(17);

test('24 fragments map exactly once across one 6 by 4 picture',()=>{
 const fragments=Array.from({length:24},(_,i)=>pictureFragment(i));
 assert.equal(new Set(fragments.map(x=>`${x.column},${x.row}`)).size,24);
 assert.deepEqual(fragments.at(0),{index:0,column:0,row:0,backgroundSize:'600% 400%',backgroundPosition:'0% 0%'});
 assert.deepEqual(fragments.at(-1),{index:23,column:5,row:3,backgroundSize:'600% 400%',backgroundPosition:'100% 100%'});
 assert.throws(()=>pictureFragment(24),/BAD_PICTURE_PIECE/);
});

test('full picture reveals only for strict 24 of 24 ownership',()=>{
 const all=Array.from({length:24},(_,i)=>i);assert.equal(pictureBoard(all).complete,true);
 assert.equal(pictureBoard(all.slice(0,-1)).complete,false);
 assert.equal(pictureBoard([0],[0]).complete,false);
 assert.throws(()=>pictureBoard([0,0]),/BAD_PICTURE_BOARD/);
 assert.throws(()=>pictureBoard([1],[0]),/BAD_PICTURE_BOARD/);
});

test('show and device seeded allocation is reproducible and deliberately duplicates one normal piece',async()=>{
 const devices=[hex(30),hex(31),hex(32)],first=await Promise.all(devices.map(device=>seededStartingPieces({show,device}))),again=await Promise.all(devices.map(device=>seededStartingPieces({show,device})));
 assert.deepEqual(first,again);for(const pieces of first){assert.equal(pieces.length,3);assert.equal(new Set(pieces).size,3);assert.ok(pieces.every(x=>x>=0&&x<24));}
 assert.equal(new Set(first.map(x=>x[0])).size,1,'show-shared draw must create a transparent exchange duplicate');
 assert.notDeepEqual(await seededStartingPieces({show:hex(18),device:devices[0]}),first[0]);
});

test('normal seeded draws cover every piece without a modulo hot spot across fixed seeds',async()=>{
 const counts=Array(24).fill(0);for(let i=0;i<2400;i++)counts[(await seededStartingPieces({show:i.toString(16).padStart(64,'0'),device:hex(30),count:1}))[0]]++;
 assert.ok(counts.every(value=>value>55&&value<145),JSON.stringify(counts));
});
