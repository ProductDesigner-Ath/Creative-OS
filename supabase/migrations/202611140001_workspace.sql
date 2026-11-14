-- Private per-user prototype workspace. Run once in Supabase SQL Editor.
-- No Gmail tokens, secrets or provider credentials belong in this document.
begin;
create table public.creative_os_workspaces (
 owner_id uuid primary key references auth.users(id) on delete cascade,
 document jsonb not null,
 revision integer not null default 1 check (revision > 0),
 updated_at timestamptz not null default now(),
 constraint valid_workspace check (
  jsonb_typeof(document) = 'object' and document->>'version' = '1'
  and jsonb_typeof(document->'leads') = 'array'
  and jsonb_typeof(document->'tags') = 'array'
  and jsonb_typeof(document->'systems') = 'array'
  and jsonb_typeof(document->'events') = 'array'
  and document ?& array['version','leads','tags','systems','events']
  and octet_length(document::text) <= 8388608
 )
);
alter table public.creative_os_workspaces enable row level security;
revoke all on public.creative_os_workspaces from public, anon, authenticated;
grant select on public.creative_os_workspaces to authenticated;
create policy own_workspace_read on public.creative_os_workspaces
 for select to authenticated using (owner_id = (select auth.uid()));
-- Only the RPC below may write, so clients cannot bypass revision checks.
create function public.save_creative_os_workspace(p_document jsonb,p_expected_revision integer)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_revision integer;
begin
 if v_user is null then raise exception 'authentication_required' using errcode='42501'; end if;
 if p_expected_revision is null or p_expected_revision < 0 then raise exception 'invalid_revision'; end if;
 if p_document is null then raise exception 'invalid_workspace'; end if;
 if p_expected_revision = 0 then
  insert into public.creative_os_workspaces(owner_id,document) values(v_user,p_document)
  on conflict(owner_id) do nothing returning revision into v_revision;
 else
  update public.creative_os_workspaces set document=p_document,revision=revision+1,updated_at=now()
  where owner_id=v_user and revision=p_expected_revision returning revision into v_revision;
 end if;
 if v_revision is null then raise exception 'workspace_conflict' using errcode='40001'; end if;
 return v_revision;
end;
$$;
revoke all on function public.save_creative_os_workspace(jsonb,integer) from public,anon;
grant execute on function public.save_creative_os_workspace(jsonb,integer) to authenticated;
commit;
