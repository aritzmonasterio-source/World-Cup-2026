do $$
declare
  function_definition text;
begin
  select pg_get_functiondef('public.recalculate_points()'::regprocedure)
  into function_definition;

  function_definition := regexp_replace(
    function_definition,
    'delete\s+from\s+public\.point_events\s*;',
    'delete from public.point_events where true;',
    'i'
  );

  execute function_definition;
end $$;
