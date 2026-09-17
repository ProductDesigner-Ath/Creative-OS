import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import path from 'node:path';
const cwd=path.resolve('.');
function session(){const p=spawn(process.execPath,['services/mcp-server/server.mjs'],{cwd});let buf='',waiters=[];p.stdout.on('data',d=>{buf+=d;for(;;){const i=buf.indexOf('\n');if(i<0)break;const line=buf.slice(0,i);buf=buf.slice(i+1);waiters.shift()?.(JSON.parse(line));}});return {p,send(m){return new Promise((resolve,reject)=>{waiters.push(resolve);p.stdin.write(JSON.stringify(m)+'\n');setTimeout(()=>reject(new Error('MCP response timeout')),3000);});}};}
test('MCP initializes and advertises only the allowlist',async()=>{const s=session();try{const init=await s.send({jsonrpc:'2.0',id:1,method:'initialize',params:{}});assert.equal(init.result.serverInfo.name,'creative-os-local-mcp');const list=await s.send({jsonrpc:'2.0',id:2,method:'tools/list'});assert.deepEqual(list.result.tools.map(x=>x.name),['ae_get_active_composition','ae_get_layers','ae_get_composition_state','ae_create_text_layer','ae_get_position','ae_get_transform','ae_get_source_info','ae_get_text_document','ae_get_animation_state','ae_set_position','ae_add_position_keyframes','ae_add_opacity_keyframes','ae_add_transform_keyframes','ae_get_keyframes']);}finally{s.p.kill();}});
test('MCP rejects unknown methods and tools',async()=>{const s=session();try{const m=await s.send({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'eval',arguments:{script:'app.quit()'}}});assert.equal(m.error.code,-32602);}finally{s.p.kill();}});
