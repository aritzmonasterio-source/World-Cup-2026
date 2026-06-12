import { useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { AlertCircle, CalendarClock, CheckCircle2, Euro, Loader2, LockOpen, Mail, RefreshCw, RotateCcw, Shield, TimerReset, UserCheck } from 'lucide-react';
import { isAdmin, supabase } from '../lib/supabase';
import type { CommunityMembership, CommunitySettings, Match, PredictionPhase, Profile, Team } from '../lib/types';
import { displayTeam } from '../lib/flags';
import { getCommunity, type CommunityId } from '../lib/communities';
import { addHoursIso, fromDateTimeLocalValue, getPhaseDeadline, toDateTimeLocalValue } from '../lib/deadlines';

type AdminMember = CommunityMembership & { profiles?: Profile };
type AdminNotice = { type: 'ok' | 'warning' | 'error'; text: string };
type ResultSummary = {
  finishedMatches: number;
  totalGoals: number;
};

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
  const [loadError, setLoadError] = useState('');
  const [adminNotice, setAdminNotice] = useState<AdminNotice | null>(null);

  const admin = isAdmin(profile, user?.email);
  const community = getCommunity(communityId);
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
    setLoadError('');
    const [membersResult, matchesResult, teamsResult, settingsResult] = await Promise.all([
      supabase.from('community_memberships').select('*, profiles(*)').eq('community_id', communityId).order('created_at', { ascending: false }),
      supabase.from('matches').select('*').order('kickoff_at', { ascending: true }),
      supabase.from('teams').select('*').order('name', { ascending: true }),
      supabase.from('community_settings').select('*').eq('community_id', communityId).maybeSingle(),
    ]);
    const firstError = membersResult.error || matchesResult.error || teamsResult.error || settingsResult.error;
    if (firstError) {
      setLoadError(firstError.message);
    }
    const memberRows = membersResult.data;
    const matchRows = matchesResult.data;
    const teamRows = teamsResult.data;
    const settingsRow = settingsResult.data;
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
      groups_deadline_at: null,
      scorer_deadline_at: null,
      knockout_deadline_at: null,
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

  function deadlineField(phase: PredictionPhase): keyof Pick<CommunitySettings, 'groups_deadline_at' | 'scorer_deadline_at' | 'knockout_deadline_at'> {
    if (phase === 'groups') return 'groups_deadline_at';
    if (phase === 'scorer') return 'scorer_deadline_at';
    return 'knockout_deadline_at';
  }

  function unlockField(phase: PredictionPhase) {
    if (phase === 'groups') return 'groups_until';
    if (phase === 'scorer') return 'scorer_until';
    return 'knockout_until';
  }

  function phaseLabel(phase: PredictionPhase) {
    if (phase === 'groups') return 'grupos';
    if (phase === 'scorer') return 'goleador';
    return 'eliminatoria';
  }

  function updateDeadlineField(phase: PredictionPhase, value: string) {
    if (!settings) return;
    setSettings({
      ...settings,
      [deadlineField(phase)]: fromDateTimeLocalValue(value),
    });
  }

  async function persistCommunitySettings(nextSettings: CommunitySettings, notice = 'Reglas guardadas correctamente') {
    setBusy('settings');
    const { error } = await supabase.from('community_settings').upsert({
      community_id: communityId,
      bizum_recipient: nextSettings.bizum_recipient || 'Aritz',
      entry_fee_eur: Number(nextSettings.entry_fee_eur) || 0,
      prize_distribution: nextSettings.prize_distribution,
      groups_deadline_at: nextSettings.groups_deadline_at || null,
      scorer_deadline_at: nextSettings.scorer_deadline_at || null,
      knockout_deadline_at: nextSettings.knockout_deadline_at || null,
      notes: nextSettings.notes || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'community_id' });

    setAdminNotice(error
      ? { type: 'error', text: `No se pudieron guardar las reglas: ${error.message}` }
      : { type: 'ok', text: notice });
    await refresh();
    setBusy(null);
  }

  async function extendCommunityDeadline(phase: PredictionPhase, hours = 3) {
    if (!settings) return;
    const until = addHoursIso(hours);
    const nextSettings = {
      ...settings,
      [deadlineField(phase)]: until,
    };
    setSettings(nextSettings);
    await persistCommunitySettings(nextSettings, `Reabierto ${phaseLabel(phase)} para toda la comunidad durante ${hours} horas.`);
  }

  async function closeCommunityDeadline(phase: PredictionPhase) {
    if (!settings) return;
    const nextSettings = {
      ...settings,
      [deadlineField(phase)]: new Date().toISOString(),
    };
    setSettings(nextSettings);
    await persistCommunitySettings(nextSettings, `Cerrado ${phaseLabel(phase)} desde este momento.`);
  }

  async function resetCommunityDeadlines() {
    if (!settings) return;
    const nextSettings = {
      ...settings,
      groups_deadline_at: null,
      scorer_deadline_at: null,
      knockout_deadline_at: null,
    };
    setSettings(nextSettings);
    await persistCommunitySettings(nextSettings, 'Plazos restaurados a los valores por defecto del juego.');
  }

  async function extendMemberUnlock(userId: string, phase: PredictionPhase, hours = 3) {
    const member = members.find((row) => row.user_id === userId);
    const nextUnlocks = {
      ...(member?.prediction_unlocks || {}),
      [unlockField(phase)]: addHoursIso(hours),
    };
    setBusy(`unlock-${userId}`);
    const { error } = await supabase
      .from('community_memberships')
      .update({ prediction_unlocks: nextUnlocks, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('community_id', communityId);
    setAdminNotice(error
      ? { type: 'error', text: `No se pudo reabrir ${phaseLabel(phase)} para el usuario: ${error.message}` }
      : { type: 'ok', text: `Reabierto ${phaseLabel(phase)} durante ${hours} horas solo para ese usuario.` });
    await refresh();
    setBusy(null);
  }

  async function clearMemberUnlocks(userId: string) {
    setBusy(`unlock-${userId}`);
    const { error } = await supabase
      .from('community_memberships')
      .update({ prediction_unlocks: {}, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('community_id', communityId);
    setAdminNotice(error
      ? { type: 'error', text: `No se pudieron limpiar las reaperturas: ${error.message}` }
      : { type: 'ok', text: 'Reaperturas individuales limpiadas para ese usuario.' });
    await refresh();
    setBusy(null);
  }

  async function syncFifa() {
    setAdminNotice(null);
    setBusy('sync');
    const { data, error } = await supabase.functions.invoke<{ ok: boolean; matches?: number }>('sync-fifa-matches');
    const summary = await loadResultSummary();
    setAdminNotice(error
      ? { type: 'error', text: `No se pudo sincronizar FIFA: ${error.message}` }
      : buildRecalculateNotice('Calendario y resultados sincronizados', summary, data?.matches));
    await refresh();
    setBusy(null);
  }

  async function recalculate(syncFirst = false) {
    setAdminNotice(null);
    setBusy('recalculate');
    let syncError = '';
    let syncedMatches: number | undefined;
    if (syncFirst) {
      const { data, error } = await supabase.functions.invoke<{ ok: boolean; matches?: number }>('sync-fifa-matches');
      syncError = error?.message || '';
      syncedMatches = data?.matches;
    }
    const { error } = await supabase.rpc('recalculate_points');
    const summary = await loadResultSummary();
    setAdminNotice(error
      ? { type: 'error', text: `Error al calcular puntos: ${error.message}` }
      : syncError
        ? { type: 'warning', text: `Puntos recalculados con los datos ya guardados, pero FIFA no respondió ahora mismo: ${syncError}` }
        : buildRecalculateNotice('Puntos recalculados correctamente', summary, syncedMatches));
    await refresh();
    setBusy(null);
  }

  async function loadResultSummary(): Promise<ResultSummary> {
    const [{ count: finishedMatches }, { data: goalRows }] = await Promise.all([
      supabase.from('matches').select('id', { count: 'exact', head: true }).eq('status', 'finished'),
      supabase.from('player_goals').select('goals').gt('goals', 0),
    ]);

    return {
      finishedMatches: finishedMatches || 0,
      totalGoals: (goalRows || []).reduce((sum, row) => sum + (Number(row.goals) || 0), 0),
    };
  }

  function buildRecalculateNotice(prefix: string, summary: ResultSummary, syncedMatches?: number): AdminNotice {
    const syncText = syncedMatches ? ` FIFA ha devuelto ${syncedMatches} partidos.` : '';
    if (summary.finishedMatches === 0) {
      return {
        type: 'ok',
        text: `${prefix}.${syncText} Todavía no hay partidos finalizados ni goleadores oficiales; es normal antes del primer partido del 11 de junio de 2026. Los pronósticos están guardados y el ranking se actualizará cuando entren resultados reales.`,
      };
    }
    if (summary.totalGoals === 0) {
      return {
        type: 'ok',
        text: `${prefix}.${syncText} Hay ${summary.finishedMatches} partido(s) finalizado(s), pero aún no hay goleadores oficiales registrados. El ranking de goleador se moverá en cuanto FIFA publique eventos de gol o los valides manualmente.`,
      };
    }
    return {
      type: 'ok',
      text: `${prefix}.${syncText} Datos actuales: ${summary.finishedMatches} partido(s) finalizado(s) y ${summary.totalGoals} gol(es) oficiales registrados.`,
    };
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
    await recalculate(false);
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
    await recalculate(false);
    setBusy(null);
  }

  async function saveCommunitySettings() {
    if (!settings) return;
    await persistCommunitySettings(settings);
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
          <p className="text-brand-zinc-500 text-xs font-bold uppercase tracking-widest mt-2">
            Usuarios, calendario, resultados y ranking de {community.name}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <AdminButton onClick={syncFifa} busy={busy === 'sync'} icon={RefreshCw}>Sincronizar FIFA</AdminButton>
          <AdminButton onClick={() => recalculate(true)} busy={busy === 'recalculate'} icon={CheckCircle2}>Actualizar y recalcular</AdminButton>
        </div>
      </div>

      {adminNotice && (
        <div className={`rounded-2xl border p-4 text-sm flex items-start gap-3 ${
          adminNotice.type === 'ok'
            ? 'border-emerald-400/25 bg-emerald-500/10 text-emerald-100'
            : adminNotice.type === 'warning'
              ? 'border-amber-300/30 bg-amber-400/10 text-amber-100'
              : 'border-red-400/25 bg-red-500/10 text-red-100'
        }`}>
          {adminNotice.type === 'ok'
            ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
            : <AlertCircle className={`mt-0.5 h-5 w-5 shrink-0 ${adminNotice.type === 'warning' ? 'text-amber-200' : 'text-red-300'}`} />}
          <p>{adminNotice.text}</p>
        </div>
      )}

      {loadError && (
        <div className="rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-100 flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-300" />
          <div>
            <p className="font-black uppercase tracking-widest text-[10px] text-red-200">No se pudieron cargar todos los datos de admin</p>
            <p className="mt-1 text-red-100/80">{loadError}</p>
          </div>
        </div>
      )}

      <section className="dimension-card-accent p-6">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          <div>
            <h2 className="text-lg font-black uppercase tracking-tighter italic mb-2 flex items-center gap-3">
              <CalendarClock className="w-5 h-5 text-brand-gold" /> Bloqueos y reaperturas
            </h2>
            <p className="text-sm text-brand-zinc-400 max-w-3xl">
              Gestiona cuándo se puede editar cada parte del juego. Por defecto se mantienen los cierres oficiales; si reabres algo, los pronósticos afectados vuelven a quedar ocultos para rivales hasta el nuevo cierre.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <AdminButton onClick={() => extendCommunityDeadline('scorer', 3)} busy={busy === 'settings'} icon={LockOpen}>Abrir goleador 3h</AdminButton>
            <AdminButton onClick={() => closeCommunityDeadline('scorer')} busy={busy === 'settings'} icon={TimerReset}>Cerrar goleador</AdminButton>
            <AdminButton onClick={resetCommunityDeadlines} busy={busy === 'settings'} icon={RotateCcw}>Restaurar</AdminButton>
          </div>
        </div>

        {settings && (
          <div className="mt-6 space-y-5">
            <div className="grid md:grid-cols-3 gap-4">
              <DeadlineControl
                label="Grupos y clasificados"
                value={settings.groups_deadline_at || getPhaseDeadline('groups', settings)}
                fallback={getPhaseDeadline('groups', null)}
                onChange={(value) => updateDeadlineField('groups', value)}
              />
              <DeadlineControl
                label="Goleador"
                value={settings.scorer_deadline_at || getPhaseDeadline('scorer', settings)}
                fallback={getPhaseDeadline('scorer', null)}
                onChange={(value) => updateDeadlineField('scorer', value)}
              />
              <DeadlineControl
                label="Eliminatoria"
                value={settings.knockout_deadline_at || getPhaseDeadline('knockout', settings)}
                fallback={getPhaseDeadline('knockout', null)}
                onChange={(value) => updateDeadlineField('knockout', value)}
              />
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs text-brand-zinc-400">
                Si editas una fecha manualmente, pulsa guardar. Para una excepción puntual, usa los botones de reapertura en cada usuario.
              </p>
              <button onClick={saveCommunitySettings} disabled={busy === 'settings'} className="dimension-button-primary px-6 flex items-center justify-center gap-2">
                {busy === 'settings' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Guardar plazos
              </button>
            </div>
          </div>
        )}
      </section>

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
          <div>
            <h2 className="text-lg font-black uppercase tracking-tighter italic flex items-center gap-3"><UserCheck className="w-5 h-5 text-brand-gold" /> Usuarios</h2>
            <p className="mt-1 text-xs text-brand-zinc-500">Revisando altas de {community.name}. Cambia la comunidad arriba para validar otro grupo.</p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-brand-gold/20 bg-brand-gold/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-brand-gold">
            <Mail className="w-3 h-3" /> {pendingMembers.length} pendientes
          </div>
        </div>
        {pendingMembers.length > 0 && (
          <div className="mb-5 rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4">
            <p className="text-xs font-black uppercase tracking-widest text-amber-100 mb-3">Validación rápida</p>
            <div className="grid gap-2">
              {pendingMembers.map((row) => (
                <MemberRow
                  key={`${row.user_id}-${row.community_id}`}
                  row={row}
                  busy={busy === row.user_id || busy === `unlock-${row.user_id}`}
                  onUpdate={updateProfileStatus}
                  onExtendUnlock={extendMemberUnlock}
                  onClearUnlocks={clearMemberUnlocks}
                  highlight
                />
              ))}
            </div>
          </div>
        )}
        {pendingMembers.length === 0 && (
          <div className="mb-5 rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-4 text-sm text-emerald-100">
            No hay usuarios pendientes en {community.name}. Si alguien se registró en otra comunidad, selecciónala en el desplegable superior.
          </div>
        )}
        <div className="grid gap-3">
          {approvedMembers.map((row) => (
            <MemberRow
              key={`${row.user_id}-${row.community_id}`}
              row={row}
              busy={busy === row.user_id || busy === `unlock-${row.user_id}`}
              onUpdate={updateProfileStatus}
              onExtendUnlock={extendMemberUnlock}
              onClearUnlocks={clearMemberUnlocks}
            />
          ))}
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

function DeadlineControl({
  label,
  value,
  fallback,
  onChange,
}: {
  label: string;
  value: string;
  fallback: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-2">
      <span className="text-[9px] font-black uppercase tracking-widest text-brand-zinc-500">{label}</span>
      <input
        type="datetime-local"
        value={toDateTimeLocalValue(value)}
        onChange={(event) => onChange(event.target.value)}
        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-gold"
      />
      <span className="block text-[10px] text-brand-zinc-500">Por defecto: {toDateTimeLocalValue(fallback).replace('T', ' ')}</span>
    </label>
  );
}

function MemberRow({
  row,
  busy,
  onUpdate,
  onExtendUnlock,
  onClearUnlocks,
  highlight = false,
}: {
  row: AdminMember;
  busy: boolean;
  onUpdate: (id: string, status: Profile['status']) => void;
  onExtendUnlock: (id: string, phase: PredictionPhase, hours?: number) => void;
  onClearUnlocks: (id: string) => void;
  highlight?: boolean;
}) {
  const hasUnlocks = Boolean(
    row.prediction_unlocks?.groups_until ||
    row.prediction_unlocks?.scorer_until ||
    row.prediction_unlocks?.knockout_until,
  );

  return (
    <div className={`grid md:grid-cols-[1fr_120px_auto] gap-3 items-center rounded-xl border p-4 ${highlight ? 'border-amber-300/20 bg-black/20' : 'border-white/10 bg-white/[0.03]'}`}>
      <div>
        <p className="text-sm font-black uppercase">{row.profiles?.username || row.profiles?.email}</p>
        <p className="text-xs text-brand-zinc-500">{row.profiles?.email}</p>
        {hasUnlocks && (
          <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-brand-gold">
            Tiene reapertura activa
          </p>
        )}
      </div>
      <span className="text-[10px] font-black uppercase tracking-widest text-brand-gold">{row.status}</span>
      <div className="flex gap-2">
        <button onClick={() => onUpdate(row.user_id, 'approved')} disabled={busy} className="px-3 py-2 rounded-lg bg-emerald-500/20 text-emerald-300 text-[10px] font-black uppercase">Aprobar</button>
        <button onClick={() => onUpdate(row.user_id, 'blocked')} disabled={busy} className="px-3 py-2 rounded-lg bg-red-500/20 text-red-300 text-[10px] font-black uppercase">Bloquear</button>
      </div>
      <div className="md:col-span-3 flex flex-wrap gap-2 border-t border-white/10 pt-3">
        <button onClick={() => onExtendUnlock(row.user_id, 'scorer', 3)} disabled={busy} className="px-3 py-2 rounded-lg bg-brand-gold/10 text-brand-gold border border-brand-gold/20 text-[10px] font-black uppercase">Goleador +3h</button>
        <button onClick={() => onExtendUnlock(row.user_id, 'groups', 3)} disabled={busy} className="px-3 py-2 rounded-lg bg-white/5 text-brand-zinc-300 border border-white/10 text-[10px] font-black uppercase">Grupos +3h</button>
        <button onClick={() => onExtendUnlock(row.user_id, 'knockout', 3)} disabled={busy} className="px-3 py-2 rounded-lg bg-white/5 text-brand-zinc-300 border border-white/10 text-[10px] font-black uppercase">KO +3h</button>
        <button onClick={() => onClearUnlocks(row.user_id)} disabled={busy || !hasUnlocks} className="px-3 py-2 rounded-lg bg-black/20 text-brand-zinc-400 border border-white/10 text-[10px] font-black uppercase disabled:opacity-40">Limpiar</button>
      </div>
    </div>
  );
}
