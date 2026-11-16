-- Opt-in first-contact scheduling. No job or external connection is activated here.
begin;
grant select on public.creative_os_workspaces to service_role;
alter table public.creative_os_gmail_oauth_states add column reply_access boolean not null default false;
create table public.creative_os_mailbox_settings (
 owner_id uuid not null references auth.users(id) on delete cascade,
 mailbox text not null check(mailbox in ('sagorika@satavuestudio.com','sagorika@withsatavue.com')),
 enabled boolean not null default false,
 daily_limit integer not null default 10 check(daily_limit between 1 and 15),
 last_run_at timestamptz,
 last_error text,
 primary key(owner_id,mailbox)
);
create table public.creative_os_worker_heartbeat (
 id boolean primary key default true check(id),
 checked_at timestamptz not null default now()
);
alter table public.creative_os_worker_heartbeat enable row level security;
revoke all on public.creative_os_worker_heartbeat from public,anon,authenticated;
grant select,insert,update on public.creative_os_worker_heartbeat to service_role;
create table public.creative_os_send_queue (
 outbox_id uuid primary key references public.creative_os_outbox(id) on delete cascade,
 owner_id uuid not null references auth.users(id) on delete cascade,
 scheduled_at timestamptz not null,
 timezone text not null,
 approved_at timestamptz not null default now(),
 checked_at timestamptz,
 state text not null default 'scheduled' check(state in ('scheduled','processing','sent','unknown','blocked','cancelled','replied','missed')),
 reason text,
 updated_at timestamptz not null default now()
);
create index creative_os_queue_due on public.creative_os_send_queue(scheduled_at) where state='scheduled';
alter table public.creative_os_mailbox_settings enable row level security;
alter table public.creative_os_send_queue enable row level security;
revoke all on public.creative_os_mailbox_settings,public.creative_os_send_queue from public,anon,authenticated;
grant select,insert,update,delete on public.creative_os_mailbox_settings,public.creative_os_send_queue to service_role;

create function public.schedule_creative_os_send(p_owner uuid,p_id uuid,p_at timestamptz,p_zone text)
returns void language plpgsql security definer set search_path='' as $$
declare r public.creative_os_outbox; s public.creative_os_mailbox_settings; local_at timestamp;
begin
 select * into r from public.creative_os_outbox where id=p_id and owner_id=p_owner for update;
 if not found or r.status<>'reviewed' then raise exception 'review_missing'; end if;
 if r.reviewed_at<now()-interval '10 minutes' then raise exception 'review_expired'; end if;
 if p_at is null or p_at<now()+interval '2 minutes' or p_at>now()+interval '30 days' then raise exception 'invalid_schedule'; end if;
 if p_zone is null or not exists(select 1 from pg_timezone_names where name=p_zone) then raise exception 'invalid_timezone'; end if;
 local_at=p_at at time zone p_zone;
 if extract(isodow from local_at)>5 or local_at::time<time '09:00' or local_at::time>=time '17:00' then raise exception 'outside_window'; end if;
 perform pg_advisory_xact_lock(hashtextextended(r.mailbox,0));
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text||r.recipient,1));
 if exists(select 1 from public.creative_os_suppressions where owner_id=p_owner and email=r.recipient) then raise exception 'recipient_suppressed'; end if;
 if not exists(select 1 from public.creative_os_gmail_connections where owner_id=p_owner and email=r.mailbox and 'https://www.googleapis.com/auth/gmail.readonly'=any(scopes)) then raise exception 'reply_permission_required'; end if;
 insert into public.creative_os_mailbox_settings(owner_id,mailbox) values(p_owner,r.mailbox) on conflict do nothing;
 select * into s from public.creative_os_mailbox_settings where owner_id=p_owner and mailbox=r.mailbox;
 if exists(select 1 from public.creative_os_outbox where owner_id=p_owner and recipient=r.recipient and attempted_at is not null) then raise exception 'initial_contact_only'; end if;
 if exists(select 1 from public.creative_os_send_queue q join public.creative_os_outbox o on o.id=q.outbox_id where q.owner_id=p_owner and o.recipient=r.recipient and q.state not in ('cancelled','missed','blocked')) then raise exception 'contact_already_queued'; end if;
 if exists(select 1 from public.creative_os_send_queue q join public.creative_os_outbox o on o.id=q.outbox_id where o.mailbox=r.mailbox and q.state in ('scheduled','processing') and abs(extract(epoch from (q.scheduled_at-p_at)))<1800) then raise exception 'schedule_spacing'; end if;
 if (select count(*) from public.creative_os_send_queue q join public.creative_os_outbox o on o.id=q.outbox_id where o.mailbox=r.mailbox and q.state not in ('cancelled','blocked','missed') and (q.scheduled_at at time zone p_zone)::date=local_at::date)>=s.daily_limit then raise exception 'schedule_limit'; end if;
 insert into public.creative_os_send_queue(outbox_id,owner_id,scheduled_at,timezone) values(p_id,p_owner,p_at,p_zone) on conflict(outbox_id) do update set scheduled_at=excluded.scheduled_at,timezone=excluded.timezone,approved_at=now(),checked_at=null,state='scheduled',reason=null,updated_at=now() where creative_os_send_queue.state in ('cancelled','missed','blocked');
