import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { CalendarClock, ChevronDown, Lock, Target, Trophy, Users } from 'lucide-react';
import type { CommunityMembership, CommunitySettings, KnockoutPrediction, Match, MatchPrediction, Profile, ScorerPrediction } from '../lib/types';
import { canPlay, isAdmin, supabase } from '../lib/supabase';
import { formatDateTime } from '../lib/constants';
import { getPhaseDeadline } from '../lib/deadlines';
import { displayTeam } from '../lib/flags';
import type { CommunityId } from '../lib/communities';

type MemberWithProfile = CommunityMembership & { profiles?: Profile };
type PredictionByUser<T> = Record<string, T[]>;

export default function Others({
  user,
  profile,
  communityId,
}: {
  user: User | null;
  profile: Profile | null;
  communityId: CommunityId;
}) {
  const [now, setNow] = useState(() => new Date());
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<MemberWithProfile[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [matchPredictions, setMatchPredictions] = useState<MatchPrediction[]>([]);
  const [knockoutPredictions, setKnockoutPredictions] = useState<KnockoutPrediction[]>([]);
  const [scorerPredictions, setScorerPredictions] = useState<ScorerPrediction[]>([]);
  const [settings, setSettings] = useState<CommunitySettings | null>(null);

  const admin = isAdmin(profile, user?.email);
  const approved = Boolean(admin || (canPlay(profile, user?.email) && profile?.community_id === communityId));
  const groupDeadlineIso = getPhaseDeadline('groups', settings);
  const scorerDeadlineIso = getPhaseDeadline('scorer', settings);
  const knockoutDeadlineIso = getPhaseDeadline('knockout', settings);
  const groupsOpen = isRevealOpen(groupDeadlineIso, now);
  const scorerOpen = isRevealOpen(scorerDeadlineIso, now);
  const knockoutOpen = isRevealOpen(knockoutDeadlineIso, now);
  const hasAnyOpenSection = groupsOpen || scorerOpen || knockoutOpen;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!user || !approved) return;

    async function loadData() {
      setLoading(true);
      const baseRequests = [
        supabase
          .from('community_memberships')
          .select('*, profiles(*)')
          .eq('community_id', communityId)
          .eq('status', 'approved')
          .order('total_points', { ascending: false }),
        supabase.from('matches').select('*').order('match_number', { ascending: true }),
        supabase.from('community_settings').select('*').eq('community_id', communityId).maybeSingle(),
      ] as const;

      const [membersResult, matchesResult, settingsResult] = await Promise.all(baseRequests);
      setMembers(((membersResult.data || []) as MemberWithProfile[]).filter((member) => member.user_id !== user.id));
      setMatches((matchesResult.data || []) as Match[]);
      setSettings((settingsResult.data as CommunitySettings | null) || null);

      if (groupsOpen) {
        const matchResult = await supabase.from('match_predictions').select('*').eq('community_id', communityId);
        setMatchPredictions((matchResult.data || []) as MatchPrediction[]);
      } else {
        setMatchPredictions([]);
      }

      if (scorerOpen) {
        const scorerResult = await supabase.from('scorer_predictions').select('*').eq('community_id', communityId);
        setScorerPredictions((scorerResult.data || []) as ScorerPrediction[]);
      } else {
        setScorerPredictions([]);
      }

      if (knockoutOpen) {
        const knockoutResult = await supabase.from('knockout_predictions').select('*').eq('community_id', communityId);
        setKnockoutPredictions((knockoutResult.data || []) as KnockoutPrediction[]);
      } else {
        setKnockoutPredictions([]);
      }

      setLoading(false);
    }

    loadData();
  }, [approved, communityId, groupsOpen, knockoutOpen, scorerOpen, user]);

  const matchById = useMemo(() => new Map(matches.map((match) => [match.id, match])), [matches]);
  const groupPredictionsByUser = useMemo(
    () => groupByUser(matchPredictions.filter((prediction) => {
      const match = matchById.get(prediction.match_id);
      return match && !isKnockoutMatch(match);
    })),
    [matchById, matchPredictions],
  );
  const knockoutPredictionsByUser = useMemo(() => groupByUser(knockoutPredictions), [knockoutPredictions]);
  const scorerByUser = useMemo(() => new Map(scorerPredictions.map((prediction) => [prediction.user_id, prediction])), [scorerPredictions]);

  if (!user || !approved) {
    return (
      <LockedShell
        title="Rivales protegidos"
        text="Para ver pronósticos de otros jugadores tienes que entrar con una cuenta aprobada en esta comunidad."
      />
    );
  }

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
        <div>
          <div className="flex items-center gap-3 text-brand-gold">
            <Users className="w-4 h-4" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">Vista social</span>
          </div>
          <h1 className="mt-2 text-3xl font-black uppercase tracking-tighter italic">Pronósticos <span className="text-brand-gold">de rivales</span></h1>
          <p className="mt-2 text-sm text-brand-zinc-400 max-w-2xl">
            Se revelan por fases cuando ya no se pueden editar. Nadie puede mirar antes del cierre, ni aunque se ponga creativo con el navegador.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <RevealStatus title="Grupos" open={groupsOpen} date={formatDateTime(groupDeadlineIso)} />
          <RevealStatus title="Goleador" open={scorerOpen} date={formatDateTime(scorerDeadlineIso)} />
          <RevealStatus title="Eliminatoria" open={knockoutOpen} date="Por ronda" />
        </div>
      </div>

      {!hasAnyOpenSection && (
        <LockedShell
          title="Aún cerrado"
          text={`Los pronósticos se abren por fases: grupos el ${formatDateTime(groupDeadlineIso)}, goleador el ${formatDateTime(scorerDeadlineIso)} y eliminatoria por ronda. Hasta entonces cada jugador ve solo lo suyo.`}
        />
      )}

      {hasAnyOpenSection && (
        <section className="space-y-4">
          {loading && <div className="dimension-card-accent p-8 text-center text-sm text-brand-zinc-400">Cargando pronósticos de la comunidad...</div>}
          {!loading && members.length === 0 && (
            <div className="dimension-card-accent p-8 text-center text-sm text-brand-zinc-400">
              Todavía no hay otros jugadores aprobados en esta comunidad.
            </div>
          )}
          {!loading && members.map((member) => (
            <PlayerRevealCard
              key={`${member.user_id}-${member.community_id}`}
              member={member}
              now={now}
              settings={settings}
              groupPredictions={groupPredictionsByUser[member.user_id] || []}
              knockoutPredictions={knockoutPredictionsByUser[member.user_id] || []}
              scorerPrediction={scorerByUser.get(member.user_id) || null}
              matchById={matchById}
            />
          ))}
        </section>
      )}
    </div>
  );
}

