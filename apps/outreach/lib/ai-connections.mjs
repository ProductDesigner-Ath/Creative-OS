import {createClient} from '@supabase/supabase-js';
import {seal,unseal} from './gmail-server.mjs';
const table='creative_os_ai_connections';
export const PROVIDERS=['openai','anthropic','higgsfield'];
export function encryptionKey(env){const key=Buffer.from(env.AI_CREDENTIAL_ENCRYPTION_KEY||env.GMAIL_TOKEN_ENCRYPTION_KEY||'','base64');if(key.length!==32)throw Error('encryption_setup');return key;}
const checked=r=>{if(r.error)throw Error(String(r.error.message).includes('connection_conflict')?'connection_conflict':'connections_storage');return r.data;};
export function environmentConnection(provider,env){
 const apiKey=provider==='openai'?env.OPENAI_API_KEY:provider==='anthropic'?env.ANTHROPIC_API_KEY:env.HIGGSFIELD_API_KEY;
 const model=provider==='openai'?(env.ASSISTANT_MODEL||env.OUTREACH_DRAFT_MODEL):provider==='anthropic'?env.ANTHROPIC_MODEL:'';
 return apiKey&&(provider==='higgsfield'||model)?{apiKey,model:model||'',source:'environment'}:null;
}
export const missingConnectionSchema=error=>['42P01','PGRST205'].includes(error?.code);
export async function resolveConnection(db,owner,provider,env,{optional=false}={}){
 if(!PROVIDERS.includes(provider))throw Error('invalid_provider');
 const result=await db.from(table).select('credential,model').eq('owner_id',owner).eq('provider',provider).maybeSingle();
 if(optional&&missingConnectionSchema(result.error)){const fallback=environmentConnection(provider,env);if(fallback)return fallback;throw Error('not_configured');}
 const row=checked(result);
 if(row)return {apiKey:unseal(row.credential,encryptionKey(env),owner,'ai-provider:'+provider),model:row.model,source:'account'};
 const fallback=environmentConnection(provider,env);if(!fallback)throw Error('not_configured');return fallback;
}
export async function providerStatus(db,owner,env,{optional=false}={}){
 const result=await db.from(table).select('provider,model,revision,checked_at').eq('owner_id',owner),missing=missingConnectionSchema(result.error);
 const rows=optional&&missing?[]:checked(result);
 return PROVIDERS.map(provider=>{const saved=rows.find(r=>r.provider===provider),fallback=environmentConnection(provider,env);return {provider,schemaReady:!missing,connected:!!(saved||fallback),source:saved?'account':fallback?'environment':null,model:saved?.model||fallback?.model||'',revision:saved?.revision||0,checkedAt:saved?.checked_at||null,capability:provider==='higgsfield'?'media':'chat'};});
}
export async function verifyConnection(provider,apiKey,model,fetcher=fetch){
 if(!PROVIDERS.includes(provider)||typeof apiKey!=='string'||apiKey.length<16||apiKey.length>4096||/[\s\x00-\x1f\x7f]/.test(apiKey))throw Error('invalid_credential');
 if(provider!=='higgsfield'&&(typeof model!=='string'||!/^[-a-zA-Z0-9_.:]{1,128}$/.test(model)))throw Error('invalid_model');
 const url=provider==='openai'?'https://api.openai.com/v1/models/'+encodeURIComponent(model):provider==='anthropic'?'https://api.anthropic.com/v1/models/'+encodeURIComponent(model):'https://api.higgsfield.ai/files/generate-upload-url';
 const options=provider==='openai'?{headers:{Authorization:'Bearer '+apiKey}}:provider==='anthropic'?{headers:{'x-api-key':apiKey,'anthropic-version':'2023-06-01'}}:{method:'POST',headers:{Authorization:'Key '+apiKey,'Content-Type':'application/json'},body:JSON.stringify({content_type:'image/png'})};
 const response=await fetcher(url,{...options,redirect:'error',signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw Error([401,403].includes(response.status)?'credential_rejected':response.status===404?'model_unavailable':'verification_unavailable');
 const result=await response.json();
 if(provider==='higgsfield'){if(typeof result.upload_url!=='string'||!result.upload_url.startsWith('https://'))throw Error('verification_unavailable');}
 else if(result.id!==model)throw Error('model_unavailable');
}
export function createConnectionsHandler({env=process.env,makeDb=(u,k)=>createClient(u,k,{auth:{persistSession:false,autoRefreshToken:false}}),verify=verifyConnection}={}){
 return async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');const send=(s,b)=>{res.statusCode=s;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(b));};
 try{
  const action=req.query?.action;if(!['status','connect','check','disconnect'].includes(action))return send(404,{error:'Not found.'});
  if(req.method!==(action==='status'?'GET':'POST'))return send(405,{error:'Method not allowed.'});
  if(!env.APP_URL||!env.SUPABASE_URL||!env.SUPABASE_SECRET_KEY)throw Error('server_setup');
  if(req.method==='POST'&&req.headers.origin!==new URL(env.APP_URL).origin)return send(403,{error:'Open this action from Creative OS.'});
  const db=makeDb(env.SUPABASE_URL,env.SUPABASE_SECRET_KEY),jwt=req.headers.authorization?.match(/^Bearer (\S+)$/)?.[1];if(!jwt)return send(401,{error:'Sign in to Creative OS.'});const auth=await db.auth.getUser(jwt);if(auth.error||!auth.data?.user)return send(401,{error:'Sign in again.'});const owner=auth.data.user.id;
  if(action==='status')return send(200,{providers:await providerStatus(db,owner,env)});
  const {provider,apiKey,model='',revision}=req.body||{};if(!PROVIDERS.includes(provider))throw Error('invalid_provider');
  if(action==='connect'){
   const key=encryptionKey(env);if(!Number.isInteger(revision)||revision<0)throw Error('connection_conflict');await verify(provider,apiKey,model);
   checked(await db.rpc('save_creative_os_ai_connection',{p_owner:owner,p_provider:provider,p_credential:seal(apiKey,key,owner,'ai-provider:'+provider),p_model:provider==='higgsfield'?'':model,p_revision:revision}));
   return send(200,{saved:true,providers:await providerStatus(db,owner,env)});
  }
  if(action==='check'){const connection=await resolveConnection(db,owner,provider,env);await verify(provider,connection.apiKey,connection.model);return send(200,{verified:true,message:provider==='higgsfield'?'Upload authentication verified. No image or video was generated.':'API key and model access verified. No chat response was generated.'});}
  if(!Number.isInteger(revision)||revision<1)throw Error('connection_conflict');
  const deleted=checked(await db.from(table).delete().eq('owner_id',owner).eq('provider',provider).eq('revision',revision).select('provider'));if(!deleted.length)throw Error('connection_conflict');
  return send(200,{disconnected:true,providers:await providerStatus(db,owner,env)});
 }catch(e){const errors={server_setup:'Server setup is incomplete.',encryption_setup:'Set a 32-byte base64 AI_CREDENTIAL_ENCRYPTION_KEY on the server (the existing Gmail encryption key is also supported).',connections_storage:'API connection storage is unavailable. Apply migration 202611160003_ai_connections.sql after the assistant migration.',invalid_provider:'Choose OpenAI, Claude or Higgsfield.',invalid_credential:'Paste the complete API key without spaces or a header prefix.',invalid_model:'Enter the exact chat model ID from your provider console.',credential_rejected:'The provider rejected this API key. Check permissions and try again.',model_unavailable:'This model is not available to the supplied key. Check its exact model ID and access.',verification_unavailable:'Could not verify the connection. The existing key has not been replaced.',connection_conflict:'Another device changed this connection. Refresh the connection list before trying again.',not_configured:'Connect this provider first.'};return send(400,{error:errors[e.message]||'Could not complete the connection action. Check server setup and try again.'});}
 };
}
