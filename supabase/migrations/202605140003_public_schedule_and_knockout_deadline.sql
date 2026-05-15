drop policy if exists "read_competition_data" on public.teams;
create policy "read_competition_data" on public.teams
for select to anon, authenticated using (true);

drop policy if exists "read_matches" on public.matches;
create policy "read_matches" on public.matches
for select to anon, authenticated using (true);

comment on table public.matches is 'World Cup 2026 schedule and results. Publicly readable so visitors can browse the calendar before registering.';
comment on table public.teams is 'World Cup 2026 teams. Publicly readable for calendar flags and group previews.';
