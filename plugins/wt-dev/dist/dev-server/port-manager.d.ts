/**
 * Hash-based port assignment for worktrees with collision detection
 *
 * Uses a hash of the worktree path to deterministically assign ports.
 * When collisions occur (multiple worktrees hash to same port), uses
 * collision detection to assign alternative ports.
 *
 * Key property: A worktree's port remains stable even when other
 * worktrees are added or removed (unlike index-based assignment).
 */
import { type WtDevConfig } from '../config.js';
/**
 * Get a deterministic port based on worktree path hash
 * Uses collision detection to ensure unique ports across worktrees.
 *
 * Algorithm:
 * 1. Hash the worktree path to get preferred port
 * 2. Check if any other worktree also hashes to same port
 * 3. If collision, each worktree uses secondary hashes until finding unique port
 *
 * Key property: A worktree's port is determined ONLY by its own path hash,
 * not by which other worktrees exist. This ensures full stability.
 */
export declare function getHashBasedPort(projectRoot: string, ports: number[]): number;
/**
 * Alias for getHashBasedPort (preferred name)
 */
export declare function getWorktreePort(projectRoot: string, ports: number[]): number;
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