insert into public.communities (id, name, theme) values
  ('electric-league', 'Crossfit 7AM', 'crossfit-7am')
on conflict (id) do update set
  name = excluded.name,
  theme = excluded.theme;

alter table public.community_memberships
  add column if not exists previous_rank integer,
  add column if not exists current_rank integer;

alter table public.point_events
  add column if not exists community_id text not null default 'dimension-football' references public.communities(id);

create table if not exists public.finalist_predictions (
  user_id uuid not null references public.profiles(id) on delete cascade,
  community_id text not null default 'dimension-football' references public.communities(id) on delete cascade,
  champion_team_id text null,
  champion_team_name text null,
  champion_team_code text null,
  runner_up_team_id text null,
  runner_up_team_name text null,
  runner_up_team_code text null,
  third_team_id text null,
  third_team_name text null,
  third_team_code text null,
  fourth_team_id text null,
  fourth_team_name text null,
  fourth_team_code text null,
  updated_at timestamptz not null default now(),
  primary key (user_id, community_id)
);

create table if not exists public.match_goal_events (
  event_key text primary key,
  match_id text not null references public.matches(id) on delete cascade,
  match_number integer null,
  player_name text not null,
  team_id text null references public.teams(id),
  team_name text null,
  team_code text null,
  minute integer null,
  penalty boolean not null default false,
  own_goal boolean not null default false,
  raw jsonb null,
  updated_at timestamptz not null default now()
);

create index if not exists match_goal_events_match_id_idx on public.match_goal_events(match_id);
create index if not exists match_goal_events_player_name_idx on public.match_goal_events(lower(player_name));
create index if not exists match_goal_events_team_id_idx on public.match_goal_events(team_id);

alter table public.finalist_predictions enable row level security;
alter table public.match_goal_events enable row level security;

drop policy if exists "finalist_predictions_owner_read" on public.finalist_predictions;
create policy "finalist_predictions_owner_read" on public.finalist_predictions
for select to authenticated
using (user_id = auth.uid() or public.is_community_admin(community_id));

drop policy if exists "finalist_predictions_owner_insert" on public.finalist_predictions;
create policy "finalist_predictions_owner_insert" on public.finalist_predictions
for insert to authenticated
with check ((public.is_community_approved(community_id) and user_id = auth.uid()) or public.is_community_admin(community_id));

drop policy if exists "finalist_predictions_owner_update" on public.finalist_predictions;
create policy "finalist_predictions_owner_update" on public.finalist_predictions
for update to authenticated
using (user_id = auth.uid() or public.is_community_admin(community_id))
with check ((public.is_community_approved(community_id) and user_id = auth.uid()) or public.is_community_admin(community_id));

drop policy if exists "match_goal_events_read" on public.match_goal_events;
create policy "match_goal_events_read" on public.match_goal_events
for select to anon, authenticated
using (true);

drop policy if exists "match_goal_events_admin" on public.match_goal_events;
create policy "match_goal_events_admin" on public.match_goal_events
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "player_goals_read" on public.player_goals;
create policy "player_goals_read" on public.player_goals
for select to anon, authenticated
using (true);

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

