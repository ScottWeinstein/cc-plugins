/**
 * Plugin registration for Claude Code
 *
 * Registers the wt-dev plugin with Claude Code by creating a symlink
 * in the project's .claude/plugins directory.
 */
import { existsSync, mkdirSync, symlinkSync, readlinkSync, unlinkSync, rmSync, readFileSync } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Package root is one level up from dist/
const PACKAGE_ROOT = resolve(__dirname, '..');
/**
 * Find the project root by looking for package.json with workspaces or .git
 */
function findProjectRoot() {
    let current = resolve(process.cwd());
    const root = resolve('/');
    while (current !== root) {
        // Check for .git directory (strong indicator of project root)
        if (existsSync(join(current, '.git'))) {
            return current;
        }
        // Check for package.json with workspaces (monorepo root)
        const pkgPath = join(current, 'package.json');
        if (existsSync(pkgPath)) {
            try {
                const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
                if (pkg.workspaces) {
                    return current;
                }
            }
            catch {
                // Ignore parse errors
            }
        }
        current = dirname(current);
    }
    // Fallback: return the directory containing node_modules/wt-dev
    const nodeModulesIndex = PACKAGE_ROOT.indexOf('node_modules');
    if (nodeModulesIndex !== -1) {
        return PACKAGE_ROOT.slice(0, nodeModulesIndex - 1);
    }
    return null;
}
/**
 * Check if path is inside node_modules (installed as dependency)
 */
function isInstalledPackage() {
    return PACKAGE_ROOT.includes('node_modules');
}
/**
 * Register the plugin with Claude Code
 */
export function registerPlugin(options = {}) {
    const { force = false } = options;
    // Find project root
    const projectRoot = options.projectRoot || findProjectRoot();
    if (!projectRoot) {
        return {
            success: false,
            message: 'Could not find project root. Run from within a git repository or npm project.',
        };
    }
    // Determine paths
    const claudeDir = join(projectRoot, '.claude');
    const pluginsDir = join(claudeDir, 'plugins');
    const pluginTarget = join(pluginsDir, 'wt-dev');
    // Source is the .claude-plugin directory in the package
    const pluginSource = join(PACKAGE_ROOT, '.claude-plugin');
    if (!existsSync(pluginSource)) {
        return {
            success: false,
            message: `Plugin source not found at ${pluginSource}. Package may be corrupted.`,
        };
    }
    // Validate plugin source is within package boundaries (defense-in-depth)
    const resolvedSource = resolve(pluginSource);
    const resolvedPackage = resolve(PACKAGE_ROOT);
    if (!resolvedSource.startsWith(resolvedPackage)) {
        return {
            success: false,
            message: 'Plugin source validation failed: path outside package boundaries.',
        };
    }
    // Check if already registered
    if (existsSync(pluginTarget)) {
        if (!force) {
            // Verify it points to the right place
            try {
                const linkTarget = readlinkSync(pluginTarget);
                const resolvedTarget = resolve(pluginsDir, linkTarget);
                if (resolvedTarget === resolvedSource) {
                    return {
                        success: true,
                        message: 'Plugin already registered.',
                        pluginPath: pluginTarget,
                    };
                }
            }
            catch {
                // Not a symlink, might be a directory
            }
            return {
                success: false,
                message: `Plugin path already exists: ${pluginTarget}. Use --force to overwrite.`,
            };
        }
        // Force: remove existing
        try {
            rmSync(pluginTarget, { recursive: true, force: true });
        }
        catch (e) {
            return {
                success: false,
                message: `Could not remove existing plugin at ${pluginTarget}: ${e}`,
            };
        }
    }
    // Create directories
    try {
        if (!existsSync(claudeDir)) {
            mkdirSync(claudeDir, { recursive: true });
        }
        if (!existsSync(pluginsDir)) {
            mkdirSync(pluginsDir, { recursive: true });
        }
    }
    catch (e) {
        return {
            success: false,
            message: `Could not create plugin directory: ${e}`,
        };
    }
    // Create symlink (use relative path for portability)
    try {
        const relativePath = relative(pluginsDir, pluginSource);
        symlinkSync(relativePath, pluginTarget);
    }
    catch (e) {
        return {
            success: false,
            message: `Could not create symlink: ${e}`,
        };
    }
    return {
        success: true,
        message: `Plugin registered at ${pluginTarget}`,
        pluginPath: pluginTarget,
    };
}
/**
 * Unregister the plugin from Claude Code
 */
export function unregisterPlugin(options = {}) {
    const projectRoot = options.projectRoot || findProjectRoot();
    if (!projectRoot) {
        return {
            success: false,
            message: 'Could not find project root.',
        };
    }
    const pluginTarget = join(projectRoot, '.claude', 'plugins', 'wt-dev');
    if (!existsSync(pluginTarget)) {
        return {
            success: true,
            message: 'Plugin not registered (nothing to remove).',
        };
    }
    try {
        unlinkSync(pluginTarget);
        return {
            success: true,
            message: 'Plugin unregistered successfully.',
        };
    }
    catch (e) {
        return {
            success: false,
            message: `Could not remove plugin: ${e}`,
        };
    }
}
/**
 * Check plugin registration status
 */
export function checkRegistration(options = {}) {
    const projectRoot = options.projectRoot || findProjectRoot();
    if (!projectRoot) {
        return { registered: false };
    }
    const pluginTarget = join(projectRoot, '.claude', 'plugins', 'wt-dev');
    return {
        registered: existsSync(pluginTarget),
        pluginPath: pluginTarget,
        projectRoot,
    };
}
/**
 * Run registration as postinstall script
 */
export function postinstall() {
    // Only run if installed as a dependency (in node_modules)
    if (!isInstalledPackage()) {
        // Development mode - skip automatic registration
        return;
    }
    const result = registerPlugin();
    if (result.success) {
        console.log(`\n✓ wt-dev: Claude Code plugin registered`);
        console.log(`  Location: ${result.pluginPath}`);
        console.log(`  Skills: dev-server, inngest\n`);
    }
    else {
        console.log(`\n⚠ wt-dev: Could not auto-register Claude Code plugin`);
        console.log(`  ${result.message}`);
        console.log(`  Run manually: npx wt-dev register\n`);
    }
}
// CLI entry point for postinstall (triggered by npm lifecycle)
if (process.env.npm_lifecycle_event === 'postinstall') {
    postinstall();
}
//# sourceMappingURL=register.js.map