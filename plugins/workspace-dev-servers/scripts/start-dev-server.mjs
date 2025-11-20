#!/usr/bin/env node

/**
 * Start Next.js dev server with duplicate prevention
 *
 * This wrapper ensures only one dev server runs per worktree by:
 * 1. Checking if a server is already running on the assigned port
 * 2. Providing options to user if server is already running
 * 3. Starting the dev server only if port is free or --force is used
 *
 * Usage:
 *   node scripts/start-dev-server.mjs           # Start with duplicate check
 *   node scripts/start-dev-server.mjs --force   # Kill existing and restart
 *   node scripts/start-dev-server.mjs --stop    # Stop the dev server
 *   node scripts/start-dev-server.mjs --status  # Check dev server status
 */

/* eslint-disable no-console */
/* eslint-disable no-restricted-properties */

import { spawn, execFileSync } from 'child_process';
import http from 'http';
import https from 'https';
import { isPortInUse, findProcessesUsingPort } from './worktree/port-detection.mjs';
import { getWorktreeConfig } from './worktree/manager.mjs';

// ANSI color codes
const colors = {
  BLUE: '\x1b[0;34m',
  GREEN: '\x1b[0;32m',
  YELLOW: '\x1b[1;33m',
  RED: '\x1b[0;31m',
  NC: '\x1b[0m', // No Color
};

// Timeout constants (in milliseconds)
const SIGTERM_WAIT_MS = 1500;
const SIGKILL_WAIT_MS = 1000;

// Banner line for consistent formatting
const BANNER_LINE = `${colors.BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.NC}`;

/**
 * Print a section header with title
 */
function printHeader(title) {
  console.log('');
  console.log(BANNER_LINE);
  console.log(`${colors.BLUE}${title}${colors.NC}`);
  console.log(BANNER_LINE);
  console.log('');
}

/**
 * Print a section footer
 */
function printFooter() {
  console.log('');
  console.log(BANNER_LINE);
  console.log('');
}

/**
 * Get the process group ID for a given PID
 */
