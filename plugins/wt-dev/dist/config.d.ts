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
/**
 * Find the project root by looking for package.json
 * Walks up the directory tree from cwd
 */
export declare function findProjectRoot(startDir?: string): string;
/**
 * Load configuration from package.json devServer field
 * Falls back to defaults if not specified
 */
export declare function loadConfig(projectRoot?: string): WtDevConfig;
/**
 * Get log file path for dev server
 */
export declare function getDevServerLogPath(projectRoot: string): string;
/**
 * Get log file path for Inngest server
 */
export declare function getInngestLogPath(projectRoot: string): string;
//# sourceMappingURL=config.d.ts.map