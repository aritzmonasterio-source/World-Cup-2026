import type { CommunitySettings, Match, PredictionPhase, PredictionUnlocks } from './types';
import { GROUP_DEADLINE_ISO, KNOCKOUT_DEADLINE_ISO } from './constants';

const UNLOCK_KEY: Record<PredictionPhase, keyof PredictionUnlocks> = {
  groups: 'groups_until',
  scorer: 'scorer_until',
  knockout: 'knockout_until',
};

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

export function getMatchDeadline(
  match: Pick<Match, 'round_number' | 'phase'>,
  settings?: CommunitySettings | null,
  unlocks?: PredictionUnlocks | null,
) {
  const phase = match.phase?.toLowerCase() || '';
  const isGroup =
    (match.round_number !== null && match.round_number !== undefined && match.round_number <= 3) ||
    phase.includes('grupo') ||
    phase.includes('group');

  return getPhaseDeadline(isGroup ? 'groups' : 'knockout', settings, unlocks);
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
