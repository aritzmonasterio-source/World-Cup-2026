import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0';

const FIFA_URL = 'https://api.fifa.com/api/v3/calendar/matches?idCompetition=17&idSeason=285023&language=en&count=120';
const ESPN_SCORERS_URLS = [
  'https://site.web.api.espn.com/apis/site/v2/sports/soccer/fifa.world/statistics?region=es&lang=es&contentorigin=espn&season=2026',
  'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/statistics?region=es&lang=es&season=2026',
  'https://site.web.api.espn.com/apis/site/v2/sports/soccer/fifa.world/statistics?region=us&lang=es&contentorigin=espn&season=2026',
  'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/statistics?region=us&lang=es&season=2026',
  'https://espndeportes.espn.com/futbol/estadisticas/_/liga/FIFA.WORLD/temporada/2026/copa-mundial',
];
const FBREF_SCORERS_URLS = [
  'https://fbref.com/en/comps/1/World-Cup-Stats',
  'https://fbref.com/en/comps/1/stats/World-Cup-Stats',
];
const ESPN_SCOREBOARD_URL = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260611-20260720&limit=300&region=es&lang=es';
const ESPN_SUMMARY_URL = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?region=es&lang=es&event=';

const TEAM_NAME_ES: Record<string, string> = {
  MEX: 'México', RSA: 'Sudáfrica', KOR: 'Corea del Sur', CZE: 'Chequia',
  CAN: 'Canadá', BIH: 'Bosnia y Herzegovina', QAT: 'Qatar', SUI: 'Suiza',
  BRA: 'Brasil', MAR: 'Marruecos', HAI: 'Haití', SCO: 'Escocia',
  USA: 'Estados Unidos', PAR: 'Paraguay', AUS: 'Australia', TUR: 'Turquía',
  GER: 'Alemania', CUW: 'Curazao', CIV: 'Costa de Marfil', ECU: 'Ecuador',
  NED: 'Países Bajos', JPN: 'Japón', SWE: 'Suecia', TUN: 'Túnez',
  BEL: 'Bélgica', EGY: 'Egipto', IRN: 'Irán', NZL: 'Nueva Zelanda',
  ESP: 'España', CPV: 'Cabo Verde', KSA: 'Arabia Saudí', URU: 'Uruguay',
  FRA: 'Francia', SEN: 'Senegal', IRQ: 'Irak', NOR: 'Noruega',
  ARG: 'Argentina', ALG: 'Argelia', AUT: 'Austria', JOR: 'Jordania',
  POR: 'Portugal', COD: 'RD Congo', UZB: 'Uzbekistán', COL: 'Colombia',
  ENG: 'Inglaterra', CRO: 'Croacia', GHA: 'Ghana', PAN: 'Panamá',
};

const FLAG_BY_CODE: Record<string, string> = {
  MEX: 'mx', RSA: 'za', KOR: 'kr', CZE: 'cz', CAN: 'ca', BIH: 'ba', QAT: 'qa', SUI: 'ch',
  BRA: 'br', MAR: 'ma', HAI: 'ht', SCO: 'gb-sct', USA: 'us', PAR: 'py', AUS: 'au', TUR: 'tr',
  GER: 'de', CUW: 'cw', CIV: 'ci', ECU: 'ec', NED: 'nl', JPN: 'jp', SWE: 'se', TUN: 'tn',
  BEL: 'be', EGY: 'eg', IRN: 'ir', NZL: 'nz', ESP: 'es', CPV: 'cv', KSA: 'sa', URU: 'uy',
  FRA: 'fr', SEN: 'sn', IRQ: 'iq', NOR: 'no', ARG: 'ar', ALG: 'dz', AUT: 'at', JOR: 'jo',
  POR: 'pt', COD: 'cd', UZB: 'uz', COL: 'co', ENG: 'gb-eng', CRO: 'hr', GHA: 'gh', PAN: 'pa',
};

const ESPN_TEAM_CODE_ALIAS: Record<string, string> = {
  ALE: 'GER',
  CUR: 'CUW',
  EGI: 'EGY',
  EUA: 'USA',
  SAU: 'KSA',
  SUE: 'SWE',
};

const TEAM_CODE_BY_NAME: Record<string, string> = Object.entries(TEAM_NAME_ES).reduce((acc, [code, name]) => {
  acc[normalizeText(name)] = code;
  return acc;
}, {
  [normalizeText('Mexico')]: 'MEX',
  [normalizeText('South Africa')]: 'RSA',
  [normalizeText('Czechia')]: 'CZE',
  [normalizeText('Switzerland')]: 'SUI',
  [normalizeText('Brazil')]: 'BRA',
  [normalizeText('Morocco')]: 'MAR',
  [normalizeText('Haiti')]: 'HAI',
  [normalizeText('Scotland')]: 'SCO',
  [normalizeText('United States')]: 'USA',
  [normalizeText('Germany')]: 'GER',
  [normalizeText('Netherlands')]: 'NED',
  [normalizeText('Spain')]: 'ESP',
  [normalizeText('France')]: 'FRA',
  [normalizeText('Norway')]: 'NOR',
  [normalizeText('Argentina')]: 'ARG',
  [normalizeText('Algeria')]: 'ALG',
  [normalizeText('Argelia')]: 'ALG',
  [normalizeText('Arabia Saudita')]: 'KSA',
  [normalizeText('Portugal')]: 'POR',
  [normalizeText('Colombia')]: 'COL',
  [normalizeText('England')]: 'ENG',
  [normalizeText('Uruguay')]: 'URU',
  [normalizeText('Sweden')]: 'SWE',
  [normalizeText('Turkey')]: 'TUR',
  [normalizeText('Curacao')]: 'CUW',
  [normalizeText('Curaçao')]: 'CUW',
  [normalizeText('República Democrática del Congo')]: 'COD',
  [normalizeText('Republica Democratica del Congo')]: 'COD',
} as Record<string, string>);

