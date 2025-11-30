# Current Task: Learnflow Avatar Integration

## Branch: `feature/avatar-integration`

**Plan**: `todo/active/phase_*.md`
**Phases**: 9 (Vue 3 frontend)
**Backend Changes**: None (using existing backend from lipsync-e2e-react)

---

## Dev Cycle Loop

**Execute phases from the phases folder in order. For each task:**

1. **Read** the phase file (e.g., `phase_1_setup.md`)
2. **Implement** the code exactly as specified in the phase
3. **Test** that it works (TypeScript compiles, no errors)
4. **Mark** the task checkbox as done `[x]` in the phase file
5. **Update** `STATUS.md` progress
6. **Commit** with descriptive message
7. **Next** phase - repeat until all phases complete

---

## Testing Tools

**Use Chrome DevTools MCP for UI testing:**
- Take snapshots of the UI
- Check console for errors
- Verify avatar loads correctly
- Test Socket.IO connections
- Debug visual issues

---

## Current Progress

| Phase | Name | Status |
|-------|------|--------|
| Phase 1 | Setup & Dependencies | ⬜ Pending |
| Phase 2 | TypeScript Types | ⬜ Pending |
| Phase 3 | Vue Composables | ⬜ Pending |
| Phase 4 | Vue Components | ⬜ Pending |
| Phase 5 | API Integration | ⬜ Pending |
| Phase 6 | Voice Input | ⬜ Pending |
| Phase 7 | Streaming Text | ⬜ Pending |
| Phase 8 | Avatar Caching | ⬜ Pending |
| Phase 9 | Polish & Testing | ⬜ Pending |

**Start with**: Phase 1

---

## Quick Reference

### Run Backend (from lipsync-e2e-react)
```bash
cd C:\ai\amit_projects\lipsync-e2e-react\backend-examples\fastapi-complete
uvicorn main:socket_app --port 8001
```

### Run Learnflow Dev
```bash
cd C:\ai\amit_projects\learnflow-chatbot
pnpm install
pnpm dev:play  # or pnpm dev:storybook
```

### Key Locations
- **Phase files**: `todo/active/phase_*.md`
- **Handoff doc**: `todo/active/HANDOFF_DOCUMENT.md`
- **Target package**: `packages/chatbot/`
- **Reference React code**: `C:\ai\amit_projects\lipsync-e2e-react\frontend\src\`

---

## Critical Decisions (Pre-Made - Do Not Change)

1. **Session Management**: Backend controls session IDs
2. **Socket.IO**: Namespace in URL path: `io('http://localhost:8001/avatar')`
3. **TTS Providers**: Support BOTH Azure TTS and Gemini Live
4. **Audio Context**: Use factory function, unlock on user interaction
5. **Mouth Shapes**: Apply directly to TalkingHead (NOT via Vue reactive)
6. **IndexedDB**: Store ArrayBuffer, NOT Blob
7. **ViewType**: Only 3 values: `head`, `body`, `full`
8. **TalkingHead.js**: Copy from `backend-old/static/modules/` (NOT backend/)

---

## Git Workflow

```bash
# Push to your fork
git push -u origin feature/avatar-integration

# Create PR on GitHub
# From: amit-org-il/learnflow:feature/avatar-integration
# To:   200-nwire/learnflow:main
```
