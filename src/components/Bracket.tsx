import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Loader2, Trophy, Tv } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { isSupabaseConfigured } from '../lib/supabase';
import type { Match } from '../lib/types';
import { displayTeam, getFlagUrl } from '../lib/flags';
import ConfigRequired from './ConfigRequired';

const ROUND_LABELS: Record<number, string> = {
  4: 'Dieciseisavos',
  5: 'Octavos',
  6: 'Cuartos',
  7: 'Semifinales',
  8: 'Finales',
};

export default function Bracket() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    supabase.from('matches').select('*').gte('round_number', 4).order('round_number').order('kickoff_at').then(({ data }) => {
      setMatches((data || []) as Match[]);
      setLoading(false);
    });
  }, []);

  const byRound = useMemo(() => {
    const grouped: Record<number, Match[]> = {};
    matches.forEach((match) => {
      const round = match.round_number || 0;
      if (!grouped[round]) grouped[round] = [];
      grouped[round].push(match);
    });
    return grouped;
  }, [matches]);

  if (loading) return <div className="flex justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-brand-gold" /></div>;
  if (!isSupabaseConfigured) return <ConfigRequired title="Cuadro pendiente de Supabase" />;

  return (
    <div className="space-y-12">
      <div className="flex items-center gap-3">
        <div className="w-1.5 h-6 bg-brand-gold rounded-full" />
        <h2 className="text-2xl font-black uppercase tracking-tighter italic">Cuadro <span className="text-brand-gold">Mundial</span></h2>
      </div>

      {matches.length === 0 ? (
        <div className="dimension-card-accent p-12 text-center text-brand-zinc-400">Sin eliminatorias cargadas. Lanza la sincronización FIFA desde Admin.</div>
      ) : (
        <div className="dimension-card-accent p-3 sm:p-8 min-h-[600px] overflow-hidden sm:overflow-x-auto no-scrollbar">
          <div className="grid grid-cols-1 gap-5 py-4 sm:flex sm:flex-nowrap sm:gap-8 sm:min-w-[980px] sm:py-8">
            {Object.entries(byRound).map(([round, roundMatches]) => (
              <BracketColumn key={round} label={ROUND_LABELS[Number(round)] || `Ronda ${round}`} matches={roundMatches} />
            ))}
            <div className="flex flex-col items-center justify-center gap-4 sm:gap-8 sm:min-w-[180px] rounded-2xl border border-brand-gold/10 bg-black/20 p-6 sm:border-0 sm:bg-transparent sm:p-0">
              <Trophy className="w-14 h-14 sm:w-20 sm:h-20 text-brand-gold mx-auto drop-shadow-[0_0_30px_rgba(209,178,0,0.5)]" />
              <div className="text-[12px] font-black uppercase tracking-[0.5em] text-white">Trofeo</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BracketColumn({ label, matches }: { label: string; matches: Match[] }) {
  return (
    <div className="flex flex-col gap-3 sm:gap-4 min-w-0 sm:min-w-[190px]">
      <div className="sticky top-0 z-10 text-center mb-2 rounded-xl border border-white/10 bg-black/40 backdrop-blur px-3 py-3">
        <div className="text-[10px] text-brand-zinc-500 font-black uppercase tracking-[0.2em]">{label}</div>
        <div className="w-8 h-0.5 bg-brand-gold/20 mx-auto mt-2" />
      </div>
      {matches.map((match) => <BracketNode key={match.id} match={match} />)}
    </div>
  );
}

function BracketNode({ match }: { match: Match }) {
  const isFinished = match.status === 'finished';

  return (
    <div className="p-4 dimension-card bg-black w-full sm:w-44 border-brand-gold/10 relative group transition-all hover:border-brand-gold/30">
      <div className="text-[7px] text-brand-zinc-500 font-black uppercase mb-3 border-b border-white/5 pb-2 tracking-[0.1em] group-hover:text-brand-gold transition-colors">
        <div>Partido {match.match_number || '?'}</div>
        <div className="flex items-center gap-1 mt-1">
          <CalendarDays className="w-3 h-3" />
          {new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' }).format(new Date(match.kickoff_at))}
        </div>
      </div>
      <div className="space-y-2">
        <TeamRow name={match.home_team_name} code={match.home_team_code} score={match.home_score} winner={isFinished && (match.home_score ?? -1) > (match.away_score ?? -1)} />
        <TeamRow name={match.away_team_name} code={match.away_team_code} score={match.away_score} winner={isFinished && (match.away_score ?? -1) > (match.home_score ?? -1)} />
      </div>
      <div className="mt-3 flex items-center gap-1 text-[7px] font-black uppercase tracking-wider text-brand-gold/80">
        <Tv className="w-3 h-3" />
        <span className="truncate">{match.tv_channel_es || 'DAZN / Canal Mediapro'}</span>
      </div>
    </div>
  );
}

function TeamRow({ name, code, score, winner }: { name: string; code: string | null; score: number | null; winner: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2">
        <div className="h-4 w-6 shrink-0 overflow-hidden rounded-[2px] border border-white/10 bg-white/5">
          <img src={getFlagUrl(name, code)} alt="" className="h-full w-full object-cover scale-125" />
        </div>
        <span className={`truncate text-[9px] font-bold uppercase tracking-tighter transition-colors ${winner ? 'text-brand-gold' : 'text-brand-zinc-400 group-hover:text-white'}`}>
          {displayTeam(name, code)}
        </span>
      </div>
      <div className="w-5 h-5 bg-brand-zinc-900 rounded border border-white/5 flex items-center justify-center text-[9px] font-mono font-bold text-brand-zinc-400 shrink-0">
        {score ?? '?'}
      </div>
    </div>
  );
}
