import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { Loader2, Globe, TrendingUp, Info } from 'lucide-react';
import { getFlagUrl } from '../lib/flags';
import { motion, AnimatePresence } from 'motion/react';

export default function Standings() {
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<any[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'groups'), orderBy('id', 'asc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      if (snap.empty) {
        const dummyGroups = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"].map(id => ({
          id,
          teams: [
            { name: "TBD 1", pts: 0, pj: 0, dg: 0 },
            { name: "TBD 2", pts: 0, pj: 0, dg: 0 },
            { name: "TBD 3", pts: 0, pj: 0, dg: 0 },
            { name: "TBD 4", pts: 0, pj: 0, dg: 0 }
          ]
        }));
        setGroups(dummyGroups);
      } else {
        setGroups(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) return (
    <div className="flex flex-col items-center justify-center p-20 gap-4">
      <Loader2 className="w-10 h-10 animate-spin text-brand-gold" />
      <span className="text-[10px] font-black uppercase tracking-[0.4em] text-brand-gold/60 italic">Cargando Posiciones</span>
    </div>
  );

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
          <button 
            onClick={() => setSelectedGroup(null)}
            className={`px-6 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${!selectedGroup ? 'bg-brand-gold text-brand-black shadow-lg shadow-brand-gold/20' : 'text-brand-zinc-500 hover:text-white'}`}
          >
            Todos
          </button>
          {groups.map(g => (
            <button 
              key={g.id}
              onClick={() => setSelectedGroup(g.id)}
              className={`px-4 py-2.5 rounded-lg text-[10px] font-black uppercase transition-all ${selectedGroup === g.id ? 'bg-brand-gold text-brand-black shadow-lg shadow-brand-gold/20' : 'text-brand-zinc-500 hover:text-white'}`}
            >
              {g.id}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <AnimatePresence mode="popLayout">
          {groups.filter(g => !selectedGroup || g.id === selectedGroup).map(group => (
            <motion.div 
              key={group.id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="dimension-card border-brand-gold/10 overflow-hidden"
            >
              <div className="bg-brand-gold text-brand-black px-6 py-4 flex justify-between items-center shadow-lg">
                <div className="flex items-center gap-3">
                   <div className="w-8 h-8 rounded-full bg-black/10 flex items-center justify-center font-black italic">G</div>
                   <h3 className="text-sm font-black uppercase tracking-widest">Grupo {group.id}</h3>
                </div>
                <TrendingUp className="w-4 h-4 opacity-40" />
              </div>
              
              <div className="overflow-x-auto">
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
                    {group.teams.map((teamData: any, idx: number) => {
                      const teamName = typeof teamData === 'string' ? teamData : teamData.name;
                      const pts = typeof teamData === 'object' ? (teamData.pts || 0) : 0;
                      const pj = typeof teamData === 'object' ? (teamData.pj || 0) : 0;
                      const dg = typeof teamData === 'object' ? (teamData.dg || 0) : 0;
                      
                      return (
                        <tr key={teamName} className="hover:bg-white/[0.03] transition-colors group">
                          <td className="px-6 py-5">
                            <span className={`text-sm font-black italic ${idx < 2 ? 'text-brand-gold' : 'text-brand-zinc-600'}`}>
                              {idx + 1}
                            </span>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-4">
                              <div className="relative w-10 h-7 rounded-md overflow-hidden bg-white/5 border border-white/10 group-hover:scale-110 transition-transform">
                                 <img src={getFlagUrl(teamName)} className="w-full h-full object-cover scale-150" alt="" />
                                 <div className="absolute inset-0 bg-gradient-to-tr from-black/20 to-transparent" />
                              </div>
                              <span className="text-sm font-black uppercase tracking-tight text-white group-hover:text-brand-gold transition-colors">{teamName}</span>
                            </div>
                          </td>
                          <td className="px-6 py-5 text-center font-mono text-brand-zinc-400 font-bold">{pj}</td>
                          <td className="px-6 py-5 text-center font-mono text-brand-zinc-400 font-bold">{dg > 0 ? `+${dg}` : dg}</td>
                          <td className="px-6 py-5 text-center">
                            <div className="bg-brand-gold/10 px-3 py-1.5 rounded-lg border border-brand-gold/20 flex items-center justify-center min-w-[40px]">
                              <span className="text-sm font-black text-brand-gold italic">{pts}</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              <div className="p-4 bg-black/40 flex items-center justify-between">
                <div className="flex items-center gap-4 text-[9px] font-bold text-brand-zinc-600 uppercase tracking-widest">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 bg-brand-gold rounded-full" />
                    Octavos
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 bg-brand-zinc-800 rounded-full" />
                    Eliminado
                  </div>
                </div>
                <Info className="w-3 h-3 text-brand-zinc-700 cursor-help" />
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