const CANONICAL_SCORER_NAMES: Record<string, string> = [
  'Kylian Mbappé', 'Harry Kane', 'Erling Haaland', 'Lamine Yamal', 'Vinícius Júnior',
  'Julián Álvarez', 'Mikel Oyarzabal', 'Lionel Messi', 'Cristiano Ronaldo',
  'Ousmane Dembélé', 'Raphinha', 'Lautaro Martínez', 'Luis Díaz', 'Viktor Gyökeres',
  'Bukayo Saka', 'Michael Olise', 'Darwin Núñez', 'João Pedro', 'Jude Bellingham',
  'Endrick', 'Arda Güler', 'Rayan Cherki', 'Alexander Isak', 'Gonçalo Ramos',
  'Richarlison',
].reduce((acc, name) => {
  acc[normalizeText(name)] = name;
  return acc;
}, {
  [normalizeText('Kylian Mbappe')]: 'Kylian Mbappé',
  [normalizeText('Mbappe')]: 'Kylian Mbappé',
  [normalizeText('K. Mbappé')]: 'Kylian Mbappé',
  [normalizeText('K. Mbappe')]: 'Kylian Mbappé',
  [normalizeText('Kane')]: 'Harry Kane',
  [normalizeText('H. Kane')]: 'Harry Kane',
  [normalizeText('H Kane')]: 'Harry Kane',
  [normalizeText('Vinicius Junior')]: 'Vinícius Júnior',
  [normalizeText('Vinicius Jr')]: 'Vinícius Júnior',
  [normalizeText('Vini Jr')]: 'Vinícius Júnior',
  [normalizeText('Julian Alvarez')]: 'Julián Álvarez',
  [normalizeText('Ousmane Dembele')]: 'Ousmane Dembélé',
  [normalizeText('Rapinha')]: 'Raphinha',
  [normalizeText('Leo Messi')]: 'Lionel Messi',
  [normalizeText('Messi')]: 'Lionel Messi',
  [normalizeText('C. Ronaldo')]: 'Cristiano Ronaldo',
  [normalizeText('CR7')]: 'Cristiano Ronaldo',
  [normalizeText('Lautaro Martinez')]: 'Lautaro Martínez',
  [normalizeText('Luis Diaz')]: 'Luis Díaz',
  [normalizeText('Luiz Diaz')]: 'Luis Díaz',
  [normalizeText('Viktor Gyokeres')]: 'Viktor Gyökeres',
  [normalizeText('Darwin Nunez')]: 'Darwin Núñez',
  [normalizeText('Joao Pedro')]: 'João Pedro',
  [normalizeText('Arda Guler')]: 'Arda Güler',
  [normalizeText('Goncalo Ramos')]: 'Gonçalo Ramos',
  [normalizeText('Bellingham')]: 'Jude Bellingham',
  [normalizeText('Saka')]: 'Bukayo Saka',
  [normalizeText('Olise')]: 'Michael Olise',
  [normalizeText('Isak')]: 'Alexander Isak',
} as Record<string, string>);

