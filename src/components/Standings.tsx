import { useEffect, useMemo, useState } from 'react';
import { Globe, Info, Loader2, TrendingUp } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { supabase } from '../lib/supabase';
import { isSupabaseConfigured } from '../lib/supabase';
import type { Match } from '../lib/types';
import { displayTeam, getFlagUrl } from '../lib/flags';
import ConfigRequired from './ConfigRequired';

interface StandingTeam {
  id: string;
  code: string | null;
  name: string;
  pj: number;
  gf: number;
  ga: number;
  pts: number;
}

export default function Standings() {
  const [loading, setLoading] = useState(true);
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    supabase.from('matches').select('*').lte('round_number', 3).order('group_code').then(({ data }) => {
      setMatches((data || []) as Match[]);
      setLoading(false);
    });
  }, []);

  const groups = useMemo(() => calculateGroups(matches), [matches]);

  if (loading) return <div className="flex justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-brand-gold" /></div>;
  if (!isSupabaseConfigured) return <ConfigRequired title="Grupos pendientes de Supabase" />;

  return (
    <div className="space-y-12 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3 text-brand-gold">
            <Globe className="w-4 h-4" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">Copa del Mundo 2026</span>
          </div>
          <h1 className="text-3xl font-black uppercase tracking-tighter italic">Clasificación <span className="text-brand-gold">Grupos</span></h1>
        </div>
        <div className="flex items-center gap-3 p-1 bg-white/5 rounded-xl border border-white/10 overflow-x-auto no-scrollbar">
          <button onClick={() => setSelectedGroup(null)} className={`px-6 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${!selectedGroup ? 'bg-brand-gold text-brand-black shadow-lg shadow-brand-gold/20' : 'text-brand-zinc-500 hover:text-white'}`}>Todos</button>
          {Object.keys(groups).map((group) => (
            <button key={group} onClick={() => setSelectedGroup(group)} className={`px-4 py-2.5 rounded-lg text-[10px] font-black uppercase transition-all ${selectedGroup === group ? 'bg-brand-gold text-brand-black shadow-lg shadow-brand-gold/20' : 'text-brand-zinc-500 hover:text-white'}`}>{group}</button>
          ))}
        </div>
      </div>

      {Object.keys(groups).length === 0 ? (
        <div className="dimension-card-accent p-12 text-center text-brand-zinc-400">Sin calendario cargado. Lanza la sincronización FIFA desde Admin.</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <AnimatePresence mode="popLayout">
            {Object.entries(groups).filter(([group]) => !selectedGroup || group === selectedGroup).map(([group, teams]) => (
              <motion.div key={group} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="dimension-card border-brand-gold/10 overflow-hidden">
                <div className="bg-brand-gold text-brand-black px-6 py-4 flex justify-between items-center shadow-lg">
                  <h3 className="text-sm font-black uppercase tracking-widest">Grupo {group}</h3>
                  <TrendingUp className="w-4 h-4 opacity-40" />
                </div>
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-black/20 text-[10px] font-black text-brand-zinc-500 uppercase tracking-widest border-b border-white/5">
                      <th className="px-6 py-4">P</th>
                      <th className="px-6 py-4">Selección</th>
                      <th className="px-6 py-4 text-center">PJ</th>
                      <th className="px-6 py-4 text-center">DG</th>
                      <th className="px-6 py-4 text-center">PTS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {teams.map((team, idx) => (
                      <tr key={team.id} className="hover:bg-white/[0.03] transition-colors group">
                        <td className="px-6 py-5"><span className={`text-sm font-black italic ${idx < 2 ? 'text-brand-gold' : 'text-brand-zinc-600'}`}>{idx + 1}</span></td>
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-4">
                            <div className="relative w-10 h-7 rounded-md overflow-hidden bg-white/5 border border-white/10">
                              <img src={getFlagUrl(team.name, team.code)} className="w-full h-full object-cover scale-150" alt="" />
                            </div>
                            <span className="text-sm font-black uppercase tracking-tight text-white group-hover:text-brand-gold transition-colors">{displayTeam(team.name, team.code)}</span>
                          </div>
                        </td>
                        <td className="px-6 py-5 text-center font-mono text-brand-zinc-400 font-bold">{team.pj}</td>
                        <td className="px-6 py-5 text-center font-mono text-brand-zinc-400 font-bold">{team.gf - team.ga > 0 ? `+${team.gf - team.ga}` : team.gf - team.ga}</td>
                        <td className="px-6 py-5 text-center"><span className="text-sm font-black text-brand-gold italic">{team.pts}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="p-4 bg-black/40 flex items-center justify-between">
                  <div className="flex items-center gap-4 text-[9px] font-bold text-brand-zinc-600 uppercase tracking-widest">
                    <span>Los 2 primeros son los clasificados de posición</span>
                  </div>
                  <Info className="w-3 h-3 text-brand-zinc-700" />
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function calculateGroups(matches: Match[]) {
  const groups: Record<string, Record<string, StandingTeam>> = {};
  matches.forEach((match) => {
    const group = match.group_code || '?';
    if (!groups[group]) groups[group] = {};
    [
      { id: match.home_team_id || match.home_team_code || match.home_team_name, code: match.home_team_code, name: match.home_team_name },
      { id: match.away_team_id || match.away_team_code || match.away_team_name, code: match.away_team_code, name: match.away_team_name },
    ].forEach((team) => {
      if (!groups[group][team.id]) groups[group][team.id] = { ...team, pj: 0, gf: 0, ga: 0, pts: 0 };
    });

    if (match.status !== 'finished' || match.home_score == null || match.away_score == null) return;
    const home = groups[group][match.home_team_id || match.home_team_code || match.home_team_name];
    const away = groups[group][match.away_team_id || match.away_team_code || match.away_team_name];
    home.pj += 1; away.pj += 1;
    home.gf += match.home_score; home.ga += match.away_score;
    away.gf += match.away_score; away.ga += match.home_score;
    if (match.home_score > match.away_score) home.pts += 3;
    else if (match.home_score < match.away_score) away.pts += 3;
    else { home.pts += 1; away.pts += 1; }
  });

  return Object.fromEntries(Object.entries(groups).map(([group, table]) => [
    group,
    Object.values(table).sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf || displayTeam(a.name, a.code).localeCompare(displayTeam(b.name, b.code))),
  ]));
}
