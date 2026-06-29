import { useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { AlertCircle, CheckCircle2, ChevronLeft, Clock, Eye, FileDown, Loader2, Lock, Medal, ShieldAlert, Target, Trophy, Tv } from 'lucide-react';
import { motion } from 'motion/react';
import { canPlay, isAdmin, supabase } from '../lib/supabase';
import type { CommunitySettings, FinalistPrediction, KnockoutPrediction, Match, MatchPrediction, PointEvent, Profile, ScorerPrediction, Team } from '../lib/types';
import { formatDateTime, POINTS } from '../lib/constants';
import { getLateKnockoutDeadline, getMatchDeadline, getPhaseDeadline, isDeadlineClosed } from '../lib/deadlines';
import { displayTeam, getFlagEmoji, getFlagUrl } from '../lib/flags';
import { WORLD_CUP_LOGO_URL, getCommunity, type CommunityId } from '../lib/communities';
import { SCORER_CANDIDATES } from '../lib/scorerCandidates';

type MatchPredictionMap = Record<string, Partial<MatchPrediction>>;
type KnockoutPredictionMap = Record<string, Partial<KnockoutPrediction>>;
type FinalistSlot = 'champion' | 'runner_up' | 'third' | 'fourth';
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
type PredictionFilter = 'groups' | 'scorers' | 'knockout';
type PredictionDraft = {
  matchPredictions?: MatchPredictionMap;
  knockoutPredictions?: KnockoutPredictionMap;
  finalistPrediction?: Partial<FinalistPrediction> | null;
  scorerPrediction?: Partial<ScorerPrediction> | null;
};
type PredictedStandingRow = {
  teamId: string;
  teamName: string;
  teamCode: string | null;
  pts: number;
  gf: number;
  ga: number;
  gd: number;
  position: number;
};

async function fetchPublicCalendarFallback() {
  try {
    const response = await fetch('/api/public-data', { headers: { accept: 'application/json' } });
    if (!response.ok) return null;
    const payload = await response.json();
    return {
      matches: (payload.matches || []) as Match[],
      teams: (payload.teams || []) as Team[],
    };
  } catch {
    return null;
  }
}

function predictionDraftKey(userId: string, communityId: CommunityId) {
  return `wc26_prediction_draft:${userId}:${communityId}`;
}

function predictionFilterKey(communityId: CommunityId) {
  return `wc26_prediction_filter:${communityId}`;
}

function readPredictionFilter(communityId: CommunityId): PredictionFilter {
  const stored = window.localStorage.getItem(predictionFilterKey(communityId)) as PredictionFilter | null;
  return stored === 'groups' || stored === 'scorers' || stored === 'knockout' ? stored : 'groups';
}

function phaseDomId(phase: string) {
  return `fase-${phase
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')}`;
}

function readPredictionDraft(userId: string, communityId: CommunityId): PredictionDraft {
  try {
    return JSON.parse(window.localStorage.getItem(predictionDraftKey(userId, communityId)) || '{}') as PredictionDraft;
  } catch {
    return {};
  }
}

function writePredictionDraft(userId: string, communityId: CommunityId, patch: PredictionDraft) {
  const current = readPredictionDraft(userId, communityId);
  const next: PredictionDraft = {
    ...current,
    ...patch,
    matchPredictions: {
      ...(current.matchPredictions || {}),
      ...(patch.matchPredictions || {}),
    },
    knockoutPredictions: {
      ...(current.knockoutPredictions || {}),
      ...(patch.knockoutPredictions || {}),
    },
  };
  window.localStorage.setItem(predictionDraftKey(userId, communityId), JSON.stringify(next));
}

function isDraftNewer(draft?: { updated_at?: string | null }, remote?: { updated_at?: string | null }) {
  if (!draft?.updated_at) return false;
  if (!remote?.updated_at) return true;
  return new Date(draft.updated_at).getTime() > new Date(remote.updated_at).getTime();
}

function mergePredictionDraft<T extends { updated_at?: string | null }>(remote: Record<string, T>, draft?: Record<string, T>) {
  if (!draft) return remote;
  return Object.entries(draft).reduce<Record<string, T>>((acc, [id, draftRow]) => {
    acc[id] = isDraftNewer(draftRow, acc[id]) ? draftRow : acc[id];
    return acc;
  }, { ...remote });
}

function mergeSingleDraft<T extends { updated_at?: string | null }>(remote: T | null, draft?: T | null) {
  return isDraftNewer(draft || undefined, remote || undefined) ? draft || null : remote;
}

function normalizePlayerName(value?: string | null) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();
}

function normalizeStageText(value?: string | null) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function isRoundOf32Fixture(match: Match) {
  const stageText = normalizeStageText(`${match.phase || ''} ${match.stage_name || ''}`);
  return (
    (match.round_number || 0) === 4 ||
    stageText.includes('dieciseis') ||
    stageText.includes('round of 32') ||
    stageText.includes('ronda de 32')
  );
}

const KNOCKOUT_PREDECESSORS: Record<number, [number, number]> = {
  89: [74, 77],
  90: [73, 75],
  91: [76, 78],
  92: [79, 80],
  93: [83, 84],
  94: [81, 82],
  95: [86, 88],
  96: [85, 87],
  97: [89, 90],
  98: [93, 94],
  99: [91, 92],
  100: [95, 96],
  101: [97, 98],
  102: [99, 100],
  103: [101, 102],
  104: [101, 102],
};

function sortTeamsByName(list: Team[]) {
  return [...list].sort((a, b) => displayTeam(a.name, a.code).localeCompare(displayTeam(b.name, b.code), 'es'));
}

function dedupeTeams(list: Team[]) {
  const map = new Map<string, Team>();
  list.forEach((team) => {
    if (team.id) map.set(team.id, team);
  });
  return sortTeamsByName([...map.values()]);
}

function sideTeamFromMatch(
  match: Match,
  side: 'home' | 'away',
  teamById: Map<string, Team>,
) {
  const id = side === 'home' ? match.home_team_id : match.away_team_id;
  const name = side === 'home' ? match.home_team_name : match.away_team_name;
  const code = side === 'home' ? match.home_team_code : match.away_team_code;
  if (!id) return null;
  return teamById.get(id) || {
    id,
    name: name || 'Por definir',
    code: code || '',
    group_code: null,
    flag_url: null,
  };
}

function collectPossibleTeamsFromMatchNumber(
  matchNumber: number,
  matchByNumber: Map<number, Match>,
  teamById: Map<string, Team>,
  visited = new Set<number>(),
): Team[] {
  if (visited.has(matchNumber)) return [];
  visited.add(matchNumber);

  const match = matchByNumber.get(matchNumber);
  if (!match) return [];

  if (isRoundOf32Fixture(match)) {
    return dedupeTeams([
      sideTeamFromMatch(match, 'home', teamById),
      sideTeamFromMatch(match, 'away', teamById),
    ].filter(Boolean) as Team[]);
  }

  const predecessors = KNOCKOUT_PREDECESSORS[matchNumber];
  if (!predecessors) {
    return dedupeTeams([
      sideTeamFromMatch(match, 'home', teamById),
      sideTeamFromMatch(match, 'away', teamById),
    ].filter(Boolean) as Team[]);
  }

  return dedupeTeams([
    ...collectPossibleTeamsFromMatchNumber(predecessors[0], matchByNumber, teamById, new Set(visited)),
    ...collectPossibleTeamsFromMatchNumber(predecessors[1], matchByNumber, teamById, new Set(visited)),
  ]);
}