end;
$$;

create function public.claim_creative_os_scheduled(p_owner uuid,p_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare q public.creative_os_send_queue; r public.creative_os_outbox; s public.creative_os_mailbox_settings; result jsonb; local_now timestamp;
begin
 select * into q from public.creative_os_send_queue where owner_id=p_owner and outbox_id=p_id for update;
 if not found or q.state<>'scheduled' then raise exception 'already_attempted'; end if;
 if q.scheduled_at>now() then raise exception 'not_due'; end if;
 if q.scheduled_at<now()-interval '15 minutes' then raise exception 'schedule_missed'; end if;
 select * into r from public.creative_os_outbox where id=p_id and owner_id=p_owner for update;
 perform pg_advisory_xact_lock(hashtextextended(r.mailbox,0));
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text||r.recipient,1));
 select * into s from public.creative_os_mailbox_settings where owner_id=p_owner and mailbox=r.mailbox for update;
 if not found or not s.enabled then raise exception 'mailbox_paused'; end if;
 if not exists(select 1 from public.creative_os_gmail_connections where owner_id=p_owner and email=r.mailbox and 'https://www.googleapis.com/auth/gmail.readonly'=any(scopes)) then raise exception 'reply_permission_required'; end if;
 if q.checked_at is null or q.checked_at<now()-interval '2 minutes' or q.checked_at<q.approved_at then raise exception 'reply_check_required'; end if;
 local_now=now() at time zone q.timezone;
 if extract(isodow from local_now)>5 or local_now::time<time '09:00' or local_now::time>=time '17:00' then raise exception 'outside_window'; end if;
 if exists(select 1 from public.creative_os_outbox where owner_id=p_owner and recipient=r.recipient and attempted_at is not null) then raise exception 'initial_contact_only'; end if;
 if (select count(*) from public.creative_os_outbox where mailbox=r.mailbox and attempted_at>now()-interval '24 hours')>=s.daily_limit then raise exception 'daily_limit'; end if;
 if exists(select 1 from public.creative_os_outbox where mailbox=r.mailbox and attempted_at>now()-interval '30 minutes') then raise exception 'spacing_limit'; end if;
 -- The approved snapshot remains immutable; existing claim rechecks current lead,
 -- suppression, sender scope, attempt cap and at-most-once status atomically.
 update public.creative_os_outbox set reviewed_at=now() where id=p_id;
 perform set_config('creative_os.queue_claim',p_id::text,true);
 result=public.claim_creative_os_send(p_owner,p_id);
 update public.creative_os_send_queue set state='processing',updated_at=now() where outbox_id=p_id;
 update public.creative_os_mailbox_settings set last_run_at=now(),last_error=null where owner_id=p_owner and mailbox=r.mailbox;
 return result;
