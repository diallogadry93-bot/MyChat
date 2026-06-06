# MyChat

> A privacy-first, AI-enhanced messaging app — better than WhatsApp.

**Platforms:** iOS · Android · Web · Desktop (Mac/Windows)  
**Stack:** TypeScript · Node.js · React Native · Next.js · Tauri  
**Repo:** [github.com/diallogadry93-bot/MyChat](https://github.com/diallogadry93-bot/MyChat)

---

## Project Plan

The full build plan is documented in [`MyChat_Project_Plan.docx`](./MyChat_Project_Plan.docx).

| Phase | What gets built | Timeline |
|-------|----------------|----------|
| 0 | Monorepo setup, CI/CD | Week 1 |
| 1 | Auth + WebSocket real-time foundation | Weeks 2–5 |
| 2 | Core messaging — E2E encryption, media, self-destruct | Weeks 6–10 |
| 3 | Voice & video calls with screen share | Weeks 11–15 |
| 4 | AI features — summaries, smart replies, translation | Weeks 16–18 |
| 5 | Mobile + desktop apps, privacy features, launch | Weeks 19–24 |

---

## Quick start

```bash
git clone git@github.com:diallogadry93-bot/MyChat.git
cd MyChat
pnpm install
cp apps/api/.env.example apps/api/.env
docker compose up -d
pnpm db:migrate
pnpm dev
```

> Code will be added phase by phase starting with Phase 0.
