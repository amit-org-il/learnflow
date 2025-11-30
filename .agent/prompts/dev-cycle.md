# Dev Cycle Execution Prompt

**Plan File**: See `STATUS.md` → "CURRENT PHASE" → "Plan File" field

**Execute using this dev cycle:**

## Cycle Per Task

```
For EACH task, repeat until success:

1. DEV: Task(subagent_type="backend-architect" or "frontend-developer")
   - Implement the task exactly as specified in the plan

2. CODE REVIEW: Task(subagent_type="backend-bug-analyzer" or "frontend-bug-analyzer")
   - Review for bugs, type errors, security issues
   - Check it matches plan specifications
   - Output: PASS or FAIL with specific issues

3. PM: Make decision
   - If FAIL → Go back to step 1 (DEV) with the issues to fix
   - If PASS → Mark task [x], update STATUS.md, git commit, move to NEXT task
```

## Flow Diagram

```
┌─────────────────────────────────────────────────────┐
│                    TASK N                           │
│                                                     │
│   ┌─────┐      ┌─────────────┐      ┌────┐         │
│   │ DEV │ ───► │ CODE REVIEW │ ───► │ PM │         │
│   └─────┘      └─────────────┘      └────┘         │
│      ▲                                 │           │
│      │         FAIL: issues found      │           │
│      └─────────────────────────────────┘           │
│                                        │           │
│                        PASS            ▼           │
└────────────────────────────────────► [NEXT TASK]   │
```

## Instructions

1. Read the plan file specified above
2. Find tasks marked DONE - skip them
3. Start with first incomplete task
4. For each task: loop Dev → Review → PM until PASS
5. Only move to next task after PM marks current task complete
6. Follow task order as listed in the plan

## Subagent Selection

| Task Type | DEV Subagent | CODE REVIEW Subagent |
|-----------|--------------|----------------------|
| Python/FastAPI backend | `backend-architect` | `backend-bug-analyzer` |
| React/TypeScript frontend | `frontend-developer` | `frontend-bug-analyzer` |
| Complex Python logic | `python-pro` | `backend-bug-analyzer` |
| Complex TypeScript types | `typescript-pro` | `frontend-bug-analyzer` |

## PM Actions on PASS

1. Mark task `[x]` in plan file
2. Update STATUS.md progress percentage
3. Git commit with descriptive message
4. Proceed to next task

## PM Actions on FAIL

1. Document the issues found
2. Send back to DEV with specific fix instructions
3. Do NOT mark task complete
4. Do NOT commit

**Start now.**
