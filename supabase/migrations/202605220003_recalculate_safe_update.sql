do $$
declare
  function_definition text;
begin
  select pg_get_functiondef('public.recalculate_points()'::regprocedure)
  into function_definition;

  function_definition := regexp_replace(
    function_definition,
    'update[[:space:]]+public\.community_memberships[[:space:]]+cm[[:space:]]+set[[:space:]]+points_groups[[:space:]]*=[[:space:]]*0,[[:space:]]+points_knockout[[:space:]]*=[[:space:]]*0,[[:space:]]+points_scorer[[:space:]]*=[[:space:]]*0,[[:space:]]+points_qualified[[:space:]]*=[[:space:]]*0,[[:space:]]+total_points[[:space:]]*=[[:space:]]*0,[[:space:]]+previous_rank[[:space:]]*=[[:space:]]*cm\.current_rank,[[:space:]]+updated_at[[:space:]]*=[[:space:]]*now\(\)[[:space:]]*;',
    'update public.community_memberships cm
  set points_groups = 0,
      points_knockout = 0,
      points_scorer = 0,
      points_qualified = 0,
      total_points = 0,
      previous_rank = cm.current_rank,
      updated_at = now()
  where true;',
    'i'
  );

  execute function_definition;
end $$;