function PlayerRevealCard({
  member,
  now,
  settings,
  groupPredictions,
  knockoutPredictions,
  scorerPrediction,
  matchById,
}: {
  member: MemberWithProfile;
  now: Date;
  settings: CommunitySettings | null;
  groupPredictions: MatchPrediction[];
  knockoutPredictions: KnockoutPrediction[];
  scorerPrediction: ScorerPrediction | null;
  matchById: Map<string, Match>;
}) {
  const playerName = member.profiles?.username || member.profiles?.email || 'Jugador';
  const memberGroupsOpen = isRevealOpen(getPhaseDeadline('groups', settings, member.prediction_unlocks), now);
  const memberScorerOpen = isRevealOpen(getPhaseDeadline('scorer', settings, member.prediction_unlocks), now);
  const memberKnockoutOpen = isRevealOpen(getPhaseDeadline('knockout', settings, member.prediction_unlocks), now);
  const phaseOneCount = (memberGroupsOpen ? groupPredictions.length : 0) + (memberScorerOpen && scorerPrediction ? 1 : 0);

  return (
    <article className="dimension-card-accent overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 bg-white/[0.03] p-5">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl border border-brand-gold/20 bg-brand-gold/10 flex items-center justify-center text-brand-gold font-black uppercase">
            {playerName.slice(0, 1)}
          </div>
          <div>
            <h2 className="text-base font-black uppercase tracking-tight">{playerName}</h2>
            <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-brand-zinc-500">{member.total_points || 0} pts en ranking</p>
          </div>
        </div>
        {memberScorerOpen && (
          <div className="rounded-full border border-brand-gold/20 bg-brand-gold/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-brand-gold">
            {scorerPrediction?.player_name || 'Sin goleador'}
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-4 p-4 sm:p-5">
        <PredictionDetails
          title="Grupos y goleador"
          icon={Target}
          locked={!memberGroupsOpen && !memberScorerOpen}
          emptyText="Este jugador aún no tiene pronósticos visibles de grupos o goleador."
          count={phaseOneCount}
        >
          {memberScorerOpen && scorerPrediction && (
            <div className="mb-3 rounded-xl border border-brand-gold/20 bg-brand-gold/10 p-3 text-sm">
              <span className="text-[10px] font-black uppercase tracking-widest text-brand-gold">Goleador elegido</span>
              <p className="mt-1 font-black uppercase">{scorerPrediction.player_name} · {displayTeam(scorerPrediction.team_name || 'Selección', scorerPrediction.team_code)}</p>
            </div>
          )}
          {memberGroupsOpen && <PredictionRows predictions={groupPredictions} matchById={matchById} />}
        </PredictionDetails>

        <PredictionDetails
          title="Eliminatoria"
          icon={Trophy}
          locked={!memberKnockoutOpen}
          emptyText="Este jugador aún no tiene pronósticos visibles de eliminatoria."
          count={knockoutPredictions.length}
        >
          <KnockoutRows predictions={knockoutPredictions} matchById={matchById} />
        </PredictionDetails>
      </div>
    </article>
  );
}

function PredictionDetails({
  title,
  icon: Icon,
  locked,
  emptyText,
  count,
  children,
}: {
  title: string;
  icon: typeof Target;
  locked: boolean;
  emptyText: string;
  count: number;
  children: ReactNode;
}) {
  if (locked) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
        <div className="flex items-center gap-3 text-brand-zinc-500">
          <Lock className="h-4 w-4" />
          <p className="text-xs font-black uppercase tracking-widest">{title} cerrada hasta plazo</p>
        </div>
      </div>
    );
  }

  return (
    <details className="group rounded-2xl border border-white/10 bg-black/20 open:bg-black/30">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4">
        <span className="flex items-center gap-3 text-sm font-black uppercase tracking-tight">
          <Icon className="h-4 w-4 text-brand-gold" />
          {title}
          <span className="rounded-full bg-white/10 px-2 py-1 text-[9px] text-brand-zinc-400">{count}</span>
        </span>
        <ChevronDown className="h-4 w-4 text-brand-zinc-500 transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-white/10 p-4">
        {count === 0 ? <p className="text-sm text-brand-zinc-500">{emptyText}</p> : children}
      </div>
    </details>
  );
}

