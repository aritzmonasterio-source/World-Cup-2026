import { useState, useEffect, useMemo, useRef } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, getDocs, setDoc, doc, getDoc, where, serverTimestamp } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { Save, Lock, AlertCircle, Loader2, User, Clock, Tv, ChevronLeft, Trophy, Target, Info, FileDown, CheckCircle2 } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

import { getFlagUrl } from '../lib/flags';

const DEFAULT_SCORERS = [
  { id: "s1", name: "Kylian Mbappé", team: "Francia", history: "Bota de Oro 2022", average: "Favorito principal", status: "Estrella", photoUrl: "https://img.asmedia.epimg.net/resizer/v2/G6K7X6W7VREJ5O6X7YVREJ5O6U.jpg?auth=9c3397943d04d8d1e3d3b7e5b4c10a4f5b3a3d5b4c10a4f5b3a3d5b4c10a4f5&width=300&height=300" },
  { id: "s2", name: "Erling Haaland", team: "Noruega", history: "Máquina de goles", average: "Potencia pura", status: "Candidato", photoUrl: "https://img.asmedia.epimg.net/resizer/v2/H6K7X6W7VREJ5O6X7YVREJ5O6U.jpg?auth=9c3397943d04d8d1e3d3b7e5b4c10a4f5b3a3d5b4c10a4f5b3a3d5b4c10a4f5&width=300&height=300" },
  { id: "s3", name: "Harry Kane", team: "Inglaterra", history: "Bota de Oro 2018", average: "Especialista", status: "Leyenda", photoUrl: "https://img.asmedia.epimg.net/resizer/v2/I6K7X6W7VREJ5O6X7YVREJ5O6U.jpg?auth=9c3397943d04d8d1e3d3b7e5b4c10a4f5b3a3d5b4c10a4f5b3a3d5b4c10a4f5&width=300&height=300" },
  { id: "s4", name: "Vinícius Jr.", team: "Brasil", history: "Velocidad pura", average: "Desequilibrio", status: "Estrella", photoUrl: "https://img.asmedia.epimg.net/resizer/v2/J6K7X6W7VREJ5O6X7YVREJ5O6U.jpg?auth=9c3397943d04d8d1e3d3b7e5b4c10a4f5b3a3d5b4c10a4f5b3a3d5b4c10a4f5&width=300&height=300" },
  { id: "s5", name: "Lionel Messi", team: "Argentina", history: "Campeón Mundial", average: "Genio", status: "Leyenda", photoUrl: "https://img.asmedia.epimg.net/resizer/v2/K6K7X6W7VREJ5O6X7YVREJ5O6U.jpg?auth=9c3397943d04d8d1e3d3b7e5b4c10a4f5b3a3d5b4c10a4f5b3a3d5b4c10a4f5&width=300&height=300" },
  { id: "s6", name: "Jude Bellingham", team: "Inglaterra", history: "El nuevo ídolo", average: "Llegada letal", status: "Elite", photoUrl: "https://img.asmedia.epimg.net/resizer/v2/L6K7X6W7VREJ5O6X7YVREJ5O6U.jpg?auth=9c3397943d04d8d1e3d3b7e5b4c10a4f5b3a3d5b4c10a4f5b3a3d5b4c10a4f5&width=300&height=300" },
  { id: "s7", name: "Lamine Yamal", team: "España", history: "Récord Juventud", average: "Talento puro", status: "Promesa", photoUrl: "https://img.asmedia.epimg.net/resizer/v2/M6K7X6W7VREJ5O6X7YVREJ5O6U.jpg?auth=9c3397943d04d8d1e3d3b7e5b4c10a4f5b3a3d5b4c10a4f5b3a3d5b4c10a4f5&width=300&height=300" },
  { id: "s8", name: "Lautaro Martínez", team: "Argentina", history: "Goleador Serie A", average: "Olfato", status: "Elite", photoUrl: "https://img.asmedia.epimg.net/resizer/v2/N6K7X6W7VREJ5O6X7YVREJ5O6U.jpg?auth=9c3397943d04d8d1e3d3b7e5b4c10a4f5b3a3d5b4c10a4f5b3a3d5b4c10a4f5&width=300&height=300" },
  { id: "s9", name: "Darwin Núñez", team: "Uruguay", history: "Potencia charrúa", average: "Garra", status: "Elite", photoUrl: "https://img.asmedia.epimg.net/resizer/v2/O6K7X6W7VREJ5O6X7YVREJ5O6U.jpg?auth=9c3397943d04d8d1e3d3b7e5b4c10a4f5b3a3d5b4c10a4f5b3a3d5b4c10a4f5&width=300&height=300" },
  { id: "s10", name: "Julián Álvarez", team: "Argentina", history: "Ganador de todo", average: "Presión", status: "Elite", photoUrl: "https://img.asmedia.epimg.net/resizer/v2/P6K7X6W7VREJ5O6X7YVREJ5O6U.jpg?auth=9c3397943d04d8d1e3d3b7e5b4c10a4f5b3a3d5b4c10a4f5b3a3d5b4c10a4f5&width=300&height=300" },
  { id: "s11", name: "Jamal Musiala", team: "Alemania", history: "Magia bávara", average: "Dribling", status: "Estrella", photoUrl: "https://img.asmedia.epimg.net/resizer/v2/Q6K7X6W7VREJ5O6X7YVREJ5O6U.jpg?auth=9c3397943d04d8d1e3d3b7e5b4c10a4f5b3a3d5b4c10a4f5b3a3d5b4c10a4f5&width=300&height=300" },
  { id: "s12", name: "Florian Wirtz", team: "Alemania", history: "Visión total", average: "Clase", status: "Estrella", photoUrl: "https://img.asmedia.epimg.net/resizer/v2/R6K7X6W7VREJ5O6X7YVREJ5O6U.jpg?auth=9c3397943d04d8d1e3d3b7e5b4c10a4f5b3a3d5b4c10a4f5b3a3d5b4c10a4f5&width=300&height=300" },
  { id: "s13", name: "Victor Osimhen", team: "Nigeria", history: "Poder africano", average: "Salto", status: "Elite", photoUrl: "https://img.asmedia.epimg.net/resizer/v2/S6K7X6W7VREJ5O6X7YVREJ5O6U.jpg?auth=9c3397943d04d8d1e3d3b7e5b4c10a4f5b3a3d5b4c10a4f5b3a3d5b4c10a4f5&width=300&height=300" },
  { id: "s14", name: "Rodrygo Goes", team: "Brasil", history: "Mr. Champions", average: "Gol", status: "Estrella", photoUrl: "https://img.asmedia.epimg.net/resizer/v2/T6K7X6W7VREJ5O6X7YVREJ5O6U.jpg?auth=9c3397943d04d8d1e3d3b7e5b4c10a4f5b3a3d5b4c10a4f5b3a3d5b4c10a4f5&width=300&height=300" },
  { id: "s15", name: "Endrick", team: "Brasil", history: "La nueva joya", average: "Explosividad", status: "Promesa", photoUrl: "https://img.asmedia.epimg.net/resizer/v2/U6K7X6W7VREJ5O6X7YVREJ5O6U.jpg?auth=9c3397943d04d8d1e3d3b7e5b4c10a4f5b3a3d5b4c10a4f5b3a3d5b4c10a4f5&width=300&height=300" },
];

