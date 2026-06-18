delete from public.player_goals
where coalesce(manual_override, false) = false;

select public.recalculate_scorer_points();
