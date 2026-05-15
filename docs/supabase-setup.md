# Supabase Setup

1. Crea un proyecto nuevo en Supabase.
2. En Authentication, activa Email + Password y confirmación por email.
3. En SQL/Migrations, aplica los archivos de `supabase/migrations`.
4. En Edge Functions, despliega `sync-fifa-matches`.
5. En Secrets, define `SUPABASE_SERVICE_ROLE_KEY`.
6. En la app, inicia sesión con `aritzmonasterio@gmail.com` para crear el admin.
7. Desde `Admin`, pulsa `Sincronizar FIFA`.

## Cron recomendado

Durante el torneo:

- Cada 15 minutos fuera de ventanas de partido.
- Cada 1-5 minutos durante partidos en directo.

La migración `202605140002_scoring_and_cron.sql` incluye un bloque comentado para crear el cron con `pg_cron` + `pg_net` cuando tengas la URL y la key del proyecto.

## Google Auth

El botón de Google está desactivado por defecto para evitar pantallas en blanco cuando el proveedor OAuth aún no está configurado en Supabase.

Para activarlo:

1. Configura Google Provider en Supabase Authentication.
2. Añade las redirect URLs locales y de Vercel.
3. Define `VITE_ENABLE_GOOGLE_AUTH="true"` en local y Vercel.