const DEFAULT_MATCHES = [
  // JORNADA 1 - INAUGURACIÓN
  { id: "m_1", homeTeam: "México", awayTeam: "Ecuador", date: "2026-06-11T16:00:00Z", phase: "Grupo A", venue: "Estadio Azteca (CDMX)", channel: "Televisa / TV Azteca" },
  { id: "m_2", homeTeam: "Team A3", awayTeam: "Team A4", date: "2026-06-11T19:00:00Z", phase: "Grupo A", venue: "Estadio Akron (Guadalajara)", channel: "Sky Sports" },
  { id: "m_3", homeTeam: "Canadá", awayTeam: "Nigeria", date: "2026-06-12T15:00:00Z", phase: "Grupo B", venue: "BMO Field (Toronto)", channel: "TSN" },
  { id: "m_4", homeTeam: "USA", awayTeam: "Marruecos", date: "2026-06-12T18:00:00Z", phase: "Grupo D", venue: "SoFi Stadium (Los Ángeles)", channel: "FOX / Telemundo" },
  
  // MÁS PARTIDOS REPRESENTATIVOS
  { id: "m_5", homeTeam: "Argentina", awayTeam: "Francia", date: "2026-06-13T16:00:00Z", phase: "Grupo C", venue: "MetLife Stadium (NY/NJ)", channel: "Mundial TV" },
  { id: "m_6", homeTeam: "España", awayTeam: "Japón", date: "2026-06-13T19:00:00Z", phase: "Grupo E", venue: "Gillette Stadium (Boston)", channel: "RTVE" },
  { id: "m_7", homeTeam: "Brasil", awayTeam: "Alemania", date: "2026-06-14T16:00:00Z", phase: "Grupo F", venue: "AT&T Stadium (Dallas)", channel: "Mundial TV" },
  { id: "m_8", homeTeam: "Inglaterra", awayTeam: "Australia", date: "2026-06-14T19:00:00Z", phase: "Grupo G", venue: "Hard Rock Stadium (Miami)", channel: "BBC" },
  { id: "m_9", homeTeam: "Portugal", awayTeam: "Corea del Sur", date: "2026-06-15T16:00:00Z", phase: "Grupo H", venue: "Mercedes-Benz Stadium (Atlanta)", channel: "Mundial TV" },
  { id: "m_10", homeTeam: "Italia", awayTeam: "Uruguay", date: "2026-06-15T19:00:00Z", phase: "Grupo I", venue: "NRG Stadium (Houston)", channel: "RAI" },
  
  // SEGUNDA JORNADA INICIO
  { id: "m_11", homeTeam: "México", awayTeam: "Team A3", date: "2026-06-16T16:00:00Z", phase: "Grupo A", venue: "Estadio Akron (Guadalajara)", channel: "Televisa" },
  { id: "m_12", homeTeam: "Canadá", awayTeam: "Team B3", date: "2026-06-17T15:00:00Z", phase: "Grupo B", venue: "BC Place (Vancouver)", channel: "TSN" },
  { id: "m_13", homeTeam: "USA", awayTeam: "Team D3", date: "2026-06-17T18:00:00Z", phase: "Grupo D", venue: "Lumen Field (Seattle)", channel: "FOX" },
];

