import test from 'node:test';
import assert from 'node:assert/strict';
import {tierChancePPM,tieredAvailability,drawNotOwnedPiece} from '../packages/protocol/tiered-chance.mjs';

const spots=(g21='crowded',g22='quiet')=>[{id:'G01',crowding:'quiet'},{id:'G21',crowding:g21},{id:'G22',crowding:g22}],base={homeSpot:'G01',spotGiven:[0,0,0],totalGiven:3,spotCap:6,totalCap:24};
const availability=(g21,g22,change={})=>tieredAvailability({...base,...change,spots:spots(g21,g22)});

test('seat is nonzero, crowded is lower than quiet, and crowd changes switch the announced spot',()=>{
 const first=availability('crowded','quiet');assert.equal(first.rows[0].chancePPM,tierChancePPM.seat);assert(tierChancePPM.seat>0);assert(tierChancePPM.crowded<tierChancePPM.quiet);assert.equal(first.recommended,'G22');
 const changed=availability('quiet','crowded');assert.equal(changed.recommended,'G21');
});

test('per-spot and total caps close suggestions fail-closed',()=>{
 const spotClosed=availability('quiet','crowded',{spotGiven:[0,6,0]});assert.equal(spotClosed.rows[1].open,false);assert.equal(spotClosed.rows[1].chancePPM,0);assert.equal(spotClosed.recommended,'G22');
 const allClosed=availability('quiet','quiet',{totalGiven:24});assert.equal(allClosed.recommended,null);assert(allClosed.rows.every(row=>!row.open&&row.chancePPM===0));
});

test('same seed is reproducible and any award is strictly not-yet-owned',async()=>{
 const available=availability('crowded','quiet'),owned=[0,1,2,3,4,5],ticket='44'.repeat(32);let found;
 for(let i=0;i<64&&!found;i++){const seed=i.toString(16).padStart(2,'0').repeat(32),a=await drawNotOwnedPiece({availability:available,spotId:'G22',seed,ticket,frame:7,owned}),b=await drawNotOwnedPiece({availability:available,spotId:'G22',seed,ticket,frame:7,owned});assert.deepEqual(a,b);if(a.awarded!==null)found=a;}
 assert(found);assert(!owned.includes(found.awarded));assert.equal(found.missingCount,18);
});

test('malformed spots, duplicate ownership and complete boards reject',async()=>{
 assert.throws(()=>tieredAvailability({...base,spots:[{id:'G01',crowding:'quiet'},{id:'G01',crowding:'quiet'},{id:'G22',crowding:'quiet'}]}),/BAD_TIERED_CHANCE/);
 const value=availability('crowded','quiet'),args={availability:value,spotId:'G22',seed:'11'.repeat(32),ticket:'22'.repeat(32),frame:1};
 await assert.rejects(drawNotOwnedPiece({...args,owned:[1,1]}),/BAD_TIERED_CHANCE/);await assert.rejects(drawNotOwnedPiece({...args,owned:Array.from({length:24},(_,i)=>i)}),/NO_MISSING_PIECES/);
});
