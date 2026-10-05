import test from 'node:test';
import assert from 'node:assert/strict';
import {ownershipView} from '../packages/protocol/ownership-view.mjs';

const key=n=>n.toString(16).padStart(2,'0').repeat(32);
const state=()=>({slot:7,tiles:Array.from({length:24},(_,index)=>({id:key(index),owner:key(index%3+30),version:index}))});

test('attested ownership view is ordered, counted and versioned',()=>{
 const view=ownershipView(state(),key(30));assert.equal(view.total,24);assert.equal(view.issued,24);assert.equal(view.owned,8);
 assert.deepEqual(view.cells.slice(0,3).map(cell=>[cell.number,cell.version,cell.owned]),[[1,0,true],[2,1,false],[3,2,false]]);
});

test('ownership view retains 24 positions while an attested issued subset stays authoritative',()=>{
 const subset=state();subset.tiles=subset.tiles.filter((_,index)=>[0,1,2,8,9,10,16,17,18].includes(index));const view=ownershipView(subset,key(30));
 assert.equal(view.cells.length,24);assert.equal(view.issued,9);assert.equal(view.owned,3);assert.equal(view.cells[7].issued,false);assert.equal(view.cells[8].issued,true);
});

test('ownership view rejects duplicate, out-of-range and noncanonical pieces',()=>{
 const duplicate=state();duplicate.tiles.pop();duplicate.tiles[22].id=duplicate.tiles[21].id;assert.throws(()=>ownershipView(duplicate,key(30)),/BAD_OWNERSHIP_BOARD/);
 const outOfRange=state();outOfRange.tiles=[{id:key(24),owner:key(30),version:0}];assert.throws(()=>ownershipView(outOfRange,key(30)),/BAD_OWNERSHIP_TILE/);
 const malformed=state();malformed.tiles[2].id='02'.repeat(31)+'03';assert.throws(()=>ownershipView(malformed,key(30)),/BAD_OWNERSHIP_TILE/);
});

test('ownership view rejects untrusted keys and versions',()=>{
 assert.throws(()=>ownershipView(state(),'AA'.repeat(32)),/BAD_HEX/);
 const bad=state();bad.tiles[0].version=2**32;assert.throws(()=>ownershipView(bad,key(30)),/BAD_OWNERSHIP_VERSION/);
});
