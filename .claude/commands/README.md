# Claude Slash Commands Reference

This directory contains slash command definitions for Claude Code.

## 📋 What Are These Files?

These are **slash commands** - quick shortcuts that trigger specific workflows in Claude Code.

## 🔧 Available Commands

| Command | File | Purpose |
|---------|------|---------|
| `/status` | `status.md` | Generate comprehensive status report |
| `/switch [role]` | `switch.md` | Switch to a different role |
| `/test` | `test.md` | Run test suite and report results |
| `/commit` | `commit.md` | Create smart git commit |
| `/write-prd-to-phases [file]` | `write-prd-to-phases.md` | Convert PRD to phase files |

---

## 📖 How Slash Commands Work

When you type a slash command (e.g., `/status`), Claude Code:
1. Reads the corresponding `.md` file from this directory
2. Executes the instructions in that file
3. Returns the result to you

### Example:

```
You type: /status

Claude reads: .claude/commands/status.md

Claude does:
1. Reads STATUS.md
2. Checks recent git commits
3. Reviews TodoWrite
4. Generates formatted report
```

---

## 🎯 Command Details

### `/status` - Status Report

**Purpose**: Get a comprehensive project status update

**What it does**:
- Reads STATUS.md for current state
- Checks recent git commits
- Reviews TodoWrite for active tasks
- Generates formatted report with:
  - Current phase and progress
  - Recently completed tasks
  - Current task status
  - Any blockers
  - Next 3 upcoming tasks
  - Progress bars
  - Last git commit info

**When to use**:
- Start of session
- Before meetings
- After taking a break
- When you want an overview

---

### `/switch [role]` - Switch Roles

**Purpose**: Change to a different role

**Available roles**:
- `pm` - Project Manager
- `dev` - Developer
- `qa` - QA/Testing
- `architect` - System Architect
- `researcher` - Research/Explorer

**What it does**:
1. Saves/commits current work
2. Updates STATUS.md with progress
3. Reads role file from `claude_roles/[role].md`
4. Reads STATUS.md for context
5. Begins working in new role

**Examples**:
```
/switch pm
/switch dev
/switch qa
```

---

### `/test` - Run Tests

**Purpose**: Run project test suite with analysis

**What it does**:
1. Switches to QA mode
2. Identifies test command (checks package.json, README)
3. Requests you to run tests
4. Analyzes results
5. Documents failures in STATUS.md
6. Provides summary:
   - ✅ Tests passing: X/Y
   - ❌ Tests failing: List
   - ⚠️ Warnings or flaky tests
   - 📊 Coverage (if available)
7. Recommends next steps

**When to use**:
- After implementing a feature
- Before committing
- During QA phase
- Before releases

---

### `/commit` - Smart Git Commit

**Purpose**: Create well-formatted git commit

**What it does**:
1. Runs `git status` and `git diff`
2. Analyzes changes (what, why, impact)
3. Creates formatted commit message:
   ```
   [Phase X / Feature]: Brief summary

   - Detailed change 1
   - Detailed change 2
   - Impact notes

   🤖 Generated with Claude Code

   Co-Authored-By: Claude <noreply@anthropic.com>
   ```
4. Runs `git add` for relevant files
5. Commits with message
6. Updates STATUS.md if task complete
7. Reports commit hash and summary

**When to use**:
- After completing a task
- Before switching roles
- At end of session
- When reaching milestones

---

### `/write-prd-to-phases [file]` - PRD to Phases

**Purpose**: Convert Product Requirements Document into actionable phases

**Usage**:
```
/write-prd-to-phases docs/my-prd.md
/write-prd-to-phases                  (will ask for file or content)
```

**What it does**:
1. Reads the PRD (file or pasted content)
2. Switches to Architect:
   - Analyzes technical requirements
   - Plans architecture
   - Documents in STACK.md
3. Switches to PM:
   - Breaks down into phases
   - Creates phase files in `todo/active/`
4. Updates STATUS.md with all phases
5. Updates TodoWrite with first tasks
6. Creates summary

**Phase file format**:
```markdown
# Phase [N]: [Name]
**Goal**: [What this accomplishes]
**Status**: Not Started

## Prerequisites
- [ ] [Prerequisite 1]

## Tasks
### Task [N].1: [Task Name]
- [ ] Subtask 1
- [ ] Subtask 2

**Verification**: [Tests]
**Deliverables**: [Files/features]

## Phase Completion Checklist
- [ ] All tasks complete
- [ ] Tests passing
- [ ] STATUS.md updated
```

**When to use**:
- Starting a new project
- Planning a major feature
- Have requirements document
- Need structured breakdown

---

## ✏️ Customizing Commands

You can modify existing commands or create new ones:

### Modify Existing Command

Edit the `.md` file:
```bash
# Edit .claude/commands/status.md
# Add your own sections or change the format
```

### Create New Command

1. Create new `.md` file in this directory:
```bash
# .claude/commands/deploy.md
```

2. Write the instructions:
```markdown
Run deployment workflow:
1. Verify all tests pass
2. Check STATUS.md is up to date
3. Run build command
4. Deploy to staging
5. Verify deployment
6. Tag release
```

3. Use it:
```
/deploy
```

---

## 🎯 Command Best Practices

**DO**:
- Use commands for repetitive tasks
- Update STATUS.md after commands complete
- Combine commands in workflows
- Create project-specific commands

**DON'T**:
- Override commands unless needed
- Forget to test custom commands
- Make commands too complex (break into steps)

---

## 📖 Learn More

- Read [CLAUDE.md](../../CLAUDE.md) for the full role-based workflow
- Read [README.md](../../README.md) for template overview
- Check [claude_roles/](../../claude_roles/) for detailed role documentation
- See [QUICKSTART.md](../../QUICKSTART.md) for quick reference

---

*Claude Code Slash Commands v1.0*
