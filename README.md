# MyChat

> A privacy-first, AI-enhanced messaging app — better than WhatsApp.

**Platforms:** iOS · Android · Web · Desktop (Mac/Windows)
**Stack:** TypeScript · Fastify · Socket.io · mediasoup · Drizzle ORM · Next.js 14 · React Native · Tauri

---

## Status

| Phase | What | Status |
|-------|------|--------|
| 0 | Monorepo setup, CI/CD | ✅ `v0.1.0` |
| 1 | Auth + WebSocket real-time foundation | ✅ `v0.2.0` |
| 2 | Core messaging — E2E encryption, media, self-destruct | ✅ `v0.3.0` |
| 3 | Voice & video calls — WebRTC + mediasoup SFU | ✅ `v0.4.0` |
| 4 | AI features — summaries, smart replies, translation | 🔜 Next |
| 5 | Mobile + desktop + launch | ⬜ Planned |

---

## Quick start

```bash
git clone git@github.com:diallogadry93-bot/MyChat.git
cd MyChat
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
docker compose up -d          # postgres + redis
npm install --legacy-peer-deps
cd apps/api && npm run dev    # API + SFU on :3001
# New terminal:
cd apps/web && npm run dev    # Web on :3000
```

---

## Architecture

```
apps/
  api/
    src/
      routes/    auth, chats, messages
      calls/     sfu.ts (mediasoup), routes.ts (call signalling)
      jobs/      BullMQ self-destruct + media processing
      ws/        Socket.io events (presence, typing, call relay)
      utils/     encryption, storage (R2), redis, auth
  web/
    src/
      app/       /auth/login, /auth/register, /chat
      components/chat/   MessageBubble, MessageInput, ChatSidebar, TypingIndicator
      components/call/   CallView, VideoTile, CallControls
      hooks/     useSocket, useCall (WebRTC)
      lib/       api client, AuthContext
  mobile/   React Native (Expo) — Phase 5
  desktop/  Tauri 2 — Phase 5
packages/
  shared/   TypeScript types, Zod schemas, WS constants
  ui/       Shared React component library
```

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Register |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/refresh` | Refresh JWT |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/auth/me` | Current user |
| GET | `/api/chats` | List chats |
| POST | `/api/chats` | Create chat |
| GET | `/api/chats/:id/messages` | Message history |
| POST | `/api/chats/:id/messages` | Send message |
| PATCH | `/api/messages/:id` | Edit message |
| DELETE | `/api/messages/:id` | Delete message |
| POST | `/api/messages/:id/reactions` | Toggle reaction |
| POST | `/api/calls` | Initiate call |
| POST | `/api/calls/:id/answer` | Answer call |
| POST | `/api/calls/:id/end` | End call |
| GET | `/api/calls/:id/sfu-capabilities` | mediasoup RTP caps |
| POST | `/api/calls/:id/sfu-transport` | Create WebRTC transport |

Full plan: [`MyChat_Project_Plan.docx`](./MyChat_Project_Plan.docx)
