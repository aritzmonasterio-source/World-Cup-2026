import { useState } from 'react';
import { Medal, Swords, Table } from 'lucide-react';
import Bracket from './Bracket';
import Live from './Live';
import Standings from './Standings';

type ScoreView = 'groups' | 'goals' | 'bracket';

const SCORE_VIEWS: Array<{
  id: ScoreView;
  label: string;
  description: string;
  icon: typeof Table;
}> = [
  { id: 'groups', label: 'Grupos', description: 'Clasificaciones y marcadores de fase 1', icon: Table },
  { id: 'goals', label: 'Goles', description: 'Ranking de goleadores oficiales', icon: Medal },
  { id: 'bracket', label: 'Eliminatoria', description: 'Cuadro y cruces desde dieciseisavos', icon: Swords },
];

export default function Scores() {
  const [activeView, setActiveView] = useState<ScoreView>('groups');

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
        <div>
          <div className="flex items-center gap-3 text-brand-gold">
            <Medal className="w-4 h-4" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">Resultados oficiales</span>
          </div>
          <h1 className="mt-2 text-3xl font-black uppercase tracking-tighter italic">Marcadores <span className="text-brand-gold">Mundial</span></h1>
          <p className="mt-2 text-sm text-brand-zinc-400 max-w-2xl">
            Consulta grupos, goles y fase eliminatoria en una sola zona. Los datos se actualizan desde FIFA y sirven para el ranking.
          </p>
        </div>
      </div>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {SCORE_VIEWS.map((view) => {
          const Icon = view.icon;
          const active = activeView === view.id;
          return (
            <button
              key={view.id}
              type="button"
              onClick={() => setActiveView(view.id)}
              className={`rounded-2xl border p-4 text-left transition-all ${
                active
                  ? 'border-brand-gold bg-brand-gold text-black shadow-lg shadow-brand-gold/10'
                  : 'border-white/10 bg-white/[0.03] text-white hover:border-brand-gold/40'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-black uppercase tracking-widest">{view.label}</span>
                <Icon className={`h-5 w-5 ${active ? 'text-black' : 'text-brand-gold'}`} />
              </div>
              <p className={`mt-2 text-xs leading-relaxed ${active ? 'text-black/70' : 'text-brand-zinc-500'}`}>
                {view.description}
              </p>
            </button>
          );
        })}
      </section>

      {activeView === 'groups' && <Standings />}
      {activeView === 'goals' && <Live />}
      {activeView === 'bracket' && <Bracket />}
    </div>
  );
}
