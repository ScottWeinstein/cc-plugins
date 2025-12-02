# wt-dev

Unified worktree and Inngest dev server management for multi-worktree Next.js projects.

## Installation

```bash
# Install from GitHub
pnpm add -D "github:ScottWeinstein/cc-plugins#main&path:plugins/wt-dev"
```

The postinstall script will automatically register the Claude Code plugin.

### Verify Installation

```bash
# Check CLI is working
npx wt-dev --help

# Check Claude Code plugin is registered
npx wt-dev register --status
```

finally, add `.claude/plugins/wt-dev` to `.gitignore`

## Configuration

Add to your `package.json`:

```json
{
  "scripts": {
    "dev": "wt-dev dev",
    "inngest": "wt-dev inngest"
  },
  "devServer": {
    "basePort": 3000,
    "inngestPort": 8288
  }
}
```

- `basePort`: Starting port for the pool (default: 5001). 128 ports are generated starting from this value.
- `inngestPort`: Port for the shared Inngest server (default: 8288)

Each worktree gets a deterministic port based on its path hash.

## Usage

### Dev Server

```bash
pnpm dev              # Start dev server
pnpm dev --force      # Kill existing and restart
pnpm dev --status     # Show status and URL
pnpm dev --stop       # Stop server
pnpm dev --logs       # Tail logs
```

Override port: `PORT=3000 pnpm dev`

### Inngest Server

```bash
pnpm inngest          # Start/ensure Inngest running
pnpm inngest --status # Show status
pnpm inngest --stop   # Stop (affects all worktrees!)
pnpm inngest --restart
pnpm inngest --logs
```

### Plugin Management

```bash
npx wt-dev register           # Register Claude Code plugin
npx wt-dev register --status  # Check registration status
npx wt-dev register --force   # Force re-register
npx wt-dev unregister         # Remove registration
```

## Claude Code Skills

After installation, Claude Code gains two skills:

- **dev-server**: Manages per-worktree Next.js dev servers
- **inngest**: Manages the shared Inngest dev server

These skills teach Claude how to use wt-dev commands and handle common scenarios like port conflicts.

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

- **Port assignment**: Hash-based with collision detection. Each worktree gets a deterministic port based on MD5(worktreePath). Collision resolution uses secondary hashes. Creation order priority ensures ports never change when worktrees are added/removed.
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
  registerPlugin,
  checkRegistration,
} from 'wt-dev';

// Get worktree port and URL
const wtConfig = getWorktreeConfig();
console.log(wtConfig.port); // 5001
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
if (await isPortInUse(5001)) {
  /* ... */
}

// Plugin registration
const result = registerPlugin({ force: true });
const regStatus = checkRegistration();
```

## Requirements

- Node.js >= 18
- pnpm
- Next.js with turbopack (for dev server)
- Claude Code (for skills)

## License

MIT
