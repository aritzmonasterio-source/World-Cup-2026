alter table public.community_settings
  add column if not exists groups_deadline_at timestamptz null,
  add column if not exists scorer_deadline_at timestamptz null,
  add column if not exists knockout_deadline_at timestamptz null;

alter table public.community_memberships
  add column if not exists prediction_unlocks jsonb not null default '{}'::jsonb;

update public.community_settings
set scorer_deadline_at = case
    when scorer_deadline_at is null or scorer_deadline_at < now() + interval '3 hours'
      then now() + interval '3 hours'
    else scorer_deadline_at
  end,
  updated_at = now();

create or replace function public.prediction_deadline_at(
  target_phase text,
  target_community_id text,
  target_user_id uuid default null
)
returns timestamptz
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  base_deadline timestamptz;
  member_deadline timestamptz;
begin
  select case
    when target_phase = 'groups' then coalesce(cs.groups_deadline_at, '2026-06-11 18:30:00+00'::timestamptz)
    when target_phase = 'scorer' then coalesce(cs.scorer_deadline_at, cs.groups_deadline_at, '2026-06-11 18:30:00+00'::timestamptz)
    when target_phase = 'knockout' then coalesce(cs.knockout_deadline_at, '2026-06-28 08:00:00+00'::timestamptz)
    else null
  end
  into base_deadline
  from public.community_settings cs
  where cs.community_id = target_community_id;

  if base_deadline is null then
    base_deadline := case
      when target_phase in ('groups', 'scorer') then '2026-06-11 18:30:00+00'::timestamptz
      when target_phase = 'knockout' then '2026-06-28 08:00:00+00'::timestamptz
      else null
    end;
  end if;

  if target_user_id is not null then
    select case
      when target_phase = 'groups' then nullif(cm.prediction_unlocks ->> 'groups_until', '')::timestamptz
      when target_phase = 'scorer' then nullif(cm.prediction_unlocks ->> 'scorer_until', '')::timestamptz
      when target_phase = 'knockout' then nullif(cm.prediction_unlocks ->> 'knockout_until', '')::timestamptz
      else null
    end
    into member_deadline
    from public.community_memberships cm
    where cm.community_id = target_community_id
      and cm.user_id = target_user_id;
  end if;

  if member_deadline is not null and member_deadline > base_deadline then
    return member_deadline;
  end if;

  return base_deadline;
end;
$$;

create or replace function public.prediction_reveal_open(
  target_phase text,
  target_community_id text,
  target_user_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select now() >= public.prediction_deadline_at(target_phase, target_community_id, target_user_id);
$$;

create or replace function public.prediction_reveal_open(target_phase text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when target_phase = 'groups' then now() >= '2026-06-11 18:30:00+00'::timestamptz
    when target_phase = 'scorer' then now() >= '2026-06-11 18:30:00+00'::timestamptz
    when target_phase = 'knockout' then now() >= '2026-06-28 08:00:00+00'::timestamptz
    else false
  end;
$$;

drop policy if exists "match_predictions_reveal_after_deadline" on public.match_predictions;
create policy "match_predictions_reveal_after_deadline" on public.match_predictions
for select to authenticated
using (
  public.prediction_reveal_open('groups', community_id, user_id)
  and public.has_community_membership(community_id)
);

drop policy if exists "scorer_predictions_reveal_after_deadline" on public.scorer_predictions;
create policy "scorer_predictions_reveal_after_deadline" on public.scorer_predictions
for select to authenticated
using (
  public.prediction_reveal_open('scorer', community_id, user_id)
  and public.has_community_membership(community_id)
);

drop policy if exists "knockout_predictions_reveal_after_deadline" on public.knockout_predictions;
create policy "knockout_predictions_reveal_after_deadline" on public.knockout_predictions
for select to authenticated
using (
  public.prediction_reveal_open('knockout', community_id, user_id)
  and public.has_community_membership(community_id)
);

drop policy if exists "finalist_predictions_reveal_after_deadline" on public.finalist_predictions;
create policy "finalist_predictions_reveal_after_deadline" on public.finalist_predictions
for select to authenticated
using (
  public.prediction_reveal_open('knockout', community_id, user_id)
  and public.has_community_membership(community_id)
);
