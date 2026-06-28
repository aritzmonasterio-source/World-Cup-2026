do $$
declare
  original_function text;
  patched_function text;
begin
  select pg_get_functiondef('public.recalculate_points()'::regprocedure)
  into original_function;

  patched_function := regexp_replace(
    original_function,
    'and m\.home_team_id is not null\s+and m\.away_team_id is not null\s+and kp\.predicted_home_team_id is not null',
    'and m.status = ''finished''
    and m.home_score is not null
    and m.away_score is not null
    and m.home_team_id is not null
    and m.away_team_id is not null
    and kp.predicted_home_team_id is not null',
    'g'
  );

  if patched_function = original_function then
    raise exception 'No se pudo blindar recalculate_points para eliminatorias terminadas';
  end if;

  execute patched_function;
end $$;

select public.recalculate_points();

do $$
begin
  if to_regprocedure('public.recalculate_scorer_points()') is not null then
    perform public.recalculate_scorer_points();
  end if;
end $$;
