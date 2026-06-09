create or replace function public.prediction_reveal_open(target_phase text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when target_phase = 'groups' then now() >= '2026-06-09 21:59:00+00'::timestamptz
    when target_phase = 'knockout' then now() >= '2026-06-28 08:00:00+00'::timestamptz
    else false
  end;
$$;

drop policy if exists "match_predictions_reveal_after_deadline" on public.match_predictions;
create policy "match_predictions_reveal_after_deadline" on public.match_predictions
for select to authenticated
using (
  public.prediction_reveal_open('groups')
  and public.is_community_approved(community_id)
);

drop policy if exists "scorer_predictions_reveal_after_deadline" on public.scorer_predictions;
create policy "scorer_predictions_reveal_after_deadline" on public.scorer_predictions
for select to authenticated
using (
  public.prediction_reveal_open('groups')
  and public.is_community_approved(community_id)
);

drop policy if exists "knockout_predictions_reveal_after_deadline" on public.knockout_predictions;
create policy "knockout_predictions_reveal_after_deadline" on public.knockout_predictions
for select to authenticated
using (
  public.prediction_reveal_open('knockout')
  and public.is_community_approved(community_id)
);

drop policy if exists "finalist_predictions_reveal_after_deadline" on public.finalist_predictions;
create policy "finalist_predictions_reveal_after_deadline" on public.finalist_predictions
for select to authenticated
using (
  public.prediction_reveal_open('knockout')
  and public.is_community_approved(community_id)
);
