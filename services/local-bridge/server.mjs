import http from 'node:http';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {validateRequest,failure} from '../../packages/protocol/index.mjs';
import {dispatch,stateDir} from './dispatch.mjs';

export function createBridge({token,execute=dispatch,port=47831}) {
  let busy=false;
  return http.createServer(async(req,res)=>{
    const reply=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));};
    const deny=(status,code,message)=>reply(status,failure(null,code,message));
    if(!['127.0.0.1',`127.0.0.1:${port}`].includes(req.headers.host) || req.headers.origin !== undefined) return deny(403,'LOCAL_ONLY','Browser origins and non-loopback hosts are not accepted.');
    const supplied=Buffer.from(req.headers.authorization || ''),expected=Buffer.from('Bearer '+token);
    if(supplied.length!==expected.length || !timingSafeEqual(supplied,expected)) return deny(401,'UNAUTHORIZED','Local bearer token required.');
    if(req.method==='GET' && req.url==='/health') return reply(200,{service:'creative-os',version:'0.1',busy,aeConnection:'verified_per_command'});
    if(req.method!=='POST' || req.url!=='/commands') return deny(404,'NOT_FOUND','Use POST /commands.');
    if(req.headers['content-type']!=='application/json') return deny(415,'JSON_REQUIRED','Content-Type must be application/json.');
    const chunks=[]; let length=0;
    try {
      for await(const chunk of req) {
        length+=chunk.length;
        if(length>16384) {deny(413,'TOO_LARGE','Maximum body is 16 KB.'); return;}
        chunks.push(chunk);
      }
      const request=validateRequest(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      if(busy) return reply(409,failure(request.requestId,'BRIDGE_BUSY','Wait for the current command; this request was not dispatched.'));
      busy=true;
      try { reply(200,await execute(request)); }
      finally {busy=false;}
    } catch(e) {
      reply(e.code==='INVALID_REQUEST' || e instanceof SyntaxError ? 400:500,failure(null,e.code || 'BRIDGE_ERROR',e.message));
    }
  });
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  await mkdir(stateDir,{recursive:true});
  const tokenPath=path.join(stateDir,'token');
  let token;
  try {token=(await readFile(tokenPath,'utf8')).trim();}
  catch(e) {if(e.code!=='ENOENT') throw e;token=randomBytes(32).toString('hex');await writeFile(tokenPath,token,{flag:'wx',mode:0o600});}
  if(!/^[a-f0-9]{64}$/.test(token)) throw new Error('Invalid local token file');
  const server=createBridge({token});
  server.requestTimeout=5000;server.headersTimeout=5000;
  server.listen(47831,'127.0.0.1',()=>console.log('Creative OS local bridge listening on 127.0.0.1:47831. Changes are retained.'));
  server.on('error',e=>{console.error(e.message);process.exitCode=1;});
  for(const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>server.close());
}
