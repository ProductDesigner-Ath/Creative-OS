import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import http from 'node:http';
import {validateRequest} from '../packages/protocol/index.mjs';
import {createBridge} from '../services/local-bridge/server.mjs';
const base=()=>({version:'0.1',requestId:randomUUID(),app:'after_effects',operation:'composition.getActive',arguments:{}});
test('allowlist accepts inspection and treats quoted text as data',()=>{
  assert.doesNotThrow(()=>validateRequest(base()));
  assert.doesNotThrow(()=>validateRequest({...base(),operation:'layer.createText',arguments:{context:randomUUID(),compositionId:1,text:'"; app.quit(); //'}}));
});
test('allowlist accepts bounded text styling and rejects unsafe values',()=>{
  const request={...base(),operation:'layer.setTextStyle',arguments:{context:randomUUID(),compositionId:1,layerId:1,fontSize:72,fillColor:[1,0.5,0],justification:'center'}};
  assert.doesNotThrow(()=>validateRequest(request));
  assert.throws(()=>validateRequest({...request,arguments:{...request.arguments,fontSize:1001}}));
  assert.throws(()=>validateRequest({...request,arguments:{...request.arguments,justification:'justifyAll'}}));
});
test('allowlist accepts an exact composition frame and rejects invalid frames',()=>{
  const request={...base(),operation:'composition.setCurrentFrame',arguments:{context:randomUUID(),compositionId:1,frame:24}};
  assert.doesNotThrow(()=>validateRequest(request));
  assert.throws(()=>validateRequest({...request,arguments:{...request.arguments,frame:-1}}));
  assert.throws(()=>validateRequest({...request,arguments:{...request.arguments,frame:1.5}}));
});
test('allowlist accepts frame-specific visual inspection',()=>{
  const request={...base(),operation:'composition.getVisibleLayersAtFrame',arguments:{context:randomUUID(),compositionId:1,frame:0}};
  assert.doesNotThrow(()=>validateRequest(request));
  assert.throws(()=>validateRequest({...request,arguments:{...request.arguments,frame:-1}}));
});
test('allowlist accepts composition-marker inspection',()=>assert.doesNotThrow(()=>validateRequest({...base(),operation:'composition.getMarkers',arguments:{context:randomUUID(),compositionId:1}})));
test('allowlist accepts a bounded exact-frame marker',()=>{
  const request={...base(),operation:'composition.addMarker',arguments:{context:randomUUID(),compositionId:1,frame:24,comment:'Text arrives'}};
  assert.doesNotThrow(()=>validateRequest(request));
  assert.throws(()=>validateRequest({...request,arguments:{...request.arguments,comment:''}}));
});
test('allowlist accepts parenting only between distinct valid layer IDs',()=>{
  const request={...base(),operation:'layer.setParent',arguments:{context:randomUUID(),compositionId:1,layerId:2,parentLayerId:1}};
  assert.doesNotThrow(()=>validateRequest(request));
  assert.throws(()=>validateRequest({...request,arguments:{...request.arguments,parentLayerId:2}}));
});
test('allowlist accepts layer reordering only between distinct valid layer IDs',()=>{
  const request={...base(),operation:'layer.moveBefore',arguments:{context:randomUUID(),compositionId:1,layerId:2,targetLayerId:1}};
  assert.doesNotThrow(()=>validateRequest(request));
  assert.throws(()=>validateRequest({...request,arguments:{...request.arguments,targetLayerId:2}}));
});
for(const [label,change] of [
  ['arbitrary code',r=>({...r,operation:'eval',arguments:{script:'app.quit()'}})],
  ['undo',r=>({...r,operation:'undo'})],
  ['extra source field',r=>({...r,script:'app.quit()'})],
  ['request path traversal',r=>({...r,requestId:'../../file'})],
  ['invalid text',r=>({...r,operation:'layer.createText',arguments:{context:randomUUID(),compositionId:1,text:'x'.repeat(201)}})],
  ['nonfinite position',r=>({...r,operation:'layer.setPosition',arguments:{context:randomUUID(),compositionId:1,layerId:1,value:[NaN,0]}})],
  ['unknown argument',r=>({...r,arguments:{path:'anything'}})]
]) test('rejects '+label,()=>assert.throws(()=>validateRequest(change(base()))));
test('HTTP authentication, origin, host, schema and serialization boundaries',async()=>{
  let calls=0,release;
  const server=createBridge({token:'test-token',execute:async r=>{calls++;if(r.arguments.text==='hold') await new Promise(resolve=>{release=resolve;});return {version:'0.1',requestId:r.requestId,success:true,result:{}};}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url='http://127.0.0.1:'+server.address().port+'/commands';
  const headers={Host:'127.0.0.1',Authorization:'Bearer test-token','Content-Type':'application/json'};
  const send=(body=base(),custom={})=>new Promise((resolve,reject)=>{
    const req=http.request(url,{method:'POST',headers:{...headers,...custom}},res=>{res.resume();res.on('end',()=>resolve({status:res.statusCode}));});
    req.on('error',reject);req.end(JSON.stringify(body));
  });
  try {
    assert.equal((await send(base(),{Authorization:'Bearer wrong'})).status,401);
    assert.equal((await send(base(),{Origin:'https://example.com'})).status,403);
    assert.equal((await send(base(),{Host:'attacker.test'})).status,403);
    assert.equal((await send(base(),{'Content-Type':'text/plain'})).status,415);
    assert.equal((await send({...base(),operation:'eval'})).status,400);
    assert.equal(calls,0);
    assert.equal((await send()).status,200);
    const held=send({...base(),operation:'layer.createText',arguments:{context:randomUUID(),compositionId:1,text:'hold'}});
    for(let i=0;i<50 && !release;i++) await new Promise(r=>setTimeout(r,10));
    assert.ok(release);
    assert.equal((await send()).status,409);
    release(); assert.equal((await held).status,200);
    assert.equal(calls,2);
  } finally {release?.();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
