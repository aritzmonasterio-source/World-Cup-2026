import React, { useState } from 'react';
import { auth, db } from '../lib/firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile,
  signInWithPopup,
  GoogleAuthProvider
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { X, Mail, Lock, User, AtSign, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function AuthModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const { user } = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(user, { displayName: username });
        
        // Create profile in Firestore
        await setDoc(doc(db, 'users', user.uid), {
          username: username,
          email: email,
          totalPoints: 0,
          groupPoints: 0,
          knockoutPoints: 0,
          scorerPoints: 0,
          finalistPoints: 0,
          createdAt: new Date().toISOString(),
        });
      }
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const { user } = await signInWithPopup(auth, provider);
      
      // Ensure profile exists in Firestore for Google users
      await setDoc(doc(db, 'users', user.uid), {
        username: user.displayName || user.email?.split('@')[0] || 'Usuario',
        email: user.email,
        totalPoints: 0,
        pointsGroups: 0,
        pointsKnockout: 0,
        pointsScorer: 0,
        pointsFinalists: 0,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      onClose();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-brand-gray/95 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md dimension-card bg-brand-black/40 p-10 relative border-brand-gold/20"
      >
        <button onClick={onClose} className="absolute top-6 right-6 text-brand-zinc-500 hover:text-brand-gold transition-colors">
          <X className="w-6 h-6" />
        </button>

        <div className="text-center mb-10">
          <img 
            src="https://lh3.googleusercontent.com/d/1Vb1NUyxG41s1B_z5qBkqWtN4jQYi_ctk=s1000" 
            alt="Dimension Football" 
            className="w-24 h-auto mx-auto mb-6"
          />
          <h2 className="text-3xl font-black uppercase tracking-tighter leading-none">
            {isLogin ? 'Acceso' : 'Registro'} <span className="text-brand-gold">Dimension</span>
          </h2>
          <p className="text-[10px] text-brand-gold mt-3 uppercase font-black tracking-[0.4em] opacity-40">Predictor Mundial 2026</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div className="relative group">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-gold/40 group-focus-within:text-brand-gold transition-colors" />
              <input
                type="text"
                placeholder="NOMBRE DE USUARIO"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full bg-black/40 border border-brand-gold/10 rounded-lg py-4 pl-12 pr-4 text-[10px] font-black uppercase tracking-[0.2em] focus:border-brand-gold outline-none transition-all placeholder:text-brand-zinc-600"
              />
            </div>
          )}
          
          <div className="relative group">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-gold/40 group-focus-within:text-brand-gold transition-colors" />
            <input
              type="email"
              placeholder="TU EMAIL"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-black/40 border border-brand-gold/10 rounded-lg py-4 pl-12 pr-4 text-[10px] font-black uppercase tracking-[0.2em] focus:border-brand-gold outline-none transition-all placeholder:text-brand-zinc-600"
            />
          </div>

          <div className="relative group">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-gold/40 group-focus-within:text-brand-gold transition-colors" />
            <input
              type="password"
              placeholder="TU CONTRASEÑA"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-black/40 border border-brand-gold/10 rounded-lg py-4 pl-12 pr-4 text-[10px] font-black uppercase tracking-[0.2em] focus:border-brand-gold outline-none transition-all placeholder:text-brand-zinc-600"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-gold text-black py-4 mt-6 rounded-lg font-black text-xs uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all shadow-[0_0_20px_rgba(174,156,80,0.2)]"
          >
            {loading ? 'Procesando...' : (isLogin ? 'Entrar al Sistema' : 'Crear Cuenta Elite')}
          </button>
        </form>

        <div className="mt-10 pt-8 border-t border-white/5 text-center">
          <p className="text-[9px] uppercase text-brand-zinc-600 font-bold tracking-[0.3em] mb-6">Autenticación Externa</p>
          <button 
            onClick={signInWithGoogle}
            className="w-full bg-brand-gold/5 border border-brand-gold/10 text-brand-gold py-4 rounded-lg font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-brand-gold/10 transition-all group"
          >
            <AtSign className="w-4 h-4 text-brand-gold group-hover:scale-110 transition-transform" /> Acceso con Google
          </button>
        </div>

        <button
          onClick={() => setIsLogin(!isLogin)}
          className="w-full text-center mt-8 text-[10px] text-white font-black uppercase tracking-[0.2em] hover:text-brand-gold transition-all"
        >
          {isLogin ? (
            <span className="flex flex-col gap-1 items-center">
              <span className="opacity-40 font-bold">¿Eres nuevo?</span>
              <span className="text-brand-gold border-b border-brand-gold/40 pb-0.5">Crea una cuenta ahora</span>
            </span>
          ) : (
            <span className="flex flex-col gap-1 items-center">
              <span className="opacity-40 font-bold">¿Ya eres parte del equipo?</span>
              <span className="text-brand-gold border-b border-brand-gold/40 pb-0.5">Entra con mis datos</span>
            </span>
          )}
        </button>
      </motion.div>

    </div>
  );
}
