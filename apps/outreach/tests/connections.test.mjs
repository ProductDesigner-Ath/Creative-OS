import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {verifyConnection,createConnectionsHandler,resolveConnection} from '../lib/ai-connections.mjs';
import {respondClaude,claudeContent} from '../lib/assistant-server.mjs';
import {unseal} from '../lib/gmail-server.mjs';
const owner='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
const env={APP_URL:'https://creative.example',SUPABASE_URL:'https://demo.supabase.co',SUPABASE_SECRET_KEY:'server-secret',AI_CREDENTIAL_ENCRYPTION_KEY:randomBytes(32).toString('base64')};
const key='private-api-key-1234567890';
function response(){return {headers:{},setHeader(k,v){this.headers[k]=v;},end(v){this.body=JSON.parse(v);}};}
function fixture({reject=false}={}){
 const state={record:null,verifications:0};
 const db={auth:{getUser:async()=>({data:{user:{id:owner}}})},from(table){assert.equal(table,'creative_os_ai_connections');let single=false;const filters=[];const chain={select(columns){assert(!columns.includes('*'));return chain;},eq(k,v){filters.push([k,v]);return chain;},maybeSingle(){single=true;return chain;},then(resolve,reject){assert(filters.some(([k,v])=>k==='owner_id'&&v===owner));return Promise.resolve({data:single?state.record:state.record?[state.record]:[]}).then(resolve,reject);}};return chain;},async rpc(name,args){assert.equal(name,'save_creative_os_ai_connection');assert.equal(args.p_owner,owner);if(state.record&&args.p_revision!==state.record.revision)return {error:{message:'connection_conflict'}};state.record={provider:args.p_provider,credential:args.p_credential,model:args.p_model,revision:1,checked_at:new Date().toISOString()};return {data:null};}};
 const handler=createConnectionsHandler({env,makeDb:()=>db,verify:async()=>{state.verifications++;if(reject)throw Error('credential_rejected');}});
 const req={method:'POST',query:{action:'connect'},headers:{origin:env.APP_URL,authorization:'Bearer session'},body:{provider:'anthropic',apiKey:key,model:'exact-model',revision:0}};
 return {db,state,handler,req};
}
test('provider verification calls only fixed API origins and no generation endpoints',async()=>{
 const calls=[];const fetcher=async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>url.includes('higgsfield')?{upload_url:'https://storage.example/upload'}:{id:'exact-model'}};};
 await verifyConnection('openai',key,'exact-model',fetcher);await verifyConnection('anthropic',key,'exact-model',fetcher);await verifyConnection('higgsfield',key,'',fetcher);
 assert.equal(calls[0].url,'https://api.openai.com/v1/models/exact-model');assert.equal(calls[1].options.headers['x-api-key'],key);assert.equal(calls[2].options.headers.Authorization,'Key '+key);assert.equal(calls[2].url,'https://api.higgsfield.ai/files/generate-upload-url');assert(!calls.some(c=>c.url.includes('messages')||c.url.includes('responses')));assert(calls.every(c=>c.options.redirect==='error'));
 await assert.rejects(verifyConnection('untrusted',key,'x',fetcher),/invalid_credential/);await assert.rejects(verifyConnection('openai',key,'https://evil.test',fetcher),/invalid_model/);await assert.rejects(verifyConnection('openai',key,'exact-model',async()=>({ok:false,status:401})),/credential_rejected/);
});
test('saved API keys are encrypted, owner/provider bound and never returned to the browser',async()=>{
 const f=fixture(),res=response();await f.handler(f.req,res);assert.equal(res.statusCode,200);assert.equal(f.state.verifications,1);assert(!JSON.stringify(res.body).includes(key));assert(!JSON.stringify(res.body).includes(f.state.record.credential));assert.notEqual(f.state.record.credential,key);
 assert.equal(unseal(f.state.record.credential,Buffer.from(env.AI_CREDENTIAL_ENCRYPTION_KEY,'base64'),owner,'ai-provider:anthropic'),key);
 assert.throws(()=>unseal(f.state.record.credential,Buffer.from(env.AI_CREDENTIAL_ENCRYPTION_KEY,'base64'),other,'ai-provider:anthropic'));
 assert.throws(()=>unseal(f.state.record.credential,Buffer.from(env.AI_CREDENTIAL_ENCRYPTION_KEY,'base64'),owner,'ai-provider:openai'));
 assert.equal((await resolveConnection(f.db,owner,'anthropic',env)).apiKey,key);
});
test('connection endpoints reject missing auth/cross-origin writes and retain old keys on failed verification',async()=>{
 const f=fixture({reject:true});let res=response();await f.handler({...f.req,headers:{...f.req.headers,origin:'https://evil.example'}},res);assert.equal(res.statusCode,403);assert.equal(f.state.verifications,0);
 res=response();await f.handler({...f.req,headers:{origin:env.APP_URL}},res);assert.equal(res.statusCode,401);
 res=response();await f.handler(f.req,res);assert.equal(res.statusCode,400);assert.equal(f.state.record,null);assert(!JSON.stringify(res.body).includes(key));
});
test('Claude adapter preserves history and translates selected image/PDF inputs without tools',async()=>{
 assert.deepEqual(claudeContent([{type:'input_image',image_url:'data:image/png;base64,YQ=='}]),[{type:'image',source:{type:'base64',media_type:'image/png',data:'YQ=='}}]);
 assert.deepEqual(claudeContent([{type:'input_file',file_data:'data:application/pdf;base64,YQ=='}]),[{type:'document',source:{type:'base64',media_type:'application/pdf',data:'YQ=='}}]);
 const result=await respondClaude([{role:'user',content:[{type:'input_text',text:'Plan the project.'}]}],{ANTHROPIC_API_KEY:key,ANTHROPIC_MODEL:'exact-model'},async(url,options)=>{assert.equal(url,'https://api.anthropic.com/v1/messages');const body=JSON.parse(options.body);assert.equal(body.output_config.format.type,'json_schema');assert.equal(body.messages[0].content[0].type,'text');assert.equal(body.tools,undefined);return {ok:true,json:async()=>({content:[{type:'text',text:JSON.stringify({reply:'A project plan.',draft:null})}]})};});assert.equal(result.reply,'A project plan.');
});
test('actual connection migration denies browser credentials and protects revisions/provider metadata',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);insert into auth.users values('${owner}');create table public.creative_os_assistant_conversations(id uuid primary key);`);
 await db.exec(await readFile(new URL('../../../supabase/migrations/202611160003_ai_connections.sql',import.meta.url),'utf8'));
 await db.query('select save_creative_os_ai_connection($1,$2,$3,$4,$5)',[owner,'anthropic','encrypted','exact-model',0]);
 await assert.rejects(db.query('select save_creative_os_ai_connection($1,$2,$3,$4,$5)',[owner,'anthropic','overwrite','exact-model',0]),/connection_conflict/);
 await db.query('select save_creative_os_ai_connection($1,$2,$3,$4,$5)',[owner,'anthropic','replacement','other-model',1]);assert.equal((await db.query('select revision from creative_os_ai_connections')).rows[0].revision,2);
 await db.exec('set role authenticated');await assert.rejects(db.exec('select credential from creative_os_ai_connections'),/permission denied/);await assert.rejects(db.query('select save_creative_os_ai_connection($1,$2,$3,$4,$5)',[owner,'openai','bad','model',0]),/permission denied/);
 }finally{await db.close();}
});
test('combined assistant setup runs on the real schema and is safe to rerun without losing conversations',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);insert into auth.users values('${owner}');create table creative_os_workspaces(owner_id uuid,document jsonb);create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);`);
 const sql=await readFile(new URL('../../../supabase/setup/ai_assistant.sql',import.meta.url),'utf8');await db.exec(sql);
 await db.query('insert into creative_os_assistant_conversations(id,owner_id,scope_type,title,provider,model) values($1,$2,$3,$4,$5,$6)',[other,owner,'studio','Retained conversation','anthropic','exact-model']);
 await db.exec(sql);const result=await db.query('select title,provider from creative_os_assistant_conversations');assert.equal(result.rows.length,1);assert.equal(result.rows[0].provider,'anthropic');
 }finally{await db.close();}
});
test('legacy environment chat keeps working before the new connection migration, while required connection actions fail closed',async()=>{
 const db={from(){const chain={select(){return chain;},eq(){return chain;},maybeSingle(){return chain;},then(resolve,reject){return Promise.resolve({error:{code:'42P01',message:'table missing'}}).then(resolve,reject);}};return chain;}};
 const legacy={OPENAI_API_KEY:key,ASSISTANT_MODEL:'existing-model'};
 assert.equal((await resolveConnection(db,owner,'openai',legacy,{optional:true})).apiKey,key);
 await assert.rejects(resolveConnection(db,owner,'openai',legacy),/connections_storage/);
 await assert.rejects(resolveConnection(db,owner,'anthropic',legacy,{optional:true}),/not_configured/);
});
test('stale key replacement never overwrites another device’s saved connection',async()=>{
 const f=fixture();let out=response();await f.handler(f.req,out);const original=f.state.record.credential;out=response();await f.handler({...f.req,body:{...f.req.body,apiKey:'another-private-key-123456',revision:0}},out);assert.equal(out.statusCode,400);assert.match(out.body.error,/Another device/);assert.equal(f.state.record.credential,original);
});
