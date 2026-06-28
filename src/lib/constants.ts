import type { Match } from './types';
import dimensionLogo from '../assets/dimension-football-logo.png';

export const DEFAULT_ADMIN_EMAIL = 'aritzmonasterio@gmail.com';
export const ADMIN_EMAIL = cleanEmail(import.meta.env.VITE_ADMIN_EMAIL) || DEFAULT_ADMIN_EMAIL;

function cleanEmail(value?: string) {
  return value?.trim().replace(/^['"]|['"]$/g, '').toLowerCase() || '';
}

export const FIFA_COMPETITION_ID = '17';
export const FIFA_SEASON_ID = '285023';
export const FIFA_MATCHES_URL =
  `https://api.fifa.com/api/v3/calendar/matches?idCompetition=${FIFA_COMPETITION_ID}&idSeason=${FIFA_SEASON_ID}&language=en&count=120`;

export const DIMENSION_LOGO_URL = dimensionLogo;
export const GROUP_DEADLINE_ISO = '2026-06-11T18:30:00.000Z'; // 11 Jun 2026 20:30 Europe/Madrid
export const KNOCKOUT_DEADLINE_ISO = '2026-06-28T18:59:00.000Z'; // 28 Jun 2026 20:59 Europe/Madrid
export const KNOCKOUT_LATE_DEADLINE_ISO = '2026-06-30T22:00:00.000Z'; // 1 Jul 2026 00:00 Europe/Madrid

export const POINTS = {
  exactScore: 15,
  outcome: 8,
  scorerGoal: 10,
  groupExactPosition: 8,
  groupQualified: 5,
  qualifiedPosition: 8,
  knockoutTeam: 10,
  finalistExactPosition: 40,
  finalistQualified: 25,
};

export const TEAM_NAME_ES: Record<string, string> = {
  MEX: 'México',
  RSA: 'Sudáfrica',
  KOR: 'Corea del Sur',
  CZE: 'Chequia',
  CAN: 'Canadá',
  BIH: 'Bosnia y Herzegovina',
  QAT: 'Qatar',
  SUI: 'Suiza',
  BRA: 'Brasil',
  MAR: 'Marruecos',
  HAI: 'Haití',
  SCO: 'Escocia',
  USA: 'Estados Unidos',
  PAR: 'Paraguay',
  AUS: 'Australia',
  TUR: 'Turquía',
  GER: 'Alemania',
  CUW: 'Curazao',
  CIV: 'Costa de Marfil',
  ECU: 'Ecuador',
  NED: 'Países Bajos',
  JPN: 'Japón',
  SWE: 'Suecia',
  TUN: 'Túnez',
  BEL: 'Bélgica',
  EGY: 'Egipto',
  IRN: 'Irán',
  NZL: 'Nueva Zelanda',
  ESP: 'España',
  CPV: 'Cabo Verde',
  KSA: 'Arabia Saudí',
  URU: 'Uruguay',
  FRA: 'Francia',
  SEN: 'Senegal',
  IRQ: 'Irak',
  NOR: 'Noruega',
  ARG: 'Argentina',
  ALG: 'Argelia',
  AUT: 'Austria',
  JOR: 'Jordania',
  POR: 'Portugal',
  COD: 'RD Congo',
  UZB: 'Uzbekistán',
  COL: 'Colombia',
  ENG: 'Inglaterra',
  CRO: 'Croacia',
  GHA: 'Ghana',
  PAN: 'Panamá',
};

export const FLAG_COUNTRY_BY_TEAM_CODE: Record<string, string> = {
  MEX: 'mx',
  RSA: 'za',
  KOR: 'kr',
  CZE: 'cz',
  CAN: 'ca',
  BIH: 'ba',
  QAT: 'qa',
  SUI: 'ch',
  BRA: 'br',
  MAR: 'ma',
  HAI: 'ht',
  SCO: 'gb-sct',
  USA: 'us',
  PAR: 'py',
  AUS: 'au',
  TUR: 'tr',
  GER: 'de',
  CUW: 'cw',
  CIV: 'ci',
  ECU: 'ec',
  NED: 'nl',
  JPN: 'jp',
  SWE: 'se',
  TUN: 'tn',
  BEL: 'be',
  EGY: 'eg',
  IRN: 'ir',
  NZL: 'nz',
  ESP: 'es',
  CPV: 'cv',
  KSA: 'sa',
  URU: 'uy',
  FRA: 'fr',
  SEN: 'sn',
  IRQ: 'iq',
  NOR: 'no',
  ARG: 'ar',
  ALG: 'dz',
  AUT: 'at',
  JOR: 'jo',
  POR: 'pt',
  COD: 'cd',
  UZB: 'uz',
  COL: 'co',
  ENG: 'gb-eng',
  CRO: 'hr',
  GHA: 'gh',
  PAN: 'pa',
};

export function getDisplayTeamName(name?: string | null, code?: string | null) {
  if (code && TEAM_NAME_ES[code]) return TEAM_NAME_ES[code];
  return name || 'Por definir';
}

export function getFlagUrlByCode(code?: string | null) {
  const normalizedCode = code?.trim().toUpperCase() || '';
  const country = normalizedCode ? FLAG_COUNTRY_BY_TEAM_CODE[normalizedCode] : null;
  return country ? `https://flagcdn.com/w80/${country}.png` : '';
}

export function getDeadlineForMatch(match: Pick<Match, 'round_number' | 'phase' | 'kickoff_at'>) {
  const phase = match.phase?.toLowerCase() || '';
  if ((match.round_number !== null && match.round_number !== undefined && match.round_number <= 3) || phase.includes('grupo') || phase.includes('group')) {
    return GROUP_DEADLINE_ISO;
  }
  return KNOCKOUT_DEADLINE_ISO;
}

export function isMatchLocked(match: Pick<Match, 'round_number' | 'phase' | 'kickoff_at'>, now = new Date()) {
  return now.getTime() > new Date(getDeadlineForMatch(match)).getTime();
}

export function formatDateTime(date: string) {
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Madrid',
  }).format(new Date(date));
}
