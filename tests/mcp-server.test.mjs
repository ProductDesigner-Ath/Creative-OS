import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import path from 'node:path';
const cwd=path.resolve('.');
function session(){const p=spawn(process.execPath,['services/mcp-server/server.mjs'],{cwd});let buf='',waiters=[];p.stdout.on('data',d=>{buf+=d;for(;;){const i=buf.indexOf('\n');if(i<0)break;const line=buf.slice(0,i);buf=buf.slice(i+1);waiters.shift()?.(JSON.parse(line));}});return {p,send(m){return new Promise((resolve,reject)=>{waiters.push(resolve);p.stdin.write(JSON.stringify(m)+'\n');setTimeout(()=>reject(new Error('MCP response timeout')),3000);});}};}
test('MCP advertises unique controlled composition and asset tools',async()=>{const s=session();try{const init=await s.send({jsonrpc:'2.0',id:1,method:'initialize',params:{}});assert.equal(init.result.serverInfo.name,'creative-os-local-mcp');const list=await s.send({jsonrpc:'2.0',id:2,method:'tools/list'});const names=list.result.tools.map(tool=>tool.name);for(const name of ['ae_open_composition','ae_list_compositions','ae_import_local_asset','ae_add_project_item_layer','ae_move_layer_before','ae_set_parent','ae_add_text_position_reveal','ae_animate_mask_feather','ae_add_gaussian_blur']) assert.ok(names.includes(name));assert.equal(new Set(names).size,names.length);}finally{s.p.kill();}});
test('MCP rejects unknown tools',async()=>{const s=session();try{const m=await s.send({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'eval',arguments:{script:'app.quit()'}}});assert.equal(m.error.code,-32602);}finally{s.p.kill();}});
