/**
 * Git worktree utilities
 *
 * Functions for detecting and listing git worktrees to support
 * hash-based port assignment with collision detection.
 */

import { execFileSync } from 'child_process';

const WORKTREE_PREFIX = 'worktree ';

// Cache for worktree list (TTL: 5 seconds)
let worktreeCache: { worktrees: string[]; timestamp: number; cwd: string } | null = null;
const CACHE_TTL_MS = 5000;

/**
 * List all worktrees for the current git repository
 * Returns paths in creation order (main repo first, then worktrees)
 * Results are cached for 5 seconds to avoid repeated git calls.
 *
 * @param cwd - Directory to run git command from
 * @returns Array of absolute paths to worktrees (stable creation order)
 */
export function listWorktrees(cwd: string = process.cwd()): string[] {
  // Check cache
  const now = Date.now();
  if (worktreeCache && worktreeCache.cwd === cwd && now - worktreeCache.timestamp < CACHE_TTL_MS) {
    return worktreeCache.worktrees;
  }

  try {
    const output = execFileSync('git', ['worktree', 'list', '--porcelain'], {
      cwd,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'], // Capture stderr for debugging
    });

    // Parse line-by-line (handles paths with spaces correctly)
    const worktrees = output
      .split('\n')
      .filter((line) => line.startsWith(WORKTREE_PREFIX))
      .map((line) => line.slice(WORKTREE_PREFIX.length));

    // Update cache
    worktreeCache = { worktrees, timestamp: now, cwd };

    return worktrees;
  } catch (error) {
    // Log git errors for debugging (but not "not a git repository")
    if (error instanceof Error && !error.message.includes('not a git repository')) {
      console.warn(`git worktree list failed: ${error.message}`);
    }
    return [];
  }
}

/**
 * Clear the worktree cache (useful for testing or after worktree changes)
 */
export function clearWorktreeCache(): void {
  worktreeCache = null;
}
