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

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { loadConfig, type WtDevConfig } from '../config.js';
import { listWorktrees } from '../shared/git-utils.js';

/**
 * Custom error thrown when the port pool is exhausted
 */
export class PortExhaustedError extends Error {
  constructor(
    public readonly worktreeCount: number,
    public readonly portCount: number,
  ) {
    super(
      `\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `ERROR: Port pool exhausted\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `You have ${worktreeCount} worktrees but only ${portCount} ports configured.\n\n` +
        `To fix this, increase maxPorts in your package.json:\n\n` +
        `  "devServer": {\n` +
        `    "maxPorts": ${Math.max(portCount + 1, worktreeCount)}\n` +
        `  }\n\n` +
        `Or override with PORT environment variable (bypasses collision detection):\n` +
        `  PORT=3000 pnpm dev\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`,
    );
    this.name = 'PortExhaustedError';
  }
}

/**
 * Compute a deterministic port from a path using hash
 */
function computeHashPort(worktreePath: string, ports: number[]): number {
  const hash = crypto.createHash('md5').update(worktreePath).digest('hex');
  const hashNum = parseInt(hash.substring(0, 8), 16);
  return ports[hashNum % ports.length];
}

/**
 * Find which worktree contains a given project path
 * Returns the worktree path or null if not in any worktree
 */
function findContainingWorktree(projectPath: string, worktrees: string[]): string | null {
  let projectRealPath: string;
  try {
    projectRealPath = fs.realpathSync(projectPath);
  } catch {
    return null;
  }

  // Pre-compute real paths for all worktrees
  const worktreeRealPaths = worktrees.map((wt) => {
    try {
      return fs.realpathSync(wt);
    } catch {
      return null;
    }
  });

  for (let i = 0; i < worktrees.length; i++) {
    const wtRealPath = worktreeRealPaths[i];
    if (!wtRealPath) continue;

    // Check if project is the worktree or inside it
    if (projectRealPath === wtRealPath) {
      return worktrees[i];
    }

    // Use path.relative for reliable containment check (cross-platform)
    const rel = path.relative(wtRealPath, projectRealPath);
    if (!rel.startsWith('..') && !path.isAbsolute(rel)) {
      return worktrees[i];
    }
  }

  return null;
}

/**
 * Compute a secondary hash for collision resolution
 * Uses a different hash seed to get a different port preference
 */
function computeSecondaryHashPort(worktreePath: string, ports: number[], attempt: number): number {
  // Add attempt number to create different hash for each retry
  const hash = crypto.createHash('md5').update(`${worktreePath}:${attempt}`).digest('hex');
  const hashNum = parseInt(hash.substring(0, 8), 16);
  return ports[hashNum % ports.length];
}

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
export function getHashBasedPort(projectRoot: string, ports: number[]): number {
  // Validate ports array
  if (ports.length === 0) {
    throw new Error('ports array must not be empty');
  }

  // Check for PORT env var override first
  if (process.env.PORT) {
    const port = parseInt(process.env.PORT, 10);
    if (!isNaN(port) && port >= 1 && port <= 65535) {
      return port;
    }
    console.warn(
      `Warning: Invalid PORT env var "${process.env.PORT}" (must be 1-65535), using hash-based assignment`,
    );
  }

  // Get all worktrees for this repository
  const worktrees = listWorktrees(projectRoot);

  // If no worktrees found (not a git repo), use first port
  if (worktrees.length === 0) {
    return ports[0];
  }

  // Find which worktree contains this project
  const myWorktree = findContainingWorktree(projectRoot, worktrees);
  if (!myWorktree) {
    // Not in any worktree, use first port
    return ports[0];
  }

  // Build a map of all worktree port assignments using consistent hashing
  // Each worktree's port depends ONLY on its own path, ensuring stability
  const portAssignments = resolveAllPorts(worktrees, ports);

  const myPort = portAssignments.get(myWorktree);
  if (myPort === undefined) {
    // Should never happen, but fallback to first port
    return ports[0];
  }

  return myPort;
}

/**
 * Resolve ports for all worktrees using consistent hashing with collision resolution.
 *
 * Algorithm ensures FULL STABILITY:
 * - Process worktrees in CREATION ORDER (as returned by `git worktree list`)
 * - Earlier-created worktrees have priority for their preferred port
 * - Each worktree tries its hash sequence until finding an unclaimed port
 *
 * Key insight: A worktree's port NEVER changes because:
 * - New worktrees are always created AFTER existing ones
 * - So new worktrees never have priority over existing ones
 * - Removing a worktree just frees up its port, doesn't affect others
 */
function resolveAllPorts(worktrees: string[], ports: number[]): Map<string, number> {
  const assignments = new Map<string, number>();
  const usedPorts = new Set<number>();

  // Process in creation order (git worktree list returns this order)
  // Earlier-created worktrees get first pick of their preferred port
  for (const wt of worktrees) {
    // Try primary hash first, then secondary hashes until we find unused port
    // Max attempts = ports.length * 10 to handle unlucky hash sequences
    const maxAttempts = ports.length * 10;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const candidatePort =
        attempt === 0 ? computeHashPort(wt, ports) : computeSecondaryHashPort(wt, ports, attempt);

      if (!usedPorts.has(candidatePort)) {
        assignments.set(wt, candidatePort);
        usedPorts.add(candidatePort);
        break;
      }
    }

    // If we couldn't find a port, throw helpful error
    if (!assignments.has(wt)) {
      throw new PortExhaustedError(worktrees.length, ports.length);
    }
  }

  return assignments;
}

/**
 * Alias for getHashBasedPort (preferred name)
 */
export function getWorktreePort(projectRoot: string, ports: number[]): number {
  return getHashBasedPort(projectRoot, ports);
}

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
export function getWorktreeConfig(config?: WtDevConfig): WorktreeConfig {
  const cfg = config ?? loadConfig();
  const port = getHashBasedPort(cfg.projectRoot, cfg.devServer.ports);

  // Default to HTTP for localhost since dev server doesn't have SSL certificates
  // Set USE_HTTPS_LOCALHOST=true only if you have configured SSL certs for local dev
  const useHttps = process.env.USE_HTTPS_LOCALHOST === 'true';
  const protocol = useHttps ? 'https' : 'http';

  return {
    port,
    protocol,
    baseUrl: `${protocol}://localhost:${port}`,
    inngestPort: cfg.devServer.inngestPort,
    inngestUrl: `http://localhost:${cfg.devServer.inngestPort}`,
  };
}
