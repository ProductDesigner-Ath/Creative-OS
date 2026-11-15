begin;
create table public.creative_os_suppressions (
 owner_id uuid not null references auth.users(id) on delete cascade,
 email text not null check(email=lower(email)),
 reason text not null check(reason in ('Unsubscribed','Bounced','Do not contact')),
 created_at timestamptz not null default now(),
 primary key(owner_id,email)
);
create table public.creative_os_outbox (
 id uuid primary key,
 owner_id uuid not null references auth.users(id) on delete cascade,
 lead_id text not null,
 mailbox text not null check(mailbox in ('sagorika@satavuestudio.com','sagorika@withsatavue.com')),
 recipient text not null check(recipient=lower(recipient)),
 subject text not null,
 body text not null,
 source_body text not null,
 fingerprint text not null,
 unsubscribe_hash text not null unique,
 status text not null default 'reviewed' check(status in ('reviewed','sending','sent','failed','unknown')),
 reviewed_at timestamptz not null default now(),
 attempted_at timestamptz,
 finished_at timestamptz,
 provider_id text,
 unique(owner_id,fingerprint)
);
create index creative_os_outbox_limit on public.creative_os_outbox(mailbox,attempted_at);
alter table public.creative_os_suppressions enable row level security;
alter table public.creative_os_outbox enable row level security;
revoke all on public.creative_os_suppressions,public.creative_os_outbox from public,anon,authenticated;
grant select,insert,update,delete on public.creative_os_suppressions,public.creative_os_outbox to service_role;

-- Only the trusted server can claim a reviewed message. Claims are atomic across tabs.
create function public.claim_creative_os_send(p_owner uuid,p_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.creative_os_outbox; l jsonb; w jsonb;
begin
 select * into r from public.creative_os_outbox where id=p_id and owner_id=p_owner for update;
 if not found then raise exception 'review_missing'; end if;
 if r.status<>'reviewed' then raise exception 'already_attempted'; end if;
 if r.reviewed_at<now()-interval '10 minutes' then raise exception 'review_expired'; end if;
 perform pg_advisory_xact_lock(hashtextextended(r.mailbox,0));
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text||r.recipient,1));
 if exists(select 1 from public.creative_os_suppressions where owner_id=p_owner and email=r.recipient) then raise exception 'recipient_suppressed'; end if;
 if not exists(select 1 from public.creative_os_gmail_connections where owner_id=p_owner and email=r.mailbox and 'https://www.googleapis.com/auth/gmail.send'=any(scopes)) then raise exception 'mailbox_disconnected'; end if;
 select document into w from public.creative_os_workspaces where owner_id=p_owner;
 select value into l from jsonb_array_elements(w->'leads') where value->>'id'=r.lead_id;
 if l is null or lower(trim(l->>'email')) is distinct from r.recipient or l->>'subject' is distinct from r.subject or l->>'body' is distinct from r.source_body then raise exception 'draft_changed'; end if;
 if coalesce(l->>'emailStage','') not in ('Approved to send','Follow-up due') or coalesce(l->>'status','') in ('Lost','Skipped','Won') then raise exception 'lead_not_approved'; end if;
 if (select count(*) from public.creative_os_outbox where mailbox=r.mailbox and attempted_at>now()-interval '24 hours')>=20 then raise exception 'daily_limit'; end if;
 if exists(select 1 from public.creative_os_outbox where mailbox=r.mailbox and attempted_at>now()-interval '60 seconds') then raise exception 'spacing_limit'; end if;
 update public.creative_os_outbox set status='sending',attempted_at=now() where id=r.id returning * into r;
 return to_jsonb(r);
end;
$$;
revoke all on function public.claim_creative_os_send(uuid,uuid) from public,anon,authenticated;
grant execute on function public.claim_creative_os_send(uuid,uuid) to service_role;

-- One-way suppression, independent of editable leads/tags/imports. No unsuppress API.
create function public.suppress_creative_os_contact(p_owner uuid,p_email text,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text||lower(p_email),1));
 insert into public.creative_os_suppressions(owner_id,email,reason) values(p_owner,lower(p_email),p_reason)
 on conflict(owner_id,email) do nothing;
end;
$$;
revoke all on function public.suppress_creative_os_contact(uuid,text,text) from public,anon,authenticated;
grant execute on function public.suppress_creative_os_contact(uuid,text,text) to service_role;
commit;
