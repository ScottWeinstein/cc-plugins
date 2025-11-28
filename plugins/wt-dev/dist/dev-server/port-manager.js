/**
 * Hash-based port assignment for worktrees
 *
 * Uses MD5 hash of project root to consistently assign ports
 * to the same worktree across restarts.
 */
import crypto from 'crypto';
import { loadConfig } from '../config.js';
/**
 * Get a deterministic port based on the project root directory hash
 * MD5(projectRoot) % ports.length → consistent port per worktree
 */
export function getHashBasedPort(projectRoot, ports) {
    // Check for PORT env var override first
    if (process.env.PORT) {
        const port = parseInt(process.env.PORT, 10);
        if (!isNaN(port) && port >= 1 && port <= 65535) {
            return port;
        }
        // Warn if PORT is invalid and fall through to hash-based assignment
        console.warn(`Warning: Invalid PORT env var "${process.env.PORT}" (must be 1-65535), using hash-based assignment`);
    }
    // Create a hash of the project root path for consistency
    const hash = crypto.createHash('md5').update(projectRoot).digest('hex');
    // Use hash to select one of the predefined ports consistently
    const hashNum = parseInt(hash.substring(0, 8), 16);
    const portIndex = hashNum % ports.length;
    return ports[portIndex];
}
/**
 * Get complete configuration for the current worktree
 */
export function getWorktreeConfig(config) {
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
//# sourceMappingURL=port-manager.js.map