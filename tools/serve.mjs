import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const types={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};
createServer(async(req,res)=>{
  try {
    const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(path==='/') {res.writeHead(302,{Location:'/apps/web/index.html'}).end();return;}
    const file=resolve(root,'.'+(path==='/'?'/apps/web/index.html':path));
    if(!file.startsWith(root+'/') || !types[extname(file)]) {res.writeHead(404).end();return;}
    res.writeHead(200,{'Content-Type':types[extname(file)],'Cache-Control':'no-store'});res.end(await readFile(file));
  } catch {res.writeHead(404).end();}
}).listen(4173,'127.0.0.1',()=>console.log('TONARI local prototype http://127.0.0.1:4173'));
