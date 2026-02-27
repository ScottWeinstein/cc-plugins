#!/usr/bin/env node

/**
 * wt-dev CLI - Unified worktree and Inngest management
 *
 * Usage:
 *   wt-dev dev              # Start dev server (checks for duplicates)
 *   wt-dev dev --force      # Kill existing, restart
 *   wt-dev dev --stop       # Stop dev server
 *   wt-dev dev --logs       # Tail logs
 *
 *   wt-dev inngest          # Start/ensure Inngest running
 *   wt-dev inngest --stop   # Stop Inngest
 *   wt-dev inngest --status # Show status
 *   wt-dev inngest --logs   # Tail logs
 *   wt-dev inngest --restart # Restart Inngest
 */

import { loadConfig } from './config.js';
import { startDevServer, stopDevServer, showDevServerLogs } from './dev-server/manager.js';
import {
  startInngestServer,
  stopInngestServer,
  showInngestStatus,
  showInngestLogs,
  restartInngestServer,
} from './inngest/manager.js';
import { registerPlugin, unregisterPlugin, checkRegistration } from './register.js';

const HELP = `
wt-dev - Unified worktree and Inngest management

Usage:
  wt-dev dev [options]      Manage dev server
  wt-dev inngest [options]  Manage Inngest server

Quick start:
  pnpm dev              # Start dev server
  pnpm dev --force      # Force restart
  pnpm dev --stop       # Stop server
  pnpm dev --logs       # Tail logs

Run 'wt-dev <command> --help' for all options (including register, config).
`;

const DEV_HELP = `
wt-dev dev - Dev server management

Options:
  (no option)   Start dev server (checks for duplicates)
  --force       Kill existing server and restart
  --stop        Stop the dev server
  --logs        Tail the log file

Configuration (package.json):
  {
    "devServer": {
      "basePort": 5001,
      "maxPorts": 128,
      "inngestPort": 8288
    }
  }

Examples:
  pnpm dev              # Start dev server
  pnpm dev --force      # Force restart
  pnpm dev --stop       # Stop server
  pnpm dev --logs       # Tail logs
  PORT=3000 pnpm dev    # Override port
`;

const INNGEST_HELP = `
wt-dev inngest - Inngest server management

Options:
  (no option)   Start/ensure Inngest server is running
  --stop        Stop Inngest server (affects all worktrees!)
  --status      Show server status
  --logs        Tail the log file
  --restart     Restart the server

Configuration (package.json):
  {
    "devServer": {
      "inngestPort": 8288
    }
  }

Examples:
  pnpm inngest            # Start Inngest
  pnpm inngest --status   # Check status
  pnpm inngest --stop     # Stop (affects all worktrees!)
  pnpm inngest --restart  # Restart
  pnpm inngest --logs     # Tail logs
`;

const REGISTER_HELP = `
wt-dev register - Claude Code plugin management

Options:
  (no option)   Register plugin with Claude Code
  --force       Overwrite existing registration
  --status      Check registration status
  --help        Show this help

Other commands:
  wt-dev unregister     Remove registration

Configuration (package.json):
  {
    "devServer": {
      "basePort": 5001,
      "maxPorts": 128,
      "inngestPort": 8288
    }
  }

Examples:
  npx wt-dev register           # Register plugin
  npx wt-dev register --force   # Re-register (e.g. after moving project)
  npx wt-dev register --status  # Verify registration
  npx wt-dev unregister         # Remove registration
`;

function showHelp(): void {
  console.log(HELP);
}

function parseArgs(args: string[]): {
  command: string;
  flags: Set<string>;
} {
  const command = args[0] || '';
  const flags = new Set<string>();

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      flags.add(arg.slice(2));
    } else if (arg.startsWith('-')) {
      flags.add(arg.slice(1));
    }
  }

  return { command, flags };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Handle help
  if (args[0] === '--help' || args[0] === '-h' || args.length === 0) {
    showHelp();
    process.exit(0);
  }

  const { command, flags } = parseArgs(args);
  const config = loadConfig();

  try {
    switch (command) {
      case 'dev': {
        if (flags.has('help') || flags.has('h')) {
          console.log(DEV_HELP);
          process.exit(0);
        }
        // Validate no conflicting flags
        const actionFlags = ['force', 'stop', 'logs'].filter((f) => flags.has(f));
        if (actionFlags.length > 1) {
          console.error(`Error: Cannot use multiple flags together: --${actionFlags.join(', --')}`);
          process.exit(1);
        }

        if (flags.has('stop')) {
          const success = await stopDevServer(config);
          process.exit(success ? 0 : 1);
        } else if (flags.has('logs')) {
          showDevServerLogs(config);
        } else {
          await startDevServer(config, { force: flags.has('force') });
        }
        break;
      }

      case 'inngest': {
        if (flags.has('help') || flags.has('h')) {
          console.log(INNGEST_HELP);
          process.exit(0);
        }
        // Validate no conflicting flags
        const actionFlags = ['stop', 'status', 'logs', 'restart'].filter((f) => flags.has(f));
        if (actionFlags.length > 1) {
          console.error(`Error: Cannot use multiple flags together: --${actionFlags.join(', --')}`);
          process.exit(1);
        }

        if (flags.has('status')) {
          showInngestStatus(config);
        } else if (flags.has('stop')) {
          await stopInngestServer(config);
        } else if (flags.has('logs')) {
          showInngestLogs(config);
        } else if (flags.has('restart')) {
          await restartInngestServer(config);
        } else {
          await startInngestServer(config);
        }
        break;
      }

      case 'register': {
        if (flags.has('help') || flags.has('h')) {
          console.log(REGISTER_HELP);
          process.exit(0);
        }
        if (flags.has('status')) {
          const status = checkRegistration();
          if (status.registered) {
            console.log(`✓ Plugin registered at ${status.pluginPath}`);
            console.log(`  Project root: ${status.projectRoot}`);
          } else {
            console.log('✗ Plugin not registered');
            if (status.projectRoot) {
              console.log(`  Project root: ${status.projectRoot}`);
              console.log('  Run: npx wt-dev register');
            }
          }
        } else {
          const result = registerPlugin({ force: flags.has('force') });
          if (result.success) {
            console.log(`✓ ${result.message}`);
            if (result.pluginPath) {
              console.log(`  Skills available: dev-server, inngest`);
            }
          } else {
            console.error(`✗ ${result.message}`);
            process.exit(1);
          }
        }
        break;
      }

      case 'unregister': {
        const result = unregisterPlugin();
        if (result.success) {
          console.log(`✓ ${result.message}`);
        } else {
          console.error(`✗ ${result.message}`);
          process.exit(1);
        }
        break;
      }

      default:
        console.error(`Unknown command: ${command}`);
        console.error('Run "wt-dev --help" for usage information.');
        process.exit(1);
    }
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}

main();
