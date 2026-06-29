alter table public.community_settings
  alter column prize_distribution set default jsonb_build_object(
    'phase1Champion', 10,
    'phase2Champion', 0,
    'globalChampion', 50,
    'globalRunnerUp', 25,
    'globalThird', 15
  );

update public.community_settings
set prize_distribution = jsonb_build_object(
      'phase1Champion', coalesce((prize_distribution ->> 'phase1Champion')::numeric, 10),
      'phase2Champion', 0,
      'globalChampion', coalesce((prize_distribution ->> 'globalChampion')::numeric, 50),
      'globalRunnerUp', 25,
      'globalThird', coalesce((prize_distribution ->> 'globalThird')::numeric, 15)
    ),
    updated_at = now();
