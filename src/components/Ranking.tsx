import { useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { Activity, AlertCircle, ArrowDown, ArrowUp, CheckCircle2, ChevronDown, ListChecks, Loader2, Minus, RefreshCw, Trophy } from 'lucide-react';
import { canPlay, isAdmin, supabase } from '../lib/supabase';
import { isSupabaseConfigured } from '../lib/supabase';
import type { CommunityMembership, PointEvent, Profile } from '../lib/types';
import type { CommunityId } from '../lib/communities';
import ConfigRequired from './ConfigRequired';

type RankingEntry = Omit<CommunityMembership, 'profiles'> & { profiles?: Profile | Profile[] | null };

export default function Ranking({ user, profile, communityId }: { user: User | null; profile: Profile | null; communityId: CommunityId }) {
  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [pointEvents, setPointEvents] = useState<PointEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [notice, setNotice] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const admin = isAdmin(profile, user?.email);
  const canViewCommunityRanking = Boolean(admin || (user && canPlay(profile, user.email) && profile?.community_id === communityId));

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    if (!canViewCommunityRanking) {
      setRankings([]);
      setPointEvents([]);
      setLoading(false);
      return;
    }
    fetchRankings();
  }, [canViewCommunityRanking, communityId]);

  async function fetchRankings() {
    const [{ data }, { data: pointRows }] = await Promise.all([
      supabase
        .from('community_memberships')
        .select('*, profiles(*)')
        .eq('community_id', communityId)
        .eq('status', 'approved')
        .order('total_points', { ascending: false })
        .order('updated_at', { ascending: true }),
      supabase
        .from('point_events')
        .select('*')
        .eq('community_id', communityId)
        .order('points', { ascending: false })
        .order('created_at', { ascending: false }),
    ]);
    setRankings((data || []) as RankingEntry[]);
    setPointEvents((pointRows || []) as PointEvent[]);
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

  const playerComments = useMemo(() => buildPlayerComments(rankings), [rankings]);
  const pointEventsByUser = useMemo(() => groupPointEventsByUser(pointEvents), [pointEvents]);

  if (loading) return <div className="flex justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-brand-gold" /></div>;
  if (!isSupabaseConfigured) return <ConfigRequired title="Ranking pendiente de Supabase" />;
  if (!canViewCommunityRanking) {
    return (
      <div className="dimension-card-accent p-8 text-center max-w-2xl mx-auto">
        <AlertCircle className="mx-auto mb-4 h-9 w-9 text-brand-gold" />
        <h1 className="text-2xl font-black uppercase tracking-tighter italic">Ranking privado</h1>
        <p className="mt-3 text-sm text-brand-zinc-400 leading-relaxed">
          Solo los jugadores aprobados de esta comunidad pueden ver su clasificación. Cambia a tu comunidad asignada o espera aprobación del admin.
        </p>
      </div>
    );
  }

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
            {rankings.map((row, index) => (
              <RankingRow
                key={`${row.user_id}-${row.community_id}`}
                row={row}
                index={index}
                comment={playerComments[getRankingKey(row)]}
                events={pointEventsByUser[row.user_id] || []}
              />
            ))}
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
                <h3 className="text-sm font-black uppercase text-white">{getPlayerName(row)}</h3>
                <p className="text-[10px] font-bold text-brand-zinc-500 uppercase tracking-widest">{getPlayerEmail(row)}</p>
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
            <p className="mt-4 text-xs text-brand-zinc-400 italic">{playerComments[getRankingKey(row)] || fallbackPlayerComment(row, index)}</p>
            <PointBreakdown events={pointEventsByUser[row.user_id] || []} />
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

function RankingRow({ row, index, comment, events }: { row: RankingEntry; index: number; comment: string; events: PointEvent[] }) {
  const rankChange = getTrend(row);
  const playerName = getPlayerName(row);
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
          <div className="w-10 h-10 rounded-full bg-brand-gold/10 border border-brand-gold/20 flex items-center justify-center text-brand-gold font-black text-xs shrink-0 uppercase">{getPlayerInitial(row)}</div>
          <div className="min-w-0">
            <span className="text-sm font-black uppercase tracking-tight text-white whitespace-nowrap">{playerName}</span>
            <p className="mt-1 max-w-xs text-[11px] leading-snug text-brand-zinc-500 italic normal-case">{comment || fallbackPlayerComment(row, index)}</p>
            <PointBreakdown events={events} />
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

function PointBreakdown({ events }: { events: PointEvent[] }) {
  const sortedEvents = sortPointEvents(events);
  const totals = getPointEventTotals(sortedEvents);
  const visibleEvents = sortedEvents.slice(0, 12);
  const hiddenCount = Math.max(sortedEvents.length - visibleEvents.length, 0);
  const totalPoints = sortedEvents.reduce((sum, event) => sum + toScore(event.points), 0);

  return (
    <details className="group mt-3 rounded-xl border border-white/10 bg-black/20 open:bg-black/30">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-brand-gold">
        <span className="flex items-center gap-2">
          <ListChecks className="h-3.5 w-3.5" />
          Expandir puntuación
        </span>
        <span className="flex items-center gap-2 text-brand-zinc-500">
          {totalPoints} pts
          <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
        </span>
      </summary>
      <div className="border-t border-white/10 p-3">
        {sortedEvents.length === 0 ? (
          <p className="text-[11px] leading-relaxed text-brand-zinc-500">
            Todavía no hay eventos de puntuación para este jugador. Cuando se cierre un resultado real, aquí saldrá el detalle.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-2">
              {totals.map((item) => (
                <div key={item.key} className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-2">
                  <p className="text-[8px] font-black uppercase tracking-widest text-brand-zinc-500">{item.label}</p>
                  <p className="mt-1 text-sm font-black text-brand-gold tabular-nums">{item.points}</p>
                </div>
              ))}
            </div>
            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {visibleEvents.map((event) => (
                <div key={`${event.id}-${event.ref_id}`} className="grid grid-cols-[58px_1fr] gap-3 rounded-lg border border-white/5 bg-white/[0.03] p-2">
                  <span className="rounded-md border border-emerald-400/25 bg-emerald-500/10 px-2 py-1 text-center text-[10px] font-black text-emerald-200 tabular-nums">
                    +{event.points}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[9px] font-black uppercase tracking-widest text-brand-zinc-500">{getPointCategoryLabel(event.category)}</p>
                    <p className="mt-0.5 text-[11px] leading-snug text-brand-zinc-300">{event.label || getFallbackPointLabel(event)}</p>
                  </div>
                </div>
              ))}
            </div>
            {hiddenCount > 0 && (
              <p className="text-[10px] font-bold uppercase tracking-widest text-brand-zinc-500">
                Y {hiddenCount} evento(s) más.
              </p>
            )}
          </div>
        )}
      </div>
    </details>
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
  const ctx = createCommentContext(rows[0], 0, rows);
  const seed = getCommentSeed(ctx);
  const second = rows[1];
  const allZero = rows.every((row) => toScore(row.total_points) === 0);

  if (rows.length === 1) {
    return fillComment(pick(HEADLINE_SOLO_LINES, seed), ctx);
  }

  if (allZero) {
    return fillComment(pick(HEADLINE_ZERO_LINES, seed), ctx);
  }

  const gap = second ? toScore(rows[0].total_points) - toScore(second.total_points) : 0;
  if (gap <= 0) return fillComment(pick(HEADLINE_TIED_LINES, seed), ctx);
  if (gap <= 5) return fillComment(pick(HEADLINE_TIGHT_LINES, seed), ctx);
  if (gap >= 40) return fillComment(pick(HEADLINE_BREAKAWAY_LINES, seed), ctx);
  return fillComment(pick(HEADLINE_OPEN_LINES, seed), ctx);
}

type CommentBucket = 'leader' | 'podium' | 'up' | 'down' | 'zero' | 'chase' | 'bottom' | 'tie' | 'last' | 'solo';
type ScoreCategory = 'groups' | 'knockout' | 'qualified' | 'scorer' | 'none';
type CategoryScore = { key: ScoreCategory; label: string; points: number };

interface CommentContext {
  row: RankingEntry;
  index: number;
  rows: RankingEntry[];
  bucket: CommentBucket;
  position: number;
  totalRows: number;
  name: string;
  leaderName: string;
  aboveName: string;
  belowName: string;
  points: number;
  leaderPoints: number;
  abovePoints: number;
  belowPoints: number;
  leaderGap: number;
  aboveGap: number;
  belowGap: number;
  movement: number;
  trendLabel: string;
  topCategory: ScoreCategory;
  topCategoryLabel: string;
  topCategoryPoints: number;
  secondCategoryLabel: string;
  secondCategoryPoints: number;
  tiedAbove: boolean;
  tiedBelow: boolean;
}

const HEADLINE_SOLO_LINES = [
  '{name} lidera y cierra la tabla a la vez. Es una dictadura estadística con poca oposición.',
  '{name} va primero, segundo y último. Mucho dominio, poca presión y cero testigos incómodos.',
  '{name} juega solo en el ranking. De momento gana, aunque el rival sea su propio ego.',
] as const;

const HEADLINE_ZERO_LINES = [
  'Todos siguen a cero. La clasificación está tan virgen que hasta presume de inocente.',
  'Empate general sin puntos. Mucha estrategia secreta y, por ahora, cero pruebas.',
  'La tabla está congelada: nadie suma, nadie cae y todos pueden vender humo con dignidad.',
  'Arranque en modo espera. El primero manda por orden de lista, no por golpes sobre la mesa.',
] as const;

const HEADLINE_TIED_LINES = [
  '{name} aparece arriba, pero {belowName} le respira en la nuca. Liderato sí; trono cómodo, todavía no.',
  'Hay empate arriba y {name} figura primero por detalle fino. Aquí presumir mucho sería tentar al destino.',
  '{name} manda en una cabeza de carrera apretada. La tabla está para captura, pero con letra pequeña.',
] as const;

const HEADLINE_TIGHT_LINES = [
  '{name} lidera con {points} puntos y solo {belowGap} de colchón. Está bonito, peligroso y un poco venenoso.',
  'Clasificación apretada: {name} va delante, pero {belowName} está suficientemente cerca para arruinarle la sobremesa.',
  '{name} tiene el mando, aunque con {belowGap} puntos de ventaja esto parece más préstamo que propiedad.',
] as const;

const HEADLINE_BREAKAWAY_LINES = [
  '{name} ha abierto {belowGap} puntos. El resto aún compite, pero ya mira la tabla con cara de trámite administrativo.',
  '{name} se ha escapado. No es sentencia, pero el grupo empieza a necesitar calculadora y algo de orgullo.',
  '{name} manda con margen serio. Por detrás hay Mundial, sí, pero también bastante tarea pendiente.',
] as const;

const HEADLINE_OPEN_LINES = [
  '{name} lidera con {points} puntos. No hay coronación, pero ya se permite mirar el ranking con música de entrada.',
  '{name} va primero y {belowName} persigue. La cosa no arde todavía, pero ya huele a pique decente.',
  '{name} está arriba con {points}. El resto tiene margen, excusas y una oportunidad para callarle pronto.',
] as const;

const OPENING_LINES: Record<CommentBucket, readonly string[]> = {
  leader: [
    '{name} va líder y ya camina como si la tabla fuese escritura pública.',
    '{name} manda. No sabemos si por ciencia, instinto o suerte con traje, pero manda.',
    '{name} está arriba y el grupo empieza a practicar eso de quitar mérito con elegancia dudosa.',
    '{name} lleva el volante. Falta saber si conduce o solo posa con las llaves.',
    '{name} se ha puesto primero. Buen momento para presumir poco y sonreír mucho.',
    '{name} tiene la cima. El peligro ahora es creérselo demasiado pronto.',
    '{name} lidera con pinta de haber ensayado la celebración delante del espejo.',
    '{name} va delante. La tabla no opina, pero hoy le está dando la razón.',
  ],
  podium: [
    '{name} pisa podio y ya tiene licencia provisional para hablar un poco más alto.',
    '{name} está en zona noble. Bien colocado, aunque todavía no para pedir una estatua.',
    '{name} aguanta arriba con cara de tipo serio y pronóstico discutiblemente inspirado.',
    '{name} huele premio. De momento huele, tocarlo ya es otro negocio.',
    '{name} está en la foto buena. Falta que no salga movido en la próxima jornada.',
    '{name} se mantiene cerca del botín. Cuidado con la sonrisa, que esto castiga rápido.',
    '{name} está en ese punto exacto entre ilusión razonable y venirse demasiado arriba.',
    '{name} tiene plaza VIP temporal. Temporal, que nadie imprima nada todavía.',
  ],
  up: [
    '{name} sube y el grupo intenta fingir normalidad. No cuela demasiado.',
    '{name} viene hacia arriba con el descaro justo para empezar a molestar.',
    '{name} mejora puestos. Ya puede sacar pecho, pero sin romper la camiseta.',
    '{name} escala en silencio. Mala noticia: los silenciosos suelen dar rabia cuando aciertan.',
    '{name} pega subidón. Los de arriba ya revisan sus cuentas con menos chulería.',
    '{name} avanza. De pronto todo lo anterior era parte del plan, claro.',
    '{name} se mueve en dirección correcta. Pequeño golpe de autoridad, grande en autoestima.',
    '{name} ha olido sangre en la tabla y viene con ganas de conversación incómoda.',
  ],
  down: [
    '{name} baja. No es catástrofe, pero la dignidad acaba de pedir hielo.',
    '{name} pierde altura. Momento perfecto para hablar de proyecto a largo plazo.',
    '{name} tropieza en la tabla. Se recomienda silencio táctico y pocas capturas.',
    '{name} cae un poco. Todavía compite, aunque el ranking le ha puesto firme.',
    '{name} retrocede. Hoy conviene mirar los puntos con luz baja.',
    '{name} se deja puestos. El Excel no juzga, pero casi se le nota.',
    '{name} baja con cara de “no pasa nada”. Pasa poco, pero pasa.',
    '{name} acusa el golpe. Nada irreversible, salvo alguna frase que le van a recordar.',
  ],
  zero: [
    '{name} sigue a cero. Es una propuesta valiente, difícil de vender y muy limpia.',
    '{name} no ha estrenado marcador. Fe intacta; datos todavía en huelga.',
    '{name} conserva el cero con una pureza estadística casi ofensiva.',
    '{name} está calentando. O eso dice la versión amable del informe.',
    '{name} todavía no suma. Remontada posible, autoestima obligatoria.',
    '{name} va de incógnita. De momento, muy incógnita.',
    '{name} mantiene el casillero impoluto. Competitivo no sé, minimalista desde luego.',
    '{name} está en modo “cuando arranque, veréis”. El ranking, de momento, espera sentado.',
  ],
  chase: [
    '{name} sigue en la pelea. No asusta todavía, pero ya incomoda en la foto.',
    '{name} está a tiro. Un acierto bueno y aparece en la conversación de los mayores.',
    '{name} mantiene pulso: ni festival, ni desastre, ni excusa perfecta.',
    '{name} sigue vivo. Matemáticamente, emocionalmente y con margen para dar guerra.',
    '{name} suma lo justo para no rendirse y lo suficiente para molestar.',
    '{name} tiene plan. Si es bueno o puro teatro, lo dirá la próxima jornada.',
    '{name} está en zona bisagra: un golpe bueno y cambia el tono del grupo.',
    '{name} no lidera, pero tampoco decora. Está ahí, que ya fastidia bastante.',
  ],
  bottom: [
    '{name} mira la tabla desde abajo. Vista amplia, presión poca, remontada disponible.',
    '{name} necesita una jornada con fuegos artificiales o varias decisiones menos discutibles.',
    '{name} está lejos, no hundido. Eso sí, el ranking no le está invitando a cenar.',
    '{name} va con retraso. Elegante no es, pero todavía tiene arreglo.',
    '{name} está en zona de “esto acaba de empezar”, frase útil y bastante necesaria.',
    '{name} tiene margen de mejora. Muchísimo margen, por verlo en positivo.',
    '{name} está abajo, que también es una forma de tener todo el campo por delante.',
    '{name} necesita remontada. La épica está disponible; la evidencia, pendiente.',
  ],
  tie: [
    '{name} está empatado y vive en el barro bueno: nadie manda del todo, nadie respira tranquilo.',
    '{name} comparte puntuación. Esto no es liderato, es una discusión con decimales emocionales.',
    '{name} está pegado a sus vecinos. Cualquier acierto aquí vale doble en autoestima.',
    '{name} forma parte del atasco. Mala zona para presumir, gran zona para picarse.',
    '{name} no se despega. Ni por arriba ni por abajo: modo sándwich competitivo.',
    '{name} está en empate técnico. Traducción: una jornada puede cambiarle el personaje.',
  ],
  last: [
    '{name} cierra la tabla. Duro, sí; irreversible, ni de lejos.',
    '{name} va último. La buena noticia: ya no puede caer más. La mala: hay que subir.',
    '{name} ocupa el sótano provisional. Buen sitio para preparar una remontada con mala leche.',
    '{name} está cerrando filas desde abajo. El guion de héroe empieza feo, como debe ser.',
    '{name} mira a todos desde atrás. Perspectiva tiene; puntos le faltan algunos.',
    '{name} necesita reacción. No una reunión, no una reflexión: puntos.',
  ],
  solo: [
    '{name} juega solo en la tabla. Victoria garantizada, presión testimonial.',
    '{name} es líder y colista a la vez. Poca competencia, mucho margen para hablar.',
    '{name} domina su liga privada. El peligro es aburrirse antes de que llegue el pique.',
  ],
};

const CATEGORY_LINES: Record<ScoreCategory, readonly string[]> = {
  groups: [
    'Su gasolina viene de {topCategoryLabel}: {topCategoryPoints} puntos de oficio y algo menos de humo.',
    'Está sacando petróleo en {topCategoryLabel}; ahí tiene {topCategoryPoints} puntos y bastante argumento.',
    'El bloque fuerte es {topCategoryLabel}: {topCategoryPoints} puntos para justificar la sonrisa.',
    'Donde más rasca es en {topCategoryLabel}. No es poesía, pero suma.',
    '{topCategoryLabel} le está sujetando la candidatura con {topCategoryPoints} puntos.',
  ],
  knockout: [
    'Las eliminatorias le están dando vida: {topCategoryPoints} puntos y un punto de peligro.',
    'Su mejor zona es {topCategoryLabel}; cuando el cuadro aprieta, este tipo no se esconde.',
    'Tiene {topCategoryPoints} puntos en {topCategoryLabel}. Ahí hay lectura o una flor bastante descarada.',
    '{topCategoryLabel} le ha puesto serio: {topCategoryPoints} puntos y menos bromas.',
    'El cuadro le está pagando bien. {topCategoryPoints} puntos que pesan.',
  ],
  qualified: [
    'Los clasificados le están salvando el traje: {topCategoryPoints} puntos y bastante olfato.',
    'Su fuerte está en {topCategoryLabel}. De momento lee grupos mejor que algunos leen WhatsApp.',
    'Tiene {topCategoryPoints} puntos por {topCategoryLabel}; no luce tanto, pero duele igual.',
    '{topCategoryLabel} le sostiene. Trabajo sucio, puntos limpios.',
    'Está pillando posiciones con {topCategoryLabel}. Poco ruido, bastante daño.',
  ],
  scorer: [
    'El goleador le está dando comida: {topCategoryPoints} puntos y permiso para mirar highlights.',
    'Su apuesta de goleador pesa: {topCategoryPoints} puntos y una sonrisa bastante sospechosa.',
    '{topCategoryLabel} es su mina ahora mismo. Cada gol suyo se nota en la mesa.',
    'Está viviendo del gol ajeno con dignidad dudosa y {topCategoryPoints} puntos.',
    'El olfato de goleador le está pagando cafés. {topCategoryPoints} puntos de golpe fino.',
  ],
  none: [
    'Aún no tiene una fuente clara de puntos. De momento todo es promesa, relato y paciencia.',
    'No hay categoría dominante: el marcador sigue esperando una razón para moverse.',
    'Sus puntos todavía no tienen biografía. Cuando lleguen, ya veremos si eran plan o accidente.',
    'Sin zona fuerte por ahora. Mucha pizarra mental, poco impacto en la tabla.',
    'Todavía busca su primera grieta en el ranking. El discurso está; faltan puntos.',
  ],
};

const CLOSING_LINES = [
  'La próxima jornada puede darle gloria o material para excusas.',
  'Aquí un gol suelto cambia biografías y estados de WhatsApp.',
  'Captura permitida; soberbia bajo responsabilidad propia.',
  'La tabla habla bajito, pero hoy ha dejado recado.',
  'Queda Mundial y queda teatro, que es lo importante.',
  'Si acierta el siguiente, el chat va a ponerse insoportable.',
  'De momento, prudencia. Y si no hay prudencia, al menos que haya capturas.',
  'Esto no sentencia nada, pero ya reparte miradas.',
  'Buen momento para callar o para provocar; ambas opciones tienen riesgo.',
  'El ranking no perdona, pero entretiene bastante.',
  'Todo muy provisional, que es la forma elegante de decir “no te vengas arriba”.',
  'La jornada siguiente trae examen y seguramente alguna frase que guardar.',
] as const;

function buildPlayerComments(rows: RankingEntry[]) {
  const usedComments = new Set<string>();
  return rows.reduce<Record<string, string>>((comments, row, index) => {
    const key = getRankingKey(row);
    try {
      comments[key] = createUniquePlayerComment(row, index, rows, usedComments);
    } catch (error) {
      console.warn('No se pudo generar el comentario del ranking', error);
      comments[key] = fallbackPlayerComment(row, index);
    }
    return comments;
  }, {});
}

function createUniquePlayerComment(row: RankingEntry, index: number, rows: RankingEntry[], usedComments: Set<string>) {
  const ctx = createCommentContext(row, index, rows);
  const baseOptions = OPENING_LINES[ctx.bucket];
  const categoryOptions = CATEGORY_LINES[ctx.topCategory];
  const rivalOptions = getRivalLines(ctx);
  const seed = getCommentSeed(ctx);
  const maxAttempts = baseOptions.length * categoryOptions.length * rivalOptions.length * CLOSING_LINES.length;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const opener = pick(baseOptions, seed, attempt);
    const category = pick(categoryOptions, seed, attempt + 5);
    const rival = pick(rivalOptions, seed, attempt + 11);
    const close = pick(CLOSING_LINES, seed, attempt + 17);
    const candidate = fillComment(`#${ctx.position}. ${opener} ${category} ${rival} ${close}`, ctx);
    if (!usedComments.has(candidate)) {
      usedComments.add(candidate);
      return candidate;
    }
  }

  const fallback = fillComment('#{position}. {name} trae una lectura inclasificable: {points} puntos, {trendLabel} y margen para liarla.', ctx);
  usedComments.add(fallback);
  return fallback;
}

function fillComment(template: string | null | undefined, ctx: CommentContext) {
  const safeTemplate = template || '#{position}. {name} sigue en la pelea con {points} puntos.';
  const replacements: Record<string, string> = {
    position: String(ctx.position),
    totalRows: String(ctx.totalRows),
    name: ctx.name,
    leaderName: ctx.leaderName,
    aboveName: ctx.aboveName,
    belowName: ctx.belowName,
    points: String(ctx.points),
    leaderPoints: String(ctx.leaderPoints),
    abovePoints: String(ctx.abovePoints),
    belowPoints: String(ctx.belowPoints),
    leaderGap: String(ctx.leaderGap),
    aboveGap: String(ctx.aboveGap),
    belowGap: String(ctx.belowGap),
    movement: String(ctx.movement),
    trendLabel: ctx.trendLabel,
    topCategoryLabel: ctx.topCategoryLabel,
    topCategoryPoints: String(ctx.topCategoryPoints),
    secondCategoryLabel: ctx.secondCategoryLabel,
    secondCategoryPoints: String(ctx.secondCategoryPoints),
  };

  return Object.entries(replacements).reduce(
    (text, [key, value]) => text.split(`{${key}}`).join(value),
    safeTemplate,
  );
}

function createCommentContext(row: RankingEntry, index: number, rows: RankingEntry[]): CommentContext {
  const position = index + 1;
  const trend = getTrend(row);
  const totalRows = rows.length;
  const points = toScore(row.total_points);
  const leader = rows[0] || row;
  const above = rows[index - 1];
  const below = rows[index + 1];
  const leaderPoints = toScore(leader.total_points);
  const abovePoints = above ? toScore(above.total_points) : points;
  const belowPoints = below ? toScore(below.total_points) : points;
  const categories = getCategoryScores(row);
  const top = categories[0];
  const second = categories[1] || categories[0];
  const previousRank = row.previous_rank || position;
  const currentRank = row.current_rank || position;
  const movement = Math.max(1, Math.abs(previousRank - currentRank));
  const ctxWithoutBucket: Omit<CommentContext, 'bucket'> = {
    row,
    index,
    rows,
    position,
    totalRows,
    name: shortName(getPlayerName(row, getPlayerEmail(row) || 'Este jugador')),
    leaderName: shortName(getPlayerName(leader, 'el líder')),
    aboveName: above ? shortName(getPlayerName(above)) : 'nadie',
    belowName: below ? shortName(getPlayerName(below)) : 'nadie',
    points,
    leaderPoints,
    abovePoints,
    belowPoints,
    leaderGap: Math.max(0, leaderPoints - points),
    aboveGap: above ? Math.max(0, abovePoints - points) : 0,
    belowGap: below ? Math.max(0, points - belowPoints) : 0,
    movement,
    trendLabel: getTrendLabel(trend, movement),
    topCategory: top.key,
    topCategoryLabel: top.label,
    topCategoryPoints: top.points,
    secondCategoryLabel: second.label,
    secondCategoryPoints: second.points,
    tiedAbove: Boolean(above && abovePoints === points),
    tiedBelow: Boolean(below && belowPoints === points),
  };

  return {
    ...ctxWithoutBucket,
    bucket: getCommentBucket(ctxWithoutBucket),
  };
}

function getCommentBucket(ctx: Omit<CommentContext, 'bucket'>): CommentBucket {
  if (ctx.totalRows === 1) return 'solo';
  if (ctx.position === ctx.totalRows && ctx.totalRows > 2) return ctx.points === 0 ? 'zero' : 'last';
  if (ctx.points === 0) return 'zero';
  if (ctx.tiedAbove || ctx.tiedBelow) return 'tie';
  if (ctx.position === 1) return 'leader';
  if (ctx.position <= 3) return 'podium';
  if (ctx.trendLabel.includes('sube')) return 'up';
  if (ctx.trendLabel.includes('baja')) return 'down';
  if (ctx.totalRows > 5 && ctx.position >= ctx.totalRows - 1) return 'bottom';
  return 'chase';
}

function getRivalLines(ctx: CommentContext) {
  if (ctx.bucket === 'solo') {
    return [
      'Su rival más cercano es el espejo, y aun así cuidado con relajarse.',
      'Sin vecinos en la tabla, todo el pique queda pendiente de que entre más gente.',
      'Compite contra el silencio. De momento lo va ganando por poco.',
    ] as const;
  }

  if (ctx.position === 1) {
    if (ctx.tiedBelow) {
      return [
        '{belowName} está empatado justo detrás. Liderato de etiqueta, no de sofá.',
        '{belowName} le discute la cima con los mismos puntos. Aquí nadie debería sacar pecho sin casco.',
        'Tiene a {belowName} pegado. Una mala jornada y el trono cambia de dueño.',
      ] as const;
    }
    return [
      'Le saca {belowGap} a {belowName}. Colchón pequeño, ego grande si no se controla.',
      '{belowName} persigue a {belowGap}. Distancia cómoda solo para quien no conoce este juego.',
      'Por detrás viene {belowName}; {belowGap} puntos no son muralla, son aviso.',
      'Tiene {belowGap} puntos de margen. Suficiente para sonreír, insuficiente para pavonearse.',
    ] as const;
  }

  if (ctx.position === ctx.totalRows) {
    return [
      'Tiene a {aboveName} a {aboveGap}. No es cerca, pero tampoco hay que llamar al comité de crisis.',
      '{aboveName} marca la salida del sótano a {aboveGap} puntos. Objetivo claro, excusas no tanto.',
      'Para empezar la remontada necesita cazar a {aboveName}. No suena imposible; cómodo tampoco.',
      'El de arriba es {aboveName}, a {aboveGap}. Una buena jornada y cambia el relato.',
    ] as const;
  }

  if (ctx.tiedAbove || ctx.tiedBelow) {
    return [
      'Está metido en empate con vecinos cerca. Zona perfecta para picarse por cualquier detalle.',
      'Comparte puntuación y eso siempre trae discusión barata pero entretenida.',
      '{aboveName} y {belowName} están demasiado cerca. Aquí un acierto vale puntos y silencio ajeno.',
      'El margen es mínimo: esto parece ranking, pero ya funciona como ajuste de cuentas.',
    ] as const;
  }

  return [
    'Tiene a {aboveName} a {aboveGap} por arriba y a {belowName} a {belowGap} por abajo. Bocadillo competitivo.',
    '{aboveName} está a tiro: {aboveGap} puntos. Por detrás, {belowName} tampoco se ha ido de vacaciones.',
    'Si caza a {aboveName}, cambia de barrio. Si se duerme, {belowName} le toca la puerta.',
    'Está entre {aboveName} y {belowName}; posición incómoda, buen sitio para hacer daño.',
    '{aboveName} mira hacia abajo y {belowName} hacia arriba. En medio, {name} intentando no hacer el ridículo.',
    'La presión viene doble: {aboveName} delante, {belowName} detrás. Bienvenido al tramo con sudor.',
  ] as const;
}

function getCategoryScores(row: RankingEntry) {
  const categories: CategoryScore[] = [
    { key: 'groups', label: 'partidos de grupo', points: toScore(row.points_groups) },
    { key: 'knockout', label: 'eliminatorias', points: toScore(row.points_knockout) },
    { key: 'qualified', label: 'clasificados', points: toScore(row.points_qualified) },
    { key: 'scorer', label: 'goleador', points: toScore(row.points_scorer) },
  ];
  categories.sort((a, b) => b.points - a.points);

  if (categories[0]?.points > 0) return categories;
  return [{ key: 'none', label: 'sin puntos claros', points: 0 } satisfies CategoryScore, ...categories];
}

function getTrendLabel(trend: ReturnType<typeof getTrend>, movement: number) {
  if (trend === 'up') return `sube ${movement} puesto${movement === 1 ? '' : 's'}`;
  if (trend === 'down') return `baja ${movement} puesto${movement === 1 ? '' : 's'}`;
  return 'se mantiene';
}

function getCommentSeed(ctx: CommentContext) {
  const updatedAt = ctx.row.updated_at ? new Date(ctx.row.updated_at).getTime() : 0;
  const updateBucket = Number.isFinite(updatedAt) ? Math.floor(updatedAt / (1000 * 60 * 60 * 6)) : 0;
  const rankMovement = (ctx.row.previous_rank || ctx.position) - (ctx.row.current_rank || ctx.position);
  return Math.abs(
    hashText(`${ctx.row.user_id}-${ctx.row.community_id}`) +
    updateBucket +
    ctx.index * 53 +
    ctx.totalRows * 29 +
    ctx.points * 31 +
    toScore(ctx.row.points_groups) * 17 +
    toScore(ctx.row.points_knockout) * 13 +
    toScore(ctx.row.points_scorer) * 7 +
    toScore(ctx.row.points_qualified) * 3 +
    rankMovement * 19
  );
}

function fallbackPlayerComment(row: RankingEntry, index: number) {
  const ctx = createCommentContext(row, index, [row]);
  return fillComment('#{position}. {name} sigue en competición con {points} puntos. La tabla manda, pero el Mundial todavía tiene bastante mala idea.', ctx);
}

function pick<T>(items: readonly T[], seed: number, attempt = 0) {
  return items[Math.abs(seed + attempt * 7919) % items.length];
}

function hashText(value: string) {
  return value.split('').reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) | 0, 0);
}

