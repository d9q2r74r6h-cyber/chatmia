# ChatMia

Plataforma de videochat aleatorio en tiempo real tipo Chatroulette.

## Estructura real

```text
chatmia2/
  backend/   Node.js + Express + Socket.IO + Supabase service role
  frontend/  Next.js + TypeScript + TailwindCSS + WebRTC
```

## Frontend

```bash
cd frontend
npm run dev
npm run lint
npx tsc --noEmit --incremental false
```

Variables principales:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SOCKET_URL=
```

## Backend

```bash
cd backend
npm start
```

Variables principales:

```env
PORT=4000
FRONTEND_ORIGIN=https://chatmia.org,https://www.chatmia.org
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
TURN_URLS=
TURN_USERNAME=
TURN_CREDENTIAL=
```

## Healthchecks

El backend expone:

```text
GET /
GET /health
GET /ready
GET /ice-servers
```

Usa `/health` para confirmar que el backend desplegado esta actualizado y
que Supabase/TURN estan configurados. Usa `/ready` para monitoreo: responde
`503` si falta Supabase.

## Notas de seguridad

- El frontend no debe incluir credenciales TURN hardcodeadas.
- El backend valida el token de Supabase recibido por Socket.IO y no confia en
  `email` enviado por el cliente.
- Los usuarios baneados deben bloquearse en frontend y backend.
- Si cambias el backend, recuerda redeployar el servidor Socket.IO ademas del
  frontend en Vercel.
