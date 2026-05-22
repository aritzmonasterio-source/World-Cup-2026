import React, { useEffect, useState } from 'react';
import { Info, Lock, Mail, User, Users, X } from 'lucide-react';
import { motion } from 'motion/react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { COMMUNITIES, NEUTRAL_THEME, getCommunity, getCommunityThemeStyle, type CommunityId } from '../lib/communities';
import { ADMIN_EMAIL } from '../lib/constants';

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
  const authRedirectUrl = window.location.origin.startsWith('file')
    ? 'https://world-cup-2026-six-gules.vercel.app'
    : window.location.origin;

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
    setError('');
    setMessage('');
    onCommunityChange(communityId);

    const normalizedEmail = email.trim().toLowerCase();
    const validationError = validateForm({
      forcePasswordRecovery,
      isLogin,
      email: normalizedEmail,
      password,
      newPassword,
      username,
    });
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    if (!isSupabaseConfigured) {
      setLoading(false);
      setError('Supabase todavía no está configurado. Añade las variables de entorno primero.');
      return;
    }

    try {
      if (forcePasswordRecovery) {
        const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
        if (updateError) throw updateError;
        setMessage('Contraseña actualizada. Ya puedes entrar con la nueva clave.');
        setPassword('');
        setNewPassword('');
        onRecoveryComplete?.();
        setTimeout(onClose, 900);
      } else if (isLogin) {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
        if (signInError) throw signInError;
        onClose();
      } else {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            data: { username: username.trim(), community_id: communityId },
            emailRedirectTo: authRedirectUrl,
          },
        });
        if (signUpError) throw signUpError;
        if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
          throw new Error('Este email ya está registrado. Prueba a entrar o recupera la contraseña.');
        }
        setIsLogin(true);
        setMessage('Cuenta creada. Revisa tu email para confirmar la cuenta. Después el admin aprobará tu acceso.');
      }
    } catch (err: any) {
      setError(translateAuthError(err.message || 'No se pudo completar el acceso.'));
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
      redirectTo: authRedirectUrl,
    });
    setLoading(false);
    if (resetError) {
      setError(translateAuthError(resetError.message));
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
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto overflow-x-hidden p-2 sm:p-6 bg-[#161616]/95 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        style={getCommunityThemeStyle(NEUTRAL_THEME)}
        className="my-2 sm:my-0 w-full max-w-[min(36rem,calc(100vw-1rem))] max-h-[calc(100dvh-1rem)] overflow-y-auto dimension-card bg-brand-black/40 p-4 sm:p-10 relative border-brand-gold/20"
      >
        <button onClick={onClose} className="absolute top-4 right-4 sm:top-6 sm:right-6 text-brand-zinc-500 hover:text-brand-gold transition-colors">
          <X className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>

        <div className="text-center mb-5 sm:mb-10">
          <div className="w-20 h-16 sm:w-24 sm:h-20 bg-black/20 border border-brand-gold/20 rounded-2xl mx-auto mb-4 sm:mb-6 flex items-center justify-center overflow-hidden">
            <img src={NEUTRAL_THEME.logoUrl} alt="Mundial 2026" className="h-12 sm:h-16 w-auto object-contain" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tighter leading-none">
            {forcePasswordRecovery ? 'Nueva clave' : isLogin ? 'Acceso' : 'Nuevo registro'} <span className="text-brand-gold">Juego</span>
          </h2>
          <p className="text-[10px] text-brand-gold mt-3 uppercase font-black tracking-[0.25em] sm:tracking-[0.4em] opacity-70">{selectedCommunity.name}</p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {!forcePasswordRecovery && (
            <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-black/20 p-1">
              <button
                type="button"
                onClick={() => setIsLogin(true)}
                className={`rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${isLogin ? 'bg-brand-gold text-black' : 'text-brand-zinc-400 hover:text-white'}`}
              >
                Entrar
              </button>
              <button
                type="button"
                onClick={() => setIsLogin(false)}
                className={`rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${!isLogin ? 'bg-brand-gold text-black' : 'text-brand-zinc-400 hover:text-white'}`}
              >
                Registrarme
              </button>
            </div>
          )}

          {!forcePasswordRecovery && <div className="space-y-3">
            <div className="flex items-center gap-2 text-brand-gold">
              <Users className="w-4 h-4" />
              <p className="text-[10px] font-black uppercase tracking-[0.22em]">Elige la comunidad en la que quieres jugar</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {COMMUNITIES.map((community) => (
                <button
                  key={community.id}
                  type="button"
                  onClick={() => setCommunityId(community.id)}
                  className={`rounded-xl border p-2 sm:p-3 text-left transition-all ${communityId === community.id ? 'border-brand-gold bg-brand-gold/10' : 'border-white/10 bg-white/[0.03] hover:border-brand-gold/40'}`}
                >
                  <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-lg bg-black/30 border border-brand-gold/20 flex items-center justify-center overflow-hidden mb-2 sm:mb-3">
                    {community.logoUrl ? <img src={community.logoUrl} alt="" className="h-7 sm:h-8 w-auto object-contain" /> : <span className="text-xs font-black text-brand-gold">{community.logoText}</span>}
                  </div>
                  <p className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-white leading-tight">{community.shortName}</p>
                </button>
              ))}
            </div>
          </div>}

          {!forcePasswordRecovery && !isLogin && (
            <div className="relative group">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-gold/40 group-focus-within:text-brand-gold transition-colors" />
              <input
                type="text"
                placeholder="Nombre de usuario"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="nickname"
                className="w-full bg-black/40 border border-brand-gold/10 rounded-lg py-4 pl-12 pr-4 text-base font-bold tracking-normal focus:border-brand-gold outline-none transition-all placeholder:text-brand-zinc-600"
              />
            </div>
          )}

          {!forcePasswordRecovery && <div className="relative group">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-gold/40 group-focus-within:text-brand-gold transition-colors" />
            <input
              type="email"
              placeholder="Tu email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              inputMode="email"
              className="w-full bg-black/40 border border-brand-gold/10 rounded-lg py-4 pl-12 pr-4 text-base font-bold tracking-normal focus:border-brand-gold outline-none transition-all placeholder:text-brand-zinc-600"
            />
          </div>}

          <div className="relative group">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-gold/40 group-focus-within:text-brand-gold transition-colors" />
            <input
              type="password"
              placeholder={forcePasswordRecovery ? 'Nueva contraseña' : 'Tu contraseña'}
              value={forcePasswordRecovery ? newPassword : password}
              onChange={(e) => forcePasswordRecovery ? setNewPassword(e.target.value) : setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              className="w-full bg-black/40 border border-brand-gold/10 rounded-lg py-4 pl-12 pr-4 text-base font-bold tracking-normal focus:border-brand-gold outline-none transition-all placeholder:text-brand-zinc-600"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-gold text-black py-4 rounded-lg font-black text-xs uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
          >
            {loading ? 'Procesando...' : forcePasswordRecovery ? 'Guardar nueva contraseña' : isLogin ? 'Entrar' : 'Crear cuenta'}
          </button>

          {(error || message) && (
            <div className={`rounded-lg px-4 py-3 text-xs leading-relaxed ${error ? 'bg-red-500/10 border border-red-500/20 text-red-100' : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-100'}`}>
              {error || message}
              {error && isLogin && email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase() && (
                <span className="mt-2 block text-red-100/80">Si es tu primer acceso como admin, crea la cuenta con este email o usa “Olvidé mi contraseña”.</span>
              )}
            </div>
          )}

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
          {isLogin ? 'No tengo cuenta: registrarme' : 'Ya tengo cuenta: entrar'}
        </button>}
      </motion.div>
    </div>
  );
}

