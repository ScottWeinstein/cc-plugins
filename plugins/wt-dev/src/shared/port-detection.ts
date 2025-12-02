#!/usr/bin/env node

/**
 * Multi-method port detection utilities
 *
 * SECURITY NOTE: Uses execFileSync with argument arrays to prevent shell injection.
 * Port numbers are validated before use.
 */

import net from 'net';
import { execFileSync, execSync } from 'child_process';

const IS_WINDOWS = process.platform === 'win32';

/**
 * Check if a port is available (not in use) using Node.js net module
 */
export function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', () => {
      resolve(false);
    });

    server.once('listening', () => {
      server.close();
    });

    server.once('close', () => {
      resolve(true);
    });

    server.listen(port);
  });
}

/**
 * Check if a port is in use using system commands for reliable detection
 * Uses multiple methods with fallbacks
 */
export async function isPortInUse(port: number): Promise<boolean> {
  // Validate port is a safe integer
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Invalid port number');
  }

  // Method 1: Try ss (most reliable for TCP listeners on Linux)
  if (!IS_WINDOWS) {
    try {
      const ssOutput = execFileSync('ss', ['-tlnp'], {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'],
      });
      // Parse output in JS instead of piping to grep (defense in depth)
      const portPattern = new RegExp(`:${port}\\s`);
      if (portPattern.test(ssOutput)) {
        return true;
      }
    } catch {
      // ss not available or port not found, try next method
    }
  }

  // Method 2: Try lsof (Unix/macOS)
  if (!IS_WINDOWS) {
    try {
      const lsofOutput = execFileSync('lsof', ['-i', '-P', '-n'], {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'],
      });
      // Parse output in JS: look for LISTEN state with matching port
      const portPattern = new RegExp(`:${port}\\b.*LISTEN`);
      if (portPattern.test(lsofOutput)) {
        return true;
      }
    } catch {
      // lsof not available or port not found, try next method
    }
  }

  // Method 3: Try netstat (cross-platform)
  try {
    let netstatOutput: string;
    if (IS_WINDOWS) {
      netstatOutput = execFileSync('netstat', ['-ano'], {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'],
      });
    } else {
      netstatOutput = execFileSync('netstat', ['-tlnp'], {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'],
      });
    }
    // Parse output in JS
    const portPattern = new RegExp(`:${port}\\s`);
    if (portPattern.test(netstatOutput)) {
      return true;
    }
  } catch {
    // netstat not available or port not found
  }

  // Fallback: Use Node.js net module (may give false negatives)
  return !(await isPortAvailable(port));
}

/**
 * Find PIDs of SERVER processes LISTENING on a specific port
 *
 * IMPORTANT: Only returns processes in LISTEN state (servers accepting connections).
 * Does NOT return client processes with active connections to the port.
 *
 * This prevents killing unrelated processes that happen to connect to the port
 * (e.g., shared Inngest server that connects to multiple worktree dev servers).
 */
export function findProcessesOnPort(port: number): number[] {
  // Validate port is a safe integer
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Invalid port number');
  }

  try {
    if (IS_WINDOWS) {
      // Windows: use netstat, parse output to validate LISTENING state
      const output = execSync(`netstat -ano`, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'],
      });
      const pids = output
        .split('\n')
        .filter((line) => {
          const parts = line.trim().split(/\s+/);
          // Validate: has LISTENING state AND port matches exactly
          return (
            parts.length >= 5 &&
            parts[3] === 'LISTENING' &&
            (parts[1].endsWith(`:${port}`) || parts[1] === `0.0.0.0:${port}`)
          );
        })
        .map((line) => parseInt(line.trim().split(/\s+/).pop()!, 10))
        .filter((pid) => !isNaN(pid) && pid > 0);
      return pids;
    }

    // Unix: prefer ss for accurate LISTEN-only filtering
    try {
      const ssOutput = execFileSync('ss', ['-tlnp'], {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'],
      });
      // Filter lines matching port in JS, then extract PIDs
      const portPattern = new RegExp(`:${port}\\s`);
      const matchingLines = ssOutput.split('\n').filter((line) => portPattern.test(line));

      // Parse ss output to extract PIDs (format: users:(("name",pid=123,fd=4)))
      const pids: number[] = [];
      for (const line of matchingLines) {
        const pidMatches = line.match(/pid=(\d+)/g);
        if (pidMatches) {
          for (const m of pidMatches) {
            const pid = parseInt(m.split('=')[1], 10);
            if (!isNaN(pid)) {
              pids.push(pid);
            }
          }
        }
      }
      if (pids.length > 0) {
        return pids;
      }
      // Fall through to lsof if ss didn't find PIDs
    } catch {
      // ss not available, try lsof
    }

    // Try lsof with LISTEN filter
    try {
      // lsof -i :port -sTCP:LISTEN only shows listening sockets
      const lsofOutput = execFileSync('lsof', ['-ti', `:${port}`, '-sTCP:LISTEN'], {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'],
      });
      return lsofOutput
        .trim()
        .split('\n')
        .map((line) => parseInt(line.trim(), 10))
        .filter((pid) => !isNaN(pid));
    } catch {
      return [];
    }
  } catch {
    return [];
  }
}
