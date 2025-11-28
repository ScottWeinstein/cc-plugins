/**
 * Hash-based port assignment for worktrees
 *
 * Uses MD5 hash of project root to consistently assign ports
 * to the same worktree across restarts.
 */
import { type WtDevConfig } from '../config.js';
/**
 * Get a deterministic port based on the project root directory hash
 * MD5(projectRoot) % ports.length → consistent port per worktree
 */
export declare function getHashBasedPort(projectRoot: string, ports: number[]): number;
export interface WorktreeConfig {
    /** Port for this worktree's dev server */
    port: number;
    /** Protocol (http or https) */
    protocol: 'http' | 'https';
    /** Base URL for the dev server */
    baseUrl: string;
    /** Port for the shared Inngest server */
    inngestPort: number;
    /** URL for the Inngest UI */
    inngestUrl: string;
}
/**
 * Get complete configuration for the current worktree
 */
export declare function getWorktreeConfig(config?: WtDevConfig): WorktreeConfig;
//# sourceMappingURL=port-manager.d.ts.map