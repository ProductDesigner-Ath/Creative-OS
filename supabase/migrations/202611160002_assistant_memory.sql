-- Private assistant data is separate from the revisioned workspace document.
begin;
grant select on public.creative_os_workspaces to service_role;
create table public.creative_os_assistant_conversations (
 id uuid primary key, owner_id uuid not null references auth.users(id) on delete cascade,
 scope_type text not null check(scope_type in ('studio','project','lead')), scope_id text not null default '',
 title text not null check(length(title) between 1 and 120), state text not null default 'active' check(state in ('active','deleting')),
 active_turn uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(id,owner_id), check((scope_type='studio' and scope_id='') or (scope_type<>'studio' and length(scope_id) between 1 and 200))
);
create table public.creative_os_assistant_messages (
 id uuid primary key, conversation_id uuid not null, owner_id uuid not null,
 role text not null check(role in ('user','assistant')), content text not null check(octet_length(content)<=20000),
 status text not null default 'complete' check(status in ('pending','complete','failed')),
 attachment_ids uuid[] not null default '{}', proposal jsonb, request_id uuid,
 created_at timestamptz not null default now(),
 foreign key(conversation_id,owner_id) references public.creative_os_assistant_conversations(id,owner_id) on delete cascade,
 check(cardinality(attachment_ids)<=3), check(proposal is null or octet_length(proposal::text)<=30000)
);
create unique index creative_os_assistant_user_request on public.creative_os_assistant_messages(owner_id,request_id) where role='user';
create index creative_os_assistant_history on public.creative_os_assistant_messages(conversation_id,created_at,id);
create index creative_os_assistant_search on public.creative_os_assistant_messages using gin(to_tsvector('simple',content));
create table public.creative_os_assistant_memory (
 owner_id uuid not null references auth.users(id) on delete cascade, scope_type text not null check(scope_type in ('studio','project','lead')),
 scope_id text not null default '', body text not null check(octet_length(body)<=12000), revision integer not null default 1,
 updated_at timestamptz not null default now(), primary key(owner_id,scope_type,scope_id),
 check((scope_type='studio' and scope_id='') or (scope_type<>'studio' and length(scope_id) between 1 and 200))
);
create table public.creative_os_assistant_files (
 id uuid primary key, conversation_id uuid not null, owner_id uuid not null,
 path text not null unique, name text not null check(length(name) between 1 and 255), mime text not null,
 size bigint not null check(size between 1 and 5242880), sha256 text,
 status text not null default 'pending' check(status in ('pending','ready','deleting')),
 extracted_text text not null default '', summary text not null default '', created_at timestamptz not null default now(),
 foreign key(conversation_id,owner_id) references public.creative_os_assistant_conversations(id,owner_id) on delete cascade,
 check(mime in ('text/plain','text/markdown','text/csv','application/pdf','image/png','image/jpeg','image/webp')),
 check(octet_length(extracted_text)<=65536 and octet_length(summary)<=8000)
);
alter table public.creative_os_assistant_conversations enable row level security;
alter table public.creative_os_assistant_messages enable row level security;
alter table public.creative_os_assistant_memory enable row level security;
alter table public.creative_os_assistant_files enable row level security;
revoke all on public.creative_os_assistant_conversations,public.creative_os_assistant_messages,public.creative_os_assistant_memory,public.creative_os_assistant_files from public,anon,authenticated;
grant select,insert,update,delete on public.creative_os_assistant_conversations,public.creative_os_assistant_messages,public.creative_os_assistant_memory,public.creative_os_assistant_files to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('creative-os-assistant','creative-os-assistant',false,5242880,array['text/plain','text/markdown','text/csv','application/pdf','image/png','image/jpeg','image/webp']) on conflict(id) do nothing;
do $$begin if exists(select 1 from storage.buckets where id='creative-os-assistant' and public) then raise exception 'assistant_bucket_must_be_private';end if;end$$;

