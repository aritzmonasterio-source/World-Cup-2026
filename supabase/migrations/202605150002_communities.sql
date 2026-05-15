create table if not exists public.communities (
  id text primary key,
  name text not null,
  theme text not null default 'dimension',
  created_at timestamptz not null default now()
);

insert into public.communities (id, name, theme) values
  ('dimension-football', 'Dimension Football', 'gold'),
  ('athletic-club', 'Athletic Club', 'red'),
  ('electric-league', 'Otra Liga', 'electric')
on conflict (id) do update set
  name = excluded.name,
  theme = excluded.theme;

create table if not exists public.community_memberships (
  user_id uuid not null references public.profiles(id) on delete cascade,
  community_id text not null references public.communities(id) on delete cascade,
  role text not null default 'player' check (role in ('player', 'admin')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'blocked')),
  total_points integer not null default 0,
  points_groups integer not null default 0,
  points_knockout integer not null default 0,
  points_scorer integer not null default 0,
  points_qualified integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, community_id)
);

insert into public.community_memberships (
  user_id, community_id, role, status, total_points, points_groups, points_knockout, points_scorer, points_qualified
)
select id, 'dimension-football', role, status, total_points, points_groups, points_knockout, points_scorer, points_qualified
from public.profiles
on conflict (user_id, community_id) do nothing;

insert into public.community_memberships (user_id, community_id, role, status)
select p.id, c.id, 'admin', 'approved'
from public.profiles p
cross join public.communities c
where p.role = 'admin'
on conflict (user_id, community_id) do update set
  role = 'admin',
  status = 'approved',
  updated_at = now();

alter table public.match_predictions
  add column if not exists community_id text not null default 'dimension-football' references public.communities(id);
alter table public.group_predictions
  add column if not exists community_id text not null default 'dimension-football' references public.communities(id);
alter table public.scorer_predictions
  add column if not exists community_id text not null default 'dimension-football' references public.communities(id);
alter table public.knockout_predictions
  add column if not exists community_id text not null default 'dimension-football' references public.communities(id);
alter table public.point_events
  add column if not exists community_id text not null default 'dimension-football' references public.communities(id);

alter table public.match_predictions drop constraint if exists match_predictions_user_id_match_id_key;
create unique index if not exists match_predictions_user_community_match_uidx
  on public.match_predictions(user_id, community_id, match_id);

alter table public.group_predictions drop constraint if exists group_predictions_pkey;
alter table public.group_predictions
  add constraint group_predictions_pkey primary key (user_id, community_id, group_code);

alter table public.scorer_predictions drop constraint if exists scorer_predictions_pkey;
alter table public.scorer_predictions
  add constraint scorer_predictions_pkey primary key (user_id, community_id);

alter table public.knockout_predictions drop constraint if exists knockout_predictions_pkey;
alter table public.knockout_predictions
  add constraint knockout_predictions_pkey primary key (user_id, community_id, match_id);

create index if not exists community_memberships_community_idx on public.community_memberships(community_id, status, total_points desc);
create index if not exists point_events_user_community_idx on public.point_events(user_id, community_id);

alter table public.communities enable row level security;
alter table public.community_memberships enable row level security;

create or replace function public.is_community_admin(target_community_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
    or exists (
      select 1
      from public.community_memberships cm
      where cm.user_id = auth.uid()
        and cm.community_id = target_community_id
        and cm.role = 'admin'
        and cm.status = 'approved'
    );
$$;

create or replace function public.is_community_approved(target_community_id text)
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
        and cm.status = 'approved'
    );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_community text := coalesce(new.raw_user_meta_data->>'community_id', 'dimension-football');
  admin_email text := lower(coalesce(current_setting('app.admin_email', true), 'aritzmonasterio@gmail.com'));
  is_admin_user boolean := lower(new.email) = admin_email;
