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
- Clasificados de grupo: 15 puntos por cada clasificado acertado en su posición clasificatoria.
- Eliminatorias: 10 puntos por cada equipo acertado, solo si el enfrentamiento previsto coincide con el cruce real.

## Fechas límite

- Grupos, clasificados y goleador: 9 junio 2026, 23:59 Europe/Madrid.
- Toda la fase eliminatoria: 28 junio 2026, 10:00 Europe/Madrid.
- Los cruces que aún no estén definidos se pronostican igualmente como previsión de cuadro.

## Vercel

Conecta este repo a Vercel como proyecto Vite. Añade las variables `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` y `VITE_ADMIN_EMAIL` en Production, Preview y Development.

La sincronización fiable debe vivir en Supabase Cron, no en Vercel Hobby Cron, porque durante el torneo necesitaremos más frecuencia que una vez al día.
