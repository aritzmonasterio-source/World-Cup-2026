import { createClient } from '@supabase/supabase-js';
import { ADMIN_EMAIL, DEFAULT_ADMIN_EMAIL } from './constants';
import type { Profile } from './types';

const supabaseUrl = cleanSupabaseUrl(import.meta.env.VITE_SUPABASE_URL);
const supabaseAnonKey = cleanSupabaseKey(import.meta.env.VITE_SUPABASE_ANON_KEY);

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = createClient(
  supabaseUrl || 'https://example.supabase.co',
  supabaseAnonKey || 'missing-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'world-cup-2026-session',
    },
  },
);

export function isAdmin(profile?: Profile | null, email?: string | null) {
  const normalizedEmail = normalizeEmail(email);
  return profile?.role === 'admin' || normalizedEmail === ADMIN_EMAIL || normalizedEmail === DEFAULT_ADMIN_EMAIL;
}

export function canPlay(profile?: Profile | null, email?: string | null) {
  return isAdmin(profile, email) || profile?.status === 'approved';
}

export function profileStatusLabel(profile?: Profile | null) {
  if (!profile) return 'Sin perfil';
  if (profile.status === 'approved') return 'Cuenta aprobada';
  if (profile.status === 'blocked') return 'Cuenta bloqueada';
  return 'Pendiente de aprobación';
}

function cleanSupabaseUrl(value?: string) {
  return value?.trim().match(/https:\/\/[a-z0-9-]+\.supabase\.co/i)?.[0] || '';
}

function cleanSupabaseKey(value?: string) {
  return value?.trim().replace(/['"\s]/g, '') || '';
}

function normalizeEmail(value?: string | null) {
  return value?.trim().replace(/^['"]|['"]$/g, '').toLowerCase() || '';
}