begin
  if not exists (select 1 from public.communities where id = requested_community) then
    requested_community := 'dimension-football';
  end if;

  insert into public.profiles (id, email, username, role, status)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1), 'Usuario'),
    case when is_admin_user then 'admin' else 'player' end,
    case when is_admin_user then 'approved' else 'pending' end
  )
  on conflict (id) do update set
    email = excluded.email,
    username = coalesce(public.profiles.username, excluded.username),
    updated_at = now();

  if is_admin_user then
    insert into public.community_memberships (user_id, community_id, role, status)
    select new.id, id, 'admin', 'approved'
    from public.communities
    on conflict (user_id, community_id) do update set
      role = 'admin',
      status = 'approved',
      updated_at = now();
  else
    insert into public.community_memberships (user_id, community_id, role, status)
    values (new.id, requested_community, 'player', 'pending')
    on conflict (user_id, community_id) do nothing;
  end if;

  return new;
end;
$$;

drop policy if exists "communities_read" on public.communities;
create policy "communities_read" on public.communities
for select to anon, authenticated using (true);

drop policy if exists "community_memberships_read" on public.community_memberships;
create policy "community_memberships_read" on public.community_memberships
for select to authenticated using (true);

drop policy if exists "community_memberships_insert_self" on public.community_memberships;
create policy "community_memberships_insert_self" on public.community_memberships
for insert to authenticated
with check (
  public.is_admin()
  or (
    user_id = auth.uid()
    and role = 'player'
    and status = 'pending'
  )
);

drop policy if exists "community_memberships_update_admin" on public.community_memberships;
create policy "community_memberships_update_admin" on public.community_memberships
for update to authenticated
using (public.is_community_admin(community_id))
with check (public.is_community_admin(community_id));

drop policy if exists "match_predictions_owner_read" on public.match_predictions;
create policy "match_predictions_owner_read" on public.match_predictions
for select to authenticated using (user_id = auth.uid() or public.is_community_admin(community_id));

drop policy if exists "match_predictions_owner_write" on public.match_predictions;
create policy "match_predictions_owner_write" on public.match_predictions
for insert to authenticated
with check ((public.is_community_approved(community_id) and user_id = auth.uid()) or public.is_community_admin(community_id));

drop policy if exists "match_predictions_owner_update" on public.match_predictions;
create policy "match_predictions_owner_update" on public.match_predictions
for update to authenticated
using (user_id = auth.uid() or public.is_community_admin(community_id))
with check ((public.is_community_approved(community_id) and user_id = auth.uid()) or public.is_community_admin(community_id));

drop policy if exists "group_predictions_owner" on public.group_predictions;
create policy "group_predictions_owner" on public.group_predictions
for all to authenticated
using (user_id = auth.uid() or public.is_community_admin(community_id))
with check ((public.is_community_approved(community_id) and user_id = auth.uid()) or public.is_community_admin(community_id));

drop policy if exists "scorer_predictions_owner" on public.scorer_predictions;
create policy "scorer_predictions_owner" on public.scorer_predictions
for all to authenticated
using (user_id = auth.uid() or public.is_community_admin(community_id))
with check ((public.is_community_approved(community_id) and user_id = auth.uid()) or public.is_community_admin(community_id));

drop policy if exists "knockout_predictions_owner_read" on public.knockout_predictions;
create policy "knockout_predictions_owner_read" on public.knockout_predictions
for select to authenticated
using (user_id = auth.uid() or public.is_community_admin(community_id));

drop policy if exists "knockout_predictions_owner_insert" on public.knockout_predictions;
create policy "knockout_predictions_owner_insert" on public.knockout_predictions
for insert to authenticated
with check ((public.is_community_approved(community_id) and user_id = auth.uid()) or public.is_community_admin(community_id));

drop policy if exists "knockout_predictions_owner_update" on public.knockout_predictions;
create policy "knockout_predictions_owner_update" on public.knockout_predictions
for update to authenticated
using (user_id = auth.uid() or public.is_community_admin(community_id))
with check ((public.is_community_approved(community_id) and user_id = auth.uid()) or public.is_community_admin(community_id));

