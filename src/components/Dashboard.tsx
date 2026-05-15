import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { AlertCircle, CalendarCheck, CheckCircle2, ChevronRight, Download, EyeOff, Info, Lock, Medal, Share, Sparkles, Target, Trophy, UserCheck } from 'lucide-react';
import type { CommunitySettings, Profile } from '../lib/types';
import { DIMENSION_LOGO_URL, POINTS, formatDateTime, GROUP_DEADLINE_ISO, KNOCKOUT_DEADLINE_ISO } from '../lib/constants';
import { canPlay, profileStatusLabel, supabase } from '../lib/supabase';
import type { CommunityId, CommunityTheme } from '../lib/communities';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

function getMobileInstallState() {
  const ua = window.navigator.userAgent.toLowerCase();
  const isIos = /iphone|ipad|ipod/.test(ua);
  const isAndroid = /android/.test(ua);
  const isMobile = isIos || isAndroid || window.matchMedia('(max-width: 767px)').matches;
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

  return { isIos, isAndroid, isMobile, isStandalone };
}

export default function Dashboard({
  user,
  profile,
  community,
  communityId,
  setActiveTab,
  setShowAuth,
}: {
  user: User | null;
  profile: Profile | null;
  community: CommunityTheme;
  communityId: CommunityId;
  setActiveTab: (tab: string) => void;
  setShowAuth: (open: boolean) => void;
}) {
  const [showTutorial, setShowTutorial] = useState(false);
  const [settings, setSettings] = useState<CommunitySettings | null>(null);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installState, setInstallState] = useState(() => getMobileInstallState());
  const approved = canPlay(profile, user?.email);

  useEffect(() => {
    if (!window.localStorage.getItem('wc26_tutorial_seen')) {
      setShowTutorial(true);
    }
  }, []);

  useEffect(() => {
    const updateInstallState = () => setInstallState(getMobileInstallState());
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
      updateInstallState();
    };
    const handleInstalled = () => {
      setInstallPrompt(null);
      updateInstallState();
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);
    window.addEventListener('resize', updateInstallState);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
      window.removeEventListener('resize', updateInstallState);
    };
  }, []);

  useEffect(() => {
    supabase
      .from('community_settings')
      .select('*')
      .eq('community_id', communityId)
      .maybeSingle()
      .then(({ data }) => setSettings((data as CommunitySettings | null) || null));
  }, [communityId]);

  const closeTutorial = () => {
    window.localStorage.setItem('wc26_tutorial_seen', '1');
    setShowTutorial(false);
  };

  const installApp = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  return (
    <div className="space-y-10">
      {showTutorial && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6">
          <div className="dimension-card-accent max-w-2xl w-full max-h-[calc(100dvh-1.5rem)] overflow-y-auto p-4 sm:p-8">
            <div className="sticky top-0 z-10 -mx-4 -mt-4 sm:-mx-8 sm:-mt-8 mb-5 sm:mb-8 flex items-start justify-between gap-4 border-b border-white/10 bg-brand-gray/95 px-4 py-4 sm:px-8 sm:py-6 backdrop-blur-xl">
              <div>
                <div className="flex items-center gap-3 text-brand-gold mb-3">
                  <Sparkles className="w-5 h-5" />
                  <span className="text-[10px] font-black uppercase tracking-[0.3em]">Micro tutorial</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tighter italic leading-none">Empieza en 4 pasos</h2>
              </div>
              <button onClick={closeTutorial} className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-brand-zinc-300 hover:text-white">
                Cerrar
              </button>
            </div>
            <div className="grid sm:grid-cols-2 gap-3 sm:gap-4 mb-6 sm:mb-8">
              <TutorialStep n="1" title="Crea cuenta" text="Regístrate con email y contraseña. Recibirás confirmación por email." />
              <TutorialStep n="2" title="Explora el calendario" text="Sin registrarte puedes consultar partidos, horarios y banderas." />
              <TutorialStep n="3" title="Completa tus fases" text="Primero grupos y goleador. Después finalistas y cuadro eliminatorio." />
              <TutorialStep n="4" title="Sigue el ranking" text="Los puntos se actualizan con resultados, goles y clasificaciones." />
            </div>
            <div className="grid grid-cols-1 sm:flex sm:flex-wrap gap-3">
              <button onClick={() => { closeTutorial(); setActiveTab('predictions'); }} className="dimension-button-primary px-6 flex items-center gap-2">
                Ver calendario <ChevronRight className="w-4 h-4" />
              </button>
              <button onClick={() => { closeTutorial(); setActiveTab('ranking'); }} className="px-6 py-4 rounded-lg bg-white/5 border border-white/10 text-xs font-black uppercase tracking-widest hover:border-brand-gold/30">
                Ver ranking
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="dimension-card-accent p-8 sm:p-10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-gold/5 rounded-full blur-3xl -mr-32 -mt-16" />
        <div className="relative z-10 max-w-3xl">
          {community.logoUrl ? (
            <img src={community.logoUrl || DIMENSION_LOGO_URL} alt={community.name} className={`h-20 w-auto object-contain mb-6 rounded-2xl ${community.name === 'Mundial 2026' ? 'bg-white/90 p-3 shadow-lg' : ''}`} />
          ) : (
            <div className="h-20 w-20 rounded-2xl bg-brand-gold text-black flex items-center justify-center font-black text-2xl mb-6 shadow-lg shadow-brand-gold/20">{community.logoText}</div>
          )}
          <h2 className="text-4xl sm:text-6xl font-black uppercase tracking-tighter mb-6 leading-none">
            {community.name === 'Mundial 2026' ? (
              <>Mundial <span className="text-brand-gold">2026</span></>
            ) : (
              <>{community.shortName} <span className="text-brand-gold">Mundial</span></>
            )}
          </h2>
          <p className="text-brand-zinc-400 text-sm sm:text-lg max-w-2xl leading-relaxed mb-8">
            Pronostica los 104 partidos reales del Mundial, elige tu goleador, acierta clasificados y compite en una clasificación actualizada con resultados oficiales.
          </p>

          <div className="flex flex-wrap gap-4">
            <button onClick={() => setActiveTab('predictions')} className="dimension-button-primary px-8 flex items-center gap-3 group">
              Ver calendario
              <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            {!user && (
              <button onClick={() => setShowAuth(true)} className="px-8 py-4 rounded-lg bg-white/5 border border-white/10 text-xs font-black uppercase tracking-widest hover:border-brand-gold/30 transition-all">
                Crear cuenta
              </button>
            )}
            <button onClick={() => setShowTutorial(true)} className="px-8 py-4 rounded-lg bg-white/5 border border-white/10 text-xs font-black uppercase tracking-widest hover:border-brand-gold/30 transition-all">
              Ver tutorial
            </button>
          </div>
        </div>
      </div>

      {installState.isMobile && !installState.isStandalone && (
        <InstallAppCard
          isIos={installState.isIos}
          isAndroid={installState.isAndroid}
          canPrompt={Boolean(installPrompt)}
          onInstall={installApp}
        />
      )}

      {user && (
        <div className={`rounded-2xl border p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${approved ? 'border-emerald-500/20 bg-emerald-500/10' : 'border-amber-500/20 bg-amber-500/10'}`}>
          <div className="flex items-start gap-4">
            {approved ? <UserCheck className="w-6 h-6 text-emerald-400 mt-1" /> : <AlertCircle className="w-6 h-6 text-amber-300 mt-1" />}
            <div>
              <p className="text-sm font-black uppercase tracking-widest">{profileStatusLabel(profile)}</p>
              <p className="text-sm text-brand-zinc-300 mt-1">
                {approved ? 'Puedes guardar pronósticos y competir en el ranking.' : 'Tu cuenta está pendiente de aprobación para competir oficialmente.'}
              </p>
            </div>
          </div>
          <span className="font-mono text-2xl font-black text-brand-gold">{profile?.total_points || 0} PTS</span>
        </div>
      )}

      <section className="grid grid-cols-1 lg:grid-cols-[1fr_0.9fr] gap-8">
        <div className="dimension-card p-8 border-brand-gold/10 bg-brand-gold/5">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-1.5 h-6 bg-brand-gold rounded-full" />
            <h3 className="text-sm uppercase tracking-[0.2em] text-white font-black italic">Sistema de puntos</h3>
          </div>
          <ul className="space-y-4">
            <RuleItem points={POINTS.exactScore} label="Resultado exacto" text="Clavas el marcador final que puntúa en el juego." />
            <RuleItem points={POINTS.outcome} label="Ganador o empate" text="Aciertas el signo, aunque no el marcador exacto." />
            <RuleItem points={POINTS.scorerGoal} label="Gol de tu goleador" text="Cada gol oficial de tu jugador elegido suma puntos." />
            <RuleItem points={POINTS.groupExactPosition} label="Puesto exacto de grupo" text="Cada equipo situado en su puesto final exacto suma." />
            <RuleItem points={POINTS.groupQualified} label="Clasificado acertado" text="Si un equipo entra en puestos de clasificación, aunque falle el puesto exacto, suma." />
            <RuleItem points={POINTS.knockoutTeam} label="Equipo en eliminatoria" text="Cada equipo acertado suma si el cruce previsto coincide con el real." />
            <RuleItem points={POINTS.finalistExactPosition} label="Puesto exacto finalista" text="Aciertas campeón, segundo, tercero o cuarto en su puesto exacto." />
            <RuleItem points={POINTS.finalistQualified} label="Finalista acertado" text="Aciertas una de las cuatro selecciones finales, aunque falle el puesto." />
          </ul>
        </div>

        <div className="dimension-card p-8 border-brand-gold/10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-1.5 h-6 bg-brand-gold rounded-full" />
            <h3 className="text-sm uppercase tracking-[0.2em] text-white font-black italic">Fechas límite</h3>
          </div>
          <div className="space-y-4">
            <DeadlineItem icon={CalendarCheck} label="Grupos, clasificados y goleador" date={formatDateTime(GROUP_DEADLINE_ISO)} />
            <DeadlineItem icon={Lock} label="Toda la fase eliminatoria" date={formatDateTime(KNOCKOUT_DEADLINE_ISO)} />
            <DeadlineItem icon={Target} label="Cruces por prever" date="Pronostica desde dieciseisavos hasta la final aunque aún sean TBD" />
          </div>
        </div>
      </section>

      {settings && (
        <section className="dimension-card-accent p-6 grid lg:grid-cols-[1fr_auto] gap-5 items-center">
          <div>
            <h3 className="text-sm uppercase tracking-[0.2em] text-white font-black italic mb-2">Premios y participación</h3>
            <p className="text-sm text-brand-zinc-400">
              Pago por jugador: <span className="text-brand-gold font-black">{settings.entry_fee_eur || 0}€</span> por Bizum a <span className="text-white font-black">{settings.bizum_recipient || 'Aritz'}</span>.
              {settings.notes ? ` ${settings.notes}` : ''}
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
            <PrizeBadge label="1ª fase" value={settings.prize_distribution.phase1Champion} />
            <PrizeBadge label="2ª fase" value={settings.prize_distribution.phase2Champion} />
            <PrizeBadge label="Global" value={settings.prize_distribution.globalChampion} />
            <PrizeBadge label="Segundo" value={settings.prize_distribution.globalRunnerUp} />
            <PrizeBadge label="Tercero" value={settings.prize_distribution.globalThird} />
          </div>
        </section>
      )}

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <NormCard icon={EyeOff} title="Privacidad" text="Los pronósticos de otros jugadores se revelan cuando ya no se pueden editar." />
        <NormCard icon={CheckCircle2} title="Edición" text="Puedes cambiar grupos hasta el 9 de junio y el cuadro de eliminatorias hasta el 28 de junio." />
        <NormCard icon={Medal} title="Ranking" text="La clasificación se recalcula tras cada resultado o corrección del admin." />
        <NormCard icon={Info} title="Fiabilidad" text="El calendario y resultados se sincronizan desde la API oficial de FIFA y quedan guardados." />
      </section>
    </div>
  );
}

