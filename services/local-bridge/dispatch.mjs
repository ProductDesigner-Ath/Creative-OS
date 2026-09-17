import {spawn} from 'node:child_process';
import {mkdir,readFile,writeFile,open,unlink} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {failure} from '../../packages/protocol/index.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
export const stateDir=path.join(root,'.local');
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
export async function dispatch(request) {
  const journal=path.join(stateDir,'requests');
  await mkdir(journal,{recursive:true});
  const dir=path.join(journal,request.requestId), signature=hash(request);
  const receiptPath=path.join(dir,'receipt.json');
  try {
    const receipt=JSON.parse(await readFile(receiptPath,'utf8'));
    if(receipt.signature!==signature) return failure(request.requestId,'ID_CONFLICT','Request ID was used with different arguments.');
    try { return {...JSON.parse((await readFile(path.join(dir,'response.json'),'utf8')).replace(/^\uFEFF/,'')),replayed:true}; }
    catch { return failure(request.requestId,'OUTCOME_UNKNOWN','This request was already dispatched or interrupted. Inspect AE and its journal; it will not be executed again.'); }
  } catch(e) { if(e.code!=='ENOENT') throw e; }
  const lockPath=path.join(stateDir,'dispatch.lock');
  let lock;
  try { lock=await open(lockPath,'wx'); }
  catch { return failure(request.requestId,'BRIDGE_BUSY_OR_UNRESOLVED','A command is running or has an unresolved outcome. Inspect .local/dispatch.lock.'); }
  let resolved=false;
  try {
    await mkdir(dir); // Existing partial journal is deliberately not overwritten.
    await writeFile(receiptPath,JSON.stringify({signature,request,createdAt:new Date().toISOString()},null,2));
    await lock.writeFile(JSON.stringify({requestId:request.requestId,dir},null,2));
    const responsePath=path.join(dir,'response.json');
    const scriptPath=path.join(dir,'command.jsx');
    const source=await readFile(path.join(root,'adapters/after-effects/command.jsx'),'utf8');
    const config=JSON.stringify({request,contextToken:randomUUID(),startedPath:path.join(dir,'started.json').replaceAll('\\','/'),responsePath:responsePath.replaceAll('\\','/')}).replaceAll('\u2028','\\u2028').replaceAll('\u2029','\\u2029');
    await writeFile(scriptPath,source.replace('__COMMAND_CONFIG__',()=>config));
    const exe=process.env.AE_EXE || 'C:\\Program Files\\Adobe\\Adobe After Effects 2026\\Support Files\\AfterFX.exe';
    const child=spawn(exe,['-r',scriptPath],{shell:false,windowsHide:true,stdio:'ignore'});
    let launchError; child.on('error',e=>{launchError=e;}); child.unref();
    const deadline=Date.now()+30000;
    while(Date.now()<deadline) {
      if(launchError) { resolved=true; const result=failure(request.requestId,'LAUNCH_FAILED',launchError.message); await writeFile(responsePath,JSON.stringify(result)); return result; }
      try {
        const raw=(await readFile(responsePath,'utf8')).replace(/^\uFEFF/,'');
        if(raw.endsWith('\n')) {
          const result=JSON.parse(raw);
          if(result.requestId!==request.requestId || result.version!=='0.1' || typeof result.success!=='boolean') throw new Error('Invalid response identity');
          resolved=true; return result;
        }
      } catch(e) { if(e.code!=='ENOENT' && !(e instanceof SyntaxError)) throw e; }
      await new Promise(r=>setTimeout(r,100));
    }
    return failure(request.requestId,'OUTCOME_UNKNOWN','AE did not reply in 30 seconds. Changes may have occurred; no automatic retry or undo. Inspect AE and the journal.');
  } finally {
    await lock.close();
    if(resolved) await unlink(lockPath);
  }
}
