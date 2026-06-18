delete from public.player_goals
where true;

delete from public.point_events
where category = 'scorer';

select public.recalculate_scorer_points();
