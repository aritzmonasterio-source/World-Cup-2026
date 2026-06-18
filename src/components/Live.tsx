import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Loader2, Medal, RefreshCw, Target, Trophy } from 'lucide-react';
import { motion } from 'motion/react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { displayTeam } from '../lib/flags';
import ConfigRequired from './ConfigRequired';
import TeamFlag from './TeamFlag';

const SCORER_SYNC_INTERVAL_MS = 5 * 60 * 1000;
const SCORER_SYNC_STORAGE_KEY = 'worldcup-scorer-sync-last-run';

interface PlayerGoal {
  player_key: string;
  player_name: string;
  team_id: string | null;
  team_name: string | null;
  team_code: string | null;
  goals: number;
  updated_at?: string;
}

interface MatchGoalEvent {
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
  updated_at?: string;
  matches?: {
    home_team_name: string;
    away_team_name: string;
    home_team_code: string | null;
    away_team_code: string | null;
    phase: string;
  };
}

export default function Live() {
  const [goals, setGoals] = useState<PlayerGoal[]>([]);
  const [events, setEvents] = useState<MatchGoalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncNotice, setSyncNotice] = useState('');
  const syncInFlight = useRef(false);

  async function loadScorers() {
    const { data: goalRows } = await supabase
      .from('player_goals')
      .select('*')
      .order('goals', { ascending: false })
      .order('player_name', { ascending: true });

    const { data: eventRows, error: eventError } = await supabase
      .from('match_goal_events')
      .select('*, matches(home_team_name, away_team_name, home_team_code, away_team_code, phase)')
      .eq('own_goal', false)
      .order('match_number', { ascending: false })
      .order('minute', { ascending: false })
      .limit(20);

    setGoals((goalRows || []) as PlayerGoal[]);
    setEvents(eventError ? [] : (eventRows || []) as MatchGoalEvent[]);
    setLoading(false);
  }

  async function syncScorers({ force = false, silent = false } = {}) {
    if (!isSupabaseConfigured || syncInFlight.current) return;
    if (!force && !shouldRunAutoSync()) return;

    syncInFlight.current = true;
    if (!silent) {
      setSyncing(true);
      setSyncNotice('');
    }

    try {
      const { data, error } = await supabase.functions.invoke<{
        ok: boolean;
        scorers?: number;
        scorerSource?: string;
        scorerPointEvents?: number;
        scorerPoints?: number;
      }>('sync-fifa-matches');

      if (error) throw error;
      markAutoSync();
      await loadScorers();
      if (!silent) {
        const scorers = data?.scorers ?? 0;
        const points = data?.scorerPoints ?? 0;
        setSyncNotice(`Goleadores actualizados: ${scorers} jugadores y ${points} puntos de goleador recalculados.`);
      }
    } catch (error) {
      console.warn('No se pudieron sincronizar goleadores', error);
      if (!silent) setSyncNotice('No se pudo sincronizar ahora. Prueba de nuevo en unos segundos o desde Admin.');
    } finally {
      syncInFlight.current = false;
      if (!silent) setSyncing(false);
    }
  }

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    loadScorers();
    void syncScorers({ silent: true });
    const interval = window.setInterval(() => {
      void syncScorers({ silent: true });
    }, SCORER_SYNC_INTERVAL_MS);

    const channel = supabase
      .channel('scorers-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'player_goals' }, loadScorers)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match_goal_events' }, loadScorers)
      .subscribe();

    return () => {
      window.clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  const leader = goals[0];
  const totalGoals = useMemo(() => goals.reduce((sum, row) => sum + row.goals, 0), [goals]);

  if (loading) return <div className="flex justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-brand-gold" /></div>;
  if (!isSupabaseConfigured) return <ConfigRequired title="Goleadores pendiente de Supabase" />;

  return (
    <div className="space-y-10 pb-20">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
        <div>
          <div className="flex items-center gap-3 text-brand-gold">
            <Target className="w-4 h-4" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">Ranking oficial</span>
          </div>
          <h1 className="mt-2 text-3xl font-black uppercase tracking-tighter italic">Goleadores <span className="text-brand-gold">Mundial 2026</span></h1>
          <p className="mt-2 text-sm text-brand-zinc-400 max-w-2xl">
            Esta vista recoge los goles reales sincronizados desde FIFA/ESPN o corregidos por el admin. Sirve como fuente para puntuar el goleador elegido.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row lg:items-end gap-3">
          <button
            type="button"
            onClick={() => void syncScorers({ force: true })}
            disabled={syncing}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-brand-gold/20 bg-brand-gold/10 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-brand-gold transition hover:bg-brand-gold hover:text-black disabled:cursor-wait disabled:opacity-70"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Actualizando' : 'Actualizar goles'}
          </button>
          <div className="grid grid-cols-2 gap-3">
            <StatPill label="Goles registrados" value={totalGoals} />
            <StatPill label="Jugadores" value={goals.length} />
          </div>
        </div>
      </div>

      {syncNotice && (
        <div className={`rounded-2xl border px-4 py-3 text-sm font-bold ${
          syncNotice.startsWith('No se pudo')
            ? 'border-red-500/30 bg-red-500/10 text-red-100'
            : 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100'
        }`}>
          {syncNotice}
        </div>
      )}

      {leader && (
        <section className="dimension-card-accent p-6 grid md:grid-cols-[auto_1fr_auto] gap-5 items-center">
          <div className="h-16 w-16 rounded-2xl border border-brand-gold/20 bg-brand-gold/10 flex items-center justify-center">
            <Trophy className="w-8 h-8 text-brand-gold" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-zinc-500">Líder actual</p>
            <h2 className="mt-1 text-2xl font-black uppercase tracking-tighter">{leader.player_name}</h2>
            <p className="mt-1 text-sm text-brand-zinc-400">{displayTeam(leader.team_name || 'Selección por confirmar', leader.team_code)}</p>
          </div>
          <div className="text-right">
            <p className="font-mono text-5xl font-black text-brand-gold">{leader.goals}</p>
            <p className="text-[10px] font-black uppercase tracking-widest text-brand-zinc-500">goles</p>
          </div>
        </section>
      )}

      <section className="dimension-card overflow-hidden border-brand-gold/10">
        <div className="grid grid-cols-[56px_1fr_72px] sm:grid-cols-[72px_1fr_160px_90px] items-center gap-3 border-b border-white/10 bg-black/20 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-brand-zinc-500">
          <span>Pos</span>
          <span>Jugador</span>
          <span className="hidden sm:block">Selección</span>
          <span className="text-right">Goles</span>
        </div>

        {goals.length === 0 ? (
          <div className="p-10 text-center">
            <Medal className="mx-auto mb-4 h-10 w-10 text-brand-gold/60" />
            <h2 className="text-lg font-black uppercase tracking-tighter">Aún no hay goleadores oficiales</h2>
            <p className="mt-2 text-sm text-brand-zinc-400">Cuando FIFA o ESPN publiquen goles oficiales, aparecerán aquí automáticamente y recalcularán el ranking.</p>
          </div>
        ) : (
          goals.map((row, index) => (
            <motion.div
              key={row.player_key}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="grid grid-cols-[56px_1fr_72px] sm:grid-cols-[72px_1fr_160px_90px] items-center gap-3 border-b border-white/5 px-4 py-4 last:border-b-0 hover:bg-white/[0.03] transition-colors"
            >
              <span className={`text-lg font-black italic ${index < 3 ? 'text-brand-gold' : 'text-brand-zinc-600'}`}>{index + 1}</span>
              <div className="min-w-0">
                <p className="truncate text-sm font-black uppercase text-white">{row.player_name}</p>
                <p className="mt-1 sm:hidden text-[10px] font-black uppercase tracking-widest text-brand-zinc-500">{displayTeam(row.team_name || 'Selección', row.team_code)}</p>
              </div>
              <div className="hidden sm:flex items-center gap-2">
                <Flag name={row.team_name || 'Selección'} code={row.team_code} />
                <span className="truncate text-xs font-black uppercase text-brand-zinc-300">{displayTeam(row.team_name || 'Selección', row.team_code)}</span>
              </div>
              <div className="text-right">
                <span className="font-mono text-xl font-black text-brand-gold">{row.goals}</span>
              </div>
            </motion.div>
          ))
        )}
      </section>

      {events.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-brand-gold" />
            <h2 className="text-lg font-black uppercase tracking-tighter italic">Últimos goles detectados</h2>
          </div>
          <div className="grid gap-3">
            {events.map((event) => (
              <div key={event.event_key} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 grid sm:grid-cols-[1fr_auto] gap-3">
                <div className="flex items-center gap-3">
                  <Flag name={event.team_name || 'Selección'} code={event.team_code} />
                  <div>
                    <p className="text-sm font-black uppercase">{event.player_name}</p>
                    <p className="text-xs text-brand-zinc-500">
                      {event.matches ? `${displayTeam(event.matches.home_team_name, event.matches.home_team_code)} vs ${displayTeam(event.matches.away_team_name, event.matches.away_team_code)}` : 'Partido por confirmar'}
                    </p>
                  </div>
                </div>
                <div className="text-[10px] font-black uppercase tracking-widest text-brand-gold sm:text-right">
                  {event.minute ? `${event.minute}'` : 'Minuto pendiente'} {event.penalty ? '· Penalti' : ''}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function shouldRunAutoSync() {
  try {
    const lastRun = Number(window.localStorage.getItem(SCORER_SYNC_STORAGE_KEY) || 0);
    return !lastRun || Date.now() - lastRun > SCORER_SYNC_INTERVAL_MS;
  } catch {
    return true;
  }
}

function markAutoSync() {
  try {
    window.localStorage.setItem(SCORER_SYNC_STORAGE_KEY, String(Date.now()));
  } catch {
    // Local storage can be unavailable in strict/private browser modes.
  }
}

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-right">
      <p className="font-mono text-2xl font-black text-brand-gold">{value}</p>
      <p className="text-[9px] font-black uppercase tracking-widest text-brand-zinc-500">{label}</p>
    </div>
  );
}

function Flag({ name, code }: { name: string; code: string | null }) {
  return <TeamFlag name={name} code={code} className="h-6 w-9 bg-white/5" imageClassName="scale-125" />;
}
