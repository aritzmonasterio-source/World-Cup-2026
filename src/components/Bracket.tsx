import { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Trophy, Loader2 } from 'lucide-react';

export default function Bracket() {
  const [koMatches, setKoMatches] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchKO() {
      try {
        const q = query(collection(db, 'matches'), where('id', '>=', 'ko_'));
        const snap = await getDocs(q);
        const map: Record<string, any> = {};
        snap.forEach(d => map[d.id] = d.data());
        setKoMatches(map);
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    }
    fetchKO();
  }, []);

  if (loading) return <div className="flex justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-brand-gold" /></div>;

  return (
    <div className="space-y-12">
      <div className="flex items-center gap-3">
        <div className="w-1.5 h-6 bg-brand-gold rounded-full" />
        <h2 className="text-2xl font-black uppercase tracking-tighter italic">Cuadro <span className="text-brand-gold">Dimension</span></h2>
      </div>
      
      <div className="dimension-card-accent p-6 sm:p-12 min-h-[600px] overflow-x-auto no-scrollbar">
        <div className="flex flex-nowrap gap-12 min-w-[1400px] py-10">
          
          {/* Dieciseisavos (Round of 32) */}
          <BracketColumn 
            label="Dieciseisavos" 
            matchCount={16} 
            step={1} 
            prefix="ko_32_" 
            data={koMatches} 
          />
          
          {/* Octavos */}
          <BracketColumn 
            label="Octavos" 
            matchCount={8} 
            step={2} 
            prefix="ko_16_" 
            data={koMatches} 
          />
          
          {/* Cuartos */}
          <BracketColumn 
            label="Cuartos" 
            matchCount={4} 
            step={3} 
            prefix="ko_8_" 
            data={koMatches} 
          />
          
          {/* Semifinales */}
          <BracketColumn 
            label="Semifinales" 
            matchCount={2} 
            step={4} 
            prefix="ko_4_" 
            data={koMatches} 
          />
          
          {/* Final */}
          <div className="flex flex-col items-center justify-center gap-8 min-w-[200px]">
             <div className="text-center">
                <div className="text-[10px] text-brand-gold font-black uppercase tracking-[0.4em] mb-8">Gran Final 2026</div>
                <BracketNode 
                  label="Final" 
                  match={koMatches['ko_final']} 
                  defaultTeams={["Ganador SF 1", "Ganador SF 2"]} 
                  isFinal 
                />
                <div className="mt-20">
                   <Trophy className="w-20 h-20 text-brand-gold mx-auto drop-shadow-[0_0_30px_rgba(209,178,0,0.5)] animate-bounce" />
                   <div className="mt-4 text-[12px] font-black uppercase tracking-[0.5em] text-white">El Trofeo</div>
                </div>
             </div>
          </div>

        </div>
      </div>
    </div>
  );
}

function BracketColumn({ label, matchCount, step, prefix, data }: { label: string, matchCount: number, step: number, prefix: string, data: any }) {
  const matches = Array.from({ length: matchCount });
  return (
    <div className="flex flex-col justify-around gap-8 min-w-[180px]">
      <div className="text-center mb-4">
        <div className="text-[10px] text-brand-zinc-500 font-black uppercase tracking-[0.2em]">{label}</div>
        <div className="w-8 h-0.5 bg-brand-gold/20 mx-auto mt-2" />
      </div>
      {matches.map((_, i) => {
        const mId = `${prefix}${i + 1}`;
        return (
          <div key={i}>
            <BracketNode 
              label={`${label} - P${i+1}`} 
              match={data[mId]}
              defaultTeams={[`TBD ${step-1}.${i*2+1}`, `TBD ${step-1}.${i*2+2}`]} 
            />
          </div>
        );
      })}
    </div>
  );
}

function BracketNode({ label, match, defaultTeams, className = "", isFinal = false }: { label: string, match?: any, defaultTeams: string[], className?: string, isFinal?: boolean }) {
  const teams = match ? [match.homeTeam, match.awayTeam] : defaultTeams;
  const isFinished = match?.status === 'finished';

  return (
    <div className={`p-4 dimension-card bg-black w-44 border-brand-gold/10 relative group transition-all hover:border-brand-gold/30 ${isFinal ? 'scale-110 border-brand-gold/30 shadow-[0_0_40px_rgba(209,178,0,0.1)]' : ''} ${className}`}>
      <div className="text-[7px] text-brand-zinc-500 font-black uppercase mb-3 text-center border-b border-white/5 pb-2 tracking-[0.1em] group-hover:text-brand-gold transition-colors">{label}</div>
      <div className="space-y-2">
        {teams.map((t, i) => (
          <div key={i} className="flex items-center justify-between gap-2">
            <span className={`text-[9px] font-bold truncate uppercase tracking-tighter transition-colors ${i === 0 && isFinished && match.homeScore > match.awayScore ? 'text-brand-gold' : i === 1 && isFinished && match.awayScore > match.homeScore ? 'text-brand-gold' : 'text-brand-zinc-400 group-hover:text-white'}`}>
              {t}
            </span>
            <div className="w-5 h-5 bg-brand-zinc-900 rounded border border-white/5 flex items-center justify-center text-[9px] font-mono font-bold text-brand-zinc-600 shrink-0">
              {isFinished ? (i === 0 ? match.homeScore : match.awayScore) : '?'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
