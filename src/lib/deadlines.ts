import type { CommunitySettings, Match, PredictionPhase, PredictionUnlocks } from './types';
import { GROUP_DEADLINE_ISO, KNOCKOUT_DEADLINE_ISO, KNOCKOUT_LATE_DEADLINE_ISO } from './constants';

type PhaseUnlockKey = 'groups_until' | 'scorer_until' | 'knockout_until';

const UNLOCK_KEY: Record<PredictionPhase, PhaseUnlockKey> = {
  groups: 'groups_until',
  scorer: 'scorer_until',
  knockout: 'knockout_until',
};

export const KNOCKOUT_ROUND_UNLOCKS = [
  { key: 'round-of-16', label: 'Octavos' },
  { key: 'quarter-finals', label: 'Cuartos' },
  { key: 'semi-finals', label: 'Semifinales' },
  { key: 'third-place', label: 'Tercer puesto' },
  { key: 'final', label: 'Final' },
] as const;

function parseTime(value?: string | null) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function isoOrFallback(value: number, fallback: string) {
  return value > 0 ? new Date(value).toISOString() : fallback;
}

export function getPhaseDeadline(
  phase: PredictionPhase,
  settings?: CommunitySettings | null,
  unlocks?: PredictionUnlocks | null,
) {
  const groupDeadline = settings?.groups_deadline_at || GROUP_DEADLINE_ISO;
  const baseByPhase: Record<PredictionPhase, string> = {
    groups: groupDeadline,
    scorer: settings?.scorer_deadline_at || groupDeadline,
    knockout: settings?.knockout_deadline_at || KNOCKOUT_DEADLINE_ISO,
  };

  const base = baseByPhase[phase];
  const manualUnlock = unlocks?.[UNLOCK_KEY[phase]];
  return isoOrFallback(Math.max(parseTime(base), parseTime(manualUnlock)), base);
}

export function getLateKnockoutDeadline(
  settings?: CommunitySettings | null,
  unlocks?: PredictionUnlocks | null,
) {
  const manualUnlock = unlocks?.knockout_until;
  const configuredDeadline = settings?.knockout_deadline_at;
  return isoOrFallback(
    Math.max(parseTime(KNOCKOUT_LATE_DEADLINE_ISO), parseTime(configuredDeadline), parseTime(manualUnlock)),
    KNOCKOUT_LATE_DEADLINE_ISO,
  );
}

function normalizedStageText(match: Partial<Pick<Match, 'phase' | 'stage_name'>>) {
  return `${match.phase || ''} ${match.stage_name || ''}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function isRoundOf32DeadlineMatch(match: Partial<Pick<Match, 'round_number' | 'phase' | 'stage_name'>>) {
  const stageText = normalizedStageText(match);
  return (
    (match.round_number || 0) === 4 ||
    stageText.includes('dieciseis') ||
    stageText.includes('round of 32') ||
    stageText.includes('ronda de 32')
  );
}

export function getKnockoutRoundKey(match: Partial<Pick<Match, 'round_number' | 'phase' | 'stage_name'>>) {
  const stageText = normalizedStageText(match);
  if (isRoundOf32DeadlineMatch(match)) return 'round-of-32';
  if ((match.round_number || 0) === 5 || stageText.includes('octavos') || stageText.includes('round of 16')) return 'round-of-16';
  if ((match.round_number || 0) === 6 || stageText.includes('cuartos') || stageText.includes('quarter')) return 'quarter-finals';
  if ((match.round_number || 0) === 7 || stageText.includes('semifinal') || stageText.includes('semi-final')) return 'semi-finals';
  if (stageText.includes('tercer') || stageText.includes('third')) return 'third-place';
  if ((match.round_number || 0) >= 8 || stageText.includes('final')) return 'final';
  return stageText || String(match.round_number || 'knockout');
}

function isSameKnockoutRound(a: Partial<Pick<Match, 'round_number' | 'phase' | 'stage_name'>>, b: Partial<Pick<Match, 'round_number' | 'phase' | 'stage_name'>>) {
  return getKnockoutRoundKey(a) === getKnockoutRoundKey(b);
}

function firstRoundKickoffMinusOneMinute(match: Pick<Match, 'round_number' | 'phase' | 'kickoff_at'> & Partial<Pick<Match, 'stage_name'>>, matches?: Match[]) {
  const roundMatches = (matches || [])
    .filter((item) => isSameKnockoutRound(match, item))
    .map((item) => parseTime(item.kickoff_at))
    .filter((time) => time > 0);

  const firstKickoff = roundMatches.length
    ? Math.min(...roundMatches)
    : parseTime(match.kickoff_at);

  return firstKickoff > 0 ? new Date(firstKickoff - 60_000).toISOString() : '';
}

function isGroupMatch(match: Pick<Match, 'round_number' | 'phase'>) {
  const phase = match.phase?.toLowerCase() || '';
  return (
    (match.round_number !== null && match.round_number !== undefined && match.round_number <= 3) ||
    phase.includes('grupo') ||
    phase.includes('group')
  );
}

export function getKnockoutRoundDeadline(
  match: Pick<Match, 'round_number' | 'phase' | 'kickoff_at'> & Partial<Pick<Match, 'stage_name'>>,
  matches?: Match[],
  settings?: CommunitySettings | null,
  unlocks?: PredictionUnlocks | null,
) {
  if (isRoundOf32DeadlineMatch(match)) return getPhaseDeadline('knockout', settings, unlocks);

  const roundKey = getKnockoutRoundKey(match);
  const roundDeadline = firstRoundKickoffMinusOneMinute(match, matches);
  const manualUnlock = unlocks?.knockout_until;
  const communityRoundUnlock = settings?.knockout_round_unlocks?.[roundKey];
  const memberRoundUnlock = unlocks?.knockout_round_unlocks?.[roundKey];
  return isoOrFallback(
    Math.max(parseTime(roundDeadline), parseTime(communityRoundUnlock), parseTime(memberRoundUnlock), parseTime(manualUnlock)),
    roundDeadline || getLateKnockoutDeadline(settings, unlocks),
  );
}

export function isMatchKickoffLocked(
  match: Pick<Match, 'kickoff_at' | 'status'>,
  now = new Date(),
) {
  if (match.status === 'live' || match.status === 'finished') return true;
  const kickoff = parseTime(match.kickoff_at);
  return kickoff > 0 && now.getTime() >= kickoff - 60_000;
}

export function getMatchDeadline(
  match: Pick<Match, 'round_number' | 'phase'> & Partial<Pick<Match, 'stage_name'>>,
  settings?: CommunitySettings | null,
  unlocks?: PredictionUnlocks | null,
) {
  if (isGroupMatch(match)) return getPhaseDeadline('groups', settings, unlocks);
  if (isRoundOf32DeadlineMatch(match)) return getPhaseDeadline('knockout', settings, unlocks);

  return getLateKnockoutDeadline(settings, unlocks);
}

export function isDeadlineClosed(deadlineIso: string, now = new Date()) {
  return now.getTime() > new Date(deadlineIso).getTime();
}

export function toDateTimeLocalValue(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export function fromDateTimeLocalValue(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

export function addHoursIso(hours: number, from = new Date()) {
  return new Date(from.getTime() + hours * 60 * 60 * 1000).toISOString();
}
