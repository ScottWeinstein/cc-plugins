---
description: Start Next.js dev server (fast, script-based)
argument-hint: Optional flags (--status, --stop, --force)
---

Fast wrapper around the plugin's start-dev-server script.

**Usage:**
- `/dev` - Start dev server
- `/dev --status` - Check status
- `/dev --stop` - Stop server
- `/dev --force` - Force restart

**This runs the actual script directly, not LLM-based agents, so it's instant!**

---

Execute the plugin's script:

```bash
# Get the plugin directory
PLUGIN_DIR="${CLAUDE_PLUGIN_DIR:-$HOME/.claude/plugins}/workspace-dev-servers"

# Check if plugin scripts exist
if [ ! -f "$PLUGIN_DIR/scripts/start-dev-server.mjs" ]; then
  echo "❌ Plugin scripts not found at: $PLUGIN_DIR"
  echo "Try using /dev-server-start (LLM-based) or reinstall the plugin"
  exit 1
fi

# Run the script with any provided arguments
node "$PLUGIN_DIR/scripts/start-dev-server.mjs" "$@"
```

**Notes:**
- Much faster than LLM-based commands (instant execution)
- Uses the same battle-tested scripts from flowt-cx
- Scripts are maintained in the plugin, not your project
- All projects share the same scripts (updates benefit everyone)
