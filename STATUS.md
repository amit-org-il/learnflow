# Project Status - Learnflow Avatar Integration

## Current State: 🟢 IN PROGRESS
**Last Updated:** 2025-11-30
**Current Branch:** `feature/avatar-integration`

---

## 📋 Project Overview

Integrating TalkingHead 3D avatar with Azure TTS and Gemini Live support into the Learnflow chatbot Vue 3 component.

**Source of Truth:** `todo/active/phase_*.md`

---

## 🎯 Implementation Phases

| Phase | Name | Status | Progress |
|-------|------|--------|----------|
| 1 | Setup & Dependencies | ✅ Complete | 100% |
| 2 | TypeScript Types | ⬜ Not Started | 0% |
| 3 | Vue Composables | ⬜ Not Started | 0% |
| 4 | Vue Components | ⬜ Not Started | 0% |
| 5 | API Integration | ⬜ Not Started | 0% |
| 6 | Voice Input | ⬜ Not Started | 0% |
| 7 | Streaming Text | ⬜ Not Started | 0% |
| 8 | Avatar Caching | ⬜ Not Started | 0% |
| 9 | Polish & Testing | ⬜ Not Started | 0% |

**Overall Progress:** 1/9 phases (11%)

---

## 📁 Key Files

### Documentation
- `todo/active/HANDOFF_DOCUMENT.md` - All decisions & pitfalls
- `todo/active/phase_*.md` - Phase-by-phase implementation

### Target Package
- `packages/chatbot/` - Vue 3 chatbot component we're modifying

### Reference (React implementation)
- `C:\ai\amit_projects\lipsync-e2e-react\frontend\src\` - Working implementation to port

---

## 🔑 Critical Decisions (Pre-Made)

These decisions are documented in `HANDOFF_DOCUMENT.md` - **DO NOT change them**:

1. **Session Management**: Backend controls session IDs, frontend calls `POST /chats`
2. **Socket.IO Namespace**: Use `/avatar` in URL path: `io('http://localhost:8001/avatar')`
3. **TTS Providers**: Support BOTH Azure TTS and Gemini Live
4. **Audio Handling**: Use `audioContext()` factory, unlock on user interaction
5. **Mouth Shapes**: Apply directly to TalkingHead instance (NOT via Vue reactive state)
6. **IndexedDB**: Store `ArrayBuffer`, NOT Blob
7. **ViewType**: Only 3 values: `head`, `body`, `full`

---

## 🚀 Next Steps

1. ~~Phase 1: Setup & Dependencies~~ ✅ Complete
2. Start Phase 2: TypeScript Types
3. Follow phase files in order (some can run in parallel)
4. Commit after each phase
5. Push to fork and create PR when ready

---

## 🔗 Git Workflow

```bash
# Working directory
C:\ai\amit_projects\learnflow-chatbot

# Remotes
origin   → https://github.com/amit-org-il/learnflow.git (your fork)
upstream → https://github.com/200-nwire/learnflow.git (original)

# Branch
feature/avatar-integration

# Push to your fork
git push -u origin feature/avatar-integration

# Create PR via GitHub web
# From: amit-org-il/learnflow:feature/avatar-integration
# To:   200-nwire/learnflow:main
```

---

## 📝 Session Log

### 2025-11-30 - Phase 1 Complete
**Phase 1: Setup & Dependencies** completed:
- Installed Azure Speech SDK 1.35.0 and Three.js 0.160.0
- Copied TalkingHead.js files to `packages/chatbot/public/lib/talkinghead/`
- Also copied to `playground/public/lib/talkinghead/` for development
- Created `.env` file with backend configuration
- Updated `playground/vite.config.ts` for .mjs module handling
- Build verification passed for both chatbot package and playground

**Files Changed:**
- `packages/chatbot/package.json` - Added Azure SDK and Three.js dependencies
- `packages/chatbot/.env` - New environment config file
- `packages/chatbot/public/lib/talkinghead/*.mjs` - TalkingHead runtime modules
- `playground/public/lib/talkinghead/*.mjs` - TalkingHead for playground
- `playground/vite.config.ts` - Added .mjs module exclusions

**Next Session:** Start Phase 2 - TypeScript Types

### 2025-11-30 - Initial Setup
- Forked repo to `amit-org-il/learnflow`
- Cloned to `C:\ai\amit_projects\learnflow-chatbot`
- Created `feature/avatar-integration` branch
- Copied Claude workflow files (.claude, .agent, todo, etc.)
- Created fresh STACK.md and STATUS.md for Learnflow
