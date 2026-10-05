import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {pathToFileURL} from 'node:url';
const root=resolve(import.meta.dirname,'..');
const types={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};
export function createWebServer(relay=null){return createServer(async(req,res)=>{
  try {
    const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(path.startsWith('/api/tonari/')){
      res.setHeader('Cache-Control','no-store');
      if(!relay){res.writeHead(503).end('CHAIN_SERVICE_UNAVAILABLE');return;}
      if(req.headers.host!==`127.0.0.1:${req.socket.localPort}`||req.headers.origin&&req.headers.origin!==`http://127.0.0.1:${req.socket.localPort}`){res.writeHead(403).end('BAD_ORIGIN');return;}
      const endpoint=path.slice('/api/tonari/'.length);let value;
      if(req.method==='GET'&&endpoint==='config')value=relay.config;
      else if(req.method==='GET'&&endpoint==='state')value=await relay.state();
      else if(req.method==='GET'&&endpoint==='claim-status')value=await relay.claimStatus();
      else if(req.method==='POST'&&['join','settle','claim-open','claim-token','claim-submit','claim-root','claim-reveal'].includes(endpoint)){
        if(req.headers['content-type']!=='application/json'){res.writeHead(415).end('JSON_REQUIRED');return;}
        const limit=endpoint==='claim-submit'?16384:2048;let body='';for await(const part of req){body+=part.toString();if(Buffer.byteLength(body)>limit){res.writeHead(413).end('BODY_TOO_LARGE');return;}}
        const method={'claim-open':'claimOpen','claim-token':'claimToken','claim-submit':'claimSubmit','claim-root':'claimRoot','claim-reveal':'claimReveal'}[endpoint]||endpoint;value=await relay[method](JSON.parse(body));
      }else{res.writeHead(404).end();return;}
      res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'}).end(JSON.stringify(value));return;
    }
    if(path==='/') {res.writeHead(302,{Location:'/apps/web/index.html'}).end();return;}
    const file=resolve(root,'.'+(path==='/'?'/apps/web/index.html':path));
    if(!file.startsWith(root+'/') || !types[extname(file)]) {res.writeHead(404).end();return;}
    res.writeHead(200,{'Content-Type':types[extname(file)],'Cache-Control':'no-store'});res.end(await readFile(file));
  } catch(e) {res.writeHead(400,{'Content-Type':'text/plain; charset=utf-8'}).end(String(e.message).slice(0,160));}
});}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)createWebServer().listen(4173,'127.0.0.1',()=>console.log('TONARI local prototype http://127.0.0.1:4173'));
