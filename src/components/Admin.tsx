import { useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { CheckCircle2, Euro, Loader2, Mail, RefreshCw, Shield, UserCheck } from 'lucide-react';
import { isAdmin, supabase } from '../lib/supabase';
import type { CommunityMembership, CommunitySettings, Match, Profile, Team } from '../lib/types';
import { displayTeam } from '../lib/flags';
import type { CommunityId } from '../lib/communities';

type AdminMember = CommunityMembership & { profiles?: Profile };

export default function Admin({ user, profile, communityId }: { user: User | null; profile: Profile | null; communityId: CommunityId }) {
  const [members, setMembers] = useState<AdminMember[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState('');
  const [homeScore, setHomeScore] = useState('');
  const [awayScore, setAwayScore] = useState('');
  const [tvChannel, setTvChannel] = useState('');
  const [goalPlayer, setGoalPlayer] = useState('');
  const [goalTeamId, setGoalTeamId] = useState('');
  const [goalCount, setGoalCount] = useState('0');
  const [settings, setSettings] = useState<CommunitySettings | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const admin = isAdmin(profile, user?.email);
  const selectedMatch = useMemo(() => matches.find((match) => match.id === selectedMatchId), [matches, selectedMatchId]);
  const pendingMembers = useMemo(() => members.filter((member) => member.status === 'pending'), [members]);
  const approvedMembers = useMemo(() => members.filter((member) => member.status !== 'pending'), [members]);

  useEffect(() => {
    if (!admin) return;
    refresh();
  }, [admin, communityId]);

  useEffect(() => {
    setTvChannel(selectedMatch?.tv_channel_es || '');
  }, [selectedMatch]);

  async function refresh() {
    const [{ data: memberRows }, { data: matchRows }, { data: teamRows }, { data: settingsRow }] = await Promise.all([
      supabase.from('community_memberships').select('*, profiles(*)').eq('community_id', communityId).order('created_at', { ascending: false }),
      supabase.from('matches').select('*').order('kickoff_at', { ascending: true }),
      supabase.from('teams').select('*').order('name', { ascending: true }),
      supabase.from('community_settings').select('*').eq('community_id', communityId).maybeSingle(),
    ]);
    setMembers((memberRows || []) as AdminMember[]);
    setMatches((matchRows || []) as Match[]);
    setTeams((teamRows || []) as Team[]);
    setSettings((settingsRow as CommunitySettings | null) || {
      community_id: communityId,
      bizum_recipient: 'Aritz',
      entry_fee_eur: 0,
      prize_distribution: {
        phase1Champion: 10,
        phase2Champion: 5,
        globalChampion: 50,
        globalRunnerUp: 20,
        globalThird: 15,
      },
      notes: '',
    });
  }

  async function updateProfileStatus(id: string, status: Profile['status']) {
    setBusy(id);
    const { error } = await supabase
      .from('community_memberships')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('user_id', id)
      .eq('community_id', communityId);
    if (error) alert(error.message);
    await refresh();
    setBusy(null);
  }

  async function syncFifa() {
    setBusy('sync');
    const { error } = await supabase.functions.invoke('sync-fifa-matches');
    if (error) alert(error.message);
    await refresh();
    setBusy(null);
  }

  async function recalculate() {
    setBusy('recalculate');
    const { error } = await supabase.rpc('recalculate_points');
    if (error) alert(error.message);
    await refresh();
    setBusy(null);
  }

  async function saveManualResult() {
    if (!selectedMatch || homeScore === '' || awayScore === '') return;
    setBusy('result');
    const { error } = await supabase.from('matches').update({
      home_score: Number(homeScore),
      away_score: Number(awayScore),
      tv_channel_es: tvChannel || 'DAZN / Canal Mediapro',
      status: 'finished',
      synced_at: new Date().toISOString(),
    }).eq('id', selectedMatch.id);
    if (error) alert(error.message);
    await recalculate();
    setBusy(null);
  }

  async function saveGoals() {
    const team = teams.find((item) => item.id === goalTeamId);
    if (!goalPlayer.trim()) return;
    setBusy('goals');
    const playerKey = `${goalPlayer.trim().toLowerCase()}|${goalTeamId || 'unknown'}`;
    const { error } = await supabase.from('player_goals').upsert({
      player_key: playerKey,
      player_name: goalPlayer.trim(),
      team_id: team?.id || null,
      team_name: team?.name || null,
      team_code: team?.code || null,
      goals: Number(goalCount) || 0,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'player_key' });
    if (error) alert(error.message);
    await recalculate();
    setBusy(null);
  }

  async function saveCommunitySettings() {
    if (!settings) return;
    setBusy('settings');
    const { error } = await supabase.from('community_settings').upsert({
      community_id: communityId,
      bizum_recipient: settings.bizum_recipient || 'Aritz',
      entry_fee_eur: Number(settings.entry_fee_eur) || 0,
      prize_distribution: settings.prize_distribution,
      notes: settings.notes || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'community_id' });
    if (error) alert(error.message);
    await refresh();
    setBusy(null);
  }

  if (!admin) {
    return (
      <div className="dimension-card-accent p-12 text-center">
        <Shield className="w-12 h-12 text-brand-gold mx-auto mb-6" />
        <h1 className="text-2xl font-black uppercase tracking-tighter italic">Acceso admin requerido</h1>
      </div>
    );
  }

  return (
    <div className="space-y-10 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter italic">Panel <span className="text-brand-gold">Admin</span></h1>
          <p className="text-brand-zinc-500 text-xs font-bold uppercase tracking-widest mt-2">Usuarios, calendario, resultados y ranking</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <AdminButton onClick={syncFifa} busy={busy === 'sync'} icon={RefreshCw}>Sincronizar FIFA</AdminButton>
          <AdminButton onClick={recalculate} busy={busy === 'recalculate'} icon={CheckCircle2}>Recalcular</AdminButton>
        </div>
      </div>

      <section className="dimension-card-accent p-6">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          <div>
            <h2 className="text-lg font-black uppercase tracking-tighter italic mb-2 flex items-center gap-3"><Euro className="w-5 h-5 text-brand-gold" /> Premio y Bizum</h2>
            <p className="text-sm text-brand-zinc-400">Define el pago de entrada y cómo se reparte el bote en esta comunidad.</p>
          </div>
          <button onClick={saveCommunitySettings} disabled={busy === 'settings'} className="dimension-button-primary px-6 flex items-center justify-center gap-2">
            {busy === 'settings' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Guardar reglas
          </button>
        </div>
        {settings && (
          <div className="mt-6 grid lg:grid-cols-[1fr_180px] gap-4">
            <label className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-brand-zinc-500">Bizum a</span>
              <input value={settings.bizum_recipient} onChange={(event) => setSettings({ ...settings, bizum_recipient: event.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3" />
            </label>
            <label className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-brand-zinc-500">Pago por jugador (€)</span>
              <input value={settings.entry_fee_eur} onChange={(event) => setSettings({ ...settings, entry_fee_eur: Number(event.target.value) })} type="number" min="0" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3" />
            </label>
            <div className="lg:col-span-2 grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <PrizeInput label="Campeón 1ª fase" value={settings.prize_distribution.phase1Champion} onChange={(value) => setSettings({ ...settings, prize_distribution: { ...settings.prize_distribution, phase1Champion: value } })} />
              <PrizeInput label="Campeón 2ª fase" value={settings.prize_distribution.phase2Champion} onChange={(value) => setSettings({ ...settings, prize_distribution: { ...settings.prize_distribution, phase2Champion: value } })} />
              <PrizeInput label="Campeón global" value={settings.prize_distribution.globalChampion} onChange={(value) => setSettings({ ...settings, prize_distribution: { ...settings.prize_distribution, globalChampion: value } })} />
              <PrizeInput label="Segundo global" value={settings.prize_distribution.globalRunnerUp} onChange={(value) => setSettings({ ...settings, prize_distribution: { ...settings.prize_distribution, globalRunnerUp: value } })} />
              <PrizeInput label="Tercero global" value={settings.prize_distribution.globalThird} onChange={(value) => setSettings({ ...settings, prize_distribution: { ...settings.prize_distribution, globalThird: value } })} />
            </div>
            <label className="lg:col-span-2 space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-brand-zinc-500">Nota visible para la comunidad</span>
              <textarea value={settings.notes || ''} onChange={(event) => setSettings({ ...settings, notes: event.target.value })} rows={2} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3" placeholder="Ejemplo: antes del inicio, Bizum a Aritz indicando nombre y comunidad." />
            </label>
          </div>
        )}
      </section>

      <section className="dimension-card-accent p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <h2 className="text-lg font-black uppercase tracking-tighter italic flex items-center gap-3"><UserCheck className="w-5 h-5 text-brand-gold" /> Usuarios</h2>
          <div className="flex items-center gap-2 rounded-full border border-brand-gold/20 bg-brand-gold/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-brand-gold">
            <Mail className="w-3 h-3" /> {pendingMembers.length} pendientes
          </div>
        </div>
        {pendingMembers.length > 0 && (
          <div className="mb-5 rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4">
            <p className="text-xs font-black uppercase tracking-widest text-amber-100 mb-3">Validación rápida</p>
            <div className="grid gap-2">
              {pendingMembers.map((row) => (
                <MemberRow key={`${row.user_id}-${row.community_id}`} row={row} busy={busy === row.user_id} onUpdate={updateProfileStatus} highlight />
              ))}
            </div>
          </div>
        )}
        <div className="grid gap-3">
          {approvedMembers.map((row) => <MemberRow key={`${row.user_id}-${row.community_id}`} row={row} busy={busy === row.user_id} onUpdate={updateProfileStatus} />)}
        </div>
      </section>

      <section className="grid lg:grid-cols-2 gap-6">
        <div className="dimension-card-accent p-6">
          <h2 className="text-lg font-black uppercase tracking-tighter italic mb-5">Resultado manual</h2>
          <div className="space-y-3">
            <select value={selectedMatchId} onChange={(event) => setSelectedMatchId(event.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm">
              <option value="">Selecciona partido</option>
              {matches.map((match) => (
                <option key={match.id} value={match.id}>
                  {match.match_number || '?'} - {displayTeam(match.home_team_name, match.home_team_code)} vs {displayTeam(match.away_team_name, match.away_team_code)}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-3">
              <input value={homeScore} onChange={(event) => setHomeScore(event.target.value)} type="number" min="0" placeholder="Local" className="bg-black/40 border border-white/10 rounded-xl px-4 py-3" />
              <input value={awayScore} onChange={(event) => setAwayScore(event.target.value)} type="number" min="0" placeholder="Visitante" className="bg-black/40 border border-white/10 rounded-xl px-4 py-3" />
            </div>
            <select value={tvChannel} onChange={(event) => setTvChannel(event.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm">
              <option value="DAZN / Canal Mediapro">DAZN / Canal Mediapro</option>
              <option value="RTVE + DAZN / Canal Mediapro">RTVE + DAZN / Canal Mediapro</option>
              <option value="Por confirmar">Por confirmar</option>
            </select>
            <button onClick={saveManualResult} disabled={busy === 'result'} className="dimension-button-primary px-6 w-full">{busy === 'result' ? 'Guardando...' : 'Guardar y recalcular'}</button>
          </div>
        </div>

        <div className="dimension-card-accent p-6">
          <h2 className="text-lg font-black uppercase tracking-tighter italic mb-5">Goles de goleadores</h2>
          <div className="space-y-3">
            <input value={goalPlayer} onChange={(event) => setGoalPlayer(event.target.value)} placeholder="Jugador" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3" />
            <select value={goalTeamId} onChange={(event) => setGoalTeamId(event.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm">
              <option value="">Selección opcional</option>
              {teams.map((team) => <option key={team.id} value={team.id}>{displayTeam(team.name, team.code)}</option>)}
            </select>
            <input value={goalCount} onChange={(event) => setGoalCount(event.target.value)} type="number" min="0" placeholder="Goles" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3" />
            <button onClick={saveGoals} disabled={busy === 'goals'} className="dimension-button-primary px-6 w-full">{busy === 'goals' ? 'Guardando...' : 'Guardar goles y recalcular'}</button>
          </div>
        </div>
      </section>
    </div>
  );
}

function AdminButton({ onClick, busy, icon: Icon, children }: { onClick: () => void; busy: boolean; icon: typeof RefreshCw; children: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={busy} className="px-4 py-2 bg-brand-gold text-black rounded-lg text-[10px] font-black uppercase tracking-widest hover:brightness-110 transition-all flex items-center gap-2 disabled:opacity-50">
      {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Icon className="w-3 h-3" />} {children}
    </button>
  );
}

function PrizeInput({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="space-y-2">
      <span className="text-[9px] font-black uppercase tracking-widest text-brand-zinc-500">{label}</span>
      <div className="relative">
        <input value={value} onChange={(event) => onChange(Number(event.target.value))} type="number" min="0" max="100" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 pr-8" />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-brand-zinc-500">%</span>
      </div>
    </label>
  );
}

function MemberRow({ row, busy, onUpdate, highlight = false }: { row: AdminMember; busy: boolean; onUpdate: (id: string, status: Profile['status']) => void; highlight?: boolean }) {
  return (
    <div className={`grid md:grid-cols-[1fr_120px_auto] gap-3 items-center rounded-xl border p-4 ${highlight ? 'border-amber-300/20 bg-black/20' : 'border-white/10 bg-white/[0.03]'}`}>
      <div>
        <p className="text-sm font-black uppercase">{row.profiles?.username || row.profiles?.email}</p>
        <p className="text-xs text-brand-zinc-500">{row.profiles?.email}</p>
      </div>
      <span className="text-[10px] font-black uppercase tracking-widest text-brand-gold">{row.status}</span>
      <div className="flex gap-2">
        <button onClick={() => onUpdate(row.user_id, 'approved')} disabled={busy} className="px-3 py-2 rounded-lg bg-emerald-500/20 text-emerald-300 text-[10px] font-black uppercase">Aprobar</button>
        <button onClick={() => onUpdate(row.user_id, 'blocked')} disabled={busy} className="px-3 py-2 rounded-lg bg-red-500/20 text-red-300 text-[10px] font-black uppercase">Bloquear</button>
      </div>
    </div>
  );
}
