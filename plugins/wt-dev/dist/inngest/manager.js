/**
 * Inngest server manager - ensure/start/stop/status/logs
 *
 * Manages a system-wide Inngest dev server shared across all worktrees.
 * Uses lock-based coordination to prevent race conditions.
 */
import { spawn, execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { loadConfig, getInngestLogPath } from '../config.js';
import { isPortInUse, findProcessesOnPort } from '../shared/port-detection.js';
import { readPidFile, writePidFile, deletePidFile, acquireLock, releaseLock, } from '../shared/file-utils.js';
import { isProcessRunning } from '../shared/process-utils.js';
// File paths for PID and lock files
const PID_FILE = path.join(os.tmpdir(), 'wt-dev-inngest.pid');
const LOCK_FILE = path.join(os.tmpdir(), 'wt-dev-inngest.lock');
// Health check configuration
const HEALTH_CHECK_MAX_ATTEMPTS = 20; // 10 seconds max wait
const HEALTH_CHECK_INTERVAL_MS = 500;
// ANSI color codes
const colors = {
    BLUE: '\x1b[0;34m',
    GREEN: '\x1b[0;32m',
    YELLOW: '\x1b[1;33m',
    RED: '\x1b[0;31m',
    NC: '\x1b[0m',
};
/**
 * Sleep utility
 */
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
/**
 * Check if Inngest server is healthy (running and responsive)
 */
async function isServerHealthy(inngestPort) {
    try {
        const response = await fetch(`http://localhost:${inngestPort}/`, {
            signal: AbortSignal.timeout(1000),
        });
        // Any response means server is running
        return response.status < 500;
    }
    catch {
        return false;
    }
}
/**
 * Wait for the server to become healthy
 */
async function waitForServerHealth(inngestPort) {
    for (let i = 0; i < HEALTH_CHECK_MAX_ATTEMPTS; i++) {
        if (await isServerHealthy(inngestPort)) {
            return true;
        }
        await sleep(HEALTH_CHECK_INTERVAL_MS);
    }
    return false;
}
/**
 * Find inngest-cli executable
 */
function findInngestCli() {
    const isWindows = process.platform === 'win32';
    // Try pnpx first (most reliable in pnpm workspaces)
    try {
        execSync(isWindows ? 'where pnpx' : 'which pnpx', { stdio: 'ignore' });
        return { command: 'pnpx', args: ['inngest-cli'] };
    }
    catch {
        // Fallback to inngest-cli in PATH
        try {
            execSync(isWindows ? 'where inngest-cli' : 'which inngest-cli', {
                stdio: 'ignore',
            });
            return { command: 'inngest-cli', args: [] };
        }
        catch {
            throw new Error('Could not find inngest-cli. Please ensure it is installed: pnpm add -D inngest-cli');
        }
    }
}
export function getInngestStatus(config) {
    const cfg = config ?? loadConfig();
    const inngestPort = cfg.devServer.inngestPort;
    const logFile = getInngestLogPath(cfg.projectRoot);
    const pid = readPidFile(PID_FILE);
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
            port: inngestPort,
            message: `Inngest dev server is running (PID: ${pid})`,
            logFile,
        };
    }
    return {
        running: false,
        message: 'Inngest dev server is not running (stale PID file found)',
    };
}
/**
 * Show Inngest server status
 */
export function showInngestStatus(config) {
    const status = getInngestStatus(config);
    console.log(status.message);
    if (status.running) {
        console.log(`  Port: ${status.port}`);
        console.log(`  UI: http://localhost:${status.port}`);
        console.log(`  Log file: ${status.logFile}`);
        console.log(`  View logs: pnpm inngest --logs`);
    }
}
/**
 * Start the Inngest server
 */
