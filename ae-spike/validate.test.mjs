import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate } from './validate.mjs';

function fixture() {
  return [
    ['start',{version:'26.3x87'}],
    ['get_active_comp',{id:1,layerIds:[5,6]}],
    ['create_text_layer',{id:13,text:'Creative OS'}],
    ['read_position',{layerId:13,value:[960,540,0]}],
    ['set_position',{layerId:13,before:[960,540,0],requested:[1080,600,0],actual:[1080,600,0]}],
    ['undo',{removedLayerId:13,restored:true,beforeLayerIds:[5,6],afterLayerIds:[5,6]}],
    ['complete',{pass:true,operations:5}]
  ].map(([event,data])=>({event,data,runId:'test'}));
}
test('accepts complete evidence preserving pre-existing layers and Z',()=>assert.equal(validate(fixture(),'test').pass,true));
for (const [name,mutate] of [
  ['stale run',e=>{ e[0].runId='old'; }],
  ['missing operation',e=>{ e.splice(3,1); }],
  ['duplicate operation',e=>{ e.splice(2,0,e[2]); }],
  ['wrong layer',e=>{ e[4].data.layerId=5; }],
  ['position not applied',e=>{ e[4].data.actual=[960,540,0]; }],
  ['lost existing layer',e=>{ e[5].data.afterLayerIds=[5]; }],
  ['layer order changed',e=>{ e[5].data.afterLayerIds=[6,5]; }],
  ['text layer remains',e=>{ e[5].data.afterLayerIds=[13,5,6]; }],
  ['host failure',e=>{ e[6].data.pass=false; }]
]) test('rejects '+name,()=>{const e=fixture(); mutate(e); assert.equal(validate(e,'test').pass,false);});
