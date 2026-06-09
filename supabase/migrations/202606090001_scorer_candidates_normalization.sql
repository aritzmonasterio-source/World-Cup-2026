create or replace function public.normalize_player_name(value text)
returns text
language sql
immutable
as $$
  select regexp_replace(
    translate(
      lower(coalesce(value, '')),
      'áàäâãåéèëêíìïîóòöôõúùüûñçýÿ',
      'aaaaaaeeeeiiiiooooouuuuncyy'
    ),
    '[^a-z0-9]+',
    '',
    'g'
  );
$$;

create table if not exists public.scorer_candidate_aliases (
  player_name text not null,
  alias text not null,
  primary key (player_name, alias)
);

alter table public.scorer_candidate_aliases enable row level security;

insert into public.scorer_candidate_aliases (player_name, alias)
values
  ('Kylian Mbappé', 'Kylian Mbappé'),
  ('Kylian Mbappé', 'Kylian Mbappe'),
  ('Kylian Mbappé', 'Mbappé'),
  ('Kylian Mbappé', 'Mbappe'),
  ('Kylian Mbappé', 'K. Mbappé'),
  ('Harry Kane', 'Harry Kane'),
  ('Harry Kane', 'Kane'),
  ('Harry Kane', 'H. Kane'),
  ('Erling Haaland', 'Erling Haaland'),
  ('Erling Haaland', 'Haaland'),
  ('Erling Haaland', 'E. Haaland'),
  ('Lamine Yamal', 'Lamine Yamal'),
  ('Lamine Yamal', 'Yamal'),
  ('Lamine Yamal', 'L. Yamal'),
  ('Vinícius Júnior', 'Vinícius Júnior'),
  ('Vinícius Júnior', 'Vinicius Junior'),
  ('Vinícius Júnior', 'Vinícius Jr'),
  ('Vinícius Júnior', 'Vinicius Jr'),
  ('Vinícius Júnior', 'Vini Jr'),
  ('Julián Álvarez', 'Julián Álvarez'),
  ('Julián Álvarez', 'Julian Alvarez'),
  ('Julián Álvarez', 'Julián Alvarez'),
  ('Julián Álvarez', 'Álvarez'),
  ('Julián Álvarez', 'Alvarez'),
  ('Mikel Oyarzabal', 'Mikel Oyarzabal'),
  ('Mikel Oyarzabal', 'Oyarzabal'),
  ('Lionel Messi', 'Lionel Messi'),
  ('Lionel Messi', 'Leo Messi'),
  ('Lionel Messi', 'Messi'),
  ('Cristiano Ronaldo', 'Cristiano Ronaldo'),
  ('Cristiano Ronaldo', 'Cristiano'),
  ('Cristiano Ronaldo', 'Ronaldo'),
  ('Cristiano Ronaldo', 'CR7'),
  ('Ousmane Dembélé', 'Ousmane Dembélé'),
  ('Ousmane Dembélé', 'Ousmane Dembele'),
  ('Ousmane Dembélé', 'Dembélé'),
  ('Ousmane Dembélé', 'Dembele'),
  ('Raphinha', 'Raphinha'),
  ('Lautaro Martínez', 'Lautaro Martínez'),
  ('Lautaro Martínez', 'Lautaro Martinez'),
  ('Lautaro Martínez', 'Lautaro'),
  ('Luis Díaz', 'Luis Díaz'),
  ('Luis Díaz', 'Luis Diaz'),
  ('Luis Díaz', 'Luiz Diaz'),
  ('Viktor Gyökeres', 'Viktor Gyökeres'),
  ('Viktor Gyökeres', 'Viktor Gyokeres'),
  ('Viktor Gyökeres', 'Gyökeres'),
  ('Viktor Gyökeres', 'Gyokeres'),
  ('Bukayo Saka', 'Bukayo Saka'),
  ('Bukayo Saka', 'Saka'),
  ('Michael Olise', 'Michael Olise'),
  ('Michael Olise', 'Olise'),
  ('Darwin Núñez', 'Darwin Núñez'),
  ('Darwin Núñez', 'Darwin Nunez'),
  ('Darwin Núñez', 'Núñez'),
  ('Darwin Núñez', 'Nunez'),
  ('João Pedro', 'João Pedro'),
  ('João Pedro', 'Joao Pedro'),
  ('Jude Bellingham', 'Jude Bellingham'),
  ('Jude Bellingham', 'Bellingham'),
  ('Endrick', 'Endrick'),
  ('Endrick', 'Endrick Felipe'),
  ('Arda Güler', 'Arda Güler'),
  ('Arda Güler', 'Arda Guler'),
  ('Arda Güler', 'Güler'),
  ('Arda Güler', 'Guler'),
  ('Rayan Cherki', 'Rayan Cherki'),
  ('Rayan Cherki', 'Cherki'),
  ('Alexander Isak', 'Alexander Isak'),
  ('Alexander Isak', 'Isak'),
  ('Gonçalo Ramos', 'Gonçalo Ramos'),
  ('Gonçalo Ramos', 'Goncalo Ramos'),
  ('Gonçalo Ramos', 'Ramos'),
  ('Richarlison', 'Richarlison')
on conflict (player_name, alias) do nothing;

do $$
declare
  original_definition text;
  function_definition text;
begin
  select pg_get_functiondef('public.recalculate_points()'::regprocedure)
  into original_definition;

  function_definition := regexp_replace(
    original_definition,
    'from public\.scorer_predictions sp[[:space:]]+join public\.player_goals pg[[:space:]]+on lower\(trim\(pg\.player_name\)\) = lower\(trim\(sp\.player_name\)\)[[:space:]]+and \(sp\.team_id is null or pg\.team_id is null or sp\.team_id = pg\.team_id\)[[:space:]]+where pg\.goals > 0;',
    'from public.scorer_predictions sp
  join public.player_goals pg
    on (
      public.normalize_player_name(pg.player_name) = public.normalize_player_name(sp.player_name)
      or exists (
        select 1
        from public.scorer_candidate_aliases sca
        where public.normalize_player_name(sca.player_name) = public.normalize_player_name(sp.player_name)
          and public.normalize_player_name(sca.alias) = public.normalize_player_name(pg.player_name)
      )
    )
   and (
      sp.team_id is null
      or pg.team_id is null
      or sp.team_id = pg.team_id
      or (sp.team_code is not null and pg.team_code is not null and sp.team_code = pg.team_code)
   )
  where pg.goals > 0;',
    'i'
  );

  if function_definition = original_definition and position('public.normalize_player_name(pg.player_name)' in original_definition) = 0 then
    raise exception 'No se pudo reforzar public.recalculate_points para goleadores';
  end if;

  execute function_definition;
end $$;