function PrizeBadge({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3">
      <p className="text-[9px] font-black uppercase tracking-widest text-brand-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-black text-brand-gold">{value}%</p>
    </div>
  );
}

function TutorialStep({ n, title, text }: { n: string; title: string; text: string }) {
  return (
    <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-4 sm:p-5">
      <div className="w-8 h-8 rounded-lg bg-brand-gold text-black flex items-center justify-center font-black mb-3 sm:mb-4">{n}</div>
      <h3 className="text-xs sm:text-sm font-black uppercase tracking-widest mb-2">{title}</h3>
      <p className="text-xs sm:text-sm text-brand-zinc-400 leading-relaxed">{text}</p>
    </div>
  );
}

function InstallAppCard({
  isIos,
  isAndroid,
  canPrompt,
  onInstall,
}: {
  isIos: boolean;
  isAndroid: boolean;
  canPrompt: boolean;
  onInstall: () => void;
}) {
  const [showSteps, setShowSteps] = useState(false);

  return (
    <section className="dimension-card-accent p-5 sm:hidden">
      <div className="flex items-start gap-4">
        <div className="h-12 w-12 shrink-0 rounded-xl border border-brand-gold/20 bg-white p-1.5 shadow-lg">
          <img src="/icons/world-cup-2026-icon.png" alt="Mundial 2026" className="h-full w-full object-contain" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-brand-gold">
            <Download className="w-4 h-4" />
            <p className="text-[10px] font-black uppercase tracking-[0.22em]">Instalar webapp</p>
          </div>
          <h3 className="mt-1 text-sm font-black uppercase tracking-widest text-white">Mundial 2026 en tu móvil</h3>
          <p className="mt-2 text-xs leading-relaxed text-brand-zinc-400">
            Añádela a la pantalla de inicio para abrirla como app, con el logo del Mundial y sin buscar la URL cada vez.
          </p>
        </div>
      </div>

      {canPrompt && isAndroid ? (
        <button onClick={onInstall} className="dimension-button-primary mt-4 w-full py-3 text-[11px] flex items-center justify-center gap-2">
          <Download className="w-4 h-4" /> Instalar en Android
        </button>
      ) : (
        <>
          <button onClick={() => setShowSteps((value) => !value)} className="dimension-button-primary mt-4 w-full py-3 text-[11px] flex items-center justify-center gap-2">
            <Download className="w-4 h-4" /> {showSteps ? 'Ocultar instrucciones' : 'Ver instrucciones'}
          </button>
          {showSteps && (
        <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
          {isIos ? (
            <div className="space-y-3 text-xs text-brand-zinc-300">
              <p className="flex gap-2"><Share className="mt-0.5 h-4 w-4 shrink-0 text-brand-gold" /> En Safari, toca Compartir.</p>
              <p>Elige <span className="font-black text-white">Añadir a pantalla de inicio</span>.</p>
              <p>Pulsa <span className="font-black text-white">Añadir</span> y quedará instalada como app.</p>
            </div>
          ) : (
            <div className="space-y-3 text-xs text-brand-zinc-300">
              <p>En Chrome, abre el menú de tres puntos.</p>
              <p>Elige <span className="font-black text-white">Instalar app</span> o <span className="font-black text-white">Añadir a pantalla de inicio</span>.</p>
              <p>{isAndroid ? 'Si aparece el botón nativo, úsalo arriba.' : 'En móvil compatible verás la opción de instalación.'}</p>
            </div>
          )}
        </div>
          )}
        </>
      )}
    </section>
  );
}

