import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {createOutreachHandler,validateDraft,mimeMessage} from '../lib/outreach-server.mjs';
const mailbox='sagorika@satavuestudio.com',owner='00000000-0000-0000-0000-000000000001';
const lead={id:'real-lead',email:'client@company.com',subject:'A useful idea 👋',body:'Hello,\nOne relevant observation.',emailStage:'Approved to send',status:'Approved'};
const env={APP_URL:'https://creative.example',SUPABASE_URL:'https://demo.supabase.co',SUPABASE_SECRET_KEY:'private',GOOGLE_CLIENT_ID:'id',GOOGLE_CLIENT_SECRET:'secret',GMAIL_TOKEN_ENCRYPTION_KEY:randomBytes(32).toString('base64'),OUTREACH_POSTAL_ADDRESS:'A real sender address',REVIEWED_SENDING_ENABLED:'true'};
function response(){return {headers:{},setHeader(k,v){this.headers[k]=v;},end(v){this.body=v;}};}
test('draft validation blocks sample leads, multi-recipient/header injection and unapproved stages',()=>{
 assert.equal(validateDraft(lead).recipient,'client@company.com');
 for(const l of [{...lead,id:'sample-1'},{...lead,email:'a@b.com,b@c.com'},{...lead,email:'a@b.com\r\nBcc: x@y.com'},{...lead,email:'test@company.example'},{...lead,subject:'Hello\r\nBcc: x@y.com'},{...lead,emailStage:'Unsubscribed'},{...lead,status:'Lost'}])assert.throws(()=>validateDraft(l));
});
test('MIME contains a single recipient, valid UTF-8 words, opt-out headers and exact text body',()=>{
 const body=lead.body+'\n\n—\nSatavue\nAddress\nStop outreach emails: https://creative.example/api/outreach/unsubscribe?token='+'a'.repeat(64);
 const row={id:owner,mailbox,recipient:lead.email,subject:'A long subject '+ '👋नमस्ते'.repeat(12),body};
 const mime=Buffer.from(mimeMessage(row),'base64url').toString('utf8'),[head,encoded]=mime.split('\r\n\r\n');
 assert.match(head,/List-Unsubscribe-Post: List-Unsubscribe=One-Click/);
 assert.equal((head.match(/^To:/gm)||[]).length,1);assert.ok(!head.includes('Bcc:'));
 const subject=[...head.matchAll(/=\?UTF-8\?B\?([^?]+)\?=/g)].map(m=>Buffer.from(m[1],'base64').toString('utf8')).join('');assert.equal(subject,row.subject);
 assert.equal(Buffer.from(encoded.replace(/\r\n/g,''),'base64').toString('utf8'),body.replace(/\r?\n/g,'\r\n'));
 assert.throws(()=>mimeMessage({...row,mailbox:'hello@satavue.com'}));
});
test('PostgreSQL claim enforces approval, immutable drafts, suppression, attempt limits and single claim',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql as $$ select null::uuid $$; insert into auth.users values('${owner}');`);
 for(const file of ['202611140001_workspace.sql','202611140002_gmail.sql','202611150001_outreach_sending.sql'])await db.exec(await readFile(new URL('../../../supabase/migrations/'+file,import.meta.url),'utf8'));
 await db.query('insert into creative_os_workspaces(owner_id,document) values($1,$2)',[owner,JSON.stringify({version:1,leads:[lead],tags:[],systems:[],events:[]})]);
 await db.query('insert into creative_os_gmail_connections(owner_id,email,refresh_token,scopes) values($1,$2,$3,$4)',[owner,mailbox,'encrypted',['https://www.googleapis.com/auth/gmail.send']]);
 let counter=0;
 async function review(changes={}){counter++;const id='00000000-0000-0000-0001-'+String(counter).padStart(12,'0');await db.query('insert into creative_os_outbox(id,owner_id,lead_id,mailbox,recipient,subject,body,source_body,fingerprint,unsubscribe_hash) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[id,owner,lead.id,changes.mailbox||mailbox,lead.email,lead.subject,'final message',changes.source_body??lead.body,'fingerprint'+counter,'hash'+counter]);return id;}
 const claim=id=>db.query('select claim_creative_os_send($1,$2) result',[owner,id]);
 const first=await review();assert.equal((await claim(first)).rows[0].result.status,'sending');await assert.rejects(claim(first),/already_attempted/);
 const second=await review();await assert.rejects(claim(second),/spacing_limit/);
 await db.exec("update creative_os_outbox set attempted_at=now()-interval '2 minutes' where status='sending'");assert.equal((await claim(second)).rows[0].result.status,'sending');
 const changed=await review({source_body:'old body'});await assert.rejects(claim(changed),/draft_changed/);
 await db.query("update creative_os_workspaces set document=jsonb_set(document,'{leads,0,body}','null') where owner_id=$1",[owner]);await assert.rejects(claim(await review()),/draft_changed/);
 await db.query('update creative_os_workspaces set document=$2 where owner_id=$1',[owner,JSON.stringify({version:1,leads:[lead],tags:[],systems:[],events:[]})]);
 const expiry=await review();await db.query("update creative_os_outbox set reviewed_at=now()-interval '11 minutes' where id=$1",[expiry]);await assert.rejects(claim(expiry),/review_expired/);
 await db.query('select suppress_creative_os_contact($1,$2,$3)',[owner,lead.email,'Unsubscribed']);await assert.rejects(claim(await review()),/recipient_suppressed/);
 await db.exec('delete from creative_os_suppressions');
 // Every attempt counts, including unknown outcomes, across both browser sessions.
 await db.exec("update creative_os_outbox set attempted_at=now()-interval '2 minutes'");
 for(let i=0;i<20;i++){const id=await review();await db.query("update creative_os_outbox set status='unknown',attempted_at=now()-interval '2 minutes' where id=$1",[id]);}
 await assert.rejects(claim(await review()),/daily_limit/);
 for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(db.query('select * from creative_os_outbox'),/permission denied/);await assert.rejects(claim(first),/permission denied/);await assert.rejects(db.query('select suppress_creative_os_contact($1,$2,$3)',[owner,lead.email,'Unsubscribed']),/permission denied/);await db.exec('reset role');}
 }finally{await db.close();}
});
test('API fails closed and never calls Gmail without auth and an atomic claim',async()=>{
 let submitted=0;const db={auth:{getUser:async()=>({data:{user:{id:owner}}})},from:()=>({select:()=>({eq:()=>({eq:()=>({maybeSingle:async()=>({data:{mailbox,email:mailbox,owner_id:owner,refresh_token:'encrypted'}})})})})}),rpc:async()=>({error:{message:'recipient_suppressed'}})};
 const handler=createOutreachHandler({env,makeDb:()=>db,authorize:async()=> 'private-access-token',submit:async()=>{submitted++;return 'gmail-id';}});
 let res=response();await handler({query:{action:'send'},method:'POST',headers:{origin:env.APP_URL},body:{id:owner}},res);assert.equal(res.statusCode,401);
 res=response();await handler({query:{action:'send'},method:'POST',headers:{origin:'https://evil.example',authorization:'Bearer jwt'},body:{id:owner}},res);assert.equal(res.statusCode,403);
 res=response();await handler({query:{action:'send'},method:'POST',headers:{origin:env.APP_URL,authorization:'Bearer jwt'},body:{id:owner}},res);assert.equal(res.statusCode,409);assert.match(res.body,/do-not-contact/);assert.equal(submitted,0);
});
test('an uncertain provider result is recorded and is never retried by the handler',async()=>{
 let submits=0,claimed=false,status='reviewed';const row={id:owner,owner_id:owner,mailbox,recipient:lead.email,subject:lead.subject,body:lead.body+'\nStop outreach emails: https://creative.example/api/outreach/unsubscribe?token='+'b'.repeat(64)};
 const db={auth:{getUser:async()=>({data:{user:{id:owner}}})},from:()=>({select:()=>({eq:()=>({eq:()=>({maybeSingle:async()=>({data:{mailbox,email:mailbox,owner_id:owner,refresh_token:'encrypted'}})})})}),update(value){status=value.status;return {eq:()=>({eq:()=>({eq:async()=>({data:null})})})};}}),rpc:async()=>{if(claimed)return {error:{message:'already_attempted'}};claimed=true;return {data:row};}};
 const handler=createOutreachHandler({env,makeDb:()=>db,authorize:async()=> 'access',submit:async()=>{submits++;throw Error('timeout with secret');}}),req={query:{action:'send'},method:'POST',headers:{origin:env.APP_URL,authorization:'Bearer jwt'},body:{id:owner}};
 let res=response();await handler(req,res);assert.equal(res.statusCode,202);assert.equal(status,'unknown');assert.equal(submits,1);assert.ok(!res.body.includes('secret'));
 res=response();await handler(req,res);assert.equal(res.statusCode,409);assert.equal(submits,1);
});

test('unsubscribe GET requires confirmation; POST suppresses without exposing recipient identity',async()=>{
 let calls=0;const token='c'.repeat(64);
 const db={from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{owner_id:owner,recipient:lead.email}})})})}),rpc:async(name,args)=>{calls++;assert.equal(name,'suppress_creative_os_contact');assert.equal(args.p_owner,owner);assert.equal(args.p_email,lead.email);return {data:null};}};
 const handler=createOutreachHandler({env,makeDb:()=>db});
 let res=response();await handler({query:{action:'unsubscribe',token},method:'GET',headers:{}},res);assert.equal(res.statusCode,200);assert.equal(calls,0);assert.match(res.body,/<form method="post"/);assert.ok(!res.body.includes(lead.email));
 res=response();await handler({query:{action:'unsubscribe',token},method:'POST',headers:{}},res);assert.equal(calls,1);assert.match(res.body,/You are unsubscribed/);assert.ok(!res.body.includes(lead.email));
 res=response();await handler({query:{action:'unsubscribe',token:'<script>'},method:'GET',headers:{}},res);assert.equal(res.statusCode,400);assert.ok(!res.body.includes('<script>'));
});
test('success records provider acceptance exactly once and does not claim inbox delivery',async()=>{
 let submits=0,recorded;const row={id:owner,owner_id:owner,mailbox,recipient:lead.email,subject:lead.subject,body:lead.body+'\nStop outreach emails: https://creative.example/api/outreach/unsubscribe?token='+'d'.repeat(64)};
 const db={auth:{getUser:async()=>({data:{user:{id:owner}}})},from:()=>({select:()=>({eq:()=>({eq:()=>({maybeSingle:async()=>({data:{mailbox,email:mailbox,owner_id:owner,refresh_token:'encrypted'}})})})}),update(v){recorded=v;return {eq:()=>({eq:()=>({eq:async()=>({data:null})})})};}}),rpc:async()=>({data:row})};
 const handler=createOutreachHandler({env,makeDb:()=>db,authorize:async()=> 'private-token',submit:async(_token,raw)=>{submits++;assert.match(Buffer.from(raw,'base64url').toString(),/To: client@company.com/);return 'gmail-message-id';}}),res=response();
 await handler({query:{action:'send'},method:'POST',headers:{origin:env.APP_URL,authorization:'Bearer jwt'},body:{id:owner}},res);
 assert.equal(submits,1);assert.equal(recorded.status,'sent');assert.equal(recorded.provider_id,'gmail-message-id');assert.match(res.body,/Delivery is not yet confirmed/);assert.ok(!res.body.includes('private-token'));
});

test('sending requires both explicit activation and a real configured sender address',async()=>{
 let authorized=0;const db={auth:{getUser:async()=>({data:{user:{id:owner}}})},from:()=>{throw Error('must not load credentials');}};
 const req={query:{action:'send'},method:'POST',headers:{origin:env.APP_URL,authorization:'Bearer jwt'},body:{id:owner}};
 for(const config of [{...env,REVIEWED_SENDING_ENABLED:''},{...env,OUTREACH_POSTAL_ADDRESS:''}]){
 const handler=createOutreachHandler({env:config,makeDb:()=>db,authorize:async()=>{authorized++;},submit:async()=>{throw Error('must never send');}}),res=response();await handler(req,res);assert.equal(res.statusCode,409);assert.match(res.body,/not enabled|postal address/);
 }
 assert.equal(authorized,0);
});
