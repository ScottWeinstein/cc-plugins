/**
 * File utilities for atomic writes, PID files, and lock files
 */
/**
 * Write content to a file atomically using temp file + rename
 * This prevents race conditions and partial writes
 */
export declare function atomicWrite(filePath: string, content: string): Promise<void>;
/**
 * Write content to a file atomically (sync version)
 */
export declare function atomicWriteSync(filePath: string, content: string): void;
/**
 * Read PID from a PID file
 * @returns The PID if file exists and contains valid number, null otherwise
 */
export declare function readPidFile(pidFilePath: string): number | null;
/**
 * Write PID to a PID file
 */
export declare function writePidFile(pidFilePath: string, pid: number): void;
/**
 * Delete a PID file
 */
export declare function deletePidFile(pidFilePath: string): void;
/**
 * Get a standard PID file path in the system temp directory
 */
export declare function getTempPidFilePath(name: string): string;
/**
 * Acquire an exclusive lock file (mutex)
 * Uses exclusive file creation (wx flag)
 * @returns true if lock was acquired, false if already locked
 */
export declare function acquireLock(lockFilePath: string): boolean;
/**
 * Release a lock file
 */
export declare function releaseLock(lockFilePath: string): void;
/**
 * Ensure a directory exists
 */
export declare function ensureDir(dirPath: string): void;
//# sourceMappingURL=file-utils.d.ts.map