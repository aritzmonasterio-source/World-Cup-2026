import { FLAG_COUNTRY_BY_TEAM_CODE, getDisplayTeamName, getFlagUrlByCode } from './constants';

export function getFlagUrl(teamName?: string | null, code?: string | null) {
  return getFlagUrlByCode(code || inferCodeFromName(teamName));
}

export function displayTeam(teamName?: string | null, code?: string | null) {
  return getDisplayTeamName(teamName, code);
}

export function getFlagEmoji(teamName?: string | null, code?: string | null) {
  const teamCode = code || inferCodeFromName(teamName);
  const country = teamCode ? FLAG_COUNTRY_BY_TEAM_CODE[teamCode] : null;
  if (!country) return '🏳️';
  if (country === 'gb-eng') return '🏴';
  if (country === 'gb-sct') return '🏴';
  if (country.length !== 2) return '🏳️';
  return country
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));
}

function inferCodeFromName(teamName?: string | null) {
  if (!teamName) return null;
  const normalized = teamName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const map: Record<string, string> = {
    mexico: 'MEX',
    sudafrica: 'RSA',
    'south africa': 'RSA',
    'corea del sur': 'KOR',
    'korea republic': 'KOR',
    chequia: 'CZE',
    czechia: 'CZE',
    canada: 'CAN',
    'bosnia and herzegovina': 'BIH',
    'bosnia y herzegovina': 'BIH',
    qatar: 'QAT',
    suiza: 'SUI',
    switzerland: 'SUI',
    brasil: 'BRA',
    brazil: 'BRA',
    marruecos: 'MAR',
    morocco: 'MAR',
    haiti: 'HAI',
    escocia: 'SCO',
    scotland: 'SCO',
    usa: 'USA',
    'estados unidos': 'USA',
    paraguay: 'PAR',
    australia: 'AUS',
    turquia: 'TUR',
    turkiye: 'TUR',
    germany: 'GER',
    alemania: 'GER',
    curazao: 'CUW',
    curacao: 'CUW',
    ecuador: 'ECU',
    'cote d’ivoire': 'CIV',
    'cote d ivoire': 'CIV',
    'costa de marfil': 'CIV',
    netherlands: 'NED',
    'paises bajos': 'NED',
    japon: 'JPN',
    japan: 'JPN',
    suecia: 'SWE',
    sweden: 'SWE',
    tunez: 'TUN',
    tunisia: 'TUN',
    belgica: 'BEL',
    belgium: 'BEL',
    egipto: 'EGY',
    egypt: 'EGY',
    iran: 'IRN',
    'ir iran': 'IRN',
    'new zealand': 'NZL',
    'nueva zelanda': 'NZL',
    spain: 'ESP',
    espana: 'ESP',
    'cabo verde': 'CPV',
    'saudi arabia': 'KSA',
    'arabia saudi': 'KSA',
    uruguay: 'URU',
    france: 'FRA',
    francia: 'FRA',
    senegal: 'SEN',
    iraq: 'IRQ',
    irak: 'IRQ',
    norway: 'NOR',
    noruega: 'NOR',
    argentina: 'ARG',
    algeria: 'ALG',
    argelia: 'ALG',
    austria: 'AUT',
    jordan: 'JOR',
    jordania: 'JOR',
    portugal: 'POR',
    'congo dr': 'COD',
    'rd congo': 'COD',
    uzbekistan: 'UZB',
    colombia: 'COL',
    england: 'ENG',
    inglaterra: 'ENG',
    croatia: 'CRO',
    croacia: 'CRO',
    ghana: 'GHA',
    panama: 'PAN',
  };
  return map[normalized] || null;
}
