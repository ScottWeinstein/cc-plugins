/**
 * File utilities for atomic writes, PID files, and lock files
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
/**
 * Write content to a file atomically using temp file + rename
 * This prevents race conditions and partial writes
 */
export async function atomicWrite(filePath, content) {
    const tempPath = `${filePath}.tmp.${process.pid}`;
    try {
        await fs.promises.writeFile(tempPath, content, 'utf8');
        await fs.promises.rename(tempPath, filePath); // Atomic on POSIX
    }
    catch (error) {
        // Clean up temp file if it exists
        try {
            await fs.promises.unlink(tempPath);
        }
        catch {
            // Ignore cleanup errors
        }
        throw error;
    }
}
/**
 * Write content to a file atomically (sync version)
 */
export function atomicWriteSync(filePath, content) {
    const tempPath = `${filePath}.tmp.${process.pid}`;
    try {
        fs.writeFileSync(tempPath, content, 'utf8');
        fs.renameSync(tempPath, filePath); // Atomic on POSIX
    }
    catch (error) {
        // Clean up temp file if it exists
        try {
            if (fs.existsSync(tempPath)) {
                fs.unlinkSync(tempPath);
            }
        }
        catch {
            // Ignore cleanup errors
        }
        throw error;
    }
}
/**
 * Read PID from a PID file
 * @returns The PID if file exists and contains valid number, null otherwise
 */
export function readPidFile(pidFilePath) {
    try {
        if (fs.existsSync(pidFilePath)) {
            const content = fs.readFileSync(pidFilePath, 'utf8').trim();
            const pid = parseInt(content, 10);
            if (!isNaN(pid) && pid > 0) {
                return pid;
            }
        }
    }
    catch {
        // Ignore read errors
    }
    return null;
}
/**
 * Write PID to a PID file
 */
export function writePidFile(pidFilePath, pid) {
    atomicWriteSync(pidFilePath, pid.toString());
}
/**
 * Delete a PID file
 */
export function deletePidFile(pidFilePath) {
    try {
        if (fs.existsSync(pidFilePath)) {
            fs.unlinkSync(pidFilePath);
        }
    }
    catch {
        // Ignore delete errors
    }
}
/**
 * Get a standard PID file path in the system temp directory
 */
export function getTempPidFilePath(name) {
    return path.join(os.tmpdir(), `${name}.pid`);
}
/**
 * Acquire an exclusive lock file (mutex)
 * Uses exclusive file creation (wx flag)
 * @returns true if lock was acquired, false if already locked
 */
export function acquireLock(lockFilePath) {
    try {
        // Use exclusive file creation as a mutex
        fs.writeFileSync(lockFilePath, process.pid.toString(), { flag: 'wx' });
        return true;
    }
    catch {
        // Lock file already exists
        return false;
    }
}
/**
 * Release a lock file
 */
export function releaseLock(lockFilePath) {
    try {
        if (fs.existsSync(lockFilePath)) {
            fs.unlinkSync(lockFilePath);
        }
    }
    catch {
        // Ignore release errors
    }
}
/**
 * Ensure a directory exists
 */
export function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}
//# sourceMappingURL=file-utils.js.map