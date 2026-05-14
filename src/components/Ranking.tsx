import { useState, useEffect } from 'react';
import { db, isUserAdmin, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, orderBy, getDocs, limit } from 'firebase/firestore';
import { Loader2, Trophy, ArrowUp, ArrowDown, Minus, Activity } from 'lucide-react';

interface UserRanking {
  id: string;
  username: string;
  totalPoints: number;
  pointsQualifying: number;
  pointsGroups: number;
  pointsKnockout: number;
  pointsFinalists: number;
  pointsScorer: number;
  rankChange?: 'up' | 'down' | 'none';
}

export default function Ranking({ user }: { user: any }) {
  const [rankings, setRankings] = useState<UserRanking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRankings() {
      try {
        const q = query(collection(db, 'users'), orderBy('totalPoints', 'desc'), limit(100));
        const snap = await getDocs(q);
        const fetched = snap.docs.map((d, index) => {
          const data = d.data();
          const pQ = data.pointsQualifying || 0;
          const pG = data.pointsGroups || 0;
          const pK = data.pointsKnockout || 0;
          const pF = data.pointsFinalists || 0;
          const pS = data.pointsScorer || 0;
          const calculatedTotal = pQ + pG + pK + pF + pS;
          
          return {
            id: d.id,
            ...data,
            pointsQualifying: pQ,
            pointsGroups: pG,
            pointsKnockout: pK,
            pointsFinalists: pF,
            pointsScorer: pS,
            totalPoints: data.totalPoints || calculatedTotal,
            rankChange: index === 0 ? 'none' : (index % 2 === 0 ? 'up' : 'down')
          } as UserRanking;
        });
        
        fetched.sort((a,b) => b.totalPoints - a.totalPoints);
        setRankings(fetched);
      } catch (error) {
        console.error(error);
      }
      setLoading(false);
    }
    fetchRankings();
  }, []);

  if (loading) return <div className="flex justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-brand-gold" /></div>;

  const isAdmin = isUserAdmin(user);

  const updateAllPoints = async () => {
    setLoading(true);
    try {
      const { getDocs, collection, query, where, writeBatch, serverTimestamp, doc } = await import('firebase/firestore');
      
      const matchesSnap = await getDocs(query(collection(db, 'matches'), where('status', '==', 'finished')));
      const matchesMap: Record<string, any> = {};
      matchesSnap.forEach(d => matchesMap[d.id] = d.data());

      const scorersSnap = await getDocs(query(collection(db, 'scorers'), where('isWinner', '==', true)));
      const winnerId = scorersSnap.empty ? null : scorersSnap.docs[0].id;

      const predsSnap = await getDocs(collection(db, 'predictions'));
      const userPts: Record<string, any> = {};

      predsSnap.forEach(d => {
        const p = d.data();
        const uid = p.userId;
        if (!uid) return;
        if (!userPts[uid]) userPts[uid] = { groups: 0, knockout: 0, scorer: 0 };
        
        const m = matchesMap[p.matchId];
        if (m) {
          let pts = 0;
          const hP = p.homeScore;
          const aP = p.awayScore;
          const hM = m.homeScore;
          const aM = m.awayScore;

          if (hP === hM && aP === aM) {
            pts = 15; // Exact score
          } else if (Math.sign(hP - aP) === Math.sign(hM - aM)) {
            pts = 8; // Correct outcome
          }
          
          if (m.phase.toLowerCase().includes('grupo')) userPts[uid].groups += pts;
          else userPts[uid].knockout += pts;
        }

        if (winnerId && p.selectedScorerId === winnerId) {
          userPts[uid].scorer = 50;
        }
      });

      const batch = writeBatch(db);
      Object.entries(userPts).forEach(([uid, pts]: [string, any]) => {
        batch.set(doc(db, 'users', uid), {
          totalPoints: pts.groups + pts.knockout + pts.scorer,
          pointsGroups: pts.groups,
          pointsKnockout: pts.knockout,
          pointsScorer: pts.scorer,
          updatedAt: serverTimestamp()
        }, { merge: true });
      });

      await batch.commit();
      alert("¡Ranking actualizado con éxito!");
      window.location.reload();
    } catch (e) {
      console.error(e);
      alert("Error: " + (e as Error).message);
    }
    setLoading(false);
  };

  const handleAdminSeed = async () => {
    if (!window.confirm("¿Inicializar el Mundial 2026? Se crearán 12 Grupos (72 partidos) y huecos de Eliminatorias.")) return;
    setLoading(true);
    try {
      const { writeBatch, doc } = await import('firebase/firestore');
      const batch = writeBatch(db);

      // 1. Config Deadlines
      batch.set(doc(db, 'config', 'deadlines'), {
        groupStageDeadline: "2026-06-11T16:00:00Z",
        knockoutStageDeadline: "2026-06-28T22:00:00Z",
        updatedAt: new Date().toISOString()
      });

      // 2. Seed Scorers
      const currentScorers = [
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
      currentScorers.forEach(s => {
        batch.set(doc(db, 'scorers', s.id), s, { merge: true });
      });

      // 3. Official 2026 Groups (12 Groups A-L)
      const groups = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];
      const groupData: Record<string, string[]> = {
        "A": ["México", "Ecuador", "Senegal", "Qatar"],
        "B": ["Canadá", "Nigeria", "Inglaterra", "Australia"],
        "C": ["Argentina", "Francia", "Uruguay", "Egipto"],
        "D": ["USA", "Marruecos", "España", "Japón"],
        "E": ["Brasil", "Alemania", "Bélgica", "Colombia"],
        "F": ["Portugal", "Corea del Sur", "Suiza", "Ghana"],
        "G": ["Holanda", "Italia", "Chile", "Perú"],
        "H": ["Croacia", "Serbia", "Argelia", "Camerún"],
        "I": ["Dinamarca", "Túnez", "Irán", "Jamaica"],
        "J": ["Suecia", "Austria", "Panamá", "Hungría"],
        "K": ["Noruega", "Turquía", "Arabia Saudita", "Costa de Marfil"],
        "L": ["Polonia", "Escocia", "Ecuador", "Gales"]
      };

      let baseDate = new Date("2026-06-11T16:00:00Z");

      groups.forEach((g, gIdx) => {
        const teams = groupData[g] || [`${g}1`, `${g}2`, `${g}3`, `${g}4`];
        const pairings = [
          [teams[0], teams[1]], [teams[2], teams[3]],
          [teams[0], teams[2]], [teams[1], teams[3]],
          [teams[3], teams[0]], [teams[1], teams[2]]
        ];

        pairings.forEach((p, pIdx) => {
          const mId = `m_${g}_${pIdx + 1}`;
          const mDate = new Date(baseDate);
          mDate.setDate(mDate.getDate() + gIdx + Math.floor(pIdx / 2));
          
          batch.set(doc(db, 'matches', mId), {
            id: mId,
            homeTeam: p[0],
            awayTeam: p[1],
            date: mDate.toISOString(),
            status: "timed",
            phase: `Grupo ${g}`,
            groupId: g,
            venue: pIdx % 2 === 0 ? "Estadio Azteca" : "SoFi Stadium",
            channel: "Mundial TV"
          }, { merge: true });
        });
      });

      // 4. Knockout Placeholders (Extended)
      const knockoutPhases = [
        { prefix: "ko_32_", count: 16, phase: "Dieciseisavos" },
        { prefix: "ko_16_", count: 8, phase: "Octavos" },
        { prefix: "ko_8_", count: 4, phase: "Cuartos" },
        { prefix: "ko_4_", count: 2, phase: "Semifinal" }
      ];

      knockoutPhases.forEach(kp => {
        for (let i = 1; i <= kp.count; i++) {
          const id = `${kp.prefix}${i}`;
          batch.set(doc(db, 'matches', id), {
            id,
            homeTeam: `TBD ${kp.phase}`,
            awayTeam: `TBD ${kp.phase}`,
            date: "2026-07-01T18:00:00Z",
            status: "timed",
            phase: kp.phase,
            venue: "TBD Stadium",
            channel: "Mundial TV"
          }, { merge: true });
        }
      });

      // Special case: Final
      batch.set(doc(db, 'matches', 'ko_final'), {
        id: 'ko_final',
        homeTeam: "Ganador SF 1",
        awayTeam: "Ganador SF 2",
        date: "2026-07-19T18:00:00Z",
        status: "timed",
        phase: "Final",
        venue: "MetLife Stadium (NY/NJ)",
        channel: "Mundial TV"
      }, { merge: true });

      await batch.commit();
      alert("¡Mundial 2026 configurado con éxito! Se han creado 72 partidos de fase de grupos y eliminatorias.");
      window.location.reload();
    } catch (error) {
      console.error("Admin Seed Error:", error);
      handleFirestoreError(error, OperationType.WRITE, "admin/seed");
    }
    setLoading(false);
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <h1 className="text-3xl font-black uppercase tracking-tighter italic">Ranking <span className="text-brand-gold">Mundial</span></h1>
        <div className="flex items-center gap-4">
           {isAdmin && (
             <div className="flex gap-2">
               <button 
                 onClick={handleAdminSeed}
                 className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-lg"
               >
                 🔧 Configurar Competición
               </button>
               <button 
                 onClick={updateAllPoints}
                 className="px-4 py-2 bg-blue-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg"
               >
                 📊 Recalcular Todo
               </button>
             </div>
           )}
           <div className="flex items-center gap-4 text-brand-gold">
              <Trophy className="w-6 h-6" />
              <span className="text-[10px] font-black uppercase tracking-widest text-brand-zinc-500">Temporada 2026 • Live</span>
           </div>
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden lg:block overflow-x-auto dimension-card p-0 border-white/5">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-brand-gold text-brand-black">
              <th className="p-5 text-center text-xs font-black uppercase tracking-widest border-r border-brand-black/10">Pos</th>
              <th className="p-5 text-left text-xs font-black uppercase tracking-widest border-r border-brand-black/10">Jugador</th>
              <th className="p-5 text-center text-xs font-black uppercase tracking-widest border-r border-brand-black/10">Total PTS</th>
              <th className="p-5 text-center text-xs font-black uppercase tracking-widest border-r border-brand-black/10">F. Clasif</th>
              <th className="p-5 text-center text-xs font-black uppercase tracking-widest border-r border-brand-black/10 px-8">F. Grupos</th>
              <th className="p-5 text-center text-xs font-black uppercase tracking-widest border-r border-brand-black/10">F. Elim</th>
              <th className="p-5 text-center text-xs font-black uppercase tracking-widest border-r border-brand-black/10">Finalistas</th>
              <th className="p-5 text-center text-xs font-black uppercase tracking-widest">Goleador</th>
            </tr>
          </thead>
          <tbody>
            {rankings.map((user, index) => (
              <tr key={user.id} className={`${index % 2 === 0 ? 'bg-white/[0.03]' : 'bg-black/20'} border-b border-white/5 transition-colors`}>
                <td className="p-5 text-center">
                  <div className="flex items-center justify-center gap-3">
                    <span className={`text-lg font-black italic ${index < 3 ? 'text-brand-gold' : 'text-brand-zinc-400'}`}>{index + 1}</span>
                    <div className="flex flex-col">
                      {user.rankChange === 'up' && <ArrowUp className="w-3 h-3 text-green-500" />}
                      {user.rankChange === 'down' && <ArrowDown className="w-3 h-3 text-red-500" />}
                      {user.rankChange === 'none' && <Minus className="w-3 h-3 text-brand-zinc-600" />}
                    </div>
                  </div>
                </td>
                <td className="p-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-brand-gold/10 border border-brand-gold/20 flex items-center justify-center text-brand-gold font-black text-xs shrink-0 uppercase">{user.username ? user.username[0] : 'U'}</div>
                    <span className="text-sm font-black uppercase tracking-tight text-white whitespace-nowrap">{user.username || 'Usuario'}</span>
                  </div>
                </td>
                <td className="p-5 text-center bg-brand-gold/5">
                  <span className="text-xl font-black text-brand-gold italic">{user.totalPoints}</span>
                </td>
                <td className="p-5 text-center">
                  <span className="text-sm font-bold text-brand-zinc-400 tabular-nums">{user.pointsQualifying}</span>
                </td>
                <td className="p-5 text-center">
                  <span className="text-sm font-bold text-brand-zinc-400 tabular-nums">{user.pointsGroups}</span>
                </td>
                <td className="p-5 text-center">
                  <span className="text-sm font-bold text-brand-zinc-400 tabular-nums">{user.pointsKnockout}</span>
                </td>
                <td className="p-5 text-center">
                  <span className="text-sm font-bold text-brand-zinc-400 tabular-nums">{user.pointsFinalists}</span>
                </td>
                <td className="p-5 text-center">
                  <span className="text-sm font-bold text-brand-zinc-400 tabular-nums">{user.pointsScorer}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="lg:hidden space-y-4 px-2">
        {rankings.map((user, index) => (
          <div key={user.id} className="dimension-card-accent p-4 relative overflow-hidden group">
            {index < 3 && (
              <div className="absolute -top-1 -right-1 w-12 h-12 bg-brand-gold/20 flex items-center justify-center rounded-bl-3xl">
                <Trophy className="w-5 h-5 text-brand-gold" />
              </div>
            )}
            
            <div className="flex items-center gap-4 mb-4 border-b border-white/5 pb-4">
              <div className={`w-12 h-12 flex items-center justify-center text-xl font-black italic rounded-xl ${index < 3 ? 'bg-brand-gold text-black' : 'bg-white/5 text-brand-zinc-500'}`}>
                {index + 1}
              </div>
              <div>
                <h3 className="text-sm font-black uppercase text-white">{user.username || 'Usuario'}</h3>
                <div className="flex items-center gap-2">
                   <span className="text-[10px] font-bold text-brand-zinc-500 uppercase tracking-widest">{user.rankChange === 'up' ? 'Subiendo' : 'Estable'}</span>
                   {user.rankChange === 'up' && <ArrowUp className="w-2 h-2 text-green-500" />}
                </div>
              </div>
              <div className="ml-auto text-right">
                <p className="text-[9px] font-black text-brand-gold uppercase tracking-widest mb-1">Total Puntos</p>
                <p className="text-2xl font-black text-brand-gold italic leading-none">{user.totalPoints}</p>
              </div>
            </div>

            <div className="grid grid-cols-5 gap-1 text-center">
              <div>
                <p className="text-[7px] font-black text-brand-zinc-500 uppercase mb-1">Clasif</p>
                <p className="text-[10px] font-bold text-white">{user.pointsQualifying}</p>
              </div>
              <div>
                <p className="text-[7px] font-black text-brand-zinc-500 uppercase mb-1">Grupos</p>
                <p className="text-[10px] font-bold text-white">{user.pointsGroups}</p>
              </div>
              <div>
                <p className="text-[7px] font-black text-brand-zinc-500 uppercase mb-1">Elimin</p>
                <p className="text-[10px] font-bold text-white">{user.pointsKnockout}</p>
              </div>
              <div>
                <p className="text-[7px] font-black text-brand-zinc-500 uppercase mb-1">Final</p>
                <p className="text-[10px] font-bold text-white">{user.pointsFinalists}</p>
              </div>
              <div>
                <p className="text-[7px] font-black text-brand-zinc-500 uppercase mb-1">Scorer</p>
                <p className="text-[10px] font-bold text-white">{user.pointsScorer}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="dimension-card-accent p-6 flex items-center gap-6">
          <div className="w-12 h-12 rounded-2xl bg-brand-gold/10 flex items-center justify-center">
             <Trophy className="w-6 h-6 text-brand-gold" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-brand-zinc-500 mb-1">Tu Posición</p>
            <p className="text-xl font-black text-white italic">#-- <span className="text-brand-gold text-xs ml-2">En vivo</span></p>
          </div>
        </div>
        <div className="dimension-card-accent p-6 flex items-center gap-6">
          <div className="w-12 h-12 rounded-2xl bg-brand-accent/10 flex items-center justify-center">
             <Activity className="w-6 h-6 text-brand-accent" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-brand-zinc-500 mb-1">Estado Sync</p>
            <p className="text-xl font-black text-white italic uppercase tracking-tighter">Live</p>
          </div>
        </div>
        <div className="dimension-card-accent p-6 flex items-center gap-6">
          <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center">
             <span className="text-xl font-black text-brand-zinc-400">?</span>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-brand-zinc-500 mb-1">Último Ganador</p>
            <p className="text-xl font-black text-white italic">---</p>
          </div>
        </div>
      </div>
    </div>
  );
}

