import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {validateRequest} from '../../packages/protocol/index.mjs';
export async function command(operation,args={},requestId=randomUUID()) {
  const request=validateRequest({version:'0.1',requestId,app:'after_effects',operation,arguments:args});
  const token=(await readFile(new URL('../../.local/token',import.meta.url),'utf8')).trim();
  const response=await fetch('http://127.0.0.1:47831/commands',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(request),signal:AbortSignal.timeout(35000)});
  return response.json();
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  try { const result=await command(process.argv[2] || 'composition.getActive',JSON.parse(process.argv[3] || '{}'),process.argv[4]);console.log(JSON.stringify(result,null,2));if(!result.success) process.exitCode=1; }
  catch(e) {console.error(e.message);process.exitCode=1;}
}
