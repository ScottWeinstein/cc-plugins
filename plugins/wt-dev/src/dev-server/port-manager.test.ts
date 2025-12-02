import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { resolveAllPorts } from './port-manager.js';

/**
 * Helper to compute hash-based port (mirrors the actual implementation)
 */
function computeHashPort(worktreePath: string, ports: number[]): number {
  const hash = crypto.createHash('md5').update(worktreePath).digest('hex');
  const hashNum = parseInt(hash.substring(0, 8), 16);
  return ports[hashNum % ports.length];
}

/**
 * Helper to compute secondary hash port for collision resolution
 */
function computeSecondaryHashPort(worktreePath: string, ports: number[], attempt: number): number {
  const hash = crypto.createHash('md5').update(`${worktreePath}:${attempt}`).digest('hex');
  const hashNum = parseInt(hash.substring(0, 8), 16);
  return ports[hashNum % ports.length];
}

describe('port-manager hash functions', () => {
  describe('computeHashPort', () => {
    it('should return consistent port for same path', () => {
      const ports = [5000, 5001, 5002, 5003, 5004];
      const path = '/home/user/project/main';

      const port1 = computeHashPort(path, ports);
      const port2 = computeHashPort(path, ports);

      expect(port1).toBe(port2);
    });

    it('should return port from the pool', () => {
      const ports = [5000, 5001, 5002, 5003, 5004];
      const path = '/home/user/project/main';

      const port = computeHashPort(path, ports);

      expect(ports).toContain(port);
    });

    it('should distribute different paths across ports', () => {
      const ports = [5000, 5001, 5002, 5003, 5004];
      const paths = [
        '/home/user/project/main',
        '/home/user/project/feature-a',
        '/home/user/project/feature-b',
        '/home/user/project/fix-bug',
        '/home/user/.worktrees/project/experiment',
      ];

      const assignedPorts = new Set(paths.map((p) => computeHashPort(p, ports)));

      // With 5 paths and 5 ports, we expect reasonable distribution
      // At minimum, we shouldn't have all paths hash to same port
      expect(assignedPorts.size).toBeGreaterThan(1);
    });
  });

  describe('resolveAllPorts', () => {
    it('should assign unique ports to each worktree', () => {
      const ports = [5000, 5001, 5002, 5003, 5004];
      const worktrees = [
        '/home/user/project/main',
        '/home/user/project/feature-a',
        '/home/user/project/feature-b',
      ];

      const assignments = resolveAllPorts(worktrees, ports);

      // All worktrees should have assignments
      expect(assignments.size).toBe(worktrees.length);

      // All assigned ports should be unique
      const assignedPorts = new Set(assignments.values());
      expect(assignedPorts.size).toBe(worktrees.length);

      // All assigned ports should be from the pool
      for (const port of assignments.values()) {
        expect(ports).toContain(port);
      }
    });

    it('should handle collisions with secondary hashes', () => {
      // Use a very small port pool to force collisions
      const ports = [5000, 5001];
      const worktrees = ['/a', '/b'];

      const assignments = resolveAllPorts(worktrees, ports);

      expect(assignments.size).toBe(2);
      const assignedPorts = new Set(assignments.values());
      expect(assignedPorts.size).toBe(2);
    });

    it('should throw when port pool is exhausted', () => {
      const ports = [5000, 5001];
      const worktrees = ['/a', '/b', '/c']; // 3 worktrees, only 2 ports

      expect(() => resolveAllPorts(worktrees, ports)).toThrow(/Port pool exhausted/);
    });

    it('should maintain port stability when worktrees added', () => {
      const ports = [5000, 5001, 5002, 5003, 5004];
      const originalWorktrees = ['/home/user/project/main', '/home/user/project/feature-a'];

      const original = resolveAllPorts(originalWorktrees, ports);
      const originalMain = original.get('/home/user/project/main');
      const originalFeatureA = original.get('/home/user/project/feature-a');

      // Add a new worktree at the end
      const newWorktrees = [...originalWorktrees, '/home/user/project/feature-b'];
      const updated = resolveAllPorts(newWorktrees, ports);

      // Original worktrees should keep their ports
      expect(updated.get('/home/user/project/main')).toBe(originalMain);
      expect(updated.get('/home/user/project/feature-a')).toBe(originalFeatureA);
    });
  });
});

