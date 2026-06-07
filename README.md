# MyChat

> A privacy-first, AI-enhanced messaging app — better than WhatsApp.

**Platforms:** iOS · Android · Web · Desktop (Mac/Windows)
**Stack:** TypeScript · Fastify · Socket.io · Drizzle ORM · Next.js 14 · React Native · Tauri

---

## Status

| Phase | What | Status |
|-------|------|--------|
| 0 | Monorepo setup, CI/CD | ✅ Complete — `v0.1.0` |
| 1 | Auth + WebSocket real-time foundation | ✅ Complete — `v0.2.0` |
| 2 | Core messaging — E2E encryption, media, self-destruct | 🔜 Next |
| 3 | Voice & video calls | ⬜ Planned |
| 4 | AI features | ⬜ Planned |
| 5 | Mobile + desktop + launch | ⬜ Planned |

---

## Quick start

```bash
git clone git@github.com:diallogadry93-bot/MyChat.git
cd MyChat
cp apps/api/.env.example apps/api/.env   # fill in secrets
docker compose up -d                      # start postgres + redis
cd apps/api && npm install
npm run db:migrate
npm run dev                               # API on :3001
# In another terminal:
cd apps/web && npm install && npm run dev # Web on :3000
```

---

## Project plan

Full 6-phase plan: [`MyChat_Project_Plan.docx`](./MyChat_Project_Plan.docx)

## Architecture

```
apps/
  api/        Fastify + Socket.io + Drizzle ORM (PostgreSQL)
  web/        Next.js 14 + Tailwind CSS (PWA)
  mobile/     React Native (Expo SDK 51)
  desktop/    Tauri 2
packages/
  shared/     TypeScript types + Zod schemas + WS event constants
  ui/         Shared React component library
```
