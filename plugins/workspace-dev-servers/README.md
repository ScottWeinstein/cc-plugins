# Workspace Dev Servers Plugin

Development server management for Next.js projects with git worktrees.

## Overview

This plugin manages Next.js and Inngest dev servers across multiple git worktrees. It provides both fast script-based commands and LLM-assisted helpers.

**Scripts included:**

- `start-dev-server.mjs` - Next.js dev server management
- `worktree/manager.mjs` - Inngest server and port configuration
- `worktree/port-detection.mjs` - Port detection utilities

**Commands provided:**

- Fast commands (`/dev`, `/inngest`) - Run scripts directly
- Helper commands - LLM-assisted setup and troubleshooting

## Quick Start

### Fast Commands

```bash
/dev              # Start Next.js dev server
/dev --status     # Check status
/dev --stop       # Stop server
/dev --force      # Force restart

/inngest          # Start Inngest server
/inngest --status # Check status
/inngest --stop   # Stop server
/inngest --logs   # View logs
```

These run the included scripts directly (instant execution, no LLM).

### Helper Commands

```bash
/dev-setup                              # Setup wizard
/dev-server                             # Status with explanation
/dev-server-start                       # Guided start
/dev-server-stop                        # Interactive stop
/skill workspace-dev-servers:dev-servers # Full management UI
```

These use LLM agents for guidance and troubleshooting.

## How It Works

### Port Assignment

Ports are assigned automatically based on:

1. `PORT` environment variable (if set)
2. `.dev-port` cache file (if exists)
3. MD5 hash of worktree path → index into port array
4. First available port from configured list

Default ports:

- Next.js: 5001-5005 (one per worktree)
- Inngest: 8288 (system-wide, shared across worktrees)

### Process Management

**Next.js:**

- Runs in foreground (Next.js limitation)
- Plugin provides the command to run
- Checks for duplicate servers before starting

**Inngest:**

- Runs detached in background
- PID tracked in `/tmp/flowt-inngest.pid`
- Logs to `inngest-system.log` in project root
- Auto-discovers all Next.js servers on configured ports

**Stopping processes:**

- Sends SIGTERM to process group
- Waits 1.5 seconds
- Sends SIGKILL if still running
- Verifies ports are released

## Setup Options

Run `/dev-setup` to configure how you want to use the plugin:

### Option 1: Plugin Commands Only

No changes to your project. Use `/dev` and `/inngest` commands directly.

### Option 2: Add package.json Scripts

Adds scripts to `package.json`:

```json
{
  "scripts": {
    "dev": "node <plugin-dir>/scripts/start-dev-server.mjs",
    "inngest": "node <plugin-dir>/scripts/worktree/manager.mjs --inngest"
  }
}
```

Then use: `pnpm dev`, `pnpm inngest`

### Option 3: Symlink Scripts

Creates `scripts/` directory with symlinks to plugin scripts:

```
scripts/
├── start-dev-server.mjs  → plugin script
└── worktree/
    ├── manager.mjs       → plugin script
    └── port-detection.mjs → plugin script
```

Adds to `package.json` and `.gitignore`.

Then use: `pnpm dev`, `pnpm inngest`

## Configuration

Optional. Create `.claude/plugins/workspace-dev-servers/config.json`:

```json
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
```

Configuration options:

- `nextjs.ports` - Array of ports for Next.js servers (one per worktree)
- `nextjs.turbopack` - Enable turbopack (default: true)
- `nextjs.hostname` - Bind hostname (default: "localhost")
- `inngest.enabled` - Manage Inngest server (default: true)
- `inngest.port` - System-wide Inngest port (default: 8288)
- `inngest.pidFile` - PID file path (default: "/tmp/flowt-inngest.pid")
- `inngest.logFile` - Log file name relative to project root (default: "inngest-system.log")
- `worktree.portCacheFile` - Cache file name (default: ".dev-port")

## Commands Reference

### /dev [flags]

Manage Next.js dev server.

**Flags:**

- None - Start server
- `--status` - Check if running
- `--stop` - Stop server
- `--force` - Kill and restart

