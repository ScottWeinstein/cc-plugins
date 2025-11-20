---
description: Setup dev server management in your project
---

Sets up development server management in your Next.js project. You have two options:

1. **Plugin-only mode** (recommended) - Use `/dev` and `/inngest` commands directly
2. **Package.json scripts** - Add scripts so you can use `pnpm dev` and `pnpm inngest`

---

## Setup Process

Present the user with options using AskUserQuestion:

```json
{
  "question": "How would you like to set up dev server management?",
  "header": "Setup Mode",
  "multiSelect": false,
  "options": [
    {
      "label": "Plugin commands only",
      "description": "Use /dev and /inngest commands (no changes to your project)"
    },
    {
      "label": "Add package.json scripts",
      "description": "Add 'dev' and 'inngest' scripts to package.json for pnpm/npm usage"
    },
    {
      "label": "Symlink scripts to project",
      "description": "Create scripts/ directory with symlinks to plugin scripts"
    }
  ]
}
```

### Option 1: Plugin Commands Only

No changes needed! Just inform the user:

```
✓ Plugin is ready to use!

Available commands:
  /dev              - Start Next.js dev server
  /dev --status     - Check server status
  /dev --stop       - Stop server
  /dev --force      - Force restart

  /inngest          - Start Inngest server
  /inngest --status - Check Inngest status
  /inngest --stop   - Stop Inngest
  /inngest --logs   - View logs

No changes to your project needed!
```

### Option 2: Add package.json Scripts

Add scripts to package.json that reference the plugin scripts:

```bash
# Get plugin directory
PLUGIN_DIR="${CLAUDE_PLUGIN_DIR:-$HOME/.claude/plugins}/workspace-dev-servers"

# Read current package.json
SCRIPTS=$(cat package.json | jq '.scripts // {}')

# Add dev and inngest scripts
NEW_SCRIPTS=$(echo "$SCRIPTS" | jq ". + {
  \"dev\": \"node '$PLUGIN_DIR/scripts/start-dev-server.mjs'\",
  \"inngest\": \"node '$PLUGIN_DIR/scripts/worktree/manager.mjs' --inngest\"
}")

# Update package.json
cat package.json | jq ".scripts = $NEW_SCRIPTS" > package.json.tmp
mv package.json.tmp package.json
```

Then inform user:

```
✓ Added scripts to package.json!

You can now use:
  pnpm dev              - Start Next.js dev server
  pnpm dev --status     - Check status
  pnpm dev --stop       - Stop server

  pnpm inngest          - Start Inngest server
  pnpm inngest --status - Check status
  pnpm inngest --logs   - View logs

Scripts reference the plugin, so updates are automatic!
```

### Option 3: Symlink Scripts

Create scripts directory with symlinks to plugin scripts:

```bash
# Get plugin directory
PLUGIN_DIR="${CLAUDE_PLUGIN_DIR:-$HOME/.claude/plugins}/workspace-dev-servers"

# Create scripts directory structure
mkdir -p scripts/worktree

# Create symlinks
ln -sf "$PLUGIN_DIR/scripts/start-dev-server.mjs" scripts/start-dev-server.mjs
ln -sf "$PLUGIN_DIR/scripts/worktree/manager.mjs" scripts/worktree/manager.mjs
ln -sf "$PLUGIN_DIR/scripts/worktree/port-detection.mjs" scripts/worktree/port-detection.mjs

# Make them executable
chmod +x scripts/start-dev-server.mjs
chmod +x scripts/worktree/manager.mjs
chmod +x scripts/worktree/port-detection.mjs

# Add to package.json
cat package.json | jq '.scripts = (.scripts // {}) + {
  "dev": "node scripts/start-dev-server.mjs",
  "inngest": "node scripts/worktree/manager.mjs --inngest"
}' > package.json.tmp
mv package.json.tmp package.json

# Add to .gitignore if not already there
grep -q "^scripts/$" .gitignore 2>/dev/null || echo "scripts/" >> .gitignore
```

Then inform user:

```
✓ Created symlinked scripts directory!

Structure:
  scripts/
    start-dev-server.mjs  → plugin script
    worktree/
      manager.mjs         → plugin script
      port-detection.mjs  → plugin script

You can now use:
  pnpm dev              - Start Next.js dev server
  pnpm inngest          - Start Inngest server

Benefits:
  ✓ Scripts are symlinks, so plugin updates apply automatically
  ✓ Works with existing workflows (pnpm dev, npm run dev)
  ✓ Scripts/ added to .gitignore (not committed)
```

## Configuration Setup

After setup, optionally create configuration:

```bash
# Check if config exists
if [ ! -f ".claude/plugins/workspace-dev-servers/config.json" ]; then
  # Ask if they want to customize ports
  # Use AskUserQuestion
fi

# Create default or custom config
mkdir -p .claude/plugins/workspace-dev-servers
cat > .claude/plugins/workspace-dev-servers/config.json << 'EOF'
{
  "nextjs": {
    "ports": [5001, 5002, 5003, 5004, 5005],
    "turbopack": true,
    "hostname": "localhost"
  },
  "inngest": {
    "enabled": true,
    "port": 8288,
    "pidFile": "/tmp/flowt-inngest.pid",
    "logFile": "inngest-system.log"
  },
  "worktree": {
    "portCacheFile": ".dev-port"
  }
}
EOF
```

## Notes

- **Symlinks are recommended** - They stay updated when plugin updates
- **Package.json scripts** work well for CI/CD and team workflows
- **Plugin commands** are fastest and require zero setup
- All approaches use the same underlying scripts
