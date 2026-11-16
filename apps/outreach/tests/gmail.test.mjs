import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {seal,unseal,hash,validState,settings,createHandler,SCOPES} from '../lib/gmail-server.mjs';
const env={APP_URL:'https://creative.example',SUPABASE_URL:'https://demo.supabase.co',SUPABASE_SECRET_KEY:'server-only',GOOGLE_CLIENT_ID:'client',GOOGLE_CLIENT_SECRET:'private',GMAIL_TOKEN_ENCRYPTION_KEY:randomBytes(32).toString('base64')};
function response(){return {headers:{},setHeader(k,v){this.headers[k]=v;},end(v){this.body=v;}};}
test('token encryption authenticates ciphertext, owner and mailbox',()=>{
 const key=randomBytes(32),sealed=seal('private-refresh-token',key,'owner1','mail1');
 assert.equal(unseal(sealed,key,'owner1','mail1'),'private-refresh-token');
 assert.throws(()=>unseal(sealed,key,'owner2','mail1'));
 assert.throws(()=>unseal(sealed,key,'owner1','mail2'));
 const tampered=Buffer.from(sealed,'base64');tampered[15]^=1;
 assert.throws(()=>unseal(tampered.toString('base64'),key,'owner1','mail1'));
 assert.notEqual(sealed,seal('private-refresh-token',key,'owner1','mail1'));
});
test('state requires high entropy state and matching browser cookie; configuration fails closed',()=>{
 const state=randomBytes(32).toString('hex');
 assert.equal(validState(state,hash(state)),true);
 assert.equal(validState(state,hash('other')),false);
 assert.equal(validState([],hash(state)),false);
 assert.throws(()=>settings({}));assert.throws(()=>settings({...env,APP_URL:'http://creative.example'}));
 assert.throws(()=>settings({...env,GMAIL_TOKEN_ENCRYPTION_KEY:'short'}));
 assert.equal(SCOPES.some(s=>/readonly|modify|mail.google/.test(s)),false);
});
test('handler rejects missing auth, cross origin actions and main-domain mailbox',async()=>{
 let reads=0;
 const db={auth:{getUser:async()=>({data:{user:{id:'owner1'}}})},from(){reads++;throw Error('should not access database');}};
 const handler=createHandler({env,makeDb:()=>db,makeOAuth:()=>({})});
 let res=response();await handler({method:'GET',query:{action:'status'},headers:{}},res);assert.equal(res.statusCode,401);
 res=response();await handler({method:'POST',query:{action:'start'},headers:{origin:'https://evil.example'}},res);assert.equal(res.statusCode,403);
 res=response();await handler({method:'POST',query:{action:'start'},headers:{origin:env.APP_URL,authorization:'Bearer valid'},body:{email:'hello@satavue.com'}},res);assert.equal(res.statusCode,400);
 res=response();await handler({method:'GET',query:{action:'callback',state:'fake',code:'sensitive'},headers:{}},res);assert.equal(res.statusCode,303);assert.match(res.headers.Location,/invalid_state/);assert.ok(!res.headers.Location.includes('sensitive'));
 assert.equal(reads,0);
});
test('OAuth callback consumes state once, verifies identity and encrypts refresh token',async()=>{
 const state=randomBytes(32).toString('hex'),owner='owner1',email='sagorika@satavuestudio.com';let stateRow={owner_id:owner,email,verifier:'pkce',expires_at:new Date(Date.now()+60000).toISOString()},saved,exchanges=0;
 const db={from(table){if(table.endsWith('oauth_states'))return {delete:()=>({eq:()=>({select:()=>({maybeSingle:async()=>{const data=stateRow;stateRow=null;return {data};}})})})};return {upsert:async value=>{saved=value;return {data:null};}};}};
 const oauth={getToken:async args=>{assert.equal(args.codeVerifier,'pkce');exchanges++;return {tokens:{id_token:'identity',refresh_token:'secret-refresh',scope:SCOPES.join(' ')}};},verifyIdToken:async()=>({getPayload:()=>({email,email_verified:true})})};
 const handler=createHandler({env,makeDb:()=>db,makeOAuth:()=>oauth});
 const req={method:'GET',query:{action:'callback',state,code:'code'},headers:{cookie:'__Secure-creative_os_gmail='+hash(state)}};
 let res=response();await handler(req,res);assert.match(res.headers.Location,/gmail=connected/);assert.ok(!saved.refresh_token.includes('secret-refresh'));assert.equal(saved.owner_id,owner);
 assert.equal(unseal(saved.refresh_token,Buffer.from(env.GMAIL_TOKEN_ENCRYPTION_KEY,'base64'),owner,email),'secret-refresh');
 res=response();await handler(req,res);assert.match(res.headers.Location,/gmail=expired/);assert.equal(exchanges,1);
});
test('server-only SQL denies browser roles access to credentials and pending states',async()=>{
 const db=new PGlite();try{
 await db.exec('create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key);');
 await db.exec(await readFile(new URL('../../../supabase/migrations/202611140002_gmail.sql',import.meta.url),'utf8'));
 for(const role of ['anon','authenticated']){
 await db.exec('set role '+role);
 await assert.rejects(db.query('select * from creative_os_gmail_connections'),/permission denied/);
 await assert.rejects(db.query('select * from creative_os_gmail_oauth_states'),/permission denied/);
 await db.exec('reset role');
 }
 await db.exec("insert into auth.users values('00000000-0000-0000-0000-000000000001'); set role service_role;");
 await db.query("insert into creative_os_gmail_connections(owner_id,email,refresh_token,scopes) values('00000000-0000-0000-0000-000000000001','sagorika@withsatavue.com','encrypted',array['send'])");
 assert.equal((await db.query('select * from creative_os_gmail_connections')).rows.length,1);
 await assert.rejects(db.query("insert into creative_os_gmail_connections(owner_id,email,refresh_token,scopes) values('00000000-0000-0000-0000-000000000001','hello@satavue.com','encrypted',array['send'])"),/check constraint/);
 }finally{await db.close();}
});

