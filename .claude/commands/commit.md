Create a smart git commit with a well-formatted message.

Steps:
1. Run `git status` to see changes
2. Run `git diff` to see what changed
3. Analyze the changes and determine:
   - What was changed (files, features)
   - Why it was changed (purpose)
   - Impact (what this affects)
4. Create a commit message following this format:
   ```
   [Phase X / Feature]: Brief summary (50 chars max)

   - Detailed change 1
   - Detailed change 2
   - Impact or notes

   🤖 Generated with [Claude Code](https://claude.com/claude-code)

   Co-Authored-By: Claude <noreply@anthropic.com>
   ```
5. Run `git add` for relevant files (ask if unsure)
6. Run `git commit` with the message
7. Update STATUS.md if this completes a task
8. Report commit hash and summary
