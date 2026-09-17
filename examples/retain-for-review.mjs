import {command} from '../services/local-bridge/client.mjs';
import {writeFile,mkdir,readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
const marker=new URL('../.local/review-plan.json',import.meta.url);
const evidence=new URL('../.local/review-result.json',import.meta.url);
await mkdir(new URL('../.local/',import.meta.url),{recursive:true});
const events=[];
async function run(operation,args={},id) {
  const result=await command(operation,args,id);events.push({operation,...result});
  await writeFile(evidence,JSON.stringify(events,null,2));
  if(!result.success) throw new Error(JSON.stringify(result.error));
  return result.result;
}
// Refuse another demo run: do not duplicate or reposition a layer already left for review.
try {await readFile(marker);throw new Error('A review demo already exists or is unresolved. Inspect .local/review-result.json and AE instead of rerunning.');}
catch(e) {if(e.code!=='ENOENT') throw e;}
const createId=randomUUID();
await writeFile(marker,JSON.stringify({createId,startedAt:new Date().toISOString()}),{flag:'wx'});
const comp=await run('composition.getActive');
const ref={context:comp.context,compositionId:comp.compositionId};
const layer=await run('layer.createText',{...ref,text:'Creative OS'},createId);
const target={...ref,layerId:layer.layerId};
const original=await run('layer.getPosition',target);
const value=original.value.map((v,i)=>v+(i===0?120:i===1?60:0));
await run('layer.setPosition',{...target,value});
const verified=await run('layer.getPosition',target);
if(JSON.stringify(verified.value)!==JSON.stringify(value)) throw new Error('Final Position mismatch');
console.log(JSON.stringify({retained:true,compositionId:comp.compositionId,layerId:layer.layerId,position:verified.value,evidence:evidence.pathname},null,2));
