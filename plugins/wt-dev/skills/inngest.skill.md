---
description: Use this skill when managing the shared Inngest dev server, checking Inngest status, starting/stopping Inngest, or debugging Inngest connectivity. Triggers on "start inngest", "inngest status", "stop inngest", "inngest not running", "inngest server", "pnpm inngest", "background jobs".
---

# Inngest Server Management

## Purpose

Manage the system-wide Inngest dev server that is shared across all worktrees. Inngest provides background job processing and event-driven workflows.

## Commands

| Command                  | Description                              |
| ------------------------ | ---------------------------------------- |
| `pnpm inngest`           | Start/ensure Inngest server is running   |
| `pnpm inngest --status`  | Check if server is running               |
| `pnpm inngest --stop`    | Stop the server (affects ALL worktrees!) |
| `pnpm inngest --restart` | Restart the server                       |
| `pnpm inngest --logs`    | Tail the Inngest log file                |

## Shared Server Warning

**IMPORTANT**: The Inngest server is shared across ALL worktrees. Stopping it affects every running dev server in the project.

Before stopping, confirm with the user:

- "Stopping Inngest will affect all worktrees. Continue?"

## Usage Protocol

1. **Inngest starts automatically** with `pnpm dev` - you rarely need to manage it directly.

2. **Check status if background jobs aren't processing**:

   ```bash
   pnpm inngest --status
   ```

3. **Restart if Inngest becomes unresponsive**:
   ```bash
   pnpm inngest --restart
   ```

## Configuration

The Inngest server is configured in `package.json`:

```json
{
  "devServer": {
    "ports": [5001, 5002, 5003, 5004, 5005],
    "inngestPort": 8288
  }
}
```

- `inngestPort`: Fixed port for the Inngest UI/API (default: 8288)
- `ports`: Dev server ports that Inngest monitors for SDK discovery

## Architecture

```
┌─────────────────┐     ┌─────────────────┐
│ Worktree A      │     │ Worktree B      │
│ Port 5001       │     │ Port 5002       │
│ /api/inngest    │     │ /api/inngest    │
└────────┬────────┘     └────────┬────────┘
         │                       │
         └───────────┬───────────┘
                     │
              ┌──────▼──────┐
              │   Inngest   │
              │  Port 8288  │
              │  (shared)   │
              └─────────────┘
```

## Common Scenarios

### Background Jobs Not Running

```bash
pnpm inngest --status    # Check if running
pnpm inngest --logs      # Check for errors
pnpm inngest --restart   # Restart if needed
```

### Inngest UI Access

- URL: http://localhost:8288
- Shows registered functions, event history, run status

### Debugging

```bash
pnpm inngest --logs      # View Inngest output
lsof -i :8288            # Check what's using port
```

## Pre-Approved Operations

When using this skill, you can execute:

- `pnpm inngest`, `pnpm inngest --status`, `pnpm inngest --stop`, `pnpm inngest --restart`, `pnpm inngest --logs`
- `lsof -i :8288` to check port usage
- `curl localhost:8288` to test connectivity
