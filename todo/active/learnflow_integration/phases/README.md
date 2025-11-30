# Learnflow Avatar Integration - Phase Guide

**Total Time:** ~30 hours (4-5 days)
**Last Updated:** 2025-11-30

---

## Quick Start

Start with Phase 1 and work through sequentially. Phases 8-9 can run in parallel with 5-7.

---

## Phase Overview

| Phase | Name | Time | Priority | Status |
|-------|------|------|----------|--------|
| [1](./phase_1_setup.md) | Setup & Dependencies | 2 hrs | Required | [ ] |
| [2](./phase_2_types.md) | TypeScript Types | 1.5 hrs | Required | [ ] |
| [3](./phase_3_composables.md) | Vue Composables | 10.5 hrs | Required | [ ] |
| [4](./phase_4_components.md) | Vue Components | 3 hrs | Required | [ ] |
| [5](./phase_5_api.md) | API Integration | 2 hrs | Required | [ ] |
| [6](./phase_6_voice.md) | Voice Input | 4 hrs | **P0** | [ ] |
| [7](./phase_7_streaming.md) | Streaming Text | 1.5 hrs | **P0** | [ ] |
| [8](./phase_8_caching.md) | Avatar Caching | 3 hrs | P1 | [ ] |
| [9](./phase_9_polish.md) | Polish & Testing | 2-3 hrs | P2 | [ ] |

---

## Critical Path

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 7
                                    ↘
                                      Phase 8 (parallel)
                                           ↘
                                             Phase 9
```

---

## Priority Legend

| Priority | Meaning |
|----------|---------|
| **Required** | Core functionality - must complete |
| **P0** | Critical for Gemini Live voice bots |
| **P1** | Important UX improvement |
| **P2** | Nice to have |

---

## Key Decisions

1. **Socket.IO** - Use existing socket, add avatar events
2. **HTTP URL** - Connect with `http://` not `ws://`
3. **chatId** - Create via `POST /chats`, connect with `?chatId=xxx`
4. **Session** - 1 hour timeout, same bot = same session
5. **Azure Proxy** - Backend hides API key at `/ws/tts/`
6. **TalkingHead** - Bundle with Vue app, not CDN

---

## Files to Create

```
src/
├── types/
│   ├── avatar-websocket.ts     (Phase 2)
│   ├── avatar.ts               (Phase 2)
│   └── talking-head.d.ts       (Phase 2)
├── composables/
│   ├── useAvatarSocket.ts      (Phase 3)
│   ├── useAvatar.ts            (Phase 3)
│   ├── useAzureTTS.ts          (Phase 3)
│   ├── useGeminiLipsync.ts     (Phase 3)
│   ├── useBot.ts               (Phase 5)
│   ├── useChat.ts              (Phase 5)
│   ├── useVoiceRecording.ts    (Phase 6)
│   └── useAvatarPreloader.ts   (Phase 8)
├── lib/
│   ├── talkinghead/            (Phase 1 - copy)
│   ├── audio/
│   │   ├── audio-unlock.ts     (Phase 3)
│   │   ├── audio-utils.ts      (Phase 3)
│   │   ├── AudioRecorder.ts    (Phase 6)
│   │   ├── GeminiAudioHandler.ts (Phase 3 - copy)
│   │   └── worklets/           (Phase 3 - copy)
│   └── cache/
│       └── avatarCacheService.ts (Phase 8)
├── services/
│   └── healthService.ts        (Phase 9)
└── components/
    ├── AvatarContainer.vue     (Phase 4)
    ├── VoiceRecorder.vue       (Phase 6)
    ├── StreamingText.vue       (Phase 7)
    ├── ViewToggleButton.vue    (Phase 9)
    └── FloatingChatbot.vue     (Phase 4 - modify)
```

---

## Reference Project

All code examples reference:
```
C:\ai\amit_projects\lipsync-e2e-react\frontend\
```

---

## Questions?

See the main [IMPLEMENTATION_PLAN.md](../IMPLEMENTATION_PLAN.md) for detailed code examples and full context.