function PredictionRows({ predictions, matchById }: { predictions: MatchPrediction[]; matchById: Map<string, Match> }) {
  return (
    <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
      {sortPredictions(predictions, matchById).map((prediction) => {
        const match = matchById.get(prediction.match_id);
        return (
          <div key={prediction.match_id} className="grid grid-cols-[1fr_auto] gap-3 rounded-xl border border-white/5 bg-white/[0.03] p-3 text-xs">
            <span className="min-w-0 truncate text-brand-zinc-300">
              {match ? matchLabel(match) : prediction.match_id}
            </span>
            <span className="font-mono font-black text-brand-gold tabular-nums">{prediction.home_score} - {prediction.away_score}</span>
          </div>
        );
      })}
    </div>
  );
}

function KnockoutRows({ predictions, matchById }: { predictions: KnockoutPrediction[]; matchById: Map<string, Match> }) {
  return (
    <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
      {sortPredictions(predictions, matchById).map((prediction) => {
        const match = matchById.get(prediction.match_id);
        const homeName = match?.home_team_name || prediction.predicted_home_team_name || 'Por definir';
        const homeCode = match?.home_team_code || prediction.predicted_home_team_code;
        const awayName = match?.away_team_name || prediction.predicted_away_team_name || 'Por definir';
        const awayCode = match?.away_team_code || prediction.predicted_away_team_code;
        const hasScore = prediction.predicted_home_score !== undefined &&
          prediction.predicted_home_score !== null &&
          prediction.predicted_away_score !== undefined &&
          prediction.predicted_away_score !== null;
        return (
          <div key={prediction.match_id} className="rounded-xl border border-white/5 bg-white/[0.03] p-3 text-xs">
            <p className="mb-1 truncate text-brand-zinc-500">{match ? matchLabel(match) : prediction.match_id}</p>
            <div className="flex items-center justify-between gap-3">
              <p className="font-black uppercase text-brand-zinc-200">
                {displayTeam(homeName, homeCode)} vs {displayTeam(awayName, awayCode)}
              </p>
              {hasScore && (
                <span className="rounded-lg border border-brand-gold/20 bg-brand-gold/10 px-2 py-1 font-mono font-black text-brand-gold tabular-nums">
                  {prediction.predicted_home_score} - {prediction.predicted_away_score}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RevealStatus({ title, open, date }: { title: string; open: boolean; date: string }) {
  return (
    <div className={`rounded-2xl border p-4 text-right ${open ? 'border-emerald-400/25 bg-emerald-500/10' : 'border-white/10 bg-white/[0.03]'}`}>
      <p className={`text-[10px] font-black uppercase tracking-widest ${open ? 'text-emerald-300' : 'text-brand-zinc-500'}`}>
        {open ? 'Visible' : 'Oculto'}
      </p>
      <p className="mt-1 text-sm font-black uppercase">{title}</p>
      <p className="mt-1 text-[9px] font-black uppercase tracking-widest text-brand-gold">{date}</p>
    </div>
  );
}

function LockedShell({ title, text }: { title: string; text: string }) {
  return (
    <div className="dimension-card-accent p-8 sm:p-10 flex flex-col items-center justify-center text-center space-y-6 min-h-[360px]">
      <div className="w-20 h-20 bg-white/5 border border-white/10 rounded-full flex items-center justify-center text-brand-gold shadow-[0_0_30px_rgba(174,156,80,0.12)]">
        <Lock className="w-10 h-10" />
      </div>
      <div className="space-y-2">
        <h3 className="text-xl font-black uppercase tracking-widest text-white">{title}</h3>
        <p className="text-sm text-brand-zinc-500 max-w-xl mx-auto font-medium leading-relaxed">{text}</p>
      </div>
      <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-[10px] uppercase tracking-widest text-brand-zinc-500 font-black">
        <CalendarClock className="w-4 h-4 text-brand-gold" />
        Revelado automático por fechas
      </div>
    </div>
  );
}

function groupByUser<T extends { user_id: string }>(rows: T[]): PredictionByUser<T> {
  return rows.reduce<PredictionByUser<T>>((acc, row) => {
    if (!acc[row.user_id]) acc[row.user_id] = [];
    acc[row.user_id].push(row);
    return acc;
  }, {});
}

function sortPredictions<T extends { match_id: string }>(rows: T[], matchById: Map<string, Match>) {
  return [...rows].sort((a, b) => {
    const matchA = matchById.get(a.match_id);
    const matchB = matchById.get(b.match_id);
    return (matchA?.match_number || 999) - (matchB?.match_number || 999);
  });
}

function matchLabel(match: Match) {
  const number = match.match_number ? `#${match.match_number} · ` : '';
  return `${number}${displayTeam(match.home_team_name, match.home_team_code)} vs ${displayTeam(match.away_team_name, match.away_team_code)}`;
}

function isKnockoutMatch(match: Match) {
  const phase = match.phase?.toLowerCase() || '';
  return (match.round_number || 0) >= 4 || (!match.group_code && !phase.includes('group') && !phase.includes('grupo'));
}

function isRevealOpen(deadlineIso: string, now: Date) {
  return now.getTime() >= new Date(deadlineIso).getTime();
}