export default function Predictions({ user, setShowAuth }: { user: any, setShowAuth: (b: boolean) => void }) {
  const [matches, setMatches] = useState<any[]>([]);
  const [predictions, setPredictions] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [scorers, setScorers] = useState<any[]>([]);
  const [deadlines, setDeadlines] = useState<any>(null);
  const [selectedScorerInfo, setSelectedScorerInfo] = useState<any | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const groupFilterList = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
  const pdfRef = useRef<HTMLDivElement>(null);

  const matchesByGroup = useMemo(() => {
    const groups: Record<string, any[]> = {};
    const sorted = [...matches].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    sorted.forEach(m => {
      const g = m.phase || 'Otros';
      if (activeFilter !== 'all' && activeFilter !== 'knockout' && !g.includes(activeFilter)) return;
      if (activeFilter === 'knockout' && g.toLowerCase().includes('grupo')) return;
      
      if (!groups[g]) groups[g] = [];
      groups[g].push(m);
    });
    return groups;
  }, [matches, activeFilter]);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const [mSnap, sSnap] = await Promise.all([
          getDocs(collection(db, 'matches')),
          getDocs(collection(db, 'scorers'))
        ]);
        
        let dData = { groupStageDeadline: "2026-06-11T16:00:00Z", knockoutStageDeadline: "2026-06-28T22:00:00Z" };
        try {
          const dSnap = await getDoc(doc(db, 'config', 'deadlines'));
          if (dSnap.exists()) dData = dSnap.data() as any;
        } catch (e) {
          console.warn("Using default deadlines");
        }
        
        const fetchedMatches = mSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const fetchedScorers = sSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        setMatches(fetchedMatches.length > 0 ? fetchedMatches : DEFAULT_MATCHES);
        setDeadlines(dData);
        setScorers(fetchedScorers.length > 0 ? fetchedScorers : DEFAULT_SCORERS);
  
        if (user?.uid) {
          const pSnap = await getDocs(query(collection(db, 'predictions'), where('userId', '==', user.uid)));
          const pMap: Record<string, any> = {};
          pSnap.docs.forEach(d => {
            const data = d.data();
            pMap[data.matchId] = data;
          });
          setPredictions(pMap);
        }
      } catch (error) {
        console.error("Fetch data error:", error);
        setMatches(DEFAULT_MATCHES);
        setScorers(DEFAULT_SCORERS);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [user]);

  const handleScoreChange = (matchId: string, side: 'home' | 'away', val: string) => {
    const score = val === '' ? undefined : parseInt(val);
    if (val !== '' && isNaN(score as any)) return;
    setPredictions(prev => ({
      ...prev,
      [matchId]: {
        ...prev[matchId],
        homeScore: side === 'home' ? score : (prev[matchId]?.homeScore),
        awayScore: side === 'away' ? score : (prev[matchId]?.awayScore)
      }
    }));
  };

  const savePrediction = async (matchId: string) => {
    if (!user) {
      setShowAuth(true);
      return;
    }
    const pred = predictions[matchId];
    if (pred?.homeScore === undefined || pred?.awayScore === undefined) return;

    setSavingId(matchId);
    try {
      const predId = `${user.uid}_${matchId}`;
      await setDoc(doc(db, 'predictions', predId), {
        userId: user.uid,
        matchId,
        homeScore: pred.homeScore,
        awayScore: pred.awayScore,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `predictions/${user.uid}_${matchId}`);
    }
    setTimeout(() => setSavingId(null), 1000); // Give feedback
  };

  const downloadPDF = async () => {
    if (!pdfRef.current) return;
    setIsExporting(true);
    try {
      const canvas = await html2canvas(pdfRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#111111',
        onclone: (clonedDoc) => {
          // Fix for Tailwind 4 oklab/oklch colors which crash html2canvas 1.4.1
          const style = clonedDoc.createElement('style');
          style.innerHTML = `
            * { 
              color-scheme: dark !important;
            }
            /* Force basic hex colors in the clone for PDF generation */
            :root {
              --color-emerald-500: #10b981 !important;
              --color-brand-accent: #10b981 !important;
              --color-brand-gold: #AE9C50 !important;
            }
            .text-emerald-500 { color: #10b981 !important; }
            .bg-emerald-500 { background-color: #10b981 !important; }
            .text-brand-gold { color: #AE9C50 !important; }
            .bg-brand-gold { background-color: #AE9C50 !important; }
          `;
          clonedDoc.head.appendChild(style);

          // Deep clean all oklab/oklch from stylesheets in the clone
          const styleTags = clonedDoc.getElementsByTagName('style');
          for (let i = 0; i < styleTags.length; i++) {
            let css = styleTags[i].innerHTML;
            if (css.includes('oklch') || css.includes('oklab') || css.includes('color-mix')) {
              // Replace these with a generic safe gray or brand color
              // This prevents the parsing error in html2canvas
              css = css.replace(/oklch\([^)]+\)/g, 'rgba(113, 113, 122, 1)');
              css = css.replace(/oklab\([^)]+\)/g, 'rgba(113, 113, 122, 1)');
              css = css.replace(/color-mix\([^)]+\)/g, 'rgba(113, 113, 122, 1)');
              styleTags[i].innerHTML = css;
            }
          }
        }
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Mis_Predicciones_Mundial2026_${user.username}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
    }
    setIsExporting(false);
  };

  const saveScorer = async (scorerId: string) => {
    if (!user) return setShowAuth(true);
    try {
      await setDoc(doc(db, 'users', user.uid), { selectedScorerId: scorerId }, { merge: true });
    } catch (error) {
       handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
    }
  };

  const isLocked = (match: any) => {
    if (!deadlines) return false; 
    const now = new Date();
    const matchDate = new Date(match.date);
    const stageDeadlineStr = match.phase?.toLowerCase().includes('grupo') 
      ? deadlines.groupStageDeadline 
      : deadlines.knockoutStageDeadline;
    const stageDeadline = stageDeadlineStr ? new Date(stageDeadlineStr) : new Date('2099-01-01');
    return now > matchDate || now > stageDeadline;
  };

  const calculateStandings = (groupMatches: any[], currentPredictions: Record<string, any>) => {
    const teams: Record<string, { name: string, mp: number, w: number, d: number, l: number, gf: number, ga: number, pts: number }> = {};
    
    // Initialize teams from match pairs
    groupMatches.forEach(m => {
      [m.homeTeam, m.awayTeam].forEach(t => {
        if (!teams[t]) teams[t] = { name: t, mp: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 };
      });
    });

    groupMatches.forEach(m => {
      const pred = currentPredictions[m.id];
      // Use actual result if available (status === 'finished'), otherwise use prediction
      const homeScore = m.status === 'finished' ? m.homeScore : pred?.homeScore;
      const awayScore = m.status === 'finished' ? m.awayScore : pred?.awayScore;

      if (homeScore !== undefined && awayScore !== undefined) {
        const home = teams[m.homeTeam];
        const away = teams[m.awayTeam];
        
        home.mp++;
        away.mp++;
        home.gf += homeScore;
        home.ga += awayScore;
        away.gf += awayScore;
        away.ga += homeScore;

        if (homeScore > awayScore) {
          home.w++; home.pts += 3;
          away.l++;
        } else if (homeScore < awayScore) {
          away.w++; away.pts += 3;
          home.l++;
        } else {
          home.d++; away.d++;
          home.pts += 1; away.pts += 1;
        }
      }
    });

    return Object.values(teams).sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      const diffA = a.gf - a.ga;
      const diffB = b.gf - b.ga;
      if (diffB !== diffA) return diffB - diffA;
      return b.gf - a.gf;
    });
  };

  const getPointsEarned = (match: any, pred: any) => {
    if (match.status !== 'finished' || !pred) return '-';
    let pts = 0;
    if (pred.homeScore === match.homeScore && pred.awayScore === match.awayScore) pts = 15;
    else if (Math.sign(pred.homeScore - pred.awayScore) === Math.sign(match.homeScore - match.awayScore)) pts = 8;
    return pts;
  };

  return (
    <div className="space-y-16 pb-20">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-6 px-4">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter italic">Mis <span className="text-brand-gold">Predicciones</span></h1>
          <p className="text-brand-zinc-500 text-xs font-bold uppercase tracking-widest mt-2">Mundial 2026 • Panel Oficial de Previsión</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={downloadPDF}
            disabled={isExporting}
            className="flex items-center gap-3 bg-white/5 border border-white/10 px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-brand-gold hover:text-black transition-all group"
          >
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin text-brand-gold" /> : <FileDown className="w-4 h-4 group-hover:scale-110 transition-transform" />}
            Descargar PDF
          </button>
          <button onClick={() => window.location.reload()} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-brand-zinc-400 hover:text-white transition-colors group">
            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Inicio
          </button>
        </div>
      </div>

      <div ref={pdfRef} className="space-y-12 p-2 md:p-6 bg-transparent">
        {/* Selection Scorer (Compact) */}
        <section className="space-y-6">
           <div className="flex items-center gap-3">
             <div className="w-1 h-5 bg-brand-gold rounded-full" />
             <h2 className="text-lg font-black uppercase tracking-tighter italic">Tu <span className="text-brand-gold">Goleador Estrella</span></h2>
           </div>
           <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
             {scorers.map(s => (
               <button 
                 key={s.id}
                 onClick={() => saveScorer(s.id)}
                 className={`flex-shrink-0 flex items-center gap-4 px-5 py-3 rounded-2xl border transition-all ${
                   user?.selectedScorerId === s.id 
                   ? 'bg-brand-gold text-black border-brand-gold shadow-[0_10px_20px_rgba(209,178,0,0.2)]' 
                   : 'bg-white/5 border-white/10 text-brand-zinc-400 hover:border-white/20'
                 }`}
               >
                 <div className="w-10 h-10 rounded-xl overflow-hidden border border-white/20">
                   <img src={s.photoUrl} className="w-full h-full object-cover" alt="" />
                 </div>
                 <div className="text-left">
                   <p className="text-[10px] font-black uppercase tracking-tight leading-none">{s.name}</p>
                   <p className={`text-[8px] font-bold uppercase tracking-widest mt-1 ${user?.selectedScorerId === s.id ? 'text-black/60' : 'text-brand-zinc-500'}`}>{s.team}</p>
                 </div>
                 {user?.selectedScorerId === s.id && <CheckCircle2 className="w-4 h-4 ml-2" />}
               </button>
             ))}
           </div>
        </section>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 pb-4 border-b border-white/10">
          <button 
            onClick={() => setActiveFilter('all')}
            className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeFilter === 'all' ? 'bg-brand-gold text-black shadow-lg shadow-brand-gold/20' : 'bg-white/5 text-brand-zinc-500 hover:text-white'}`}
          >
            Todos
          </button>
          <button 
            onClick={() => setActiveFilter('knockout')}
            className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeFilter === 'knockout' ? 'bg-brand-accent text-white shadow-lg shadow-brand-accent/20' : 'bg-white/5 text-brand-zinc-500 hover:text-white'}`}
          >
            Fase Final
          </button>
          <div className="w-px h-6 bg-white/10 mx-2 hidden sm:block" />
          <div className="flex flex-wrap gap-2">
            {groupFilterList.map(g => (
              <button 
                key={g}
                onClick={() => setActiveFilter(g)}
                className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeFilter === g ? 'bg-white/20 text-white' : 'bg-white/5 text-brand-zinc-500 hover:text-white'}`}
              >
                G{g}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-24">
          {(Object.entries(matchesByGroup) as [string, any[]][]).map(([name, groupMatches]) => {
            const isKnockout = !name.toLowerCase().includes('grupo');
            const groupStandings = isKnockout ? [] : calculateStandings(groupMatches, predictions);
            
            return (
              <div key={name} className="relative group/section">
                <div className="absolute -left-4 top-0 bottom-0 w-1 bg-brand-gold/20 group-hover/section:bg-brand-gold transition-colors rounded-full" />
                
                <div className="flex flex-col lg:flex-row gap-8">
                  {/* Matches List */}
                  <div className={`flex-1 space-y-4 ${isKnockout ? 'lg:max-w-4xl' : ''}`}>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xl font-black uppercase tracking-[0.2em] italic text-white flex items-center gap-3">
                        {name} <span className="text-[10px] font-bold tracking-widest text-brand-zinc-500 not-italic border-l border-white/20 pl-3">Partidos</span>
                      </h3>
                      {!isKnockout && <span className="text-[9px] font-black uppercase tracking-widest text-brand-gold bg-brand-gold/10 px-3 py-1 rounded-full border border-brand-gold/20">6 Partidos</span>}
                    </div>

                    <div className="grid gap-2">
                      {groupMatches.map(match => {
                        const locked = isLocked(match);
                        const pred = predictions[match.id];
                        const earned = getPointsEarned(match, pred);
                        const isSaving = savingId === match.id;

                        return (
                          <div key={match.id} className={`grid grid-cols-[1fr_80px_1fr_100px_40px] md:grid-cols-[180px_1fr_100px_1fr_120px_60px] items-center gap-2 p-3 rounded-xl border transition-all ${locked ? 'bg-white/[0.01] border-white/5' : 'bg-white/5 border-white/10 hover:border-brand-gold/30 hover:bg-white/[0.07]'}`}>
                            
                            {/* Date (Desktop) */}
                            <div className="hidden md:flex flex-col">
                              <span className="text-[9px] font-black uppercase text-brand-zinc-500 leading-none mb-1">{new Date(match.date).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                              <span className="text-xs font-bold text-white/60 tracking-tighter">{new Date(match.date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}h</span>
                            </div>

                            {/* Home Team */}
                            <div className="flex items-center gap-3 justify-end">
                              <span className="text-[10px] font-black uppercase text-right leading-tight truncate">{match.homeTeam}</span>
                              <div className="w-8 h-5 rounded-[2px] overflow-hidden border border-white/10 shrink-0">
                                <img src={getFlagUrl(match.homeTeam)} className="w-full h-full object-cover scale-125" alt="" />
                              </div>
                            </div>

                            {/* Score Inputs */}
                            <div className="flex items-center justify-center gap-1.5">
                              <input 
                                type="number" 
                                min="0"
                                value={pred?.homeScore ?? ''}
                                onChange={e => handleScoreChange(match.id, 'home', e.target.value)}
                                onBlur={() => savePrediction(match.id)}
                                disabled={locked}
                                className="w-8 h-9 md:w-10 md:h-10 bg-black/40 border border-brand-gold/30 rounded-lg text-center text-sm font-black focus:border-brand-gold outline-none disabled:opacity-40 transition-all"
                              />
                              <span className="text-brand-gold/40 font-black text-xs">-</span>
                              <input 
                                type="number" 
                                min="0"
                                value={pred?.awayScore ?? ''}
                                onChange={e => handleScoreChange(match.id, 'away', e.target.value)}
                                onBlur={() => savePrediction(match.id)}
                                disabled={locked}
                                className="w-8 h-9 md:w-10 md:h-10 bg-black/40 border border-brand-gold/30 rounded-lg text-center text-sm font-black focus:border-brand-gold outline-none disabled:opacity-40 transition-all"
                              />
                            </div>

                            {/* Away Team */}
                            <div className="flex items-center gap-3 justify-start">
                              <div className="w-8 h-5 rounded-[2px] overflow-hidden border border-white/10 shrink-0">
                                <img src={getFlagUrl(match.awayTeam)} className="w-full h-full object-cover scale-125" alt="" />
                              </div>
                              <span className="text-[10px] font-black uppercase tracking-tight leading-tight truncate">{match.awayTeam}</span>
                            </div>

                            {/* Info (Desktop) / Date (Mobile) */}
                            <div className="flex flex-col items-center justify-center text-center">
                              <div className="md:hidden flex flex-col items-end mr-4">
                                <span className="text-[8px] font-bold text-brand-zinc-500 uppercase">{new Date(match.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</span>
                                <span className="text-[9px] font-black text-white/40">{new Date(match.date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                              <div className="hidden md:block">
                                <span className="text-[8px] font-black text-brand-gold/50 uppercase tracking-widest block mb-0.5">Televisión</span>
                                <span className="text-[9px] font-bold text-white/50 truncate max-w-[80px]">{match.channel || 'SKY SPORTS'}</span>
                              </div>
                            </div>

                            {/* Points */}
                            <div className="flex flex-col items-center justify-center">
                               {isSaving ? (
                                 <Loader2 className="w-3 h-3 animate-spin text-brand-gold" />
                               ) : locked ? (
                                 <div className="flex flex-col items-center">
                                   <span className="text-[8px] font-black text-brand-gold uppercase leading-none">Pts</span>
                                   <span className={`text-sm font-black ${earned === 15 ? 'text-emerald-500' : earned === 8 ? 'text-brand-gold' : 'text-brand-zinc-500'}`}>{earned}</span>
                                 </div>
                               ) : (
                                 <CheckCircle2 className={`w-4 h-4 ${pred?.homeScore !== undefined && pred?.awayScore !== undefined ? 'text-emerald-500 opacity-40' : 'text-white opacity-5'}`} />
                               )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Standing Table */}
                  {!isKnockout && (
                    <div className="w-full lg:w-[320px] bg-white/[0.02] border border-white/5 rounded-2xl p-5 h-fit mt-12 lg:mt-11">
                       <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-brand-zinc-400 mb-6 flex items-center gap-3">
                         <Trophy className="w-3 h-3 text-brand-gold" /> Clasificación
                       </h4>
                       <table className="w-full text-[10px]">
                         <thead>
                           <tr className="text-brand-zinc-500 uppercase border-b border-white/5">
                             <th className="pb-3 text-left font-black">Equipo</th>
                             <th className="pb-3 px-1 text-center font-black">PJ</th>
                             <th className="pb-3 px-1 text-center font-black">DG</th>
                             <th className="pb-3 text-right font-black">Pts</th>
                           </tr>
                         </thead>
                         <tbody className="divide-y divide-white/[0.03]">
                           {groupStandings.map((team, idx) => (
                             <tr key={team.name} className="group/row hover:bg-white/[0.02] transition-colors">
                               <td className="py-3 flex items-center gap-2">
                                 <span className={`w-1.5 h-1.5 rounded-full ${idx < 2 ? 'bg-emerald-500' : 'bg-brand-zinc-700'}`} />
                                 <div className="w-5 h-3 rounded-[1px] overflow-hidden border border-white/10 shrink-0">
                                   <img src={getFlagUrl(team.name)} className="w-full h-full object-cover scale-150" alt="" />
                                 </div>
                                 <span className="font-black uppercase text-brand-zinc-300 truncate max-w-[100px]">{team.name}</span>
                               </td>
                               <td className="py-3 px-1 text-center font-bold text-white/40">{team.mp}</td>
                               <td className="py-3 px-1 text-center font-bold text-white/40">{(team.gf - team.ga) > 0 ? `+${team.gf - team.ga}` : (team.gf - team.ga)}</td>
                               <td className="py-3 text-right font-black text-brand-gold text-xs">{team.pts}</td>
                             </tr>
                           ))}
                         </tbody>
                       </table>
                       <p className="mt-6 text-[8px] font-bold text-brand-zinc-600 uppercase tracking-widest text-center">
                         * Clasifican los 2 primeros de cada grupo
                       </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Footer Branding */}
      <div className="pt-20 border-t border-white/5 text-center px-6">
        <p className="text-[10px] font-black uppercase tracking-[0.6em] text-brand-zinc-700">Panel Oficial de Pronósticos © 2026</p>
      </div>


      {/* Scorer Detail Modal */}
      <AnimatePresence>
        {selectedScorerInfo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="dimension-card-accent w-full max-w-lg p-8 relative"
            >
              <button onClick={() => setSelectedScorerInfo(null)} className="absolute top-4 right-4 text-brand-zinc-500 hover:text-white">
                <AlertCircle className="w-6 h-6 rotate-45" />
              </button>

              <div className="flex flex-col sm:flex-row items-center gap-8">
                <div className="w-32 h-32 rounded-3xl bg-brand-zinc-900 border border-brand-gold/20 overflow-hidden shrink-0 relative">
                  <img src={selectedScorerInfo.photoUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedScorerInfo.name)}&background=AE9C50&color=000&bold=true`; }} />
                  <img src={getFlagUrl(selectedScorerInfo.team)} className="absolute bottom-2 right-2 w-8 h-5 object-cover border border-white/20 rounded shadow-lg" alt="" referrerPolicy="no-referrer" />
                </div>
                <div className="text-center sm:text-left space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-gold">{selectedScorerInfo.team}</span>
                  <h3 className="text-3xl font-black uppercase tracking-tighter italic">{selectedScorerInfo.name}</h3>
                  <div className="inline-block px-3 py-1 bg-brand-gold/10 border border-brand-gold/20 rounded-full text-[10px] font-bold text-brand-gold uppercase tracking-widest">
                    {selectedScorerInfo.status}
                  </div>
                </div>
              </div>

              <div className="mt-10 grid gap-4">
                <div className="p-4 bg-white/5 rounded-2xl border border-white/5 flex items-start gap-4">
                  <Trophy className="w-5 h-5 text-brand-gold mt-1" />
                  <div>
                    <p className="text-[10px] font-black uppercase text-brand-zinc-500 tracking-widest mb-1">Historia Goleadora</p>
                    <p className="text-sm font-bold text-white">{selectedScorerInfo.history}</p>
                  </div>
                </div>
                <div className="p-4 bg-white/5 rounded-2xl border border-white/5 flex items-start gap-4">
                  <Target className="w-5 h-5 text-brand-accent mt-1" />
                  <div>
                    <p className="text-[10px] font-black uppercase text-brand-zinc-500 tracking-widest mb-1">Claves del Torneo</p>
                    <p className="text-sm font-bold text-white">{selectedScorerInfo.average}</p>
                  </div>
                </div>
              </div>

              <button 
                onClick={() => { saveScorer(selectedScorerInfo.id); setSelectedScorerInfo(null); }}
                className="w-full mt-10 py-5 bg-brand-gold text-brand-black text-xs font-black uppercase tracking-[0.3em] rounded-2xl hover:brightness-110 active:scale-95 transition-all shadow-[0_15px_30px_rgba(209,178,0,0.2)]"
              >
                Elegir como mi Killer
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

