import { useState, useEffect } from 'react';
import { auth, db, handleFirestoreError, OperationType } from './lib/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Trophy, Calendar, LayoutDashboard, Table, User, LogIn, Swords, Activity, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Dashboard from './components/Dashboard';
import Predictions from './components/Predictions';
import Ranking from './components/Ranking';
import Standings from './components/Standings';
import Bracket from './components/Bracket';
import AuthModal from './components/AuthModal';
import Live from './components/Live';
import Others from './components/Others';

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        setLoading(false); // Set loading false as soon as we have the user state, even if profile is still loading
        const docRef = doc(db, 'users', u.uid);
        try {
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setProfile(docSnap.data());
          } else {
            const newProfile = {
              username: u.displayName || u.email?.split('@')[0] || 'User',
              email: u.email,
              totalPoints: 0,
              pointsGroups: 0,
              pointsKnockout: 0,
              pointsScorer: 0,
              pointsQualifying: 0,
              pointsFinalists: 0,
            };
            await setDoc(docRef, newProfile);
            setProfile(newProfile);
          }
        } catch (error) {
          console.error("Profile fetch error:", error);
        }
      } else {
        setProfile(null);
        setLoading(false);
      }
    });
  }, []);

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-brand-gray">
        <motion.div
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="flex flex-col items-center gap-6"
        >
          <img 
            src="https://lh3.googleusercontent.com/d/1Vb1NUyxG41s1B_z5qBkqWtN4jQYi_ctk=s1000" 
            alt="Dimension Football" 
            className="w-40 h-auto"
          />
          <span className="text-brand-gold text-[10px] font-black uppercase tracking-[0.5em] animate-pulse">Iniciando Sistema...</span>
        </motion.div>
      </div>
    );
  }

  const tabs = [
    { id: 'dashboard', label: 'Inicio', icon: LayoutDashboard },
    { id: 'predictions', label: 'Previsión', icon: Calendar },
    { id: 'ranking', label: 'Ranking', icon: Trophy },
    { id: 'live', label: 'Directo', icon: Activity },
    { id: 'bracket', label: 'Cuadro', icon: Swords },
    { id: 'standings', label: 'Grupos', icon: Table },
    { id: 'others', label: 'Otros', icon: Users },
  ];

  return (
    <div className="min-h-screen pb-24 bg-brand-gray">
      {/* Header */}
      <header className="fixed top-0 w-full bg-brand-gray/95 backdrop-blur-xl border-b border-brand-gold/10 z-40">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img 
              src="https://lh3.googleusercontent.com/d/1Vb1NUyxG41s1B_z5qBkqWtN4jQYi_ctk=s1000" 
              alt="Logo" 
              className="h-14 w-auto cursor-pointer hover:scale-110 transition-transform"
              onClick={() => setActiveTab('dashboard')}
            />
            <div className="hidden md:block">
              <h1 className="text-lg font-black uppercase tracking-tighter leading-none text-white">Mundial 2026</h1>
              <p className="text-[10px] text-brand-gold uppercase tracking-widest mt-1 font-black">Dimension Football Elite</p>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            {user && (
              <div className="text-right hidden sm:block">
                <p className="text-[10px] uppercase text-brand-zinc-400 font-bold tracking-wider">Tu Puntuación</p>
                <p className="text-xl font-mono font-bold text-brand-gold tabular-nums">
                  {profile?.totalPoints || 0} <span className="text-xs">PTS</span>
                </p>
              </div>
            )}
            
            {user ? (
              <div className="flex items-center gap-3 bg-brand-gold/5 border border-brand-gold/10 px-3 py-1.5 rounded-full">
                <div className="w-8 h-8 rounded-full bg-brand-zinc-800 border border-brand-gold/20 flex items-center justify-center overflow-hidden">
                  <div className="w-full h-full bg-brand-gold/10 opacity-20"></div>
                  <User className="w-4 h-4 text-brand-gold absolute" />
                </div>
                <span className="text-xs font-black uppercase tracking-wide hidden sm:block text-white">{profile?.username}</span>
              </div>
            ) : (
              <button
                onClick={() => setShowAuth(true)}
                className="bg-brand-gold text-black px-6 py-2 rounded font-black text-xs uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all"
              >
                Entrar
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 pt-28 pb-12">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'dashboard' && <Dashboard setActiveTab={setActiveTab} />}
            {activeTab === 'predictions' && <Predictions user={{ ...user, ...profile }} setShowAuth={setShowAuth} />}
            {activeTab === 'ranking' && <Ranking user={{ ...user, ...profile }} />}
            {activeTab === 'standings' && <Standings />}
            {activeTab === 'bracket' && <Bracket />}
            {activeTab === 'live' && <Live />}
            {activeTab === 'others' && <Others />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Navigation - Sidebar for Desktop (handled via layout grid if we wanted, but we'll stick to a clean bottom nav for mobile and simplified layout for desktop) */}
      
      {/* Bottom Nav */}
      <nav className="fixed bottom-0 w-full bg-brand-gray/95 border-t border-brand-gold/10 pb-safe z-40 backdrop-blur-lg">
        <div className="max-w-4xl mx-auto flex justify-around items-center h-16 sm:h-20">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center gap-1.5 transition-all w-full h-full justify-center relative ${
                activeTab === tab.id ? 'text-brand-gold' : 'text-brand-zinc-500 hover:text-white'
              }`}
            >
              <tab.icon className={`w-5 h-5 sm:w-6 sm:h-6 ${activeTab === tab.id ? 'scale-110 drop-shadow-[0_0_8px_rgba(209,178,0,0.4)]' : ''}`} />
              <span className={`text-[8px] sm:text-[9px] font-bold uppercase tracking-[0.15em] ${activeTab === tab.id ? 'opacity-100' : 'opacity-60'}`}>
                {tab.label}
              </span>
              {activeTab === tab.id && (
                <motion.div layoutId="activeTab" className="absolute bottom-0 w-8 h-0.5 bg-brand-gold rounded-full" />
              )}
            </button>
          ))}
        </div>
      </nav>

      <AuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} />
    </div>
  );
}
