/** Bounded network retries; an online event is a hint, never the only trigger. */
export class SettlementRetry {
 constructor({attempt,isPending,isOnline,isVisible=()=>true,setTimer=setTimeout,clearTimer=clearTimeout,delay=15000,initialDelay=2000,maxAttempts=3}){
  Object.assign(this,{attempt,isPending,isOnline,isVisible,setTimer,clearTimer,delay,initialDelay,maxAttempts});this.timer=null;this.active=false;this.busy=false;this.attempts=0;this.blocked=false;
 }
 start(){this.active=true;this.arm(this.initialDelay);}
 stop(){this.active=false;if(this.timer!==null)this.clearTimer(this.timer);this.timer=null;}
 arm(delay=this.delay){
  if(!this.active||!this.isPending()||this.blocked||this.attempts>=this.maxAttempts||this.timer!==null||this.busy)return;
  this.timer=this.setTimer(async()=>{this.timer=null;await this.request(false);this.arm();},delay);
 }
 async request(manual=true){
  if(!this.active||!this.isPending()||this.busy)return;
  if(!manual&&(!this.isOnline()||!this.isVisible()||this.blocked||this.attempts>=this.maxAttempts)){this.arm();return;}
  if(this.timer!==null)this.clearTimer(this.timer);this.timer=null;this.busy=true;
  if(!manual)this.attempts++;
  try{const result=await this.attempt();if(result?.done)this.stop();else if(result?.retryable===false)this.blocked=true;}
  finally{this.busy=false;this.arm();}
 }
}
