import test from 'node:test';
import assert from 'node:assert/strict';
import {claimAvailability,latestClaim,participantMissing,randomClaimFrame} from '../apps/web/claim-flow.mjs';
const id=n=>n.toString(16).padStart(2,'0').repeat(32),ticket=id(1),state={tiles:[{id:id(10),owner:ticket},{id:id(11),owner:id(2)},{id:id(12),owner:id(3)}]};
test('participant missing set is derived only from verified ownership rows',()=>{assert.deepEqual(participantMissing(state,ticket),[id(11),id(12)]);assert.throws(()=>participantMissing({tiles:[state.tiles[0],state.tiles[0]]},ticket),/BAD_STATE/);});
test('participant with a complete visible board cannot request a fake missing tile',()=>{assert.throws(()=>participantMissing({tiles:[{id:id(10),owner:ticket}]},ticket),/NO_MISSING_TILES/);});
test('claim availability enforces both committed time boundaries',()=>{const open={status:'OPEN',validFrom:10,validTo:20};assert.deepEqual(claimAvailability(open,9),{ready:false,reason:'NOT_STARTED'});assert.equal(claimAvailability(open,10).ready,true);assert.equal(claimAvailability(open,20).ready,true);assert.deepEqual(claimAvailability(open,21),{ready:false,reason:'CLOSED'});assert.equal(claimAvailability({status:'UNAVAILABLE'},10).ready,false);});
test('frame generation and retry selection are bounded and deterministic under injected input',()=>{assert.equal(randomClaimFrame(values=>{values[0]=0xffffffff;}),0xffffffff);const rows=[{envelope:{value:{sequence:1}},id:'b'},{envelope:{value:{sequence:0}},id:'a'}];assert.equal(latestClaim(rows).id,'b');assert.equal(latestClaim([]),null);});