create function public.start_creative_os_assistant_turn(p_owner uuid,p_conversation uuid,p_request uuid,p_content text,p_files uuid[])
returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.creative_os_assistant_conversations; existing public.creative_os_assistant_messages;
begin
 select * into c from public.creative_os_assistant_conversations where id=p_conversation and owner_id=p_owner and state='active' for update;
 if not found then raise exception 'conversation_missing';end if;
 select * into existing from public.creative_os_assistant_messages where owner_id=p_owner and request_id=p_request and role='user';
 if found then
  if existing.conversation_id<>p_conversation or existing.content is distinct from p_content or existing.attachment_ids is distinct from p_files then raise exception 'request_mismatch';end if;
  return jsonb_build_object('created',false,'status',existing.status);
 end if;
 if p_content is null or octet_length(p_content)>20000 or (length(trim(p_content))=0 and cardinality(p_files)=0) or p_files is null or cardinality(p_files)>3 then raise exception 'invalid_message';end if;
 if c.active_turn is not null then
  if exists(select 1 from public.creative_os_assistant_messages where id=c.active_turn and status='pending' and created_at>now()-interval '2 minutes') then raise exception 'conversation_busy';end if;
  update public.creative_os_assistant_messages set status='failed' where id=c.active_turn and owner_id=p_owner and status='pending';
 end if;
 if (select count(*) from public.creative_os_assistant_messages where conversation_id=p_conversation)>=2000 then raise exception 'conversation_full';end if;
 if (select count(*) from public.creative_os_assistant_files where id=any(p_files) and owner_id=p_owner and conversation_id=p_conversation and status='ready')<>cardinality(p_files) then raise exception 'attachment_missing';end if;
 insert into public.creative_os_assistant_messages(id,conversation_id,owner_id,role,content,status,request_id,attachment_ids) values(p_request,p_conversation,p_owner,'user',p_content,'pending',p_request,p_files);
 update public.creative_os_assistant_conversations set active_turn=p_request,updated_at=now() where id=p_conversation;
 return jsonb_build_object('created',true,'status','pending');
end;
$$;
create function public.finish_creative_os_assistant_turn(p_owner uuid,p_conversation uuid,p_request uuid,p_reply_id uuid,p_reply text,p_proposal jsonb)
returns void language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.creative_os_assistant_conversations where id=p_conversation and owner_id=p_owner and state='active' and active_turn=p_request for update;
 if not found then raise exception 'turn_inactive';end if;
 if not exists(select 1 from public.creative_os_assistant_messages where id=p_request and conversation_id=p_conversation and owner_id=p_owner and role='user' and status='pending') then raise exception 'turn_inactive';end if;
 insert into public.creative_os_assistant_messages(id,conversation_id,owner_id,role,content,request_id,proposal) values(p_reply_id,p_conversation,p_owner,'assistant',p_reply,p_request,p_proposal);
 update public.creative_os_assistant_messages set status='complete' where id=p_request;
 update public.creative_os_assistant_conversations set active_turn=null,updated_at=now() where id=p_conversation;