function RuleItem({ points, label, text }: { points: number; label: string; text: string }) {
  return (
    <li className="flex items-start justify-between gap-6 border-b border-white/5 pb-4">
      <div>
        <span className="text-sm font-semibold text-brand-zinc-300 uppercase tracking-wide">{label}</span>
        <p className="text-xs text-brand-zinc-500 mt-1">{text}</p>
      </div>
      <span className="font-mono font-bold text-brand-gold whitespace-nowrap">{points} PTS</span>
    </li>
  );
}

function DeadlineItem({ icon: Icon, label, date }: { icon: typeof CalendarCheck; label: string; date: string }) {
  return (
    <div className="flex items-center gap-4 rounded-xl bg-white/[0.03] border border-white/5 p-4">
      <div className="w-11 h-11 rounded-lg bg-brand-gold/10 border border-brand-gold/20 flex items-center justify-center">
        <Icon className="w-5 h-5 text-brand-gold" />
      </div>
      <div>
        <div className="text-sm font-bold uppercase tracking-wide">{label}</div>
        <div className="text-[10px] uppercase font-black tracking-widest text-brand-gold/70 mt-1">{date}</div>
      </div>
    </div>
  );
}

function NormCard({ icon: Icon, title, text }: { icon: typeof EyeOff; title: string; text: string }) {
  return (
    <div className="dimension-card-accent p-5">
      <Icon className="w-6 h-6 text-brand-gold mb-4" />
      <h3 className="text-xs font-black uppercase tracking-widest mb-2">{title}</h3>
      <p className="text-sm text-brand-zinc-400 leading-relaxed">{text}</p>
    </div>
  );
}
