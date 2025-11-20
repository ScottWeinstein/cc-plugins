---
description: Stop development servers
---

Stop Next.js and optionally Inngest development servers.

**What this does:**
- Stops Next.js dev server for this worktree
- Optionally stops system-wide Inngest server (asks first)
- Cleans up processes gracefully (SIGTERM then SIGKILL)
- Verifies ports are released

**Important:** Inngest is shared across all worktrees. Stopping it affects other worktrees.

---

## Implementation Steps

1. **Load configuration:**
   ```bash
   cat .claude/plugins/workspace-dev-servers/config.json 2>/dev/null
   ```

2. **Stop Next.js server:**
   ```
   Task(subagent_type="nextjs-server", prompt="Stop Next.js dev server for this worktree. Load configuration from .claude/plugins/workspace-dev-servers/config.json to find the port. Kill process gracefully (SIGTERM then SIGKILL if needed).")
   ```

3. **Ask user about Inngest:**

   Use AskUserQuestion:
   ```json
   {
     "question": "Stop the Inngest server too? (This affects all worktrees)",
     "header": "Inngest",
     "multiSelect": false,
     "options": [
       {
         "label": "Yes, stop Inngest",
         "description": "Stop system-wide Inngest server (affects all worktrees)"
       },
       {
         "label": "No, keep it running",
         "description": "Leave Inngest running for other worktrees"
       }
     ]
   }
   ```

4. **If user chose "Yes", stop Inngest:**
   ```
   Task(subagent_type="inngest-server", prompt="Stop system-wide Inngest dev server. Load configuration from .claude/plugins/workspace-dev-servers/config.json for port and PID file location. Kill process gracefully.")
   ```

5. **Confirm what was stopped:**
   ```
   ✓ Next.js dev server stopped (port 5001)

   [If Inngest was stopped:]
   ✓ Inngest dev server stopped (port 8288)

   [If Inngest was kept running:]
   ℹ Inngest dev server still running (port 8288)

   All requested servers stopped.
   ```

## Notes

- Uses graceful shutdown (SIGTERM) with fallback to SIGKILL
- Kills entire process group to clean up child processes
- Verifies ports are released after stopping
- Safe to run even if servers aren't running (idempotent)
