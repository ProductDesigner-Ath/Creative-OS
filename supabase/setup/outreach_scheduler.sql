-- Optional activation, AFTER the queue migration and deployment.
-- Enable pg_cron and pg_net through Supabase Database > Extensions first.
-- In Supabase Vault create these TWO secrets privately (do not paste into Git):
-- creative_os_app_url = your HTTPS APP_URL, without trailing slash
-- creative_os_queue_worker_secret = the SAME random secret set in Vercel
-- AUTOMATED_SENDING_ENABLED must remain unset until a real test is authorized.
do $$
begin
 if not exists(select 1 from vault.decrypted_secrets where name='creative_os_app_url' and decrypted_secret like 'https://%') or
    not exists(select 1 from vault.decrypted_secrets where name='creative_os_queue_worker_secret' and length(decrypted_secret)>=32) then
  raise exception 'Create the app URL and worker secret in Vault before scheduling.';
 end if;
end;
$$;
select cron.schedule(
 'creative-os-approved-outreach',
 '* * * * *',
 $job$
 select net.http_post(
  url:=(select decrypted_secret from vault.decrypted_secrets where name='creative_os_app_url')||'/api/queue/tick',
  headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='creative_os_queue_worker_secret')),
  body:='{}'::jsonb,
  timeout_milliseconds:=50000
 );
 $job$
);
-- To stop ticks, run: select cron.unschedule('creative-os-approved-outreach');
-- Each mailbox also has a separate Pause control in Creative OS.
