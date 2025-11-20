#!/usr/bin/env node

/**
 * Unified worktree management utility
 * Handles port configuration and Inngest dev server lifecycle
 *
 * Commands:
 *   Config operations:
 *     --available    Get first available port from predefined set
 *     --from-file    Get cached port from file
 *     --config       Get complete configuration as JSON
 *
 *   Inngest operations (legacy positional args - deprecated):
 *     inngest ensure   Ensure Inngest server is running (idempotent)
 *     inngest start    Start Inngest server
 *     inngest stop     Stop Inngest server
 *     inngest restart  Restart Inngest server
 *     inngest status   Show server status
 *     inngest logs     Tail server logs
 *
 *   Inngest operations (new flag-based - preferred):
 *     --inngest           Start Inngest server (default action)
 *     --inngest --stop    Stop Inngest server
 *     --inngest --restart Restart Inngest server
 *     --inngest --status  Show server status
 *     --inngest --logs    Tail server logs
 *     --inngest --ensure  Ensure server is running (idempotent)
 */

import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { spawn, execSync } from 'child_process';
import { promisify } from 'util';
import {
  isPortAvailable,
  findProcessesUsingPort as findProcessesUsingPortShared,
} from './port-detection.mjs';

// ============================================================================
// CONSTANTS - Single source of truth
// ============================================================================

const PREDEFINED_PORTS = [5001, 5002, 5003, 5004, 5005];
const SYSTEM_INNGEST_PORT = 8288; // Fixed port for system-wide Inngest server (Inngest default, not on Node.js bad ports list)
const PID_FILE = path.join(os.tmpdir(), 'flowt-inngest.pid');

// Platform-specific utilities
const IS_WINDOWS = process.platform === 'win32';
const delay = promisify(setTimeout);

// ============================================================================
// PROJECT ROOT DETECTION
// ============================================================================

/**
 * Find the project root directory by looking for package.json with "flowt-cx" name
 * Includes safeguards against infinite loops and invalid directories
 */
function findProjectRoot() {
  const MAX_DEPTH = 10;
  let currentDir = process.cwd();
  let depth = 0;
  const visited = new Set();

  while (currentDir !== path.dirname(currentDir) && depth < MAX_DEPTH) {
    // Prevent infinite loops with symbolic links
    let realPath;
    try {
      realPath = fs.realpathSync(currentDir);
    } catch (error) {
      // Skip directories we can't resolve (permissions, etc.)
      currentDir = path.dirname(currentDir);
      depth++;
      continue;
    }

    if (visited.has(realPath)) {
      break; // Circular reference detected
    }
    visited.add(realPath);

    const packagePath = path.join(currentDir, 'package.json');
    if (fs.existsSync(packagePath)) {
      try {
        const pkgContent = fs.readFileSync(packagePath, 'utf8');
        const pkg = JSON.parse(pkgContent);
        if (pkg.name === 'flowt-cx') {
          // Validate this is actually a flowt-cx project
          const scriptsPath = path.join(currentDir, 'scripts');
          if (fs.existsSync(scriptsPath)) {
            return currentDir;
          }
        }
      } catch (error) {
        // Skip invalid package.json files
        console.warn(`Warning: Invalid package.json at ${packagePath}:`, error.message);
      }
    }

    currentDir = path.dirname(currentDir);
    depth++;
  }

  throw new Error(
    `Could not find flowt-cx project root. Searched ${depth} directories from ${process.cwd()}. ` +
      'Make sure you are running this command from within a flowt-cx git worktree.',
  );
}

function getLogFilePath() {
  try {
    return path.join(findProjectRoot(), 'inngest-system.log');
  } catch {
    // Fallback if we can't find project root
    return path.join(process.cwd(), 'inngest-system.log');
  }
}

// ============================================================================
// PORT MANAGEMENT
// ============================================================================

/**
 * Get a unique development port from predefined set based on the project root directory
 */
function getHashBasedPort() {
  // If PORT is explicitly set, use it
  if (process.env.PORT) {
    return parseInt(process.env.PORT, 10);
  }

  // Generate a consistent port based on the project root directory
  const projectRoot = findProjectRoot();

  // Create a hash of the project root path for consistency
  const hash = crypto.createHash('md5').update(projectRoot).digest('hex');

  // Use hash to select one of the predefined ports consistently
  const hashNum = parseInt(hash.substring(0, 8), 16);
  const portIndex = hashNum % PREDEFINED_PORTS.length;
  const port = PREDEFINED_PORTS[portIndex];

  return port;
}

