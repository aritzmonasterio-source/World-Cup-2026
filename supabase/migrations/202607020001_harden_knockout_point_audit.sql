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
  with knockout_base as (
    select
      kp.user_id,
      kp.community_id,
      kp.match_id,
      kp.predicted_home_team_id,
      kp.predicted_home_team_name,
      kp.predicted_away_team_id,
      kp.predicted_away_team_name,
      kp.predicted_home_score,
      kp.predicted_away_score,
      m.phase,
      m.home_team_id,
      m.away_team_id,
      m.home_team_name,
      m.away_team_name,
      m.home_score,
      m.away_score,
      case
        when kp.predicted_home_team_id = m.home_team_id and kp.predicted_away_team_id = m.away_team_id then true
        when kp.predicted_home_team_id = m.away_team_id and kp.predicted_away_team_id = m.home_team_id then true
        else false
      end as pair_matched,
      case
        when kp.predicted_home_team_id = m.home_team_id and kp.predicted_away_team_id = m.away_team_id then kp.predicted_home_score
        when kp.predicted_home_team_id = m.away_team_id and kp.predicted_away_team_id = m.home_team_id then kp.predicted_away_score
        else null
      end as predicted_real_home_score,
      case
        when kp.predicted_home_team_id = m.home_team_id and kp.predicted_away_team_id = m.away_team_id then kp.predicted_away_score
        when kp.predicted_home_team_id = m.away_team_id and kp.predicted_away_team_id = m.home_team_id then kp.predicted_home_score
        else null
      end as predicted_real_away_score
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
      and kp.predicted_home_team_id is not null
      and kp.predicted_away_team_id is not null
      and kp.predicted_home_team_id <> kp.predicted_away_team_id
  )
  select
    kb.user_id,
    kb.community_id,
    'knockout',
    10,
    'knockout_match',
    concat(kb.match_id, ':', kb.predicted_home_team_id),
    concat('Equipo acertado en ', kb.phase, ': ', kb.predicted_home_team_name)
  from knockout_base kb
  where kb.pair_matched
    and kb.predicted_home_team_id in (kb.home_team_id, kb.away_team_id)

  union all

  select
    kb.user_id,
    kb.community_id,
    'knockout',
    10,
    'knockout_match',
    concat(kb.match_id, ':', kb.predicted_away_team_id),
    concat('Equipo acertado en ', kb.phase, ': ', kb.predicted_away_team_name)
  from knockout_base kb
  where kb.pair_matched
    and kb.predicted_away_team_id in (kb.home_team_id, kb.away_team_id)

  union all

  select
    kb.user_id,
    kb.community_id,
    'knockout',
    case
      when kb.predicted_real_home_score = kb.home_score and kb.predicted_real_away_score = kb.away_score then 15
      when sign(kb.predicted_real_home_score - kb.predicted_real_away_score) = sign(kb.home_score - kb.away_score) then 8
      else 0
    end,
    'knockout_score',
    kb.match_id,
    concat(
      'Marcador eliminatoria: ',
      kb.home_team_name,
      ' ',
      kb.predicted_real_home_score,
      '-',
      kb.predicted_real_away_score,
      ' ',
      kb.away_team_name
    )
  from knockout_base kb
  where kb.pair_matched
    and kb.predicted_real_home_score is not null
    and kb.predicted_real_away_score is not null
    and (
      kb.predicted_real_home_score = kb.home_score and kb.predicted_real_away_score = kb.away_score
      or sign(kb.predicted_real_home_score - kb.predicted_real_away_score) = sign(kb.home_score - kb.away_score)
    );
$$;

revoke all on function public.expected_knockout_point_events() from public;

create or replace function public.recalculate_points()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.point_events
  where category <> 'scorer';

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

