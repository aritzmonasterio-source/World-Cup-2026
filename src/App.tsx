import { useEffect, useMemo, useState } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { Calendar, Medal, LayoutDashboard, Shield, Swords, Table, Trophy, User, Users } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import Admin from './components/Admin';
import AuthModal from './components/AuthModal';
import Bracket from './components/Bracket';
import Dashboard from './components/Dashboard';
import Live from './components/Live';
import Others from './components/Others';
import Predictions from './components/Predictions';
import Ranking from './components/Ranking';
import Standings from './components/Standings';
import { canPlay, isAdmin, isSupabaseConfigured, profileStatusLabel, supabase } from './lib/supabase';
import { COMMUNITIES, DEFAULT_COMMUNITY_ID, NEUTRAL_THEME, WORLD_CUP_LOGO_URL, getCommunity, getCommunityThemeStyle, type CommunityId } from './lib/communities';
import type { CommunityMembership, Profile } from './lib/types';

export default function App() {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showAuth, setShowAuth] = useState(false);
  const [authRecoveryMode, setAuthRecoveryMode] = useState(false);
  const [selectedCommunityId, setSelectedCommunityId] = useState<CommunityId>(() => {
    const stored = window.localStorage.getItem('wc26_selected_community') as CommunityId | null;
    return stored || DEFAULT_COMMUNITY_ID;
  });
  const selectedCommunity = getCommunity(selectedCommunityId);
  const activeTheme = user ? selectedCommunity : NEUTRAL_THEME;
  const showingNeutralWorldLogo = !user;

  const changeCommunity = (communityId: CommunityId) => {
    window.localStorage.setItem('wc26_selected_community', communityId);
    setSelectedCommunityId(communityId);
  };

  useEffect(() => {
    let mounted = true;
    const startupTimer = window.setTimeout(() => {
      if (mounted) setLoading(false);
    }, 4500);

    async function loadProfile(currentUser: SupabaseUser | null) {
      if (!currentUser || !isSupabaseConfigured) {
        if (mounted) {
          setUser(currentUser);
          setProfile(null);
          setLoading(false);
          window.clearTimeout(startupTimer);
        }
        return;
      }

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .maybeSingle();

      const baseProfile = data as Profile | null;
      let membership: CommunityMembership | null = null;

      if (baseProfile) {
        const { data: membershipRow } = await supabase
          .from('community_memberships')
          .select('*')
          .eq('user_id', currentUser.id)
          .eq('community_id', selectedCommunityId)
          .maybeSingle();

        membership = membershipRow as CommunityMembership | null;

        if (!membership) {
          const adminUser = isAdmin(baseProfile, currentUser.email);
          const { data: createdMembership } = await supabase
            .from('community_memberships')
            .upsert({
              user_id: currentUser.id,
              community_id: selectedCommunityId,
              role: adminUser ? 'admin' : 'player',
              status: adminUser ? 'approved' : 'pending',
              updated_at: new Date().toISOString(),
            }, { onConflict: 'user_id,community_id' })
            .select('*')
            .maybeSingle();

          membership = createdMembership as CommunityMembership | null;
        }
      }

      const effectiveProfile = baseProfile ? {
        ...baseProfile,
        community_id: selectedCommunityId,
        role: membership?.role || baseProfile.role,
        status: membership?.status || (isAdmin(baseProfile, currentUser.email) ? 'approved' : 'pending'),
        total_points: membership?.total_points || 0,
        points_groups: membership?.points_groups || 0,
        points_knockout: membership?.points_knockout || 0,
        points_scorer: membership?.points_scorer || 0,
        points_qualified: membership?.points_qualified || 0,
      } as Profile : null;

      if (mounted) {
        setUser(currentUser);
        setProfile(effectiveProfile);
        setLoading(false);
        window.clearTimeout(startupTimer);
      }
    }

    supabase.auth.getUser().then(({ data }) => loadProfile(data.user)).catch(() => loadProfile(null));
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setAuthRecoveryMode(true);
        setShowAuth(true);
      }
      loadProfile(session?.user || null);
    });

    return () => {
      mounted = false;
      window.clearTimeout(startupTimer);
      listener.subscription.unsubscribe();
    };
  }, [selectedCommunityId]);

  const admin = isAdmin(profile, user?.email);
  const approved = canPlay(profile, user?.email);

  const tabs = useMemo(() => {
    const base = [
      { id: 'dashboard', label: 'Inicio', icon: LayoutDashboard },
      { id: 'predictions', label: 'Previsión', icon: Calendar },
      { id: 'ranking', label: 'Ranking', icon: Trophy },
      { id: 'live', label: 'Goleadores', icon: Medal },
      { id: 'bracket', label: 'Cuadro', icon: Swords },
      { id: 'standings', label: 'Grupos', icon: Table },
      { id: 'others', label: 'Otros', icon: Users },
    ];
    return admin ? [...base, { id: 'admin', label: 'Admin', icon: Shield }] : base;
  }, [admin]);

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-brand-gray">
        <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.5 }} className="flex flex-col items-center gap-6">
          <div className="w-20 h-20 rounded-2xl border border-brand-gold/30 bg-brand-gold/10 flex items-center justify-center">
            <Trophy className="w-10 h-10 text-brand-gold" />
          </div>
          <span className="text-brand-gold text-[10px] font-black uppercase tracking-[0.5em]">Iniciando juego...</span>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-x-hidden pb-[5.75rem] sm:pb-24 bg-brand-gray" style={getCommunityThemeStyle(activeTheme)}>
      <header className="fixed top-0 w-full bg-brand-gray/95 backdrop-blur-xl border-b border-brand-gold/10 z-40">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 h-18 sm:h-20 flex items-center justify-between gap-2">
          <button onClick={() => setActiveTab('dashboard')} className="flex items-center gap-4 text-left">
            <div className={`h-11 w-11 sm:h-14 sm:w-14 rounded-xl border border-brand-gold/20 flex items-center justify-center overflow-hidden shadow-[0_0_30px_rgba(174,156,80,0.2)] ${showingNeutralWorldLogo ? 'bg-white/90 p-1.5' : 'bg-black/20'}`}>
              {activeTheme.logoUrl ? (
                <img src={activeTheme.logoUrl} alt={activeTheme.name} className="h-full w-auto object-contain" />
              ) : (
                <span className="text-lg font-black text-brand-gold tracking-tighter">{user ? selectedCommunity.logoText : NEUTRAL_THEME.logoText}</span>
              )}
            </div>
            <div className="hidden md:block">
              <h1 className="text-lg font-black uppercase tracking-tighter leading-none text-white">Mundial 2026</h1>
              <p className="text-[10px] text-brand-gold uppercase tracking-widest mt-1 font-black">{user ? selectedCommunity.name : 'Acceso neutral'}</p>
            </div>
          </button>

          <div className="flex min-w-0 items-center gap-2 sm:gap-4">
            <select
              value={selectedCommunityId}
              onChange={(event) => changeCommunity(event.target.value as CommunityId)}
              className="max-w-[124px] sm:max-w-none bg-black/30 border border-brand-gold/20 rounded-lg px-2 sm:px-3 py-2 text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-white outline-none focus:border-brand-gold"
            >
              {COMMUNITIES.map((community) => (
                <option key={community.id} value={community.id}>{community.name}</option>
              ))}
            </select>

            {user && (
              <div className="hidden lg:flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-black/20 overflow-hidden">
                <img src={WORLD_CUP_LOGO_URL} alt="Mundial 2026" className="h-9 w-auto object-contain rounded-lg bg-white/90 p-1" />
              </div>
            )}

            {user && (
              <div className="text-right hidden sm:block">
                <p className="text-[10px] uppercase text-brand-zinc-400 font-bold tracking-wider">{profileStatusLabel(profile)}</p>
                <p className="text-xl font-mono font-bold text-brand-gold tabular-nums">
                  {profile?.total_points || 0} <span className="text-xs">PTS</span>
                </p>
              </div>
            )}

            {user ? (
              <div className="flex items-center gap-3">
                <div className={`hidden md:block rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-widest ${approved ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'}`}>
                  {approved ? 'Aprobado' : 'Pendiente'}
                </div>
                <button
                  onClick={() => supabase.auth.signOut()}
                  className="flex items-center gap-3 bg-brand-gold/5 border border-brand-gold/10 px-3 py-1.5 rounded-full hover:border-brand-gold/30 transition-all"
                >
                  <div className="w-8 h-8 rounded-full bg-brand-zinc-800 border border-brand-gold/20 flex items-center justify-center">
                    <User className="w-4 h-4 text-brand-gold" />
                  </div>
                  <span className="text-xs font-black uppercase tracking-wide hidden sm:block text-white">{profile?.username || user.email}</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowAuth(true)}
                className="shrink-0 bg-brand-gold text-black px-3 sm:px-6 py-2 rounded font-black text-[10px] sm:text-xs uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all"
              >
                Entrar
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-3 sm:px-6 pt-24 sm:pt-28 pb-10 sm:pb-12">
        {!isSupabaseConfigured && (
          <div className="mb-8 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-5 text-sm text-amber-100">
            Falta configurar Supabase. Crea `.env.local` con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` para activar login, datos y ranking.
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'dashboard' && <Dashboard user={user} profile={profile} community={user ? selectedCommunity : NEUTRAL_THEME} communityId={selectedCommunityId} setActiveTab={setActiveTab} setShowAuth={setShowAuth} />}
            {activeTab === 'predictions' && <Predictions user={user} profile={profile} communityId={selectedCommunityId} setShowAuth={setShowAuth} />}
            {activeTab === 'ranking' && <Ranking user={user} profile={profile} communityId={selectedCommunityId} />}
            {activeTab === 'standings' && <Standings />}
            {activeTab === 'bracket' && <Bracket />}
            {activeTab === 'live' && <Live />}
            {activeTab === 'others' && <Others user={user} profile={profile} />}
            {activeTab === 'admin' && <Admin user={user} profile={profile} communityId={selectedCommunityId} />}
          </motion.div>
        </AnimatePresence>
      </main>

      <div className="fixed bottom-14 sm:bottom-20 left-0 right-0 z-30 pointer-events-none">
        <p className="text-center text-[9px] font-black uppercase tracking-[0.28em] text-brand-zinc-500/80 py-2">
          Created By Aritz MR ®
        </p>
      </div>

      <nav className="fixed bottom-0 w-full bg-brand-gray/95 border-t border-brand-gold/10 z-40 backdrop-blur-lg">
        <div className="max-w-5xl mx-auto grid grid-flow-col auto-cols-fr items-center h-14 sm:h-20 overflow-hidden px-1 sm:px-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex min-w-0 flex-col items-center gap-1 sm:gap-1.5 transition-all h-full justify-center relative ${
                activeTab === tab.id ? 'text-brand-gold' : 'text-brand-zinc-500 hover:text-white'
              }`}
            >
              <tab.icon className={`w-4 h-4 sm:w-6 sm:h-6 ${activeTab === tab.id ? 'scale-110 drop-shadow-[0_0_8px_rgba(209,178,0,0.4)]' : ''}`} />
              <span className={`max-w-full truncate text-[6.5px] sm:text-[9px] font-bold uppercase tracking-[0.04em] sm:tracking-[0.15em] ${activeTab === tab.id ? 'opacity-100' : 'opacity-60'}`}>
                {tab.label}
              </span>
              {activeTab === tab.id && <motion.div layoutId="activeTab" className="absolute bottom-0 w-8 h-0.5 bg-brand-gold rounded-full" />}
            </button>
          ))}
        </div>
      </nav>

      <AuthModal
        isOpen={showAuth}
        selectedCommunityId={selectedCommunityId}
        forcePasswordRecovery={authRecoveryMode}
        onCommunityChange={changeCommunity}
        onRecoveryComplete={() => setAuthRecoveryMode(false)}
        onClose={() => {
          setShowAuth(false);
          setAuthRecoveryMode(false);
        }}
      />
    </div>
  );
}
