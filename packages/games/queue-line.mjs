function fail(code){throw Error(code);}
const exact=(value,keys)=>{if(!value||Object.getPrototypeOf(value)!==Object.prototype||Object.keys(value).sort().join()!==keys.slice().sort().join())fail('BAD_QUEUE_PUZZLE');};

export function validateQueuePuzzle(value){
 exact(value,['id','size','clues']);
 if(typeof value.id!=='string'||!/^[a-z0-9-]{1,48}$/.test(value.id)||!Number.isInteger(value.size)||value.size<4||value.size>7||!Array.isArray(value.clues))fail('BAD_QUEUE_PUZZLE');
 const total=value.size**2,byCell=new Map(),numbers=new Set();
 for(const clue of value.clues){exact(clue,['cell','number']);if(!Number.isInteger(clue.cell)||clue.cell<0||clue.cell>=total||!Number.isInteger(clue.number)||clue.number<1||byCell.has(clue.cell)||numbers.has(clue.number))fail('BAD_QUEUE_CLUE');byCell.set(clue.cell,clue.number);numbers.add(clue.number);}
 if(numbers.size<2||![...numbers].every((_,index)=>numbers.has(index+1)))fail('BAD_QUEUE_CLUE');
 return Object.freeze({id:value.id,size:value.size,total,clues:Object.freeze(new Map(byCell)),last:numbers.size});
}

export class QueueLineRun{
 constructor(puzzle){this.puzzle=validateQueuePuzzle(puzzle);this.path=[];this.solved=false;}
 move(cell){
  if(this.solved)return {kind:'solved',changed:false};
  if(!Number.isInteger(cell)||cell<0||cell>=this.puzzle.total)return {kind:'illegal',changed:false};
  const seen=this.path.indexOf(cell);if(seen>=0){this.path.splice(seen+1);return {kind:'backtrack',changed:true};}
  if(!this.path.length){if(this.puzzle.clues.get(cell)!==1)return {kind:'illegal',changed:false};}
  else{const head=this.path.at(-1),size=this.puzzle.size;if(Math.abs(head-cell)!==size&&!(Math.abs(head-cell)===1&&Math.floor(head/size)===Math.floor(cell/size)))return {kind:'illegal',changed:false};}
  const clue=this.puzzle.clues.get(cell),reached=this.path.reduce((max,x)=>Math.max(max,this.puzzle.clues.get(x)||0),0);
  if(clue!==undefined&&(clue!==reached+1||clue===this.puzzle.last&&this.path.length+1!==this.puzzle.total))return {kind:'illegal',changed:false};
  this.path.push(cell);this.solved=this.path.length===this.puzzle.total&&clue===this.puzzle.last;
  return {kind:this.solved?'solved':clue?'clue':'extend',changed:true};
 }
 undo(){if(this.solved||!this.path.length)return false;this.path.pop();return true;}
 reset(){this.path.length=0;this.solved=false;}
}

export function validateGhost(puzzle,value){
 if(!value||Object.keys(value).sort().join()!==['path','times'].join()||!Array.isArray(value.path)||!Array.isArray(value.times)||value.path.length!==value.times.length)fail('BAD_QUEUE_GHOST');
 const run=new QueueLineRun(puzzle);for(const cell of value.path)if(!run.move(cell).changed)fail('BAD_QUEUE_GHOST');if(!run.solved)fail('BAD_QUEUE_GHOST');
 let prior=-1;for(const time of value.times){if(!Number.isSafeInteger(time)||time<=prior)fail('BAD_QUEUE_GHOST');prior=time;}
 return Object.freeze({path:Object.freeze([...value.path]),times:Object.freeze([...value.times])});
}

export function ghostAt(ghost,elapsedMs){if(!Number.isFinite(elapsedMs)||elapsedMs<0)return null;let index=-1;while(index+1<ghost.times.length&&ghost.times[index+1]<=elapsedMs)index++;return index<0?null:{index,cell:ghost.path[index],finished:index===ghost.path.length-1};}
