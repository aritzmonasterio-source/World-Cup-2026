# World Cup 2026 Predictor

Juego privado para el Mundial 2026 con registro por email, aprobación de usuarios, pronósticos, ranking y sincronización del calendario oficial de FIFA.

Incluye tres comunidades independientes dentro del mismo entorno:

- Dimension Football: estética oro/antracita y logo propio.
- Athletic Club: estética negro, rojo y gris antracita.
- Crossfit 7AM: estética azul noche, blanco y naranja.

## Stack

- React + Vite
- Supabase Auth, Postgres, RLS, Edge Functions y Cron
- Vercel para previews y producción desde GitHub
- Fuente de calendario/resultados: `https://api.fifa.com/api/v3/calendar/matches?idCompetition=17&idSeason=285023&language=en&count=120`

## Desarrollo local

1. Crea un proyecto en Supabase.
2. Copia `.env.example` a `.env.local` y rellena:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_ADMIN_EMAIL`
3. Instala dependencias:
   ```bash
   npm install
   ```
4. Aplica migraciones:
   ```bash
   supabase link --project-ref YOUR_PROJECT_REF
   supabase db push
   ```
5. Despliega la función:
   ```bash
   supabase functions deploy sync-fifa-matches
   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
   ```
6. Ejecuta la app:
   ```bash
   npm run dev
   ```

## Primer uso

- Regístrate con el email definido en `VITE_ADMIN_EMAIL` para crear el admin.
- Entra en la vista `Admin`.
- Pulsa `Sincronizar FIFA` para cargar los 104 partidos.
- Aprueba usuarios registrados.
- Cada comunidad tiene su propia aprobación, pronósticos y ranking.
- Usa `Recalcular` tras correcciones manuales.

## Sistema de puntos

- Resultado exacto: 15 puntos.
- Ganador/empate acertado: 8 puntos.
- Goleador elegido: 10 puntos por cada gol oficial registrado.
- Clasificación de grupo: 8 puntos por puesto exacto y 5 puntos por clasificado acertado sin puesto exacto.
- Eliminatorias: los cruces reales los marca FIFA. Solo puntúa el marcador: 15 puntos por resultado exacto o 8 por signo.

## Fechas límite

- Por defecto, grupos y clasificados cierran el 11 junio 2026, 20:30 Europe/Madrid.
- Por defecto, el goleador usa su propio cierre y el admin puede reabrirlo desde `Admin`.
- Las eliminatorias cierran por ronda: cada ronda se puede editar hasta un minuto antes del primer partido de esa ronda.
- Los cruces se actualizan automáticamente desde FIFA; si un marcador ya estaba guardado, se mantiene sobre el partido real correspondiente.
- El admin puede reabrir plazos por comunidad, por ronda o por jugador sin tocar código. Aunque haya reapertura, ningún jugador puede modificar un partido que ya esté a menos de un minuto de empezar, en directo o finalizado.
- Mientras una fase o ronda está reabierta, esos pronósticos permanecen ocultos para rivales hasta el nuevo cierre.

## Vercel

Conecta este repo a Vercel como proyecto Vite. Añade las variables `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` y `VITE_ADMIN_EMAIL` en Production, Preview y Development.

La sincronización fiable debe vivir en Supabase Cron, no en Vercel Hobby Cron, porque durante el torneo necesitaremos más frecuencia que una vez al día.
