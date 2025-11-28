# wt-dev

Unified worktree and Inngest dev server management for multi-worktree Next.js projects.

## Installation

```bash
pnpm add "github:ScottWeinstein/cc-plugins&path:plugins/wt-dev"
```

Add to `package.json`:

```json
{
  "scripts": {
    "dev": "wt-dev dev",
    "inngest": "wt-dev inngest"
  },
  "devServer": {
    "ports": [5001, 5002, 5003, 5004, 5005],
    "inngestPort": 8288
  }
}
```

## Usage

```bash
pnpm dev              # Start dev server
pnpm dev --force      # Kill existing and restart
pnpm dev --status     # Show status and URL
pnpm dev --stop       # Stop server
pnpm dev --logs       # Tail logs

pnpm inngest          # Start/ensure Inngest running
pnpm inngest --status # Show status
pnpm inngest --stop   # Stop (affects all worktrees!)
pnpm inngest --restart
pnpm inngest --logs
```

Override port: `PORT=3000 pnpm dev`

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Worktree A      │     │ Worktree B      │     │ Worktree C      │
│ Port 5001       │     │ Port 5002       │     │ Port 5003       │
│ Next.js dev     │     │ Next.js dev     │     │ Next.js dev     │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                          ┌──────▼──────┐
                          │   Inngest   │
                          │  Port 8288  │
                          │  (shared)   │
                          └─────────────┘
```

## How It Works

- **Port assignment**: MD5(projectRoot) % ports.length → consistent port per worktree
- **Process management**: SIGKILL only (Next.js ignores SIGTERM), race condition detection
- **Port detection**: ss → lsof → netstat → Node.js (multi-method fallback)
- **Inngest coordination**: Lock-based startup, PID tracking, health checks

## Programmatic API

```typescript
import {
  loadConfig,
  getWorktreeConfig,
  startDevServer,
  stopDevServer,
  ensureInngestServer,
  getInngestStatus,
  isPortInUse,
} from 'wt-dev';

// Get worktree port and URL
const wtConfig = getWorktreeConfig();
console.log(wtConfig.port);    // 5001
console.log(wtConfig.baseUrl); // http://localhost:5001

// Manage dev server
const config = loadConfig();
await startDevServer(config);
await startDevServer(config, { force: true }); // force restart
await stopDevServer(config);

// Manage Inngest (shared across worktrees)
await ensureInngestServer(config); // idempotent
const status = getInngestStatus(config);
if (status.running) console.log(`PID: ${status.pid}`);

// Port utilities
if (await isPortInUse(5001)) { /* ... */ }
```

## Requirements

Node.js >= 18, pnpm, Next.js with turbopack

## License

MIT
