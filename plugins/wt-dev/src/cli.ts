#!/usr/bin/env node

/**
 * wt-dev CLI - Unified worktree and Inngest management
 *
 * Usage:
 *   wt-dev dev              # Start dev server (checks for duplicates)
 *   wt-dev dev --force      # Kill existing, restart
 *   wt-dev dev --stop       # Stop dev server
 *   wt-dev dev --status     # Show status
 *   wt-dev dev --logs       # Tail logs
 *
 *   wt-dev inngest          # Start/ensure Inngest running
 *   wt-dev inngest --stop   # Stop Inngest
 *   wt-dev inngest --status # Show status
 *   wt-dev inngest --logs   # Tail logs
 *   wt-dev inngest --restart # Restart Inngest
 */

import { loadConfig } from "./config.js";
import {
  startDevServer,
  stopDevServer,
  showDevServerStatus,
  showDevServerLogs,
} from "./dev-server/manager.js";
import {
  startInngestServer,
  stopInngestServer,
  showInngestStatus,
  showInngestLogs,
  restartInngestServer,
} from "./inngest/manager.js";
import { registerPlugin, unregisterPlugin, checkRegistration } from "./register.js";

const HELP = `
wt-dev - Unified worktree and Inngest management

Usage:
  wt-dev dev [options]      Manage dev server
  wt-dev inngest [options]  Manage Inngest server
  wt-dev register           Register Claude Code plugin
  wt-dev unregister         Unregister Claude Code plugin
  wt-dev --help             Show this help

Dev Server Options:
  (no option)     Start dev server (checks for duplicates)
  --force         Kill existing server and restart
  --stop          Stop the dev server
  --status        Show server status
  --logs          Tail the log file

Inngest Server Options:
  (no option)     Start/ensure Inngest server is running
  --stop          Stop Inngest server (affects all worktrees!)
  --status        Show server status
  --logs          Tail the log file
  --restart       Restart the server

Register Options:
  (no option)     Register plugin with Claude Code
  --force         Overwrite existing registration
  --status        Check registration status

Configuration:
  Add to your package.json:
  {
    "devServer": {
      "ports": [5001, 5002, 5003, 5004, 5005],
      "inngestPort": 8288
    }
  }

Examples:
  pnpm dev                # Start dev server
  pnpm dev --status       # Check if running
  pnpm dev --force        # Force restart
  pnpm inngest            # Start Inngest
  pnpm inngest --stop     # Stop Inngest
  npx wt-dev register     # Register Claude Code plugin
`;

function showHelp(): void {
  console.log(HELP);
}

function parseArgs(args: string[]): {
  command: string;
  flags: Set<string>;
} {
  const command = args[0] || "";
  const flags = new Set<string>();

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      flags.add(arg.slice(2));
    } else if (arg.startsWith("-")) {
      flags.add(arg.slice(1));
    }
  }

  return { command, flags };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Handle help
  if (args.includes("--help") || args.includes("-h") || args.length === 0) {
    showHelp();
    process.exit(0);
  }

  const { command, flags } = parseArgs(args);
  const config = loadConfig();

  try {
    switch (command) {
      case "dev": {
        // Validate no conflicting flags
        const actionFlags = ["force", "stop", "status", "logs"].filter((f) => flags.has(f));
        if (actionFlags.length > 1) {
          console.error(`Error: Cannot use multiple flags together: --${actionFlags.join(", --")}`);
          process.exit(1);
        }

        if (flags.has("status")) {
          await showDevServerStatus(config);
        } else if (flags.has("stop")) {
          const success = await stopDevServer(config);
          process.exit(success ? 0 : 1);
        } else if (flags.has("logs")) {
          showDevServerLogs(config);
        } else {
          await startDevServer(config, { force: flags.has("force") });
        }
        break;
      }

      case "inngest": {
        // Validate no conflicting flags
        const actionFlags = ["stop", "status", "logs", "restart"].filter((f) => flags.has(f));
        if (actionFlags.length > 1) {
          console.error(`Error: Cannot use multiple flags together: --${actionFlags.join(", --")}`);
          process.exit(1);
        }

        if (flags.has("status")) {
          showInngestStatus(config);
        } else if (flags.has("stop")) {
          await stopInngestServer(config);
        } else if (flags.has("logs")) {
          showInngestLogs(config);
        } else if (flags.has("restart")) {
          await restartInngestServer(config);
        } else {
          await startInngestServer(config);
        }
        break;
      }

      case "register": {
        if (flags.has("status")) {
          const status = checkRegistration();
          if (status.registered) {
            console.log(`✓ Plugin registered at ${status.pluginPath}`);
            console.log(`  Project root: ${status.projectRoot}`);
          } else {
            console.log("✗ Plugin not registered");
            if (status.projectRoot) {
              console.log(`  Project root: ${status.projectRoot}`);
              console.log("  Run: npx wt-dev register");
            }
          }
        } else {
          const result = registerPlugin({ force: flags.has("force") });
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

      case "unregister": {
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
    console.error(`Error: ${error instanceof Error ? error.message : "Unknown error"}`);
    process.exit(1);
  }
}

main();
