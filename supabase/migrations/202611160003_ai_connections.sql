begin;
create table public.creative_os_ai_connections (
 owner_id uuid not null references auth.users(id) on delete cascade,
 provider text not null check(provider in ('openai','anthropic','higgsfield')),
 credential text not null, model text not null default '', revision integer not null default 1,
 checked_at timestamptz not null, updated_at timestamptz not null default now(),
 primary key(owner_id,provider), check(octet_length(credential)<=8192 and length(model)<=128)
);
alter table public.creative_os_ai_connections enable row level security;
revoke all on public.creative_os_ai_connections from public,anon,authenticated;
grant select,insert,update,delete on public.creative_os_ai_connections to service_role;
alter table public.creative_os_assistant_conversations add column provider text not null default 'openai' check(provider in ('openai','anthropic'));
alter table public.creative_os_assistant_conversations add column model text;
create function public.save_creative_os_ai_connection(p_owner uuid,p_provider text,p_credential text,p_model text,p_revision integer)
returns void language plpgsql security definer set search_path='' as $$
declare changed integer;
begin
 if p_revision=0 then
  insert into public.creative_os_ai_connections(owner_id,provider,credential,model,checked_at) values(p_owner,p_provider,p_credential,p_model,now()) on conflict do nothing;
 else
  update public.creative_os_ai_connections set credential=p_credential,model=p_model,checked_at=now(),updated_at=now(),revision=revision+1 where owner_id=p_owner and provider=p_provider and revision=p_revision;
 end if;
 get diagnostics changed=row_count;
 if changed<>1 then raise exception 'connection_conflict';end if;
end;
$$;
revoke all on function public.save_creative_os_ai_connection(uuid,text,text,text,integer) from public,anon,authenticated;
grant execute on function public.save_creative_os_ai_connection(uuid,text,text,text,integer) to service_role;
commit;
notify pgrst,'reload schema';
