import { useState } from 'react';
import { motion } from 'motion/react';
import { Calendar, Trophy, Swords, ChevronRight, Info, RefreshCw } from 'lucide-react';
import { auth } from '../lib/firebase';

export default function Dashboard({ setActiveTab }: { setActiveTab: (t: string) => void }) {
  return (
    <div className="space-y-8">
      <div className="dimension-card-accent p-10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-gold/5 rounded-full blur-3xl -mr-32 -mt-16" />
        
        <div className="relative z-10">
          <h2 className="text-4xl sm:text-6xl font-black uppercase tracking-tighter mb-6 leading-none">
            Dimension <span className="text-brand-gold">Football</span>
          </h2>
          <p className="text-brand-zinc-400 text-sm sm:text-lg max-w-2xl leading-relaxed mb-10">
            Bienvenido al <span className="text-white font-bold">Predictor Oficial</span> para el Mundial 2026. 
            Vive la emoción de los <span className="text-brand-gold font-bold">48 equipos</span> en 104 partidos. 
            Pronostica, acierta y reclama el trono global.
          </p>
          
          <div className="flex flex-wrap gap-4">
            <button 
              onClick={() => setActiveTab('predictions')}
              className="dimension-button-primary px-8 flex items-center gap-3 group"
            >
              Empezar a Pronosticar 
              <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="dimension-card p-8 border-brand-gold/10 bg-brand-gold/5">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-1.5 h-6 bg-brand-gold rounded-full" />
            <h3 className="text-sm uppercase tracking-[0.2em] text-white font-black italic">Sistema Puntos</h3>
          </div>
          <ul className="space-y-4">
            <RuleItem points={15} label="Resultado Exacto" />
            <RuleItem points={8} label="Acertar Ganador / Empate" />
            <RuleItem points={10} label="Gol de tu Goleador" />
            <RuleItem points={15} label="Puesto exacto en Grupo" />
          </ul>
        </div>

        <div className="dimension-card p-8 border-brand-gold/10 flex flex-col justify-between">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-6 bg-brand-gold rounded-full" />
              <h3 className="text-sm uppercase tracking-[0.2em] text-white font-black italic">Cierres de Fase</h3>
            </div>
            <div className="space-y-4">
              <DeadlineItem date="10 JUN" label="Fase Grupos & Goleador" current />
              <DeadlineItem date="28 JUN" label="Eliminatorias" />
            </div>
          </div>
          <div className="mt-8 flex items-center gap-2 text-[10px] text-brand-zinc-600 uppercase font-black">
            <Info className="w-3 h-3 text-brand-gold" />
            Sistema Verificado por Dimension Football
          </div>
        </div>
      </div>
    </div>
  );
}

function RuleItem({ points, label }: { points: number; label: string }) {
  return (
    <li className="flex items-center justify-between border-b border-white/5 pb-3">
      <span className="text-sm font-semibold text-brand-zinc-400 uppercase tracking-wide">{label}</span>
      <span className="font-mono font-bold text-brand-gold">{points} PTS</span>
    </li>
  );
}

function DeadlineItem({ date, label, current }: { date: string; label: string; current?: boolean }) {
  return (
    <div className={`flex items-center gap-4 ${current ? 'opacity-100' : 'opacity-40'}`}>
      <div className={`w-14 h-14 rounded-lg flex flex-col items-center justify-center border ${
        current ? 'border-brand-gold/50 bg-brand-gold/5' : 'border-white/10 bg-white/5'
      }`}>
        <span className="text-[10px] font-bold opacity-50 uppercase tracking-widest">Día</span>
        <span className={`text-lg font-mono font-bold ${current ? 'text-brand-gold' : ''}`}>
          {date.split(' ')[0]}
        </span>
      </div>
      <div>
        <div className="text-[10px] uppercase font-bold tracking-widest text-brand-gold/60">{date}</div>
        <div className="text-sm font-bold uppercase tracking-wide">{label}</div>
      </div>
    </div>
  );
}


// Dummy icons since I didn't want to import everything at once
const swordsIcon = () => null;
const checkIcon = () => null;
const listIcon = () => null;
