drop policy if exists "point_events_read" on public.point_events;
drop policy if exists "point_events_read_private" on public.point_events;
drop policy if exists "point_events_read_approved_scope" on public.point_events;
drop policy if exists "point_events_read_community_breakdown" on public.point_events;

create policy "point_events_read_community_breakdown" on public.point_events
for select to authenticated
using (
  public.is_community_admin(community_id)
  or (
    public.has_community_membership(community_id)
    and exists (
      select 1
      from public.community_memberships target
      where target.user_id = point_events.user_id
        and target.community_id = point_events.community_id
        and target.status = 'approved'
    )
  )
);

do $$
declare
  function_definition text;
begin
  select pg_get_functiondef('public.recalculate_points()'::regprocedure)
  into function_definition;

  function_definition := replace(
    function_definition,
    'concat(m.home_team_name, '' vs '', m.away_team_name)',
    'case
      when mp.home_score = m.home_score and mp.away_score = m.away_score then concat(''Resultado exacto: '', m.home_team_name, '' '', m.home_score, ''-'', m.away_score, '' '', m.away_team_name)
      else concat(''Pronóstico acertado: '', m.home_team_name, '' '', mp.home_score, ''-'', mp.away_score, '' '', m.away_team_name, '' (resultado '', m.home_score, ''-'', m.away_score, '')'')
    end'
  );

  execute function_definition;
end $$;

select public.recalculate_points();
