import { Database } from 'lucide-react';

export default function ConfigRequired({ title = 'Configura Supabase' }: { title?: string }) {
  return (
    <div className="dimension-card-accent p-12 text-center max-w-2xl mx-auto">
      <Database className="w-12 h-12 text-brand-gold mx-auto mb-6" />
      <h1 className="text-2xl font-black uppercase tracking-tighter italic mb-3">{title}</h1>
      <p className="text-brand-zinc-400 text-sm leading-relaxed">
        Añade `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en `.env.local` para activar datos, auth, ranking y sincronización.
      </p>
    </div>
  );
}
