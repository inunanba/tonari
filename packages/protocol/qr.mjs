import {qrcodegen} from '../../vendor/qrcodegen.mjs';
import jsQR from '../../vendor/jsqr.mjs';
import {decodeWire as decodeV1} from './wire.mjs';
import {decodeWire as decodeV2} from './wire-v2.mjs';
const decodeWire=text=>typeof text==='string'&&text.startsWith('TONARI2:')?decodeV2(text):decodeV1(text);
/** Generated matrix/raster contains only public, typed TONARI wire bytes. */
export function qrRaster(text,scale=4) {
  decodeWire(text);
  if(!Number.isInteger(scale)||scale<2||scale>8)throw new Error('BAD_QR_SCALE');
  const qr=qrcodegen.QrCode.encodeText(text,qrcodegen.QrCode.Ecc.MEDIUM);
  const border=4,width=(qr.size+2*border)*scale,data=new Uint8ClampedArray(width*width*4);data.fill(255);
  for(let y=0;y<qr.size;y++)for(let x=0;x<qr.size;x++)if(qr.getModule(x,y)) {
    for(let dy=0;dy<scale;dy++)for(let dx=0;dx<scale;dx++) {
      const p=(((y+border)*scale+dy)*width+(x+border)*scale+dx)*4;
      data[p]=data[p+1]=data[p+2]=0;
    }
  }
  return {data,width,height:width,version:qr.version,modules:qr.size,quietZone:4};
}
export function scanRaster(data,width,height) {
  if(!(data instanceof Uint8ClampedArray)||!Number.isInteger(width)||!Number.isInteger(height)||width<16||height<16||width>1280||height>1280||data.length!==width*height*4)throw new Error('BAD_IMAGE_SIZE');
  const decoded=jsQR(data,width,height,{inversionAttempts:'attemptBoth'});
  if(!decoded)return null;
  decodeWire(decoded.data);return decoded.data;
}
