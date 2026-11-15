import {createHash,randomBytes,createCipheriv,createDecipheriv,timingSafeEqual} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {OAuth2Client} from 'google-auth-library';

export const MAILBOXES=['sagorika@satavuestudio.com','sagorika@withsatavue.com'];
export const SCOPES=['openid','email','https://www.googleapis.com/auth/gmail.send'];
const COOKIE='__Secure-creative_os_gmail';
export const hash=value=>createHash('sha256').update(value).digest('hex');
export function settings(env){
 const names=['APP_URL','SUPABASE_URL','SUPABASE_SECRET_KEY','GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','GMAIL_TOKEN_ENCRYPTION_KEY'];
 if(names.some(n=>!env[n]))throw new Error('setup_required');
 const url=new URL(env.APP_URL);
 if(url.protocol!=='https:'||url.origin!==env.APP_URL)throw new Error('setup_required');
 const key=Buffer.from(env.GMAIL_TOKEN_ENCRYPTION_KEY,'base64');
 if(key.length!==32)throw new Error('setup_required');
 return {origin:url.origin,key,callback:url.origin+'/api/gmail/callback'};
}
export function seal(value,key,owner,email){
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);
 cipher.setAAD(Buffer.from(owner+'\n'+email));
 return Buffer.concat([iv,cipher.update(value,'utf8'),cipher.final(),cipher.getAuthTag()]).toString('base64');
}
export function unseal(value,key,owner,email){
 const b=Buffer.from(value,'base64'),decipher=createDecipheriv('aes-256-gcm',key,b.subarray(0,12));
 decipher.setAAD(Buffer.from(owner+'\n'+email));decipher.setAuthTag(b.subarray(-16));
 return Buffer.concat([decipher.update(b.subarray(12,-16)),decipher.final()]).toString('utf8');
}
function equal(a,b){return typeof a==='string'&&typeof b==='string'&&a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));}
export function validState(state,cookie){return /^[a-f0-9]{64}$/.test(state||'')&&equal(hash(state),cookie);}
function json(res,status,body){res.statusCode=status;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(body));}
function cookie(res,value,maxAge=600){res.setHeader('Set-Cookie',`${COOKIE}=${value}; Path=/api/gmail; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`);}
function done(res,origin,result){cookie(res,'',0);res.statusCode=303;res.setHeader('Location',origin+'/?gmail='+result);res.end();}
function dbResult(result){if(result.error)throw new Error('storage_error');return result.data;}
export function createHandler({env=process.env,makeDb=(url,key)=>createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}),makeOAuth=(id,secret,callback)=>new OAuth2Client(id,secret,callback)}={}){
 return async function handler(req,res){
  res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');
  let config;
  try{config=settings(env);}catch{return json(res,503,{error:'Gmail setup is not complete on the server.',setupRequired:true});}
  const db=makeDb(env.SUPABASE_URL,env.SUPABASE_SECRET_KEY),oauth=makeOAuth(env.GOOGLE_CLIENT_ID,env.GOOGLE_CLIENT_SECRET,config.callback);
  const action=req.query?.action;
  if(!['start','callback','status','check','disconnect'].includes(action))return json(res,404,{error:'Not found.'});
  if(req.method!==(action==='status'||action==='callback'?'GET':'POST'))return json(res,405,{error:'Method not allowed.'});
  let stage='request';
  try{
   if(action==='callback'){
    const {state,code,error}=req.query;
    const value=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
    if(!validState(state,value))return done(res,config.origin,'invalid_state');
    // DELETE RETURNING consumes the state atomically, preventing callback replay.
    const row=dbResult(await db.from('creative_os_gmail_oauth_states').delete().eq('state_hash',hash(state)).select().maybeSingle());
    if(!row||Date.parse(row.expires_at)<=Date.now())return done(res,config.origin,'expired');
    if(error||typeof code!=='string')return done(res,config.origin,'cancelled');
    stage='token_exchange';
    const {tokens}=await oauth.getToken({code,codeVerifier:row.verifier,redirect_uri:config.callback});
    if(!tokens.id_token||!tokens.refresh_token)return done(res,config.origin,'consent_required');
    stage='identity_verification';
    const ticket=await oauth.verifyIdToken({idToken:tokens.id_token,audience:env.GOOGLE_CLIENT_ID});
    const identity=ticket.getPayload(),email=identity?.email?.toLowerCase();
    if(!identity?.email_verified||email!==row.email||!MAILBOXES.includes(email))return done(res,config.origin,'wrong_account');
    const granted=(tokens.scope||'').split(' ');
    if(!granted.includes(SCOPES[2]))return done(res,config.origin,'permission_required');
    stage='token_storage';
    dbResult(await db.from('creative_os_gmail_connections').upsert({owner_id:row.owner_id,email,refresh_token:seal(tokens.refresh_token,config.key,row.owner_id,email),scopes:granted,connected_at:new Date().toISOString(),checked_at:null},{onConflict:'owner_id,email'}));
    return done(res,config.origin,'connected');
   }
   if(req.method==='POST'&&req.headers.origin!==config.origin)return json(res,403,{error:'Open this action from Creative OS.'});
   const bearer=req.headers.authorization?.match(/^Bearer (\S+)$/)?.[1];
   if(!bearer)return json(res,401,{error:'Sign in again to connect Gmail.'});
   const {data,error}=await db.auth.getUser(bearer);
   if(error||!data?.user)return json(res,401,{error:'Sign in again to connect Gmail.'});
   const owner=data.user.id;
   if(action==='status'){
    const rows=dbResult(await db.from('creative_os_gmail_connections').select('email,connected_at,checked_at').eq('owner_id',owner));
    return json(res,200,{connections:rows});
   }
   const email=req.body?.email;
   if(!MAILBOXES.includes(email))return json(res,400,{error:'Choose one of the two outreach mailboxes.'});
   if(action==='start'){
    const state=randomBytes(32).toString('hex'),verifier=randomBytes(32).toString('base64url');
    // Remove this owner's stale/pending states; at most one connection flow per browser.
    dbResult(await db.from('creative_os_gmail_oauth_states').delete().eq('owner_id',owner));
    dbResult(await db.from('creative_os_gmail_oauth_states').insert({state_hash:hash(state),owner_id:owner,email,verifier,expires_at:new Date(Date.now()+600000).toISOString()}));
    const url=oauth.generateAuthUrl({access_type:'offline',prompt:'consent',scope:SCOPES,state,login_hint:email,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'});
    cookie(res,hash(state));return json(res,200,{url});
   }
   if(action==='disconnect'){
    dbResult(await db.from('creative_os_gmail_connections').delete().eq('owner_id',owner).eq('email',email));
    dbResult(await db.from('creative_os_gmail_oauth_states').delete().eq('owner_id',owner).eq('email',email));
    return json(res,200,{disconnected:true});
   }
   const row=dbResult(await db.from('creative_os_gmail_connections').select('refresh_token').eq('owner_id',owner).eq('email',email).maybeSingle());
   if(!row)return json(res,404,{error:'Connect this mailbox first.'});
   oauth.setCredentials({refresh_token:unseal(row.refresh_token,config.key,owner,email)});
   await oauth.getAccessToken();
   const checked_at=new Date().toISOString();
   dbResult(await db.from('creative_os_gmail_connections').update({checked_at}).eq('owner_id',owner).eq('email',email));
   return json(res,200,{checked_at});
  }catch(error){
   // Return only fixed diagnostic labels, never provider messages, tokens or codes.
   if(action==='callback'){
    const providerError=error?.response?.data?.error;
    const reason=stage==='token_exchange'&&['invalid_client','invalid_grant','redirect_uri_mismatch'].includes(providerError)?'token_'+providerError:stage==='token_exchange'?'token_exchange_failed':stage==='identity_verification'?'identity_failed':stage==='token_storage'?'storage_failed':'state_failed';
    console.warn(JSON.stringify({event:'gmail_oauth_failed',reason}));
    return done(res,config.origin,reason);
   }
   return json(res,502,{error:'Could not complete the Gmail action. Check server setup or reconnect the mailbox.'});
  }
 };
}
