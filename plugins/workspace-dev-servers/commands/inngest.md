---
description: Manage Inngest dev server (fast, script-based)
argument-hint: Optional flags (--stop, --restart, --status, --logs, --ensure)
---

Fast wrapper around the plugin's Inngest manager script.

**Usage:**
- `/inngest` - Start Inngest server
- `/inngest --status` - Check status
- `/inngest --stop` - Stop server
- `/inngest --restart` - Restart server
- `/inngest --logs` - View logs
- `/inngest --ensure` - Ensure running (idempotent)

**This runs the actual script directly, not LLM-based agents, so it's instant!**

---

Execute the plugin's script:

```bash
# Get the plugin directory
PLUGIN_DIR="${CLAUDE_PLUGIN_DIR:-$HOME/.claude/plugins}/workspace-dev-servers"

# Check if plugin scripts exist
if [ ! -f "$PLUGIN_DIR/scripts/worktree/manager.mjs" ]; then
  echo "❌ Plugin scripts not found at: $PLUGIN_DIR"
  echo "Try using /dev-server-start (LLM-based) or reinstall the plugin"
  exit 1
fi

# Run the script with --inngest flag and any provided arguments
node "$PLUGIN_DIR/scripts/worktree/manager.mjs" --inngest "$@"
```

**Notes:**
- Much faster than LLM-based commands (instant execution)
- Uses the same battle-tested scripts from flowt-cx
- Scripts are maintained in the plugin, not your project
- System-wide Inngest server shared across all worktrees
