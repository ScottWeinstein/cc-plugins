/**
 * Process management utilities
 *
 * Uses SIGKILL directly since Next.js/Turbopack doesn't respond reliably to SIGTERM.
 * Implements race condition detection during kill operations.
 */
/**
 * Check if a process is running by PID
 */
export declare function isProcessRunning(pid: number): boolean;
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
export declare function waitForPortRelease(port: number, targetPids: Set<number>, maxRetries?: number): Promise<boolean>;
/**
 * Kill processes using the specified port
 * Uses SIGKILL directly since Next.js/Turbopack doesn't respond to SIGTERM
 * Only kills specific PIDs using the port (not process groups)
 */
export declare function killProcessesOnPort(port: number): Promise<boolean>;
//# sourceMappingURL=process-utils.d.ts.map