describe('basePort reservation', () => {
  /**
   * BUG: basePort should be reserved for the main git checkout only.
   *
   * The main git checkout (first entry from `git worktree list`) should
   * always get basePort. Worktrees (additional checkouts) should NEVER
   * get basePort - they should only use ports from basePort+1 onwards.
   *
   * This is important because:
   * 1. Users expect the main checkout to have a predictable port
   * 2. OAuth callback URLs are often registered for specific ports
   * 3. The main checkout is the "canonical" development environment
   */

  /**
   * Helper that mirrors the FIXED resolveAllPorts behavior:
   * - Main checkout (first worktree) always gets basePort
   * - Other worktrees use hash-based assignment from remaining ports
   */
  function resolveAllPortsWithReservation(
    worktrees: string[],
    ports: number[],
  ): Map<string, number> {
    const assignments = new Map<string, number>();
    const usedPorts = new Set<number>();

    // First worktree (main checkout) ALWAYS gets basePort
    if (worktrees.length > 0) {
      const basePort = ports[0];
      assignments.set(worktrees[0], basePort);
      usedPorts.add(basePort);
    }

    // Remaining worktrees use hash-based assignment from remaining ports
    const remainingPorts = ports.slice(1);
    for (let i = 1; i < worktrees.length; i++) {
      const wt = worktrees[i];
      const maxAttempts = remainingPorts.length * 10;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const candidatePort =
          attempt === 0
            ? computeHashPort(wt, remainingPorts)
            : computeSecondaryHashPort(wt, remainingPorts, attempt);

        if (!usedPorts.has(candidatePort)) {
          assignments.set(wt, candidatePort);
          usedPorts.add(candidatePort);
          break;
        }
      }

      if (!assignments.has(wt)) {
        throw new Error(
          `Port pool exhausted: ${worktrees.length} worktrees but only ${ports.length} ports available.`,
        );
      }
    }

    return assignments;
  }

  it('should always assign basePort to main checkout (first worktree)', () => {
    const basePort = 5000;
    const ports = [5000, 5001, 5002, 5003, 5004];
    const worktrees = [
      '/home/user/project', // Main checkout
      '/home/user/.worktrees/project/feature-a', // Worktree
      '/home/user/.worktrees/project/feature-b', // Worktree
    ];

    const assignments = resolveAllPortsWithReservation(worktrees, ports);

    // Main checkout MUST get basePort
    expect(assignments.get('/home/user/project')).toBe(basePort);
  });

  it('should NEVER assign basePort to worktrees', () => {
    const basePort = 5000;
    const ports = [5000, 5001, 5002, 5003, 5004];
    const worktrees = [
      '/home/user/project', // Main checkout
      '/home/user/.worktrees/project/feature-a', // Worktree
      '/home/user/.worktrees/project/feature-b', // Worktree
    ];

    const assignments = resolveAllPortsWithReservation(worktrees, ports);

    // Worktrees must NOT get basePort
    for (let i = 1; i < worktrees.length; i++) {
      const port = assignments.get(worktrees[i]);
      expect(port).not.toBe(basePort);
      expect(port).toBeGreaterThan(basePort);
    }
  });

  it('should assign unique ports to all worktrees', () => {
    const ports = [5000, 5001, 5002, 5003, 5004];
    const worktrees = [
      '/home/user/project',
      '/home/user/.worktrees/project/feature-a',
      '/home/user/.worktrees/project/feature-b',
    ];

    const assignments = resolveAllPortsWithReservation(worktrees, ports);

    const assignedPorts = new Set(assignments.values());
    expect(assignedPorts.size).toBe(worktrees.length);
  });

  it('should work with only main checkout (no worktrees)', () => {
    const basePort = 5000;
    const ports = [5000, 5001, 5002];
    const worktrees = ['/home/user/project']; // Only main checkout

    const assignments = resolveAllPortsWithReservation(worktrees, ports);

    expect(assignments.get('/home/user/project')).toBe(basePort);
  });

  /**
   * This test verifies that the ACTUAL implementation reserves basePort
   * for the main checkout. It uses the real resolveAllPorts function.
   */
  it('actual implementation should reserve basePort for main checkout', () => {
    const basePort = 5000;
    const ports = [5000, 5001, 5002, 5003, 5004];
    const worktrees = [
      '/home/user/project', // Main checkout (first in list from git worktree list)
      '/home/user/.worktrees/project/feature-a',
      '/home/user/.worktrees/project/feature-b',
    ];

    // Use the ACTUAL resolveAllPorts implementation
    const assignments = resolveAllPorts(worktrees, ports);

    // Main checkout (first worktree) MUST get basePort
    expect(assignments.get('/home/user/project')).toBe(basePort);

    // Worktrees must NOT get basePort
    expect(assignments.get('/home/user/.worktrees/project/feature-a')).not.toBe(basePort);
    expect(assignments.get('/home/user/.worktrees/project/feature-b')).not.toBe(basePort);
  });

  it('actual implementation should give worktrees ports > basePort', () => {
    const basePort = 5000;
    const ports = [5000, 5001, 5002, 5003, 5004];
    const worktrees = [
      '/home/user/project', // Main checkout
      '/home/user/.worktrees/project/feature-a',
      '/home/user/.worktrees/project/feature-b',
    ];

    const assignments = resolveAllPorts(worktrees, ports);

    // All worktree ports must be greater than basePort
    for (let i = 1; i < worktrees.length; i++) {
      const port = assignments.get(worktrees[i]);
      expect(port).toBeGreaterThan(basePort);
    }
  });
});

