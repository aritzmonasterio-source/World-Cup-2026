import dimensionLogo from '../assets/dimension-football-logo.png';
import athleticLogo from '../assets/athletic-club-logo.jpg';
import crossfitLogo from '../assets/crossfit-7am-logo.jpg';
import worldCupLogo from '../assets/world-cup-2026-logo.png';
import type { CSSProperties } from 'react';

export type CommunityId = 'dimension-football' | 'athletic-club' | 'electric-league';

export interface CommunityTheme {
  id: CommunityId;
  name: string;
  shortName: string;
  description: string;
  logoUrl?: string;
  logoText: string;
  colors: {
    bg: string;
    black: string;
    gold: string;
    accent: string;
    zinc900: string;
    zinc800: string;
    zinc700: string;
    zinc500: string;
    zinc400: string;
  };
}

export const WORLD_CUP_LOGO_URL = worldCupLogo;

export const COMMUNITIES: CommunityTheme[] = [
  {
    id: 'dimension-football',
    name: 'Dimension Football',
    shortName: 'Dimension',
    description: 'La comunidad principal con estética oro y antracita.',
    logoUrl: dimensionLogo,
    logoText: 'DF',
    colors: {
      bg: '#2E2E2E',
      black: '#1A1A1A',
      gold: '#AE9C50',
      accent: '#10b981',
      zinc900: '#1a1a1a',
      zinc800: '#27272a',
      zinc700: '#3f3f46',
      zinc500: '#71717a',
      zinc400: '#a1a1aa',
    },
  },
  {
    id: 'athletic-club',
    name: 'Athletic Club',
    shortName: 'Athletic',
    description: 'Liga independiente con negros, rojos y grises antracita.',
    logoUrl: athleticLogo,
    logoText: 'AC',
    colors: {
      bg: '#202124',
      black: '#111113',
      gold: '#e30613',
      accent: '#f4f4f5',
      zinc900: '#18181b',
      zinc800: '#27272a',
      zinc700: '#3f3f46',
      zinc500: '#85858c',
      zinc400: '#d4d4d8',
    },
  },
  {
    id: 'electric-league',
    name: 'Crossfit 7AM',
    shortName: 'Crossfit 7AM',
    description: 'Comunidad Crossfit 7AM con blanco, azul noche y naranja.',
    logoUrl: crossfitLogo,
    logoText: '7AM',
    colors: {
      bg: '#111742',
      black: '#070b22',
      gold: '#ff9514',
      accent: '#ffffff',
      zinc900: '#10163a',
      zinc800: '#16204f',
      zinc700: '#26366f',
      zinc500: '#8391b9',
      zinc400: '#f5f7ff',
    },
  },
];

export const DEFAULT_COMMUNITY_ID: CommunityId = 'dimension-football';

export const NEUTRAL_THEME: CommunityTheme = {
  id: 'dimension-football',
  name: 'Mundial 2026',
  shortName: 'Mundial',
  description: 'Acceso neutral antes de elegir comunidad.',
  logoUrl: worldCupLogo,
  logoText: '26',
  colors: {
    bg: '#07131a',
    black: '#050a0f',
    gold: '#0f8f74',
    accent: '#e33b2f',
    zinc900: '#0a1820',
    zinc800: '#102934',
    zinc700: '#18424e',
    zinc500: '#7fa0a6',
    zinc400: '#e5f0ee',
  },
};

export function getCommunity(id?: string | null) {
  return COMMUNITIES.find((community) => community.id === id) || COMMUNITIES[0];
}

export function getCommunityThemeStyle(community: CommunityTheme) {
  return {
    '--color-brand-gray': community.colors.bg,
    '--color-brand-black': community.colors.black,
    '--color-brand-gold': community.colors.gold,
    '--color-brand-accent': community.colors.accent,
    '--color-brand-zinc-900': community.colors.zinc900,
    '--color-brand-zinc-800': community.colors.zinc800,
    '--color-brand-zinc-700': community.colors.zinc700,
    '--color-brand-zinc-500': community.colors.zinc500,
    '--color-brand-zinc-400': community.colors.zinc400,
  } as CSSProperties;
}
