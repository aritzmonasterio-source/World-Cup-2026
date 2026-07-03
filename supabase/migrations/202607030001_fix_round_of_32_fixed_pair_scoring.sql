create or replace function public.expected_knockout_point_events()
returns table (
  user_id uuid,
  community_id text,
  category text,
  points integer,
  ref_type text,
  ref_id text,
  label text
)
language sql
stable
security definer
set search_path = public
as $$
  with knockout_base as (
    select
      kp.user_id,
      kp.community_id,
      kp.match_id,
      case when flags.fixed_round_of_32 then m.home_team_id else kp.predicted_home_team_id end predicted_home_team_id,
      case when flags.fixed_round_of_32 then m.home_team_name else kp.predicted_home_team_name end predicted_home_team_name,
      case when flags.fixed_round_of_32 then m.away_team_id else kp.predicted_away_team_id end predicted_away_team_id,
      case when flags.fixed_round_of_32 then m.away_team_name else kp.predicted_away_team_name end predicted_away_team_name,
      kp.predicted_home_score,
      kp.predicted_away_score,
      m.phase,
      m.home_team_id,
      m.away_team_id,
      m.home_team_name,
      m.away_team_name,
      m.home_score,
      m.away_score,
      flags.fixed_round_of_32,
      case
        when flags.fixed_round_of_32
          and kp.predicted_home_score is not null
          and kp.predicted_away_score is not null then true
        when kp.predicted_home_team_id = m.home_team_id and kp.predicted_away_team_id = m.away_team_id then true
        when kp.predicted_home_team_id = m.away_team_id and kp.predicted_away_team_id = m.home_team_id then true
        else false
      end as pair_matched,
      case
        when flags.fixed_round_of_32 then kp.predicted_home_score
        when kp.predicted_home_team_id = m.home_team_id and kp.predicted_away_team_id = m.away_team_id then kp.predicted_home_score
        when kp.predicted_home_team_id = m.away_team_id and kp.predicted_away_team_id = m.home_team_id then kp.predicted_away_score
        else null
      end as predicted_real_home_score,
      case
        when flags.fixed_round_of_32 then kp.predicted_away_score
        when kp.predicted_home_team_id = m.home_team_id and kp.predicted_away_team_id = m.away_team_id then kp.predicted_away_score
        when kp.predicted_home_team_id = m.away_team_id and kp.predicted_away_team_id = m.home_team_id then kp.predicted_home_score
        else null
      end as predicted_real_away_score
    from public.knockout_predictions kp
    join public.matches m on m.id = kp.match_id
    cross join lateral (
      select (
        coalesce(m.round_number, 0) = 4
        or lower(coalesce(m.phase, '')) like '%dieciseis%'
        or lower(coalesce(m.phase, '')) like '%round of 32%'
        or lower(coalesce(m.phase, '')) like '%ronda de 32%'
      ) fixed_round_of_32
    ) flags
    where (
        coalesce(m.round_number, 0) >= 4
        or (m.group_code is null and lower(m.phase) not like '%group%' and lower(m.phase) not like '%grupo%')
      )
      and m.status = 'finished'
      and m.home_team_id is not null
      and m.away_team_id is not null
      and m.home_score is not null
      and m.away_score is not null
      and (
        flags.fixed_round_of_32
        or (
          kp.predicted_home_team_id is not null
          and kp.predicted_away_team_id is not null
          and kp.predicted_home_team_id <> kp.predicted_away_team_id
        )
      )
  )
  select
    kb.user_id,
    kb.community_id,
    'knockout',
    10,
    'knockout_match',
    concat(kb.match_id, ':', kb.predicted_home_team_id),
    concat('Equipo acertado en ', kb.phase, ': ', kb.predicted_home_team_name)
  from knockout_base kb
  where kb.pair_matched
    and kb.predicted_home_team_id in (kb.home_team_id, kb.away_team_id)

  union all

  select
    kb.user_id,
    kb.community_id,
    'knockout',
    10,
    'knockout_match',
    concat(kb.match_id, ':', kb.predicted_away_team_id),
    concat('Equipo acertado en ', kb.phase, ': ', kb.predicted_away_team_name)
  from knockout_base kb
  where kb.pair_matched
    and kb.predicted_away_team_id in (kb.home_team_id, kb.away_team_id)

  union all

  select
    kb.user_id,
    kb.community_id,
    'knockout',
    case
      when kb.predicted_real_home_score = kb.home_score and kb.predicted_real_away_score = kb.away_score then 15
      when sign(kb.predicted_real_home_score - kb.predicted_real_away_score) = sign(kb.home_score - kb.away_score) then 8
      else 0
    end,
    'knockout_score',
    kb.match_id,
    concat(
      'Marcador eliminatoria: ',
      kb.home_team_name,
      ' ',
      kb.predicted_real_home_score,
      '-',
      kb.predicted_real_away_score,
      ' ',
      kb.away_team_name
    )
  from knockout_base kb
  where kb.pair_matched
    and kb.predicted_real_home_score is not null
    and kb.predicted_real_away_score is not null
    and (
      kb.predicted_real_home_score = kb.home_score and kb.predicted_real_away_score = kb.away_score
      or sign(kb.predicted_real_home_score - kb.predicted_real_away_score) = sign(kb.home_score - kb.away_score)
    );
$$;

revoke all on function public.expected_knockout_point_events() from public;

update public.knockout_predictions kp
set
  predicted_home_team_id = m.home_team_id,
  predicted_home_team_name = m.home_team_name,
  predicted_home_team_code = m.home_team_code,
  predicted_away_team_id = m.away_team_id,
  predicted_away_team_name = m.away_team_name,
  predicted_away_team_code = m.away_team_code,
  updated_at = now()
from public.matches m
where m.id = kp.match_id
  and (
    coalesce(m.round_number, 0) = 4
    or lower(coalesce(m.phase, '')) like '%dieciseis%'
    or lower(coalesce(m.phase, '')) like '%round of 32%'
    or lower(coalesce(m.phase, '')) like '%ronda de 32%'
  )
  and m.home_team_id is not null
  and m.away_team_id is not null
  and (
    kp.predicted_home_team_id is distinct from m.home_team_id
    or kp.predicted_home_team_name is distinct from m.home_team_name
    or kp.predicted_home_team_code is distinct from m.home_team_code
    or kp.predicted_away_team_id is distinct from m.away_team_id
    or kp.predicted_away_team_name is distinct from m.away_team_name
    or kp.predicted_away_team_code is distinct from m.away_team_code
  );

select public.recalculate_points();

do $$
begin
  if to_regprocedure('public.recalculate_scorer_points()') is not null then
    perform public.recalculate_scorer_points();
  end if;
end $$;
