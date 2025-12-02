/**
 * Process management utilities
 *
 * Uses SIGKILL directly since Next.js/Turbopack doesn't respond reliably to SIGTERM.
 * Implements race condition detection during kill operations.
 */

import { execFileSync } from "child_process";
import { findProcessesOnPort, isPortInUse } from "./port-detection.js";

// Timeout constants (in milliseconds)
const SIGKILL_WAIT_MS = 2000;
const PORT_RELEASE_WAIT_MS = 1000;
const MAX_PORT_CHECK_RETRIES = 10;

/**
 * Check if a process is running by PID
 */
export function isProcessRunning(pid: number): boolean {
  try {
    // Send signal 0 to check if process exists without killing it
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wait for port to become available with retries
 * Implements race condition detection - fails if port is re-bound by a different process
 *
 * @param port - Port to wait for
 * @param targetPids - Set of PIDs we're waiting to die
 * @param maxRetries - Maximum retry attempts
 * @returns True if port is free, false if timeout
 * @throws Error if port is re-bound by different process during cleanup
 */
export async function waitForPortRelease(
  port: number,
  targetPids: Set<number>,
  maxRetries = MAX_PORT_CHECK_RETRIES
): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    const stillInUse = await isPortInUse(port);
    if (!stillInUse) {
      return true;
    }

    // Race condition detection: check if port is now held by a DIFFERENT process
    if (targetPids.size > 0) {
      const currentPids = findProcessesOnPort(port);
      const targetStillPresent = currentPids.some((pid) => targetPids.has(pid));

      if (!targetStillPresent && currentPids.length > 0) {
        // Target processes died but port re-bound by another process
        throw new Error(
          `Port ${port} re-bound by different process (PID ${currentPids[0]}) during cleanup`
        );
      }
    }

    // Wait before retrying
    await sleep(PORT_RELEASE_WAIT_MS);
  }
  return false;
}

/**
 * Kill processes using the specified port
 * Uses SIGKILL directly since Next.js/Turbopack doesn't respond to SIGTERM
 * Only kills specific PIDs using the port (not process groups)
 */
export async function killProcessesOnPort(port: number): Promise<boolean> {
  const MAX_KILL_ATTEMPTS = 5;
  let attempt = 0;

  // Track original target PIDs for race condition detection
  const initialPids = findProcessesOnPort(port);
  const targetPids = new Set(initialPids);

  while (attempt < MAX_KILL_ATTEMPTS) {
    attempt++;
    const pids = findProcessesOnPort(port);

    if (pids.length === 0) {
      // No processes found, but double-check port is actually free
      const portFree = !(await isPortInUse(port));
      if (portFree) {
        return true;
      }
      // Port still in use but no PIDs found - wait for kernel cleanup
      await sleep(PORT_RELEASE_WAIT_MS);
      continue;
    }

    // SIGKILL only the specific PIDs using this port
    for (const pid of pids) {
      try {
        process.kill(pid, "SIGKILL");
        targetPids.add(pid); // Track any new PIDs we're killing
      } catch (error: unknown) {
        const err = error as NodeJS.ErrnoException;
        if (err.code !== "ESRCH") {
          // ESRCH = process doesn't exist, which is fine
          throw error;
        }
      }
    }

    // Wait for kernel to release the socket
    await sleep(SIGKILL_WAIT_MS);

    // Check if port is now free (with race detection)
    try {
      if (await waitForPortRelease(port, targetPids, 3)) {
        return true;
      }
    } catch {
      // Race condition: port re-bound by different process
      return false;
    }
  }

  // Final fallback: use lsof directly without shell
  try {
    // Get PIDs using lsof with execFileSync (no shell injection risk)
    const lsofOutput = execFileSync("lsof", ["-ti", `:${port}`], {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    });
    const fallbackPids = lsofOutput
      .trim()
      .split("\n")
      .map((line) => parseInt(line.trim(), 10))
      .filter((pid) => !isNaN(pid) && pid > 0);

    // Kill each PID individually
    for (const pid of fallbackPids) {
      try {
        process.kill(pid, "SIGKILL");
        targetPids.add(pid);
      } catch {
        // Process may have already exited
      }
    }

    await sleep(SIGKILL_WAIT_MS);
    if (await waitForPortRelease(port, targetPids, MAX_PORT_CHECK_RETRIES)) {
      return true;
    }
  } catch {
    // Ignore errors from the fallback (lsof may not find anything)
  }

  return false;
}
