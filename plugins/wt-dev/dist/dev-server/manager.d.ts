/**
 * Dev server manager - start/stop/status/force/logs
 *
 * Manages per-worktree Next.js dev servers with duplicate prevention
 * and automatic Inngest server coordination.
 */
import { type WtDevConfig } from '../config.js';
/**
 * Show dev server status
 */
export declare function showDevServerStatus(config?: WtDevConfig): Promise<void>;
/**
 * Stop the dev server
 */
export declare function stopDevServer(config?: WtDevConfig): Promise<boolean>;
/**
 * Start the dev server
 */
export declare function startDevServer(config?: WtDevConfig, options?: {
    force?: boolean;
}): Promise<void>;
/**
 * Tail the dev server logs
 */
export declare function showDevServerLogs(config?: WtDevConfig): void;
//# sourceMappingURL=manager.d.ts.map