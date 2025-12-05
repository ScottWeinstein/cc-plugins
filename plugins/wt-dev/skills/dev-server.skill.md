---
description: Use this skill when managing dev servers in multi-worktree projects, starting/stopping Next.js servers, checking dev server status, or debugging port conflicts. Triggers on "start dev server", "dev server status", "stop dev server", "port in use", "dev server not running", "pnpm dev".
---

# Dev Server Management

## Purpose

Manage per-worktree Next.js development servers with automatic port assignment and duplicate prevention.

## Commands

| Command             | Description                                    |
| ------------------- | ---------------------------------------------- |
| `pnpm dev`          | Start dev server (checks for duplicates first) |
| `pnpm dev --force`  | Kill existing server and restart               |
| `pnpm dev --status` | Check if server is running and show URL        |
| `pnpm dev --stop`   | Stop the dev server                            |
| `pnpm dev --logs`   | Tail the dev server log file                   |

## Usage Protocol

1. **ALWAYS check status before browser testing**: Run `pnpm dev --status` to verify the server is running and get the correct URL.

2. **Never assume server is running** from previous context - worktrees have different ports.

3. **If port conflict detected**: Ask user whether to:
   - Access the existing server (show URL from status)
   - Force restart with `pnpm dev --force`

## Port Assignment

- Ports are assigned via MD5 hash of project root path
- Each worktree gets a consistent port across restarts
- Default port pool: 5001-5005 (configurable in package.json)
- Override with `PORT=3000 pnpm dev`

## Configuration

Projects configure ports in `package.json`:

```json
{
  "devServer": {
    "basePort": 3000,
    "maxPorts": 10,
    "inngestPort": 8288
  }
}
```

## Common Scenarios

### Starting Fresh

```bash
pnpm dev           # Start if not running, report status and port if already running
```

### Port Conflict or Stuck Server

```bash
pnpm dev --force   # Kill and restart
```

### Debugging

```bash
pnpm dev --logs    # View server output
lsof -i :5001      # Check what's using port
```

## Integration with Inngest

The dev server automatically ensures the Inngest server is running before starting. You don't need to manually start Inngest.

## Pre-Approved Operations

When using this skill, you can execute:

- `pnpm dev`, `pnpm dev --force`, `pnpm dev --stop`, `pnpm dev --status`, `pnpm dev --logs`
- `lsof -i :PORT` to check port usage
- `curl localhost:PORT` to test connectivity
- Read `package.json` for configuration