/**
 * Find the first available port from the predefined set
 */
async function findAvailablePort() {
  for (const port of PREDEFINED_PORTS) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }

  throw new Error(`No available ports found in predefined set: ${PREDEFINED_PORTS.join(', ')}`);
}

/**
 * Get the path to the port file (always in project root)
 */
function getPortFilePath() {
  return path.join(findProjectRoot(), '.dev-port');
}

/**
 * Read port from file if it exists
 */
function readPortFromFile() {
  try {
    const portFile = getPortFilePath();
    if (fs.existsSync(portFile)) {
      const port = parseInt(fs.readFileSync(portFile, 'utf8').trim(), 10);
      if (!isNaN(port)) {
        return port;
      }
    }
  } catch (error) {
    // Ignore file read errors
  }
  return null;
}

/**
 * Write port to file atomically to prevent race conditions
 */
function writePortToFile(port) {
  try {
    const portFile = getPortFilePath();
    const tempFile = `${portFile}.tmp.${process.pid}`;

    // Write to temp file first
    fs.writeFileSync(tempFile, port.toString(), 'utf8');

    // Atomic rename operation
    fs.renameSync(tempFile, portFile);
  } catch (error) {
    console.warn('Warning: Could not write port to file:', error.message);
    // Clean up temp file if it exists
    try {
      const tempFile = `${getPortFilePath()}.tmp.${process.pid}`;
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    } catch (cleanupError) {
      // Ignore cleanup errors
    }
  }
}

/**
 * Get an available development port with priority:
 * 1. PORT env var (explicit override)
 * 2. Cached port from file (if still available)
 * 3. Hash-based consistent port (if available)
 * 4. First available port from predefined set
 */
async function getAvailableDevPort() {
  // Check if port is explicitly set
  if (process.env.PORT) {
    const explicitPort = parseInt(process.env.PORT, 10);
    writePortToFile(explicitPort);
    return explicitPort;
  }

  // Check if we have a cached port that's still available
  const cachedPort = readPortFromFile();
  if (cachedPort && (await isPortAvailable(cachedPort))) {
    return cachedPort;
  }

  // Get preferred port based on directory hash
  const preferredPort = getHashBasedPort();

  // If the preferred port is available, use it
  if (await isPortAvailable(preferredPort)) {
    writePortToFile(preferredPort);
    return preferredPort;
  }

  // Otherwise find the first available port from predefined set
  const availablePort = await findAvailablePort();
  writePortToFile(availablePort);
  return availablePort;
}

/**
 * Get complete worktree configuration
 */
async function getWorktreeConfig() {
  const devPort =
    process.env.DEV_PORT || process.env.PORT || readPortFromFile() || getHashBasedPort();

  // Default to HTTP for localhost since dev server doesn't have SSL certificates
  // Set USE_HTTPS_LOCALHOST=true only if you have configured SSL certs for local dev
  const useHttps = process.env.USE_HTTPS_LOCALHOST === 'true';
  const protocol = useHttps ? 'https' : 'http';

  return {
    port: devPort,
    protocol,
    baseUrl: `${protocol}://localhost:${devPort}`,
    inngestPort: SYSTEM_INNGEST_PORT,
    inngestUrl: `http://localhost:${SYSTEM_INNGEST_PORT}`,
    useHttp: !useHttps, // Maintain backward compatibility with useHttp property
  };
}

// ============================================================================
// PROCESS MANAGEMENT
// ============================================================================

/**
 * Check if process is running by PID
 */
