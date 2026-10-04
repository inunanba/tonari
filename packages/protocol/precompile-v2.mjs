import {BODY_BYTES,PACKET_BYTES,decodeOffer,acceptanceMessage} from './swap-v2.mjs';
import {signatureInstruction} from './precompile.mjs';
export async function swapSignatureInstructions(packet){
 if(!(packet instanceof Uint8Array)||packet.length!==PACKET_BYTES)throw Error('BAD_LENGTH');
 const p=packet.slice(),body=p.slice(0,BODY_BYTES),o=decodeOffer(body),a=p.slice(BODY_BYTES,BODY_BYTES+64),b=p.slice(BODY_BYTES+64);
 return [signatureInstruction(o.a,a,body),signatureInstruction(o.b,b,await acceptanceMessage(body,a))];
}
