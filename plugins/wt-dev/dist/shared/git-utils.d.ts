/**
 * Git worktree utilities
 *
 * Functions for detecting and listing git worktrees to support
 * hash-based port assignment with collision detection.
 */
/**
 * List all worktrees for the current git repository
 * Returns paths in creation order (main repo first, then worktrees)
 * Results are cached for 5 seconds to avoid repeated git calls.
 *
 * @param cwd - Directory to run git command from
 * @returns Array of absolute paths to worktrees (stable creation order)
 */
export declare function listWorktrees(cwd?: string): string[];
/**
 * Clear the worktree cache (useful for testing or after worktree changes)
 */
export declare function clearWorktreeCache(): void;
//# sourceMappingURL=git-utils.d.ts.map