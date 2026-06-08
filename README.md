# MyChat

> A privacy-first, AI-enhanced messaging app — better than WhatsApp.

**Platforms:** iOS · Android · Web · Desktop (Mac/Windows)
**Stack:** TypeScript · Fastify · Socket.io · Drizzle ORM · Next.js 14 · React Native · Tauri

---

## Status

| Phase | What | Status |
|-------|------|--------|
| 0 | Monorepo setup, CI/CD | ✅ `v0.1.0` |
| 1 | Auth + WebSocket real-time foundation | ✅ `v0.2.0` |
| 2 | Core messaging — E2E encryption, media, self-destruct | ✅ `v0.3.0` |
| 3 | Voice & video calls | 🔜 Next |
| 4 | AI features | ⬜ Planned |
| 5 | Mobile + desktop + launch | ⬜ Planned |

---

## Quick start

```bash
git clone git@github.com:diallogadry93-bot/MyChat.git
cd MyChat
cp apps/api/.env.example apps/api/.env   # fill in secrets
docker compose up -d                      # postgres + redis
npm install --legacy-peer-deps
cd apps/api && npm run dev                # API on :3001
# New terminal:
cd apps/web && npm run dev                # Web on :3000
```

---

## Architecture

```
apps/
  api/        Fastify + Socket.io + Drizzle ORM
              routes: /api/auth/*, /api/chats/*, /api/messages/*
              jobs:   BullMQ self-destruct + media processing
  web/        Next.js 14 + Tailwind CSS
              pages:  /auth/login, /auth/register, /chat
  mobile/     React Native (Expo SDK 51) — Phase 5
  desktop/    Tauri 2 — Phase 5
packages/
  shared/     TypeScript types + Zod schemas + WS constants
  ui/         Shared React component library
```

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/refresh` | Refresh JWT |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/auth/me` | Current user |
| GET | `/api/chats` | List chats |
| POST | `/api/chats` | Create chat |
| GET | `/api/chats/:id` | Chat details |
| GET | `/api/chats/:id/messages` | Message history |
| POST | `/api/chats/:id/messages` | Send message |
| PATCH | `/api/messages/:id` | Edit message |
| DELETE | `/api/messages/:id` | Delete message |
| POST | `/api/messages/:id/reactions` | Toggle reaction |
| GET | `/api/messages/:id/edits` | Edit history |
| POST | `/api/upload-url` | Get R2 presigned URL |

Full plan: [`MyChat_Project_Plan.docx`](./MyChat_Project_Plan.docx)