function toScore(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function getProfile(row: RankingEntry): Profile | null {
  if (Array.isArray(row.profiles)) return row.profiles[0] || null;
  return row.profiles || null;
}

function getPlayerName(row: RankingEntry, fallback = 'Usuario') {
  const profile = getProfile(row);
  const value = profile?.username || profile?.email || fallback;
  return safeText(value, fallback);
}

function getPlayerEmail(row: RankingEntry) {
  const profile = getProfile(row);
  return safeText(profile?.email || '', '');
}

function getPlayerInitial(row: RankingEntry) {
  return getPlayerName(row).trim().charAt(0).toUpperCase() || 'U';
}

function safeText(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function shortName(value: unknown) {
  const clean = safeText(value, 'Este jugador').split('@')[0].replace(/[._-]+/g, ' ').trim();
  return clean.split(/\s+/).filter(Boolean).slice(0, 2).join(' ') || 'Este jugador';
}

function getRankingKey(row: RankingEntry) {
  return `${row.user_id}-${row.community_id}`;
}

function groupPointEventsByUser(events: PointEvent[]) {
  return events.reduce<Record<string, PointEvent[]>>((acc, event) => {
    if (!acc[event.user_id]) acc[event.user_id] = [];
    acc[event.user_id].push(event);
    return acc;
  }, {});
}

function sortPointEvents(events: PointEvent[]) {
  const categoryOrder: Record<PointEvent['category'], number> = {
    groups: 1,
    qualified: 2,
    scorer: 3,
    knockout: 4,
  };
  return [...events].sort((a, b) =>
    (categoryOrder[a.category] - categoryOrder[b.category]) ||
    (toScore(b.points) - toScore(a.points)) ||
    safeText(a.label || '', '').localeCompare(safeText(b.label || '', ''), 'es'),
  );
}

function getPointEventTotals(events: PointEvent[]) {
  const totals = new Map<PointEvent['category'], number>();
  events.forEach((event) => {
    totals.set(event.category, (totals.get(event.category) || 0) + toScore(event.points));
  });
  return (['groups', 'qualified', 'scorer', 'knockout'] as PointEvent['category'][])
    .map((key) => ({ key, label: getPointCategoryLabel(key), points: totals.get(key) || 0 }))
    .filter((item) => item.points > 0);
}

function getPointCategoryLabel(category: PointEvent['category']) {
  if (category === 'groups') return 'Partidos grupo';
  if (category === 'qualified') return 'Clasificados';
  if (category === 'scorer') return 'Goleador';
  return 'Eliminatoria';
}

function getFallbackPointLabel(event: PointEvent) {
  if (event.ref_type === 'match') return 'Pronóstico de partido acertado';
  if (event.ref_type === 'group_position') return 'Puesto exacto de grupo';
  if (event.ref_type === 'group_qualified') return 'Clasificado de grupo acertado';
  if (event.ref_type === 'scorer') return 'Gol del goleador elegido';
  if (event.ref_type === 'finalist') return 'Finalista acertado';
  return 'Evento de puntuación';
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
