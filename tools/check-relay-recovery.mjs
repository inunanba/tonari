/** Bot host verification after restarting the same relay; public signed fixture only. */
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {validateConfig} from '../apps/web/chain-api.mjs';
import {verifyAttestation} from '../packages/protocol/attestation.mjs';
import {inspectPacket} from '../packages/protocol/swap-v2.mjs';
import {fromHex} from '../packages/protocol/swap.mjs';
const fixture=JSON.parse(await readFile(process.env.TONARI_TEST_RECEIPT_FILE,'utf8'));
const original=validateConfig(fixture.config),proof=await verifyAttestation(fixture.settlement,original);
assert.equal(proof.kind,'settled');assert.equal(proof.id,fixture.id);
assert.equal((await inspectPacket(fromHex(fixture.packet,368),{...original,now:proof.observedAt},{settlement:true})).id,fixture.id);
const api=async(endpoint,value)=>{const r=await fetch('http://127.0.0.1:4173/api/tonari/'+endpoint,{method:value?'POST':'GET',headers:value?{'Content-Type':'application/json'}:{},body:value?JSON.stringify(value):undefined,signal:AbortSignal.timeout(60000)});assert(r.ok,endpoint+' HTTP '+r.status);return r.json();};
assert.deepEqual(await api('config'),original);
const before=await verifyAttestation(await api('state'),original);
const recovered=await verifyAttestation(await api('settle',{packet:fixture.packet}),original);
assert.deepEqual(recovered,proof);
const after=await verifyAttestation(await api('state'),original);assert.deepEqual(after.tiles,before.tiles);
console.log(JSON.stringify({status:'RELAY_RESTART_RECEIPT_PASS',cluster:original.cluster,same_transaction:true,tiles_unchanged:true,signature:proof.signature,id:proof.id}));
