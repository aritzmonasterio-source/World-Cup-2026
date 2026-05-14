import { useState, useEffect, useMemo } from 'react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { Clock, Tv, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { getFlagUrl } from '../lib/flags';

export default function Live() {
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'live'>('all');

  useEffect(() => {
    const q = query(collection(db, 'matches'), orderBy('date', 'asc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      setMatches(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (error) => {
      console.error(error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const filteredMatches = useMemo(() => {
    if (filter === 'live') return matches.filter(m => m.status === 'live');
    return matches;
  }, [matches, filter]);

  const matchesByDate = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    const sorted = [...filteredMatches].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    sorted.forEach(m => {
      const date = new Date(m.date).toLocaleDateString('es-ES', { 
        weekday: 'long', 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
      });
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(m);
    });
    return grouped;
  }, [filteredMatches]);

  if (loading) return <div className="flex justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-brand-gold" /></div>;

  return (
    <div className="space-y-12 pb-20 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
        <h1 className="text-2xl font-black uppercase tracking-tighter italic">Cartelera <span className="text-brand-gold">Mundialista</span></h1>
        
        <div className="flex bg-white/5 border border-white/10 p-1 rounded-xl">
          <button 
            onClick={() => setFilter('all')}
            className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${filter === 'all' ? 'bg-brand-gold text-black shadow-lg shadow-brand-gold/20' : 'text-brand-zinc-500 hover:text-white'}`}
          >
            Todos
          </button>
          <button 
            onClick={() => setFilter('live')}
            className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${filter === 'live' ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' : 'text-brand-zinc-500 hover:text-white'}`}
          >
            <div className={`w-1.5 h-1.5 rounded-full ${filter === 'live' ? 'bg-white' : 'bg-red-500'} animate-pulse`} />
            En Directo
          </button>
        </div>
      </div>

      <div className="space-y-16">
        {Object.entries(matchesByDate).length === 0 ? (
          <div className="text-center py-20 bg-white/[0.02] border border-dashed border-white/10 rounded-3xl">
             <p className="text-brand-zinc-500 font-bold italic uppercase tracking-tighter">No hay partidos para mostrar con este filtro</p>
          </div>
        ) : (
          Object.entries(matchesByDate as Record<string, any[]>).map(([date, dateMatches]) => (
            <div key={date} className="space-y-8">
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <h2 className="text-sm font-black text-brand-zinc-400 capitalize tracking-tight">{date}</h2>
              </div>

              <div className="grid gap-6">
                {dateMatches.map((match) => (
                  <motion.div 
                    key={match.id}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className={`bg-white/5 border rounded-3xl overflow-hidden transition-all group ${match.status === 'live' ? 'border-red-500/30 bg-red-500/[0.02]' : 'border-white/5 hover:border-brand-gold/20'}`}
                  >
                    <div className="p-8 sm:p-12 relative flex flex-col items-center">
                      <div className="absolute top-4 left-1/2 -translate-x-1/2">
                         {match.status === 'live' ? (
                           <span className="px-3 py-1 bg-red-500 text-white text-[8px] font-black uppercase tracking-widest rounded-full animate-pulse shadow-lg shadow-red-500/20">En Directo</span>
                         ) : match.status === 'finished' ? (
                           <span className="px-3 py-1 bg-white/10 text-white/40 text-[8px] font-black uppercase tracking-widest rounded-full">Finalizado</span>
                         ) : (
                           <span className="px-3 py-1 bg-white/5 text-brand-zinc-500 text-[8px] font-black uppercase tracking-widest rounded-full">Próximamente</span>
                         )}
                      </div>

                      <div className="flex items-center justify-center gap-10 sm:gap-20 w-full mb-6 mt-4">
                        <div className="flex-1 flex flex-col sm:flex-row items-center justify-end gap-6 text-right">
                          <span className="hidden sm:block text-lg font-black uppercase tracking-tight text-white">{match.homeTeam}</span>
                          <div className="w-16 h-10 rounded-lg overflow-hidden border border-white/10 shadow-2xl flex-shrink-0">
                            <img src={getFlagUrl(match.homeTeam)} className="w-full h-full object-cover scale-150" alt="" />
                          </div>
                          <span className="sm:hidden text-xs font-black uppercase text-white mt-2">{match.homeTeam}</span>
                        </div>

                        <div className="flex flex-col items-center gap-1 min-w-[100px]">
                          {match.status === 'finished' || match.status === 'live' ? (
                            <div className="flex items-center gap-4">
                              <span className={`text-4xl font-black italic ${match.status === 'live' ? 'text-white' : 'text-white/60'}`}>{match.homeScore}</span>
                              <span className="text-brand-zinc-600 font-bold">:</span>
                              <span className={`text-4xl font-black italic ${match.status === 'live' ? 'text-white' : 'text-white/60'}`}>{match.awayScore}</span>
                            </div>
                          ) : (
                            <div className="text-3xl font-black italic tracking-tighter text-brand-gold">
                              {new Date(match.date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          )}
                        </div>

                        <div className="flex-1 flex flex-col sm:flex-row items-center justify-start gap-6">
                          <div className="w-16 h-10 rounded-lg overflow-hidden border border-white/10 shadow-2xl flex-shrink-0">
                            <img src={getFlagUrl(match.awayTeam)} className="w-full h-full object-cover scale-150" alt="" />
                          </div>
                          <span className="hidden sm:block text-lg font-black uppercase tracking-tight text-white">{match.awayTeam}</span>
                          <span className="sm:hidden text-xs font-black uppercase text-white mt-2">{match.awayTeam}</span>
                        </div>
                      </div>

                      <div className="flex flex-col items-center gap-1">
                        <div className="flex items-center gap-3 text-[10px] font-bold text-brand-zinc-500 uppercase tracking-[0.2em]">
                          <span>{match.phase}</span>
                          <span className="text-brand-gold/40">•</span>
                          <span>{match.venue}</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
