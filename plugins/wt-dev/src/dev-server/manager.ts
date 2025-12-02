/**
 * Dev server manager - start/stop/status/force/logs
 *
 * Manages per-worktree Next.js dev servers with duplicate prevention
 * and automatic Inngest server coordination.
 */

import { spawn, SpawnOptions } from 'child_process';
import http from 'http';
import https from 'https';
import fs from 'fs';
import { loadConfig, getDevServerLogPath, type WtDevConfig } from '../config.js';
import { getWorktreeConfig, PortExhaustedError, type WorktreeConfig } from './port-manager.js';
import { isPortInUse } from '../shared/port-detection.js';
import { killProcessesOnPort } from '../shared/process-utils.js';
import { ensureInngestServer } from '../inngest/manager.js';

/**
 * Get worktree config with proper error handling for port exhaustion.
 * Exits with code 1 if port pool is exhausted.
 */
function getWorktreeConfigOrExit(cfg: WtDevConfig): WorktreeConfig {
  try {
    return getWorktreeConfig(cfg);
  } catch (error) {
    if (error instanceof PortExhaustedError) {
      console.error(error.message);
      process.exit(1);
    }
    throw error;
  }
}

// ANSI color codes
const colors = {
  BLUE: '\x1b[0;34m',
  GREEN: '\x1b[0;32m',
  YELLOW: '\x1b[1;33m',
  RED: '\x1b[0;31m',
  NC: '\x1b[0m', // No Color
};

const BANNER_LINE = `${colors.BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.NC}`;

function printHeader(title: string): void {
  console.log('');
  console.log(BANNER_LINE);
  console.log(`${colors.BLUE}${title}${colors.NC}`);
  console.log(BANNER_LINE);
  console.log('');
}

function printFooter(): void {
  console.log('');
  console.log(BANNER_LINE);
  console.log('');
}

/**
 * Test HTTP connection to the dev server
 */