describe('port pool generation', () => {
  /**
   * BUG REPRODUCTION TEST
   *
   * This test demonstrates the bug introduced in commit 8b096ef:
   * When DEFAULT_MAX_PORTS was changed from 128 to 5, worktrees that
   * previously got different ports now often get the same port.
   *
   * The issue is that with a small port pool (5 ports), the hash modulo
   * operation (hashNum % 5) has a much higher collision rate than with
   * a large pool (hashNum % 128).
   */
  describe('bug: small default port pool causes port collisions', () => {
    it('should NOT assign basePort to all worktrees when they hash to same index', () => {
      // This simulates the real-world scenario where a user has:
      // - basePort: 5000
      // - No maxPorts configured (defaults to 5)
      const basePort = 5000;
      const maxPorts = 5; // DEFAULT_MAX_PORTS after the bug
      const ports = Array.from({ length: maxPorts }, (_, i) => basePort + i);

      // These are realistic worktree paths
      const worktrees = [
        '/home/sw/dev/myproject',
        '/home/sw/.worktrees/myproject/feature-auth',
        '/home/sw/.worktrees/myproject/fix-port-release',
      ];

      const assignments = resolveAllPorts(worktrees, ports);

      // The bug would cause multiple worktrees to initially hash to the same port
      // The collision resolution should give them different ports
      const assignedPorts = Array.from(assignments.values());
      const uniquePorts = new Set(assignedPorts);

      expect(uniquePorts.size).toBe(worktrees.length);

      // More importantly: not all worktrees should get the basePort
      // If the hash function is working properly, they should be distributed
      const worktreesOnBasePort = assignedPorts.filter((p) => p === basePort).length;
      expect(worktreesOnBasePort).toBeLessThanOrEqual(1);
    });

    it('should work correctly with large port pool (128 ports)', () => {
      const basePort = 5000;
      const maxPorts = 128; // Original PORT_POOL_SIZE before the change
      const ports = Array.from({ length: maxPorts }, (_, i) => basePort + i);

      const worktrees = [
        '/home/sw/dev/myproject',
        '/home/sw/.worktrees/myproject/feature-auth',
        '/home/sw/.worktrees/myproject/fix-port-release',
        '/home/sw/.worktrees/myproject/feature-b',
        '/home/sw/.worktrees/myproject/hotfix',
      ];

      const assignments = resolveAllPorts(worktrees, ports);

      // With 128 ports, collisions should be rare
      const uniquePorts = new Set(assignments.values());
      expect(uniquePorts.size).toBe(worktrees.length);
    });
  });
});
