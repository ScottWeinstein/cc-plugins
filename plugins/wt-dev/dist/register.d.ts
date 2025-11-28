/**
 * Plugin registration for Claude Code
 *
 * Registers the wt-dev plugin with Claude Code by creating a symlink
 * in the project's .claude/plugins directory.
 */
interface RegisterResult {
    success: boolean;
    message: string;
    pluginPath?: string;
}
/**
 * Register the plugin with Claude Code
 */
export declare function registerPlugin(options?: {
    force?: boolean;
    projectRoot?: string;
}): RegisterResult;
/**
 * Unregister the plugin from Claude Code
 */
export declare function unregisterPlugin(options?: {
    projectRoot?: string;
}): RegisterResult;
/**
 * Check plugin registration status
 */
export declare function checkRegistration(options?: {
    projectRoot?: string;
}): {
    registered: boolean;
    pluginPath?: string;
    projectRoot?: string;
};
/**
 * Run registration as postinstall script
 */
export declare function postinstall(): void;
export {};
//# sourceMappingURL=register.d.ts.map