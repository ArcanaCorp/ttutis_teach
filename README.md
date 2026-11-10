# TTUTIS Teach

App móvil de TTUTIS para docentes y auxiliares, hecha con Expo, React Native y JavaScript.

## Configuración

1. Instala las dependencias con `npm install`.
2. Copia los valores públicos de Supabase del panel TTUTIS a `.env.local` usando los nombres `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. `.env.example` muestra el formato. No uses la clave `SUPABASE_SERVICE_ROLE_KEY` en la app móvil.
3. Inicia Expo con `npx expo start`.

El inicio de sesión usa el mismo endpoint `sign-in-with-code` y el mismo proyecto Supabase de las otras apps TTUTIS. Las políticas de Supabase siguen siendo la fuente de autorización.

Las Edge Functions `sign-in-with-code` y `teacher-tools` viven en `supabase/functions/`. Después de enlazar este directorio al mismo proyecto TTUTIS, despliega ambas con `supabase functions deploy sign-in-with-code` y `supabase functions deploy teacher-tools`.

Antes de desplegar `teacher-tools`, configura en Supabase sus claves del proyecto (`SUPABASE_URL`, la clave publicable/anon y la clave secreta/service role). La clave secreta solo se usa dentro de la Edge Function. Aplica las migraciones con `supabase db push`; eso instala las tablas y políticas de exámenes y notas.

## Funciones incluidas

- Inicio de sesión con código de acceso y contraseña.
- Sesión persistente en el dispositivo.
- Portada, horario detallado y lista de alumnos por aula.
- Escaneo QR para registrar observaciones y, para tutores, citaciones al aula.
- Calendario de evaluaciones y registro de notas finales.
- Perfil con institución, cuenta y rol.

El QR utiliza `student_updates` del esquema compartido de comunicaciones. Las notas usan las tablas nuevas `classroom_assessments` y `classroom_assessment_grades`, protegidas con políticas RLS para personal docente autorizado.

## Comandos

- `npx expo start`: iniciar la app.
- `npx expo lint`: revisar el código.
