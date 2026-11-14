// Only public configuration belongs in VITE_ variables.
export function cloudConfig(env,hostname){
 const url=env.VITE_SUPABASE_URL?.trim(),key=env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
 const local=['localhost','127.0.0.1','::1'].includes(hostname);
 if(!url&&!key&&local)return {mode:'local'};
 if(!url||!key)return {mode:'error',message:'Cloud connection is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in the hosting environment, then redeploy.'};
 try{const u=new URL(url);if(u.protocol!=='https:'||u.pathname!=='/'||u.search||u.hash||u.username||u.password)throw Error();}catch{return {mode:'error',message:'Use the HTTPS Supabase Project URL without /rest/v1/.'};}
 if(!key.startsWith('sb_publishable_'))return {mode:'error',message:'Use a Supabase publishable key. Never place a secret or service_role key in frontend configuration.'};
 return {mode:'cloud',url,key};
}
export function emptyWorkspace(){return {version:1,sample:false,leads:[],tags:[],systems:[],events:[]};}
export async function readWorkspace(client,userId){
 const {data,error}=await client.from('creative_os_workspaces').select('document,revision').eq('owner_id',userId).maybeSingle();
 if(error)throw error;
 return data||{document:emptyWorkspace(),revision:0};
}
export async function writeWorkspace(client,document,revision){
 const {data,error}=await client.rpc('save_creative_os_workspace',{p_document:document,p_expected_revision:revision});
 if(error)throw error;
 if(!Number.isSafeInteger(data)||data<1)throw new Error('The server returned an invalid workspace revision.');
 return data;
}
