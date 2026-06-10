create or replace function public.has_any_membership(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.community_memberships cm
    where cm.user_id = target_user_id
      and cm.status in ('pending', 'approved')
  );
$$;

create or replace function public.has_community_membership(target_community_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_community_admin(target_community_id)
    or exists (
      select 1
      from public.community_memberships cm
      where cm.user_id = auth.uid()
        and cm.community_id = target_community_id
        and cm.status in ('pending', 'approved')
    );
$$;

create or replace function public.can_read_profile(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target_user_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1
      from public.community_memberships viewer
      join public.community_memberships target
        on target.community_id = viewer.community_id
      where viewer.user_id = auth.uid()
        and viewer.status = 'approved'
        and target.user_id = target_user_id
        and target.status = 'approved'
    );
$$;

drop policy if exists "profiles_select_authenticated" on public.profiles;
drop policy if exists "profiles_select_community_visible" on public.profiles;
create policy "profiles_select_community_visible" on public.profiles
for select to authenticated
using (public.can_read_profile(id));

drop policy if exists "communities_read" on public.communities;
drop policy if exists "communities_read_anon" on public.communities;
drop policy if exists "communities_read_member" on public.communities;
create policy "communities_read_anon" on public.communities
for select to anon
using (true);
create policy "communities_read_member" on public.communities
for select to authenticated
using (public.is_admin() or public.has_community_membership(id));

drop policy if exists "community_memberships_read" on public.community_memberships;
drop policy if exists "community_memberships_read_private" on public.community_memberships;
create policy "community_memberships_read_private" on public.community_memberships
for select to authenticated
using (
  user_id = auth.uid()
  or public.is_community_admin(community_id)
  or (
    status = 'approved'
    and public.is_community_approved(community_id)
  )
);

drop policy if exists "community_memberships_insert_self" on public.community_memberships;
create policy "community_memberships_insert_self" on public.community_memberships
for insert to authenticated
with check (
  public.is_admin()
  or (
    user_id = auth.uid()
    and role = 'player'
    and status = 'pending'
    and not public.has_any_membership(auth.uid())
  )
);

drop policy if exists "community_settings_read" on public.community_settings;
drop policy if exists "community_settings_read_private" on public.community_settings;
create policy "community_settings_read_private" on public.community_settings
for select to authenticated
using (public.is_community_approved(community_id));

drop policy if exists "match_predictions_owner_read" on public.match_predictions;
create policy "match_predictions_owner_read" on public.match_predictions
for select to authenticated
using (
  (user_id = auth.uid() and public.has_community_membership(community_id))
  or public.is_community_admin(community_id)
);

drop policy if exists "match_predictions_owner_write" on public.match_predictions;
create policy "match_predictions_owner_write" on public.match_predictions
for insert to authenticated
with check ((public.is_community_approved(community_id) and user_id = auth.uid()) or public.is_community_admin(community_id));

drop policy if exists "match_predictions_owner_update" on public.match_predictions;
create policy "match_predictions_owner_update" on public.match_predictions
for update to authenticated
using ((user_id = auth.uid() and public.has_community_membership(community_id)) or public.is_community_admin(community_id))
with check ((public.is_community_approved(community_id) and user_id = auth.uid()) or public.is_community_admin(community_id));

drop policy if exists "group_predictions_owner" on public.group_predictions;
create policy "group_predictions_owner" on public.group_predictions
for all to authenticated
using ((user_id = auth.uid() and public.has_community_membership(community_id)) or public.is_community_admin(community_id))
with check ((public.is_community_approved(community_id) and user_id = auth.uid()) or public.is_community_admin(community_id));

drop policy if exists "scorer_predictions_owner" on public.scorer_predictions;
create policy "scorer_predictions_owner" on public.scorer_predictions
for all to authenticated
using ((user_id = auth.uid() and public.has_community_membership(community_id)) or public.is_community_admin(community_id))
with check ((public.is_community_approved(community_id) and user_id = auth.uid()) or public.is_community_admin(community_id));

drop policy if exists "knockout_predictions_owner_read" on public.knockout_predictions;
create policy "knockout_predictions_owner_read" on public.knockout_predictions
for select to authenticated
using (
  (user_id = auth.uid() and public.has_community_membership(community_id))
  or public.is_community_admin(community_id)
);

drop policy if exists "knockout_predictions_owner_insert" on public.knockout_predictions;
create policy "knockout_predictions_owner_insert" on public.knockout_predictions
for insert to authenticated
with check ((public.is_community_approved(community_id) and user_id = auth.uid()) or public.is_community_admin(community_id));

drop policy if exists "knockout_predictions_owner_update" on public.knockout_predictions;
create policy "knockout_predictions_owner_update" on public.knockout_predictions
for update to authenticated
using ((user_id = auth.uid() and public.has_community_membership(community_id)) or public.is_community_admin(community_id))
with check ((public.is_community_approved(community_id) and user_id = auth.uid()) or public.is_community_admin(community_id));

drop policy if exists "knockout_predictions_owner_delete" on public.knockout_predictions;
create policy "knockout_predictions_owner_delete" on public.knockout_predictions
for delete to authenticated
using ((user_id = auth.uid() and public.has_community_membership(community_id)) or public.is_community_admin(community_id));

drop policy if exists "finalist_predictions_owner_read" on public.finalist_predictions;
create policy "finalist_predictions_owner_read" on public.finalist_predictions
for select to authenticated
using (
  (user_id = auth.uid() and public.has_community_membership(community_id))
  or public.is_community_admin(community_id)
);

drop policy if exists "finalist_predictions_owner_insert" on public.finalist_predictions;
create policy "finalist_predictions_owner_insert" on public.finalist_predictions
for insert to authenticated
with check ((public.is_community_approved(community_id) and user_id = auth.uid()) or public.is_community_admin(community_id));

drop policy if exists "finalist_predictions_owner_update" on public.finalist_predictions;
create policy "finalist_predictions_owner_update" on public.finalist_predictions
for update to authenticated
using ((user_id = auth.uid() and public.has_community_membership(community_id)) or public.is_community_admin(community_id))
with check ((public.is_community_approved(community_id) and user_id = auth.uid()) or public.is_community_admin(community_id));

drop policy if exists "point_events_read" on public.point_events;
drop policy if exists "point_events_read_private" on public.point_events;
create policy "point_events_read_private" on public.point_events
for select to authenticated
using (
  (user_id = auth.uid() and public.has_community_membership(community_id))
  or public.is_community_admin(community_id)
);
