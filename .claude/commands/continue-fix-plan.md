# Continue Phase Implementation

You are Claude Code working on the Learnflow Avatar Integration project. Your mission is to **autonomously continue implementing the phases** from wherever they were left off.

## 📋 CONTEXT LOADING PROTOCOL

### Step 1: Read Current Status (REQUIRED)
```bash
# Read these files IN ORDER to understand current state:
1. STATUS.md - Current progress, last completed task, blockers
2. PROMPT.md - Current task context and critical decisions
3. todo/active/phase_*.md - Phase files (source of truth)
4. todo/active/HANDOFF_DOCUMENT.md - All decisions and pitfalls
5. .git/logs/HEAD - Recent commits to see what was done
```

### Step 2: Identify Current Phase
```bash
# Determine where to continue:
- Check STATUS.md for current phase progress
- Look at unchecked boxes in todo/active/phase_*.md files
- Review last git commit message
- Find first incomplete task in Phase 1, then Phase 2, etc.
```

### Step 3: Execute Current Task
```bash
# For each task:
1. Read the task details from phase file
2. Read the current code files
3. Implement the code exactly as documented
4. Test the changes (TypeScript compiles, no errors)
5. Update STATUS.md with progress
6. Git commit with descriptive message
7. Move to next task
```

## 🎯 YOUR AUTONOMOUS WORKFLOW

### Phase Detection
```markdown
IF STATUS.md shows "Phase 1: In Progress":
  → Continue Phase 1 tasks
ELSE IF all Phase 1 checkboxes checked:
  → Move phase_1_setup.md to todo/done/
  → Start Phase 2
ELSE IF STATUS.md shows "Phase 2: In Progress":
  → Continue Phase 2 tasks
... and so on through Phase 9
```

### Task Execution Pattern
```markdown
FOR EACH incomplete task:
  1. 📖 READ task from todo/active/phase_N_*.md
  2. 🔍 READ current code (if modifying existing file)
  3. ✏️ IMPLEMENT code exactly as documented
  4. 🧪 TEST: pnpm build or pnpm test
  5. ✅ UPDATE STATUS.md with completion
  6. 💾 GIT COMMIT with clear message
  7. ➡️ MOVE to next task
```

### STATUS.md Update Format
```markdown
## 🎯 Implementation Phases

| Phase | Name | Status | Progress |
|-------|------|--------|----------|
| 1 | Setup & Dependencies | ✅ Complete | 100% |
| 2 | TypeScript Types | ⏳ In Progress | 50% |
| 3 | Vue Composables | ⬜ Not Started | 0% |
...
```

### Git Commit Format
```bash
git commit -m "Phase N: Task description

- List specific changes made
- Files created/modified

🤖 Generated with Claude Code"
```

## 🔄 CONTINUOUS OPERATION

### On Every Invocation

1. **Read STATUS.md FIRST** (always!)
2. **Identify current phase and task**
3. **Execute next incomplete task**
4. **Update STATUS.md**
5. **Git commit**
6. **Repeat until stuck or phase complete**

### When Blocked

```markdown
IF task requires user input or decision:
  1. Update STATUS.md with BLOCKER status
  2. Git commit current state
  3. Ask user for input
  4. WAIT for response

IF task fails (TypeScript errors, etc):
  1. Analyze failure
  2. Check HANDOFF_DOCUMENT.md for known pitfalls
  3. If still failing, mark as BLOCKER
  4. Ask user for help

IF phase complete:
  1. Mark complete in STATUS.md
  2. Move phase file to todo/done/
  3. Git commit
  4. Start next phase
```

## 📊 PROGRESS REPORTING

### After Each Task
```markdown
✅ Task Complete: [Task Name]
📝 Changes: [Brief summary]
🧪 Tested: TypeScript compiles ✓
➡️ Next: [Next task]
```

### After Each Phase
```markdown
🎉 Phase [N] Complete!

Completed:
✅ [List all tasks in phase]

Next Phase:
Phase [N+1]: [Phase name]
First task: [Next task name]
```

## 🔧 LEARNFLOW-SPECIFIC INSTRUCTIONS

### Key Locations
- **Phase files**: `todo/active/phase_*.md`
- **Handoff doc**: `todo/active/HANDOFF_DOCUMENT.md`
- **Target package**: `packages/chatbot/`
- **Reference code**: `C:\ai\amit_projects\lipsync-e2e-react\frontend\src\`

### Critical Decisions (DO NOT CHANGE)
1. Socket.IO namespace in URL: `io('http://localhost:8001/avatar')`
2. Store ArrayBuffer in IndexedDB (NOT Blob)
3. ViewType only 3 values: `head`, `body`, `full`
4. TalkingHead.js from `backend-old/static/modules/`
5. Mouth shapes directly to TalkingHead (NOT Vue reactive)

### Testing
```bash
# In packages/chatbot:
pnpm build      # Check TypeScript compiles
pnpm test       # Run unit tests
```

## 🚀 READY TO START

Now execute this protocol:

```markdown
1. READ STATUS.md
2. FIND current phase and task
3. READ phase file for task details
4. IMPLEMENT code from phase file
5. TEST (pnpm build)
6. UPDATE STATUS.md
7. GIT COMMIT
8. REPORT to user
9. REPEAT

Continue until:
- Phase complete → move to next
- Blocked → ask user
- All 9 phases done → celebrate! 🎉
```

---

**This prompt enables full autonomous continuation of the Learnflow avatar integration across sessions.**
