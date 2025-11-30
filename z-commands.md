# Learnflow Avatar Integration - Commands Reference

## 🚀 Quick Start

### Autonomous Development Loop
```bash
# Run Claude with PROMPT.md in a loop
while :; do cat PROMPT.md | claude -p --dangerously-skip-permissions; done
```

### Continue Implementation
```bash
claude --dangerously-skip-permissions --continue "/continue-fix-plan"
```

### With Chrome DevTools MCP (for UI testing)
```bash
claude --dangerously-skip-permissions --continue "use the chrome-devtools mcp for testing the frontend and reading logs"
```

---

## 🔧 Development Commands

### Start Backend (from lipsync-e2e-react)
```bash
cd C:\ai\amit_projects\lipsync-e2e-react\backend-examples\fastapi-complete
.venv\Scripts\activate
uvicorn main:socket_app --reload --port 8001
```

### Start Learnflow Frontend
```bash
cd C:\ai\amit_projects\learnflow-chatbot
pnpm install
pnpm dev:play        # Playground
pnpm dev:storybook   # Storybook
```

### Build & Test
```bash
cd packages/chatbot
pnpm build           # Build package
pnpm test            # Run tests
```

---

## 🔄 Git Workflow

### Push to Your Fork
```bash
git add .
git commit -m "Phase N: Description"
git push -u origin feature/avatar-integration
```

### Create PR (GitHub Web)
```
From: amit-org-il/learnflow:feature/avatar-integration
To:   200-nwire/learnflow:main
```

### Sync with Upstream
```bash
git fetch upstream
git merge upstream/main
```

---

## 🛠️ Utilities

### Kill All Python Processes (Windows)
```powershell
taskkill /F /IM python.exe
```

### Kill All Node Processes (Windows)
```powershell
taskkill /F /IM node.exe
```

### MCP Setup
```bash
# Add Chrome DevTools MCP
claude mcp add chrome-devtools npx chrome-devtools-mcp@latest
```

---

## 📁 Key Paths

| Resource | Path |
|----------|------|
| Phase files | `todo/active/phase_*.md` |
| Handoff doc | `todo/active/HANDOFF_DOCUMENT.md` |
| Target package | `packages/chatbot/` |
| Backend | `C:\ai\amit_projects\lipsync-e2e-react\backend-examples\fastapi-complete` |
| Reference React | `C:\ai\amit_projects\lipsync-e2e-react\frontend\src\` |

---

## 📋 Slash Commands

| Command | Description |
|---------|-------------|
| `/status` | Show current progress |
| `/continue-fix-plan` | Continue autonomous implementation |
| `/test` | Run test suite |
| `/commit` | Smart git commit |
| `/switch [role]` | Switch Claude role (pm/dev/qa/architect/researcher) |
