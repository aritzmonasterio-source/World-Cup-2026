import { Lock } from 'lucide-react';

export default function Others() {
  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-black uppercase tracking-tighter italic">Pronósticos <span className="text-brand-accent">Globales</span></h2>
      
      <div className="dimension-card-accent p-16 flex flex-col items-center justify-center text-center space-y-6 min-h-[400px]">
         <div className="w-20 h-20 bg-white/5 border border-white/10 rounded-full flex items-center justify-center text-brand-accent shadow-[0_0_30px_rgba(0,229,255,0.1)]">
            <Lock className="w-10 h-10" />
         </div>
         <div className="space-y-2">
           <h3 className="text-xl font-black uppercase tracking-widest text-white">Privacidad Activada</h3>
           <p className="text-sm text-brand-zinc-500 max-w-sm mx-auto font-medium leading-relaxed">
              Las apuestas de otros competidores permanecen <span className="text-white font-bold italic uppercase tracking-tighter underline underline-offset-4 decoration-brand-accent/30">encriptadas</span> hasta el cierre del mercado el 10 de Junio.
           </p>
         </div>
         <div className="pt-10 w-full max-w-md grid grid-cols-3 gap-4">
            {[1,2,3].map(i => (
              <div key={i} className="h-12 bg-white/5 border border-white/5 rounded-lg animate-pulse w-full" />
            ))}
         </div>
      </div>
    </div>
  );
}
