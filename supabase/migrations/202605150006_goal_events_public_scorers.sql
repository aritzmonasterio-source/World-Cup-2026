create table if not exists public.match_goal_events (
  event_key text primary key,
  match_id text not null references public.matches(id) on delete cascade,
  match_number integer null,
  player_name text not null,
  team_id text null references public.teams(id),
  team_name text null,
  team_code text null,
  minute integer null,
  penalty boolean not null default false,
  own_goal boolean not null default false,
  raw jsonb null,
  updated_at timestamptz not null default now()
);

create index if not exists match_goal_events_match_id_idx on public.match_goal_events(match_id);
create index if not exists match_goal_events_player_name_idx on public.match_goal_events(lower(player_name));
create index if not exists match_goal_events_team_id_idx on public.match_goal_events(team_id);

alter table public.match_goal_events enable row level security;

drop policy if exists "match_goal_events_read" on public.match_goal_events;
create policy "match_goal_events_read" on public.match_goal_events
for select to anon, authenticated
using (true);

drop policy if exists "match_goal_events_admin" on public.match_goal_events;
create policy "match_goal_events_admin" on public.match_goal_events
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "player_goals_read" on public.player_goals;
create policy "player_goals_read" on public.player_goals
for select to anon, authenticated
using (true);