drop policy if exists "knockout_predictions_owner_delete" on public.knockout_predictions;
create policy "knockout_predictions_owner_delete" on public.knockout_predictions
for delete to authenticated
using (user_id = auth.uid() or public.is_community_admin(community_id));

create or replace function public.recalculate_points()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.point_events;

  insert into public.point_events (user_id, community_id, category, points, ref_type, ref_id, label)
  select
    mp.user_id,
    mp.community_id,
    'groups',
    case
      when mp.home_score = m.home_score and mp.away_score = m.away_score then 15
      when sign(mp.home_score - mp.away_score) = sign(m.home_score - m.away_score) then 8
      else 0
    end,
    'match',
    m.id,
    concat(m.home_team_name, ' vs ', m.away_team_name)
  from public.match_predictions mp
  join public.matches m on m.id = mp.match_id
  where (coalesce(m.round_number, 99) <= 3 or lower(m.phase) like '%group%' or lower(m.phase) like '%grupo%')
    and m.status = 'finished'
    and m.home_score is not null
    and m.away_score is not null
    and (
      mp.home_score = m.home_score and mp.away_score = m.away_score
      or sign(mp.home_score - mp.away_score) = sign(m.home_score - m.away_score)
    );

  insert into public.point_events (user_id, community_id, category, points, ref_type, ref_id, label)
  select
    kp.user_id,
    kp.community_id,
    'knockout',
    10,
    'knockout_match',
    concat(m.id, ':', kp.predicted_home_team_id),
    concat('Equipo acertado en ', m.phase, ': ', kp.predicted_home_team_name)
  from public.knockout_predictions kp
  join public.matches m on m.id = kp.match_id
  where (
      coalesce(m.round_number, 0) >= 4
      or (m.group_code is null and lower(m.phase) not like '%group%' and lower(m.phase) not like '%grupo%')
    )
    and m.home_team_id is not null
    and m.away_team_id is not null
    and kp.predicted_home_team_id is not null
    and kp.predicted_away_team_id is not null
    and (
      (kp.predicted_home_team_id = m.home_team_id and kp.predicted_away_team_id = m.away_team_id)
      or (kp.predicted_home_team_id = m.away_team_id and kp.predicted_away_team_id = m.home_team_id)
    )
    and kp.predicted_home_team_id in (m.home_team_id, m.away_team_id)
  union all
  select
    kp.user_id,
    kp.community_id,
    'knockout',
    10,
    'knockout_match',
    concat(m.id, ':', kp.predicted_away_team_id),
    concat('Equipo acertado en ', m.phase, ': ', kp.predicted_away_team_name)
  from public.knockout_predictions kp
  join public.matches m on m.id = kp.match_id
  where (
      coalesce(m.round_number, 0) >= 4
      or (m.group_code is null and lower(m.phase) not like '%group%' and lower(m.phase) not like '%grupo%')
    )
    and m.home_team_id is not null
    and m.away_team_id is not null
    and kp.predicted_home_team_id is not null
    and kp.predicted_away_team_id is not null
    and (
      (kp.predicted_home_team_id = m.home_team_id and kp.predicted_away_team_id = m.away_team_id)
      or (kp.predicted_home_team_id = m.away_team_id and kp.predicted_away_team_id = m.home_team_id)
    )
    and kp.predicted_away_team_id in (m.home_team_id, m.away_team_id);

  with group_finished as (
    select group_code
    from public.matches
    where round_number <= 3 and group_code is not null
    group by group_code
    having count(*) filter (where status = 'finished' and home_score is not null and away_score is not null) >= 6
  ),
  team_rows as (
    select group_code, home_team_id team_id, home_team_name team_name, home_team_code team_code,
      count(*) filter (where status = 'finished') pj,
      sum(case when status = 'finished' then home_score else 0 end) gf,
      sum(case when status = 'finished' then away_score else 0 end) ga,
      sum(case
        when status <> 'finished' then 0
        when home_score > away_score then 3
        when home_score = away_score then 1
        else 0
      end) pts
    from public.matches
    where round_number <= 3 and group_code is not null
    group by group_code, home_team_id, home_team_name, home_team_code
    union all
    select group_code, away_team_id team_id, away_team_name team_name, away_team_code team_code,
      count(*) filter (where status = 'finished') pj,
      sum(case when status = 'finished' then away_score else 0 end) gf,
      sum(case when status = 'finished' then home_score else 0 end) ga,
      sum(case
        when status <> 'finished' then 0
        when away_score > home_score then 3
        when away_score = home_score then 1
        else 0
      end) pts
    from public.matches
    where round_number <= 3 and group_code is not null
    group by group_code, away_team_id, away_team_name, away_team_code
  ),
  table_rows as (
    select
      tr.group_code,
      tr.team_id,
      max(tr.team_name) team_name,
      sum(tr.pj) pj,
      sum(tr.gf) gf,
      sum(tr.ga) ga,
      sum(tr.pts) pts,
      row_number() over (
        partition by tr.group_code
        order by sum(tr.pts) desc, (sum(tr.gf) - sum(tr.ga)) desc, sum(tr.gf) desc, max(tr.team_name) asc
      ) position
    from team_rows tr
    join group_finished gf on gf.group_code = tr.group_code
    where tr.team_id is not null
    group by tr.group_code, tr.team_id
  )
  insert into public.point_events (user_id, community_id, category, points, ref_type, ref_id, label)
  select gp.user_id, gp.community_id, 'qualified', 15, 'group', gp.group_code, concat('1º Grupo ', gp.group_code, ': ', tr.team_name)
  from public.group_predictions gp
  join table_rows tr on tr.group_code = gp.group_code and tr.position = 1 and tr.team_id = gp.first_team_id
  union all
  select gp.user_id, gp.community_id, 'qualified', 15, 'group', gp.group_code, concat('2º Grupo ', gp.group_code, ': ', tr.team_name)
  from public.group_predictions gp
  join table_rows tr on tr.group_code = gp.group_code and tr.position = 2 and tr.team_id = gp.second_team_id;

  insert into public.point_events (user_id, community_id, category, points, ref_type, ref_id, label)
  select
    sp.user_id,
    sp.community_id,
    'scorer',
    pg.goals * 10,
    'scorer',
    pg.player_key,
    concat(pg.player_name, ' - ', pg.goals, ' goles')
  from public.scorer_predictions sp
  join public.player_goals pg
    on lower(trim(pg.player_name)) = lower(trim(sp.player_name))
   and (sp.team_id is null or pg.team_id is null or sp.team_id = pg.team_id)
  where pg.goals > 0;

  update public.community_memberships cm
  set
    points_groups = coalesce(s.groups, 0),
    points_knockout = coalesce(s.knockout, 0),
    points_scorer = coalesce(s.scorer, 0),
    points_qualified = coalesce(s.qualified, 0),
    total_points = coalesce(s.groups, 0) + coalesce(s.knockout, 0) + coalesce(s.scorer, 0) + coalesce(s.qualified, 0),
    updated_at = now()
  from (
    select
      user_id,
      community_id,
      sum(points) filter (where category = 'groups') groups,
      sum(points) filter (where category = 'knockout') knockout,
      sum(points) filter (where category = 'scorer') scorer,
      sum(points) filter (where category = 'qualified') qualified
    from public.point_events
    group by user_id, community_id
  ) s
  where cm.user_id = s.user_id
    and cm.community_id = s.community_id;

  update public.community_memberships cm
  set points_groups = 0,
      points_knockout = 0,
      points_scorer = 0,
      points_qualified = 0,
      total_points = 0,
      updated_at = now()
  where not exists (
    select 1
    from public.point_events pe
    where pe.user_id = cm.user_id
      and pe.community_id = cm.community_id
  );
end;
$$;