**Examples:**

```bash
/dev              # Start
/dev --status     # Check status
/dev --stop       # Stop
/dev --force      # Force restart
```

### /inngest [flags]

Manage Inngest dev server.

**Flags:**

- None - Start server
- `--status` - Check status
- `--stop` - Stop server
- `--restart` - Restart server
- `--logs` - View logs
- `--ensure` - Ensure running (idempotent)

**Examples:**

```bash
/inngest              # Start
/inngest --status     # Check status
/inngest --stop       # Stop
/inngest --restart    # Restart
/inngest --logs       # View logs
```

### /dev-setup

Interactive setup wizard. Prompts for setup option and creates configuration if needed.

### /dev-server

Check status of all servers with explanation.

### /dev-server-start

Guided server startup process.

### /dev-server-stop

Interactive server stop with confirmation.

### /skill workspace-dev-servers:dev-servers

Interactive management UI with options:

- Check status
- Start servers
- Stop servers
- View logs
- Configure
- Troubleshoot

## Examples

### Basic Usage

```bash
# Check status
/dev --status
/inngest --status

# Start Inngest (background)
/inngest

# Start Next.js (shows command to run)
/dev

# In another terminal, run the provided command
DEV_PORT=5001 pnpm exec next dev --turbopack -p 5001

# Stop
/dev --stop
/inngest --stop
```

### Multiple Worktrees

```bash
# Worktree 1
cd ~/projects/my-app
/dev                    # Assigned port 5001

# Worktree 2
cd ~/projects/my-app-feature
/dev                    # Assigned port 5002

# Both share Inngest on port 8288
```

### With package.json Scripts

```bash
# After /dev-setup
pnpm dev              # Start Next.js
pnpm inngest          # Start Inngest
pnpm dev --status     # Check status
```

### Custom Ports

```json
// .claude/plugins/workspace-dev-servers/config.json
{
  "nextjs": {
    "ports": [3001, 3002, 3003]
  },
  "inngest": {
    "port": 9000
  }
}
```

```bash
/dev                  # Uses port 3001, 3002, or 3003
/inngest              # Uses port 9000
```

## Troubleshooting

### Port Already in Use

```bash
/dev --status         # Check what's running
lsof -i :5001         # See what's using the port
/dev --force          # Kill and restart
```

### Server Won't Start

```bash
# Check requirements
ls node_modules/.bin/next
pnpx inngest-cli --version

# Check logs
tail -f inngest-system.log

# Use helper
/skill workspace-dev-servers:dev-servers
```

### Stale Processes

```bash
# Check for orphans
lsof -i :5001
lsof -i :8288

# Clean up manually
kill -9 <PID>
rm -f /tmp/flowt-inngest.pid

# Restart
/dev
/inngest
```

## Migration from flowt-cx Scripts

If you have existing scripts in your project:

```bash
# Remove scripts
rm -rf scripts/

# Remove from package.json
# Delete "dev" and "inngest" entries from scripts section

# Use plugin commands
/dev
/inngest
```

Or keep package.json scripts:

```bash
# Run setup
/dev-setup
# Choose "Add package.json scripts"

# Continue using
pnpm dev
pnpm inngest
```

## Requirements

- Next.js project
- pnpm (or npm/yarn)
- Node.js (version supported by your Next.js)
- inngest-cli (optional, for Inngest management)

## Environment Variables

- `PORT` - Override assigned port
- `DEV_PORT` - Override assigned port (alternative)
- `USE_HTTPS_LOCALHOST` - Use HTTPS for localhost (requires SSL certs)
- `CLAUDE_PLUGIN_DIR` - Override plugin directory location

## File Locations

**Plugin scripts:**

- `~/.claude/plugins/workspace-dev-servers/scripts/`

**Project files created:**

- `.dev-port` - Cached port assignment
- `.claude/plugins/workspace-dev-servers/config.json` - Configuration (optional)
- `scripts/` - Symlinks (if using Option 3)
- `inngest-system.log` - Inngest logs

**System files:**

- `/tmp/flowt-inngest.pid` - Inngest PID file

## License

MIT
