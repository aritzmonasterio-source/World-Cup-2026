create table if not exists public.knockout_predictions (
  user_id uuid not null references public.profiles(id) on delete cascade,
  match_id text not null references public.matches(id) on delete cascade,
  predicted_home_team_id text,
  predicted_home_team_name text,
  predicted_home_team_code text,
  predicted_away_team_id text,
  predicted_away_team_name text,
  predicted_away_team_code text,
  points_awarded integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, match_id),
  check (
    predicted_home_team_id is null
    or predicted_away_team_id is null
    or predicted_home_team_id <> predicted_away_team_id
  )
);

alter table public.knockout_predictions enable row level security;

drop policy if exists "knockout_predictions_owner_read" on public.knockout_predictions;
create policy "knockout_predictions_owner_read" on public.knockout_predictions
for select to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "knockout_predictions_owner_insert" on public.knockout_predictions;
create policy "knockout_predictions_owner_insert" on public.knockout_predictions
for insert to authenticated
with check ((public.is_approved() and user_id = auth.uid()) or public.is_admin());

drop policy if exists "knockout_predictions_owner_update" on public.knockout_predictions;
create policy "knockout_predictions_owner_update" on public.knockout_predictions
for update to authenticated
using (user_id = auth.uid() or public.is_admin())
with check ((public.is_approved() and user_id = auth.uid()) or public.is_admin());

drop policy if exists "knockout_predictions_owner_delete" on public.knockout_predictions;
create policy "knockout_predictions_owner_delete" on public.knockout_predictions
for delete to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "match_predictions_owner_write" on public.match_predictions;
create policy "match_predictions_owner_write" on public.match_predictions
for insert to authenticated
with check ((public.is_approved() and user_id = auth.uid()) or public.is_admin());

drop policy if exists "match_predictions_owner_update" on public.match_predictions;
create policy "match_predictions_owner_update" on public.match_predictions
for update to authenticated
using (user_id = auth.uid() or public.is_admin())
with check ((public.is_approved() and user_id = auth.uid()) or public.is_admin());

drop policy if exists "group_predictions_owner" on public.group_predictions;
create policy "group_predictions_owner" on public.group_predictions
for all to authenticated
using (user_id = auth.uid() or public.is_admin())
with check ((public.is_approved() and user_id = auth.uid()) or public.is_admin());

drop policy if exists "scorer_predictions_owner" on public.scorer_predictions;
create policy "scorer_predictions_owner" on public.scorer_predictions
for all to authenticated
using (user_id = auth.uid() or public.is_admin())
with check ((public.is_approved() and user_id = auth.uid()) or public.is_admin());

create or replace function public.recalculate_points()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.point_events;

  insert into public.point_events (user_id, category, points, ref_type, ref_id, label)
  select
    mp.user_id,
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

  insert into public.point_events (user_id, category, points, ref_type, ref_id, label)
  select
    kp.user_id,
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

  with group_finished as (
    select group_code
    from public.matches
    where round_number <= 3 and group_code is not null
    group by group_code
    having count(*) filter (where status = 'finished' and home_score is not null and away_score is not null) >= 6
  ),
  team_rows as (
    select group_code, home_team_id team_id, home_team_name team_name, home_team_code team_code,
      count(*) filter (where status = 'finished') pj,
      sum(case when status = 'finished' then home_score else 0 end) gf,
      sum(case when status = 'finished' then away_score else 0 end) ga,
      sum(case
        when status <> 'finished' then 0
        when home_score > away_score then 3
        when home_score = away_score then 1
        else 0
      end) pts
    from public.matches
    where round_number <= 3 and group_code is not null
    group by group_code, home_team_id, home_team_name, home_team_code
    union all
    select group_code, away_team_id team_id, away_team_name team_name, away_team_code team_code,
      count(*) filter (where status = 'finished') pj,
      sum(case when status = 'finished' then away_score else 0 end) gf,
      sum(case when status = 'finished' then home_score else 0 end) ga,
      sum(case
        when status <> 'finished' then 0
        when away_score > home_score then 3
        when away_score = home_score then 1
        else 0
      end) pts
    from public.matches
    where round_number <= 3 and group_code is not null
    group by group_code, away_team_id, away_team_name, away_team_code
  ),
  table_rows as (
    select
      tr.group_code,
      tr.team_id,
      max(tr.team_name) team_name,
      sum(tr.pj) pj,
      sum(tr.gf) gf,
      sum(tr.ga) ga,
      sum(tr.pts) pts,
      row_number() over (
        partition by tr.group_code
        order by sum(tr.pts) desc, (sum(tr.gf) - sum(tr.ga)) desc, sum(tr.gf) desc, max(tr.team_name) asc
      ) position
    from team_rows tr
    join group_finished gf on gf.group_code = tr.group_code
    where tr.team_id is not null
    group by tr.group_code, tr.team_id
  )
  insert into public.point_events (user_id, category, points, ref_type, ref_id, label)
  select gp.user_id, 'qualified', 15, 'group', gp.group_code, concat('1º Grupo ', gp.group_code, ': ', tr.team_name)
  from public.group_predictions gp
  join table_rows tr on tr.group_code = gp.group_code and tr.position = 1 and tr.team_id = gp.first_team_id
  union all
  select gp.user_id, 'qualified', 15, 'group', gp.group_code, concat('2º Grupo ', gp.group_code, ': ', tr.team_name)
  from public.group_predictions gp
  join table_rows tr on tr.group_code = gp.group_code and tr.position = 2 and tr.team_id = gp.second_team_id;

  insert into public.point_events (user_id, category, points, ref_type, ref_id, label)
  select
    sp.user_id,
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

  update public.profiles p
  set
    points_groups = coalesce(s.groups, 0),
    points_knockout = coalesce(s.knockout, 0),
    points_scorer = coalesce(s.scorer, 0),
    points_qualified = coalesce(s.qualified, 0),
    total_points = coalesce(s.groups, 0) + coalesce(s.knockout, 0) + coalesce(s.scorer, 0) + coalesce(s.qualified, 0),
    updated_at = now()
  from (
    select
      user_id,
      sum(points) filter (where category = 'groups') groups,
      sum(points) filter (where category = 'knockout') knockout,
      sum(points) filter (where category = 'scorer') scorer,
      sum(points) filter (where category = 'qualified') qualified
    from public.point_events
    group by user_id
  ) s
  where p.id = s.user_id;

  update public.profiles p
  set points_groups = 0,
      points_knockout = 0,
      points_scorer = 0,
      points_qualified = 0,
      total_points = 0,
      updated_at = now()
  where not exists (select 1 from public.point_events pe where pe.user_id = p.id);
end;
$$;