function translateAuthError(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes('invalid login credentials')) return 'Email o contraseña incorrectos.';
  if (lower.includes('email not confirmed')) return 'Falta confirmar el email. Revisa tu bandeja de entrada.';
  if (lower.includes('already registered') || lower.includes('already been registered')) return 'Este email ya está registrado. Prueba a entrar o recupera la contraseña.';
  if (lower.includes('password should be') || lower.includes('at least 6')) return 'La contraseña debe tener al menos 6 caracteres.';
  if (lower.includes('unable to validate email')) return 'El email no parece válido.';
  if (lower.includes('email rate limit exceeded')) return 'Se han pedido demasiados emails. Espera unos minutos y vuelve a intentarlo.';
  if (lower.includes('not a valid url') || lower.includes('redirect')) return 'La URL de confirmación no está autorizada en Supabase. Hay que añadir la URL de Vercel en Authentication > URL Configuration.';
  return message;
}

function validateForm({
  forcePasswordRecovery,
  isLogin,
  email,
  password,
  newPassword,
  username,
}: {
  forcePasswordRecovery: boolean;
  isLogin: boolean;
  email: string;
  password: string;
  newPassword: string;
  username: string;
}) {
  if (forcePasswordRecovery) {
    if (newPassword.length < 6) return 'La nueva contraseña debe tener al menos 6 caracteres.';
    return '';
  }
  if (!email) return 'Escribe tu email.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Escribe un email válido.';
  if (!password) return 'Escribe tu contraseña.';
  if (password.length < 6) return 'La contraseña debe tener al menos 6 caracteres.';
  if (!isLogin && username.trim().length < 2) return 'Escribe un nombre de usuario.';
  return '';
}