test('callback diagnostics identify the failed step without exposing provider secrets',async()=>{
 const warnings=[],oldWarn=console.warn;console.warn=value=>warnings.push(value);
 try{
 for(const [providerError,expected] of [['invalid_client','token_invalid_client'],['contains-secret-token','token_exchange_failed']]){
 const state=randomBytes(32).toString('hex');
 const db={from:()=>({delete:()=>({eq:()=>({select:()=>({maybeSingle:async()=>({data:{email:'sagorika@satavuestudio.com',owner_id:'owner',verifier:'private-proof',expires_at:new Date(Date.now()+60000).toISOString()}})})})})})};
 const handler=createHandler({env,makeDb:()=>db,makeOAuth:()=>({getToken:async()=>{throw {message:'private-client-secret',response:{data:{error:providerError,access_token:'private-access-token'}}};}})});
 const res=response();await handler({method:'GET',query:{action:'callback',state,code:'private-code'},headers:{cookie:'__Secure-creative_os_gmail='+hash(state)}},res);
 assert.equal(res.headers.Location,env.APP_URL+'/?gmail='+expected);
 assert.equal(res.body,undefined);
 }
 assert.ok(warnings.every(s=>!s.includes('private-')&&!s.includes('contains-secret')));
 }finally{console.warn=oldWarn;}
});

test('reply access is optional and a declined read scope never overwrites the existing connection',async()=>{
 const state=randomBytes(32).toString('hex'),email='sagorika@satavuestudio.com';let writes=0;
 const db={from(table){if(table.endsWith('oauth_states'))return {delete:()=>({eq:()=>({select:()=>({maybeSingle:async()=>({data:{owner_id:'owner',email,reply_access:true,verifier:'pkce',expires_at:new Date(Date.now()+60000).toISOString()}})})})})};return {upsert:async()=>{writes++;return {data:null};}};}};
 const oauth={getToken:async()=>({tokens:{id_token:'id',refresh_token:'refresh',scope:SCOPES.join(' ')}}),verifyIdToken:async()=>({getPayload:()=>({email,email_verified:true})})};
 const handler=createHandler({env,makeDb:()=>db,makeOAuth:()=>oauth});const res=response();await handler({method:'GET',query:{action:'callback',state,code:'code'},headers:{cookie:'__Secure-creative_os_gmail='+hash(state)}},res);
 assert.match(res.headers.Location,/permission_required/);assert.equal(writes,0);assert(!SCOPES.includes('https://www.googleapis.com/auth/gmail.readonly'));
});
