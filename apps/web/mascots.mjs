/** Original offline SVG guides: もも (pink), るる (lavender). No external asset requests. */
export const GUIDE_STATES=Object.freeze({
 welcome:{label:'ももとるるが、ハートのピースをそっと分けあっています。',title:'ももとるると、となりへ。',copy:'一枚のピースから、ゆっくり仲よく。交換しないで、眺めるだけでも大丈夫。'},
 waiting:{label:'ももとるるが、となりでのんびり待っています。',title:'ひと息ついて、待とうね。',copy:'急がなくて大丈夫。順番が来たら、いつでも閉じてね。'},
 swap:{label:'ももが、るるにハートのピースを渡しています。',title:'小さな「ありがとう」が届いたよ。',copy:'ふたりの交換の約束を保存したよ。となりとつながる一枚だね。'},
 tier:{label:'ももとるるが、未所持のピースを喜んでいます。',title:'まだ持っていない一枚。',copy:'席でも、交換でも、空いたスポットでも。急いで集めなくて大丈夫。'},
 complete:{label:'ももとるるが、完成したハートを一緒に持っています。',title:'ふたりで、ひとつの思い出。',copy:'あなたのペースでできた一枚。今日のとなりを、思い出にしよう。'}
});
const chick=(x,color,cheek,flip)=>`<g transform="translate(${x} 66) ${flip?'scale(-1 1)':''}"><path d="M-35 47q-9 11 4 12m32-12q14 9 8 12" stroke="#b97639" stroke-width="5" stroke-linecap="round" fill="none"/><path d="M-49 8Q-55-24-24-28Q-30-43-9-34Q-1-48 9-32Q36-37 45-13Q59-7 48 13Q56 44 30 51Q3 66-27 50Q-56 43-49 8" fill="${color}" stroke="#7d5677" stroke-width="2"/><path d="M-34 18q-18-13-12-25M35 19q16-14 10-23" fill="none" stroke="#fffaf6" stroke-width="6" stroke-linecap="round"/><ellipse cx="-17" cy="14" rx="7" ry="4" fill="${cheek}"/><ellipse cx="23" cy="14" rx="7" ry="4" fill="${cheek}"/><path d="M-12 3q2-4 4 0M13 3q2-4 4 0" stroke="#493447" stroke-width="3" fill="none" stroke-linecap="round"/><path d="m-2 9 7 0-3 6Z" fill="#b97639"/></g>`;
export function mascotSVG(state='welcome'){
 if(!Object.hasOwn(GUIDE_STATES,state))state='welcome';const celebration=['tier','complete'].includes(state);
 return `<svg viewBox="0 0 300 150" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg"><ellipse cx="150" cy="130" rx="115" ry="10" fill="#ecdfea"/>${chick(91,'#ffd2e3','#ef9fbb',false)}${chick(209,'#e0d0f7','#bda3e4',true)}<g class="heart-piece" transform="translate(150 87)"><path d="M0 28C-55-4-23-40 0-18C23-40 55-4 0 28Z" fill="${celebration?'#c35b80':'#fff6d6'}" stroke="#8b3e68" stroke-width="2"/><path d="M0-18V-5q12-3 9 5q-3 7-9 2v26" fill="none" stroke="#8b3e68" stroke-width="2"/></g><g fill="#a57833"><path d="m32 28 3-8 3 8 8 3-8 3-3 8-3-8-8-3Z"/><path d="m262 34 3-8 3 8 8 3-8 3-3 8-3-8-8-3Z"/>${celebration?'<path d="m150 13 3-8 3 8 8 3-8 3-3 8-3-8-8-3Z"/>':''}</g></svg>`;
}
export class TonariGuide extends (globalThis.HTMLElement || class {}) {
 static observedAttributes=['state'];
 connectedCallback(){this.render();}attributeChangedCallback(){if(this.isConnected)this.render();}
 render(){const value=this.getAttribute('state'),state=Object.hasOwn(GUIDE_STATES,value)?value:'welcome',s=GUIDE_STATES[state];this.dataset.guideState=state;
 this.innerHTML=`<div class="guide-art" role="img" aria-label="${s.label}">${mascotSVG(state)}</div><div class="guide-copy"><span class="guide-names">もも ＆ るる</span><p class="guide-title">${s.title}</p><p>${s.copy}</p></div>`;
 }
}
if(typeof customElements!=='undefined'&&!customElements.get('tonari-guide'))customElements.define('tonari-guide',TonariGuide);
