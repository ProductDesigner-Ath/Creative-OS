import {command} from '../local-bridge/client.mjs';

const stepTypes=new Set(['importAsset','placeAsset','setTiming','addText','positionKeyframes','opacityKeyframes','setFrame','verifyLayers']);
const isObject=value=>value && typeof value==='object' && !Array.isArray(value);

export function validateRecipe(recipe){
  if(!isObject(recipe) || recipe.version!=='0.1' || typeof recipe.name!=='string' || !recipe.name || !Number.isSafeInteger(recipe.compositionId) || recipe.compositionId<1 || !Array.isArray(recipe.steps) || recipe.steps.length<1 || recipe.steps.length>40) throw new Error('Recipe must have a name, composition ID, and 1–40 steps.');
  const refs=new Set();
  for(const step of recipe.steps){
    if(!isObject(step) || !stepTypes.has(step.type)) throw new Error('Recipe contains an unsupported step type.');
    if(['importAsset','addText'].includes(step.type)){
      if(typeof step.ref!=='string' || !/^[A-Za-z][A-Za-z0-9_-]{0,39}$/.test(step.ref) || refs.has(step.ref)) throw new Error('Recipe references must be unique short identifiers.');
      refs.add(step.ref);
    }
    if(['placeAsset','setTiming','positionKeyframes','opacityKeyframes'].includes(step.type) && (!refs.has(step.ref))) throw new Error('Recipe step refers to an unavailable asset or layer reference.');
    if(step.type==='verifyLayers' && (!Array.isArray(step.names) || !step.names.length || !step.names.every(name=>typeof name==='string' && name.length>0 && name.length<=100))) throw new Error('Verification requires one or more expected layer names.');
  }
  return recipe;
}

export async function runRecipe(recipe,{apply=false,execute=command}={}){
  validateRecipe(recipe);
  const plan={name:recipe.name,compositionId:recipe.compositionId,apply,steps:recipe.steps.map(step=>step.type)};
  if(!apply) return {success:true,dryRun:true,plan};
  const opened=await execute('composition.openById',{compositionId:recipe.compositionId});
  if(!opened.success) return opened;
  const context=opened.result.context, refs=new Map(), results=[];
  const call=async(operation,args)=>{const response=await execute(operation,{context,compositionId:recipe.compositionId,...args}); if(!response.success) throw new Error(response.error?.message || operation+' failed'); return response.result;};
  for(const step of recipe.steps){
    let result;
    if(step.type==='importAsset'){result=await call('project.importAsset',{assetPath:step.assetPath});refs.set(step.ref,{itemId:result.itemId,name:result.name});}
    else if(step.type==='placeAsset'){const source=refs.get(step.ref);result=await call('layer.addProjectItem',{itemId:source.itemId,position:step.position,scale:step.scale});refs.set(step.ref,{...source,layerId:result.layerId});}
    else if(step.type==='setTiming'){result=await call('layer.setTiming',{layerId:refs.get(step.ref).layerId,inPoint:step.inPoint,outPoint:step.outPoint});}
    else if(step.type==='addText'){result=await call('layer.createText',{text:step.text});refs.set(step.ref,{layerId:result.layerId,name:step.text});}
    else if(step.type==='positionKeyframes'){result=await call('layer.addPositionKeyframes',{layerId:refs.get(step.ref).layerId,keyframes:step.keyframes});}
    else if(step.type==='opacityKeyframes'){result=await call('layer.addOpacityKeyframes',{layerId:refs.get(step.ref).layerId,keyframes:step.keyframes});}
    else if(step.type==='setFrame'){result=await call('composition.setCurrentFrame',{frame:step.frame});}
    else {const layers=await call('composition.getLayers',{});const found=step.names.filter(name=>layers.layers.some(layer=>layer.name===name));result={expected:step.names,found,passed:found.length===step.names.length};if(!result.passed) throw new Error('Recipe verification did not find every expected layer.');}
    results.push({type:step.type,result});
  }
  return {success:true,dryRun:false,compositionId:recipe.compositionId,results,retained:true};
}
