import http from 'node:http';
import {createWriteStream} from 'node:fs';
import {mkdir, readFile, rename, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const dataRoot=path.join(root,'.local','video-intake','jobs');
const assetRoot=path.join(root,'assets','reference');
const maxUploadBytes=1024*1024*1024;
const videoExtensions=new Set(['.mp4','.mov','.m4v','.webm','.avi']);

export function sanitizeFilename(value='') {
  const base=path.basename(String(value)).replace(/[^a-zA-Z0-9._ -]/g,'_').replace(/^\.+/,'');
  if(!base || base.length>180 || !videoExtensions.has(path.extname(base).toLowerCase())) throw Object.assign(new Error('Use a supported video file: MP4, MOV, M4V, WebM, or AVI.'),{code:'BAD_FILENAME'});
  return base;
}
export function jobId() { return `${Date.now()}-${Math.random().toString(16).slice(2,10)}`; }
function reply(res,status,body,headers={}) { res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});res.end(JSON.stringify(body)); }
function localOnly(req,port) { return ['127.0.0.1',`127.0.0.1:${port}`].includes(req.headers.host) && (req.headers.origin === undefined || req.headers.origin===`http://127.0.0.1:${port}`); }
async function bodyToFile(req,target) {
  await new Promise((resolve,reject)=>{
    let total=0, failed=false; const output=createWriteStream(target,{flags:'wx'});
    req.on('data',chunk=>{ total+=chunk.length; if(total>maxUploadBytes && !failed) { failed=true; req.destroy(Object.assign(new Error('Video is larger than 1 GB.'),{code:'TOO_LARGE'})); } });
    req.on('error',reject); output.on('error',reject); output.on('finish',resolve); req.pipe(output);
  });
}
export function createVideoIntake({port=47832}={}) {
  return http.createServer(async(req,res)=>{
    if(!localOnly(req,port)) return reply(res,403,{error:'LOCAL_ONLY'});
    const url=new URL(req.url,`http://127.0.0.1:${port}`);
    try {
      if(req.method==='GET' && url.pathname==='/health') return reply(res,200,{service:'creative-os-video-intake',localOnly:true});
      if(req.method==='GET' && url.pathname==='/') { const html=await readFile(path.join(root,'services','video-intake','public','index.html')); res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}); return res.end(html); }
      if(req.method==='POST' && url.pathname==='/api/upload') {
        const filename=sanitizeFilename(url.searchParams.get('filename')); const id=jobId(); const folder=path.join(dataRoot,id); await mkdir(folder,{recursive:true});
        const temp=path.join(folder,'upload.part'); const target=path.join(folder,filename);
        try { await bodyToFile(req,temp); await rename(temp,target); }
        catch(error) { await rm(folder,{recursive:true,force:true}); throw error; }
        await mkdir(assetRoot,{recursive:true});
        await writeFile(path.join(folder,'job.json'),JSON.stringify({id,filename,source:target,status:'uploaded',createdAt:new Date().toISOString()},null,2));
        return reply(res,201,{id,filename,uploadUrl:`/api/jobs/${id}/video`});
      }
      const videoMatch=url.pathname.match(/^\/api\/jobs\/([a-z0-9-]+)\/video$/);
      if(req.method==='GET' && videoMatch) { const job=JSON.parse(await readFile(path.join(dataRoot,videoMatch[1],'job.json'),'utf8')); const video=await readFile(job.source); res.writeHead(200,{'Content-Type':'video/mp4','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}); return res.end(video); }
      const frameMatch=url.pathname.match(/^\/api\/jobs\/([a-z0-9-]+)\/frames\/(\d+)\.png$/);
      if(req.method==='POST' && frameMatch) { const folder=path.join(dataRoot,frameMatch[1],'frames'); await mkdir(folder,{recursive:true}); const chunks=[]; for await(const chunk of req) chunks.push(chunk); const image=Buffer.concat(chunks); if(image.length>8*1024*1024) throw Object.assign(new Error('Frame exceeds 8 MB.'),{code:'TOO_LARGE'}); await writeFile(path.join(folder,`${frameMatch[2]}.png`),image); return reply(res,201,{saved:true}); }
      const reportMatch=url.pathname.match(/^\/api\/jobs\/([a-z0-9-]+)\/report$/);
      if(req.method==='POST' && reportMatch) { const chunks=[]; for await(const chunk of req) chunks.push(chunk); const report=JSON.parse(Buffer.concat(chunks).toString('utf8')); await writeFile(path.join(dataRoot,reportMatch[1],'report.json'),JSON.stringify(report,null,2)); return reply(res,201,{saved:true}); }
      return reply(res,404,{error:'NOT_FOUND'});
    } catch(error) { return reply(res,error.code==='BAD_FILENAME'?400:error.code==='TOO_LARGE'?413:500,{error:error.code||'VIDEO_INTAKE_ERROR',message:error.message}); }
  });
}
if(process.argv[1]===fileURLToPath(import.meta.url)) { const server=createVideoIntake(); server.listen(47832,'127.0.0.1',()=>console.log('Creative OS video intake: http://127.0.0.1:47832')); }


