#!/usr/bin/env node

/**
 * Shared port detection utilities for worktree management
 * Provides robust cross-platform port detection using multiple methods
 *
 * SECURITY NOTE: This file uses execSync with hardcoded port numbers only.
 * No user input is passed to shell commands - all port values come from
 * internal constants or validated numeric inputs.
 */

import net from 'net';
import { execSync } from 'child_process';

const IS_WINDOWS = process.platform === 'win32';

/**
 * Check if a port is available (not in use)
 * @param {number} port - Port number to check
 * @returns {Promise<boolean>} - True if port is available, false if in use
 */
export function isPortAvailable(port) {
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
 * Check if a port is in use (inverse of isPortAvailable)
 * Uses system commands for more reliable detection
 * @param {number} port - Port number to check (validated as integer)
 * @returns {Promise<boolean>} - True if port is in use, false if available
 */
export async function isPortInUse(port) {
  // Validate port is a safe integer
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Invalid port number');
  }

  // Method 1: Try ss (most reliable for TCP listeners on Linux/Unix)
  if (!IS_WINDOWS) {
    try {
      const output = execSync(`ss -tlnp 2>/dev/null | grep -E ':${port}\\s'`, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'],
      });
      if (output.trim()) {
        return true;
      }
    } catch (error) {
      // ss not available or port not found, try next method
    }
  }

  // Method 2: Try lsof (Unix/macOS)
  if (!IS_WINDOWS) {
    try {
      const output = execSync(`lsof -i -P -n 2>/dev/null | grep LISTEN | grep -E ':${port}\\b'`, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'],
      });
      if (output.trim()) {
        return true;
      }
    } catch (error) {
      // lsof not available or port not found, try next method
    }
  }

  // Method 3: Try netstat (cross-platform)
  try {
    const command = IS_WINDOWS
      ? `netstat -ano | findstr :${port}`
      : `netstat -tlnp 2>/dev/null | grep -E ':${port}\\s'`;

    const output = execSync(command, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    if (output.trim()) {
      return true;
    }
  } catch (error) {
    // netstat not available or port not found
  }

  // Fallback: Use Node.js net module (may give false negatives)
  return !(await isPortAvailable(port));
}

/**
 * Find PIDs of processes using a specific port
 * @param {number} port - Port number to check (validated as integer)
 * @returns {number[]} - Array of PIDs using the port
 */
export function findProcessesUsingPort(port) {
  // Validate port is a safe integer
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Invalid port number');
  }

  try {
    let output;

    if (IS_WINDOWS) {
      // Windows: use netstat
      output = execSync(`netstat -ano | findstr :${port}`, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'],
      });
    } else {
      // Unix: use lsof if available, otherwise ss
      try {
        output = execSync(`lsof -ti :${port}`, {
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'ignore'],
        });
      } catch {
        // lsof not available, try ss with word boundary
        try {
          output = execSync(`ss -tlnp | grep -E ':${port}\\s'`, {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'ignore'],
          });
          // Parse ss output to extract PIDs
          const pidMatches = output.match(/pid=(\d+)/g);
          if (pidMatches) {
            return pidMatches
              .map((m) => parseInt(m.split('=')[1], 10))
              .filter((pid) => !isNaN(pid));
          }
          return [];
        } catch {
          return [];
        }
      }
    }

    // Parse output to get PIDs
    const pids = output
      .trim()
      .split('\n')
      .map((line) => {
        if (IS_WINDOWS) {
          // netstat output: last column is PID
          const parts = line.trim().split(/\s+/);
          return parseInt(parts[parts.length - 1], 10);
        } else {
          // lsof output: just the PID
          return parseInt(line.trim(), 10);
        }
      })
      .filter((pid) => !isNaN(pid));

    return pids;
  } catch {
    return [];
  }
}

// CLI mode: when run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const command = args[0];
  const port = parseInt(args[1], 10);

  if (!command || isNaN(port)) {
    console.error('Usage: port-detection.mjs <check|pids> <port>');
    console.error('  check <port>  - Check if port is in use (exit 0 if in use, 1 if available)');
    console.error('  pids <port>   - List PIDs using the port');
    process.exit(2);
  }

  (async () => {
    try {
      if (command === 'check') {
        const inUse = await isPortInUse(port);
        process.exit(inUse ? 0 : 1);
      } else if (command === 'pids') {
        const pids = findProcessesUsingPort(port);
        if (pids.length > 0) {
          console.log(pids.join('\n'));
          process.exit(0);
        } else {
          process.exit(1);
        }
      } else {
        console.error(`Unknown command: ${command}`);
        process.exit(2);
      }
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(2);
    }
  })();
}
