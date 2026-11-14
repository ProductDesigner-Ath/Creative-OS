import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'dist');
export function createPreviewServer(port=47832,assetRoot=root){const server=http.createServer(async(req,res)=>{
 const boundPort=port||server.address()?.port;
 if(![`127.0.0.1:${boundPort}`,`localhost:${boundPort}`].includes(req.headers.host)){res.writeHead(403);res.end('Local preview only');return;}
 if(req.method!=='GET'){res.writeHead(405);res.end();return;}
 const pathname=new URL(req.url,'http://127.0.0.1').pathname;
 const target=pathname==='/'?'index.html':/^\/assets\/[a-zA-Z0-9_.-]+\.(js|css)$/.test(pathname)?pathname.slice(1):null;
 if(!target){res.writeHead(404);res.end();return;}
 try{const body=await readFile(path.join(assetRoot,target));res.writeHead(200,{'Content-Type':target.endsWith('.js')?'text/javascript':target.endsWith('.css')?'text/css':'text/html','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",'Referrer-Policy':'no-referrer'});res.end(body);}catch{res.writeHead(500);res.end('Build the interface first: npm run outreach:build');}
});return server;}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const server=createPreviewServer();server.listen(47832,'127.0.0.1',()=>console.log('Creative OS · Email & Leads: http://127.0.0.1:47832'));server.on('error',e=>{console.error(e.message);process.exitCode=1;});}