end;
$$;
create function public.fail_creative_os_assistant_turn(p_owner uuid,p_conversation uuid,p_request uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.creative_os_assistant_conversations where id=p_conversation and owner_id=p_owner and active_turn=p_request for update;
 if not found then return;end if;
 update public.creative_os_assistant_messages set status='failed' where id=p_request and owner_id=p_owner and status='pending';
 update public.creative_os_assistant_conversations set active_turn=null where id=p_conversation;
end;
$$;
create function public.save_creative_os_assistant_memory(p_owner uuid,p_type text,p_scope text,p_body text,p_revision integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.creative_os_assistant_memory;
begin
 if p_revision=0 then
  insert into public.creative_os_assistant_memory(owner_id,scope_type,scope_id,body) values(p_owner,p_type,p_scope,p_body) on conflict do nothing returning * into r;
 else
  update public.creative_os_assistant_memory set body=p_body,revision=revision+1,updated_at=now() where owner_id=p_owner and scope_type=p_type and scope_id=p_scope and revision=p_revision returning * into r;
 end if;
 if r.owner_id is null then raise exception 'memory_conflict';end if;
 return to_jsonb(r);
end;
$$;
create function public.recall_creative_os_assistant(p_owner uuid,p_type text,p_scope text,p_conversation uuid,p_query text)
returns table(id uuid,conversation_id uuid,content text,role text,scope_type text,scope_id text)
language sql security definer set search_path='' as $$
 select m.id,m.conversation_id,left(m.content,2000),m.role,c.scope_type,c.scope_id
 from public.creative_os_assistant_messages m join public.creative_os_assistant_conversations c on c.id=m.conversation_id and c.owner_id=m.owner_id
 where m.owner_id=p_owner and c.state='active' and m.status='complete' and m.conversation_id<>p_conversation
 and (p_type='studio' or c.scope_type='studio' or (c.scope_type=p_type and c.scope_id=p_scope))
 and to_tsvector('simple',m.content)@@websearch_to_tsquery('simple',left(p_query,500))
 order by ts_rank(to_tsvector('simple',m.content),websearch_to_tsquery('simple',left(p_query,500))) desc,m.created_at desc limit 5;
$$;
revoke all on function public.start_creative_os_assistant_turn(uuid,uuid,uuid,text,uuid[]),public.finish_creative_os_assistant_turn(uuid,uuid,uuid,uuid,text,jsonb),public.fail_creative_os_assistant_turn(uuid,uuid,uuid),public.save_creative_os_assistant_memory(uuid,text,text,text,integer),public.recall_creative_os_assistant(uuid,text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.start_creative_os_assistant_turn(uuid,uuid,uuid,text,uuid[]),public.finish_creative_os_assistant_turn(uuid,uuid,uuid,uuid,text,jsonb),public.fail_creative_os_assistant_turn(uuid,uuid,uuid),public.save_creative_os_assistant_memory(uuid,text,text,text,integer),public.recall_creative_os_assistant(uuid,text,text,uuid,text) to service_role;
create function public.delete_creative_os_assistant_start(p_owner uuid,p_conversation uuid)
returns void language plpgsql security definer set search_path='' as $$
declare c public.creative_os_assistant_conversations;
begin
 select * into c from public.creative_os_assistant_conversations where owner_id=p_owner and id=p_conversation for update;
 if not found then raise exception 'conversation_missing';end if;
 if c.active_turn is not null and exists(select 1 from public.creative_os_assistant_messages where id=c.active_turn and status='pending' and created_at>now()-interval '2 minutes') then raise exception 'conversation_busy';end if;
 if exists(select 1 from public.creative_os_assistant_files where conversation_id=p_conversation and created_at>now()-interval '2 hours') then raise exception 'uploads_pending';end if;
 update public.creative_os_assistant_conversations set state='deleting',active_turn=null where owner_id=p_owner and id=p_conversation;
end;
$$;
revoke all on function public.delete_creative_os_assistant_start(uuid,uuid) from public,anon,authenticated;
grant execute on function public.delete_creative_os_assistant_start(uuid,uuid) to service_role;
create function public.reserve_creative_os_assistant_file(p_owner uuid,p_conversation uuid,p_id uuid,p_path text,p_name text,p_mime text,p_size bigint)
returns void language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.creative_os_assistant_conversations where owner_id=p_owner and id=p_conversation and state='active' for update;
 if not found then raise exception 'conversation_missing';end if;
 if (select count(*) from public.creative_os_assistant_files where conversation_id=p_conversation)>=100 then raise exception 'file_limit';end if;
 insert into public.creative_os_assistant_files(id,owner_id,conversation_id,path,name,mime,size) values(p_id,p_owner,p_conversation,p_path,p_name,p_mime,p_size);
end;
$$;
revoke all on function public.reserve_creative_os_assistant_file(uuid,uuid,uuid,text,text,text,bigint) from public,anon,authenticated;
grant execute on function public.reserve_creative_os_assistant_file(uuid,uuid,uuid,text,text,text,bigint) to service_role;
commit;
notify pgrst,'reload schema';
