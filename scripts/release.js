#!/usr/bin/env node
// @ts-check

/**
 * Release script for cc-plugins
 *
 * Usage:
 *   pnpm release          # Bump patch version (0.1.1 -> 0.1.2)
 *   pnpm release --minor  # Bump minor version (0.1.1 -> 0.2.0)
 *   pnpm release --major  # Bump major version (0.1.1 -> 1.0.0)
 *   pnpm release --dry-run  # Show what would happen without triggering
 *
 * This triggers a GitHub Actions workflow that:
 * 1. Runs checks and tests
 * 2. Updates version in all package.json files
 * 3. Commits, tags, and pushes to main
 * 4. Creates a GitHub release with artifacts
 */

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

function execQuiet(cmd) {
  return execSync(cmd, { cwd: rootDir, encoding: 'utf-8' }).trim();
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf-8'));
}

/**
 * Parse semver string into components
 */
function parseSemver(version) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)(-[\w.]+)?$/);
  if (!match) {
    throw new Error(`Invalid semver: ${version}`);
  }
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    prerelease: match[4] || '',
  };
}

/**
 * Bump version based on type
 */
function bumpVersion(currentVersion, type) {
  const v = parseSemver(currentVersion);

  switch (type) {
    case 'major':
      return `${v.major + 1}.0.0`;
    case 'minor':
      return `${v.major}.${v.minor + 1}.0`;
    case 'patch':
    default:
      return `${v.major}.${v.minor}.${v.patch + 1}`;
  }
}

function checkGhCli() {
  try {
    execQuiet('gh --version');
    return true;
  } catch {
    return false;
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  let type = 'patch';
  let dryRun = false;

  for (const arg of args) {
    if (arg === '--major') type = 'major';
    else if (arg === '--minor') type = 'minor';
    else if (arg === '--patch') type = 'patch';
    else if (arg === '--dry-run') dryRun = true;
    else if (arg === '--help' || arg === '-h') {
      console.log(`
Usage: pnpm release [options]

Options:
  --patch     Bump patch version (default): 0.1.1 -> 0.1.2
  --minor     Bump minor version: 0.1.1 -> 0.2.0
  --major     Bump major version: 0.1.1 -> 1.0.0
  --dry-run   Show what would happen without triggering workflow
  --help, -h  Show this help message
`);
      process.exit(0);
    }
  }

  return { type, dryRun };
}

async function main() {
  const { type, dryRun } = parseArgs();

  // Check for gh CLI
  if (!checkGhCli()) {
    console.error('GitHub CLI (gh) is required. Install it from: https://cli.github.com/');
    process.exit(1);
  }

  // Check if authenticated
  try {
    execQuiet('gh auth status');
  } catch {
    console.error('GitHub CLI is not authenticated. Please run: gh auth login');
    process.exit(1);
  }

  // Get current version
  const currentVersion = readJson(join(rootDir, 'package.json')).version;
  const newVersion = bumpVersion(currentVersion, type);
  const tagName = `v${newVersion}`;

  console.log(`\nRelease: ${currentVersion} → ${newVersion} (${type})\n`);

  // Check if tag already exists
  try {
    execQuiet(`git ls-remote --tags origin refs/tags/${tagName}`);
    const result = execQuiet(`git ls-remote --tags origin refs/tags/${tagName}`);
    if (result) {
      console.error(`Tag ${tagName} already exists on remote.`);
      process.exit(1);
    }
  } catch {
    // Command failed, which is fine
  }

  if (dryRun) {
    console.log('Dry run - would trigger workflow with:');
    console.log(`  version: ${newVersion}`);
    console.log(`  type: ${type}`);
    console.log('\nRun without --dry-run to trigger the release.');
    return;
  }

  console.log('Triggering release workflow...\n');

  try {
    execSync(`gh workflow run release.yml -f version=${newVersion}`, {
      cwd: rootDir,
      stdio: 'inherit',
    });

    console.log(`\n✓ Release workflow triggered for ${tagName}`);
    console.log('\nMonitor progress:');
    console.log('  gh run watch');
    console.log('  gh run list --workflow=release.yml');
  } catch (error) {
    console.error('Failed to trigger workflow:', error.message);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
