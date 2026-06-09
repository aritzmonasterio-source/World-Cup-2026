import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { Activity, AlertCircle, ArrowDown, ArrowUp, CheckCircle2, Loader2, Minus, RefreshCw, Trophy } from 'lucide-react';
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
  const [notice, setNotice] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

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
    setNotice(null);
    const { error } = await supabase.rpc('recalculate_points');
    const { count: finishedMatches } = await supabase
      .from('matches')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'finished');
    setNotice(error
      ? { type: 'error', text: `No se pudo recalcular: ${error.message}` }
      : finishedMatches
        ? { type: 'ok', text: `Ranking recalculado con ${finishedMatches} partido(s) finalizado(s).` }
        : { type: 'ok', text: 'Ranking recalculado. Todavía no hay partidos finalizados; es normal antes del primer partido del 11 de junio de 2026.' });
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

      {notice && (
        <div className={`rounded-2xl border p-4 text-sm flex items-start gap-3 ${
          notice.type === 'ok'
            ? 'border-emerald-400/25 bg-emerald-500/10 text-emerald-100'
            : 'border-red-400/25 bg-red-500/10 text-red-100'
        }`}>
          {notice.type === 'ok'
            ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
            : <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-300" />}
          <p>{notice.text}</p>
        </div>
      )}

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
            {rankings.map((row, index) => <RankingRow key={`${row.user_id}-${row.community_id}`} row={row} index={index} rows={rankings} />)}
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
            <p className="mt-4 text-xs text-brand-zinc-400 italic">{playerComment(row, index, rankings)}</p>
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

function RankingRow({ row, index, rows }: { row: RankingEntry; index: number; rows: RankingEntry[] }) {
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
          <div className="min-w-0">
            <span className="text-sm font-black uppercase tracking-tight text-white whitespace-nowrap">{player?.username || 'Usuario'}</span>
            <p className="mt-1 max-w-xs text-[11px] leading-snug text-brand-zinc-500 italic normal-case">{playerComment(row, index, rows)}</p>
          </div>
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

const PLAYER_COMMENT_BANK = {
  leader: [
    '{name} va primero y ya se nota ese brillo de quien empieza a insoportarse un poco.',
    '{name} lidera. De momento, mucho pecho y cero obligación de pedir perdón.',
    '{name} está arriba. Si esto acaba hoy, imprime la tabla y la enmarca sin vergüenza.',
    '{name} manda con sonrisa de "yo ya lo sabía". Sospechoso, pero efectivo.',
    '{name} tiene el volante. Falta saber si conduce o solo posa muy fuerte.',
    '{name} va líder y el grupo ya practica el noble arte de quitarle mérito.',
  ],
  podium: [
    '{name} pisa podio. No es gloria eterna, pero ya permite hablar un poco más alto.',
    '{name} está en zona noble, que suena elegante hasta que miras los nervios.',
    '{name} aguanta arriba. Estrategia fina o suerte bien peinada, el debate sigue abierto.',
    '{name} está cerca del premio. Conviene no celebrarlo como si ya hubiese ganado algo.',
    '{name} firma podio provisional. Bastante serio, aunque todavía huele a trampa emocional.',
    '{name} está donde se reparten miradas incómodas: arriba y molestando.',
  ],
  up: [
    '{name} sube puestos. El grupo empieza a fingir normalidad, que es lo contrario de la calma.',
    '{name} viene lanzado. Hoy ha mirado la tabla dos veces y ninguna con humildad.',
    '{name} mejora. No es remontada épica todavía, pero ya da para sacar conversación.',
    '{name} avanza sin hacer ruido. Precisamente por eso empieza a dar bastante rabia.',
    '{name} ha pegado subidón. Los de arriba ya revisan sus pronósticos con sudor fino.',
    '{name} escala. De pronto, todos sus fallos anteriores eran parte del plan. Claro.',
  ],
  down: [
    '{name} baja. No pasa nada, salvo la dignidad haciendo un pequeño trámite.',
    '{name} pierde altura. Hoy toca mirar al suelo y llamar aprendizaje a lo que ha sido dolor.',
    '{name} tropieza en la tabla. Se recomienda silencio táctico y cero audios triunfalistas.',
    '{name} cae un poco. Todavía compite, pero el ranking le ha dado una colleja elegante.',
    '{name} retrocede. Mala jornada para sacar teorías y peor para sacar capturas.',
    '{name} se deja puestos. El Excel no juzga, pero esta vez casi.',
  ],
  zero: [
    '{name} sigue a cero. Es una declaración artística, arriesgada y difícil de defender.',
    '{name} no ha estrenado marcador. La fe está intacta; los datos, bastante menos.',
    '{name} conserva cero puntos con una pureza estadística casi ofensiva.',
    '{name} está calentando. O eso dice la versión amable del informe.',
    '{name} todavía no suma. Remontada posible, autoestima obligatoria.',
    '{name} va de incógnita. De momento, muy incógnita.',
  ],
  chase: [
    '{name} sigue en la pelea. No asusta todavía, pero ya incomoda en la foto.',
    '{name} está a tiro. Un acierto bueno y aparece en la conversación de los mayores.',
    '{name} mantiene pulso. Ni festival ni desastre: zona de cuchillo entre dientes.',
    '{name} está vivo. Matemáticamente, emocionalmente y con bastante margen para presumir si acierta.',
    '{name} suma lo justo para no rendirse y lo suficiente para molestar.',
    '{name} tiene plan. Si es bueno o puro teatro, lo dirá la próxima jornada.',
  ],
  bottom: [
    '{name} mira la tabla desde abajo. Vista amplia, presión poca, remontada disponible.',
    '{name} necesita una jornada con fuegos artificiales. O varias decisiones menos discutibles.',
    '{name} está lejos, pero no hundido. Eso sí, el ranking no le está invitando a cenar.',
    '{name} va con retraso. Elegante no es, pero todavía tiene arreglo.',
    '{name} está en zona de "esto acaba de empezar", frase útil y bastante necesaria.',
    '{name} tiene margen de mejora. Muchísimo margen, por verlo en positivo.',
  ],
} as const;

function playerComment(row: RankingEntry, index: number, rows: RankingEntry[]) {
  const trend = getTrend(row);
  const name = shortName(row.profiles?.username || row.profiles?.email || 'Este jugador');
  const bucket = getCommentBucket(row, index, rows.length, trend);
  const options = PLAYER_COMMENT_BANK[bucket];
  const seed = getCommentSeed(row, index, rows.length);
  return `#${index + 1}. ${options[seed % options.length].replace('{name}', name)}`;
}

function getCommentBucket(row: RankingEntry, index: number, totalRows: number, trend: ReturnType<typeof getTrend>): keyof typeof PLAYER_COMMENT_BANK {
  if ((row.total_points || 0) === 0) return 'zero';
  if (index === 0) return 'leader';
  if (index <= 2) return 'podium';
  if (trend === 'up') return 'up';
  if (trend === 'down') return 'down';
  if (totalRows > 5 && index >= totalRows - 2) return 'bottom';
  return 'chase';
}

function getCommentSeed(row: RankingEntry, index: number, totalRows: number) {
  const updatedAt = row.updated_at ? new Date(row.updated_at).getTime() : 0;
  const updateBucket = Number.isFinite(updatedAt) ? Math.floor(updatedAt / (1000 * 60 * 60 * 6)) : 0;
  const rankMovement = (row.previous_rank || index + 1) - (row.current_rank || index + 1);
  return Math.abs(
    updateBucket +
    index * 11 +
    totalRows * 5 +
    (row.total_points || 0) * 31 +
    (row.points_groups || 0) * 17 +
    (row.points_knockout || 0) * 13 +
    (row.points_scorer || 0) * 7 +
    (row.points_qualified || 0) * 3 +
    rankMovement * 19
  );
}

function shortName(value: string) {
  const clean = value.split('@')[0].replace(/[._-]+/g, ' ').trim();
  return clean.split(/\s+/).filter(Boolean).slice(0, 2).join(' ') || 'Este jugador';
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