function startInngestServerProcess(config) {
    const inngestPort = config.devServer.inngestPort;
    const ports = config.devServer.ports;
    const logFile = getInngestLogPath(config.projectRoot);
    console.log('Starting system-wide Inngest dev server...');
    console.log(`  Port: ${inngestPort}`);
    console.log(`  UI: http://localhost:${inngestPort}`);
    console.log(`  Watching: ${ports.join(', ')}`);
    console.log(`  Log file: ${logFile}`);
    // Find inngest-cli executable
    const { command, args } = findInngestCli();
    // Build the discovery URLs for all worktree ports
    const discoveryUrls = ports.map((port) => `http://localhost:${port}/api/inngest`);
    // Build inngest-cli arguments
    const inngestArgs = [
        ...args,
        'dev',
        '--port',
        inngestPort.toString(),
        ...discoveryUrls.flatMap((url) => ['--sdk-url', url]),
    ];
    // Open log file for append
    const logFd = fs.openSync(logFile, 'a');
    let inngest;
    try {
        inngest = spawn(command, inngestArgs, {
            detached: true,
            stdio: ['ignore', logFd, logFd],
            cwd: config.projectRoot,
        });
    }
    catch (error) {
        // Close file descriptor on spawn failure
        fs.closeSync(logFd);
        throw error;
    }
    // Handle spawn errors before unref (otherwise errors are swallowed)
    inngest.on('error', (error) => {
        console.error(`${colors.RED}✗ Failed to start Inngest: ${error.message}${colors.NC}`);
        deletePidFile(PID_FILE);
    });
    // Close the file descriptor after spawn (child inherits it)
    fs.closeSync(logFd);
    // Write PID file
    const pid = inngest.pid;
    writePidFile(PID_FILE, pid);
    // Detach the process so it continues running
    inngest.unref();
    console.log(`${colors.GREEN}✓ Inngest dev server started (PID: ${pid})${colors.NC}`);
    console.log(`  View logs: pnpm inngest --logs`);
    return pid;
}
/**
 * Ensure Inngest server is running (idempotent)
 */
export async function ensureInngestServer(config) {
    const cfg = config ?? loadConfig();
    const inngestPort = cfg.devServer.inngestPort;
    // Check if there's a PID file
    const existingPid = readPidFile(PID_FILE);
    if (existingPid) {
        // Check if the process is actually running
        if (isProcessRunning(existingPid)) {
            console.log(`${colors.GREEN}✓ Inngest dev server already running (PID: ${existingPid})${colors.NC}`);
            console.log(`  UI: http://localhost:${inngestPort}`);
            return;
        }
        else {
            // Stale PID file, clean it up
            console.log('Cleaning up stale Inngest PID file...');
            deletePidFile(PID_FILE);
        }
    }
    // Double-check by testing the port
    if (await isPortInUse(inngestPort)) {
        console.log(`${colors.GREEN}✓ Inngest dev server already running on port ${inngestPort}${colors.NC}`);
        console.log(`  UI: http://localhost:${inngestPort}`);
        return;
    }
    // Try to acquire lock to prevent race conditions
    if (!acquireLock(LOCK_FILE)) {
        // Another process is starting the server, wait a bit and check again
        await sleep(2000);
        if (await isServerHealthy(inngestPort)) {
            console.log(`${colors.GREEN}✓ Inngest dev server started by another process${colors.NC}`);
            console.log(`  UI: http://localhost:${inngestPort}`);
            return;
        }
        // If still no server after waiting, try to acquire lock again
        if (!acquireLock(LOCK_FILE)) {
            console.log('Another process is starting the Inngest server...');
            return;
        }
    }
    try {
        // Start new server
        startInngestServerProcess(cfg);
        // Wait for server to be healthy
        const isHealthy = await waitForServerHealth(inngestPort);
        if (!isHealthy) {
            console.log(`${colors.YELLOW}⚠ Server started but health check timed out${colors.NC}`);
            console.log('  The server may still be initializing.');
        }
    }
    finally {
        // Always release lock
        releaseLock(LOCK_FILE);
    }
}
/**
 * Start Inngest server (check if already running first)
 */
