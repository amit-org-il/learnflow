# Learnflow Chatbot - Technology Stack

**Project:** Learnflow Avatar Integration
**Last Updated:** 2025-11-30

---

## Overview

This is a **Vue 3 monorepo** for the Learnflow adaptive learning platform. We're adding TalkingHead avatar integration to the chatbot package.

---

## Core Technologies

### Frontend Framework
| Technology | Version | Purpose |
|------------|---------|---------|
| **Vue 3** | ^3.5.11 | UI framework |
| **TypeScript** | ^5.6.3 | Type safety |
| **Vite** | (via monorepo) | Build tool |

### Build & Tooling
| Technology | Version | Purpose |
|------------|---------|---------|
| **pnpm** | - | Package manager (monorepo) |
| **tsup** | ^8.0.2 | Library bundling |
| **Vitest** | ^2.1.1 | Unit testing |
| **ESLint** | ^9.11.1 | Linting |

### Communication
| Technology | Version | Purpose |
|------------|---------|---------|
| **Socket.IO Client** | ^4.8.1 | Real-time WebSocket |

### Avatar (Adding)
| Technology | Version | Purpose |
|------------|---------|---------|
| **TalkingHead.js** | - | 3D avatar rendering |
| **Three.js** | (dependency of TalkingHead) | WebGL rendering |
| **Azure Speech SDK** | (CDN) | Text-to-speech with visemes |

---

## Monorepo Structure

```
learnflow/
├── packages/
│   ├── chatbot/          ← We're modifying this
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── composables/
│   │   │   ├── types/
│   │   │   └── lib/
│   │   └── public/       ← TalkingHead.js goes here
│   ├── adaptivity/
│   ├── rules-builder/
│   └── telemetry/
├── playground/           ← For testing
└── storybook/
```

---

## Backend Connection

| Endpoint | Purpose |
|----------|---------|
| `http://localhost:8001` | Development backend |
| `GET /bots/{id}` | Fetch bot configuration |
| `POST /chats` | Create/resume chat session |
| `WS /avatar` | Socket.IO namespace for avatar |
| `WS /ws/tts/*` | Azure TTS proxy |

---

## Key Dependencies to Add (Phase 1)

```json
{
  "dependencies": {
    "socket.io-client": "^4.8.1"  // Already present
  }
}
```

TalkingHead.js loaded via `<script>` tag (not npm package).

---

## Environment Variables

```bash
# packages/chatbot/.env
VITE_BACKEND_URL=http://localhost:8001
VITE_BACKEND_PORT=8001
```

---

## Browser Requirements

- WebGL 2.0 support (for Three.js/TalkingHead)
- AudioContext API (for TTS playback)
- IndexedDB (for avatar caching)
- Modern browser (Chrome 90+, Firefox 90+, Safari 15+)

---

## Reference Implementation

Working React implementation at:
`C:\ai\amit_projects\lipsync-e2e-react\frontend\src\`

Key reference files:
- `hooks/useAvatarWithTTS.ts` - Azure TTS integration
- `components/avatar/useAvatar.ts` - Avatar composable
- `lib/audio/GeminiAudioHandler.ts` - Gemini Live audio
- `lib/cache/avatarCacheService.ts` - IndexedDB caching
