delete from public.match_goal_events
where true;

delete from public.player_goals
where true;

delete from public.point_events
where category = 'scorer';

select public.recalculate_scorer_points();
