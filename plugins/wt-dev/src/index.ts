/**
 * wt-dev - Unified worktree and Inngest management
 *
 * Main exports for programmatic use.
 */

// Configuration
export { loadConfig, findProjectRoot, type WtDevConfig, type DevServerConfig } from './config.js';

// Port management
export { getHashBasedPort, getWorktreeConfig, type WorktreeConfig } from './dev-server/port-manager.js';

// Dev server management
export {
  startDevServer,
  stopDevServer,
  showDevServerStatus,
  showDevServerLogs,
} from './dev-server/manager.js';

// Inngest management
export {
  ensureInngestServer,
  startInngestServer,
  stopInngestServer,
  restartInngestServer,
  showInngestStatus,
  showInngestLogs,
  getInngestStatus,
  type InngestStatus,
} from './inngest/manager.js';

// Shared utilities
export { isPortInUse, isPortAvailable, findProcessesOnPort } from './shared/port-detection.js';
export { isProcessRunning, killProcessesOnPort, waitForPortRelease } from './shared/process-utils.js';
export {
  atomicWrite,
  atomicWriteSync,
  readPidFile,
  writePidFile,
  deletePidFile,
  acquireLock,
  releaseLock,
} from './shared/file-utils.js';
