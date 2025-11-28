/**
 * Configuration loading from package.json
 *
 * Projects configure wt-dev via their package.json:
 * {
 *   "devServer": {
 *     "ports": [5001, 5002, 5003, 5004, 5005],
 *     "inngestPort": 8288
 *   }
 * }
 */
import fs from 'fs';
import path from 'path';
// Default configuration
const DEFAULT_CONFIG = {
    ports: [5001, 5002, 5003, 5004, 5005],
    inngestPort: 8288,
};
/**
 * Find the project root by looking for package.json
 * Walks up the directory tree from cwd
 */
export function findProjectRoot(startDir = process.cwd()) {
    const MAX_DEPTH = 10;
    let currentDir = startDir;
    let depth = 0;
    const visited = new Set();
    while (currentDir !== path.dirname(currentDir) && depth < MAX_DEPTH) {
        // Prevent infinite loops with symbolic links
        let realPath;
        try {
            realPath = fs.realpathSync(currentDir);
        }
        catch {
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
    throw new Error(`Could not find project root (package.json). ` +
        `Searched ${depth} directories from ${startDir}.`);
}
/**
 * Load configuration from package.json devServer field
 * Falls back to defaults if not specified
 */
export function loadConfig(projectRoot) {
    const root = projectRoot ?? findProjectRoot();
    const packagePath = path.join(root, 'package.json');
    let devServer = { ...DEFAULT_CONFIG };
    try {
        const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
        if (packageJson.devServer) {
            if (Array.isArray(packageJson.devServer.ports)) {
                devServer.ports = packageJson.devServer.ports;
            }
            if (typeof packageJson.devServer.inngestPort === 'number') {
                devServer.inngestPort = packageJson.devServer.inngestPort;
            }
        }
    }
    catch (error) {
        // Log warning when using defaults due to config issues
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.warn(`Warning: Could not read devServer config from ${packagePath}: ${message}`);
        console.warn('Using default configuration (ports: 5001-5005, inngestPort: 8288)');
    }
    return {
        devServer,
        projectRoot: root,
    };
}
/**
 * Get log file path for dev server
 */
export function getDevServerLogPath(projectRoot) {
    return path.join(projectRoot, 'dev-server.log');
}
/**
 * Get log file path for Inngest server
 */
export function getInngestLogPath(projectRoot) {
    return path.join(projectRoot, 'inngest.log');
}
//# sourceMappingURL=config.js.map