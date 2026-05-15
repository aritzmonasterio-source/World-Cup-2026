import type { User } from '@supabase/supabase-js';
import { Eye, Lock, Users } from 'lucide-react';
import type { Profile } from '../lib/types';
import { canPlay } from '../lib/supabase';
import { formatDateTime, GROUP_DEADLINE_ISO, KNOCKOUT_DEADLINE_ISO } from '../lib/constants';

export default function Others({ user, profile }: { user: User | null; profile: Profile | null }) {
  const approved = canPlay(profile, user?.email);

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-black uppercase tracking-tighter italic">Pronósticos <span className="text-brand-accent">Globales</span></h2>
      <div className="dimension-card-accent p-10 flex flex-col items-center justify-center text-center space-y-6 min-h-[360px]">
        <div className="w-20 h-20 bg-white/5 border border-white/10 rounded-full flex items-center justify-center text-brand-accent shadow-[0_0_30px_rgba(16,185,129,0.1)]">
          {approved ? <Eye className="w-10 h-10" /> : <Lock className="w-10 h-10" />}
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-black uppercase tracking-widest text-white">Privacidad competitiva</h3>
          <p className="text-sm text-brand-zinc-500 max-w-xl mx-auto font-medium leading-relaxed">
            Los pronósticos de otros competidores permanecen ocultos hasta que el mercado esté cerrado. Así nadie copia, todos juegan limpio y el ranking respira tranquilo.
          </p>
        </div>
        <div className="grid md:grid-cols-2 gap-4 w-full max-w-2xl pt-4">
          <RevealCard title="Grupos y goleador" date={formatDateTime(GROUP_DEADLINE_ISO)} />
          <RevealCard title="Fase eliminatoria completa" date={formatDateTime(KNOCKOUT_DEADLINE_ISO)} />
        </div>
        <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-[10px] uppercase tracking-widest text-brand-zinc-500 font-black">
          <Users className="w-4 h-4 text-brand-gold" />
          Vista social ampliable cuando empiece la competición
        </div>
      </div>
    </div>
  );
}

function RevealCard({ title, date }: { title: string; date: string }) {
  return (
    <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-5 text-left">
      <p className="text-xs font-black uppercase tracking-widest text-white mb-2">{title}</p>
      <p className="text-[10px] font-black uppercase tracking-widest text-brand-gold">{date}</p>
    </div>
  );
}
