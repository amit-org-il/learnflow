Convert a Product Requirements Document (PRD) into actionable phase-based task files.

**Usage**: /write-prd-to-phases [prd-file-path]

If no path provided, ask user:
- Path to PRD file? (e.g., docs/PRD.md)
- Or paste PRD content directly?

**Process**:

1. **Read the PRD**
   - Read the PRD file or get pasted content
   - Understand the project goals, requirements, features
   - Identify major components and phases

2. **Switch to Architect Mode**
   - Analyze technical requirements
   - Identify system components needed
   - Plan overall architecture
   - Document in STACK.md if new technologies needed

3. **Switch to PM Mode**
   - Use Task(subagent_type="Plan") to break down into phases
   - Create detailed task breakdown

4. **Create Phase Files**
   For each phase, create a file in `todo/active/`:

   **Filename**: `phase_[N]_[name].md`

   **Format**:
   ```markdown
   # Phase [N]: [Phase Name]

   **Goal**: [What this phase accomplishes]
   **Status**: Not Started | In Progress | Completed
   **Started**: [Date when started]
   **Completed**: [Date when finished]

   ## Prerequisites
   - [ ] [Prerequisite 1]
   - [ ] [Prerequisite 2]

   ## Tasks

   ### Task [N].1: [Task Name]
   - [ ] Subtask 1
   - [ ] Subtask 2
   - [ ] Subtask 3

   **Verification**:
   - [ ] Test X passes
   - [ ] Feature Y works

   **Deliverables**:
   - [File/feature 1]
   - [File/feature 2]

   ---

   ### Task [N].2: [Next Task]
   [Same structure]

   ---

   ## Phase Completion Checklist
   - [ ] All tasks complete
   - [ ] All tests passing
   - [ ] Documentation updated
   - [ ] STATUS.md updated
   - [ ] Git tagged with phase completion

   ## Notes
   [Any important notes for this phase]
   ```

5. **Update STATUS.md**
   - Add all phases to STATUS.md
   - Set Phase 1 as current
   - Initialize progress tracking (0%)

6. **Update TodoWrite**
   - Add first 3-5 tasks from Phase 1
   - Mark first task as ready to start

7. **Create Summary**
   - List all phases created
   - Show tasks in Phase 1
   - Show total estimated tasks
   - Confirm ready to begin

**After Each Task Completion**:
- Update the phase file (mark [ ] as [x])
- Update STATUS.md
- Commit changes
- Mark TodoWrite item complete

**After Phase Completion**:
- Mark all tasks [x] in phase file
- Move file from `todo/active/` to `todo/done/`
- Update STATUS.md (mark phase complete)
- Create git tag: `v1.0-phase-[N]`
- Start next phase

**Example**:
```
/write-prd-to-phases docs/ecommerce-prd.md

→ Creates:
  - todo/active/phase_1_backend_setup.md (8 tasks)
  - todo/active/phase_2_user_auth.md (6 tasks)
  - todo/active/phase_3_product_catalog.md (10 tasks)
  - todo/active/phase_4_shopping_cart.md (7 tasks)
  - todo/active/phase_5_checkout.md (9 tasks)

→ Updates STATUS.md with all phases
→ Ready to start Phase 1, Task 1.1
```

**Switch to PM mode after creation to begin work.**