function getProcessGroupId(pid) {
  try {
    const output = execFileSync('ps', ['-o', 'pgid=', '-p', pid.toString()], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    const pgid = parseInt(output.trim(), 10);
    // Return null if parseInt returned NaN (malformed output)
    return Number.isNaN(pgid) ? null : pgid;
  } catch {
    return null;
  }
}

/**
 * Kill processes using the specified port
 */
async function killProcessesOnPort(port) {
  const pids = findProcessesUsingPort(port);

  if (pids.length === 0) {
    return true;
  }

  console.log(`${colors.YELLOW}Stopping ${pids.length} process(es) on port ${port}...${colors.NC}`);

  // Collect unique process groups to kill and track which PIDs belong to them
  const processGroups = new Set();
  const pidToGroup = new Map();

  for (const pid of pids) {
    const pgid = getProcessGroupId(pid);
    if (pgid && pgid > 1) {
      processGroups.add(pgid);
      pidToGroup.set(pid, pgid);
    }
  }

  // Track which groups were successfully killed
  const killedGroups = new Set();

  // Kill process groups first (this kills all child processes too)
  for (const pgid of processGroups) {
    try {
      // Send SIGTERM to entire process group (negative PID)
      process.kill(-pgid, 'SIGTERM');
      console.log(`  ✓ Stopped process group ${pgid}`);
      killedGroups.add(pgid);
    } catch (error) {
      if (error.code === 'ESRCH') {
        console.log(`  ✓ Process group ${pgid} already stopped`);
        killedGroups.add(pgid);
      } else {
        // Fall back to killing individual processes
        console.log(`  ⚠ Could not stop process group ${pgid}, trying individual processes...`);
      }
    }
  }

  // Kill individual PIDs only if their process group wasn't already killed
  for (const pid of pids) {
    const pgid = pidToGroup.get(pid);
    if (pgid && killedGroups.has(pgid)) {
      // Skip - already killed via process group
      continue;
    }
    try {
      process.kill(pid, 'SIGTERM');
      console.log(`  ✓ Stopped process ${pid}`);
    } catch (error) {
      if (error.code !== 'ESRCH') {
        console.warn(
          `  ${colors.YELLOW}⚠ Could not stop process ${pid}: ${error.message}${colors.NC}`,
        );
      }
    }
  }

  // Wait for processes to die
  await new Promise((resolve) => setTimeout(resolve, SIGTERM_WAIT_MS));

  // Verify port is now free
  let stillInUse = await isPortInUse(port);

  // If still in use, try SIGKILL
  if (stillInUse) {
    console.log(
      `${colors.YELLOW}  Processes not responding to SIGTERM, sending SIGKILL...${colors.NC}`,
    );

    let sigkillCount = 0;

    for (const pgid of processGroups) {
      try {
        process.kill(-pgid, 'SIGKILL');
        sigkillCount++;
      } catch {
        // Process group already dead, which is fine
      }
    }

    for (const pid of pids) {
      try {
        process.kill(pid, 'SIGKILL');
        sigkillCount++;
      } catch {
        // Process already dead, which is fine
      }
    }

    if (sigkillCount > 0) {
      console.log(`  Sent SIGKILL to ${sigkillCount} process(es)`);
    }

    // Wait again
    await new Promise((resolve) => setTimeout(resolve, SIGKILL_WAIT_MS));
    stillInUse = await isPortInUse(port);
  }

  if (stillInUse) {
    console.error(
      `${colors.RED}✗ Port ${port} is still in use after stopping processes${colors.NC}`,
    );
    console.error('  Try stopping manually with: lsof -ti :' + port + ' | xargs kill -9');
    return false;
  }

  console.log(`${colors.GREEN}✓ Port ${port} is now available${colors.NC}`);
  return true;
}

/**
 * Test HTTP connection to the dev server
 */
async function testConnection(baseUrl) {
  return new Promise((resolve) => {
    const httpModule = baseUrl.startsWith('https') ? https : http;
    const req = httpModule.get(baseUrl, { rejectUnauthorized: false }, (res) => {
      resolve(res.statusCode);
    });

    req.on('error', () => {
      resolve(0);
    });

    req.setTimeout(2000, () => {
      req.destroy();
      resolve(0);
    });
  });
}

/**
 * Stop the dev server on the worktree port
 */
async function stopDevServer(port) {
  printHeader('Stopping Dev Server');

  const portInUse = await isPortInUse(port);

  if (!portInUse) {
    console.log(`${colors.YELLOW}⚠ Dev server is not running on port ${port}${colors.NC}`);
    printFooter();
    return true;
  }

  const success = await killProcessesOnPort(port);

  if (success) {
    console.log(`${colors.GREEN}✓ Dev server stopped${colors.NC}`);
  } else {
    console.log(`${colors.RED}✗ Failed to stop dev server${colors.NC}`);
  }

  printFooter();

  return success;
}

/**
 * Show dev server status
 */
async function showStatus(config) {
  printHeader('Dev Server Status Check');

  console.log('Worktree Configuration:');
  console.log(`  Port:     ${colors.BLUE}${config.port}${colors.NC}`);
  console.log(`  Base URL: ${colors.BLUE}${config.baseUrl}${colors.NC}`);
  console.log(`  Protocol: ${colors.BLUE}${config.protocol}${colors.NC}`);
  console.log('');

  // Check if dev server is running
  const serverRunning = await isPortInUse(config.port);

  if (serverRunning) {
    console.log(`${colors.GREEN}✓ Dev server IS RUNNING on port ${config.port}${colors.NC}`);
    console.log('');
    console.log(`  Access at: ${colors.GREEN}${config.baseUrl}${colors.NC}`);

    // Test connection
    console.log('');
    console.log('Testing connection...');
    const httpCode = await testConnection(config.baseUrl);

    if (httpCode === 200 || httpCode === 307) {
      console.log(`${colors.GREEN}✓ Server responds successfully (HTTP ${httpCode})${colors.NC}`);
    } else if (httpCode === 0) {
      console.log(`${colors.YELLOW}⚠ Server detected but connection failed${colors.NC}`);
      console.log('  This may be normal if server is still starting up');
    } else {
      console.log(`${colors.YELLOW}⚠ Server responded with HTTP ${httpCode}${colors.NC}`);
    }
  } else {
    console.log(`${colors.RED}✗ Dev server is NOT RUNNING on port ${config.port}${colors.NC}`);
    console.log('');
    console.log('To start the dev server:');
    console.log(`  ${colors.GREEN}pnpm dev${colors.NC}`);
    console.log('');
    console.log('Note: Each worktree needs its own dev server');
  }

  printFooter();
}

/**
 * Start the Next.js dev server
 */
function startDevServer(port) {
  console.log('');
  console.log(`${colors.GREEN}Starting Next.js dev server on port ${port}...${colors.NC}`);
  console.log('');

  // Ensure Inngest is running first
  const inngestCheck = spawn('node', ['scripts/worktree/manager.mjs', 'inngest', 'ensure'], {
    stdio: 'inherit',
  });

  inngestCheck.on('close', (code) => {
    if (code !== 0) {
      console.warn(`${colors.YELLOW}⚠ Inngest check failed, continuing anyway...${colors.NC}`);
    }

    // Start Next.js with turbopack using pnpm exec
    const nextArgs = ['exec', 'next', 'dev', '--turbopack', '-p', port.toString()];

    const devProcess = spawn('pnpm', nextArgs, {
      stdio: 'inherit',
      env: { ...process.env, DEV_PORT: port.toString() },
    });

    // Handle process exit
    devProcess.on('exit', (exitCode) => {
      if (exitCode !== 0 && exitCode !== null) {
        console.error(`${colors.RED}✗ Dev server exited with code ${exitCode}${colors.NC}`);
        process.exit(exitCode);
      }
    });

    // Handle termination signals
    const handleShutdown = (signal) => {
      console.log('');
      console.log(`${colors.YELLOW}Received ${signal}, stopping dev server...${colors.NC}`);
      devProcess.kill(signal);
      setTimeout(() => process.exit(0), 1000);
    };

    process.on('SIGINT', () => handleShutdown('SIGINT'));
    process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  });
}

async function main() {
  const args = process.argv.slice(2);
  const forceRestart = args.includes('--force');
  const stopServer = args.includes('--stop');
  const checkStatus = args.includes('--status');

  // Validate conflicting flags
  const flagCount = [forceRestart, stopServer, checkStatus].filter(Boolean).length;
  if (flagCount > 1) {
    console.error(
      `${colors.RED}✗ Error: Cannot use --force, --stop, and --status together${colors.NC}`,
    );
    console.error('  Use only one flag at a time');
    process.exit(1);
  }

  try {
    // Get worktree configuration
    const config = await getWorktreeConfig();
    const port = config.port;

    // Handle --status flag
    if (checkStatus) {
      await showStatus(config);
      process.exit(0);
    }

    // Handle --stop flag
    if (stopServer) {
      const success = await stopDevServer(port);
      process.exit(success ? 0 : 1);
    }

    printHeader('Next.js Dev Server');
    console.log(`Worktree port: ${colors.BLUE}${port}${colors.NC}`);
    console.log(`Base URL:      ${colors.BLUE}${config.baseUrl}${colors.NC}`);
    console.log('');

    // Check if port is already in use
    const portInUse = await isPortInUse(port);

    if (portInUse) {
      if (forceRestart) {
        console.log(`${colors.YELLOW}⚠ Dev server is already running on port ${port}${colors.NC}`);
        console.log(`${colors.YELLOW}Force restart requested...${colors.NC}`);
        console.log('');

        const success = await killProcessesOnPort(port);
        if (!success) {
          process.exit(1);
        }

        // Continue to start server
      } else {
        console.log(`${colors.YELLOW}⚠ Dev server is already running on port ${port}${colors.NC}`);
        console.log('');
        console.log('Options:');
        console.log(`  1. Access existing server: ${colors.GREEN}${config.baseUrl}${colors.NC}`);
        console.log(`  2. Check status:            ${colors.GREEN}pnpm dev --status${colors.NC}`);
        console.log(`  3. Force restart:           ${colors.GREEN}pnpm dev --force${colors.NC}`);
        console.log(`  4. Stop server:             ${colors.GREEN}pnpm dev --stop${colors.NC}`);
        console.log('');
        console.log(`${colors.BLUE}Note: Only one dev server should run per worktree${colors.NC}`);
        printFooter();
        process.exit(0);
      }
    }

    // Start the dev server
    startDevServer(port);
  } catch (error) {
    console.error(`${colors.RED}✗ Error: ${error.message}${colors.NC}`);
    process.exit(1);
  }
}

main();
