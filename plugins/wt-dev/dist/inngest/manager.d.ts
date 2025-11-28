/**
 * Inngest server manager - ensure/start/stop/status/logs
 *
 * Manages a system-wide Inngest dev server shared across all worktrees.
 * Uses lock-based coordination to prevent race conditions.
 */
import { type WtDevConfig } from '../config.js';
/**
 * Get Inngest server status
 */
export interface InngestStatus {
    running: boolean;
    pid?: number;
    port?: number;
    message: string;
    logFile?: string;
}
export declare function getInngestStatus(config?: WtDevConfig): InngestStatus;
/**
 * Show Inngest server status
 */
export declare function showInngestStatus(config?: WtDevConfig): void;
/**
 * Ensure Inngest server is running (idempotent)
 */
export declare function ensureInngestServer(config?: WtDevConfig): Promise<void>;
/**
 * Start Inngest server (check if already running first)
 */
export declare function startInngestServer(config?: WtDevConfig): Promise<void>;
/**
 * Stop the Inngest server
 */
export declare function stopInngestServer(config?: WtDevConfig): Promise<void>;
/**
 * Restart the Inngest server
 */
export declare function restartInngestServer(config?: WtDevConfig): Promise<void>;
/**
 * Tail the Inngest server logs
 */
export declare function showInngestLogs(config?: WtDevConfig): void;
//# sourceMappingURL=manager.d.ts.map