export default function Predictions({
  user,
  profile,
  communityId,
  setShowAuth,
}: {
  user: User | null;
  profile: Profile | null;
  communityId: CommunityId;
  setShowAuth: (open: boolean) => void;
}) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [matchPredictions, setMatchPredictions] = useState<MatchPredictionMap>({});
  const [knockoutPredictions, setKnockoutPredictions] = useState<KnockoutPredictionMap>({});
  const [finalistPrediction, setFinalistPrediction] = useState<Partial<FinalistPrediction> | null>(null);
  const [scorerPrediction, setScorerPrediction] = useState<Partial<ScorerPrediction> | null>(null);
  const [pointEvents, setPointEvents] = useState<PointEvent[]>([]);
  const [settings, setSettings] = useState<CommunitySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [activeFilter, setActiveFilter] = useState<PredictionFilter>(() => readPredictionFilter(communityId));
  const [scorerName, setScorerName] = useState('');
  const [scorerTeamId, setScorerTeamId] = useState('');
  const autoSaveTimers = useRef<Record<string, number>>({});

  const admin = isAdmin(profile, user?.email);
  const approved = Boolean(admin || (canPlay(profile, user?.email) && profile?.community_id === communityId));
  const canEdit = Boolean(user && approved);
  const community = getCommunity(communityId);
  const groups = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
  const isKnockoutFixture = (match: Match) => {
    const phase = match.phase?.toLowerCase() || '';
    return (match.round_number || 0) >= 4 || (!match.group_code && !phase.includes('group') && !phase.includes('grupo'));
  };

  const changeFilter = (filter: PredictionFilter) => {
    window.localStorage.setItem(predictionFilterKey(communityId), filter);
    setActiveFilter(filter);
  };

  useEffect(() => {
    setActiveFilter(readPredictionFilter(communityId));
  }, [communityId]);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      let [
        { data: matchRows, error: matchError },
        { data: teamRows, error: teamError },
        { data: settingsRow, error: settingsError },
      ] = await Promise.all([
        supabase.from('matches').select('*').order('kickoff_at', { ascending: true }),
        supabase.from('teams').select('*').order('group_code', { ascending: true }).order('name', { ascending: true }),
        supabase.from('community_settings').select('*').eq('community_id', communityId).maybeSingle(),
      ]);

      if ((!matchRows || matchRows.length === 0) && !matchError) {
        await supabase.functions.invoke('sync-fifa-matches');
        [
          { data: matchRows, error: matchError },
          { data: teamRows, error: teamError },
          { data: settingsRow, error: settingsError },
        ] = await Promise.all([
          supabase.from('matches').select('*').order('kickoff_at', { ascending: true }),
          supabase.from('teams').select('*').order('group_code', { ascending: true }).order('name', { ascending: true }),
          supabase.from('community_settings').select('*').eq('community_id', communityId).maybeSingle(),
        ]);
      }

      if (matchError || teamError) {
        console.warn('No se pudo cargar el calendario completo', matchError || teamError);
        const fallback = await fetchPublicCalendarFallback();
        if (fallback) {
          matchRows = fallback.matches;
          teamRows = fallback.teams;
          matchError = null;
          teamError = null;
        }
      }

      setMatches((matchRows || []) as Match[]);
      setTeams((teamRows || []) as Team[]);
      if (settingsError) console.warn('No se pudieron cargar los plazos de la comunidad', settingsError);
      setSettings((settingsRow as CommunitySettings | null) || null);

      if (user && approved) {
        const draft = readPredictionDraft(user.id, communityId);
        const [{ data: predRows }, { data: knockoutRows }, { data: finalistRow }, { data: scorerRow }, { data: pointRows }] = await Promise.all([
          supabase.from('match_predictions').select('*').eq('user_id', user.id).eq('community_id', communityId),
          supabase.from('knockout_predictions').select('*').eq('user_id', user.id).eq('community_id', communityId),
          supabase.from('finalist_predictions').select('*').eq('user_id', user.id).eq('community_id', communityId).maybeSingle(),
          supabase.from('scorer_predictions').select('*').eq('user_id', user.id).eq('community_id', communityId).maybeSingle(),
          supabase.from('point_events').select('*').eq('user_id', user.id).eq('community_id', communityId),
        ]);

        const pMap: MatchPredictionMap = {};
        (predRows || []).forEach((p: any) => {
          pMap[p.match_id] = p;
        });
        setMatchPredictions(mergePredictionDraft(pMap, draft.matchPredictions));
        setPointEvents((pointRows || []) as PointEvent[]);

        const kMap: KnockoutPredictionMap = {};
        (knockoutRows || []).forEach((p: any) => {
          kMap[p.match_id] = p;
        });
        setKnockoutPredictions(mergePredictionDraft(kMap, draft.knockoutPredictions));
        setFinalistPrediction(mergeSingleDraft((finalistRow as FinalistPrediction | null) || null, draft.finalistPrediction as FinalistPrediction | null));

        const mergedScorer = mergeSingleDraft((scorerRow as ScorerPrediction | null) || null, draft.scorerPrediction as ScorerPrediction | null);
        if (mergedScorer) {
          setScorerPrediction(mergedScorer as ScorerPrediction);
          setScorerName((mergedScorer as ScorerPrediction).player_name || '');
          setScorerTeamId((mergedScorer as ScorerPrediction).team_id || '');
        } else {
          setScorerPrediction(null);
          setScorerName('');
          setScorerTeamId('');
        }
      } else {
        setMatchPredictions({});
        setKnockoutPredictions({});
        setFinalistPrediction(null);
        setScorerPrediction(null);
        setPointEvents([]);
        setScorerName('');
        setScorerTeamId('');
      }
      setLoading(false);
    }

    fetchData();
  }, [approved, user, communityId]);

  useEffect(() => {
    return () => {
      Object.values(autoSaveTimers.current).forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  const matchesByPhase = useMemo(() => {
    const grouped: Record<string, Match[]> = {};
    if (activeFilter === 'scorers') return grouped;
    const filtered = matches.filter((match) => {
      if (activeFilter === 'groups') return !isKnockoutFixture(match);
      if (activeFilter === 'knockout') return isKnockoutFixture(match);
      return true;
    });

    filtered.forEach((match) => {
      const key = match.group_code ? `Grupo ${match.group_code}` : match.phase;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(match);
    });
    return grouped;
  }, [activeFilter, matches]);

  const knockoutQualifiedTeams = useMemo(() => {
    const teamById = new Map(teams.map((team) => [team.id, team]));
    const realQualified = new Map<string, Team>();

    matches.filter(isRoundOf32Fixture).forEach((match) => {
      [
        { id: match.home_team_id, name: match.home_team_name, code: match.home_team_code },
        { id: match.away_team_id, name: match.away_team_name, code: match.away_team_code },
      ].forEach((team) => {
        if (!team.id) return;
        realQualified.set(team.id, teamById.get(team.id) || {
          id: team.id,
          name: team.name || 'Por definir',
          code: team.code || '',
          group_code: null,
          flag_url: null,
        });
      });
    });

    return [...realQualified.values()].sort((a, b) => displayTeam(a.name, a.code).localeCompare(displayTeam(b.name, b.code), 'es'));
  }, [matches, teams]);

  const knockoutOptionBranches = useMemo(() => {
    const teamById = new Map(teams.map((team) => [team.id, team]));
    const matchByNumber = new Map<number, Match>();
    matches.forEach((match) => {
      if (match.match_number !== null && match.match_number !== undefined) {
        matchByNumber.set(match.match_number, match);
      }
    });

    const branches: Record<string, { homeTeams: Team[]; awayTeams: Team[] }> = {};
    matches.filter(isKnockoutFixture).forEach((match) => {
      const matchNumber = match.match_number || 0;
      const predecessors = KNOCKOUT_PREDECESSORS[matchNumber];
      if (!predecessors) {
        branches[match.id] = {
          homeTeams: knockoutQualifiedTeams,
          awayTeams: knockoutQualifiedTeams,
        };
        return;
      }

      const homeTeams = collectPossibleTeamsFromMatchNumber(predecessors[0], matchByNumber, teamById);
      const awayTeams = collectPossibleTeamsFromMatchNumber(predecessors[1], matchByNumber, teamById);
      branches[match.id] = {
        homeTeams: homeTeams.length ? homeTeams : knockoutQualifiedTeams,
        awayTeams: awayTeams.length ? awayTeams : knockoutQualifiedTeams,
      };
    });

    return branches;
  }, [knockoutQualifiedTeams, matches, teams]);

  const selectableTeams = useMemo(
    () => [...teams].sort((a, b) => displayTeam(a.name, a.code).localeCompare(displayTeam(b.name, b.code), 'es')),
    [teams],
  );

  const groupMatches = useMemo(
    () => matches.filter((match) => !isKnockoutFixture(match) && match.group_code),
    [matches],
  );

  const completedGroupPredictionCount = useMemo(
    () => groupMatches.filter((match) => matchPredictions[match.id]?.home_score !== undefined && matchPredictions[match.id]?.away_score !== undefined).length,
    [groupMatches, matchPredictions],
  );

  const missingGroupPredictionCount = Math.max(groupMatches.length - completedGroupPredictionCount, 0);
  const groupsComplete = groupMatches.length > 0 && missingGroupPredictionCount === 0;
  const selectedScorerCandidate = useMemo(
    () => SCORER_CANDIDATES.find((candidate) => normalizePlayerName(candidate.name) === normalizePlayerName(scorerName || scorerPrediction?.player_name)),
    [scorerName, scorerPrediction?.player_name],
  );
  const scorerComplete = Boolean(selectedScorerCandidate);
  const groupDeadlineIso = getPhaseDeadline('groups', settings, profile?.prediction_unlocks);
  const scorerDeadlineIso = getPhaseDeadline('scorer', settings, profile?.prediction_unlocks);
  const knockoutDeadlineIso = getPhaseDeadline('knockout', settings, profile?.prediction_unlocks);
  const lateKnockoutDeadlineIso = getLateKnockoutDeadline(settings, profile?.prediction_unlocks);
  const scorerDeadlineClosed = isDeadlineClosed(scorerDeadlineIso);
  const isPredictionMatchLocked = (match: Match) => isDeadlineClosed(getMatchDeadline(match, settings, profile?.prediction_unlocks));

  const predictedStandings = useMemo(() => {
    const table: Record<string, PredictedStandingRow[]> = {};
    groups.forEach((group) => {
      table[group] = calculatePredictedStandings(group, teams, groupMatches, matchPredictions);
    });
    return table;
  }, [groupMatches, matchPredictions, teams]);

  const pointEventsByMatch = useMemo(() => {
    const grouped: Record<string, PointEvent[]> = {};
    pointEvents.forEach((event) => {
      const matchId = event.ref_type === 'match' || event.ref_type === 'knockout_score'
        ? event.ref_id
        : event.ref_type === 'knockout_match'
          ? event.ref_id.split(':')[0]
          : '';
      if (!matchId) return;
      if (!grouped[matchId]) grouped[matchId] = [];
      grouped[matchId].push(event);
    });
    return grouped;
  }, [pointEvents]);

  const getMatchPointEvents = (matchId: string) => pointEventsByMatch[matchId] || [];

  const scheduleAutoSave = (key: string, callback: () => void) => {
    window.clearTimeout(autoSaveTimers.current[key]);
    setSaveStatus('saving');
    autoSaveTimers.current[key] = window.setTimeout(callback, 650);
  };

  const persistDraft = (patch: PredictionDraft) => {
    if (!user) return;
    writePredictionDraft(user.id, communityId, patch);
  };

  const handleScoreChange = (match: Match, side: 'home' | 'away', value: string) => {
    const score = value === '' ? undefined : Number(value);
    if (score !== undefined && (!Number.isInteger(score) || score < 0 || score > 30)) return;
    const updatedAt = new Date().toISOString();
    const nextPred = {
      ...matchPredictions[match.id],
      [side === 'home' ? 'home_score' : 'away_score']: score,
      updated_at: updatedAt,
    };
    setMatchPredictions((prev) => ({
      ...prev,
      [match.id]: nextPred,
    }));
    persistDraft({ matchPredictions: { [match.id]: nextPred } });
    if (nextPred.home_score !== undefined && nextPred.away_score !== undefined) {
      scheduleAutoSave(`match-${match.id}`, () => saveMatchPrediction(match, nextPred));
    }
  };

  const saveMatchPrediction = async (match: Match, override?: Partial<MatchPrediction>) => {
    if (!user) return setShowAuth(true);
    if (!canEdit || isPredictionMatchLocked(match)) return;
    const pred = override || matchPredictions[match.id];
    if (pred?.home_score === undefined || pred?.away_score === undefined) return;

    setSavingId(match.id);
    const updatedAt = pred.updated_at || new Date().toISOString();
    const { error } = await supabase.from('match_predictions').upsert({
      user_id: user.id,
      community_id: communityId,
      match_id: match.id,
      home_score: pred.home_score,
      away_score: pred.away_score,
      updated_at: updatedAt,
    }, { onConflict: 'user_id,community_id,match_id' });

    if (error) alert(error.message);
    setSaveStatus(error ? 'error' : 'saved');
    setTimeout(() => setSavingId(null), 700);
    setTimeout(() => setSaveStatus('idle'), 2200);
  };

  const getKnockoutPredictionBase = (match: Match, current?: Partial<KnockoutPrediction>) => ({
    ...current,
    match_id: match.id,
    predicted_home_team_id: current?.predicted_home_team_id ?? match.home_team_id ?? null,
    predicted_home_team_name: current?.predicted_home_team_name ?? match.home_team_name ?? null,
    predicted_home_team_code: current?.predicted_home_team_code ?? match.home_team_code ?? null,
    predicted_away_team_id: current?.predicted_away_team_id ?? match.away_team_id ?? null,
    predicted_away_team_name: current?.predicted_away_team_name ?? match.away_team_name ?? null,
    predicted_away_team_code: current?.predicted_away_team_code ?? match.away_team_code ?? null,
  });

  const isKnockoutPickComplete = (pick?: Partial<KnockoutPrediction>) => (
    Boolean(
      pick?.predicted_home_team_id &&
      pick?.predicted_away_team_id &&
      pick.predicted_home_team_id !== pick.predicted_away_team_id &&
      pick.predicted_home_score !== undefined &&
      pick.predicted_home_score !== null &&
      pick.predicted_away_score !== undefined &&
      pick.predicted_away_score !== null,
    )
  );

  const updateKnockoutPick = (matchId: string, side: 'home' | 'away', teamId: string) => {
    const team = knockoutQualifiedTeams.find((item) => item.id === teamId) || teams.find((item) => item.id === teamId);
    const match = matches.find((item) => item.id === matchId);
    const updatedAt = new Date().toISOString();
    const nextPick = {
      ...(match ? getKnockoutPredictionBase(match, knockoutPredictions[matchId]) : knockoutPredictions[matchId]),
      match_id: matchId,
      [`predicted_${side}_team_id`]: team?.id || null,
      [`predicted_${side}_team_name`]: team?.name || null,
      [`predicted_${side}_team_code`]: team?.code || null,
      updated_at: updatedAt,
    };
    setKnockoutPredictions((prev) => ({
      ...prev,
      [matchId]: nextPick,
    }));
    persistDraft({ knockoutPredictions: { [matchId]: nextPick } });
    if (match) {
      scheduleAutoSave(`ko-${matchId}`, () => saveKnockoutPrediction(match, nextPick));
    }
  };

  const updateKnockoutScore = (matchId: string, side: 'home' | 'away', value: string) => {
    const score = value === '' ? null : Number(value);
    if (score !== null && (!Number.isInteger(score) || score < 0 || score > 30)) return;
    const match = matches.find((item) => item.id === matchId);
    if (!match) return;
    const updatedAt = new Date().toISOString();
    const nextPick = {
      ...getKnockoutPredictionBase(match, knockoutPredictions[matchId]),
      [side === 'home' ? 'predicted_home_score' : 'predicted_away_score']: score,
      updated_at: updatedAt,
    };
    setKnockoutPredictions((prev) => ({
      ...prev,
      [matchId]: nextPick,
    }));
    persistDraft({ knockoutPredictions: { [matchId]: nextPick } });
    scheduleAutoSave(`ko-${matchId}`, () => saveKnockoutPrediction(match, nextPick));
  };

  const saveKnockoutPrediction = async (match: Match, override?: Partial<KnockoutPrediction>) => {
    if (!user) return setShowAuth(true);
    if (!canEdit || isDeadlineClosed(getMatchDeadline(match, settings, profile?.prediction_unlocks))) return;
    const pred = getKnockoutPredictionBase(match, override || knockoutPredictions[match.id]);
    if (pred?.predicted_home_team_id && pred?.predicted_away_team_id && pred.predicted_home_team_id === pred.predicted_away_team_id) return;
    const hasAnyValue = Boolean(
      pred?.predicted_home_team_id ||
      pred?.predicted_away_team_id ||
      (pred?.predicted_home_score !== undefined && pred?.predicted_home_score !== null) ||
      (pred?.predicted_away_score !== undefined && pred?.predicted_away_score !== null),
    );
    if (!hasAnyValue) return;

    setSavingId(`ko-${match.id}`);
    const updatedAt = pred.updated_at || new Date().toISOString();
    const { error } = await supabase.from('knockout_predictions').upsert({
      user_id: user.id,
      community_id: communityId,
      match_id: match.id,
      predicted_home_team_id: pred.predicted_home_team_id,
      predicted_home_team_name: pred.predicted_home_team_name,
      predicted_home_team_code: pred.predicted_home_team_code,
      predicted_away_team_id: pred.predicted_away_team_id,
      predicted_away_team_name: pred.predicted_away_team_name,
      predicted_away_team_code: pred.predicted_away_team_code,
      predicted_home_score: pred.predicted_home_score ?? null,
      predicted_away_score: pred.predicted_away_score ?? null,
      updated_at: updatedAt,
    }, { onConflict: 'user_id,community_id,match_id' });

    if (error) alert(error.message);
    setSaveStatus(error ? 'error' : 'saved');
    setTimeout(() => setSavingId(null), 700);
    setTimeout(() => setSaveStatus('idle'), 2200);
  };

  const updateFinalistPick = (slot: FinalistSlot, teamId: string) => {
    const team = selectableTeams.find((item) => item.id === teamId) || teams.find((item) => item.id === teamId);
    const updatedAt = new Date().toISOString();
    const nextPick = {
      ...finalistPrediction,
      [`${slot}_team_id`]: team?.id || null,
      [`${slot}_team_name`]: team?.name || null,
      [`${slot}_team_code`]: team?.code || null,
      updated_at: updatedAt,
    };
    setFinalistPrediction(nextPick);
    persistDraft({ finalistPrediction: nextPick });
    scheduleAutoSave('finalists', () => saveFinalists(nextPick));
  };

  const saveFinalists = async (override?: Partial<FinalistPrediction>) => {
    if (!user) return setShowAuth(true);
    if (!canEdit || isDeadlineClosed(lateKnockoutDeadlineIso)) return;
    const pick = override || finalistPrediction || {};
    setSavingId('finalists');
    const updatedAt = pick.updated_at || new Date().toISOString();
    const { error } = await supabase.from('finalist_predictions').upsert({
      user_id: user.id,
      community_id: communityId,
      champion_team_id: pick.champion_team_id || null,
      champion_team_name: pick.champion_team_name || null,
      champion_team_code: pick.champion_team_code || null,
      runner_up_team_id: pick.runner_up_team_id || null,
      runner_up_team_name: pick.runner_up_team_name || null,
      runner_up_team_code: pick.runner_up_team_code || null,
      third_team_id: pick.third_team_id || null,
      third_team_name: pick.third_team_name || null,
      third_team_code: pick.third_team_code || null,
      fourth_team_id: pick.fourth_team_id || null,
      fourth_team_name: pick.fourth_team_name || null,
      fourth_team_code: pick.fourth_team_code || null,
      updated_at: updatedAt,
    }, { onConflict: 'user_id,community_id' });

    if (error) alert(error.message);
    setSaveStatus(error ? 'error' : 'saved');
    setTimeout(() => setSavingId(null), 700);
    setTimeout(() => setSaveStatus('idle'), 2200);
  };

  const saveScorer = async (overrideName = scorerName) => {
    if (!user) return setShowAuth(true);
    if (!canEdit || isDeadlineClosed(scorerDeadlineIso)) return;
    const candidate = SCORER_CANDIDATES.find((item) => normalizePlayerName(item.name) === normalizePlayerName(overrideName));
    if (!candidate) {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 2200);
      return;
    }
    const team = teams.find((item) => item.code === candidate.code);

    setSavingId('scorer');
    const nextScorer = {
      player_name: candidate.name,
      team_id: team?.id || null,
      team_name: team?.name || candidate.team,
      team_code: team?.code || candidate.code,
      updated_at: new Date().toISOString(),
    };
    setScorerName(candidate.name);
    setScorerTeamId(team?.id || '');
    persistDraft({ scorerPrediction: nextScorer });
    const { data, error } = await supabase.from('scorer_predictions').upsert({
      user_id: user.id,
      community_id: communityId,
      ...nextScorer,
    }, { onConflict: 'user_id,community_id' }).select('*').single();

    if (error) alert(error.message);
    if (data) setScorerPrediction(data as ScorerPrediction);
    setSaveStatus(error ? 'error' : 'saved');
    setTimeout(() => setSavingId(null), 700);
    setTimeout(() => setSaveStatus('idle'), 2200);
  };

  const downloadPredictionsPdf = () => {
    const groupRows = groupMatches.map((match) => {
      const pred = matchPredictions[match.id];
      return `<tr><td>${formatDateTime(match.kickoff_at)}</td><td>${displayTeam(match.home_team_name, match.home_team_code)} - ${displayTeam(match.away_team_name, match.away_team_code)}</td><td>${pred?.home_score ?? '-'} - ${pred?.away_score ?? '-'}</td></tr>`;
    }).join('');
    const standingRows = groups.map((group) => `
      <h3>Grupo ${group}</h3>
      <table><tbody>${(predictedStandings[group] || []).map((row) => `<tr><td>${row.position}</td><td>${displayTeam(row.teamName, row.teamCode)}</td><td>${row.pts} pts</td><td>${row.gf}-${row.ga}</td></tr>`).join('')}</tbody></table>
    `).join('');
    const popup = window.open('', '_blank', 'width=900,height=1100');
    if (!popup) return;
    popup.document.write(`
      <html>
        <head>
          <title>Pronósticos Mundial 2026</title>
          <style>
            body { background:#07131a; color:#f8fafc; font-family:Arial,sans-serif; padding:32px; }
            .hero { border:1px solid rgba(255,255,255,.16); border-radius:20px; padding:28px; margin-bottom:24px; background:#0a1820; }
            img { max-height:110px; }
            h1 { margin:12px 0 4px; font-size:32px; text-transform:uppercase; }
            h2 { color:#13a180; margin-top:28px; }
            h3 { color:#e33b2f; margin-bottom:8px; }
            table { width:100%; border-collapse:collapse; margin:8px 0 18px; background:rgba(255,255,255,.04); }
            td, th { border-bottom:1px solid rgba(255,255,255,.12); padding:9px; font-size:12px; }
            .grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
            @media print { body { background:white; color:#111; } .hero, table { background:white; } h2 { color:#0b7660; } h3 { color:#b51d18; } }
          </style>
        </head>
        <body>
          <div class="hero">
            <img src="${WORLD_CUP_LOGO_URL}" />
            <h1>Pronósticos Mundial 2026</h1>
            <p>${profile?.username || user?.email || 'Jugador'} · ${community.name}</p>
            <p>Generado el ${new Date().toLocaleString('es-ES')}</p>
          </div>
          <h2>Marcadores fase de grupos</h2>
          <table><thead><tr><th>Fecha</th><th>Partido</th><th>Pronóstico</th></tr></thead><tbody>${groupRows}</tbody></table>
          <h2>Clasificaciones previstas</h2>
          <div class="grid">${standingRows}</div>
          <script>window.onload = () => setTimeout(() => window.print(), 250)</script>
        </body>
      </html>
    `);
    popup.document.close();
  };

  if (loading) return <div className="flex justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-brand-gold" /></div>;

  return (
    <div className="space-y-8 sm:space-y-12 pb-24">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tighter italic">Mis <span className="text-brand-gold">Pronósticos</span></h1>
          <p className="text-brand-zinc-500 text-[10px] sm:text-xs font-bold uppercase tracking-widest mt-2">Calendario FIFA real • visible para todos</p>
        </div>
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-3 w-full sm:w-auto">
          <SaveStatusPill status={saveStatus} />
          <button onClick={downloadPredictionsPdf} className="flex items-center justify-center gap-2 rounded-lg border border-brand-gold/20 bg-brand-gold/10 px-4 py-3 sm:py-2 text-[10px] font-black uppercase tracking-widest text-brand-gold hover:bg-brand-gold/20 transition-colors">
            <FileDown className="w-4 h-4" /> PDF
          </button>
          <button onClick={() => window.location.reload()} className="flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 text-[10px] font-black uppercase tracking-widest text-brand-zinc-400 hover:text-white transition-colors group">
            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Recargar
          </button>
        </div>
      </div>

      {matches.length === 0 && (
        <div className="dimension-card-accent p-6 sm:p-8 text-center">
          <ShieldAlert className="w-10 h-10 text-brand-gold mx-auto mb-4" />
          <h2 className="text-xl font-black uppercase tracking-tighter mb-2">Falta sincronizar el calendario</h2>
          <p className="text-brand-zinc-400 text-sm">El admin debe lanzar la sincronización FIFA desde la vista Admin para cargar los 104 partidos.</p>
        </div>
      )}

      {!user && (
        <ViewerNotice
          icon={Eye}
          title="Modo calendario"
          text="Puedes consultar todos los partidos, horarios y banderas. Crea una cuenta para habilitar los pronósticos en esta misma vista."
          action="Entrar o registrarme"
          onClick={() => setShowAuth(true)}
        />
      )}

      {user && !approved && (
        <ViewerNotice
          icon={Lock}
          title="Cuenta pendiente"
          text="Tu cuenta ya existe, pero el admin debe aprobarte para competir oficialmente y guardar pronósticos."
          action="Ver calendario"
        />
      )}

      {user && approved && !groupsComplete && (
        <div className="dimension-card-accent p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-amber-400/30 bg-amber-400/10">
          <div className="flex gap-4">
            <AlertCircle className="w-6 h-6 text-amber-300 shrink-0" />
            <div>
              <h2 className="text-sm font-black uppercase tracking-widest text-white">Te faltan {missingGroupPredictionCount} marcadores de fase de grupos</h2>
              <p className="text-sm text-brand-zinc-300 mt-1">Rellena los resultados y la clasificación prevista se calculará sola. El guardado es automático.</p>
            </div>
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-amber-200">{completedGroupPredictionCount}/{groupMatches.length}</span>
        </div>
      )}

      {user && approved && groupsComplete && (
        <div className="dimension-card-accent p-5 flex gap-4 border-emerald-400/30 bg-emerald-500/10">
          <CheckCircle2 className="w-6 h-6 text-emerald-300 shrink-0" />
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest text-white">Fase de grupos completa y guardada en fecha</h2>
            <p className="text-sm text-brand-zinc-300 mt-1">Todo listo. Ya puedes mirar tu tabla prevista con calma y empezar a disfrutar del juego.</p>
          </div>
        </div>
      )}

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <PhaseButton active={activeFilter === 'groups'} onClick={() => changeFilter('groups')} title="1. Partidos fase 1" date={formatDateTime(groupDeadlineIso)} status={groupsComplete ? 'Completo' : `${completedGroupPredictionCount}/${groupMatches.length || 72}`} />
        <PhaseButton active={activeFilter === 'scorers'} onClick={() => changeFilter('scorers')} title="2. Goleadores" date={formatDateTime(scorerDeadlineIso)} status={scorerComplete ? 'Elegido' : 'Pendiente'} />
        <PhaseButton active={activeFilter === 'knockout'} onClick={() => changeFilter('knockout')} title="3. Fase eliminatoria" date={`16º ${formatDateTime(knockoutDeadlineIso)} · resto ${formatDateTime(lateKnockoutDeadlineIso)}`} status="Equipos + marcador" />
      </section>

      {activeFilter === 'groups' && (
        <div className="rounded-2xl border border-brand-gold/20 bg-brand-gold/5 p-4 sm:p-5 text-sm text-brand-zinc-300">
          <span className="font-black uppercase tracking-widest text-brand-gold">Fase 1:</span> introduce marcadores de grupos. La clasificación automática aparece al lado en escritorio y debajo en móvil.
        </div>
      )}

      {activeFilter === 'scorers' && <section className="dimension-card-accent p-6">
        <div className="flex items-center gap-3 mb-6">
          <Target className="w-5 h-5 text-brand-gold" />
          <h2 className="text-lg font-black uppercase tracking-tighter italic">Tu goleador</h2>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-brand-zinc-500">Selección cerrada</p>
              <h3 className="mt-1 text-base font-black uppercase tracking-tight">
                {selectedScorerCandidate ? selectedScorerCandidate.name : 'Elige 1 de los 25 candidatos'}
              </h3>
              <p className="mt-1 text-sm text-brand-zinc-400">
                Cada gol oficial de tu jugador suma {POINTS.scorerGoal} puntos cuando FIFA actualice los goleadores.
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-emerald-200">
              {savingId === 'scorer' ? <Loader2 className="w-3 h-3 animate-spin" /> : selectedScorerCandidate ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3 text-amber-200" />}
              {savingId === 'scorer' ? 'Guardando' : selectedScorerCandidate ? 'Guardado' : 'Pendiente'}
            </div>
          </div>
          {scorerPrediction?.player_name && !selectedScorerCandidate && (
            <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-xs text-amber-100">
              Tu elección anterior era "{scorerPrediction.player_name}". Para evitar errores de puntuación, ahora debes elegir uno de los 25 candidatos oficiales.
            </div>
          )}
          {scorerDeadlineClosed && (
            <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-brand-zinc-400">
              El plazo de goleador está cerrado. Se mantiene la elección guardada antes del cierre.
            </div>
          )}
        </div>
        {!user && (
          <button onClick={() => setShowAuth(true)} className="mt-4 dimension-button-primary w-full sm:w-auto px-6">
            Entrar o registrarme para elegir
          </button>
        )}
        <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {SCORER_CANDIDATES.map((candidate) => {
            const team = teams.find((item) => item.code === candidate.code);
            const selected = normalizePlayerName(scorerName || scorerPrediction?.player_name) === normalizePlayerName(candidate.name);
            return (
              <button
                key={candidate.name}
                type="button"
                disabled={!canEdit || scorerDeadlineClosed}
                onClick={() => {
                  if (!user) return setShowAuth(true);
                  setScorerName(candidate.name);
                  setScorerTeamId(team?.id || '');
                  void saveScorer(candidate.name);
                }}
                className={`group overflow-hidden rounded-xl border text-left transition-all disabled:opacity-40 ${selected ? 'border-brand-gold bg-brand-gold/10 shadow-lg shadow-brand-gold/10' : 'border-white/10 bg-white/[0.03] hover:border-brand-gold/40'}`}
              >
                <div className="aspect-[4/3] bg-black/50 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.10),transparent_58%)] p-2">
                  <img
                    src={candidate.photoUrl}
                    alt={candidate.name}
                    className="h-full w-full rounded-lg object-contain object-top grayscale transition-all group-hover:grayscale-0"
                    onError={(event) => { event.currentTarget.style.display = 'none'; }}
                  />
                </div>
                <div className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-black uppercase leading-tight">{candidate.name}</p>
                    {selected && <CheckCircle2 className="w-4 h-4 text-brand-gold shrink-0" />}
                  </div>
                  <p className="mt-1 text-[9px] font-black uppercase tracking-widest text-brand-zinc-500">{candidate.team} · {candidate.position}</p>
                  <p className="mt-3 text-[10px] leading-relaxed text-brand-zinc-400">{candidate.story}</p>
                  <p className="mt-2 rounded-lg border border-white/5 bg-black/20 p-2 text-[9px] leading-relaxed text-brand-gold/80">{candidate.projection}</p>
                </div>
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-[11px] text-brand-zinc-500">Lista oficial cerrada para este juego. No se aceptan goleadores escritos manualmente, así evitamos errores de puntuación.</p>
      </section>}

      {activeFilter !== 'scorers' && <section className="space-y-6">
        {activeFilter === 'knockout' && (
          <FinalistsPanel
            teams={selectableTeams}
            pick={finalistPrediction}
            locked={!canEdit || isDeadlineClosed(lateKnockoutDeadlineIso)}
            saving={savingId === 'finalists'}
            onChange={updateFinalistPick}
          />
        )}

        {activeFilter === 'knockout' && (
          <div className="rounded-2xl border border-brand-gold/20 bg-brand-gold/5 p-5 text-sm text-brand-zinc-300">
            <span className="font-black uppercase tracking-widest text-brand-gold">Eliminatorias:</span> en dieciseisavos el cruce real está bloqueado y solo pronosticas marcador. Desde octavos eliges selecciones únicamente dentro de la rama real del cuadro y también el marcador. Puntúa el marcador solo si el enfrentamiento previsto coincide con el cruce real. Dieciseisavos cierran {formatDateTime(knockoutDeadlineIso)}; octavos en adelante cierran {formatDateTime(lateKnockoutDeadlineIso)}.
          </div>
        )}

        {activeFilter === 'knockout' && <KnockoutPhaseJumps phases={Object.keys(matchesByPhase)} />}

        <div className="space-y-16">
          {Object.entries(matchesByPhase).map(([phase, phaseMatches]) => (
            <div key={phase} id={activeFilter === 'knockout' ? phaseDomId(phase) : undefined} className="scroll-mt-28 space-y-4">
              <h3 className="text-xl font-black uppercase tracking-[0.2em] italic text-white">{phase}</h3>
              <div className={phase.startsWith('Grupo ') ? 'grid gap-4 md:grid-cols-[minmax(0,1fr)_320px]' : 'grid gap-2'}>
                <div className="grid gap-2">
                {phaseMatches.map((match) => {
                  const pred = matchPredictions[match.id];
                  const isKnockout = isKnockoutFixture(match);
                  const knockoutPred = isKnockout ? getKnockoutPredictionBase(match, knockoutPredictions[match.id]) : knockoutPredictions[match.id];
                  const locked = !canEdit || (isKnockout ? isPredictionMatchLocked(match) : isPredictionMatchLocked(match));
                  const marketClosed = isPredictionMatchLocked(match);
                  const knockoutSaved = isKnockoutPickComplete(knockoutPred);
                  const matchPointEvents = getMatchPointEvents(match.id);

                  if (isKnockout) {
                    const teamsLocked = isRoundOf32Fixture(match);
                    const optionBranches = knockoutOptionBranches[match.id] || {
                      homeTeams: knockoutQualifiedTeams,
                      awayTeams: knockoutQualifiedTeams,
                    };
                    return (
                      <motion.div
                        key={match.id}
                        initial={{ opacity: 0, y: 8 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className={`grid grid-cols-1 lg:grid-cols-[150px_minmax(210px,1fr)_minmax(360px,1.5fr)_110px] items-center gap-4 p-4 rounded-xl border transition-all ${locked ? 'bg-white/[0.02] border-white/5' : 'bg-white/5 border-white/10 hover:border-brand-gold/30'}`}
                      >
                        <div className="text-[10px] font-black uppercase tracking-widest text-brand-zinc-500">
                          <Clock className="w-3 h-3 inline mr-1 text-brand-gold" />
                          {formatDateTime(match.kickoff_at)}
                          <div className="mt-1 text-brand-zinc-500">
                            <Tv className="w-3 h-3 inline mr-1 text-brand-gold/70" />
                            {match.tv_channel_es || 'DAZN / Canal Mediapro'}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-brand-gold">
                            Partido {match.match_number || '-'} • {match.phase}
                          </div>
                          {teamsLocked && <FixtureTeams match={match} />}
                        </div>

                        <div className="space-y-2">
                          <KnockoutPickControl
                            match={match}
                            homeTeams={teamsLocked ? [] : optionBranches.homeTeams}
                            awayTeams={teamsLocked ? [] : optionBranches.awayTeams}
                            pick={knockoutPred}
                            locked={locked}
                            teamsLocked={teamsLocked}
                            onTeamChange={updateKnockoutPick}
                            onScoreChange={updateKnockoutScore}
                          />
                          {user && approved && <KnockoutPairStatus match={match} pick={knockoutPred} />}
                        </div>

                        <div className="flex items-center justify-end gap-2">
                          {user && approved && <MatchPointsBadge match={match} events={matchPointEvents} />}
                          {savingId === `ko-${match.id}` ? <Loader2 className="w-4 h-4 animate-spin text-brand-gold" /> : locked ? <Lock className="w-4 h-4 text-brand-zinc-500" /> : <CheckCircle2 className={`w-4 h-4 ${knockoutSaved ? 'text-emerald-400' : 'text-white/10'}`} />}
                        </div>
                      </motion.div>
                    );
                  }

                  return (
                    <motion.div
                      key={match.id}
                      initial={{ opacity: 0, y: 8 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      className={`grid grid-cols-[minmax(0,1fr)_88px_minmax(0,1fr)] md:grid-cols-[150px_1fr_112px_1fr_110px] items-center gap-3 p-4 rounded-xl border transition-all ${locked ? 'bg-white/[0.02] border-white/5' : 'bg-white/5 border-white/10 hover:border-brand-gold/30'}`}
                    >
                      <div className="col-span-3 md:col-span-1 text-[10px] font-black uppercase tracking-widest text-brand-zinc-500">
                        <Clock className="w-3 h-3 inline mr-1 text-brand-gold" />
                        {formatDateTime(match.kickoff_at)}
                        <div className="mt-1 text-brand-zinc-500">
                          <Tv className="w-3 h-3 inline mr-1 text-brand-gold/70" />
                          {match.tv_channel_es || 'DAZN / Canal Mediapro'}
                        </div>
                      </div>
                      <TeamSide name={match.home_team_name} code={match.home_team_code} align="right" />
                      <div className="flex items-center justify-center gap-1.5">
                        <input
                          type="number"
                          min="0"
                          value={pred?.home_score ?? ''}
                          onChange={(event) => handleScoreChange(match, 'home', event.target.value)}
                          onBlur={() => saveMatchPrediction(match)}
                          disabled={locked}
                          className="w-9 h-9 sm:w-10 sm:h-10 bg-black/40 border border-brand-gold/30 rounded-lg text-center text-sm font-black focus:border-brand-gold outline-none disabled:opacity-40"
                        />
                        <span className="text-brand-gold/40 font-black text-xs">-</span>
                        <input
                          type="number"
                          min="0"
                          value={pred?.away_score ?? ''}
                          onChange={(event) => handleScoreChange(match, 'away', event.target.value)}
                          onBlur={() => saveMatchPrediction(match)}
                          disabled={locked}
                          className="w-9 h-9 sm:w-10 sm:h-10 bg-black/40 border border-brand-gold/30 rounded-lg text-center text-sm font-black focus:border-brand-gold outline-none disabled:opacity-40"
                        />
                      </div>
                      <TeamSide name={match.away_team_name} code={match.away_team_code} align="left" />
                      <div className="col-span-3 md:col-span-1 flex items-center justify-end gap-2">
                        {user && approved && <MatchPointsBadge match={match} events={matchPointEvents} />}
                        {savingId === match.id ? <Loader2 className="w-4 h-4 animate-spin text-brand-gold" /> : marketClosed || !canEdit ? <Lock className="w-4 h-4 text-brand-zinc-500" /> : <CheckCircle2 className={`w-4 h-4 ${pred?.home_score !== undefined && pred?.away_score !== undefined ? 'text-emerald-400' : 'text-white/10'}`} />}
                      </div>
                    </motion.div>
                  );
                })}
                </div>
                {phase.startsWith('Grupo ') && (
                  <div className="hidden md:block">
                    <GroupStandingCard group={phase.replace('Grupo ', '')} rows={predictedStandings[phase.replace('Grupo ', '')] || []} />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>}

      {activeFilter === 'groups' && <section className="space-y-5 md:hidden">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h2 className="text-lg font-black uppercase tracking-tighter italic flex items-center gap-3"><Trophy className="w-5 h-5 text-brand-gold" /> Clasificación prevista automática</h2>
          <span className="text-[10px] font-black uppercase tracking-widest text-brand-zinc-500">Cierra {formatDateTime(groupDeadlineIso)}</span>
        </div>
        <p className="text-sm text-brand-zinc-400">Se calcula automáticamente con tus marcadores. Puesto exacto: {POINTS.groupExactPosition} pts. Clasificado acertado sin puesto exacto: {POINTS.groupQualified} pts.</p>
        <div className="grid gap-4">
          {groups.map((group) => <GroupStandingCard key={group} group={group} rows={predictedStandings[group] || []} />)}
        </div>
      </section>}

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-xs text-brand-zinc-400">
        La fase de grupos cierra el {formatDateTime(groupDeadlineIso)}. El goleador cierra el {formatDateTime(scorerDeadlineIso)}. Dieciseisavos cierran el {formatDateTime(knockoutDeadlineIso)}. Octavos, cuartos, semifinales, tercer puesto y final cierran el {formatDateTime(lateKnockoutDeadlineIso)}.
      </div>
    </div>
  );
}

function MatchPointsBadge({ match, events }: { match: Match; events: PointEvent[] }) {
  if (match.status !== 'finished') return null;
  const total = events.reduce((sum, event) => sum + (Number(event.points) || 0), 0);
  const positive = total > 0;
  const label = events[0]?.label || (positive ? 'Puntos conseguidos' : 'Pronóstico sin puntos');

  return (
    <div
      title={label}
      className={`inline-flex min-w-[64px] items-center justify-center rounded-lg border px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest tabular-nums ${
        positive
          ? 'border-emerald-400/30 bg-emerald-500/15 text-emerald-200'
          : 'border-white/10 bg-white/[0.03] text-brand-zinc-500'
      }`}
    >
      {positive ? `+${total}` : '0'} pts
    </div>
  );
}

function KnockoutPairStatus({ match, pick }: { match: Match; pick?: Partial<KnockoutPrediction> }) {
  if (match.status !== 'finished') return null;

  const hasActualPair = Boolean(match.home_team_id && match.away_team_id);
  const hasPredictedPair = Boolean(pick?.predicted_home_team_id && pick?.predicted_away_team_id);
  if (!hasActualPair || !hasPredictedPair) {
    return (
      <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[9px] font-black uppercase tracking-widest text-brand-zinc-500">
        Cruce sin comparar
      </div>
    );
  }

  const pairMatched = (
    (pick?.predicted_home_team_id === match.home_team_id && pick?.predicted_away_team_id === match.away_team_id) ||
    (pick?.predicted_home_team_id === match.away_team_id && pick?.predicted_away_team_id === match.home_team_id)
  );

  return (
    <div className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-[9px] font-black uppercase tracking-widest ${
      pairMatched
        ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
        : 'border-red-400/30 bg-red-500/10 text-red-200'
    }`}
    >
      {pairMatched ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
      {pairMatched ? 'Cruce acertado · marcador válido' : 'Cruce fallado · marcador no puntúa'}
    </div>
  );
}

function ViewerNotice({ icon: Icon, title, text, action, onClick }: { icon: typeof Eye; title: string; text: string; action: string; onClick?: () => void }) {
  return (
    <div className="dimension-card-accent p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
      <div className="flex gap-4">
        <div className="w-11 h-11 rounded-xl bg-brand-gold/10 border border-brand-gold/20 flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-brand-gold" />
        </div>
        <div>
          <h2 className="text-sm font-black uppercase tracking-widest">{title}</h2>
          <p className="text-sm text-brand-zinc-400 mt-1">{text}</p>
        </div>
      </div>
      {onClick && <button onClick={onClick} className="dimension-button-primary w-full sm:w-auto px-6 whitespace-nowrap">{action}</button>}
    </div>
  );
}

function SaveStatusPill({ status }: { status: SaveStatus }) {
  if (status === 'idle') return null;
  const label = status === 'saving' ? 'Guardando...' : status === 'saved' ? 'Guardado' : 'Error al guardar';
  return (
    <div className={`flex items-center gap-2 rounded-full border px-3 py-2 text-[9px] font-black uppercase tracking-widest ${status === 'error' ? 'border-red-400/30 bg-red-500/10 text-red-200' : 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'}`}>
      {status === 'saving' ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
      {label}
    </div>
  );
}

function PhaseButton({ active, onClick, title, date, status }: { active: boolean; onClick: () => void; title: string; date: string; status?: string }) {
  return (
    <button onClick={onClick} className={`rounded-xl border p-4 text-left transition-all ${active ? 'border-brand-gold bg-brand-gold/10 shadow-lg shadow-brand-gold/10' : 'border-white/10 bg-white/[0.03] hover:border-white/20'}`}>
      <span className={`block text-xs sm:text-sm font-black uppercase tracking-widest leading-tight ${active ? 'text-brand-gold' : 'text-white'}`}>{title}</span>
      <span className="mt-1 block text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-brand-zinc-500">Cierre: {date}</span>
      {status && <span className={`mt-3 inline-flex rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-widest ${active ? 'border-brand-gold/30 text-brand-gold' : 'border-white/10 text-brand-zinc-400'}`}>{status}</span>}
    </button>
  );
}

function shortPhaseLabel(phase: string) {
  const normalized = normalizeStageText(phase);
  if (normalized.includes('dieciseis')) return '16º';
  if (normalized.includes('octavos')) return '8º';
  if (normalized.includes('cuartos')) return '4º';
  if (normalized.includes('semifinal')) return 'Semis';
  if (normalized.includes('tercer')) return '3º';
  if (normalized.includes('final')) return 'Final';
  return phase;
}

function KnockoutPhaseJumps({ phases }: { phases: string[] }) {
  if (phases.length <= 1) return null;

  const jumpToPhase = (phase: string) => {
    document.getElementById(phaseDomId(phase))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="sticky top-[calc(4.5rem+env(safe-area-inset-top))] z-30 -mx-1 overflow-x-auto rounded-2xl border border-white/10 bg-brand-gray/95 p-2 shadow-2xl shadow-black/30 backdrop-blur-xl sm:top-[calc(6rem+env(safe-area-inset-top))]">
      <div className="flex min-w-max gap-2">
        {phases.map((phase) => (
          <button
            key={phase}
            type="button"
            onClick={() => jumpToPhase(phase)}
            className="rounded-xl border border-brand-gold/20 bg-brand-gold/10 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-brand-gold active:scale-95"
          >
            {shortPhaseLabel(phase)}
          </button>
        ))}
      </div>
    </div>
  );
}

function FinalistsPanel({
  teams,
  pick,
  locked,
  saving,
  onChange,
}: {
  teams: Team[];
  pick: Partial<FinalistPrediction> | null;
  locked: boolean;
  saving: boolean;
  onChange: (slot: FinalistSlot, teamId: string) => void;
}) {
  const slots: { slot: FinalistSlot; label: string; value?: string | null; name?: string | null; code?: string | null }[] = [
    { slot: 'champion', label: 'Campeón', value: pick?.champion_team_id, name: pick?.champion_team_name, code: pick?.champion_team_code },
    { slot: 'runner_up', label: 'Segundo', value: pick?.runner_up_team_id, name: pick?.runner_up_team_name, code: pick?.runner_up_team_code },
    { slot: 'third', label: 'Tercero', value: pick?.third_team_id, name: pick?.third_team_name, code: pick?.third_team_code },
    { slot: 'fourth', label: 'Cuarto', value: pick?.fourth_team_id, name: pick?.fourth_team_name, code: pick?.fourth_team_code },
  ];
  const selectedIds = slots.map((item) => item.value).filter(Boolean);
  const complete = selectedIds.length === 4 && new Set(selectedIds).size === 4;

  return (
    <div className="dimension-card-accent p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-black uppercase tracking-tighter italic flex items-center gap-3">
            <Medal className="w-5 h-5 text-brand-gold" /> Top 4 final
          </h2>
          <p className="mt-1 text-sm text-brand-zinc-400">
            Elige las cuatro selecciones que acabarán 1ª, 2ª, 3ª y 4ª entre todas las participantes. Puesto exacto: {POINTS.finalistExactPosition} pts. Acertar selección dentro del Top 4 sin puesto exacto: {POINTS.finalistQualified} pts.
          </p>
        </div>
        <AutoSaveStateBadge saving={saving} complete={complete} locked={locked} />
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {slots.map((item) => (
          <TeamSelect
            key={item.slot}
            label={item.label}
            value={item.value || ''}
            teams={teams}
            locked={locked}
            selectedName={item.name}
            selectedCode={item.code}
            onChange={(teamId) => onChange(item.slot, teamId)}
          />
        ))}
      </div>
      {!complete && !locked && (
        <p className="text-[11px] font-bold text-amber-200">Completa cuatro selecciones diferentes para dejar esta parte cerrada.</p>
      )}
    </div>
  );
}

function TeamSide({ name, code, align }: { name: string; code: string | null; align: 'left' | 'right' }) {
  return (
    <div className={`flex min-w-0 items-center gap-2 sm:gap-3 ${align === 'right' ? 'justify-end text-right' : 'justify-start text-left'}`}>
      {align === 'left' && <Flag code={code} name={name} />}
      <span className="min-w-0 text-[10px] sm:text-xs font-black uppercase tracking-tight leading-tight break-words">{displayTeam(name, code)}</span>
      {align === 'right' && <Flag code={code} name={name} />}
    </div>
  );
}

function FixtureTeams({ match }: { match: Match }) {
  return (
    <div className="grid sm:grid-cols-[1fr_auto_1fr] items-center gap-2">
      <TeamSide name={match.home_team_name} code={match.home_team_code} align="right" />
      <span className="text-brand-gold/40 font-black text-[10px] text-center">VS</span>
      <TeamSide name={match.away_team_name} code={match.away_team_code} align="left" />
    </div>
  );
}

function KnockoutPickControl({
  match,
  homeTeams,
  awayTeams,
  pick,
  locked,
  teamsLocked,
  onTeamChange,
  onScoreChange,
}: {
  match: Match;
  homeTeams: Team[];
  awayTeams: Team[];
  pick?: Partial<KnockoutPrediction>;
  locked: boolean;
  teamsLocked: boolean;
  onTeamChange: (matchId: string, side: 'home' | 'away', teamId: string) => void;
  onScoreChange: (matchId: string, side: 'home' | 'away', value: string) => void;
}) {
  const valid =
    pick?.predicted_home_team_id &&
    pick?.predicted_away_team_id &&
    pick.predicted_home_team_id !== pick.predicted_away_team_id &&
    pick.predicted_home_score !== undefined &&
    pick.predicted_home_score !== null &&
    pick.predicted_away_score !== undefined &&
    pick.predicted_away_score !== null;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[minmax(0,1fr)_2rem_minmax(0,1fr)] items-stretch gap-2">
        {teamsLocked ? (
          <FixedKnockoutTeamBox
            label="Cruce real"
            name={pick?.predicted_home_team_name || match.home_team_name}
            code={pick?.predicted_home_team_code || match.home_team_code}
            complete={Boolean(pick?.predicted_home_team_id)}
          />
        ) : (
          <TeamSelect
            label="Equipo 1"
            value={pick?.predicted_home_team_id || ''}
            teams={homeTeams}
            locked={locked}
            selectedName={pick?.predicted_home_team_name}
            selectedCode={pick?.predicted_home_team_code}
            onChange={(teamId) => onTeamChange(match.id, 'home', teamId)}
          />
        )}
        <span className="flex min-h-[7.25rem] items-center justify-center rounded-lg border border-brand-gold/10 bg-black/20 text-[10px] font-black text-brand-gold/50">VS</span>
        {teamsLocked ? (
          <FixedKnockoutTeamBox
            label="Cruce real"
            name={pick?.predicted_away_team_name || match.away_team_name}
            code={pick?.predicted_away_team_code || match.away_team_code}
            complete={Boolean(pick?.predicted_away_team_id)}
          />
        ) : (
          <TeamSelect
            label="Equipo 2"
            value={pick?.predicted_away_team_id || ''}
            teams={awayTeams}
            locked={locked}
            selectedName={pick?.predicted_away_team_name}
            selectedCode={pick?.predicted_away_team_code}
            onChange={(teamId) => onTeamChange(match.id, 'away', teamId)}
          />
        )}
      </div>

      <div className="flex items-end justify-center gap-2">
        <label className="space-y-1">
          <span className="block text-[9px] font-black uppercase tracking-widest text-brand-zinc-500">Goles 1</span>
          <input
            type="number"
            min="0"
            value={pick?.predicted_home_score ?? ''}
            onChange={(event) => onScoreChange(match.id, 'home', event.target.value)}
            disabled={locked}
            className="w-14 h-11 bg-black/40 border border-brand-gold/30 rounded-lg text-center text-base sm:text-sm font-black focus:border-brand-gold outline-none disabled:opacity-40"
          />
        </label>
        <span className="pb-3 text-brand-gold/40 font-black text-xs">-</span>
        <label className="space-y-1">
          <span className="block text-[9px] font-black uppercase tracking-widest text-brand-zinc-500">Goles 2</span>
          <input
            type="number"
            min="0"
            value={pick?.predicted_away_score ?? ''}
            onChange={(event) => onScoreChange(match.id, 'away', event.target.value)}
            disabled={locked}
            className="w-14 h-11 bg-black/40 border border-brand-gold/30 rounded-lg text-center text-base sm:text-sm font-black focus:border-brand-gold outline-none disabled:opacity-40"
          />
        </label>
      </div>
      <div className={`flex h-10 items-center justify-center rounded-lg border px-3 text-[9px] font-black uppercase tracking-widest ${valid ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200' : 'border-white/10 bg-white/[0.03] text-brand-zinc-500'}`}>
        {valid ? <CheckCircle2 className="w-4 h-4" /> : 'Auto'}
      </div>
    </div>
  );
}

function AutoSaveStateBadge({ saving, complete, locked }: { saving: boolean; complete: boolean; locked: boolean }) {
  if (saving) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-emerald-200">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Guardando
      </div>
    );
  }

  if (complete) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-emerald-200">
        <CheckCircle2 className="w-3.5 h-3.5" />
        Guardado
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[10px] font-black uppercase tracking-widest ${locked ? 'border-white/10 text-brand-zinc-500' : 'border-amber-400/30 bg-amber-400/10 text-amber-100'}`}>
      {locked ? <Lock className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
      {locked ? 'Cerrado' : 'Autoguardado'}
    </div>
  );
}

function FixedKnockoutTeamBox({ label, name, code, complete }: { label: string; name: string; code: string | null; complete: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-brand-zinc-500">{label}</span>
      <div className={`flex min-h-[5.75rem] flex-col items-start justify-center gap-2 rounded-lg border px-2 py-2 text-[10px] sm:text-xs font-black uppercase ${complete ? 'border-brand-gold/25 bg-black/30 text-white' : 'border-amber-400/25 bg-amber-400/10 text-amber-100'}`}>
        <Flag code={code} name={name} />
        <span className="min-w-0 leading-tight break-words">{complete ? displayTeam(name, code) : 'Pendiente FIFA'}</span>
      </div>
    </div>
  );
}

function TeamSelect({
  label,
  value,
  teams,
  locked,
  selectedName,
  selectedCode,
  onChange,
}: {
  label: string;
  value: string;
  teams: Team[];
  locked: boolean;
  selectedName?: string | null;
  selectedCode?: string | null;
  onChange: (teamId: string) => void;
}) {
  const selectedTeam = teams.find((team) => team.id === value);
  const displayedName = selectedTeam?.name || selectedName || '';
  const displayedCode = selectedTeam?.code || selectedCode || null;
  const valueOutsideOptions = Boolean(value && !selectedTeam);

  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-brand-zinc-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={locked || teams.length === 0}
        className="min-h-11 w-full rounded-lg border border-white/10 bg-black/40 px-2 py-2 text-base sm:text-xs font-bold outline-none focus:border-brand-gold disabled:opacity-40"
      >
        <option value="">{teams.length ? 'Selecciona equipo' : 'Sin equipos'}</option>
        {valueOutsideOptions && displayedName && (
          <option value={value} disabled>{displayTeam(displayedName, displayedCode)} · fuera de rama</option>
        )}
        {teams.map((team) => <option key={team.id} value={team.id}>{displayTeam(team.name, team.code)}</option>)}
      </select>
      {value && displayedName && (
        <span className={`flex min-h-[2.75rem] items-center gap-2 rounded-lg border px-2 py-1 text-[10px] font-black uppercase ${
          valueOutsideOptions
            ? 'border-amber-400/25 bg-amber-400/10 text-amber-100'
            : 'border-brand-gold/15 bg-brand-gold/[0.06] text-brand-zinc-200'
        }`}
        >
          <Flag code={displayedCode} name={displayedName} />
          <span className="truncate">{displayTeam(displayedName, displayedCode)}{valueOutsideOptions ? ' · fuera de rama' : ''}</span>
        </span>
      )}
    </label>
  );
}

function Flag({ code, name }: { code: string | null; name: string }) {
  return (
    <div className="relative w-8 h-5 rounded-[2px] overflow-hidden border border-white/10 shrink-0 bg-black/30 flex items-center justify-center">
      <span className="text-base leading-none">{getFlagEmoji(name, code)}</span>
      <img
        src={getFlagUrl(name, code)}
        className="absolute inset-0 w-full h-full object-cover scale-125"
        alt=""
        onError={(event) => { event.currentTarget.style.display = 'none'; }}
      />
    </div>
  );
}

function GroupStandingCard({ group, rows }: { group: string; rows: PredictedStandingRow[] }) {
  return (
    <div className="dimension-card p-5 border-white/10">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-black uppercase tracking-widest">Grupo {group}</h3>
        <span className="text-[9px] font-black uppercase tracking-widest text-brand-gold">Auto</span>
      </div>
      <div className="space-y-2">
        {rows.length === 0 ? (
          <p className="text-xs text-brand-zinc-500">Introduce marcadores para ver la tabla prevista.</p>
        ) : rows.map((row) => (
          <div key={row.teamId} className={`grid grid-cols-[28px_1fr_auto] items-center gap-3 rounded-lg border px-3 py-2 ${row.position <= 2 ? 'border-brand-gold/20 bg-brand-gold/5' : 'border-white/5 bg-white/[0.02]'}`}>
            <span className="text-xs font-black text-brand-gold">{row.position}</span>
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <Flag code={row.teamCode} name={row.teamName} />
                <p className="truncate text-xs font-black uppercase text-white">{displayTeam(row.teamName, row.teamCode)}</p>
              </div>
              <p className="text-[9px] text-brand-zinc-500">{row.gf}-{row.ga} · DG {row.gd}</p>
            </div>
            <span className="font-mono text-xs font-black text-brand-zinc-300">{row.pts}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function calculatePredictedStandings(group: string, teams: Team[], matches: Match[], predictions: MatchPredictionMap) {
  const rows = new Map<string, Omit<PredictedStandingRow, 'position'>>();

  teams.filter((team) => team.group_code === group).forEach((team) => {
    rows.set(team.id, {
      teamId: team.id,
      teamName: team.name,
      teamCode: team.code,
      pts: 0,
      gf: 0,
      ga: 0,
      gd: 0,
    });
  });

  matches.filter((match) => match.group_code === group).forEach((match) => {
    const pred = predictions[match.id];
    if (pred?.home_score === undefined || pred?.away_score === undefined) return;
    if (!match.home_team_id || !match.away_team_id) return;

    const home = rows.get(match.home_team_id);
    const away = rows.get(match.away_team_id);
    if (!home || !away) return;

    home.gf += pred.home_score;
    home.ga += pred.away_score;
    away.gf += pred.away_score;
    away.ga += pred.home_score;
    home.gd = home.gf - home.ga;
    away.gd = away.gf - away.ga;

    if (pred.home_score > pred.away_score) home.pts += 3;
    else if (pred.home_score < pred.away_score) away.pts += 3;
    else {
      home.pts += 1;
      away.pts += 1;
    }
  });

  return Array.from(rows.values())
    .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || displayTeam(a.teamName, a.teamCode).localeCompare(displayTeam(b.teamName, b.teamCode), 'es'))
    .map((row, index) => ({ ...row, position: index + 1 }));
}
