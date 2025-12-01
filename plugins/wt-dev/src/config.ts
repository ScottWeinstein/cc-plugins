/**
 * Configuration loading from package.json
 *
 * Projects configure wt-dev via their package.json:
 * {
 *   "devServer": {
 *     "basePort": 3000,
 *     "inngestPort": 8288
 *   }
 * }
 *
 * basePort: Starting port for the pool (defaults to 5001)
 * 128 ports are generated starting from basePort.
 */

import fs from 'fs';
import path from 'path';

export interface DevServerConfig {
  /** Available ports for worktree dev servers */
  ports: number[];
  /** Fixed port for system-wide Inngest server */
  inngestPort: number;
}

export interface WtDevConfig {
  devServer: DevServerConfig;
  /** Absolute path to project root */
  projectRoot: string;
}

// Default base port (5001 keeps us in unprivileged range and below common app ports)
const DEFAULT_BASE_PORT = 5001;
const PORT_POOL_SIZE = 128;
const DEFAULT_INNGEST_PORT = 8288;

/**
 * Generate a port pool starting from basePort
 */
function generatePortPool(basePort: number): number[] {
  return Array.from({ length: PORT_POOL_SIZE }, (_, i) => basePort + i);
}

/**
 * Find the project root by looking for package.json
 * Walks up the directory tree from cwd
 */
export function findProjectRoot(startDir: string = process.cwd()): string {
  const MAX_DEPTH = 10;
  let currentDir = startDir;
  let depth = 0;
  const visited = new Set<string>();

  while (currentDir !== path.dirname(currentDir) && depth < MAX_DEPTH) {
    // Prevent infinite loops with symbolic links
    let realPath: string;
    try {
      realPath = fs.realpathSync(currentDir);
    } catch {
      currentDir = path.dirname(currentDir);
      depth++;
      continue;
    }

    if (visited.has(realPath)) {
      break; // Circular reference detected
    }
    visited.add(realPath);

    const packagePath = path.join(currentDir, 'package.json');
    if (fs.existsSync(packagePath)) {
      return currentDir;
    }

    currentDir = path.dirname(currentDir);
    depth++;
  }

  throw new Error(
    `Could not find project root (package.json). ` +
      `Searched ${depth} directories from ${startDir}.`
  );
}

/**
 * Load configuration from package.json devServer field
 * Falls back to defaults if not specified
 */
export function loadConfig(projectRoot?: string): WtDevConfig {
  const root = projectRoot ?? findProjectRoot();
  const packagePath = path.join(root, 'package.json');

  let basePort = DEFAULT_BASE_PORT;
  let inngestPort = DEFAULT_INNGEST_PORT;

  try {
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    if (packageJson.devServer) {
      if (typeof packageJson.devServer.basePort === 'number') {
        basePort = packageJson.devServer.basePort;
      }
      if (typeof packageJson.devServer.inngestPort === 'number') {
        inngestPort = packageJson.devServer.inngestPort;
      }
    }
  } catch (error) {
    // Log warning when using defaults due to config issues
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.warn(`Warning: Could not read devServer config from ${packagePath}: ${message}`);
    console.warn(`Using default configuration (basePort: ${DEFAULT_BASE_PORT}, inngestPort: ${DEFAULT_INNGEST_PORT})`);
  }

  return {
    devServer: {
      ports: generatePortPool(basePort),
      inngestPort,
    },
    projectRoot: root,
  };
}

/**
 * Get log file path for dev server
 */
export function getDevServerLogPath(projectRoot: string): string {
  return path.join(projectRoot, 'dev-server.log');
}

/**
 * Get log file path for Inngest server
 */
export function getInngestLogPath(projectRoot: string): string {
  return path.join(projectRoot, 'inngest.log');
}
