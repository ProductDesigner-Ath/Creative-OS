import React,{useEffect,useState} from 'react';
import {Button} from '@/components/ui/button';
import {Card} from '@/components/ui/card';
import {Badge} from '@/components/ui/badge';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Mail,ShieldCheck} from 'lucide-react';
import {MAILBOXES} from '../model.mjs';

const results={token_invalid_client:'Google rejected the OAuth client credentials. Check that GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET come from the same Web client, then redeploy.',token_invalid_grant:'Google rejected the authorization code or PKCE proof. Start a fresh connection and complete it promptly.',token_redirect_uri_mismatch:'Google rejected the callback address. Register the exact production /api/gmail/callback URL for this Web client.',token_exchange_failed:'The server could not exchange Google authorization. The deployment owner can inspect the safe gmail_oauth_failed diagnostic in Vercel.',identity_failed:'The server could not verify the Google account identity. Contact the deployment owner.',storage_failed:'Google authorization succeeded, but encrypted token storage failed. Check the Gmail migration and server database access.',state_failed:'The connection state could not be read from the database. Start again or contact the deployment owner.',connected:'Gmail connected. Sending remains disabled.',cancelled:'Google connection was cancelled.',wrong_account:'Choose the outreach Google account shown on the mailbox card.',expired:'The connection attempt expired. Try connecting again.',invalid_state:'The connection could not be verified. Start again from this browser.',consent_required:'Google did not provide offline access. Try connecting again and approve the requested access.',permission_required:'Sending permission was not granted. Connect again to approve it.',failed:'The connection failed. Check the Google callback, Gmail API and server settings, then try again.'};
export default function Mailboxes({client}){
 const [rows,setRows]=useState([]),[loading,setLoading]=useState(!!client),[busy,setBusy]=useState(''),[error,setError]=useState(''),[setup,setSetup]=useState(false),[disconnect,setDisconnect]=useState(null);
 const [message]=useState(()=>results[new URLSearchParams(location.search).get('gmail')]||'');
 async function request(action,email){
  const {data,error:authError}=await client.auth.getSession();
  if(authError||!data.session)throw new Error('Sign in again to manage Gmail.');
  const response=await fetch('/api/gmail/'+action,{method:action==='status'?'GET':'POST',headers:{Authorization:'Bearer '+data.session.access_token,...(action==='status'?{}:{'Content-Type':'application/json'})},...(action==='status'?{}:{body:JSON.stringify({email})})});
  let body;try{body=await response.json();}catch{throw new Error('Gmail API is unavailable. Use the deployed Vercel app.');}
  if(!response.ok){setSetup(!!body.setupRequired);throw new Error(body.error||'Could not complete the Gmail action.');}
  return body;
 }
 async function load(){setLoading(true);setError('');try{setRows((await request('status')).connections);setSetup(false);}catch(e){setError(e.message);}finally{setLoading(false);}}
 useEffect(()=>{if(client)load();const u=new URL(location.href);if(u.searchParams.has('gmail')){u.searchParams.delete('gmail');history.replaceState(null,'',u.pathname+u.search+u.hash);}},[client]);
 async function act(action,email){setBusy(email);setError('');try{const result=await request(action,email);if(action==='start'){const u=new URL(result.url);if(u.origin!=='https://accounts.google.com')throw new Error('Invalid Google connection address.');location.assign(u.href);return;}setDisconnect(null);await load();}catch(e){setError(e.message);}finally{setBusy('');}}
 return <>
  {message&&<p className="notice" role="status">{message}</p>}
  {error&&<div className="notice" role="alert"><span>{error}{setup&&' The deployment owner must finish the server environment and database setup.'}</span><Button variant="outline" disabled={loading||!!busy} onClick={load}>Retry</Button></div>}
  {!client&&<p className="notice">Sign in to the hosted Creative OS workspace to connect Gmail. Local preview does not connect accounts.</p>}
  <div className="mailbox-grid">{MAILBOXES.map(email=>{const row=rows.find(r=>r.email===email);return <Card className="panel mailbox-card" key={email}>
   <span className="mail-icon"><Mail/></span><h2>{email.split('@')[1]}</h2><p>{email}</p>
   <div className="mail-detail"><span>Google authorization</span><Badge variant="secondary">{loading?'Checking…':row?'Connected':'Not connected'}</Badge></div>
   <div className="mail-detail"><span>Connection checked</span><span className="muted">{row?.checked_at?new Date(row.checked_at).toLocaleString():'Not checked'}</span></div>
   <div className="mail-detail"><span>Automatic sending</span><span className="muted">Not enabled</span></div>
   <div className="actions">{row?<><Button variant="outline" disabled={!!busy||loading} onClick={()=>act('check',email)}>{busy===email?'Working…':'Check connection'}</Button><Button variant="ghost" disabled={!!busy||loading} onClick={()=>setDisconnect(email)}>Disconnect</Button></>:<Button disabled={!client||loading||!!busy||setup} onClick={()=>act('start',email)}>{busy===email?'Opening Google…':'Connect Gmail'}</Button>}</div>
  </Card>})}</div>
  <div className="notice"><ShieldCheck/><span><strong>satavue.com stays excluded.</strong> Connect each outreach mailbox with its own Google login. Aliases do not create independent mailboxes.</span></div>
  <Card className="panel settings-panel"><h2>What this connection allows</h2><p>Google will ask for your email identity and permission to send mail. Tokens are encrypted on the server. This version does not send messages, read your inbox or run warm-up activity. Connecting does not check SPF, DKIM, DMARC or inbox placement.</p><p>To remove Google’s authorization completely, also remove Creative OS in your Google Account’s third-party connections.</p></Card>
  <Dialog open={!!disconnect} onOpenChange={v=>{if(!v&&!busy)setDisconnect(null);}}><DialogContent><DialogHeader><DialogTitle>Disconnect Gmail?</DialogTitle><DialogDescription>This deletes Creative OS’s saved access for {disconnect}. Your emails and leads stay in place. Google’s authorization remains until you remove it in your Google Account.</DialogDescription></DialogHeader><div className="actions"><Button variant="outline" disabled={!!busy} onClick={()=>setDisconnect(null)}>Cancel</Button><Button disabled={!!busy} onClick={()=>act('disconnect',disconnect)}>{busy?'Disconnecting…':'Disconnect mailbox'}</Button></div></DialogContent></Dialog>
 </>;
}
