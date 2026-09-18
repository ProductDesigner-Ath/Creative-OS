import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runRecipe,validateRecipe} from '../services/scene-recipe/index.mjs';

const recipe={version:'0.1',name:'Test scene',compositionId:1,steps:[{type:'importAsset',ref:'icon',assetPath:'AE_icon.png'},{type:'placeAsset',ref:'icon',position:[960,540],scale:[50,50]},{type:'setTiming',ref:'icon',inPoint:0,outPoint:1},{type:'verifyLayers',names:['AE_icon.png']}]};
test('scene recipe validates a constrained import, place, timing, and verification sequence',()=>assert.doesNotThrow(()=>validateRecipe(recipe)));
test('scene recipe rejects unrecognized steps and undefined references',()=>{
  assert.throws(()=>validateRecipe({...recipe,steps:[{type:'executeScript'}]}));
  assert.throws(()=>validateRecipe({...recipe,steps:[{type:'setTiming',ref:'missing',inPoint:0,outPoint:1}]}));
});
test('scene recipe defaults to a non-mutating dry run',async()=>{
  const result=await runRecipe(recipe);
  assert.deepEqual(result,{success:true,dryRun:true,plan:{name:'Test scene',compositionId:1,apply:false,steps:['importAsset','placeAsset','setTiming','verifyLayers']}});
});
