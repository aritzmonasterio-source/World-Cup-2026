alter table public.matches
  add column if not exists tv_channel_es text not null default 'DAZN / Canal Mediapro';

update public.profiles
set role = 'admin',
    status = 'approved',
    updated_at = now()
where lower(email) = 'aritzmonasterio@gmail.com';

insert into public.community_memberships (user_id, community_id, role, status)
select p.id, c.id, 'admin', 'approved'
from public.profiles p
cross join public.communities c
where lower(p.email) = 'aritzmonasterio@gmail.com'
on conflict (user_id, community_id) do update set
  role = 'admin',
  status = 'approved',
  updated_at = now();

create or replace function public.infer_tv_channel_es(
  match_number integer,
  round_number integer,
  home_team_code text,
  away_team_code text
)
returns text
language sql
immutable
as $$
  select case
    when match_number = 1 then 'RTVE + DAZN / Canal Mediapro'
    when home_team_code = 'ESP' or away_team_code = 'ESP' then 'RTVE + DAZN / Canal Mediapro'
    when coalesce(round_number, 0) >= 5 then 'RTVE + DAZN / Canal Mediapro'
    else 'DAZN / Canal Mediapro'
  end;
$$;

update public.matches
set tv_channel_es = public.infer_tv_channel_es(match_number, round_number, home_team_code, away_team_code)
where tv_channel_es is null
   or tv_channel_es = 'DAZN / Canal Mediapro'
   or tv_channel_es = '';

create or replace function public.recalculate_match_tv_channels()
returns void
language sql
security definer
set search_path = public
as $$
  update public.matches
  set tv_channel_es = public.infer_tv_channel_es(match_number, round_number, home_team_code, away_team_code)
  where tv_channel_es is null
     or tv_channel_es = ''
     or tv_channel_es in ('DAZN / Canal Mediapro', 'RTVE + DAZN / Canal Mediapro');
$$;

select cron.unschedule('sync-fifa-world-cup-2026')
where exists (select 1 from cron.job where jobname = 'sync-fifa-world-cup-2026');

do $$
begin
  if to_regclass('vault.decrypted_secrets') is not null
    and exists (select 1 from vault.decrypted_secrets where name = 'project_url')
    and exists (select 1 from vault.decrypted_secrets where name = 'publishable_key')
  then
    perform cron.schedule(
      'sync-fifa-world-cup-2026',
      '*/5 * * * *',
      $job$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/sync-fifa-matches',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'publishable_key')
        ),
        body := '{}'::jsonb
      );
      $job$
    );
  end if;
end $$;
