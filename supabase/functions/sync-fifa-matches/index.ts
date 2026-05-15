import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0';

const FIFA_URL = 'https://api.fifa.com/api/v3/calendar/matches?idCompetition=17&idSeason=285023&language=en&count=120';

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

Deno.serve(async () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRole) {
    return new Response(JSON.stringify({ error: 'Missing Supabase env vars' }), { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRole);
  const startedAt = new Date().toISOString();
  const { data: syncRun } = await supabase.from('sync_runs').insert({ started_at: startedAt, source: 'fifa' }).select('id').single();

  try {
    const response = await fetch(FIFA_URL, {
      headers: { 'user-agent': 'WorldCup2026Predictor/1.0' },
    });
    if (!response.ok) throw new Error(`FIFA returned ${response.status}`);
    const payload = await response.json();
    const results = payload.Results || [];

    const teamRows = new Map<string, unknown>();
    const matchRows = results.map((match: any) => {
      const home = normalizeTeam(match.Home);
      const away = normalizeTeam(match.Away);
      const groupCode = groupFromName(match.GroupName?.[0]?.Description);
      if (home?.id) teamRows.set(home.id, { ...home, group_code: groupCode, raw: match.Home, updated_at: new Date().toISOString() });
      if (away?.id) teamRows.set(away.id, { ...away, group_code: groupCode, raw: match.Away, updated_at: new Date().toISOString() });

      return {
        id: match.IdMatch,
        fifa_match_id: match.IdMatch,
        match_number: numberOrNull(match.MatchNumber),
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
        kickoff_at: match.Date,
        local_kickoff_at: match.LocalDate || null,
        venue: match.Stadium?.Name?.[0]?.Description || null,
        city: match.Stadium?.CityName?.[0]?.Description || null,
        tv_channel_es: inferTvChannel(numberOrNull(match.MatchNumber), numberOrNull(match.MatchDay) || roundFromStage(match.StageName?.[0]?.Description, match.MatchNumber), home?.code || null, away?.code || null),
        status: normalizeStatus(match),
        home_score: nullableNumber(match.HomeTeamScore),
        away_score: nullableNumber(match.AwayTeamScore),
        home_penalty_score: nullableNumber(match.HomeTeamPenaltyScore),
        away_penalty_score: nullableNumber(match.AwayTeamPenaltyScore),
        winner_team_id: match.Winner || null,
        raw: match,
        synced_at: new Date().toISOString(),
      };
    });

    if (teamRows.size) {
      const { error } = await supabase.from('teams').upsert(Array.from(teamRows.values()), { onConflict: 'id' });
      if (error) throw error;
    }

    const { error: matchesError } = await supabase.from('matches').upsert(matchRows, { onConflict: 'id' });
    if (matchesError) throw matchesError;

    await supabase.rpc('recalculate_match_tv_channels');
    await supabase.rpc('recalculate_points');
    await supabase.from('sync_runs').update({
      ok: true,
      finished_at: new Date().toISOString(),
      matches_seen: results.length,
      matches_upserted: matchRows.length,
      raw: { continuation: payload.ContinuationToken ?? null },
    }).eq('id', syncRun?.id);

    return Response.json({ ok: true, matches: matchRows.length });
  } catch (error) {
    await supabase.from('sync_runs').update({
      ok: false,
      finished_at: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
    }).eq('id', syncRun?.id);
    return new Response(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }), { status: 500 });
  }
});

function normalizeTeam(team: any) {
  if (!team?.IdTeam && !team?.Abbreviation) return null;
  const code = team.Abbreviation || team.IdCountry || '';
  const name = TEAM_NAME_ES[code] || team.ShortClubName || team.TeamName?.[0]?.Description || code;
  return {
    id: team.IdTeam || code,
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