Deno.serve(async () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRole) {
    return new Response(JSON.stringify({ error: 'Missing Supabase env vars' }), { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRole);
  const startedAt = new Date().toISOString();
  let syncRun: { id: string } | null = null;

  try {
    const { data: syncRunData, error: syncRunError } = await supabase
      .from('sync_runs')
      .insert({ started_at: startedAt, source: 'fifa' })
      .select('id')
      .single();
    assertNoError(syncRunError, 'sync_runs insert');
    syncRun = syncRunData;

    const response = await fetch(FIFA_URL, {
      headers: { 'user-agent': 'WorldCup2026Predictor/1.0' },
    });
    if (!response.ok) throw new Error(`FIFA returned ${response.status}`);
    const payload = await response.json();
    const results = readMatchResults(payload);
    if (!results.length) throw new Error(`FIFA payload sin partidos. Keys: ${Object.keys(payload || {}).join(', ')}`);

    const teamRows = new Map<string, unknown>();
    const goalEvents: GoalEventRow[] = [];
    const matchRows = results.map((match: any) => {
      const home = normalizeTeam(match.Home);
      const away = normalizeTeam(match.Away);
      const groupCode = groupFromName(match.GroupName?.[0]?.Description);
      const matchNumber = numberOrNull(match.MatchNumber);
      const matchId = readString(match.IdMatch) || readString(match.Id) || readString(match.MatchId);
      const kickoffAt = readValidDate(match.Date || match.MatchDate || match.DateTime || match.MatchDateTime);
      const localKickoffAt = readValidDate(match.LocalDate || match.LocalDateTime);
      if (!matchId) throw new Error(`Partido FIFA sin IdMatch: ${JSON.stringify(match).slice(0, 300)}`);
      if (!kickoffAt) throw new Error(`Partido FIFA sin fecha valida: ${matchId}`);
      if (home?.id) teamRows.set(home.id, { ...home, group_code: groupCode, raw: match.Home, updated_at: new Date().toISOString() });
      if (away?.id) teamRows.set(away.id, { ...away, group_code: groupCode, raw: match.Away, updated_at: new Date().toISOString() });
      goalEvents.push(...extractGoalEvents(match, matchId, home, away, matchNumber));

      return {
        id: matchId,
        fifa_match_id: matchId,
        match_number: matchNumber,
        round_number: numberOrNull(match.MatchDay) || roundFromStage(match.StageName?.[0]?.Description, match.MatchNumber),
        phase: phaseName(match),
        group_code: groupCode,
        stage_name: match.StageName?.[0]?.Description || null,
        home_team_id: home?.id || null,
        away_team_id: away?.id || null,
        home_team_name: home?.name || placeholder(match.PlaceHolderA) || 'Por definir',
        away_team_name: away?.name || placeholder(match.PlaceHolderB) || 'Por definir',
        home_team_code: home?.code || null,
        away_team_code: away?.code || null,
        kickoff_at: kickoffAt,
        local_kickoff_at: localKickoffAt,
        venue: match.Stadium?.Name?.[0]?.Description || null,
        city: match.Stadium?.CityName?.[0]?.Description || null,
        tv_channel_es: inferTvChannel(numberOrNull(match.MatchNumber), numberOrNull(match.MatchDay) || roundFromStage(match.StageName?.[0]?.Description, match.MatchNumber), home?.code || null, away?.code || null),
        status: normalizeStatus(match),
        home_score: nullableNumber(match.HomeTeamScore),
        away_score: nullableNumber(match.AwayTeamScore),
        home_penalty_score: nullableNumber(match.HomeTeamPenaltyScore),
        away_penalty_score: nullableNumber(match.AwayTeamPenaltyScore),
        winner_team_id: readString(match.Winner) || null,
        raw: match,
        synced_at: new Date().toISOString(),
      };
    });

    if (teamRows.size) {
      const { error } = await supabase.from('teams').upsert(Array.from(teamRows.values()), { onConflict: 'id' });
      assertNoError(error, 'teams upsert');
    }

    const { error: matchesError } = await supabase.from('matches').upsert(matchRows, { onConflict: 'id' });
    assertNoError(matchesError, 'matches upsert');

    let fifaScorers = 0;
    let espnScorers = 0;
    let scorerSource = 'none';
    let scorerSyncNote: string | null = null;

    if (goalEvents.length) {
      const { error: eventsError } = await supabase
        .from('match_goal_events')
        .upsert(goalEvents, { onConflict: 'event_key' });
      assertNoError(eventsError, 'match_goal_events upsert');
    }

    const { error: cleanupGoalsError } = await supabase.rpc('cleanup_duplicate_goal_events');
    assertNoError(cleanupGoalsError, 'cleanup_duplicate_goal_events');

    const { data: storedGoalEvents, error: storedGoalsError } = await supabase
      .from('match_goal_events')
      .select('event_key, match_id, player_name, team_id, team_name, team_code, minute, penalty, own_goal');
    assertNoError(storedGoalsError, 'match_goal_events select');

    const aggregatedGoals = aggregateGoalEvents((storedGoalEvents || []) as GoalEventRow[]);
    const scorerSync = await fetchScorerRows();
    const selectedGoalRows = scorerSync.rows.length ? scorerSync.rows : aggregatedGoals;
    const mergedGoals = mergePlayerGoalRows(selectedGoalRows);
    fifaScorers = aggregatedGoals.length;
    espnScorers = scorerSync.rows.length;
    scorerSyncNote = scorerSync.note;

    if (mergedGoals.length) {
      await replacePlayerGoals(supabase, mergedGoals);
      scorerSource = scorerSync.rows.length ? scorerSync.source : 'fifa-events';
    }

    const { error: tvError } = await supabase.rpc('recalculate_match_tv_channels');
    assertNoError(tvError, 'recalculate_match_tv_channels');
    const { error: pointsError } = await supabase.rpc('recalculate_points');
    assertNoError(pointsError, 'recalculate_points');
    const { error: scorerPointsError } = await supabase.rpc('recalculate_scorer_points');
    assertNoError(scorerPointsError, 'recalculate_scorer_points');
    const scorerPointSummary = await loadScorerPointSummary(supabase);
    const { error: updateSyncRunError } = await supabase.from('sync_runs').update({
      ok: true,
      finished_at: new Date().toISOString(),
      matches_seen: results.length,
      matches_upserted: matchRows.length,
      raw: {
        continuation: payload.ContinuationToken ?? null,
        goal_events_seen: goalEvents.length,
        fifa_scorers: fifaScorers,
        espn_scorers: espnScorers,
        merged_scorers: mergedGoals.length,
        scorer_source: scorerSource,
        scorer_sync_note: scorerSyncNote,
        scorer_point_events: scorerPointSummary.events,
        scorer_points: scorerPointSummary.points,
      },
    }).eq('id', syncRun?.id);
    assertNoError(updateSyncRunError, 'sync_runs ok update');

    return Response.json({
      ok: true,
      matches: matchRows.length,
      goalEvents: goalEvents.length,
      scorers: mergedGoals.length,
      scorerSource,
      scorerSyncNote,
      scorerPointEvents: scorerPointSummary.events,
      scorerPoints: scorerPointSummary.points,
    });
  } catch (error) {
    const message = describeError(error);
    if (syncRun?.id) {
      await supabase.from('sync_runs').update({
        ok: false,
        finished_at: new Date().toISOString(),
        error: message,
      }).eq('id', syncRun.id);
    }
    return new Response(JSON.stringify({ ok: false, error: message }), { status: 500 });
  }
});

type NormalizedTeam = ReturnType<typeof normalizeTeam>;

interface GoalEventRow {
  event_key: string;
  match_id: string;
  match_number: number | null;
  player_name: string;
  team_id: string | null;
  team_name: string | null;
  team_code: string | null;
  minute: number | null;
  penalty: boolean;
  own_goal: boolean;
  raw: unknown;
  updated_at: string;
}

async function loadScorerPointSummary(supabase: any) {
  const { data, error } = await supabase
    .from('point_events')
    .select('points')
    .eq('category', 'scorer');
  assertNoError(error, 'point_events scorer summary');
  return {
    events: (data || []).length,
    points: (data || []).reduce((sum: number, row: any) => sum + (Number(row.points) || 0), 0),
  };
}

interface PlayerGoalRow {
  player_key: string;
  player_name: string;
  team_id: string | null;
  team_name: string | null;
  team_code: string | null;
  goals: number;
  updated_at: string;
}

interface ExternalScorer {
  playerName: string;
  teamName: string | null;
  teamCode: string | null;
  goals: number;
  source?: 'event' | 'stats' | 'fbref';
}

function normalizeTeam(team: any) {
  if (!team?.IdTeam && !team?.Abbreviation) return null;
  const code = team.Abbreviation || team.IdCountry || '';
  const name = TEAM_NAME_ES[code] || team.ShortClubName || team.TeamName?.[0]?.Description || code;
  return {
    id: readString(team.IdTeam) || code,
    code,
    name,
    flag_url: FLAG_BY_CODE[code] ? `https://flagcdn.com/w80/${FLAG_BY_CODE[code]}.png` : null,
  };
}

function nullableNumber(value: unknown) {
  return typeof value === 'number' ? value : null;
}

