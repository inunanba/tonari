/** Preserve explicit user actions during slow RPC, with a bounded FIFO. */
export class ActionQueue {
 constructor({onChange=()=>{},limit=4}={}){this.onChange=onChange;this.limit=limit;this.count=0;this.tail=Promise.resolve();}
 runCurrent(expected,current,action){return this.run(()=>{if(!expected||current()!==expected)throw Error('ACTION_CONTEXT_CHANGED');return action();});}
 run(action){
  if(this.count>=this.limit)return Promise.reject(Error('ACTION_QUEUE_FULL'));
  this.count++;this.onChange(this.count);
  const result=this.tail.then(action);
  const settled=result.finally(()=>{this.count--;this.onChange(this.count);});
  this.tail=settled.catch(()=>{});return settled;
 }
}
