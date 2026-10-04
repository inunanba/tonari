import {scanRaster} from '../../packages/protocol/qr.mjs';
export class CameraReader {
  #video;#canvas=document.createElement('canvas');#stream=null;#generation=0;#timer=null;
  constructor(video) {this.#video=video;}
  stop() {
    this.#generation++;clearTimeout(this.#timer);this.#timer=null;
    this.#stream?.getTracks().forEach(t=>t.stop());this.#stream=null;this.#video.srcObject=null;this.#video.hidden=true;
  }
  async start(onRead,onError) {
    this.stop();const generation=this.#generation;
    if(!navigator.mediaDevices?.getUserMedia)throw new Error('このブラウザーではカメラを使えません。QR画像を選んでください。');
    const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
    if(generation!==this.#generation){stream.getTracks().forEach(t=>t.stop());return;}
    this.#stream=stream;this.#video.srcObject=stream;this.#video.hidden=false;
    try {await this.#video.play();}catch(e){this.stop();throw e;}
    const tick=()=>{
      if(generation!==this.#generation)return;
      try {
        if(this.#video.readyState>=2) {
          const w=this.#video.videoWidth,h=this.#video.videoHeight,s=Math.min(1,720/Math.max(w,h));
          const canvas=this.#canvas;canvas.width=Math.max(16,Math.round(w*s));canvas.height=Math.max(16,Math.round(h*s));
          const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(this.#video,0,0,canvas.width,canvas.height);
          const text=scanRaster(ctx.getImageData(0,0,canvas.width,canvas.height).data,canvas.width,canvas.height);
          if(text){this.stop();Promise.resolve(onRead(text)).catch(onError);return;}
        }
      } catch(e){this.stop();onError(e);return;}
      this.#timer=setTimeout(tick,350);
    };tick();
  }
}
export async function readQRFile(file) {
  if(!file||file.size>4*1024*1024||!['image/png','image/jpeg','image/webp'].includes(file.type))throw new Error('4MB以下のPNG・JPEG・WebP画像を選んでください。');
  const bitmap=await createImageBitmap(file);
  try {
    if(bitmap.width>4096||bitmap.height>4096||bitmap.width*bitmap.height>16000000)throw new Error('画像が大きすぎます。');
    const s=Math.min(1,720/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');
    canvas.width=Math.max(16,Math.round(bitmap.width*s));canvas.height=Math.max(16,Math.round(bitmap.height*s));
    const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
    const text=scanRaster(ctx.getImageData(0,0,canvas.width,canvas.height).data,canvas.width,canvas.height);
    if(!text)throw new Error('QRを見つけられませんでした。余白を含む鮮明な画像を選んでください。');return text;
  } finally {bitmap.close();}
}