end;
$$;
revoke all on function public.schedule_creative_os_send(uuid,uuid,timestamptz,text),public.claim_creative_os_scheduled(uuid,uuid) from public,anon,authenticated;
grant execute on function public.schedule_creative_os_send(uuid,uuid,timestamptz,text),public.claim_creative_os_scheduled(uuid,uuid) to service_role;
-- Keep manual send routes from dispatching a queued snapshot ahead of its schedule.
alter function public.claim_creative_os_send(uuid,uuid) rename to claim_creative_os_send_base;
revoke all on function public.claim_creative_os_send_base(uuid,uuid) from public,anon,authenticated,service_role;
create function public.claim_creative_os_send(p_owner uuid,p_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.creative_os_outbox; cap integer;
begin
 select * into r from public.creative_os_outbox where id=p_id and owner_id=p_owner for update;
 if not found then raise exception 'review_missing'; end if;
 if exists(select 1 from public.creative_os_send_queue where outbox_id=p_id and state in ('scheduled','processing')) and current_setting('creative_os.queue_claim',true) is distinct from p_id::text then raise exception 'scheduled_use_queue'; end if;
 perform pg_advisory_xact_lock(hashtextextended(r.mailbox,0));
 select daily_limit into cap from public.creative_os_mailbox_settings where owner_id=p_owner and mailbox=r.mailbox;
 if cap is not null and (select count(*) from public.creative_os_outbox where mailbox=r.mailbox and attempted_at>now()-interval '24 hours')>=cap then raise exception 'daily_limit'; end if;
 return public.claim_creative_os_send_base(p_owner,p_id);
end;
$$;
revoke all on function public.claim_creative_os_send(uuid,uuid) from public,anon,authenticated;
grant execute on function public.claim_creative_os_send(uuid,uuid) to service_role;
create function public.next_creative_os_scheduled()
returns jsonb language sql security definer set search_path='' as $$
 select to_jsonb(q)||jsonb_build_object('message',to_jsonb(o))
 from public.creative_os_send_queue q join public.creative_os_outbox o on o.id=q.outbox_id
 join public.creative_os_mailbox_settings s on s.owner_id=q.owner_id and s.mailbox=o.mailbox
 where q.state='scheduled' and q.scheduled_at<=now() and s.enabled
 and not exists(select 1 from public.creative_os_outbox x where x.mailbox=o.mailbox and x.attempted_at>now()-interval '30 minutes')
 and (select count(*) from public.creative_os_outbox x where x.mailbox=o.mailbox and x.attempted_at>now()-interval '24 hours')<s.daily_limit
 order by q.scheduled_at limit 1;
$$;
revoke all on function public.next_creative_os_scheduled() from public,anon,authenticated;
grant execute on function public.next_creative_os_scheduled() to service_role;
-- Suggest, but do not reserve or approve, the next available business-time slot.
create function public.plan_creative_os_slot(p_owner uuid,p_mailbox text,p_zone text)
returns timestamptz language plpgsql security definer set search_path='' as $$
declare candidate timestamptz; local_at timestamp; cap integer;
begin
 if p_mailbox not in ('sagorika@satavuestudio.com','sagorika@withsatavue.com') then raise exception 'mailbox_disconnected'; end if;
 if p_zone is null or not exists(select 1 from pg_timezone_names where name=p_zone) then raise exception 'invalid_timezone'; end if;
 if not exists(select 1 from public.creative_os_gmail_connections where owner_id=p_owner and email=p_mailbox and 'https://www.googleapis.com/auth/gmail.readonly'=any(scopes)) then raise exception 'reply_permission_required'; end if;
 select daily_limit into cap from public.creative_os_mailbox_settings where owner_id=p_owner and mailbox=p_mailbox;
 cap=coalesce(cap,10);
 candidate=to_timestamp(ceil(extract(epoch from (now()+interval '2 minutes'))/1800)*1800);
 while candidate<=now()+interval '30 days' loop
  local_at=candidate at time zone p_zone;
  if extract(isodow from local_at)<=5 and local_at::time>=time '09:00' and local_at::time<time '17:00'
   and not exists(select 1 from public.creative_os_send_queue q join public.creative_os_outbox o on o.id=q.outbox_id where o.mailbox=p_mailbox and q.state in ('scheduled','processing') and abs(extract(epoch from (q.scheduled_at-candidate)))<1800)
   and (select count(*) from public.creative_os_send_queue q join public.creative_os_outbox o on o.id=q.outbox_id where o.mailbox=p_mailbox and q.state not in ('cancelled','blocked','missed') and (q.scheduled_at at time zone p_zone)::date=local_at::date)<cap
   and (select count(*) from public.creative_os_outbox where mailbox=p_mailbox and attempted_at>candidate-interval '24 hours')<cap
  then return candidate; end if;
  candidate=candidate+interval '30 minutes';
 end loop;
 raise exception 'schedule_limit';
end;
$$;
revoke all on function public.plan_creative_os_slot(uuid,text,text) from public,anon,authenticated;
grant execute on function public.plan_creative_os_slot(uuid,text,text) to service_role;
create function public.expire_creative_os_queue()
returns integer language plpgsql security definer set search_path='' as $$
declare expired integer;
begin
 update public.creative_os_send_queue set state='missed',reason='schedule_missed',updated_at=now()
 where state='scheduled' and scheduled_at<now()-interval '15 minutes';
 get diagnostics expired=row_count;
 return expired;
end;
$$;
revoke all on function public.expire_creative_os_queue() from public,anon,authenticated;
grant execute on function public.expire_creative_os_queue() to service_role;
commit;
