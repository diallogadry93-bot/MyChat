# MyChat

> Privacy-first, AI-enhanced messaging — better than WhatsApp.

[![CI](https://github.com/diallogadry93-bot/MyChat/actions/workflows/ci.yml/badge.svg)](https://github.com/diallogadry93-bot/MyChat/actions)

**Platforms:** iOS · Android · Web · Desktop (Mac/Windows)
**Stack:** TypeScript · Fastify · Socket.io · mediasoup · Drizzle ORM · PostgreSQL · Redis · Next.js 14 · React Native · Tauri · Claude AI

---

## ✅ All phases complete

| Phase | What | Tag |
|-------|------|-----|
| 0 | Monorepo — pnpm workspaces, TypeScript 5, CI/CD | `v0.1.0` |
| 1 | Auth — JWT, bcrypt, WebAuthn, WebSocket, presence | `v0.2.0` |
| 2 | Messaging — E2E encryption, media (R2), self-destruct, reactions | `v0.3.0` |
| 3 | Calls — WebRTC peer-to-peer, mediasoup SFU, screen share | `v0.4.0` |
| 4 | AI — summaries, smart replies, tone detection, translation | `v0.5.0` |
| 5 | Mobile (Expo), Desktop (Tauri), privacy features, deployment | `v1.0.0` |

---

## Quick start

```bash
git clone git@github.com:diallogadry93-bot/MyChat.git
cd MyChat
cp apps/api/.env.example apps/api/.env        # add your secrets
cp apps/web/.env.example apps/web/.env.local
docker compose up -d                           # postgres + redis
npm install --legacy-peer-deps
cd apps/api && npm run dev                     # API on :3001
# new terminal:
cd apps/web && npm run dev                     # Web on :3000
```

---

## Features

| Feature | Description |
|---------|-------------|
| 🔒 E2E encryption | AES-256-GCM, Signal Protocol key exchange |
| 💬 Real-time messaging | Socket.io, reactions, edit history, threading |
| 💣 Self-destruct | 5s → 1 day timers, BullMQ jobs delete server-side |
| 📎 Media sharing | Cloudflare R2, presigned uploads, 2 GB limit |
| 📞 Voice & video | WebRTC P2P (1-on-1) + mediasoup SFU (groups) |
| 🖥️ Screen sharing | getDisplayMedia, annotation overlay |
| ✨ AI summaries | Claude API, "Catch me up" 3–5 bullet summary |
| 💡 Smart replies | 3 contextual reply chips, auto-refreshed |
| 🌐 Translation | 8 languages, cached 1 hr, inline toggle |
| 🎭 Tone detection | 😊 Friendly / 🤝 Formal / 😤 Tense / 🚨 Urgent |
| 👻 Ghost mode | Appear offline to specific contacts |
| 📸 Screenshot detection | Alerts sender on mobile |
| ✓✓ Read receipts | Per-chat toggle |
| 🔑 Passkey auth | WebAuthn, no phone number required |
| 📱 Mobile | React Native (Expo SDK 51), biometric lock |
| 🖥️ Desktop | Tauri 2, system tray, native notifications, ~3 MB binary |

---

## Architecture

```
apps/
  api/src/
    routes/     auth, chats, messages, privacy
    calls/      sfu.ts (mediasoup), routes.ts
    ai/         service.ts (Claude API), routes.ts
    jobs/       BullMQ: self-destruct, media processing
    ws/         Socket.io: presence, typing, call relay
    utils/      encryption, storage (R2), redis, auth
  web/src/
    app/        /auth/login, /auth/register, /chat, /settings
    components/
      ai/       SmartReplies, ChatSummary, ToneBadge, TranslateButton
      call/     CallView, VideoTile, CallControls
      chat/     MessageBubble, MessageInput, ChatSidebar, TypingIndicator
    hooks/      useSocket, useCall (WebRTC)
    lib/        api client, AuthContext
  mobile/
    App.tsx     Root navigator
    src/
      screens/  Login, Register, ChatList, Chat
      hooks/    useSocket (React Native + AppState)
      lib/      api (SecureStore), auth (biometrics), notifications
  desktop/
    src-tauri/  Rust: system tray, updater, hide-to-tray
packages/
  shared/       TypeScript types, Zod schemas, WS constants
  ui/           Shared React component library
```

## Deploy

| Service | Platform | Command |
|---------|----------|---------|
| API | Railway | `git push` → auto-deploy |
| Web | Vercel | `git push` → auto-deploy |
| Mobile | EAS Build | `eas build --platform all` |
| Desktop | GitHub Actions | `tauri build` → GitHub Releases |

Full plan: [`MyChat_Project_Plan.docx`](./MyChat_Project_Plan.docx)