function numberOrNull(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function groupFromName(name?: string) {
  const match = name?.match(/Group\s+([A-L])/i);
  return match?.[1] || null;
}

function placeholder(value: unknown) {
  if (!value || typeof value !== 'object') return null;
  return (value as any).Description || (value as any).Name || null;
}

function phaseName(match: any) {
  const group = groupFromName(match.GroupName?.[0]?.Description);
  if (group) return `Grupo ${group}`;
  const stage = match.StageName?.[0]?.Description || '';
  const round = roundFromStage(stage, match.MatchNumber);
  if (round === 4) return 'Dieciseisavos';
  if (round === 5) return 'Octavos';
  if (round === 6) return 'Cuartos';
  if (round === 7) return 'Semifinales';
  if (Number(match.MatchNumber) === 103) return 'Tercer puesto';
  if (Number(match.MatchNumber) === 104) return 'Final';
  return stage || 'Fase final';
}

function roundFromStage(stage?: string, matchNumber?: unknown) {
  const n = Number(matchNumber);
  if (n >= 73 && n <= 88) return 4;
  if (n >= 89 && n <= 96) return 5;
  if (n >= 97 && n <= 100) return 6;
  if (n >= 101 && n <= 102) return 7;
  if (n >= 103) return 8;
  const lower = (stage || '').toLowerCase();
  if (lower.includes('round of 32')) return 4;
  if (lower.includes('round of 16')) return 5;
  if (lower.includes('quarter')) return 6;
  if (lower.includes('semi')) return 7;
  if (lower.includes('final')) return 8;
  return n <= 72 ? Math.ceil(n / 24) : null;
}

function normalizeStatus(match: any) {
  if (match.HomeTeamScore !== null && match.AwayTeamScore !== null && (match.Winner || new Date(match.Date) < new Date())) return 'finished';
  if (match.MatchStatus === 2) return 'live';
  return 'scheduled';
}

function inferTvChannel(matchNumber: number | null, roundNumber: number | null, homeCode: string | null, awayCode: string | null) {
  if (matchNumber === 1) return 'RTVE + DAZN / Canal Mediapro';
  if (homeCode === 'ESP' || awayCode === 'ESP') return 'RTVE + DAZN / Canal Mediapro';
  if ((roundNumber || 0) >= 5) return 'RTVE + DAZN / Canal Mediapro';
  return 'DAZN / Canal Mediapro';
}

function extractGoalEvents(match: any, matchId: string, home: NormalizedTeam, away: NormalizedTeam, matchNumber: number | null): GoalEventRow[] {
  const rows: GoalEventRow[] = [];
  const seen = new Set<string>();
  const now = new Date().toISOString();

  const pushGoal = (raw: any, source: string, index: number, side?: 'home' | 'away') => {
    if (!raw || typeof raw !== 'object') return;
    if (!isGoalSignal(raw, source)) return;

    const playerName = readPlayerName(raw);
    if (!playerName) return;

    const team = resolveGoalTeam(raw, side, home, away);
    const minute = readMinute(raw);
    const penalty = readBooleanish(raw.Penalty) || readBooleanish(raw.IsPenalty) || includesAny(readTextBlob(raw), ['penalty', 'penalti']);
    const ownGoal = readBooleanish(raw.OwnGoal) || readBooleanish(raw.IsOwnGoal) || includesAny(readTextBlob(raw), ['own goal', 'autogol']);
    const eventKey = String(raw.IdEvent || raw.EventId || raw.IdMatchEvent || raw.IdGoal || `${matchId}:${playerName}:${minute ?? index}:${team?.id || team?.code || 'unknown'}`);

    if (seen.has(eventKey)) return;
    seen.add(eventKey);

    rows.push({
      event_key: eventKey,
      match_id: matchId,
      match_number: matchNumber,
      player_name: playerName,
      team_id: team?.id || null,
      team_name: team?.name || null,
      team_code: team?.code || null,
      minute,
      penalty,
      own_goal: ownGoal,
      raw,
      updated_at: now,
    });
  };

  [
    { source: 'home-goals', side: 'home' as const, values: [match.Home?.Goals, match.Home?.GoalEvents, match.HomeGoals, match.HomeTeamGoals] },
    { source: 'away-goals', side: 'away' as const, values: [match.Away?.Goals, match.Away?.GoalEvents, match.AwayGoals, match.AwayTeamGoals] },
  ].forEach((source) => {
    source.values.flatMap(asArray).forEach((goal, index) => pushGoal(goal, source.source, index, source.side));
  });

  [match.MatchEvents, match.Events, match.Incidents, match.MatchIncidents, match.Timeline, match.MatchFacts]
    .flatMap(asArray)
    .forEach((event, index) => pushGoal(event, 'match-events', index));

  collectGoalArrays(match).forEach((goal, index) => pushGoal(goal, 'goal-array', index));

  return rows;
}

function aggregateGoalEvents(events: GoalEventRow[]) {
  const map = new Map<string, PlayerGoalRow>();
  const seen = new Set<string>();

  events.filter((event) => !event.own_goal).forEach((event) => {
    const playerName = canonicalPlayerName(event.player_name);
    const playerKey = goalPlayerKey(playerName, event.team_code, event.team_id);
    const eventIdentity = [
      normalizeText(playerName),
      event.team_code || event.team_id || normalizeText(event.team_name),
      event.match_id || 'unknown-match',
      event.minute ?? 'unknown-minute',
      event.penalty ? 'penalty' : 'open',
    ].join('|');
    if (seen.has(eventIdentity)) return;
    seen.add(eventIdentity);

    const previous = map.get(playerKey);
    map.set(playerKey, {
      player_key: playerKey,
      player_name: playerName,
      team_id: event.team_id,
      team_name: event.team_name,
      team_code: event.team_code,
      goals: (previous?.goals || 0) + 1,
      updated_at: new Date().toISOString(),
    });
  });

  return Array.from(map.values());
}

async function syncEspnScorers(supabase: any) {
  const result = await fetchScorerRows();
  if (result.rows.length) await replacePlayerGoals(supabase, result.rows);
  return {
    source: result.source,
    scorers: result.rows.length,
    note: result.note,
  };
}

async function fetchScorerRows() {
  const errors: string[] = [];
  const fbref = await fetchFbrefScorerRows(errors);
  const fbrefRows = fbref.rows;
  if (fbrefRows.length) {
    return {
      source: 'fbref',
      rows: fbrefRows,
      note: fbref.note,
    };
  }

  for (const url of ESPN_SCORERS_URLS) {
    try {
      const response = await fetch(url, {
        headers: {
          accept: 'application/json,text/plain,*/*',
          'accept-language': 'es-ES,es;q=0.9,en;q=0.7',
          'user-agent': 'Mozilla/5.0 WorldCup2026Predictor/1.0',
        },
      });
      if (!response.ok) {
        errors.push(`${new URL(url).host}: ${response.status}`);
        continue;
      }

      const text = await response.text();
      const payloads = parsePossibleJsonPayloads(text);
      const statRows = mergeExternalScorers(payloads.flatMap(readEspnScorers).filter((row) => row.goals > 0));
      if (!statRows.length) {
        errors.push(`${new URL(url).host}: sin goleadores en payload`);
        continue;
      }

      return {
        source: 'espn-stats',
        rows: statRows,
        note: fbref.note,
      };
    } catch (error) {
      errors.push(`${new URL(url).host}: ${describeError(error)}`);
    }
  }

  const eventScorers = await fetchEspnEventScorers(errors);
  const eventRows = mergeExternalScorers(eventScorers.filter((row) => row.goals > 0));
  if (eventRows.length) {
    return {
      source: 'espn-events',
      rows: eventRows,
      note: errors.length ? `FBref/ESPN stats no respondieron; se usaron eventos ESPN: ${errors.slice(0, 3).join(' | ')}` : fbref.note,
    };
  }

  return {
    source: 'none',
    rows: [] as PlayerGoalRow[],
    note: errors.length ? `Ninguna fuente externa devolvió goleadores utilizables: ${errors.slice(0, 3).join(' | ')}` : 'Sin datos utilizables',
  };
}

async function fetchFbrefScorerRows(errors: string[]) {
  for (const url of FBREF_SCORERS_URLS) {
    try {
      const response = await fetch(url, {
        headers: {
          accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'accept-language': 'es-ES,es;q=0.9,en;q=0.7',
          referer: 'https://fbref.com/',
          'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
        },
      });
      if (!response.ok) {
        errors.push(`${new URL(url).host}: ${response.status}`);
        continue;
      }

      const text = await response.text();
      const rows = mergeExternalScorers(readFbrefScorers(text));
      if (!rows.length) {
        errors.push(`${new URL(url).host}: sin filas Goals utilizables`);
        continue;
      }

      return {
        source: 'fbref',
        rows,
        note: null as string | null,
      };
    } catch (error) {
      errors.push(`${new URL(url).host}: ${describeError(error)}`);
    }
  }

  return {
    source: 'fbref',
    rows: [] as PlayerGoalRow[],
    note: 'FBref no devolvió una tabla Goals utilizable en esta sincronización',
  };
}

function readFbrefScorers(html: string) {
  const scorers: ExternalScorer[] = [];
  const tables = html.match(/<table[\s\S]*?<\/table>/gi) || [];
  const candidateTables = tables.filter((table) =>
    /data-stat=["']player["']/i.test(table)
    && /data-stat=["']goals["']/i.test(table)
    && (/id=["'][^"']*stats_standard/i.test(table) || /data-stat=["']minutes["']/i.test(table) || /data-stat=["']starts["']/i.test(table))
  );

  candidateTables.forEach((table) => {
    const rows = table.match(/<tr[\s\S]*?<\/tr>/gi) || [];
    rows.forEach((row) => {
      if (/class=["'][^"']*thead/i.test(row)) return;
      const playerName = readFbrefCell(row, 'player');
      const goals = numberFromValue(readFbrefCell(row, 'goals'));
      if (!playerName || isStatLabelName(playerName) || goals <= 0) return;

      const squad = readFbrefCell(row, 'team') || readFbrefCell(row, 'squad') || readFbrefCell(row, 'team_name');
      const nationality = readFbrefCell(row, 'nationality') || readFbrefCell(row, 'nation');
      const teamCode = normalizeTeamCode(readFbrefTeamCode(squad, nationality), squad || nationality);
      const teamName = teamCode ? TEAM_NAME_ES[teamCode] || squad || nationality || null : squad || nationality || null;

      scorers.push({
        playerName: canonicalPlayerName(playerName),
        teamName,
        teamCode,
        goals,
        source: 'fbref',
      });
    });
  });

  return dedupeExternalScorers(scorers);
}

function readFbrefCell(row: string, dataStat: string) {
  const pattern = new RegExp(`<(?:td|th)[^>]*data-stat=["']${dataStat}["'][^>]*>([\\s\\S]*?)<\\/(?:td|th)>`, 'i');
  const value = row.match(pattern)?.[1] || '';
  return stripHtml(value);
}

function readFbrefTeamCode(squad: string | null, nationality: string | null) {
  const combined = [squad, nationality].filter(Boolean).join(' ');
  const explicitCode = combined.match(/\b[A-Z]{3}\b/)?.[0] || null;
  if (explicitCode) return explicitCode;
  return null;
}

async function fetchEspnEventScorers(errors: string[]) {
  try {
    const scoreboard = await fetchJson(ESPN_SCOREBOARD_URL);
    const events = asArray(scoreboard?.events)
      .filter(isEspnScorerRelevantEvent)
      .map((event: any) => readString(event.id))
      .filter(Boolean);

    const summaries = await mapInBatches(events, 8, async (eventId) => {
      try {
        return await fetchJson(`${ESPN_SUMMARY_URL}${eventId}`);
      } catch (error) {
        errors.push(`summary ${eventId}: ${describeError(error)}`);
        return null;
      }
    });

    return summaries.flatMap((summary) => readEspnSummaryScorers(summary)).filter((row) => row.goals > 0);
  } catch (error) {
    errors.push(`scoreboard: ${describeError(error)}`);
    return [];
  }
}

async function fetchJson(url: string) {
  const response = await fetch(url, {
    headers: {
      accept: 'application/json,text/plain,*/*',
      'accept-language': 'es-ES,es;q=0.9,en;q=0.7',
      'user-agent': 'Mozilla/5.0 WorldCup2026Predictor/1.0',
    },
  });
  if (!response.ok) throw new Error(`${new URL(url).host}: ${response.status}`);
  return await response.json();
}

async function mapInBatches<T, R>(items: T[], batchSize: number, mapper: (item: T) => Promise<R>) {
  const results: R[] = [];
  for (let index = 0; index < items.length; index += batchSize) {
    const batch = items.slice(index, index + batchSize);
    results.push(...await Promise.all(batch.map(mapper)));
  }
  return results;
}

function isEspnScorerRelevantEvent(event: any) {
  const competitions = asArray(event?.competitions);
  const status = event?.status?.type || competitions[0]?.status?.type || {};
  const state = normalizeText(status.state);
  const statusText = normalizeText([status.name, status.description, status.detail, status.shortDetail].map(readString).join(' '));
  const hasScore = competitions
    .flatMap((competition: any) => asArray(competition?.competitors))
    .some((competitor: any) => numberFromValue(competitor?.score) > 0);

  return status.completed === true
    || ['in', 'post'].includes(state)
    || normalizeText(status.name) === 'statusfinal'
    || statusText.includes('tiempocompleto')
    || statusText.includes('final')
    || statusText.includes('encurso')
    || hasScore;
}

function readEspnSummaryScorers(summary: any) {
  if (!summary || typeof summary !== 'object') return [];
  const rows: ExternalScorer[] = [];
  const seen = new Set<string>();
  const plays = [
    ...asArray(summary?.header?.competitions?.[0]?.details),
    ...asArray(summary?.scoringPlays),
    ...asArray(summary?.drives).flatMap((drive) => asArray(drive?.plays)),
    ...asArray(summary?.keyEvents),
    ...asArray(summary?.commentary).map((item) => item?.play).filter(Boolean),
  ];

  plays.forEach((play, index) => {
    const row = readEspnGoalPlay(play, index);
    if (!row) return;
    const key = [
      normalizeText(row.playerName),
      row.teamCode || normalizeText(row.teamName || '') || 'unknown',
      readString(play?.id) || readString(play?.sequenceNumber) || readString(play?.clock?.displayValue) || readString(play?.time?.displayValue) || index,
      normalizeText(readString(play?.text) || readString(play?.shortText) || ''),
    ].join('|');
    if (seen.has(key)) return;
    seen.add(key);
    rows.push(row);
  });

  return rows;
}

function readEspnGoalPlay(play: any, index: number): ExternalScorer | null {
  if (!play || typeof play !== 'object') return null;
  if (play.ownGoal === true || play.own_goal === true) return null;

  const typeText = [play?.type?.type, play?.type?.text, play?.type?.name, play?.shortText, play?.text].map(readString).join(' ');
  const normalizedTypeText = normalizeText(typeText);
  if (normalizedTypeText.includes('owngoal') || normalizedTypeText.includes('autogol') || normalizedTypeText.includes('propiapuerta')) return null;
  const isGoal = play.scoringPlay === true
    || normalizedTypeText.includes('goal')
    || normalizedTypeText.includes('gol');
  if (!isGoal) return null;

  const scorer = asArray(play.participants)
    .map((participant) => participant?.athlete)
    .find((athlete) => readEspnName(athlete));
  const playerName = readEspnName(scorer) || readKnownScorerFromText(typeText);
  if (!playerName || isStatLabelName(playerName)) return null;

  const teamName = readString(play?.team?.displayName) || readString(play?.team?.name) || readString(play?.team?.location) || null;
  const rawTeamCode = readString(play?.team?.abbreviation) || readString(play?.team?.code) || null;
  const teamCode = normalizeTeamCode(rawTeamCode, teamName);

  return {
    playerName: canonicalPlayerName(playerName),
    teamName: teamCode ? TEAM_NAME_ES[teamCode] || teamName : teamName,
    teamCode,
    goals: 1,
    source: 'event',
  };
}

function parsePossibleJsonPayloads(text: string) {
  const trimmed = text.trim();
  const payloads: unknown[] = [];

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      payloads.push(JSON.parse(trimmed));
      return payloads;
    } catch {
      // Continue with embedded JSON extraction.
    }
  }

  const nextData = text.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>(.*?)<\/script>/s)?.[1];
  if (nextData) {
    try {
      payloads.push(JSON.parse(htmlDecode(nextData)));
    } catch {
      // Ignore malformed embedded JSON.
    }
  }

  const espnFit = text.match(/window\[['"]__espnfitt__['"]\]\s*=\s*(\{.*?\});/s)?.[1];
  if (espnFit) {
    try {
      payloads.push(JSON.parse(espnFit));
    } catch {
      // Ignore malformed embedded JSON.
    }
  }

  return payloads;
}

function readEspnScorers(payload: unknown) {
  const scorers: ExternalScorer[] = [];

  const walk = (value: any, path: string[], depth: number) => {
    if (!value || depth > 8) return;
    if (Array.isArray(value)) {
      value.forEach((item, index) => walk(item, [...path, String(index)], depth + 1));
      return;
    }
    if (typeof value !== 'object') return;

    if (Array.isArray(value.leaders) && isGoalLeaderCategory(value)) {
      value.leaders.forEach((leader: any) => {
        const scorer = readEspnLeader(leader, true);
        if (scorer) scorers.push(scorer);
      });
    }

    Object.entries(value).forEach(([key, child]) => walk(child, [...path, key], depth + 1));
  };

  walk(payload, [], 0);
  return dedupeExternalScorers(scorers);
}

function readEspnLeader(value: any, forceGoalContext = false): ExternalScorer | null {
  if (!value || typeof value !== 'object') return null;
  if (forceGoalContext && !value.athlete && !value.player && !value.person) return null;
  const athlete = value.athlete || value.player || value.person || value;
  const playerName = readEspnName(athlete) || readEspnName(value);
  if (!playerName) return null;
  if (isStatLabelName(playerName)) return null;

  const goals = readEspnGoals(value, forceGoalContext);
  if (!goals) return null;

  const team = value.team || athlete.team || value.teamInfo || athlete.teamInfo || null;
  const teamCode = readString(team?.abbreviation) || readString(team?.code) || readString(value.teamAbbreviation) || readString(value.teamCode) || null;
  const teamName = readString(team?.displayName) || readString(team?.name) || readString(team?.shortDisplayName) || readString(value.teamName) || null;
  const resolvedTeamCode = normalizeTeamCode(teamCode, teamName);

  return {
    playerName: canonicalPlayerName(playerName),
    teamName: resolvedTeamCode ? TEAM_NAME_ES[resolvedTeamCode] || teamName : teamName,
    teamCode: resolvedTeamCode,
    goals,
    source: 'stats',
  };
}

function readEspnName(value: any) {
  return readString(value?.displayName)
    || readString(value?.fullName)
    || readString(value?.shortName)
    || readString(value?.name)
    || readString(value?.athlete?.displayName)
    || readString(value?.player?.displayName);
}

function readEspnGoals(value: any, forceGoalContext: boolean) {
  const direct = [
    value.value,
    value.total,
    value.count,
    value.goals,
    value.displayValue,
    value.stat,
    value.statValue,
  ].map(numberFromValue).find((goal) => goal > 0);
  if (direct && forceGoalContext) return direct;

  const statEntries = [
    ...asArray(value.stats),
    ...asArray(value.statistics),
    ...asArray(value.splits?.categories).flatMap((category) => asArray(category?.stats)),
  ];

  for (const stat of statEntries) {
    const label = [stat?.name, stat?.displayName, stat?.shortDisplayName, stat?.abbreviation, stat?.label].map(readString).join(' ');
    if (!isGoalsContext(label)) continue;
    const parsed = numberFromValue(stat?.value) || numberFromValue(stat?.displayValue);
    if (parsed > 0) return parsed;
  }

  return forceGoalContext ? direct || 0 : 0;
}

function readKnownScorerFromText(value: string) {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  const aliases = Object.entries(CANONICAL_SCORER_NAMES).sort((a, b) => b[0].length - a[0].length);
  return aliases.find(([alias]) => alias.length > 2 && normalized.includes(alias))?.[1] || null;
}

function isStatLabelName(value: string) {
  return [
    'asistencias',
    'goles',
    'goals',
    'totaldegoles',
    'tiros',
    'faltas',
    'tarjetas',
  ].includes(normalizeText(value));
}

function isGoalLeaderCategory(value: any) {
  const name = normalizeText(value?.name);
  if (name === 'goalsleaders' || name === 'goalsleader') return true;

  const display = normalizeText(value?.displayName || value?.shortDisplayName || value?.label);
  const abbreviation = normalizeText(value?.abbreviation);
  return ['goles', 'goals'].includes(display) && ['g', 'gls', ''].includes(abbreviation);
}

function mergeExternalScorers(scorers: ExternalScorer[]) {
  const map = new Map<string, {
    playerName: string;
    teamName: string | null;
    teamCode: string | null;
    statGoals: number;
    eventGoals: number;
  }>();
  scorers.forEach((scorer) => {
    const playerName = canonicalPlayerName(scorer.playerName);
    const playerKey = goalPlayerKey(playerName, scorer.teamCode, null);
    const previous = map.get(playerKey);
    map.set(playerKey, {
      playerName,
      teamName: scorer.teamCode ? TEAM_NAME_ES[scorer.teamCode] || scorer.teamName : scorer.teamName,
      teamCode: scorer.teamCode,
      statGoals: scorer.source === 'event' ? previous?.statGoals || 0 : Math.max(previous?.statGoals || 0, scorer.goals),
      eventGoals: scorer.source === 'event' ? (previous?.eventGoals || 0) + scorer.goals : previous?.eventGoals || 0,
    });
  });

  return Array.from(map.entries()).map(([playerKey, scorer]) => ({
    player_key: playerKey,
    player_name: scorer.playerName,
    team_id: null,
    team_name: scorer.teamName,
    team_code: scorer.teamCode,
    goals: scorer.statGoals || scorer.eventGoals,
    updated_at: new Date().toISOString(),
  })).sort((a, b) => b.goals - a.goals || a.player_name.localeCompare(b.player_name));
}

function mergePlayerGoalRows(rows: PlayerGoalRow[]) {
  const map = new Map<string, PlayerGoalRow>();
  rows.forEach((row) => {
    const playerName = canonicalPlayerName(row.player_name);
    const playerKey = goalPlayerKey(playerName, row.team_code, row.team_id);
    const previous = map.get(playerKey);
    map.set(playerKey, {
      ...row,
      player_key: playerKey,
      player_name: playerName,
      team_name: row.team_code ? TEAM_NAME_ES[row.team_code] || row.team_name : row.team_name,
      goals: Math.max(previous?.goals || 0, row.goals),
      updated_at: new Date().toISOString(),
    });
  });
  return Array.from(map.values()).sort((a, b) => b.goals - a.goals || a.player_name.localeCompare(b.player_name));
}

function playerGoalRowKey(row: Pick<PlayerGoalRow, 'player_name' | 'team_code' | 'team_id'>) {
  return goalPlayerKey(canonicalPlayerName(row.player_name), row.team_code, row.team_id);
}

function dedupeExternalScorers(scorers: ExternalScorer[]) {
  const map = new Map<string, ExternalScorer>();
  scorers.forEach((scorer) => {
    const key = `${normalizeText(scorer.playerName)}|${scorer.teamCode || normalizeText(scorer.teamName || '') || 'unknown'}`;
    const previous = map.get(key);
    if (!previous || scorer.goals > previous.goals) map.set(key, scorer);
  });
  return Array.from(map.values());
}

async function cleanupDuplicateGoalRows(supabase: any, canonicalRows: PlayerGoalRow[]) {
  if (!canonicalRows.length) return;
  const canonicalKeys = new Set(canonicalRows.map((row) => row.player_key));
  const canonicalIdentities = new Set(canonicalRows.map(goalIdentity));
  const { data, error } = await supabase.from('player_goals').select('player_key, player_name, team_id, team_code');
  if (error || !data) return;

  for (const row of data as PlayerGoalRow[]) {
    if (canonicalKeys.has(row.player_key)) continue;
    if (!canonicalIdentities.has(goalIdentity(row))) continue;
    await supabase.from('player_goals').delete().eq('player_key', row.player_key);
  }
}

async function replacePlayerGoals(supabase: any, rows: PlayerGoalRow[]) {
  const incomingKeys = new Set(rows.map((row) => row.player_key));
  const { data, error: selectError } = await supabase.from('player_goals').select('player_key, manual_override');
  assertNoError(selectError, 'player_goals select before ESPN replace');

  for (const current of data || []) {
    if (incomingKeys.has(current.player_key)) continue;
    if (current.manual_override === true) continue;
    const { error: deleteError } = await supabase.from('player_goals').delete().eq('player_key', current.player_key);
    assertNoError(deleteError, `player_goals stale delete ${current.player_key}`);
  }

  const { error } = await supabase.from('player_goals').upsert(
    rows.map((row) => ({ ...row, source: 'sync', manual_override: false })),
    { onConflict: 'player_key' },
  );
  assertNoError(error, 'player_goals ESPN upsert');
}

function canonicalPlayerName(name: string) {
  return CANONICAL_SCORER_NAMES[normalizeText(name)] || name.trim();
}

function goalPlayerKey(playerName: string, teamCode: string | null, teamId: string | null) {
  return `${normalizeText(canonicalPlayerName(playerName))}|${teamCode || teamId || 'unknown'}`;
}

function goalIdentity(row: Pick<PlayerGoalRow, 'player_name' | 'team_code' | 'team_id'>) {
  return `${normalizeText(canonicalPlayerName(row.player_name))}|${row.team_code || row.team_id || 'unknown'}`;
}

function normalizeTeamCode(code: string | null, name: string | null) {
  const rawCode = code?.trim().toUpperCase();
  const upperCode = rawCode ? ESPN_TEAM_CODE_ALIAS[rawCode] || rawCode : null;
  if (upperCode && TEAM_NAME_ES[upperCode]) return upperCode;
  if (!name) return upperCode || null;
  return TEAM_CODE_BY_NAME[normalizeText(name)] || upperCode || null;
}

function isGoalsContext(value: string) {
  const normalized = normalizeText(value);
  if (!normalized) return false;
  if (normalized.includes('goalsagainst') || normalized.includes('goalsallowed') || normalized.includes('golesencontra')) return false;
  return ['goals', 'goal', 'goles', 'gols', 'gls'].some((needle) => normalized.includes(needle));
}

function numberFromValue(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const match = String(value ?? '').match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function htmlDecode(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function stripHtml(value: string) {
  return htmlDecode(value)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeText(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function asArray(value: unknown): any[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function collectGoalArrays(root: any) {
  const goals: any[] = [];

  const walk = (value: any, keyPath: string[], depth: number) => {
    if (!value || depth > 5) return;
    if (Array.isArray(value)) {
      const key = keyPath[keyPath.length - 1]?.toLowerCase() || '';
      if (key.includes('goal')) goals.push(...value.filter((item) => item && typeof item === 'object'));
      value.forEach((item) => walk(item, keyPath, depth + 1));
      return;
    }
    if (typeof value !== 'object') return;
    Object.entries(value).forEach(([key, child]) => walk(child, [...keyPath, key], depth + 1));
  };

  walk(root, [], 0);
  return goals;
}

function resolveGoalTeam(raw: any, side: 'home' | 'away' | undefined, home: NormalizedTeam, away: NormalizedTeam) {
  if (side === 'home') return home;
  if (side === 'away') return away;
  const code = readString(raw.TeamCode) || readString(raw.Team?.Abbreviation) || readString(raw.Team?.Code) || readString(raw.Team?.IdCountry);
  const id = readString(raw.TeamId) || readString(raw.IdTeam) || readString(raw.Team?.IdTeam);
  if (code && home?.code === code) return home;
  if (code && away?.code === code) return away;
  if (id && home?.id === id) return home;
  if (id && away?.id === id) return away;
  return null;
}

function readPlayerName(raw: any) {
  const candidates = [
    raw.PlayerName,
    raw.ScorerName,
    raw.GoalScorerName,
    raw.Name,
    raw.Player?.Name,
    raw.Player?.DisplayName,
    raw.Player?.ShortName,
    raw.Player?.PlayerName,
    raw.Player?.Name?.[0]?.Description,
    raw.PlayerName?.[0]?.Description,
    raw.Name?.[0]?.Description,
  ];
  for (const candidate of candidates) {
    const value = readString(candidate) || readDescription(candidate);
    if (value) return value;
  }
  return null;
}

function readMinute(raw: any) {
  const value = raw.Minute || raw.MatchMinute || raw.Time || raw.EventMinute || raw.PeriodMinute;
  const match = String(value ?? '').match(/\d+/);
  return match ? Number(match[0]) : null;
}

function isGoalSignal(raw: any, source: string) {
  const text = `${source} ${readTextBlob(raw)}`.toLowerCase();
  if (includesAny(text, ['yellow', 'red card', 'substitution', 'corner', 'offside'])) return false;
  return includesAny(text, ['goal', 'gol']);
}

function readTextBlob(value: any): string {
  if (!value || typeof value !== 'object') return String(value ?? '');
  return Object.values(value).slice(0, 16).map((item) => {
    if (typeof item === 'string' || typeof item === 'number') return String(item);
    if (Array.isArray(item)) return item.map(readDescription).filter(Boolean).join(' ');
    return readDescription(item) || '';
  }).join(' ');
}

function readDescription(value: any) {
  if (!value) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(readDescription).find(Boolean) || '';
  if (typeof value === 'object') return readString(value.Description) || readString(value.Name) || readString(value.Value) || '';
  return '';
}

function readString(value: unknown) {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number') return String(value);
  return '';
}

function readMatchResults(payload: any): any[] {
  const candidates = [
    payload?.Results,
    payload?.results,
    payload?.Matches,
    payload?.matches,
    payload?.data?.Results,
    payload?.data?.matches,
  ];
  return candidates.find(Array.isArray) || [];
}

function readValidDate(value: unknown) {
  const text = readString(value);
  if (!text) return null;
  const timestamp = Date.parse(text);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function assertNoError(error: unknown, context: string) {
  if (error) throw new Error(`${context}: ${describeError(error)}`);
}

function describeError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error, Object.getOwnPropertyNames(error));
  } catch {
    return String(error);
  }
}

function readBooleanish(value: unknown) {
  return value === true || value === 'true' || value === 'Y' || value === 1;
}

function includesAny(text: string, needles: string[]) {
  const lower = text.toLowerCase();
  return needles.some((needle) => lower.includes(needle));
}
