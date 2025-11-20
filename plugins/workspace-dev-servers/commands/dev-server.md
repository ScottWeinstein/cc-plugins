---
description: Show status of all development servers
---

Check the status of Next.js and Inngest development servers for the current worktree.

**What this does:**
- Checks if Next.js dev server is running on assigned port
- Checks if system-wide Inngest server is running
- Tests HTTP connectivity to verify servers are responsive
- Shows access URLs and PIDs

**How it works:**
1. Loads configuration from `.claude/plugins/workspace-dev-servers/config.json`
2. Delegates to specialized agents:
   - `nextjs-server` agent: Checks Next.js status
   - `inngest-server` agent: Checks Inngest status
3. Presents unified status view

**If configuration doesn't exist:**
- Creates default config with sensible defaults
- Uses ports 5001-5005 for Next.js
- Uses port 8288 for Inngest

---

Use the Task tool to launch agents in parallel for checking status:

```
Task(subagent_type="nextjs-server", prompt="Check status of Next.js dev server for this worktree. Load configuration from .claude/plugins/workspace-dev-servers/config.json if it exists, otherwise use default port 5001.")

Task(subagent_type="inngest-server", prompt="Check status of system-wide Inngest dev server. Load configuration from .claude/plugins/workspace-dev-servers/config.json if it exists, otherwise use default port 8288.")
```

Then present results in a clear format:

```
📊 Development Server Status

Next.js Dev Server
  Status: ✓ Running / ✗ Stopped
  Port: 5001
  URL: http://localhost:5001
  PID: 12345
  Responsive: Yes/No

Inngest Dev Server
  Status: ✓ Running / ✗ Stopped
  Port: 8288
  URL: http://localhost:8288
  UI: http://localhost:8288
  PID: 12346
  Watching: 5001, 5002, 5003, 5004, 5005
```

If either server is not running, suggest how to start it or use `/dev-server-start`.
