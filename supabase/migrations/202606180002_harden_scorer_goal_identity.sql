alter table public.player_goals
  add column if not exists source text not null default 'sync',
  add column if not exists manual_override boolean not null default false,
  add column if not exists correction_note text null;

create or replace function public.scorer_goal_key(
  player_name text,
  team_code text,
  team_id text
)
returns text
language sql
immutable
as $$
  select public.normalize_player_name(player_name) || '|' || coalesce(nullif(upper(trim(team_code)), ''), nullif(trim(team_id), ''), 'unknown');
$$;

create or replace function public.recalculate_scorer_points()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.point_events
  where category = 'scorer';

  with canonical_goals as (
    select distinct on (
      public.normalize_player_name(pg.player_name),
      coalesce(nullif(upper(trim(pg.team_code)), ''), nullif(public.normalize_player_name(pg.team_name), ''), nullif(trim(pg.team_id), ''), 'unknown')
    )
      pg.player_key,
      pg.player_name,
      pg.team_id,
      pg.team_name,
      pg.team_code,
      pg.goals,
      pg.updated_at
    from public.player_goals pg
    where pg.goals > 0
    order by
      public.normalize_player_name(pg.player_name),
      coalesce(nullif(upper(trim(pg.team_code)), ''), nullif(public.normalize_player_name(pg.team_name), ''), nullif(trim(pg.team_id), ''), 'unknown'),
      pg.manual_override desc,
      pg.updated_at desc nulls last
  ),
  matched_scorers as (
    select
      sp.user_id,
      sp.community_id,
      cg.player_key,
      cg.player_name,
      cg.goals,
      cg.updated_at
    from public.scorer_predictions sp
    join canonical_goals cg
      on (
        public.normalize_player_name(cg.player_name) = public.normalize_player_name(sp.player_name)
        or exists (
          select 1
          from public.scorer_candidate_aliases sca
          where public.normalize_player_name(sca.player_name) = public.normalize_player_name(sp.player_name)
            and public.normalize_player_name(sca.alias) = public.normalize_player_name(cg.player_name)
        )
        or exists (
          select 1
          from public.scorer_candidate_aliases sca
          where public.normalize_player_name(sca.player_name) = public.normalize_player_name(cg.player_name)
            and public.normalize_player_name(sca.alias) = public.normalize_player_name(sp.player_name)
        )
      )
     and (
        nullif(upper(trim(sp.team_code)), '') is null
        or nullif(upper(trim(cg.team_code)), '') is null
        or upper(trim(sp.team_code)) = upper(trim(cg.team_code))
        or nullif(trim(sp.team_id), '') is null
        or nullif(trim(cg.team_id), '') is null
        or sp.team_id = cg.team_id
        or public.normalize_player_name(sp.team_name) = public.normalize_player_name(cg.team_name)
     )
  )
  insert into public.point_events (user_id, community_id, category, points, ref_type, ref_id, label, created_at)
  select
    ms.user_id,
    ms.community_id,
    'scorer',
    ms.goals * 10,
    'scorer',
    ms.player_key,
    concat(ms.player_name, ' - ', ms.goals, case when ms.goals = 1 then ' gol' else ' goles' end),
    coalesce(ms.updated_at, now())
  from matched_scorers ms;

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
      cm2.user_id,
      cm2.community_id,
      sum(pe.points) filter (where pe.category = 'groups') groups,
      sum(pe.points) filter (where pe.category = 'knockout') knockout,
      sum(pe.points) filter (where pe.category = 'scorer') scorer,
      sum(pe.points) filter (where pe.category = 'qualified') qualified
    from public.community_memberships cm2
    left join public.point_events pe
      on pe.user_id = cm2.user_id
     and pe.community_id = cm2.community_id
    group by cm2.user_id, cm2.community_id
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

create or replace function public.set_player_goals_manual(
  player_name text,
  team_code text,
  team_name text,
  goals integer,
  note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_key text;
begin
  if not public.is_admin() then
    raise exception 'Solo el admin puede corregir goleadores';
  end if;

  normalized_key := public.scorer_goal_key(player_name, team_code, null);

  insert into public.player_goals (
    player_key,
    player_name,
    team_id,
    team_name,
    team_code,
    goals,
    updated_at,
    source,
    manual_override,
    correction_note
  )
  values (
    normalized_key,
    player_name,
    null,
    team_name,
    upper(nullif(team_code, '')),
    greatest(coalesce(goals, 0), 0),
    now(),
    'manual',
    true,
    note
  )
  on conflict (player_key) do update set
    player_name = excluded.player_name,
    team_id = excluded.team_id,
    team_name = excluded.team_name,
    team_code = excluded.team_code,
    goals = excluded.goals,
    updated_at = now(),
    source = 'manual',
    manual_override = true,
    correction_note = excluded.correction_note;

  perform public.recalculate_scorer_points();
end;
$$;

select public.recalculate_scorer_points();
