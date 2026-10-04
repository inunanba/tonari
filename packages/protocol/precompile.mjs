/** Canonical self-contained Solana Ed25519 instructions; no transaction broadcast.
 * Binding checks establish the intended bytes only. Validator execution is still required.
 * https://solana.com/docs/core/programs/precompiles
 */
import {BODY_BYTES,PACKET_BYTES,decodeOffer,fromHex,concat,digest} from './swap.mjs';
export const ED25519_PROGRAM='Ed25519SigVerify111111111111111111111111111';
const ACCEPT=new TextEncoder().encode('TONARI/v1/swap-accept\0');
export function signatureInstruction(publicKey,signature,message){
 const key=fromHex(publicKey,32);
 if(!(signature instanceof Uint8Array)||signature.length!==64||!(message instanceof Uint8Array)||message.length>65535-112)throw Error('BAD_PRECOMPILE_INPUT');
 const data=new Uint8Array(112+message.length),v=new DataView(data.buffer);
 data[0]=1;data[1]=0;
 // one14-byte offset record, all data refer to this instruction (u16::MAX).
 [48,65535,16,65535,112,message.length,65535].forEach((n,k)=>v.setUint16(2+2*k,n,true));
 data.set(key,16);data.set(signature,48);data.set(message,112);
 return {programId:ED25519_PROGRAM,accounts:[],data};
}
export async function swapSignatureInstructions(packet){
 if(!(packet instanceof Uint8Array)||packet.length!==PACKET_BYTES)throw Error('BAD_LENGTH');
 const p=packet.slice(),body=p.slice(0,BODY_BYTES),offer=decodeOffer(body),sigA=p.slice(BODY_BYTES,BODY_BYTES+64),sigB=p.slice(BODY_BYTES+64);
 return [signatureInstruction(offer.a,sigA,body),signatureInstruction(offer.b,sigB,concat(ACCEPT,await digest(body),sigA))];
}
/** Strict on-chain parser contract mirrored in JS for adversarial fixtures.
 * Reject alternate offsets, external instruction references, extra accounts/data and wrong program.
 * This function DOES NOT verify Ed25519 or confer finality.
 */
export function assertSignatureBinding(instruction,publicKey,signature,message){
 const expected=signatureInstruction(publicKey,signature,message);
 if(!instruction||instruction.programId!==ED25519_PROGRAM||!Array.isArray(instruction.accounts)||instruction.accounts.length!==0||
   !(instruction.data instanceof Uint8Array)||instruction.data.length!==expected.data.length||!instruction.data.every((b,i)=>b===expected.data[i]))throw Error('PRECOMPILE_BINDING');
 return {bound:true,signatureVerified:false};
}
