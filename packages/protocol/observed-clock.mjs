/** Local acceptance timer anchored to an already verified chain observation.
 * This estimate never authorizes on-chain settlement; the program checks Clock.
 */
export function observedNow(anchor,wallNow){
 if(!anchor||![anchor.observedAt,anchor.receivedAt,wallNow].every(n=>Number.isSafeInteger(n)&&n>=0))throw Error('CLOCK_ANCHOR_UNAVAILABLE');
 if(wallNow<anchor.receivedAt)throw Error('LOCAL_CLOCK_ROLLBACK');
 return anchor.observedAt+wallNow-anchor.receivedAt;
}
export function offerTime(state,anchor,wallNow){
 const current=observedNow(anchor,wallNow);
 if(anchor.slot!==state.slot||anchor.observedAt!==state.observedAt)throw Error('CLOCK_ANCHOR_UNAVAILABLE');
 // Use finalized observed time for issuedAt, rather than a wall-clock estimate
 // which can be ahead of the validator's Clock or finalized RPC block time.
 if(current>state.observedAt+120)throw Error('OWNERSHIP_OBSERVATION_EXPIRED');
 if(state.deadline<state.observedAt+120)throw Error('SHOW_DEADLINE');
 return {issuedAt:state.observedAt,expiresAt:state.observedAt+120,settleBy:Math.min(state.deadline,state.observedAt+7*86400)};
}
