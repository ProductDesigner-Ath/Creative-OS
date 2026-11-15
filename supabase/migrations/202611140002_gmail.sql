-- Server-only Gmail credentials. No client role may access either table.
begin;
create table public.creative_os_gmail_connections (
 owner_id uuid not null references auth.users(id) on delete cascade,
 email text not null check(email in ('sagorika@satavuestudio.com','sagorika@withsatavue.com')),
 refresh_token text not null,
 scopes text[] not null,
 connected_at timestamptz not null default now(),
 checked_at timestamptz,
 primary key(owner_id,email)
);
create table public.creative_os_gmail_oauth_states (
 state_hash text primary key,
 owner_id uuid not null references auth.users(id) on delete cascade,
 email text not null check(email in ('sagorika@satavuestudio.com','sagorika@withsatavue.com')),
 verifier text not null,
 expires_at timestamptz not null
);
alter table public.creative_os_gmail_connections enable row level security;
alter table public.creative_os_gmail_oauth_states enable row level security;
revoke all on public.creative_os_gmail_connections,public.creative_os_gmail_oauth_states from public,anon,authenticated;
grant select,insert,update,delete on public.creative_os_gmail_connections,public.creative_os_gmail_oauth_states to service_role;
commit;
