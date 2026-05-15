import React, { useEffect, useState } from 'react';
import { Info, Lock, Mail, User, Users, X } from 'lucide-react';
import { motion } from 'motion/react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { COMMUNITIES, NEUTRAL_THEME, getCommunity, getCommunityThemeStyle, type CommunityId } from '../lib/communities';

export default function AuthModal({
  isOpen,
  selectedCommunityId,
  forcePasswordRecovery = false,
  onCommunityChange,
  onRecoveryComplete,
  onClose,
}: {
  isOpen: boolean;
  selectedCommunityId: CommunityId;
  forcePasswordRecovery?: boolean;
  onCommunityChange: (communityId: CommunityId) => void;
  onRecoveryComplete?: () => void;
  onClose: () => void;
}) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [username, setUsername] = useState('');
  const [communityId, setCommunityId] = useState<CommunityId>(selectedCommunityId);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const googleEnabled = import.meta.env.VITE_ENABLE_GOOGLE_AUTH === 'true';
  const selectedCommunity = getCommunity(communityId);

  useEffect(() => {
    setCommunityId(selectedCommunityId);
  }, [selectedCommunityId, isOpen]);

  useEffect(() => {
    if (forcePasswordRecovery) {
      setIsLogin(true);
      setPassword('');
      setNewPassword('');
      setError('');
      setMessage('Introduce una contraseña nueva para completar la recuperación.');
    }
  }, [forcePasswordRecovery]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    onCommunityChange(communityId);

    if (!isSupabaseConfigured) {
      setLoading(false);
      setError('Supabase todavía no está configurado. Añade las variables de entorno primero.');
      return;
    }

    try {
      if (forcePasswordRecovery) {
        if (newPassword.length < 6) throw new Error('La nueva contraseña debe tener al menos 6 caracteres.');
        const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
        if (updateError) throw updateError;
        setMessage('Contraseña actualizada. Ya puedes entrar con la nueva clave.');
        setPassword('');
        setNewPassword('');
        onRecoveryComplete?.();
        setTimeout(onClose, 900);
      } else if (isLogin) {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        onClose();
      } else {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { username, community_id: communityId },
            emailRedirectTo: window.location.origin,
          },
        });
        if (signUpError) throw signUpError;
        setMessage('Cuenta creada. Revisa tu email y espera la aprobación del admin para jugar.');
      }
    } catch (err: any) {
      setError(err.message || 'No se pudo completar el acceso.');
    } finally {
      setLoading(false);
    }
  };

  const sendPasswordReset = async () => {
    setError('');
    setMessage('');
    if (!isSupabaseConfigured) {
      setError('Supabase todavía no está configurado.');
      return;
    }
    if (!email.trim()) {
      setError('Escribe tu email primero y pulsa de nuevo en recuperar contraseña.');
      return;
    }
    setLoading(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin,
    });
    setLoading(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setMessage('Te he enviado un email para cambiar la contraseña. Abre el enlace desde este dispositivo.');
  };

  const signInWithGoogle = async () => {
    setError('');
    setMessage('');
    if (!isSupabaseConfigured) {
      setError('Supabase todavía no está configurado.');
      return;
    }
    if (!googleEnabled) {
      setMessage('El acceso con Google está desactivado hasta configurar el proveedor OAuth en Supabase. Usa email y contraseña.');
      return;
    }
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (oauthError) setError(oauthError.message);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-[#161616]/95 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        style={getCommunityThemeStyle(NEUTRAL_THEME)}
        className="w-full max-w-xl max-h-[92vh] overflow-y-auto dimension-card bg-brand-black/40 p-8 sm:p-10 relative border-brand-gold/20"
      >
        <button onClick={onClose} className="absolute top-6 right-6 text-brand-zinc-500 hover:text-brand-gold transition-colors">
          <X className="w-6 h-6" />
        </button>

        <div className="text-center mb-10">
          <div className="w-24 h-20 bg-black/20 border border-brand-gold/20 rounded-2xl mx-auto mb-6 flex items-center justify-center overflow-hidden">
            <img src={NEUTRAL_THEME.logoUrl} alt="Mundial 2026" className="h-16 w-auto object-contain" />
          </div>
          <h2 className="text-3xl font-black uppercase tracking-tighter leading-none">
            {forcePasswordRecovery ? 'Nueva clave' : isLogin ? 'Acceso' : 'Registro'} <span className="text-brand-gold">Juego</span>
          </h2>
          <p className="text-[10px] text-brand-gold mt-3 uppercase font-black tracking-[0.4em] opacity-70">{selectedCommunity.name}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!forcePasswordRecovery && <div className="space-y-3">
            <div className="flex items-center gap-2 text-brand-gold">
              <Users className="w-4 h-4" />
              <p className="text-[10px] font-black uppercase tracking-[0.28em]">Elige comunidad</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {COMMUNITIES.map((community) => (
                <button
                  key={community.id}
                  type="button"
                  onClick={() => setCommunityId(community.id)}
                  className={`rounded-xl border p-3 text-left transition-all ${communityId === community.id ? 'border-brand-gold bg-brand-gold/10' : 'border-white/10 bg-white/[0.03] hover:border-brand-gold/40'}`}
                >
                  <div className="h-10 w-10 rounded-lg bg-black/30 border border-brand-gold/20 flex items-center justify-center overflow-hidden mb-3">
                    {community.logoUrl ? <img src={community.logoUrl} alt="" className="h-8 w-auto object-contain" /> : <span className="text-xs font-black text-brand-gold">{community.logoText}</span>}
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-white leading-tight">{community.name}</p>
                </button>
              ))}
            </div>
          </div>}

          {!forcePasswordRecovery && !isLogin && (
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

          {!forcePasswordRecovery && <div className="relative group">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-gold/40 group-focus-within:text-brand-gold transition-colors" />
            <input
              type="email"
              placeholder="TU EMAIL"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-black/40 border border-brand-gold/10 rounded-lg py-4 pl-12 pr-4 text-[10px] font-black uppercase tracking-[0.2em] focus:border-brand-gold outline-none transition-all placeholder:text-brand-zinc-600"
            />
          </div>}

          <div className="relative group">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-gold/40 group-focus-within:text-brand-gold transition-colors" />
            <input
              type="password"
              placeholder={forcePasswordRecovery ? 'NUEVA CONTRASEÑA' : 'TU CONTRASEÑA'}
              value={forcePasswordRecovery ? newPassword : password}
              onChange={(e) => forcePasswordRecovery ? setNewPassword(e.target.value) : setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full bg-black/40 border border-brand-gold/10 rounded-lg py-4 pl-12 pr-4 text-[10px] font-black uppercase tracking-[0.2em] focus:border-brand-gold outline-none transition-all placeholder:text-brand-zinc-600"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-gold text-black py-4 rounded-lg font-black text-xs uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
          >
            {loading ? 'Procesando...' : forcePasswordRecovery ? 'Guardar nueva contraseña' : isLogin ? 'Entrar' : 'Crear cuenta'}
          </button>

          {!forcePasswordRecovery && isLogin && (
            <button
              type="button"
              onClick={sendPasswordReset}
              disabled={loading}
              className="w-full rounded-lg border border-white/10 bg-white/[0.03] py-3 text-[10px] font-black uppercase tracking-[0.2em] text-brand-zinc-300 hover:border-brand-gold/30 hover:text-brand-gold transition-all disabled:opacity-50"
            >
              Olvidé mi contraseña
            </button>
          )}

          {!forcePasswordRecovery && <div className="relative group">
            <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-gold/40 group-focus-within:text-brand-gold transition-colors" />
            <select
              value={communityId}
              onChange={(event) => setCommunityId(event.target.value as CommunityId)}
              className="w-full bg-black/40 border border-brand-gold/10 rounded-lg py-4 pl-12 pr-4 text-[10px] font-black uppercase tracking-[0.2em] focus:border-brand-gold outline-none transition-all"
            >
              {COMMUNITIES.map((community) => (
                <option key={community.id} value={community.id}>{community.name}</option>
              ))}
            </select>
          </div>}

          {!forcePasswordRecovery && <div className="rounded-xl border border-brand-gold/20 bg-brand-gold/5 p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-black/30 border border-brand-gold/20 flex items-center justify-center overflow-hidden shrink-0">
              {selectedCommunity.logoUrl ? <img src={selectedCommunity.logoUrl} alt="" className="h-10 w-auto object-contain" /> : <span className="font-black text-brand-gold">{selectedCommunity.logoText}</span>}
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-white">{selectedCommunity.name}</p>
              <p className="text-xs text-brand-zinc-400 mt-1 leading-relaxed">{selectedCommunity.description}</p>
            </div>
          </div>}

          {error && <p className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-xs text-red-200">{error}</p>}
          {message && <p className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-xs text-emerald-200">{message}</p>}
        </form>

        {!forcePasswordRecovery && <div className="mt-10 pt-8 border-t border-white/5 text-center">
          <p className="text-[9px] uppercase text-brand-zinc-600 font-bold tracking-[0.3em] mb-6">Acceso opcional</p>
          {googleEnabled ? (
            <button
              onClick={signInWithGoogle}
              className="w-full bg-brand-gold/5 border border-brand-gold/10 text-brand-gold py-4 rounded-lg font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-brand-gold/10 transition-all group"
            >
              <User className="w-4 h-4 text-brand-gold group-hover:scale-110 transition-transform" /> Acceso con Google
            </button>
          ) : (
            <div className="rounded-lg bg-white/[0.03] border border-white/10 px-4 py-3 text-xs text-brand-zinc-400 flex gap-3 text-left">
              <Info className="w-4 h-4 text-brand-gold shrink-0 mt-0.5" />
              <span>Google se activará cuando el proveedor OAuth esté configurado en Supabase. Mientras tanto, email y contraseña evita pantallas en blanco.</span>
            </div>
          )}
        </div>}

        {!forcePasswordRecovery && <button onClick={() => setIsLogin(!isLogin)} className="w-full text-center mt-8 text-[10px] text-white font-black uppercase tracking-[0.2em] hover:text-brand-gold transition-all">
          {isLogin ? 'Crear una cuenta nueva' : 'Ya tengo cuenta'}
        </button>}
      </motion.div>
    </div>
  );
}