function isProcessRunning(pid) {
  try {
    // Send signal 0 to check if process exists without killing it
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Read PID from file
 */
function readPidFile() {
  try {
    if (fs.existsSync(PID_FILE)) {
      const pid = parseInt(fs.readFileSync(PID_FILE, 'utf8').trim(), 10);
      if (!isNaN(pid)) {
        return pid;
      }
    }
  } catch (error) {
    // Ignore read errors
  }
  return null;
}

/**
 * Write PID to file
 */
function writePidFile(pid) {
  try {
    fs.writeFileSync(PID_FILE, pid.toString(), 'utf8');
  } catch (error) {
    console.warn('Warning: Could not write Inngest PID file:', error.message);
  }
}

/**
 * Clean up PID file and verify process is stopped
 */
function cleanupPidFile() {
  const pid = readPidFile();

  try {
    if (fs.existsSync(PID_FILE)) {
      fs.unlinkSync(PID_FILE);
    }
  } catch (error) {
    // Ignore cleanup errors
  }

  // Verify process is actually stopped
  if (pid && isProcessRunning(pid)) {
    console.warn(`Warning: Process ${pid} is still running after cleanup`);
    return false;
  }

  return true;
}

// ============================================================================
// INNGEST SERVER MANAGEMENT
// ============================================================================

/**
 * Get Inngest server status
 */
function getInngestStatus() {
  const pid = readPidFile();

  if (!pid) {
    return {
      running: false,
      message: 'Inngest dev server is not running',
    };
  }

  if (isProcessRunning(pid)) {
    return {
      running: true,
      pid,
      message: `Inngest dev server is running (PID: ${pid})`,
      port: SYSTEM_INNGEST_PORT,
      logFile: getLogFilePath(),
    };
  }

  return {
    running: false,
    message: 'Inngest dev server is not running (stale PID file found)',
  };
}

/**
 * Find inngest-cli executable
 */
function findInngestCli() {
  // Try pnpx first (most reliable in pnpm workspaces)
  try {
    execSync(IS_WINDOWS ? 'where pnpx' : 'which pnpx', { stdio: 'ignore' });
    return { command: 'pnpx', args: ['inngest-cli'] };
  } catch {
    // Fallback to inngest-cli in PATH
    try {
      execSync(IS_WINDOWS ? 'where inngest-cli' : 'which inngest-cli', { stdio: 'ignore' });
      return { command: 'inngest-cli', args: [] };
    } catch {
      throw new Error(
        'Could not find inngest-cli. Please ensure it is installed: pnpm add -D inngest-cli',
      );
    }
  }
}

/**
 * Start the Inngest server
 */
function startInngestServer() {
  console.log('Starting system-wide Inngest dev server...');
  console.log(`  Port: ${SYSTEM_INNGEST_PORT}`);
  console.log(`  UI: http://localhost:${SYSTEM_INNGEST_PORT}`);
  console.log(`  Watching: ${PREDEFINED_PORTS.join(', ')}`);

  const logFile = getLogFilePath();
  console.log(`  Log file: ${logFile}`);

  // Find inngest-cli executable
  const { command, args } = findInngestCli();

  // Build the discovery URLs for all worktree ports
  const discoveryUrls = PREDEFINED_PORTS.map((port) => `http://localhost:${port}/api/inngest`);

  // Build inngest-cli arguments
  const inngestArgs = [
    ...args,
    'dev',
    '--port',
    SYSTEM_INNGEST_PORT.toString(),
    ...discoveryUrls.flatMap((url) => ['--sdk-url', url]),
  ];

  try {
    // Open log file synchronously to get file descriptor for spawn
    const logFd = fs.openSync(logFile, 'a');
    const inngest = spawn(command, inngestArgs, {
      detached: true,
      stdio: ['ignore', logFd, logFd],
    });

    // Write PID file
    writePidFile(inngest.pid);

    // Detach the process so it continues running
    inngest.unref();

    console.log(`✓ Inngest dev server started (PID: ${inngest.pid})`);
    console.log(`  View logs: pnpm inngest --logs`);
  } catch (error) {
    throw new Error(`Failed to start Inngest server: ${error.message}`);
  }
}

/**
 * Ensure Inngest server is running (idempotent)
 */
async function ensureInngestServer() {
  // Check if there's a PID file
  const existingPid = readPidFile();

  if (existingPid) {
    // Check if the process is actually running
    if (isProcessRunning(existingPid)) {
      console.log(`✓ Inngest dev server already running (PID: ${existingPid})`);
      console.log(`  UI: http://localhost:${SYSTEM_INNGEST_PORT}`);
      return;
    } else {
      // Stale PID file, clean it up
      console.log('Cleaning up stale Inngest PID file...');
      cleanupPidFile();
    }
  }

  // Double-check by testing the port
  if (!(await isPortAvailable(SYSTEM_INNGEST_PORT))) {
    console.log(`✓ Inngest dev server already running on port ${SYSTEM_INNGEST_PORT}`);
    console.log(`  UI: http://localhost:${SYSTEM_INNGEST_PORT}`);
    return;
  }

  // Start the server
  startInngestServer();
}

/**
 * Find PIDs using the Inngest port
 * Returns array of PIDs found listening on SYSTEM_INNGEST_PORT
 */
function findProcessesUsingInngestPort() {
  return findProcessesUsingPortShared(SYSTEM_INNGEST_PORT);
}

/**
 * Kill a process and wait for it to stop
 */
async function killProcess(pid, processName = 'process') {
  if (!isProcessRunning(pid)) {
    return true;
  }

  try {
    console.log(`  Stopping ${processName} (PID: ${pid})...`);

    // Try graceful shutdown first
    process.kill(pid, 'SIGTERM');

    // Wait up to 5 seconds for graceful shutdown with exponential backoff
    let attempts = 0;
    let backoff = 100; // Start with 100ms
    const maxAttempts = 20;

    while (isProcessRunning(pid) && attempts < maxAttempts) {
      await delay(backoff);
      attempts++;
      backoff = Math.min(backoff * 1.5, 1000); // Cap at 1 second
    }

    // If still running, force kill
    if (isProcessRunning(pid)) {
      console.log(`  Graceful shutdown timeout, forcing kill...`);
      process.kill(pid, 'SIGKILL');
      await delay(500); // Give it time to die
    }

    return !isProcessRunning(pid);
  } catch (error) {
    if (error.code === 'ESRCH') {
      // Process doesn't exist
      return true;
    }
    console.warn(`  Warning: Failed to kill PID ${pid}: ${error.message}`);
    return false;
  }
}

/**
 * Stop the Inngest server (enhanced with orphan detection)
 */
async function stopInngestServer() {
  console.log('Stopping Inngest dev server...');

  let stoppedAny = false;

  // Step 1: Stop process from PID file if it exists
  const pidFromFile = readPidFile();
  if (pidFromFile && isProcessRunning(pidFromFile)) {
    await killProcess(pidFromFile, 'tracked Inngest server');
    stoppedAny = true;
  }

  // Step 2: Find and stop any orphaned processes using the Inngest port
  const orphanedPids = findProcessesUsingInngestPort();
  for (const pid of orphanedPids) {
    if (pid === pidFromFile) continue; // Already handled
    console.log(`  Found orphaned process using port ${SYSTEM_INNGEST_PORT}`);
    await killProcess(pid, 'orphaned Inngest server');
    stoppedAny = true;
  }

  // Step 3: Clean up PID file
  cleanupPidFile();

  // Step 4: Verify port is now free
  await delay(500); // Give OS time to release port
  if (await isPortAvailable(SYSTEM_INNGEST_PORT)) {
    if (stoppedAny) {
      console.log('✓ Inngest dev server stopped');
    } else {
      console.log('Inngest dev server is not running');
    }
  } else {
    console.warn(`Warning: Port ${SYSTEM_INNGEST_PORT} may still be in use. Check manually.`);
  }
}

/**
 * Show Inngest server status
 */
function showInngestStatus() {
  const status = getInngestStatus();
  console.log(status.message);

  if (status.running) {
    console.log(`  Port: ${status.port}`);
    console.log(`  UI: http://localhost:${status.port}`);
    console.log(`  Log file: ${status.logFile}`);
    console.log(`  View logs: pnpm inngest --logs`);
  }
}

/**
 * Show Inngest server logs
 */
function showInngestLogs() {
  const logFile = getLogFilePath();

  if (!fs.existsSync(logFile)) {
    console.log('No log file found');
    console.log('Start the server with: pnpm inngest');
    return;
  }

  console.log(`Showing last 50 lines of ${logFile}`);
  console.log('(Press Ctrl+C to exit)');
  console.log('─'.repeat(80));

  try {
    // Platform-specific tail command
    if (IS_WINDOWS) {
      // Windows: Use PowerShell Get-Content
      const ps = spawn(
        'powershell',
        ['-Command', `Get-Content -Path "${logFile}" -Tail 50 -Wait`],
        {
          stdio: 'inherit',
        },
      );

      process.on('SIGINT', () => {
        ps.kill();
        console.log('\n');
        process.exit(0);
      });
    } else {
      // Unix: Use tail -f
      const tail = spawn('tail', ['-f', '-n', '50', logFile], {
        stdio: 'inherit',
      });

      process.on('SIGINT', () => {
        tail.kill();
        console.log('\n');
        process.exit(0);
      });
    }
  } catch (error) {
    throw new Error(`Error showing logs: ${error.message}`);
  }
}

/**
 * Restart the Inngest server
 */
async function restartInngestServer() {
  console.log('Restarting Inngest dev server...');
  await stopInngestServer();
  // Give it a moment to fully stop
  await delay(1000);
  startInngestServer();
}

// ============================================================================
// CLI INTERFACE
// ============================================================================

function showHelp() {
  console.log(`
Flowt Worktree Manager

Config Commands:
  --available    Get first available port from predefined set
  --from-file    Get cached port from file
  --config       Get complete configuration as JSON

Inngest Commands (flag-based):
  --inngest             Start Inngest server (default)
  --inngest --stop      Stop Inngest server
  --inngest --restart   Restart Inngest server
  --inngest --status    Show server status
  --inngest --logs      Tail server logs
  --inngest --ensure    Ensure server is running (idempotent)

Package.json shortcuts:
  pnpm inngest             - Start the server (default)
  pnpm inngest --stop      - Stop the server
  pnpm inngest --restart   - Restart the server
  pnpm inngest --status    - Show status
  pnpm inngest --logs      - View logs
`);
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const subcommand = args[1];

  try {
    // Config commands
    if (command === '--available') {
      const port = await getAvailableDevPort();
      console.log(port);
      return;
    }

    if (command === '--from-file') {
      const cachedPort = readPortFromFile();
      if (cachedPort) {
        console.log(cachedPort);
      } else {
        // Fallback to hash-based port if no file exists
        console.log(getHashBasedPort());
      }
      return;
    }

    if (command === '--config') {
      const config = await getWorktreeConfig();
      console.log(JSON.stringify(config, null, 2));
      return;
    }

    // New flag-based Inngest commands
    if (command === '--inngest') {
      // Check for conflicting flags
      const hasStop = args.includes('--stop');
      const hasRestart = args.includes('--restart');
      const hasStatus = args.includes('--status');
      const hasLogs = args.includes('--logs');
      const hasEnsure = args.includes('--ensure');

      const flagCount = [hasStop, hasRestart, hasStatus, hasLogs, hasEnsure].filter(Boolean).length;
      if (flagCount > 1) {
        console.error('Error: Cannot use multiple inngest action flags together');
        console.error('  Use only one of: --stop, --restart, --status, --logs, --ensure');
        process.exit(1);
      }

      if (hasStop) {
        await stopInngestServer();
      } else if (hasRestart) {
        await restartInngestServer();
      } else if (hasStatus) {
        showInngestStatus();
      } else if (hasLogs) {
        showInngestLogs();
      } else if (hasEnsure) {
        await ensureInngestServer();
      } else {
        // Default action: start (check if already running first)
        const existingPid = readPidFile();
        if (existingPid && isProcessRunning(existingPid)) {
          console.log(`✓ Inngest dev server already running (PID: ${existingPid})`);
          console.log(`  UI: http://localhost:${SYSTEM_INNGEST_PORT}`);
          console.log(`  To restart: pnpm inngest --restart`);
          console.log(`  To stop:    pnpm inngest --stop`);
          return;
        }

        // Also check if port is in use (in case PID file is stale)
        if (!(await isPortAvailable(SYSTEM_INNGEST_PORT))) {
          console.log(`✓ Inngest dev server already running on port ${SYSTEM_INNGEST_PORT}`);
          console.log(`  UI: http://localhost:${SYSTEM_INNGEST_PORT}`);
          console.log(`  To restart: pnpm inngest --restart`);
          console.log(`  To stop:    pnpm inngest --stop`);
          return;
        }

        startInngestServer();
      }
      return;
    }

    // Legacy positional Inngest commands (for backward compatibility)
    if (command === 'inngest') {
      switch (subcommand) {
        case 'ensure':
          await ensureInngestServer();
          break;
        case 'start':
          startInngestServer();
          break;
        case 'stop':
          await stopInngestServer();
          break;
        case 'restart':
          await restartInngestServer();
          break;
        case 'status':
          showInngestStatus();
          break;
        case 'logs':
          showInngestLogs();
          break;
        default:
          console.error(`Unknown inngest command: ${subcommand}`);
          showHelp();
          process.exit(1);
      }
      return;
    }

    // Default: show preferred port
    if (!command) {
      console.log(getHashBasedPort());
      return;
    }

    // Unknown command
    console.error(`Unknown command: ${command}`);
    showHelp();
    process.exit(1);
  } catch (error) {
    // Log full error with stack trace
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

// Export for testing
export {
  getHashBasedPort,
  isPortAvailable,
  findAvailablePort,
  getAvailableDevPort,
  readPortFromFile,
  writePortToFile,
  getWorktreeConfig,
  PREDEFINED_PORTS,
  SYSTEM_INNGEST_PORT,
};
