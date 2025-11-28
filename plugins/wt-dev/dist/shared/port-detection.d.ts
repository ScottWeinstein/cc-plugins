#!/usr/bin/env node
/**
 * Multi-method port detection utilities
 *
 * SECURITY NOTE: Uses execFileSync with argument arrays to prevent shell injection.
 * Port numbers are validated before use.
 */
/**
 * Check if a port is available (not in use) using Node.js net module
 */
export declare function isPortAvailable(port: number): Promise<boolean>;
/**
 * Check if a port is in use using system commands for reliable detection
 * Uses multiple methods with fallbacks
 */
export declare function isPortInUse(port: number): Promise<boolean>;
/**
 * Find PIDs of SERVER processes LISTENING on a specific port
 *
 * IMPORTANT: Only returns processes in LISTEN state (servers accepting connections).
 * Does NOT return client processes with active connections to the port.
 *
 * This prevents killing unrelated processes that happen to connect to the port
 * (e.g., shared Inngest server that connects to multiple worktree dev servers).
 */
export declare function findProcessesOnPort(port: number): number[];
//# sourceMappingURL=port-detection.d.ts.map