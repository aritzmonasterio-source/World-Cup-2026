create or replace function public.normalize_player_name(value text)
returns text
language sql
immutable
as $$
  select regexp_replace(
    translate(
      lower(coalesce(value, '')),
      'áàäâãåéèëêíìïîóòöôõúùüûñçýÿ',
      'aaaaaaeeeeiiiiooooouuuuncyy'
    ),
    '[^a-z0-9]+',
    '',
    'g'
  );
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

  insert into public.point_events (user_id, community_id, category, points, ref_type, ref_id, label, created_at)
  select
    sp.user_id,
    sp.community_id,
    'scorer',
    pg.goals * 10,
    'scorer',
    pg.player_key,
    concat(pg.player_name, ' - ', pg.goals, ' goles'),
    coalesce(pg.updated_at, now())
  from public.scorer_predictions sp
  join public.player_goals pg
    on (
      public.normalize_player_name(pg.player_name) = public.normalize_player_name(sp.player_name)
      or exists (
        select 1
        from public.scorer_candidate_aliases sca
        where public.normalize_player_name(sca.player_name) = public.normalize_player_name(sp.player_name)
          and public.normalize_player_name(sca.alias) = public.normalize_player_name(pg.player_name)
      )
      or exists (
        select 1
        from public.scorer_candidate_aliases sca
        where public.normalize_player_name(sca.player_name) = public.normalize_player_name(pg.player_name)
          and public.normalize_player_name(sca.alias) = public.normalize_player_name(sp.player_name)
      )
    )
   and (
      sp.team_id is null
      or pg.team_id is null
      or sp.team_id = pg.team_id
      or sp.team_code is null
      or pg.team_code is null
      or sp.team_code = pg.team_code
      or public.normalize_player_name(sp.team_name) = public.normalize_player_name(pg.team_name)
   )
  where pg.goals > 0;

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

create or replace function public.cleanup_duplicate_goal_events()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  with duplicate_events as (
    select
      event_key,
      row_number() over (
        partition by
          public.normalize_player_name(player_name),
          coalesce(team_code, team_id, public.normalize_player_name(team_name)),
          match_id,
          coalesce(minute, -1),
          penalty,
          own_goal
        order by updated_at desc nulls last, event_key desc
      ) as duplicate_rank
    from public.match_goal_events
  )
  delete from public.match_goal_events mge
  using duplicate_events de
  where mge.event_key = de.event_key
    and de.duplicate_rank > 1;

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

select public.cleanup_duplicate_goal_events();
select public.recalculate_scorer_points();
