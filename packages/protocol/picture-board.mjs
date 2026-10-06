const TOTAL=24,COLUMNS=6,ROWS=4,HEX=/^[0-9a-f]{64}$/;
const encoder=new TextEncoder();

function index(value){
 if(!Number.isSafeInteger(value)||value<0||value>=TOTAL)throw Error('BAD_PICTURE_PIECE');
 return value;
}

/** Canonical crop coordinates for one 6×4 source picture. */
export function pictureFragment(value){
 const piece=index(value),column=piece%COLUMNS,row=Math.floor(piece/COLUMNS);
 return Object.freeze({index:piece,column,row,backgroundSize:`${COLUMNS*100}% ${ROWS*100}%`,backgroundPosition:`${column*100/(COLUMNS-1)}% ${row*100/(ROWS-1)}%`});
}

/** Strict 24-position board. Issued-but-not-owned and unissued are distinct. */
export function pictureBoard(owned=[],issued=Array.from({length:TOTAL},(_,i)=>i)){
 if(!Array.isArray(owned)||!Array.isArray(issued))throw Error('BAD_PICTURE_BOARD');
 const own=new Set(owned.map(index)),live=new Set(issued.map(index));
 if(own.size!==owned.length||live.size!==issued.length||[...own].some(i=>!live.has(i)))throw Error('BAD_PICTURE_BOARD');
 const cells=Object.freeze(Array.from({length:TOTAL},(_,i)=>Object.freeze({...pictureFragment(i),issued:live.has(i),owned:own.has(i)})));
 return Object.freeze({cells,owned:own.size,issued:live.size,total:TOTAL,complete:own.size===TOTAL&&live.size===TOTAL});
}

async function digest(label){
 return new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(label)));
}

async function uniform(label,total){
 // Rejection sampling keeps every normal piece exactly equiprobable.
 for(let counter=0;;counter++){
  const bytes=await digest(`${label}\0${counter}`),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),limit=2**32-(2**32%total);
  for(let offset=0;offset+4<=bytes.length;offset+=4){const value=view.getUint32(offset);if(value<limit)return value%total;}
 }
}

/**
 * Reproducible cryptographic starting allocation. Slot zero is show-shared on
 * purpose, guaranteeing a duplicate across neighbouring devices. Remaining
 * slots bind the show and non-extractable device public key. Rare allocation
 * is deliberately outside this normal-piece function and stays governor-led.
 */
export async function seededStartingPieces({show,device,count=3,total=TOTAL}){
 if(!HEX.test(show)||!HEX.test(device)||!Number.isSafeInteger(count)||count<1||count>total||total!==TOTAL)throw Error('BAD_STARTING_SEED');
 const pieces=[await uniform(`TONARI/v1/start/shared/${show}`,total)];
 for(let slot=1;pieces.length<count;slot++){
  const candidate=await uniform(`TONARI/v1/start/device/${show}/${device}/${slot}`,total);
  if(!pieces.includes(candidate))pieces.push(candidate);
 }
 return Object.freeze(pieces);
}

export const pictureGrid=Object.freeze({columns:COLUMNS,rows:ROWS,total:TOTAL});
