import {fromHex} from './swap.mjs';
const fail=reason=>{throw new Error(reason);};
/** Local-device replay policy. This never proves global ownership or humanity. */
export function checkReceipt(records, receipt, publicKey) {
  const {offer:o,id,acceptedAt}=receipt;
  fromHex(publicKey,32);fromHex(id,32);
  if(o.a!==publicKey && o.b!==publicKey) fail('NOT_PARTICIPANT');
  if(!Number.isSafeInteger(acceptedAt)||acceptedAt<o.issuedAt||acceptedAt>o.expiresAt) fail('BAD_RECEIPT_TIME');
  for(const r of records) {
    if(r.offer.show!==o.show) continue;
    if(r.id===id || r.offer.a===o.a && r.offer.nonce===o.nonce) fail('REPLAY');
    if([o.a,o.b].sort().join(':')===[r.offer.a,r.offer.b].sort().join(':')) fail('PAIR_LIMIT');
    if([o.a,o.b].some(k=>k===r.offer.a||k===r.offer.b) && acceptedAt-r.acceptedAt<120) fail('COOLDOWN');
  }
  return receipt;
}
