alter table public.community_settings
  add column if not exists knockout_round_unlocks jsonb not null default '{}'::jsonb;

create or replace function public.expected_knockout_point_events()
returns table (
  user_id uuid,
  community_id text,
  category text,
  points integer,
  ref_type text,
  ref_id text,
  label text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    kp.user_id,
    kp.community_id,
    'knockout',
    case
      when kp.predicted_home_score = m.home_score and kp.predicted_away_score = m.away_score then 15
      when sign(kp.predicted_home_score - kp.predicted_away_score) = sign(m.home_score - m.away_score) then 8
      else 0
    end,
    'knockout_score',
    m.id,
    concat(
      'Marcador eliminatoria: ',
      m.home_team_name,
      ' ',
      kp.predicted_home_score,
      '-',
      kp.predicted_away_score,
      ' ',
      m.away_team_name
    )
  from public.knockout_predictions kp
  join public.matches m on m.id = kp.match_id
  where (
      coalesce(m.round_number, 0) >= 4
      or (m.group_code is null and lower(m.phase) not like '%group%' and lower(m.phase) not like '%grupo%')
    )
    and m.status = 'finished'
    and m.home_team_id is not null
    and m.away_team_id is not null
    and m.home_score is not null
    and m.away_score is not null
    and kp.predicted_home_score is not null
    and kp.predicted_away_score is not null
    and (
      kp.predicted_home_score = m.home_score and kp.predicted_away_score = m.away_score
      or sign(kp.predicted_home_score - kp.predicted_away_score) = sign(m.home_score - m.away_score)
    );
$$;

revoke all on function public.expected_knockout_point_events() from public;

create or replace function public.knockout_reveal_round_key(target_round integer, target_phase text, target_stage text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when coalesce(target_round, 0) = 4
      or lower(coalesce(target_phase, '') || ' ' || coalesce(target_stage, '')) like '%dieciseis%'
      or lower(coalesce(target_phase, '') || ' ' || coalesce(target_stage, '')) like '%round of 32%'
      then 'round-of-32'
    when lower(coalesce(target_phase, '') || ' ' || coalesce(target_stage, '')) like '%tercer%'
      or lower(coalesce(target_phase, '') || ' ' || coalesce(target_stage, '')) like '%third%'
      then 'third-place'
    when coalesce(target_round, 0) = 5
      or lower(coalesce(target_phase, '') || ' ' || coalesce(target_stage, '')) like '%octavos%'
      or lower(coalesce(target_phase, '') || ' ' || coalesce(target_stage, '')) like '%round of 16%'
      then 'round-of-16'
    when coalesce(target_round, 0) = 6
      or lower(coalesce(target_phase, '') || ' ' || coalesce(target_stage, '')) like '%cuartos%'
      or lower(coalesce(target_phase, '') || ' ' || coalesce(target_stage, '')) like '%quarter%'
      then 'quarter-finals'
    when coalesce(target_round, 0) = 7
      or lower(coalesce(target_phase, '') || ' ' || coalesce(target_stage, '')) like '%semifinal%'
      or lower(coalesce(target_phase, '') || ' ' || coalesce(target_stage, '')) like '%semi-final%'
      then 'semi-finals'
    when coalesce(target_round, 0) >= 8
      or lower(coalesce(target_phase, '') || ' ' || coalesce(target_stage, '')) like '%final%'
      then 'final'
    else coalesce(target_stage, target_phase, target_round::text, 'knockout')
  end;
$$;

drop policy if exists "knockout_predictions_reveal_after_deadline" on public.knockout_predictions;
drop function if exists public.knockout_prediction_reveal_open(text);

create or replace function public.knockout_prediction_deadline_at(
  target_match_id text,
  target_community_id text,
  target_user_id uuid default null
)
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  with target as (
    select
      m.id,
      public.knockout_reveal_round_key(m.round_number, m.phase, m.stage_name) as round_key
    from public.matches m
    where m.id = target_match_id
      and (
        coalesce(m.round_number, 0) >= 4
        or (m.group_code is null and lower(m.phase) not like '%group%' and lower(m.phase) not like '%grupo%')
      )
  ),
  first_round_match as (
    select min(m.kickoff_at) as kickoff_at
    from public.matches m
    join target t on t.round_key = public.knockout_reveal_round_key(m.round_number, m.phase, m.stage_name)
    where (
      coalesce(m.round_number, 0) >= 4
      or (m.group_code is null and lower(m.phase) not like '%group%' and lower(m.phase) not like '%grupo%')
    )
  ),
  settings_unlock as (
    select nullif(cs.knockout_round_unlocks ->> t.round_key, '')::timestamptz as until_at
    from public.community_settings cs
    cross join target t
    where cs.community_id = target_community_id
  ),
  member_unlock as (
    select
      nullif(cm.prediction_unlocks ->> 'knockout_until', '')::timestamptz as global_until_at,
      nullif((cm.prediction_unlocks -> 'knockout_round_unlocks') ->> t.round_key, '')::timestamptz as round_until_at
    from public.community_memberships cm
    cross join target t
    where cm.community_id = target_community_id
      and cm.user_id = target_user_id
  ),
  base_deadline as (
    select case
      when t.round_key = 'round-of-32'
        then public.prediction_deadline_at('knockout', target_community_id, target_user_id)
      else (select kickoff_at from first_round_match) - interval '1 minute'
    end as deadline_at
    from target t
  )
  select greatest(
    coalesce((select deadline_at from base_deadline), '-infinity'::timestamptz),
    coalesce((select until_at from settings_unlock), '-infinity'::timestamptz),
    coalesce((select global_until_at from member_unlock), '-infinity'::timestamptz),
    coalesce((select round_until_at from member_unlock), '-infinity'::timestamptz)
  );
$$;

create or replace function public.knockout_match_started_or_locked(target_match_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    m.status in ('live', 'finished') or now() >= (m.kickoff_at - interval '1 minute'),
    true
  )
  from public.matches m
  where m.id = target_match_id;
$$;

create or replace function public.can_edit_knockout_prediction(
  target_match_id text,
  target_community_id text,
  target_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.is_community_admin(target_community_id)
    or (
      public.is_community_approved(target_community_id)
      and not public.knockout_match_started_or_locked(target_match_id)
      and now() <= public.knockout_prediction_deadline_at(target_match_id, target_community_id, target_user_id)
    ),
    false
  );
$$;

create or replace function public.knockout_prediction_reveal_open(
  target_match_id text,
  target_community_id text,
  target_user_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    now() >= public.knockout_prediction_deadline_at(target_match_id, target_community_id, target_user_id),
    false
  );
$$;

revoke all on function public.knockout_reveal_round_key(integer, text, text) from public;
revoke all on function public.knockout_prediction_deadline_at(text, text, uuid) from public;
revoke all on function public.knockout_match_started_or_locked(text) from public;
revoke all on function public.can_edit_knockout_prediction(text, text, uuid) from public;
revoke all on function public.knockout_prediction_reveal_open(text, text, uuid) from public;
grant execute on function public.knockout_prediction_deadline_at(text, text, uuid) to authenticated;
grant execute on function public.knockout_match_started_or_locked(text) to authenticated;
grant execute on function public.can_edit_knockout_prediction(text, text, uuid) to authenticated;
grant execute on function public.knockout_prediction_reveal_open(text, text, uuid) to authenticated;

drop policy if exists "knockout_predictions_reveal_after_deadline" on public.knockout_predictions;
create policy "knockout_predictions_reveal_after_deadline" on public.knockout_predictions
for select to authenticated
using (
  public.knockout_prediction_reveal_open(match_id, community_id, user_id)
  and public.is_community_approved(community_id)
);

drop policy if exists "knockout_predictions_owner_insert" on public.knockout_predictions;
create policy "knockout_predictions_owner_insert" on public.knockout_predictions
for insert to authenticated
with check (
  public.is_community_admin(community_id)
  or (
    public.is_community_approved(community_id)
    and user_id = auth.uid()
    and public.can_edit_knockout_prediction(match_id, community_id, user_id)
  )
);

drop policy if exists "knockout_predictions_owner_update" on public.knockout_predictions;
create policy "knockout_predictions_owner_update" on public.knockout_predictions
for update to authenticated
using (
  public.is_community_admin(community_id)
  or (
    user_id = auth.uid()
    and public.can_edit_knockout_prediction(match_id, community_id, user_id)
  )
)
with check (
  public.is_community_admin(community_id)
  or (
    public.is_community_approved(community_id)
    and user_id = auth.uid()
    and public.can_edit_knockout_prediction(match_id, community_id, user_id)
  )
);

update public.knockout_predictions kp
set
  predicted_home_team_id = m.home_team_id,
  predicted_home_team_name = m.home_team_name,
  predicted_home_team_code = m.home_team_code,
  predicted_away_team_id = m.away_team_id,
  predicted_away_team_name = m.away_team_name,
  predicted_away_team_code = m.away_team_code,
  updated_at = now()
from public.matches m
where m.id = kp.match_id
  and (
    coalesce(m.round_number, 0) >= 4
    or (m.group_code is null and lower(m.phase) not like '%group%' and lower(m.phase) not like '%grupo%')
  )
  and m.home_team_id is not null
  and m.away_team_id is not null
  and (
    kp.predicted_home_team_id is distinct from m.home_team_id
    or kp.predicted_home_team_name is distinct from m.home_team_name
    or kp.predicted_home_team_code is distinct from m.home_team_code
    or kp.predicted_away_team_id is distinct from m.away_team_id
    or kp.predicted_away_team_name is distinct from m.away_team_name
    or kp.predicted_away_team_code is distinct from m.away_team_code
  );

create or replace function public.recalculate_points()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.point_events
  where category <> 'scorer';

  update public.knockout_predictions kp
  set
    predicted_home_team_id = m.home_team_id,
    predicted_home_team_name = m.home_team_name,
    predicted_home_team_code = m.home_team_code,
    predicted_away_team_id = m.away_team_id,
    predicted_away_team_name = m.away_team_name,
    predicted_away_team_code = m.away_team_code,
    updated_at = now()
  from public.matches m
  where m.id = kp.match_id
    and (
      coalesce(m.round_number, 0) >= 4
      or (m.group_code is null and lower(m.phase) not like '%group%' and lower(m.phase) not like '%grupo%')
    )
    and m.home_team_id is not null
    and m.away_team_id is not null
    and (
      kp.predicted_home_team_id is distinct from m.home_team_id
      or kp.predicted_home_team_name is distinct from m.home_team_name
      or kp.predicted_home_team_code is distinct from m.home_team_code
      or kp.predicted_away_team_id is distinct from m.away_team_id
      or kp.predicted_away_team_name is distinct from m.away_team_name
      or kp.predicted_away_team_code is distinct from m.away_team_code
    );

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
  select user_id, community_id, category, points, ref_type, ref_id, label
  from public.expected_knockout_point_events();

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

  update public.community_memberships cm
  set points_groups = 0,
      points_knockout = 0,
      points_scorer = 0,
      points_qualified = 0,
      total_points = 0,
      previous_rank = cm.current_rank,
      updated_at = now()
  where true;

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

select public.recalculate_points();

do $$
begin
  if to_regprocedure('public.recalculate_scorer_points()') is not null then
    perform public.recalculate_scorer_points();
  end if;
end $$;
