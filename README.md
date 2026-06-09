# MyChat

> A privacy-first, AI-enhanced messaging app — better than WhatsApp.

**Platforms:** iOS · Android · Web · Desktop (Mac/Windows)
**Stack:** TypeScript · Fastify · Socket.io · mediasoup · Drizzle ORM · Next.js 14 · React Native · Tauri · Claude AI

---

## Status

| Phase | What | Status |
|-------|------|--------|
| 0 | Monorepo setup, CI/CD | ✅ `v0.1.0` |
| 1 | Auth + WebSocket real-time foundation | ✅ `v0.2.0` |
| 2 | Core messaging — E2E encryption, media, self-destruct | ✅ `v0.3.0` |
| 3 | Voice & video calls — WebRTC + mediasoup SFU | ✅ `v0.4.0` |
| 4 | AI features — summaries, smart replies, translation, tone | ✅ `v0.5.0` |
| 5 | Mobile + desktop + launch | 🔜 Next |

---

## Quick start

```bash
git clone git@github.com:diallogadry93-bot/MyChat.git
cd MyChat
cp apps/api/.env.example apps/api/.env   # add your keys
cp apps/web/.env.example apps/web/.env.local
docker compose up -d
npm install --legacy-peer-deps
cd apps/api && npm run dev    # :3001
cd apps/web && npm run dev    # :3000
```

---

## AI features (Phase 4)

| Feature | How it works |
|---------|-------------|
| **Chat summary** | "Catch me up" button — Claude summarises last 50 messages into 5 bullets |
| **Smart replies** | 3 reply chips appear after each message — friendly / formal / brief |
| **Tone detection** | Hover a message to see its tone — 😊 Friendly, 🤝 Formal, 😤 Tense, 🚨 Urgent |
| **Auto-translate** | 🌐 button on every message — 8 languages, cached 1 hour |
| **Safety filter** | Pre-delivery check — toxic/spam messages held for sender confirmation |

All AI calls are **server-side only** — API key never exposed to the client.
Redis caches results aggressively to minimise API costs.

---

## Architecture

```
apps/api/src/
  ai/         service.ts (Claude API), routes.ts (5 endpoints)
  calls/      sfu.ts (mediasoup), routes.ts
  routes/     auth, chats, messages
  jobs/       BullMQ self-destruct + media processing
  ws/         Socket.io events
  utils/      encryption, storage (R2), redis, auth

apps/web/src/
  components/
    ai/       SmartReplies, ChatSummary, ToneBadge, TranslateButton
    call/     CallView, VideoTile, CallControls
    chat/     MessageBubble, MessageInput, ChatSidebar, TypingIndicator
  hooks/      useSocket, useCall
  lib/        api client, AuthContext
```

Full plan: [`MyChat_Project_Plan.docx`](./MyChat_Project_Plan.docx)
