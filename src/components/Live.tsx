import { useEffect, useMemo, useState } from 'react';
import { Loader2, Tv } from 'lucide-react';
import { motion } from 'motion/react';
import { supabase } from '../lib/supabase';
import { isSupabaseConfigured } from '../lib/supabase';
import type { Match } from '../lib/types';
import { displayTeam, getFlagUrl } from '../lib/flags';
import { formatDateTime } from '../lib/constants';
import ConfigRequired from './ConfigRequired';

export default function Live() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'live'>('all');

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    let mounted = true;

    supabase.from('matches').select('*').order('kickoff_at', { ascending: true }).then(({ data }) => {
      if (mounted) {
        setMatches((data || []) as Match[]);
        setLoading(false);
      }
    });

    const channel = supabase
      .channel('matches-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => {
        supabase.from('matches').select('*').order('kickoff_at', { ascending: true }).then(({ data }) => setMatches((data || []) as Match[]));
      })
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const filteredMatches = useMemo(() => {
    if (filter === 'live') return matches.filter((m) => m.status === 'live');
    return matches;
  }, [matches, filter]);

  const matchesByDate = useMemo(() => {
    const grouped: Record<string, Match[]> = {};
    filteredMatches.forEach((match) => {
      const date = new Intl.DateTimeFormat('es-ES', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'Europe/Madrid',
      }).format(new Date(match.kickoff_at));
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(match);
    });
    return grouped;
  }, [filteredMatches]);

  if (loading) return <div className="flex justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-brand-gold" /></div>;
  if (!isSupabaseConfigured) return <ConfigRequired title="Directo pendiente de Supabase" />;

  return (
    <div className="space-y-12 pb-20 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
        <h1 className="text-2xl font-black uppercase tracking-tighter italic">Cartelera <span className="text-brand-gold">Mundialista</span></h1>
        <div className="flex bg-white/5 border border-white/10 p-1 rounded-xl">
          <button onClick={() => setFilter('all')} className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${filter === 'all' ? 'bg-brand-gold text-black shadow-lg shadow-brand-gold/20' : 'text-brand-zinc-500 hover:text-white'}`}>Todos</button>
          <button onClick={() => setFilter('live')} className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${filter === 'live' ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' : 'text-brand-zinc-500 hover:text-white'}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${filter === 'live' ? 'bg-white' : 'bg-red-500'} animate-pulse`} />
            En directo
          </button>
        </div>
      </div>

      <div className="space-y-16">
        {Object.entries(matchesByDate).length === 0 ? (
          <div className="text-center py-20 bg-white/[0.02] border border-dashed border-white/10 rounded-3xl">
            <p className="text-brand-zinc-500 font-bold italic uppercase tracking-tighter">No hay partidos para mostrar</p>
          </div>
        ) : (
          Object.entries(matchesByDate).map(([date, dateMatches]) => (
            <div key={date} className="space-y-8">
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <h2 className="text-sm font-black text-brand-zinc-400 capitalize tracking-tight">{date}</h2>
              </div>
              <div className="grid gap-6">
                {dateMatches.map((match) => <MatchCard key={match.id} match={match} />)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function MatchCard({ match }: { match: Match }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className={`bg-white/5 border rounded-3xl overflow-hidden transition-all group ${match.status === 'live' ? 'border-red-500/30 bg-red-500/[0.02]' : 'border-white/5 hover:border-brand-gold/20'}`}
    >
      <div className="p-8 sm:p-12 relative flex flex-col items-center">
        <div className="absolute top-4 left-1/2 -translate-x-1/2">
          {match.status === 'live' ? (
            <span className="px-3 py-1 bg-red-500 text-white text-[8px] font-black uppercase tracking-widest rounded-full animate-pulse shadow-lg shadow-red-500/20">En directo</span>
          ) : match.status === 'finished' ? (
            <span className="px-3 py-1 bg-white/10 text-white/40 text-[8px] font-black uppercase tracking-widest rounded-full">Finalizado</span>
          ) : (
            <span className="px-3 py-1 bg-white/5 text-brand-zinc-500 text-[8px] font-black uppercase tracking-widest rounded-full">{formatDateTime(match.kickoff_at)}</span>
          )}
        </div>

        <div className="flex items-center justify-center gap-8 sm:gap-16 w-full mb-6 mt-4">
          <TeamBlock name={match.home_team_name} code={match.home_team_code} align="right" />
          <div className="flex flex-col items-center gap-1 min-w-[100px]">
            {match.status === 'finished' || match.status === 'live' ? (
              <div className="flex items-center gap-4">
                <span className="text-4xl font-black italic text-white">{match.home_score ?? 0}</span>
                <span className="text-brand-zinc-600 font-bold">:</span>
                <span className="text-4xl font-black italic text-white">{match.away_score ?? 0}</span>
              </div>
            ) : (
              <div className="text-3xl font-black italic tracking-tighter text-brand-gold">
                {new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' }).format(new Date(match.kickoff_at))}
              </div>
            )}
          </div>
          <TeamBlock name={match.away_team_name} code={match.away_team_code} align="left" />
        </div>

        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-3 text-[10px] font-bold text-brand-zinc-500 uppercase tracking-[0.2em]">
            <span>{match.phase}</span>
            <span className="text-brand-gold/40">•</span>
            <span>{match.venue || 'Sede por confirmar'}</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-black text-brand-gold uppercase tracking-[0.2em] mt-2">
            <Tv className="w-3.5 h-3.5" />
            <span>{match.tv_channel_es || 'DAZN / Canal Mediapro'}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function TeamBlock({ name, code, align }: { name: string; code: string | null; align: 'left' | 'right' }) {
  return (
    <div className={`flex-1 flex flex-col sm:flex-row items-center gap-6 ${align === 'right' ? 'justify-end text-right' : 'justify-start'}`}>
      {align === 'left' && <Flag name={name} code={code} />}
      <span className="hidden sm:block text-lg font-black uppercase tracking-tight text-white">{displayTeam(name, code)}</span>
      {align === 'right' && <Flag name={name} code={code} />}
      <span className="sm:hidden text-xs font-black uppercase text-white mt-2">{displayTeam(name, code)}</span>
    </div>
  );
}

function Flag({ name, code }: { name: string; code: string | null }) {
  return (
    <div className="w-16 h-10 rounded-lg overflow-hidden border border-white/10 shadow-2xl flex-shrink-0">
      <img src={getFlagUrl(name, code)} className="w-full h-full object-cover scale-150" alt="" />
    </div>
  );
}
