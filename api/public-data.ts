import { createClient } from '@supabase/supabase-js';

declare const process: { env: Record<string, string | undefined> };

export default async function handler(_request: any, response: any) {
  response.setHeader('Cache-Control', 'no-store, max-age=0');

  const supabaseUrl = cleanEnv(process.env.VITE_SUPABASE_URL);
  const supabaseAnonKey = cleanEnv(process.env.VITE_SUPABASE_ANON_KEY);

  if (!supabaseUrl || !supabaseAnonKey) {
    response.status(500).json({ error: 'Missing Supabase public environment variables' });
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const [{ data: matches, error: matchError }, { data: teams, error: teamError }] = await Promise.all([
    supabase.from('matches').select('*').order('kickoff_at', { ascending: true }),
    supabase.from('teams').select('*').order('group_code', { ascending: true }).order('name', { ascending: true }),
  ]);

  if (matchError || teamError) {
    response.status(500).json({ error: matchError?.message || teamError?.message || 'Calendar unavailable' });
    return;
  }

  response.status(200).json({ matches: matches || [], teams: teams || [] });
}

function cleanEnv(value?: string) {
  return value?.trim().replace(/^['"]/, '').replace(/['"]$/, '');
}
