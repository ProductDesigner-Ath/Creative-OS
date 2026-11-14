import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {cloudConfig,emptyWorkspace,readWorkspace,writeWorkspace} from '../src/cloud.mjs';
test('hosted builds fail closed without public configuration',()=>{
 assert.equal(cloudConfig({},'localhost').mode,'local');
 assert.equal(cloudConfig({},'creative-os.vercel.app').mode,'error');
 assert.equal(cloudConfig({VITE_SUPABASE_URL:'https://demo.supabase.co/rest/v1/',VITE_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test'},'localhost').mode,'error');
 assert.equal(cloudConfig({VITE_SUPABASE_URL:'https://demo.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:'service_role_test'},'localhost').mode,'error');
 assert.equal(cloudConfig({VITE_SUPABASE_URL:'https://demo.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test'},'demo.vercel.app').mode,'cloud');
 assert.deepEqual(emptyWorkspace().leads,[]);
});
test('workspace transport preserves errors and detects invalid revision responses',async()=>{
 const fake={from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:null,error:null})})})})};
 assert.deepEqual(await readWorkspace(fake,'owner'),{document:emptyWorkspace(),revision:0});
 await assert.rejects(writeWorkspace({rpc:async()=>({error:new Error('workspace_conflict')})},{},2),/workspace_conflict/);
 await assert.rejects(writeWorkspace({rpc:async()=>({data:null})},{},2),/invalid workspace revision/);
});
test('PostgreSQL migration enforces owner isolation, no anonymous access, revision conflicts and document limits',async()=>{
 const db=new PGlite();
 try{
 await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated; insert into auth.users values ('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002');`);
 await db.exec(await readFile(new URL('../../../supabase/migrations/202611140001_workspace.sql',import.meta.url),'utf8'));
 const owner1='00000000-0000-0000-0000-000000000001',owner2='00000000-0000-0000-0000-000000000002';
 await db.exec(`set role authenticated; set request.jwt.claim.sub = '${owner1}';`);
 const save=async(doc,rev)=>(await db.query('select public.save_creative_os_workspace($1::jsonb,$2) as revision',[JSON.stringify(doc),rev])).rows[0].revision;
 assert.equal(await save(emptyWorkspace(),0),1);
 assert.equal(await save({...emptyWorkspace(),leads:[{company:'Test'}]},1),2);
 await assert.rejects(save(emptyWorkspace(),1),/workspace_conflict/);
 await assert.rejects(save(emptyWorkspace(),0),/workspace_conflict/);
 assert.equal((await db.query('select revision from public.creative_os_workspaces')).rows[0].revision,2);
 await assert.rejects(db.exec('update public.creative_os_workspaces set revision=99'),/permission denied/);
 await db.exec(`set request.jwt.claim.sub = '${owner2}';`);
 assert.equal((await db.query('select * from public.creative_os_workspaces')).rows.length,0);
 await assert.rejects(save(emptyWorkspace(),2),/workspace_conflict/);
 await assert.rejects(save({version:1},0),/valid_workspace/);
 await assert.rejects(save({...emptyWorkspace(),notes:'x'.repeat(8388608)},0),/valid_workspace/);
 assert.equal(await save(emptyWorkspace(),0),1);
 await db.exec("set request.jwt.claim.sub = ''; set role anon;");
 await assert.rejects(db.exec('select * from public.creative_os_workspaces'),/permission denied/);
 await assert.rejects(save(emptyWorkspace(),0),/permission denied/);
 await db.exec("set role authenticated; set request.jwt.claim.sub = '';");
 await assert.rejects(save(emptyWorkspace(),0),/authentication_required/);
 }finally{await db.close();}
});