create or replace function public.audit_knockout_point_gaps()
returns table (
  user_id uuid,
  community_id text,
  username text,
  email text,
  match_id text,
  match_number integer,
  phase text,
  actual_match text,
  actual_score text,
  predicted_score text,
  expected_points integer,
  actual_points integer,
  missing_points integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_user not in ('postgres', 'supabase_admin')
    and coalesce(auth.role(), '') <> 'service_role'
    and not public.is_admin()
  then
    raise exception 'Solo el administrador puede auditar puntos';
  end if;

  return query
  with expected as (
    select
      e.user_id,
      e.community_id,
      case when e.ref_type = 'knockout_score' then e.ref_id else split_part(e.ref_id, ':', 1) end match_id,
      sum(e.points)::integer expected_points
    from public.expected_knockout_point_events() e
    where e.ref_type in ('knockout_match', 'knockout_score')
    group by e.user_id, e.community_id, case when e.ref_type = 'knockout_score' then e.ref_id else split_part(e.ref_id, ':', 1) end
  ),
  actual as (
    select
      pe.user_id,
      pe.community_id,
      case when pe.ref_type = 'knockout_score' then pe.ref_id else split_part(pe.ref_id, ':', 1) end match_id,
      sum(pe.points)::integer actual_points
    from public.point_events pe
    where pe.category = 'knockout'
      and pe.ref_type in ('knockout_match', 'knockout_score')
    group by pe.user_id, pe.community_id, case when pe.ref_type = 'knockout_score' then pe.ref_id else split_part(pe.ref_id, ':', 1) end
  ),
  prediction_scores as (
    select
      kp.user_id,
      kp.community_id,
      kp.match_id,
      case
        when kp.predicted_home_team_id = m.home_team_id and kp.predicted_away_team_id = m.away_team_id
          then concat(kp.predicted_home_score, '-', kp.predicted_away_score)
        when kp.predicted_home_team_id = m.away_team_id and kp.predicted_away_team_id = m.home_team_id
          then concat(kp.predicted_away_score, '-', kp.predicted_home_score)
        else concat(kp.predicted_home_score, '-', kp.predicted_away_score)
      end predicted_score
    from public.knockout_predictions kp
    join public.matches m on m.id = kp.match_id
  )
  select
    e.user_id,
    e.community_id,
    p.username,
    p.email,
    e.match_id,
    m.match_number,
    m.phase,
    concat(m.home_team_name, ' vs ', m.away_team_name),
    concat(m.home_score, '-', m.away_score),
    ps.predicted_score,
    e.expected_points,
    coalesce(a.actual_points, 0),
    e.expected_points - coalesce(a.actual_points, 0)
  from expected e
  join public.matches m on m.id = e.match_id
  left join actual a on a.user_id = e.user_id and a.community_id = e.community_id and a.match_id = e.match_id
  left join public.profiles p on p.id = e.user_id
  left join prediction_scores ps on ps.user_id = e.user_id and ps.community_id = e.community_id and ps.match_id = e.match_id
  where e.expected_points <> coalesce(a.actual_points, 0)
  order by m.match_number, p.username nulls last, p.email nulls last;
end;
$$;

revoke all on function public.audit_knockout_point_gaps() from public;
grant execute on function public.audit_knockout_point_gaps() to authenticated;

create or replace function public.audit_prediction_point_gaps()
returns table (
  user_id uuid,
  community_id text,
  username text,
  email text,
  category text,
  match_id text,
  match_number integer,
  phase text,
  actual_match text,
  actual_score text,
  predicted_score text,
  expected_points integer,
  actual_points integer,
  missing_points integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_user not in ('postgres', 'supabase_admin')
    and coalesce(auth.role(), '') <> 'service_role'
    and not public.is_admin()
  then
    raise exception 'Solo el administrador puede auditar puntos';
  end if;

  return query
  with expected_groups as (
    select
      mp.user_id,
      mp.community_id,
      'groups'::text category,
      m.id match_id,
      case
        when mp.home_score = m.home_score and mp.away_score = m.away_score then 15
        when sign(mp.home_score - mp.away_score) = sign(m.home_score - m.away_score) then 8
        else 0
      end::integer expected_points,
      concat(mp.home_score, '-', mp.away_score) predicted_score
    from public.match_predictions mp
    join public.matches m on m.id = mp.match_id
    where (coalesce(m.round_number, 99) <= 3 or lower(m.phase) like '%group%' or lower(m.phase) like '%grupo%')
      and m.status = 'finished'
      and m.home_score is not null
      and m.away_score is not null
  ),
  expected_knockout as (
    select
      e.user_id,
      e.community_id,
      'knockout'::text category,
      case when e.ref_type = 'knockout_score' then e.ref_id else split_part(e.ref_id, ':', 1) end match_id,
      sum(e.points)::integer expected_points
    from public.expected_knockout_point_events() e
    where e.ref_type in ('knockout_match', 'knockout_score')
    group by e.user_id, e.community_id, case when e.ref_type = 'knockout_score' then e.ref_id else split_part(e.ref_id, ':', 1) end
  ),
  expected as (
    select eg.* from expected_groups eg
    where eg.expected_points > 0
    union all
    select
      ek.user_id,
      ek.community_id,
      ek.category,
      ek.match_id,
      ek.expected_points,
      case
        when kp.predicted_home_team_id = m.home_team_id and kp.predicted_away_team_id = m.away_team_id
          then concat(kp.predicted_home_score, '-', kp.predicted_away_score)
        when kp.predicted_home_team_id = m.away_team_id and kp.predicted_away_team_id = m.home_team_id
          then concat(kp.predicted_away_score, '-', kp.predicted_home_score)
        else concat(kp.predicted_home_score, '-', kp.predicted_away_score)
      end predicted_score
    from expected_knockout ek
    left join public.knockout_predictions kp on kp.user_id = ek.user_id and kp.community_id = ek.community_id and kp.match_id = ek.match_id
    left join public.matches m on m.id = ek.match_id
    where ek.expected_points > 0
  ),
  actual as (
    select
      pe.user_id,
      pe.community_id,
      case when pe.category = 'groups' then 'groups' else 'knockout' end category,
      case
        when pe.ref_type in ('match', 'knockout_score') then pe.ref_id
        when pe.ref_type = 'knockout_match' then split_part(pe.ref_id, ':', 1)
        else pe.ref_id
      end match_id,
      sum(pe.points)::integer actual_points
    from public.point_events pe
    where (
        pe.category = 'groups'
        and pe.ref_type = 'match'
      )
      or (
        pe.category = 'knockout'
        and pe.ref_type in ('knockout_match', 'knockout_score')
      )
    group by
      pe.user_id,
      pe.community_id,
      case when pe.category = 'groups' then 'groups' else 'knockout' end,
      case
        when pe.ref_type in ('match', 'knockout_score') then pe.ref_id
        when pe.ref_type = 'knockout_match' then split_part(pe.ref_id, ':', 1)
        else pe.ref_id
      end
  )
  select
    e.user_id,
    e.community_id,
    p.username,
    p.email,
    e.category,
    e.match_id,
    m.match_number,
    m.phase,
    concat(m.home_team_name, ' vs ', m.away_team_name),
    concat(m.home_score, '-', m.away_score),
    e.predicted_score,
    e.expected_points,
    coalesce(a.actual_points, 0),
    e.expected_points - coalesce(a.actual_points, 0)
  from expected e
  join public.matches m on m.id = e.match_id
  left join actual a on a.user_id = e.user_id and a.community_id = e.community_id and a.category = e.category and a.match_id = e.match_id
  left join public.profiles p on p.id = e.user_id
  where e.expected_points <> coalesce(a.actual_points, 0)
  order by m.match_number, p.username nulls last, p.email nulls last;
end;
$$;

revoke all on function public.audit_prediction_point_gaps() from public;
grant execute on function public.audit_prediction_point_gaps() to authenticated;

select public.recalculate_points();

do $$
begin
  if to_regprocedure('public.recalculate_scorer_points()') is not null then
    perform public.recalculate_scorer_points();
  end if;
end $$;
