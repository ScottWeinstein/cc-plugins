---
description: Start Next.js and Inngest development servers
---

Start both Next.js and Inngest development servers for the current worktree.

**What this does:**
- Starts system-wide Inngest server (if not already running)
- Provides command to start Next.js dev server
- Verifies servers are running and responsive
- Shows access URLs

**Important:** Next.js dev server runs in the foreground, so you'll need to run it in a separate terminal or use your IDE's task runner.

---

## Implementation Steps

1. **Load or create configuration:**
   ```bash
   # Check if config exists
   if [ ! -f ".claude/plugins/workspace-dev-servers/config.json" ]; then
     mkdir -p .claude/plugins/workspace-dev-servers
     # Create default config
   fi
   ```

2. **Start Inngest first** (Next.js depends on it):
   ```
   Task(subagent_type="inngest-server", prompt="Ensure Inngest dev server is running (idempotent start). Use configuration from .claude/plugins/workspace-dev-servers/config.json or defaults: port 8288, watch ports 5001-5005.")
   ```

3. **Prepare Next.js start command:**
   ```
   Task(subagent_type="nextjs-server", prompt="Prepare command to start Next.js dev server for this worktree. Load configuration from .claude/plugins/workspace-dev-servers/config.json or use defaults. Return the command the user should run.")
   ```

4. **Present instructions:**
   ```
   ✓ Inngest dev server running on port 8288
     UI: http://localhost:8288

   To start Next.js dev server, run this command:

     DEV_PORT=5001 pnpm exec next dev --turbopack -p 5001

   Options for running:
   • Open a new terminal and run the command
   • Use your IDE's task runner (VS Code, etc.)
   • Add to tmux/screen session

   Once started, access at: http://localhost:5001
   ```

5. **Offer to check status after a moment:**
   ```
   After starting Next.js, use /dev-server to check status.
   ```

## Notes

- Inngest starts as a detached background process
- Next.js runs in foreground (limitation of Next.js dev server)
- Both servers auto-restart on code changes
- Use `/dev-server-stop` to stop servers
