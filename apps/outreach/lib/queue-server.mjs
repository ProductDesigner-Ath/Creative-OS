import {createClient} from '@supabase/supabase-js';
import {OAuth2Client} from 'google-auth-library';
import {timingSafeEqual,createHash} from 'node:crypto';
import {MAILBOXES,settings,unseal} from './gmail-server.mjs';
import {mimeMessage,emailAddress} from './outreach-server.mjs';
import {draftEvidence,generateDraft} from './draft-generator.mjs';
export const READ_SCOPE='https://www.googleapis.com/auth/gmail.readonly';
const json=(res,status,body)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(body));};
function check(result){if(result.error){const code=String(result.error.message||'');const known=['review_missing','review_expired','invalid_schedule','invalid_timezone','outside_window','recipient_suppressed','reply_permission_required','initial_contact_only','contact_already_queued','schedule_spacing','schedule_limit','already_attempted','not_due','schedule_missed','mailbox_paused','reply_check_required','daily_limit','spacing_limit','draft_changed','lead_not_approved','mailbox_disconnected'].find(k=>code.includes(k));throw Error(known||'queue_storage_unavailable');}return result.data;}
const messages={review_missing:'Review a saved draft first.',review_expired:'Review this draft again before scheduling.',invalid_schedule:'Choose a time between two minutes and 30 days from now.',invalid_timezone:'Choose a valid IANA timezone.',outside_window:'Use Monday–Friday, 09:00–17:00 in the displayed timezone.',recipient_suppressed:'This recipient is on do-not-contact.',reply_permission_required:'Enable reply checks for this mailbox in Mailboxes first.',initial_contact_only:'This contact already has an attempted email. Follow-up automation is not enabled.',contact_already_queued:'This contact already has a queued or attempted initial email.',schedule_spacing:'Leave at least 30 minutes between this mailbox’s scheduled messages.',schedule_limit:'This day already has the mailbox’s allowed number of scheduled emails.',queue_storage_unavailable:'Queue storage is unavailable. Apply the scheduler migration and check server access.',mailbox_disconnected:'Reconnect the outreach mailbox.',draft_changed:'The saved draft changed. Review it again.',lead_not_approved:'Set the saved email stage to Approved to send before reviewing.',already_attempted:'This item has already been claimed. Check history before another action.',not_due:'This message is not due yet.',schedule_missed:'The scheduled window was missed. Review and schedule again.',mailbox_paused:'This mailbox is paused.',reply_check_required:'A fresh reply check is required.',daily_limit:'The rolling daily allowance is reached.',spacing_limit:'The mailbox is waiting for its next sending slot.'};
function secretMatches(value,expected){if(typeof value!=='string'||typeof expected!=='string'||expected.length<32)return false;const h=s=>createHash('sha256').update(s).digest();return timingSafeEqual(h(value),h(expected));}
async function authorize(connection,env){const oauth=new OAuth2Client(env.GOOGLE_CLIENT_ID,env.GOOGLE_CLIENT_SECRET);oauth.setCredentials({refresh_token:unseal(connection.refresh_token,settings(env).key,connection.owner_id,connection.email)});const {token}=await oauth.getAccessToken();if(!token)throw Error('mailbox_disconnected');return token;}
async function gmail(token,path){const r=await fetch('https://gmail.googleapis.com/gmail/v1/users/me/'+path,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('inbox_check_failed');return r.json();}
function deliveryReports(payload){const reports=[];function walk(p){if((p.mimeType||'').toLowerCase()==='message/delivery-status'&&p.body?.data)reports.push(Buffer.from(p.body.data,'base64url').toString('utf8'));for(const part of p.parts||[])walk(part);}walk(payload||{});return reports;}
export function bounceForRecipient(payload,recipient){
 for(const text of deliveryReports(payload))for(const block of text.split(/\r?\n\r?\n/)){
  const address=block.match(/(?:Final|Original)-Recipient:\s*[^;\r\n]+;\s*([^\s<>]+)/i)?.[1]?.toLowerCase();
  if(address!==recipient.toLowerCase())continue;
  const status=block.match(/^Status:\s*([245])\.\d+\.\d+/im)?.[1];if(status==='5')return 'hard_bounce';if(status==='4')return 'delivery_delayed';
 }
 return null;
}
export async function inspectRecipient(token,row){
 const recipient=emailAddress(row.recipient),since=Math.floor(Date.parse(row.approved_at)/1000);
 if(!Number.isFinite(since))throw Error('inbox_check_failed');
 const reply=await gmail(token,'messages?'+new URLSearchParams({q:`in:anywhere from:(${recipient}) after:${since}`,maxResults:'1',fields:'messages/id'}));
 if(reply.messages?.length)return 'replied';
 const bounces=await gmail(token,'messages?'+new URLSearchParams({q:`in:anywhere (from:mailer-daemon OR from:postmaster) "${recipient}" newer_than:30d`,maxResults:'10',fields:'messages/id,nextPageToken'}));
 if(bounces.nextPageToken)throw Error('inbox_check_incomplete');
 for(const item of bounces.messages||[]){const message=await gmail(token,'messages/'+encodeURIComponent(item.id)+'?format=full');const result=bounceForRecipient(message.payload,recipient);if(result)return result;if(!deliveryReports(message.payload).length)throw Error('bounce_needs_review');}
 return 'clear';
}
async function submit(token,row){const r=await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({raw:mimeMessage(row)}),signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('send_unknown');const value=await r.json();if(typeof value.id!=='string'||!value.id)throw Error('send_unknown');return value.id;}
export function createQueueHandler({env=process.env,makeDb=(url,key)=>createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}),getToken=authorize,inspect=inspectRecipient,deliver=submit,draft=generateDraft,now=()=>new Date()}={}){
 return async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');
  let config;try{config=settings(env);}catch{return json(res,503,{error:'Server setup is incomplete.'});}
  const action=req.query?.action;if(!['status','draft','slot','schedule','settings','cancel','tick'].includes(action))return json(res,404,{error:'Not found.'});
  if(req.method!==(action==='status'?'GET':'POST'))return json(res,405,{error:'Method not allowed.'});
  const db=makeDb(env.SUPABASE_URL,env.SUPABASE_SECRET_KEY);
  try{
   if(action==='tick'){
    if(!secretMatches(req.headers.authorization,'Bearer '+env.QUEUE_WORKER_SECRET)||!env.QUEUE_WORKER_SECRET||env.QUEUE_WORKER_SECRET.length<32)return json(res,401,{error:'Unauthorized.'});
    check(await db.from('creative_os_worker_heartbeat').upsert({id:true,checked_at:now().toISOString()},{onConflict:'id'}));
    if(env.AUTOMATED_SENDING_ENABLED!=='true'||env.REVIEWED_SENDING_ENABLED!=='true'||!env.OUTREACH_POSTAL_ADDRESS?.trim())return json(res,200,{state:'disabled'});
    check(await db.rpc('expire_creative_os_queue'));
    const q=check(await db.rpc('next_creative_os_scheduled'));
    if(!q)return json(res,200,{state:'idle'});
    const update=async(state,reason)=>check(await db.from('creative_os_send_queue').update({state,reason,updated_at:now().toISOString()}).eq('outbox_id',q.outbox_id).eq('owner_id',q.owner_id).eq('state','scheduled'));
    if(Date.parse(q.scheduled_at)<now().getTime()-900000){await update('missed','schedule_missed');return json(res,200,{state:'missed'});}
    const connection=check(await db.from('creative_os_gmail_connections').select('*').eq('owner_id',q.owner_id).eq('email',q.message.mailbox).maybeSingle());
    if(!connection?.scopes?.includes(READ_SCOPE)){await update('blocked','reply_permission_required');return json(res,200,{state:'blocked'});}
    const footerToken=q.message.body.match(/\?token=([a-f0-9]{64})$/)?.[1];
    const footer='\n—\nSatavue\n'+env.OUTREACH_POSTAL_ADDRESS.trim()+'\nStop outreach emails: '+config.origin+'/api/outreach/unsubscribe?token='+footerToken;
    if(!footerToken||!q.message.body.endsWith(footer)){await update('blocked','sender_footer_changed');return json(res,200,{state:'blocked'});}
    let token,result;
    try{token=await getToken(connection,env);result=await inspect(token,{...q.message,approved_at:q.approved_at});}catch{
     check(await db.from('creative_os_mailbox_settings').update({enabled:false,last_error:'Reply or bounce check failed. Inspect Gmail, then resume explicitly.',last_run_at:now().toISOString()}).eq('owner_id',q.owner_id).eq('mailbox',q.message.mailbox));
     return json(res,200,{state:'paused',reason:'inbox_check_failed'});
    }
    if(result!=='clear'){
     if(result==='hard_bounce')check(await db.rpc('suppress_creative_os_contact',{p_owner:q.owner_id,p_email:q.message.recipient,p_reason:'Bounced'}));
     await update(result==='replied'?'replied':'blocked',result);return json(res,200,{state:result});
    }
    check(await db.from('creative_os_send_queue').update({checked_at:now().toISOString()}).eq('outbox_id',q.outbox_id).eq('state','scheduled'));
    let claimed;try{claimed=check(await db.rpc('claim_creative_os_scheduled',{p_owner:q.owner_id,p_id:q.outbox_id}));}catch(e){
     if(['spacing_limit','daily_limit','mailbox_paused','already_attempted'].includes(e.message))return json(res,200,{state:'held',reason:e.message});
     await update(e.message==='schedule_missed'?'missed':'blocked',e.message);return json(res,200,{state:'blocked',reason:e.message});
    }
    let providerId;try{providerId=await deliver(token,claimed);}catch{
     // A possibly submitted send is never automatically replayed.
     await db.from('creative_os_outbox').update({status:'unknown',finished_at:now().toISOString()}).eq('id',claimed.id).eq('status','sending');
     await db.from('creative_os_send_queue').update({state:'unknown',reason:'Check Gmail Sent before any further action.',updated_at:now().toISOString()}).eq('outbox_id',claimed.id).eq('state','processing');
     await db.from('creative_os_mailbox_settings').update({enabled:false,last_error:'Send result uncertain. Check Gmail Sent before resuming.',last_run_at:now().toISOString()}).eq('owner_id',q.owner_id).eq('mailbox',q.message.mailbox);
     return json(res,202,{state:'unknown'});
    }
    try{check(await db.from('creative_os_outbox').update({status:'sent',provider_id:providerId,finished_at:now().toISOString()}).eq('id',claimed.id).eq('status','sending'));check(await db.from('creative_os_send_queue').update({state:'sent',updated_at:now().toISOString()}).eq('outbox_id',claimed.id).eq('state','processing'));}catch{await db.from('creative_os_mailbox_settings').update({enabled:false,last_error:'Gmail accepted a send but recording failed. Check Gmail Sent before resuming.',last_run_at:now().toISOString()}).eq('owner_id',q.owner_id).eq('mailbox',q.message.mailbox);return json(res,202,{state:'unknown',message:'Provider accepted; recording failed. Check Gmail Sent. No automatic retry.'});}
    return json(res,200,{state:'sent',message:'Accepted by Gmail; delivery is not confirmed.'});
   }
   if(req.method==='POST'&&req.headers.origin!==config.origin)return json(res,403,{error:'Open this action from Creative OS.'});
   const jwt=req.headers.authorization?.match(/^Bearer (\S+)$/)?.[1];if(!jwt)return json(res,401,{error:'Sign in to Creative OS.'});
   const auth=await db.auth.getUser(jwt);if(auth.error||!auth.data?.user)return json(res,401,{error:'Sign in again.'});const owner=auth.data.user.id;
   if(action==='status'){
    const queue=check(await db.from('creative_os_send_queue').select('*,message:creative_os_outbox(id,lead_id,mailbox,recipient,subject,status)').eq('owner_id',owner).order('scheduled_at',{ascending:false}).limit(100));
    const mailboxes=check(await db.from('creative_os_mailbox_settings').select('mailbox,enabled,daily_limit,last_run_at,last_error').eq('owner_id',owner));
    const heartbeat=check(await db.from('creative_os_worker_heartbeat').select('checked_at').eq('id',true).maybeSingle());
    return json(res,200,{queue,mailboxes,workerLastSeen:heartbeat?.checked_at||null,draftingConfigured:!!(env.OPENAI_API_KEY&&env.OUTREACH_DRAFT_MODEL),schedulerEnabled:env.AUTOMATED_SENDING_ENABLED==='true'&&env.REVIEWED_SENDING_ENABLED==='true'&&!!env.OUTREACH_POSTAL_ADDRESS?.trim()&&!!env.QUEUE_WORKER_SECRET&&env.QUEUE_WORKER_SECRET.length>=32});
   }
   if(action==='slot'){const at=check(await db.rpc('plan_creative_os_slot',{p_owner:owner,p_mailbox:req.body?.mailbox,p_zone:req.body?.timezone}));return json(res,200,{at});}
   if(action==='settings'){
    const {mailbox,enabled,dailyLimit}=req.body||{};if(!MAILBOXES.includes(mailbox)||typeof enabled!=='boolean'||!Number.isInteger(dailyLimit)||dailyLimit<1||dailyLimit>15)return json(res,400,{error:'Choose an outreach mailbox and a daily allowance from 1 to 15.'});
    if(enabled){const heartbeat=check(await db.from('creative_os_worker_heartbeat').select('checked_at').eq('id',true).maybeSingle());if(!heartbeat?.checked_at||Date.parse(heartbeat.checked_at)<now().getTime()-300000)throw Error('worker_not_running');if(env.AUTOMATED_SENDING_ENABLED!=='true'||env.REVIEWED_SENDING_ENABLED!=='true'||!env.OUTREACH_POSTAL_ADDRESS?.trim()||!env.QUEUE_WORKER_SECRET||env.QUEUE_WORKER_SECRET.length<32)throw Error('scheduler_not_configured');const c=check(await db.from('creative_os_gmail_connections').select('scopes').eq('owner_id',owner).eq('email',mailbox).maybeSingle());if(!c?.scopes?.includes(READ_SCOPE))throw Error('reply_permission_required');}
    check(await db.from('creative_os_mailbox_settings').upsert({owner_id:owner,mailbox,enabled,daily_limit:dailyLimit},{onConflict:'owner_id,mailbox'}));return json(res,200,{saved:true});
   }
   if(action==='cancel'){check(await db.from('creative_os_send_queue').update({state:'cancelled',reason:'Cancelled by owner.',updated_at:now().toISOString()}).eq('owner_id',owner).eq('outbox_id',req.body?.id).eq('state','scheduled'));return json(res,200,{cancelled:true,message:'Pending item cancelled. An already claimed send may finish.'});}
   if(action==='draft'){
    const workspace=check(await db.from('creative_os_workspaces').select('document').eq('owner_id',owner).maybeSingle());const lead=workspace?.document?.leads?.find(l=>l.id===req.body?.leadId);if(!lead)throw Error('lead_missing');
    const evidence=draftEvidence(lead);const generated=await draft(evidence,env);return json(res,200,{draft:generated,leadId:lead.id,baseSubject:lead.subject||'',baseBody:lead.body||'',baseResearch:JSON.stringify(evidence)});
   }
   if(req.body?.confirmed!==true)return json(res,400,{error:'Review the exact email and confirm scheduling first.'});
   if(env.REVIEWED_SENDING_ENABLED!=='true')throw Error('sending_disabled');
   check(await db.rpc('schedule_creative_os_send',{p_owner:owner,p_id:req.body.id,p_at:req.body.at,p_zone:req.body.timezone}));return json(res,200,{scheduled:true,message:'Approved snapshot scheduled. Dispatch also requires an enabled mailbox, an active worker and a fresh inbox check.'});
  }catch(e){const known=messages[e.message]||({worker_not_running:'No recent scheduler check was observed. Start or repair the cloud scheduler first.',scheduler_not_configured:'The owner must configure the scheduler before enabling this mailbox.',lead_missing:'Choose a saved lead.',sending_disabled:'Reviewed sending is not enabled.'})[e.message];return json(res,409,{error:known||(action==='draft'&&/^(Add research|Choose a saved|Draft generation needs|Draft generation failed|The draft was|The drafting service)/.test(e.message)?e.message:'This action failed. No automatic resend was started.')});}
 };
}