create or replace function public.recalculate_points()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.point_events;

  insert into public.point_events (user_id, community_id, category, points, ref_type, ref_id, label)
  select
    mp.user_id,
    mp.community_id,
    'groups',
    case
      when mp.home_score = m.home_score and mp.away_score = m.away_score then 15
      when sign(mp.home_score - mp.away_score) = sign(m.home_score - m.away_score) then 8
      else 0
    end,
    'match',
    m.id,
    concat(m.home_team_name, ' vs ', m.away_team_name)
  from public.match_predictions mp
  join public.matches m on m.id = mp.match_id
  where (coalesce(m.round_number, 99) <= 3 or lower(m.phase) like '%group%' or lower(m.phase) like '%grupo%')
    and m.status = 'finished'
    and m.home_score is not null
    and m.away_score is not null
    and (
      mp.home_score = m.home_score and mp.away_score = m.away_score
      or sign(mp.home_score - mp.away_score) = sign(m.home_score - m.away_score)
    );

  insert into public.point_events (user_id, community_id, category, points, ref_type, ref_id, label)
  select
    kp.user_id,
    kp.community_id,
    'knockout',
    10,
    'knockout_match',
    concat(m.id, ':', kp.predicted_home_team_id),
    concat('Equipo acertado en ', m.phase, ': ', kp.predicted_home_team_name)
  from public.knockout_predictions kp
  join public.matches m on m.id = kp.match_id
  where (
      coalesce(m.round_number, 0) >= 4
      or (m.group_code is null and lower(m.phase) not like '%group%' and lower(m.phase) not like '%grupo%')
    )
    and m.home_team_id is not null
    and m.away_team_id is not null
    and kp.predicted_home_team_id is not null
    and kp.predicted_away_team_id is not null
    and (
      (kp.predicted_home_team_id = m.home_team_id and kp.predicted_away_team_id = m.away_team_id)
      or (kp.predicted_home_team_id = m.away_team_id and kp.predicted_away_team_id = m.home_team_id)
    )
    and kp.predicted_home_team_id in (m.home_team_id, m.away_team_id)
  union all
  select
    kp.user_id,
    kp.community_id,
    'knockout',
    10,
    'knockout_match',
    concat(m.id, ':', kp.predicted_away_team_id),
    concat('Equipo acertado en ', m.phase, ': ', kp.predicted_away_team_name)
  from public.knockout_predictions kp
  join public.matches m on m.id = kp.match_id
  where (
      coalesce(m.round_number, 0) >= 4
      or (m.group_code is null and lower(m.phase) not like '%group%' and lower(m.phase) not like '%grupo%')
    )
    and m.home_team_id is not null
    and m.away_team_id is not null
    and kp.predicted_home_team_id is not null
    and kp.predicted_away_team_id is not null
    and (
      (kp.predicted_home_team_id = m.home_team_id and kp.predicted_away_team_id = m.away_team_id)
      or (kp.predicted_home_team_id = m.away_team_id and kp.predicted_away_team_id = m.home_team_id)
    )
    and kp.predicted_away_team_id in (m.home_team_id, m.away_team_id);

  with final_match as (
    select *
    from public.matches
    where (match_number = 104 or lower(phase) = 'final')
      and status = 'finished'
    order by match_number desc nulls last
    limit 1
  ),
  third_place_match as (
    select *
    from public.matches
    where (match_number = 103 or lower(phase) like '%tercer%' or lower(phase) like '%third%')
      and status = 'finished'
    order by match_number desc nulls last
    limit 1
  ),
  final_result as (
    select
      case
        when winner_team_id is not null then winner_team_id
        when coalesce(home_penalty_score, -1) > coalesce(away_penalty_score, -1) then home_team_id
        when coalesce(away_penalty_score, -1) > coalesce(home_penalty_score, -1) then away_team_id
        when home_score > away_score then home_team_id
        when away_score > home_score then away_team_id
        else null
      end winner_id,
      home_team_id,
      away_team_id,
      home_team_name,
      away_team_name
    from final_match
  ),
  third_result as (
    select
      case
        when winner_team_id is not null then winner_team_id
        when coalesce(home_penalty_score, -1) > coalesce(away_penalty_score, -1) then home_team_id
        when coalesce(away_penalty_score, -1) > coalesce(home_penalty_score, -1) then away_team_id
        when home_score > away_score then home_team_id
        when away_score > home_score then away_team_id
        else null
      end winner_id,
      home_team_id,
      away_team_id,
      home_team_name,
      away_team_name
    from third_place_match
  ),
  actual_slots as (
    select
      'champion' slot,
      fr.winner_id team_id,
      case when fr.winner_id = fr.home_team_id then fr.home_team_name else fr.away_team_name end team_name
    from final_result fr
    where fr.winner_id is not null
    union all
    select
      'runner_up',
      case when fr.winner_id = fr.home_team_id then fr.away_team_id else fr.home_team_id end,
      case when fr.winner_id = fr.home_team_id then fr.away_team_name else fr.home_team_name end
    from final_result fr
    where fr.winner_id is not null
    union all
    select
      'third',
      tr.winner_id,
      case when tr.winner_id = tr.home_team_id then tr.home_team_name else tr.away_team_name end
    from third_result tr
    where tr.winner_id is not null
    union all
    select
      'fourth',
      case when tr.winner_id = tr.home_team_id then tr.away_team_id else tr.home_team_id end,
      case when tr.winner_id = tr.home_team_id then tr.away_team_name else tr.home_team_name end
    from third_result tr
    where tr.winner_id is not null
  ),
  predicted_slots as (
    select fp.user_id, fp.community_id, 'champion' slot, fp.champion_team_id team_id, fp.champion_team_name team_name from public.finalist_predictions fp where fp.champion_team_id is not null
    union all
    select fp.user_id, fp.community_id, 'runner_up', fp.runner_up_team_id, fp.runner_up_team_name from public.finalist_predictions fp where fp.runner_up_team_id is not null
    union all
    select fp.user_id, fp.community_id, 'third', fp.third_team_id, fp.third_team_name from public.finalist_predictions fp where fp.third_team_id is not null
    union all
    select fp.user_id, fp.community_id, 'fourth', fp.fourth_team_id, fp.fourth_team_name from public.finalist_predictions fp where fp.fourth_team_id is not null
  )
  insert into public.point_events (user_id, community_id, category, points, ref_type, ref_id, label)
  select distinct
    ps.user_id,
    ps.community_id,
    'knockout',
    case when ps.slot = a.slot then 40 else 25 end,
    'finalist',
    concat(ps.slot, ':', ps.team_id),
    concat('Finalistas: ', coalesce(ps.team_name, a.team_name))
  from predicted_slots ps
  join actual_slots a on a.team_id = ps.team_id;

  with group_finished as (
    select m.group_code
    from public.matches m
    where m.round_number <= 3 and m.group_code is not null
    group by m.group_code
    having count(*) filter (where m.status = 'finished' and m.home_score is not null and m.away_score is not null) >= 6
  ),
  actual_team_rows as (
    select m.group_code, m.home_team_id team_id, m.home_team_name team_name,
      coalesce(sum(m.home_score), 0) gf,
      coalesce(sum(m.away_score), 0) ga,
      coalesce(sum(case when m.home_score > m.away_score then 3 when m.home_score = m.away_score then 1 else 0 end), 0) pts
    from public.matches m
    where m.round_number <= 3 and m.group_code is not null and m.status = 'finished'
    group by m.group_code, m.home_team_id, m.home_team_name
    union all
    select m.group_code, m.away_team_id team_id, m.away_team_name team_name,
      coalesce(sum(m.away_score), 0) gf,
      coalesce(sum(m.home_score), 0) ga,
      coalesce(sum(case when m.away_score > m.home_score then 3 when m.away_score = m.home_score then 1 else 0 end), 0) pts
    from public.matches m
    where m.round_number <= 3 and m.group_code is not null and m.status = 'finished'
    group by m.group_code, m.away_team_id, m.away_team_name
  ),
  actual_table as (
    select
      tr.group_code,
      tr.team_id,
      max(tr.team_name) team_name,
      row_number() over (
        partition by tr.group_code
        order by sum(tr.pts) desc, (sum(tr.gf) - sum(tr.ga)) desc, sum(tr.gf) desc, max(tr.team_name) asc
      ) position
    from actual_team_rows tr
    join group_finished gf on gf.group_code = tr.group_code
    where tr.team_id is not null
    group by tr.group_code, tr.team_id
  ),
  prediction_complete as (
    select mp.user_id, mp.community_id, m.group_code
    from public.match_predictions mp
    join public.matches m on m.id = mp.match_id
    where m.round_number <= 3 and m.group_code is not null
    group by mp.user_id, mp.community_id, m.group_code
    having count(distinct m.id) >= 6
  ),
  predicted_team_rows as (
    select mp.user_id, mp.community_id, m.group_code, m.home_team_id team_id, m.home_team_name team_name,
      coalesce(sum(mp.home_score), 0) gf,
      coalesce(sum(mp.away_score), 0) ga,
      coalesce(sum(case when mp.home_score > mp.away_score then 3 when mp.home_score = mp.away_score then 1 else 0 end), 0) pts
    from public.match_predictions mp
    join public.matches m on m.id = mp.match_id
    join prediction_complete pc on pc.user_id = mp.user_id and pc.community_id = mp.community_id and pc.group_code = m.group_code
    where m.round_number <= 3 and m.group_code is not null
    group by mp.user_id, mp.community_id, m.group_code, m.home_team_id, m.home_team_name
    union all
    select mp.user_id, mp.community_id, m.group_code, m.away_team_id team_id, m.away_team_name team_name,
      coalesce(sum(mp.away_score), 0) gf,
      coalesce(sum(mp.home_score), 0) ga,
      coalesce(sum(case when mp.away_score > mp.home_score then 3 when mp.away_score = mp.home_score then 1 else 0 end), 0) pts
    from public.match_predictions mp
    join public.matches m on m.id = mp.match_id
    join prediction_complete pc on pc.user_id = mp.user_id and pc.community_id = mp.community_id and pc.group_code = m.group_code
    where m.round_number <= 3 and m.group_code is not null
    group by mp.user_id, mp.community_id, m.group_code, m.away_team_id, m.away_team_name
  ),
  predicted_table as (
    select
      ptr.user_id,
      ptr.community_id,
      ptr.group_code,
      ptr.team_id,
      max(ptr.team_name) team_name,
      row_number() over (
        partition by ptr.user_id, ptr.community_id, ptr.group_code
        order by sum(ptr.pts) desc, (sum(ptr.gf) - sum(ptr.ga)) desc, sum(ptr.gf) desc, max(ptr.team_name) asc
      ) position
    from predicted_team_rows ptr
    where ptr.team_id is not null
    group by ptr.user_id, ptr.community_id, ptr.group_code, ptr.team_id
  )
  insert into public.point_events (user_id, community_id, category, points, ref_type, ref_id, label)
  select
    pt.user_id,
    pt.community_id,
    'qualified',
    8,
    'group_position',
    concat(pt.group_code, ':', pt.team_id, ':exact'),
    concat('Puesto exacto Grupo ', pt.group_code, ': ', pt.team_name)
  from predicted_table pt
  join actual_table at on at.group_code = pt.group_code and at.team_id = pt.team_id and at.position = pt.position
  union all
  select
    pt.user_id,
    pt.community_id,
    'qualified',
    5,
    'group_qualified',
    concat(pt.group_code, ':', pt.team_id, ':qualified'),
    concat('Clasificado acertado Grupo ', pt.group_code, ': ', pt.team_name)
  from predicted_table pt
  join actual_table at on at.group_code = pt.group_code and at.team_id = pt.team_id
  where pt.position <= 2
    and at.position <= 2
    and pt.position <> at.position;

  insert into public.point_events (user_id, community_id, category, points, ref_type, ref_id, label)
  select
    sp.user_id,
    sp.community_id,
    'scorer',
    pg.goals * 10,
    'scorer',
    pg.player_key,
    concat(pg.player_name, ' - ', pg.goals, ' goles')
  from public.scorer_predictions sp
  join public.player_goals pg
    on lower(trim(pg.player_name)) = lower(trim(sp.player_name))
   and (sp.team_id is null or pg.team_id is null or sp.team_id = pg.team_id)
  where pg.goals > 0;

  update public.community_memberships cm
  set points_groups = 0,
      points_knockout = 0,
      points_scorer = 0,
      points_qualified = 0,
      total_points = 0,
      previous_rank = cm.current_rank,
      updated_at = now();

  update public.community_memberships cm
  set
    points_groups = coalesce(s.groups, 0),
    points_knockout = coalesce(s.knockout, 0),
    points_scorer = coalesce(s.scorer, 0),
    points_qualified = coalesce(s.qualified, 0),
    total_points = coalesce(s.groups, 0) + coalesce(s.knockout, 0) + coalesce(s.scorer, 0) + coalesce(s.qualified, 0),
    updated_at = now()
  from (
    select
      pe.user_id,
      pe.community_id,
      sum(pe.points) filter (where pe.category = 'groups') groups,
      sum(pe.points) filter (where pe.category = 'knockout') knockout,
      sum(pe.points) filter (where pe.category = 'scorer') scorer,
      sum(pe.points) filter (where pe.category = 'qualified') qualified
    from public.point_events pe
    group by pe.user_id, pe.community_id
  ) s
  where cm.user_id = s.user_id
    and cm.community_id = s.community_id;

  with ranked as (
    select
      cm.user_id,
      cm.community_id,
      row_number() over (partition by cm.community_id order by cm.total_points desc, cm.updated_at asc) new_rank
    from public.community_memberships cm
    where cm.status = 'approved'
  )
  update public.community_memberships cm
  set current_rank = ranked.new_rank
  from ranked
  where cm.user_id = ranked.user_id
    and cm.community_id = ranked.community_id;
end;
$$;

do $$
begin
  if to_regclass('cron.job') is not null then
    perform cron.unschedule('sync-fifa-world-cup-2026')
    where exists (select 1 from cron.job where jobname = 'sync-fifa-world-cup-2026');

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
  end if;
exception when others then
  raise notice 'Cron FIFA no configurado automaticamente: %', sqlerrm;
end $$;
