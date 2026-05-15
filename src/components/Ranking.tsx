import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { Activity, ArrowDown, ArrowUp, Loader2, Minus, RefreshCw, Trophy } from 'lucide-react';
import { isAdmin, supabase } from '../lib/supabase';
import { isSupabaseConfigured } from '../lib/supabase';
import type { CommunityMembership, Profile } from '../lib/types';
import type { CommunityId } from '../lib/communities';
import ConfigRequired from './ConfigRequired';

type RankingEntry = CommunityMembership & { profiles?: Profile };

export default function Ranking({ user, profile, communityId }: { user: User | null; profile: Profile | null; communityId: CommunityId }) {
  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    fetchRankings();
  }, [communityId]);

  async function fetchRankings() {
    const { data } = await supabase
      .from('community_memberships')
      .select('*, profiles(*)')
      .eq('community_id', communityId)
      .eq('status', 'approved')
      .order('total_points', { ascending: false })
      .order('updated_at', { ascending: true });
    setRankings((data || []) as RankingEntry[]);
    setLoading(false);
  }

  async function recalculate() {
    setRecalculating(true);
    const { error } = await supabase.rpc('recalculate_points');
    if (error) alert(error.message);
    await fetchRankings();
    setRecalculating(false);
  }

  if (loading) return <div className="flex justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-brand-gold" /></div>;
  if (!isSupabaseConfigured) return <ConfigRequired title="Ranking pendiente de Supabase" />;

  const admin = isAdmin(profile, user?.email);

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <h1 className="text-3xl font-black uppercase tracking-tighter italic">Ranking <span className="text-brand-gold">Mundial</span></h1>
        <div className="flex items-center gap-4">
          {admin && (
            <button onClick={recalculate} disabled={recalculating} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all flex items-center gap-2 disabled:opacity-50">
              {recalculating ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} Recalcular
            </button>
          )}
          <div className="flex items-center gap-4 text-brand-gold">
            <Trophy className="w-6 h-6" />
            <span className="text-[10px] font-black uppercase tracking-widest text-brand-zinc-500">Temporada 2026 • Live</span>
          </div>
        </div>
      </div>

      <div className="dimension-card-accent p-5">
        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-brand-gold mb-2">Comentario de clasificación</p>
        <p className="text-sm text-brand-zinc-300 leading-relaxed">{rankingComment(rankings)}</p>
      </div>

      <div className="hidden lg:block overflow-x-auto dimension-card p-0 border-white/5">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-brand-gold text-brand-black">
              <th className="p-5 text-center text-xs font-black uppercase tracking-widest border-r border-brand-black/10">Pos</th>
              <th className="p-5 text-left text-xs font-black uppercase tracking-widest border-r border-brand-black/10">Jugador</th>
              <th className="p-5 text-center text-xs font-black uppercase tracking-widest border-r border-brand-black/10">Total</th>
              <th className="p-5 text-center text-xs font-black uppercase tracking-widest border-r border-brand-black/10">Partidos Grupo</th>
              <th className="p-5 text-center text-xs font-black uppercase tracking-widest border-r border-brand-black/10">Eliminatorias</th>
              <th className="p-5 text-center text-xs font-black uppercase tracking-widest border-r border-brand-black/10">Clasificados</th>
              <th className="p-5 text-center text-xs font-black uppercase tracking-widest">Goleador</th>
            </tr>
          </thead>
          <tbody>
            {rankings.map((row, index) => <RankingRow key={`${row.user_id}-${row.community_id}`} row={row} index={index} />)}
          </tbody>
        </table>
      </div>

      <div className="lg:hidden space-y-4 px-2">
        {rankings.map((row, index) => (
          <div key={`${row.user_id}-${row.community_id}`} className="dimension-card-accent p-4 relative overflow-hidden group">
            <div className="flex items-center gap-4 mb-4 border-b border-white/5 pb-4">
              <div className={`w-12 h-12 flex items-center justify-center text-xl font-black italic rounded-xl ${index < 3 ? 'bg-brand-gold text-black' : 'bg-white/5 text-brand-zinc-500'}`}>
                {index + 1}
              </div>
              <div>
                <h3 className="text-sm font-black uppercase text-white">{row.profiles?.username || 'Usuario'}</h3>
                <p className="text-[10px] font-bold text-brand-zinc-500 uppercase tracking-widest">{row.profiles?.email}</p>
              </div>
              <div className="ml-auto text-right">
                <p className="text-[9px] font-black text-brand-gold uppercase tracking-widest mb-1">Total</p>
                <p className="text-2xl font-black text-brand-gold italic leading-none">{row.total_points}</p>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-1 text-center">
              <Score label="Grupos" value={row.points_groups} />
              <Score label="Elim." value={row.points_knockout} />
              <Score label="Clasif." value={row.points_qualified} />
              <Score label="Goles" value={row.points_scorer} />
            </div>
            <p className="mt-4 text-xs text-brand-zinc-400 italic">{playerComment(row, index)}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <StatCard icon={Trophy} label="Jugadores aprobados" value={String(rankings.length)} />
        <StatCard icon={Activity} label="Estado Sync" value="Live" />
        <StatCard icon={RefreshCw} label="Recalculo" value="Manual/Admin" />
      </div>
    </div>
  );
}

function RankingRow({ row, index }: { row: RankingEntry; index: number }) {
  const rankChange = getTrend(row);
  const player = row.profiles;
  return (
    <tr className={`${index % 2 === 0 ? 'bg-white/[0.03]' : 'bg-black/20'} border-b border-white/5 transition-colors`}>
      <td className="p-5 text-center">
        <div className="flex items-center justify-center gap-3">
          <span className={`text-lg font-black italic ${index < 3 ? 'text-brand-gold' : 'text-brand-zinc-400'}`}>{index + 1}</span>
          {rankChange === 'up' && <ArrowUp className="w-3 h-3 text-green-500" />}
          {rankChange === 'down' && <ArrowDown className="w-3 h-3 text-red-500" />}
          {rankChange === 'none' && <Minus className="w-3 h-3 text-brand-zinc-600" />}
        </div>
      </td>
      <td className="p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-brand-gold/10 border border-brand-gold/20 flex items-center justify-center text-brand-gold font-black text-xs shrink-0 uppercase">{player?.username?.[0] || 'U'}</div>
          <span className="text-sm font-black uppercase tracking-tight text-white whitespace-nowrap">{player?.username || 'Usuario'}</span>
        </div>
      </td>
      <td className="p-5 text-center bg-brand-gold/5"><span className="text-xl font-black text-brand-gold italic">{row.total_points}</span></td>
      <td className="p-5 text-center"><span className="text-sm font-bold text-brand-zinc-400 tabular-nums">{row.points_groups}</span></td>
      <td className="p-5 text-center"><span className="text-sm font-bold text-brand-zinc-400 tabular-nums">{row.points_knockout}</span></td>
      <td className="p-5 text-center"><span className="text-sm font-bold text-brand-zinc-400 tabular-nums">{row.points_qualified}</span></td>
      <td className="p-5 text-center"><span className="text-sm font-bold text-brand-zinc-400 tabular-nums">{row.points_scorer}</span></td>
    </tr>
  );
}

function getTrend(row: RankingEntry) {
  if (!row.previous_rank || !row.current_rank) return 'none';
  if (row.current_rank < row.previous_rank) return 'up';
  if (row.current_rank > row.previous_rank) return 'down';
  return 'none';
}

function rankingComment(rows: RankingEntry[]) {
  if (rows.length === 0) return 'Todavía no hay nadie aprobado. Silencio táctico en la sala.';
  const leader = rows[0];
  const name = leader.profiles?.username || 'El líder';
  if (leader.total_points === 0) return `${name} manda con cero puntos. Técnicamente es liderato; emocionalmente, pretemporada.`;
  if (rows.length === 1) return `${name} va primero y último a la vez. Dominio absoluto, con un matiz estadístico importante.`;
  const gap = leader.total_points - rows[1].total_points;
  if (gap >= 40) return `${name} ha abierto hueco. El resto ya mira el Excel con respeto y algo de sudor.`;
  if (gap <= 5) return `Clasificación apretada: aquí un gol tonto cambia amistades, cenas y algún grupo de WhatsApp.`;
  return `${name} lidera con ${leader.total_points} puntos, pero esto todavía tiene más curvas que una tanda de penaltis.`;
}

function playerComment(row: RankingEntry, index: number) {
  if (index === 0) return row.total_points ? 'Ahora mismo mira al resto desde el balcón.' : 'Líder provisional por orden cósmico.';
  if (index === 1) return 'Está a una buena jornada de sacar pecho.';
  if (index === 2) return 'Podio, que ya suena bastante serio.';
  if (getTrend(row) === 'up') return 'Viene subiendo. Cuidado con esa inercia.';
  if (getTrend(row) === 'down') return 'Pequeño bache, todavía sin necesidad de rueda de prensa.';
  if (row.total_points === 0) return 'Plan en construcción. La remontada empieza con dignidad.';
  return 'Sigue vivo. Matemáticamente y con actitud.';
}

function Score({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-[7px] font-black text-brand-zinc-500 uppercase mb-1">{label}</p>
      <p className="text-[10px] font-bold text-white">{value || 0}</p>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: typeof Trophy; label: string; value: string }) {
  return (
    <div className="dimension-card-accent p-6 flex items-center gap-6">
      <div className="w-12 h-12 rounded-2xl bg-brand-gold/10 flex items-center justify-center">
        <Icon className="w-6 h-6 text-brand-gold" />
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-brand-zinc-500 mb-1">{label}</p>
        <p className="text-xl font-black text-white italic">{value}</p>
      </div>
    </div>
  );
}