async function testConnection(baseUrl: string): Promise<number> {
  return new Promise((resolve) => {
    const httpModule = baseUrl.startsWith('https') ? https : http;
    const req = httpModule.get(baseUrl, { rejectUnauthorized: false }, (res) => {
      resolve(res.statusCode ?? 0);
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
 * Show dev server status
 */
export async function showDevServerStatus(config?: WtDevConfig): Promise<void> {
  const cfg = config ?? loadConfig();
  const wtConfig = getWorktreeConfigOrExit(cfg);

  printHeader('Dev Server Status Check');

  console.log('Worktree Configuration:');
  console.log(`  Port:     ${colors.BLUE}${wtConfig.port}${colors.NC}`);
  console.log(`  Base URL: ${colors.BLUE}${wtConfig.baseUrl}${colors.NC}`);
  console.log(`  Protocol: ${colors.BLUE}${wtConfig.protocol}${colors.NC}`);
  console.log('');

  const serverRunning = await isPortInUse(wtConfig.port);

  if (serverRunning) {
    console.log(`${colors.GREEN}✓ Dev server IS RUNNING on port ${wtConfig.port}${colors.NC}`);
    console.log('');
    console.log(`  Access at: ${colors.GREEN}${wtConfig.baseUrl}${colors.NC}`);

    console.log('');
    console.log('Testing connection...');
    const httpCode = await testConnection(wtConfig.baseUrl);

    if (httpCode === 200 || httpCode === 307) {
      console.log(`${colors.GREEN}✓ Server responds successfully (HTTP ${httpCode})${colors.NC}`);
    } else if (httpCode === 0) {
      console.log(`${colors.YELLOW}⚠ Server detected but connection failed${colors.NC}`);
      console.log('  This may be normal if server is still starting up');
    } else {
      console.log(`${colors.YELLOW}⚠ Server responded with HTTP ${httpCode}${colors.NC}`);
    }
  } else {
    console.log(`${colors.RED}✗ Dev server is NOT RUNNING on port ${wtConfig.port}${colors.NC}`);
    console.log('');
    console.log('To start the dev server:');
    console.log(`  ${colors.GREEN}pnpm dev${colors.NC}`);
    console.log('');
    console.log('Note: Each worktree needs its own dev server');
  }

  printFooter();
}

/**
 * Stop the dev server
 */
export async function stopDevServer(config?: WtDevConfig): Promise<boolean> {
  const cfg = config ?? loadConfig();
  const wtConfig = getWorktreeConfigOrExit(cfg);

  printHeader('Stopping Dev Server');

  const portInUse = await isPortInUse(wtConfig.port);

  if (!portInUse) {
    console.log(`${colors.YELLOW}⚠ Dev server is not running on port ${wtConfig.port}${colors.NC}`);
    printFooter();
    return true;
  }

  console.log(`${colors.YELLOW}Stopping processes on port ${wtConfig.port}...${colors.NC}`);
  const success = await killProcessesOnPort(wtConfig.port);

  if (success) {
    console.log(`${colors.GREEN}✓ Dev server stopped${colors.NC}`);
  } else {
    console.log(`${colors.RED}✗ Failed to stop dev server${colors.NC}`);
    console.log(`  Try manually: lsof -ti :${wtConfig.port} | xargs kill -9`);
  }

  printFooter();
  return success;
}

/**
 * Start the dev server
 */
export async function startDevServer(
  config?: WtDevConfig,
  options: { force?: boolean } = {},
): Promise<void> {
  const cfg = config ?? loadConfig();
  const wtConfig = getWorktreeConfigOrExit(cfg);

  printHeader('Next.js Dev Server');
  console.log(`Worktree port: ${colors.BLUE}${wtConfig.port}${colors.NC}`);
  console.log(`Base URL:      ${colors.BLUE}${wtConfig.baseUrl}${colors.NC}`);
  console.log('');

  // Check if port is already in use
  const portInUse = await isPortInUse(wtConfig.port);

  if (portInUse) {
    if (options.force) {
      console.log(
        `${colors.YELLOW}⚠ Dev server is already running on port ${wtConfig.port}${colors.NC}`,
      );
      console.log(`${colors.YELLOW}Force restart requested...${colors.NC}`);
      console.log('');

      const success = await killProcessesOnPort(wtConfig.port);
      if (!success) {
        console.log(`${colors.RED}✗ Failed to stop existing server${colors.NC}`);
        process.exit(1);
      }
      console.log(`${colors.GREEN}✓ Port ${wtConfig.port} is now available${colors.NC}`);
    } else {
      console.log(
        `${colors.YELLOW}⚠ Dev server is already running on port ${wtConfig.port}${colors.NC}`,
      );
      console.log('');
      console.log('Options:');
      console.log(`  1. Access existing server: ${colors.GREEN}${wtConfig.baseUrl}${colors.NC}`);
      console.log(`  2. Check status:            ${colors.GREEN}pnpm dev --status${colors.NC}`);
      console.log(`  3. Force restart:           ${colors.GREEN}pnpm dev --force${colors.NC}`);
      console.log(`  4. Stop server:             ${colors.GREEN}pnpm dev --stop${colors.NC}`);
      console.log('');
      console.log(`${colors.BLUE}Note: Only one dev server should run per worktree${colors.NC}`);
      printFooter();
      process.exit(0);
    }
  }

  // Ensure Inngest is running first
  console.log('');
  console.log('Ensuring Inngest server is running...');
  await ensureInngestServer(cfg);

  console.log('');
  console.log(`${colors.GREEN}Starting Next.js dev server on port ${wtConfig.port}...${colors.NC}`);
  console.log('');

  // Start Next.js with turbopack
  const nextArgs = ['exec', 'next', 'dev', '--turbopack', '-p', wtConfig.port.toString()];

  const devProcess = spawn('pnpm', nextArgs, {
    stdio: 'inherit',
    env: { ...process.env, DEV_PORT: wtConfig.port.toString() },
    cwd: cfg.projectRoot,
  } as SpawnOptions);

  // Handle process exit
  devProcess.on('exit', (exitCode) => {
    if (exitCode !== 0 && exitCode !== null) {
      console.error(`${colors.RED}✗ Dev server exited with code ${exitCode}${colors.NC}`);
      process.exit(exitCode);
    }
  });

  // Handle termination signals
  const handleShutdown = (signal: NodeJS.Signals) => {
    console.log('');
    console.log(`${colors.YELLOW}Received ${signal}, stopping dev server...${colors.NC}`);
    devProcess.kill(signal);
    setTimeout(() => process.exit(0), 1000);
  };

  process.on('SIGINT', () => handleShutdown('SIGINT'));
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
}

/**
 * Tail the dev server logs
 */
export function showDevServerLogs(config?: WtDevConfig): void {
  const cfg = config ?? loadConfig();
  const logFile = getDevServerLogPath(cfg.projectRoot);

  if (!fs.existsSync(logFile)) {
    console.log('No log file found');
    console.log('Start the server with: pnpm dev');
    return;
  }

  console.log(`Showing last 50 lines of ${logFile}`);
  console.log('(Press Ctrl+C to exit)');
  console.log('─'.repeat(80));

  const tail = spawn('tail', ['-f', '-n', '50', logFile], {
    stdio: 'inherit',
  });

  process.on('SIGINT', () => {
    tail.kill();
    console.log('\n');
    process.exit(0);
  });
}
