create or replace function public.prediction_reveal_open(target_phase text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when target_phase = 'groups' then now() >= '2026-06-11 18:30:00+00'::timestamptz
    when target_phase = 'knockout' then now() >= '2026-06-28 08:00:00+00'::timestamptz
    else false
  end;
$$;
