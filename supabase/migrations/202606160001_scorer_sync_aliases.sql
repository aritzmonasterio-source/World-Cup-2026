insert into public.scorer_candidate_aliases (player_name, alias)
values
  ('Raphinha', 'Rapinha'),
  ('Raphinha', 'Rapha'),
  ('Vinícius Júnior', 'Vinicius Junior'),
  ('Vinícius Júnior', 'Vini Jr.'),
  ('Cristiano Ronaldo', 'C. Ronaldo'),
  ('Kylian Mbappé', 'Kylian Mbappe Lottin'),
  ('Julián Álvarez', 'Julian Alvarez'),
  ('Ousmane Dembélé', 'Ousmane Dembele'),
  ('Luis Díaz', 'Luis Diaz'),
  ('Viktor Gyökeres', 'Viktor Gyokeres'),
  ('Darwin Núñez', 'Darwin Nunez'),
  ('João Pedro', 'Joao Pedro'),
  ('Arda Güler', 'Arda Guler'),
  ('Gonçalo Ramos', 'Goncalo Ramos')
on conflict (player_name, alias) do nothing;
