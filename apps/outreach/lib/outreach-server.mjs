import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {OAuth2Client} from 'google-auth-library';
import {MAILBOXES,settings,unseal} from './gmail-server.mjs';

export const digest=value=>createHash('sha256').update(value).digest('hex');
export function emailAddress(value){
 if(typeof value!=='string'||value.length>254||! /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,63}$/.test(value.trim()))throw Error('invalid_recipient');
 const email=value.trim().toLowerCase();
 if(/\.(example|invalid|test)$/.test(email))throw Error('invalid_recipient');
 return email;
}
export function validateDraft(lead){
 if(!lead||typeof lead.id!=='string'||lead.id.startsWith('sample-'))throw Error('lead_missing');
 const recipient=emailAddress(lead.email);
 if(!['Approved to send','Follow-up due'].includes(lead.emailStage)||['Lost','Skipped','Won'].includes(lead.status))throw Error('lead_not_approved');
 if(typeof lead.subject!=='string'||!lead.subject.trim()||lead.subject.length>180||/[\r\n\x00-\x1f\x7f]/.test(lead.subject))throw Error('invalid_subject');
 if(typeof lead.body!=='string'||!lead.body.trim()||Buffer.byteLength(lead.body)>20000||lead.body.includes('\0'))throw Error('invalid_message');
 return {recipient,subject:lead.subject,source_body:lead.body};
}
export function mimeMessage(row){
 if(!MAILBOXES.includes(row.mailbox))throw Error('mailbox_disconnected');
 emailAddress(row.recipient);
 if(/[\r\n]/.test(row.subject))throw Error('invalid_subject');
 const unsubscribe=row.body.match(/Stop outreach emails: (https:\/\/[^\s]+\/api\/outreach\/unsubscribe\?token=[a-f0-9]{64})$/)?.[1];
 if(!unsubscribe)throw Error('invalid_message');
 // UTF-8 base64 parts prevent header injection and preserve international text.
 const chunks=[];let chunk='';for(const char of row.subject){if(Buffer.byteLength(chunk+char)>36){chunks.push(chunk);chunk='';}chunk+=char;}if(chunk)chunks.push(chunk);
 const subject=chunks.map(s=>'=?UTF-8?B?'+Buffer.from(s).toString('base64')+'?=').join('\r\n ');
 const body=Buffer.from(row.body.replace(/\r?\n/g,'\r\n')).toString('base64').match(/.{1,76}/g).join('\r\n');
 return Buffer.from([`From: Satavue <${row.mailbox}>`,`To: ${row.recipient}`,`Subject: ${subject}`,`Message-ID: <${row.id}@${row.mailbox.split('@')[1]}>`,`Date: ${new Date().toUTCString()}`,'MIME-Version: 1.0','Content-Type: text/plain; charset=UTF-8','Content-Transfer-Encoding: base64',`List-Unsubscribe: <${unsubscribe}>`,'List-Unsubscribe-Post: List-Unsubscribe=One-Click','',body].join('\r\n')).toString('base64url');
}
const errors={scheduled_use_queue:'This message is scheduled. Manage or cancel it in Drafts & schedule.',invalid_recipient:'Use one valid recipient email address.',lead_missing:'Save a real lead first.',lead_not_approved:'Set the saved lead’s email stage to Approved to send or Follow-up due.',invalid_subject:'Add a subject of up to 180 characters without line breaks.',invalid_message:'Add a plain-text message smaller than 20 KB.',recipient_suppressed:'This recipient is on your do-not-contact list.',mailbox_disconnected:'Connect the selected outreach mailbox first.',review_missing:'Review this message first.',review_expired:'The review expired. Review the message again.',already_attempted:'This message has already been attempted. Check history before taking any further action.',draft_changed:'The saved draft changed. Review the current version.',daily_limit:'This mailbox has reached the app limit of 20 attempts per rolling 24 hours.',spacing_limit:'Wait at least 60 seconds between sends from this mailbox.',sending_disabled:'Reviewed sending is not enabled in Production.',sender_address_missing:'The owner must configure OUTREACH_POSTAL_ADDRESS before sending.',storage_unavailable:'Sending storage is unavailable. Apply the outreach migration and check server access.'};
function checked(result){if(result.error){const code=Object.keys(errors).find(k=>result.error.message?.includes(k));throw Error(code||'storage_unavailable');}return result.data;}
function json(res,status,body){res.statusCode=status;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(body));}
function publicMessage(row){const {id,lead_id,mailbox,recipient,subject,body,status,reviewed_at,attempted_at,provider_id}=row;return {id,lead_id,mailbox,recipient,subject,body,status,reviewed_at,attempted_at,provider_id};}
function unsubscribePage(res,token,complete=false){
 res.setHeader('Content-Type','text/html; charset=utf-8');res.statusCode=200;
 res.end(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Satavue email preferences</title><body><main><h1>${complete?'You are unsubscribed':'Stop outreach emails'}</h1><p>${complete?'This address is now on the sender’s do-not-contact list. A message already being sent may still arrive.':'Confirm to stop future outreach from this workspace across both outreach mailboxes.'}</p>${complete?'':`<form method="post" action="/api/outreach/unsubscribe?token=${token}"><button type="submit">Unsubscribe</button></form>`}</main></body></html>`);
}
export function createOutreachHandler({env=process.env,makeDb=(url,key)=>createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}),authorize=async row=>{
 const oauth=new OAuth2Client(env.GOOGLE_CLIENT_ID,env.GOOGLE_CLIENT_SECRET);
 oauth.setCredentials({refresh_token:unseal(row.refresh_token,settings(env).key,row.owner_id,row.email)});
 const {token}=await oauth.getAccessToken();if(!token)throw Error('mailbox_disconnected');return token;
},submit=async(token,raw)=>{
 // One network submission. Never automatically replay a possibly accepted message.
 const r=await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({raw}),signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw Error('provider_result_unknown');
 const data=await r.json();if(typeof data.id!=='string'||!data.id)throw Error('provider_result_unknown');return data.id;
}}={}){
 return async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');
  let config;try{config=settings(env);}catch{return json(res,503,{error:'Server setup is incomplete.'});}
  const action=req.query?.action;
  if(!['status','review','send','suppress','unsubscribe'].includes(action))return json(res,404,{error:'Not found.'});
  const db=makeDb(env.SUPABASE_URL,env.SUPABASE_SECRET_KEY);
  try{
   if(action==='unsubscribe'){
    if(!['GET','POST'].includes(req.method))return json(res,405,{error:'Method not allowed.'});
    const token=req.query.token;if(typeof token!=='string'||! /^[a-f0-9]{64}$/.test(token))return json(res,400,{error:'Invalid unsubscribe link.'});
    const row=checked(await db.from('creative_os_outbox').select('owner_id,recipient').eq('unsubscribe_hash',digest(token)).maybeSingle());
    if(!row)return json(res,400,{error:'Invalid unsubscribe link.'});
    if(req.method==='POST')checked(await db.rpc('suppress_creative_os_contact',{p_owner:row.owner_id,p_email:row.recipient,p_reason:'Unsubscribed'}));
    return unsubscribePage(res,token,req.method==='POST');
   }
   if(req.method!==(action==='status'?'GET':'POST'))return json(res,405,{error:'Method not allowed.'});
   if(req.method==='POST'&&req.headers.origin!==config.origin)return json(res,403,{error:'Open this action from Creative OS.'});
   const jwt=req.headers.authorization?.match(/^Bearer (\S+)$/)?.[1];
   if(!jwt)return json(res,401,{error:'Sign in to Creative OS.'});
   const {data,error}=await db.auth.getUser(jwt);if(error||!data?.user)return json(res,401,{error:'Sign in again.'});
   const owner=data.user.id;
   if(action==='status'){
    const rows=checked(await db.from('creative_os_outbox').select('id,lead_id,mailbox,recipient,subject,status,reviewed_at,attempted_at,provider_id').eq('owner_id',owner).order('reviewed_at',{ascending:false}).limit(100));
    const suppressions=checked(await db.from('creative_os_suppressions').select('email,reason,created_at').eq('owner_id',owner).order('created_at',{ascending:false}).limit(100));
    return json(res,200,{enabled:env.REVIEWED_SENDING_ENABLED==='true',addressConfigured:!!env.OUTREACH_POSTAL_ADDRESS?.trim(),history:rows,suppressions,limit:20});
   }
   if(action==='suppress'){
    const email=emailAddress(req.body?.email),reason=req.body?.reason;
    if(!['Unsubscribed','Bounced','Do not contact'].includes(reason))return json(res,400,{error:'Choose a suppression reason.'});
    checked(await db.rpc('suppress_creative_os_contact',{p_owner:owner,p_email:email,p_reason:reason}));return json(res,200,{suppressed:true});
   }
   if(env.REVIEWED_SENDING_ENABLED!=='true')throw Error('sending_disabled');
   const address=env.OUTREACH_POSTAL_ADDRESS?.trim();if(!address||address.length>500)throw Error('sender_address_missing');
   if(action==='review'){
    const workspace=checked(await db.from('creative_os_workspaces').select('document').eq('owner_id',owner).maybeSingle());
    const lead=workspace?.document?.leads?.find(l=>l.id===req.body?.leadId),draft=validateDraft(lead),mailbox=req.body?.mailbox;
    if(!MAILBOXES.includes(mailbox))throw Error('mailbox_disconnected');
    const connected=checked(await db.from('creative_os_gmail_connections').select('email').eq('owner_id',owner).eq('email',mailbox).maybeSingle());if(!connected)throw Error('mailbox_disconnected');
    const suppressed=checked(await db.from('creative_os_suppressions').select('email').eq('owner_id',owner).eq('email',draft.recipient).maybeSingle());if(suppressed)throw Error('recipient_suppressed');
    const fingerprint=digest(JSON.stringify([lead.id,mailbox,draft.recipient,draft.subject,draft.source_body,address]));
    const existing=checked(await db.from('creative_os_outbox').select('*').eq('owner_id',owner).eq('fingerprint',fingerprint).maybeSingle());
    if(existing){if(existing.status!=='reviewed')throw Error('already_attempted');checked(await db.from('creative_os_outbox').update({reviewed_at:new Date().toISOString()}).eq('id',existing.id).eq('owner_id',owner).eq('status','reviewed'));return json(res,200,{review:publicMessage(existing)});}
    const token=randomBytes(32).toString('hex'),unsubscribe=config.origin+'/api/outreach/unsubscribe?token='+token;
    const row={id:randomUUID(),owner_id:owner,lead_id:lead.id,mailbox,...draft,body:draft.source_body+'\n\n—\nSatavue\n'+address+'\nStop outreach emails: '+unsubscribe,fingerprint,unsubscribe_hash:digest(token)};
    const saved=checked(await db.from('creative_os_outbox').insert(row).select().single());return json(res,200,{review:publicMessage(saved)});
   }
   if(typeof req.body?.id!=='string'||! /^[a-f0-9-]{36}$/.test(req.body.id))throw Error('review_missing');
   const review=checked(await db.from('creative_os_outbox').select('mailbox').eq('owner_id',owner).eq('id',req.body.id).maybeSingle());if(!review)throw Error('review_missing');
   const connection=checked(await db.from('creative_os_gmail_connections').select('owner_id,email,refresh_token').eq('owner_id',owner).eq('email',review.mailbox).maybeSingle());if(!connection)throw Error('mailbox_disconnected');
   // Refresh before the irreversible claim: a refresh failure cannot send mail.
   let token;try{token=await authorize(connection);}catch{throw Error('mailbox_disconnected');}
   const row=checked(await db.rpc('claim_creative_os_send',{p_owner:owner,p_id:req.body.id}));
   let providerId;
   try{providerId=await submit(token,mimeMessage(row));}catch{
    await db.from('creative_os_outbox').update({status:'unknown',finished_at:new Date().toISOString()}).eq('owner_id',owner).eq('id',row.id).eq('status','sending');
    return json(res,202,{status:'unknown',message:'The send result is uncertain. Check Gmail Sent manually. This message will not be retried.'});
   }
   try{checked(await db.from('creative_os_outbox').update({status:'sent',provider_id:providerId,finished_at:new Date().toISOString()}).eq('owner_id',owner).eq('id',row.id).eq('status','sending'));}catch{return json(res,202,{status:'unknown',message:'Gmail accepted the message, but recording the result failed. Check Gmail Sent; do not resend.'});}
   return json(res,200,{status:'sent',providerId,message:'Gmail accepted the message. Delivery is not yet confirmed.'});
  }catch(e){const message=errors[e.message]||'The action failed. No automatic retry was started.';return json(res,409,{error:message});}
 };
}
