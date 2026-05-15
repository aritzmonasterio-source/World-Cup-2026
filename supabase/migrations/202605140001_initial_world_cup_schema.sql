create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  username text not null default 'Usuario',
  role text not null default 'player' check (role in ('player', 'admin')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'blocked')),
  total_points integer not null default 0,
  points_groups integer not null default 0,
  points_knockout integer not null default 0,
  points_scorer integer not null default 0,
  points_qualified integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.teams (
  id text primary key,
  code text not null,
  name text not null,
  group_code text,
  flag_url text,
  raw jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.matches (
  id text primary key,
  fifa_match_id text not null unique,
  match_number integer,
  round_number integer,
  phase text not null,
  group_code text,
  stage_name text,
  home_team_id text,
  away_team_id text,
  home_team_name text not null default 'Por definir',
  away_team_name text not null default 'Por definir',
  home_team_code text,
  away_team_code text,
  kickoff_at timestamptz not null,
  local_kickoff_at timestamptz,
  venue text,
  city text,
  status text not null default 'scheduled' check (status in ('scheduled', 'live', 'finished', 'postponed')),
  home_score integer,
  away_score integer,
  home_penalty_score integer,
  away_penalty_score integer,
  winner_team_id text,
  raw jsonb,
  synced_at timestamptz not null default now()
);

create table if not exists public.match_predictions (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  match_id text not null references public.matches(id) on delete cascade,
  home_score integer not null check (home_score between 0 and 30),
  away_score integer not null check (away_score between 0 and 30),
  points_awarded integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (user_id, match_id)
);

create table if not exists public.group_predictions (
  user_id uuid not null references public.profiles(id) on delete cascade,
  group_code text not null,
  first_team_id text,
  first_team_name text,
  first_team_code text,
  second_team_id text,
  second_team_name text,
  second_team_code text,
  updated_at timestamptz not null default now(),
  primary key (user_id, group_code),
  check (first_team_id is null or second_team_id is null or first_team_id <> second_team_id)
);

create table if not exists public.scorer_predictions (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  player_name text not null,
  team_id text,
  team_name text,
  team_code text,
  updated_at timestamptz not null default now()
);

create table if not exists public.player_goals (
  player_key text primary key,
  player_name text not null,
  team_id text,
  team_name text,
  team_code text,
  goals integer not null default 0 check (goals >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.point_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  category text not null check (category in ('groups', 'knockout', 'scorer', 'qualified')),
  points integer not null,
  ref_type text not null,
  ref_id text not null,
  label text,
  created_at timestamptz not null default now()
);

create table if not exists public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'fifa',
  ok boolean not null default false,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  matches_seen integer not null default 0,
  matches_upserted integer not null default 0,
  error text,
  raw jsonb
);

create index if not exists matches_group_idx on public.matches(group_code);
create index if not exists matches_round_idx on public.matches(round_number);
create index if not exists matches_kickoff_idx on public.matches(kickoff_at);
create index if not exists point_events_user_idx on public.point_events(user_id);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and status = 'approved'
  );
$$;

create or replace function public.is_approved()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and status = 'approved'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, username, role, status)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1), 'Usuario'),
    case when lower(new.email) = lower(coalesce(current_setting('app.admin_email', true), 'aritzmonasterio@gmail.com')) then 'admin' else 'player' end,
    case when lower(new.email) = lower(coalesce(current_setting('app.admin_email', true), 'aritzmonasterio@gmail.com')) then 'approved' else 'pending' end
  )
  on conflict (id) do update set
    email = excluded.email,
    username = coalesce(public.profiles.username, excluded.username),
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.matches enable row level security;
alter table public.match_predictions enable row level security;
alter table public.group_predictions enable row level security;
alter table public.scorer_predictions enable row level security;
alter table public.player_goals enable row level security;
alter table public.point_events enable row level security;
alter table public.sync_runs enable row level security;

drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated" on public.profiles
for select to authenticated using (true);

drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin" on public.profiles
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "read_competition_data" on public.teams;
create policy "read_competition_data" on public.teams
for select to anon, authenticated using (true);

drop policy if exists "admin_write_teams" on public.teams;
create policy "admin_write_teams" on public.teams
for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "read_matches" on public.matches;
create policy "read_matches" on public.matches
for select to anon, authenticated using (true);

drop policy if exists "admin_write_matches" on public.matches;
create policy "admin_write_matches" on public.matches
for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "match_predictions_owner_read" on public.match_predictions;
create policy "match_predictions_owner_read" on public.match_predictions
for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists "match_predictions_owner_write" on public.match_predictions;
create policy "match_predictions_owner_write" on public.match_predictions
for insert to authenticated with check (public.is_approved() and user_id = auth.uid());

drop policy if exists "match_predictions_owner_update" on public.match_predictions;
create policy "match_predictions_owner_update" on public.match_predictions
for update to authenticated using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "group_predictions_owner" on public.group_predictions;
create policy "group_predictions_owner" on public.group_predictions
for all to authenticated using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "scorer_predictions_owner" on public.scorer_predictions;
create policy "scorer_predictions_owner" on public.scorer_predictions
for all to authenticated using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "player_goals_read" on public.player_goals;
create policy "player_goals_read" on public.player_goals
for select to authenticated using (true);

drop policy if exists "player_goals_admin" on public.player_goals;
create policy "player_goals_admin" on public.player_goals
for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "point_events_read" on public.point_events;
create policy "point_events_read" on public.point_events
for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists "sync_runs_admin" on public.sync_runs;
create policy "sync_runs_admin" on public.sync_runs
for all to authenticated using (public.is_admin()) with check (public.is_admin());