export async function startInngestServer(config) {
    const cfg = config ?? loadConfig();
    const inngestPort = cfg.devServer.inngestPort;
    const existingPid = readPidFile(PID_FILE);
    if (existingPid && isProcessRunning(existingPid)) {
        console.log(`${colors.GREEN}✓ Inngest dev server already running (PID: ${existingPid})${colors.NC}`);
        console.log(`  UI: http://localhost:${inngestPort}`);
        console.log(`  To restart: pnpm inngest --restart`);
        console.log(`  To stop:    pnpm inngest --stop`);
        return;
    }
    // Also check if port is in use (in case PID file is stale)
    if (await isPortInUse(inngestPort)) {
        console.log(`${colors.GREEN}✓ Inngest dev server already running on port ${inngestPort}${colors.NC}`);
        console.log(`  UI: http://localhost:${inngestPort}`);
        console.log(`  To restart: pnpm inngest --restart`);
        console.log(`  To stop:    pnpm inngest --stop`);
        return;
    }
    // Start the server
    await ensureInngestServer(cfg);
}
/**
 * Stop the Inngest server
 */
export async function stopInngestServer(config) {
    const cfg = config ?? loadConfig();
    const inngestPort = cfg.devServer.inngestPort;
    console.log('Stopping Inngest dev server...');
    let stoppedAny = false;
    // Step 1: Stop process from PID file if it exists
    const pidFromFile = readPidFile(PID_FILE);
    if (pidFromFile && isProcessRunning(pidFromFile)) {
        console.log(`  Killing process ${pidFromFile}...`);
        try {
            process.kill(pidFromFile, 'SIGKILL');
            stoppedAny = true;
        }
        catch (error) {
            const err = error;
            if (err.code !== 'ESRCH') {
                console.warn(`  Warning: Failed to kill PID ${pidFromFile}: ${err.message}`);
            }
        }
    }
    // Step 2: Find and stop any orphaned processes using the Inngest port
    const orphanedPids = findProcessesOnPort(inngestPort);
    for (const pid of orphanedPids) {
        if (pid === pidFromFile)
            continue; // Already handled
        console.log(`  Found orphaned process using port ${inngestPort}`);
        try {
            process.kill(pid, 'SIGKILL');
            stoppedAny = true;
        }
        catch (error) {
            const err = error;
            if (err.code !== 'ESRCH') {
                console.warn(`  Warning: Failed to kill orphaned PID ${pid}: ${err.message}`);
            }
        }
    }
    // Step 3: Clean up PID file
    deletePidFile(PID_FILE);
    // Step 4: Verify port is now free
    await sleep(500); // Give OS time to release port
    if (await isPortInUse(inngestPort)) {
        console.warn(`${colors.YELLOW}Warning: Port ${inngestPort} may still be in use. Check manually.${colors.NC}`);
    }
    else {
        if (stoppedAny) {
            console.log(`${colors.GREEN}✓ Inngest dev server stopped${colors.NC}`);
        }
        else {
            console.log('Inngest dev server is not running');
        }
    }
}
/**
 * Restart the Inngest server
 */
export async function restartInngestServer(config) {
    console.log('Restarting Inngest dev server...');
    await stopInngestServer(config);
    await sleep(1000); // Give it a moment to fully stop
    await startInngestServer(config);
}
/**
 * Tail the Inngest server logs
 */
export function showInngestLogs(config) {
    const cfg = config ?? loadConfig();
    const logFile = getInngestLogPath(cfg.projectRoot);
    if (!fs.existsSync(logFile)) {
        console.log('No log file found');
        console.log('Start the server with: pnpm inngest');
        return;
    }
    console.log(`Showing last 50 lines of ${logFile}`);
    console.log('(Press Ctrl+C to exit)');
    console.log('─'.repeat(80));
    const isWindows = process.platform === 'win32';
    if (isWindows) {
        // Windows: Use PowerShell Get-Content
        const ps = spawn('powershell', ['-Command', `Get-Content -Path "${logFile}" -Tail 50 -Wait`], { stdio: 'inherit' });
        process.on('SIGINT', () => {
            ps.kill();
            console.log('\n');
            process.exit(0);
        });
    }
    else {
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
}
//# sourceMappingURL=manager.js.map