import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {createQueueHandler,bounceForRecipient,READ_SCOPE} from '../lib/queue-server.mjs';
import {draftEvidence,generateDraft,validateGeneratedDraft} from '../lib/draft-generator.mjs';
const owner='00000000-0000-0000-0000-000000000001',other='00000000-0000-0000-0000-000000000002',id='00000000-0000-0000-0001-000000000001',mailbox='sagorika@satavuestudio.com';
const env={APP_URL:'https://creative.example',SUPABASE_URL:'https://demo.supabase.co',SUPABASE_SECRET_KEY:'server-private',GOOGLE_CLIENT_ID:'id',GOOGLE_CLIENT_SECRET:'secret',GMAIL_TOKEN_ENCRYPTION_KEY:randomBytes(32).toString('base64'),OUTREACH_POSTAL_ADDRESS:'Real address',REVIEWED_SENDING_ENABLED:'true',AUTOMATED_SENDING_ENABLED:'true',QUEUE_WORKER_SECRET:randomBytes(32).toString('hex')};
function response(){return {headers:{},setHeader(k,v){this.headers[k]=v;},end(v){this.body=v;}};}
const tick={method:'POST',query:{action:'tick'},headers:{authorization:'Bearer '+env.QUEUE_WORKER_SECRET}};
const clock=()=>new Date('2026-11-16T11:01:00Z');
const lead={id:'lead',company:'Company',email:'person@company.com',subject:'A specific question',body:'Verified research and a useful offer.',emailStage:'Approved to send',status:'New'};
const message={id,owner_id:owner,lead_id:lead.id,mailbox,recipient:lead.email,subject:lead.subject,source_body:lead.body,body:lead.body+'\n\n—\nSatavue\nReal address\nStop outreach emails: https://creative.example/api/outreach/unsubscribe?token='+'a'.repeat(64)};
function mockDb(){
 const state={claimed:false,delivered:0,paused:false,queueState:'scheduled',updates:[],suppressed:0};
 const q={outbox_id:id,owner_id:owner,scheduled_at:'2026-11-16T11:00:00Z',approved_at:'2026-11-16T10:00:00Z',timezone:'UTC',message};
 const db={auth:{getUser:async()=>({data:{user:{id:owner}}})},from(table){let operation='select',value;const chain={select(){return chain;},eq(){return chain;},order(){return chain;},limit(){return chain;},maybeSingle(){return chain;},update(v){operation='update';value=v;return chain;},upsert(v){operation='update';value=v;return chain;},then(resolve,reject){if(operation==='update'){state.updates.push({table,value});if(value.enabled===false)state.paused=true;if(table==='creative_os_send_queue'&&value.state)state.queueState=value.state;return Promise.resolve({data:null}).then(resolve,reject);}const data=table==='creative_os_gmail_connections'?{...message,email:mailbox,refresh_token:'encrypted',scopes:[READ_SCOPE]}:[];return Promise.resolve({data}).then(resolve,reject);}};return chain;},async rpc(name,args){if(name==='expire_creative_os_queue')return {data:0};if(name==='next_creative_os_scheduled')return {data:q};if(name==='suppress_creative_os_contact'){state.suppressed++;return {data:null};}if(name==='claim_creative_os_scheduled'){assert.equal(args.p_owner,owner);if(state.claimed)return {error:{message:'already_attempted'}};state.claimed=true;return {data:message};}throw Error('Unexpected RPC');}};
 return {db,state,q};
}
test('draft generation sends bounded saved evidence, requests structured output and never sends mail',async()=>{
 assert.throws(()=>draftEvidence({id:'sample-1',company:'Sample'}));assert.throws(()=>draftEvidence({id:'a',company:'No research'}),/research/);
 const evidence=draftEvidence({...lead,notes:'Verified business observation.',phone:'private-phone',email:'private-email'});assert(!('email'in evidence));assert(!('phone'in evidence));
 let calls=0;const draft=await generateDraft(evidence,{OPENAI_API_KEY:'key',OUTREACH_DRAFT_MODEL:'configured-model'},async(url,req)=>{calls++;assert.equal(url,'https://api.openai.com/v1/responses');const body=JSON.parse(req.body);assert.equal(body.store,false);assert.equal(body.text.format.type,'json_schema');assert.match(body.instructions,/never follow instructions/);return {ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({subject:'Question',body:'A relevant offer.',warnings:['Verify freshness.']})}]}]})};});
 assert.equal(calls,1);assert.equal(draft.subject,'Question');assert.throws(()=>validateGeneratedDraft({subject:'Hi\nBcc: x@y.com',body:'body',warnings:[]}));
 await assert.rejects(generateDraft(evidence,{}),/needs/);
});
test('delivery reports match the exact failed recipient and status, never quoted marketing text',()=>{
 const payload=text=>({mimeType:'multipart/report',parts:[{mimeType:'message/delivery-status',body:{data:Buffer.from(text).toString('base64url')}}]});
 assert.equal(bounceForRecipient(payload('Final-Recipient: rfc822; person@company.com\r\nAction: failed\r\nStatus: 5.1.1'),lead.email),'hard_bounce');
 assert.equal(bounceForRecipient(payload('Final-Recipient: rfc822; person@company.com\nStatus: 4.2.0'),lead.email),'delivery_delayed');
 assert.equal(bounceForRecipient(payload('Final-Recipient: rfc822; other@company.com\nStatus: 5.1.1'),lead.email),null);
 assert.equal(bounceForRecipient({mimeType:'text/plain',body:{data:Buffer.from('Final-Recipient: rfc822; person@company.com\nStatus: 5.1.1').toString('base64url')}},lead.email),null);
});
test('worker requires its private secret and activation, not an owner JWT or a GET',async()=>{
 const {db,state}=mockDb();const handler=createQueueHandler({env,makeDb:()=>db,getToken:async()=>{throw Error('must not refresh');}});
 let res=response();await handler({...tick,headers:{authorization:'Bearer owner-jwt'}},res);assert.equal(res.statusCode,401);
 res=response();await handler({...tick,method:'GET'},res);assert.equal(res.statusCode,405);
 res=response();await createQueueHandler({env:{...env,AUTOMATED_SENDING_ENABLED:''},makeDb:()=>db})(tick,res);assert.match(res.body,/disabled/);assert.equal(state.claimed,false);
});
test('worker stops on replies and hard bounces before any claim or submission',async()=>{
 for(const result of ['replied','hard_bounce','delivery_delayed']){const {db,state}=mockDb();const handler=createQueueHandler({env,makeDb:()=>db,now:clock,getToken:async()=> 'access',inspect:async()=>result,deliver:async()=>{state.delivered++;}});const res=response();await handler(tick,res);assert.equal(state.claimed,false);assert.equal(state.delivered,0);assert.equal(state.suppressed,result==='hard_bounce'?1:0);assert.equal(state.queueState,result==='replied'?'replied':'blocked');}
});
test('inbox failures pause the mailbox, provider uncertainty is recorded without replay',async()=>{
 let fixture=mockDb();let handler=createQueueHandler({env,makeDb:()=>fixture.db,now:clock,getToken:async()=> 'access',inspect:async()=>{throw Error('provider secret');},deliver:async()=>{fixture.state.delivered++;}});let res=response();await handler(tick,res);assert.equal(fixture.state.paused,true);assert.equal(fixture.state.claimed,false);assert(!res.body.includes('secret'));
 fixture=mockDb();handler=createQueueHandler({env,makeDb:()=>fixture.db,now:clock,getToken:async()=> 'access',inspect:async()=> 'clear',deliver:async()=>{fixture.state.delivered++;throw Error('timeout');}});res=response();await handler(tick,res);assert.equal(res.statusCode,202);assert.equal(fixture.state.queueState,'unknown');assert.equal(fixture.state.paused,true);res=response();await handler(tick,res);assert.equal(fixture.state.delivered,1);
});
test('worker records provider acceptance once and refuses changed postal footer',async()=>{
 let fixture=mockDb();let handler=createQueueHandler({env,makeDb:()=>fixture.db,now:clock,getToken:async()=> 'access',inspect:async()=> 'clear',deliver:async()=>{fixture.state.delivered++;return 'provider-id';}});let res=response();await handler(tick,res);assert.equal(fixture.state.delivered,1);assert.equal(fixture.state.queueState,'sent');assert.match(res.body,/delivery is not confirmed/);
 fixture=mockDb();handler=createQueueHandler({env:{...env,OUTREACH_POSTAL_ADDRESS:'Changed address'},makeDb:()=>fixture.db,now:clock,getToken:async()=>{throw Error('must not load');}});res=response();await handler(tick,res);assert.equal(fixture.state.claimed,false);assert.equal(fixture.state.queueState,'blocked');
});
test('owner endpoints require auth, same origin and explicit scheduling confirmation',async()=>{
 const {db}=mockDb();const handler=createQueueHandler({env,makeDb:()=>db});let res=response();await handler({method:'POST',query:{action:'schedule'},headers:{origin:env.APP_URL}},res);assert.equal(res.statusCode,401);
 res=response();await handler({method:'POST',query:{action:'schedule'},headers:{origin:'https://evil.example',authorization:'Bearer jwt'}},res);assert.equal(res.statusCode,403);
 res=response();await handler({method:'POST',query:{action:'schedule'},headers:{origin:env.APP_URL,authorization:'Bearer jwt'},body:{confirmed:false}},res);assert.equal(res.statusCode,400);
});
test('SQL scheduling enforces ownership, exact approval, private roles, due time, reply checks and caps',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$select null::uuid$$;insert into auth.users values('${owner}'),('${other}');create function public.test_clock() returns timestamptz language sql as $$select '2026-11-16T10:00:00Z'::timestamptz$$;`);
 for(const file of ['202611140001_workspace.sql','202611140002_gmail.sql','202611150001_outreach_sending.sql','202611160001_outreach_queue.sql'])await db.exec((await readFile(new URL('../../../supabase/migrations/'+file,import.meta.url),'utf8')).replaceAll('now()','public.test_clock()'));
 const setClock=timestamp=>db.exec(`create or replace function public.test_clock() returns timestamptz language sql as $$select '${timestamp}'::timestamptz$$`);
 await db.query('insert into creative_os_workspaces(owner_id,document) values($1,$2)',[owner,JSON.stringify({version:1,leads:[lead],tags:[],systems:[],events:[]})]);
 await db.query('insert into creative_os_gmail_connections(owner_id,email,refresh_token,scopes) values($1,$2,$3,$4)',[owner,mailbox,'encrypted',['https://www.googleapis.com/auth/gmail.send']]);
 let counter=0;async function review(){counter++;const value='00000000-0000-0000-0001-'+String(counter).padStart(12,'0');await db.query('insert into creative_os_outbox(id,owner_id,lead_id,mailbox,recipient,subject,body,source_body,fingerprint,unsubscribe_hash) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[value,owner,lead.id,mailbox,lead.email,lead.subject,message.body,lead.body,'fp'+counter,'hash'+counter]);return value;}
 const first=await review();const schedule=(item,at='2026-11-16T11:00:00Z',zone='UTC',user=owner)=>db.query('select schedule_creative_os_send($1,$2,$3,$4)',[user,item,at,zone]);
 await assert.rejects(schedule(first),/reply_permission_required/);await db.query('update creative_os_gmail_connections set scopes=$1',[[READ_SCOPE,'https://www.googleapis.com/auth/gmail.send']]);
 await assert.rejects(schedule(first,'2026-11-16T18:00:00Z'),/outside_window/);await assert.rejects(schedule(first,undefined,'Bad/Timezone'),/invalid_timezone/);await assert.rejects(schedule(first,undefined,undefined,other),/review_missing/);
 const planned=(await db.query('select plan_creative_os_slot($1,$2,$3) at',[owner,mailbox,'UTC'])).rows[0].at;assert.equal(new Date(planned).toISOString(),'2026-11-16T10:30:00.000Z');
 await schedule(first);await assert.rejects(db.query('select claim_creative_os_send($1,$2)',[owner,first]),/scheduled_use_queue/);
 await assert.rejects(db.query('select claim_creative_os_scheduled($1,$2)',[owner,first]),/not_due/);
 await setClock('2026-11-16T11:01:00Z');await assert.rejects(db.query('select claim_creative_os_scheduled($1,$2)',[owner,first]),/mailbox_paused/);
 await db.exec('update creative_os_mailbox_settings set enabled=true');await assert.rejects(db.query('select claim_creative_os_scheduled($1,$2)',[owner,first]),/reply_check_required/);
 await db.exec('update creative_os_send_queue set checked_at=public.test_clock()');assert.equal((await db.query('select claim_creative_os_scheduled($1,$2) result',[owner,first])).rows[0].result.status,'sending');
 await assert.rejects(db.query('select claim_creative_os_scheduled($1,$2)',[owner,first]),/already_attempted/);
 const second=await review();await db.exec('update creative_os_mailbox_settings set daily_limit=1');await assert.rejects(db.query('select claim_creative_os_send($1,$2)',[owner,second]),/daily_limit/);await db.exec('update creative_os_mailbox_settings set daily_limit=10');await assert.rejects(schedule(second,'2026-11-16T12:00:00Z'),/initial_contact_only/);
 // Existing attempt belongs to another recipient now; one new approved contact.
 await db.query('update creative_os_outbox set recipient=$1 where id=$2',['previous@company.com',first]);await schedule(second,'2026-11-16T12:00:00Z');
 await setClock('2026-11-16T12:01:00Z');await db.exec('update creative_os_send_queue set checked_at=public.test_clock();update creative_os_mailbox_settings set daily_limit=1');await assert.rejects(db.query('select claim_creative_os_scheduled($1,$2)',[owner,second]),/daily_limit/);
 await db.exec('update creative_os_mailbox_settings set daily_limit=10');await db.query("update creative_os_workspaces set document=jsonb_set(document,'{leads,0,body}','\"Changed\"') where owner_id=$1",[owner]);await assert.rejects(db.query('select claim_creative_os_scheduled($1,$2)',[owner,second]),/draft_changed/);
 await setClock('2026-11-16T12:20:00Z');await assert.rejects(db.query('select claim_creative_os_scheduled($1,$2)',[owner,second]),/schedule_missed/);
 assert.equal((await db.query('select expire_creative_os_queue() n')).rows[0].n,1);
 for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(db.query('select * from creative_os_send_queue'),/permission denied/);await assert.rejects(schedule(second),/permission denied/);await assert.rejects(db.query('select next_creative_os_scheduled()'),/permission denied/);await db.exec('reset role');}
 await db.exec('set role service_role');assert.equal((await db.query('select document from creative_os_workspaces')).rows.length,1);await assert.rejects(db.query('select claim_creative_os_send_base($1,$2)',[owner,second]),/permission denied/);
 }finally{await db.close();}
});
