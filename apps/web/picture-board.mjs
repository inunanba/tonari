import {pictureBoard} from '../../packages/protocol/picture-board.mjs';

export function renderPictureBoard(board,owned,issued,tag='span'){
 const view=pictureBoard(owned,issued),document=board.ownerDocument;
 board.classList.add('picture-board');board.dataset.complete=String(view.complete);board.replaceChildren(...view.cells.map(cell=>{
  const node=document.createElement(tag);node.className='picture-piece'+(cell.owned?' owned':cell.issued?' issued':' unissued');node.dataset.tile=String(cell.index);
  node.style.setProperty('--piece-x',cell.backgroundPosition.split(' ')[0]);node.style.setProperty('--piece-y',cell.backgroundPosition.split(' ')[1]);
  node.textContent=cell.owned?'':cell.issued?'·':'−';node.setAttribute('aria-label',cell.owned?`ピース${cell.index+1} 所有済み`:cell.issued?`ピース${cell.index+1} 未取得`:`ピース${cell.index+1} 未発行`);return node;
 }));
 return view;
}
