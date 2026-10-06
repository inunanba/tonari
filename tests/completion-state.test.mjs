import test from 'node:test';
import assert from 'node:assert/strict';
import {createDevice} from '../packages/protocol/swap.mjs';
import {completionValueFromOwnership,emptyClaimsRoot} from '../packages/protocol/completion-state.mjs';
import {signFinalizedCompletion,verifyCompletionRequest} from '../packages/protocol/completion.mjs';

const id=n=>n.toString(16).padStart(2,'0').repeat(32),scope={show:id(70),policy:id(71)},tiles=ticket=>Array.from({length:24},(_,i)=>({id:id(i),owner:ticket,version:i%3}));

test('finalized 24 of 24 ownership derives a stable device-signable completion value',async()=>{
 const device=await createDevice(),input={...scope,ticket:device.publicKey,tiles:tiles(device.publicKey),completedAt:1791234567},a=await completionValueFromOwnership(input),b=await completionValueFromOwnership({...input,tiles:[...input.tiles].reverse()});
 assert.deepEqual(a,b);assert.equal(a.pieces,24);assert.equal(a.claimsRoot,emptyClaimsRoot);assert.notEqual(a.boardDigest,a.settlementDigest);
 const signed=await signFinalizedCompletion(a,device);assert.deepEqual((await verifyCompletionRequest(signed,scope)).value,a);
});

test('completion value rejects 23 pieces, duplicates, foreign owners and malformed versions',async()=>{
 const device=await createDevice(),base={...scope,ticket:device.publicKey,tiles:tiles(device.publicKey),completedAt:1791234567};
 await assert.rejects(completionValueFromOwnership({...base,tiles:base.tiles.slice(0,-1)}),/COMPLETION_REQUIRES_24/);
 const duplicate=structuredClone(base);duplicate.tiles[23].id=duplicate.tiles[22].id;await assert.rejects(completionValueFromOwnership(duplicate),/COMPLETION_REQUIRES_24/);
 const foreign=structuredClone(base);foreign.tiles[7].owner=id(99);await assert.rejects(completionValueFromOwnership(foreign),/COMPLETION_REQUIRES_24/);
 const version=structuredClone(base);version.tiles[7].version=-1;await assert.rejects(completionValueFromOwnership(version),/COMPLETION_REQUIRES_24/);
});
