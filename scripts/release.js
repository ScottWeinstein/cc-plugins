#!/usr/bin/env node
// @ts-check

/**
 * Release script for cc-plugins
 *
 * Usage:
 *   node scripts/release.js [version]
 *
 * If version is not provided, it will prompt for it.
 * Version should follow semver (e.g., 0.1.0, 1.0.0, 1.2.3)
 *
 * This script:
 * 1. Validates the version
 * 2. Updates version in all package.json files
 * 3. Runs the build and checks
 * 4. Creates a git tag
 * 5. Pushes the tag (which triggers the release workflow)
 */

import { execSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";
import { createInterface } from "readline";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

function exec(cmd, options = {}) {
  console.log(`\n$ ${cmd}`);
  return execSync(cmd, {
    cwd: rootDir,
    stdio: "inherit",
    ...options,
  });
}

function execQuiet(cmd) {
  return execSync(cmd, { cwd: rootDir, encoding: "utf-8" }).trim();
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf-8"));
}

function writeJson(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
}

function validateVersion(version) {
  const semverRegex = /^\d+\.\d+\.\d+(-[\w.]+)?$/;
  if (!semverRegex.test(version)) {
    console.error(`Invalid version: ${version}`);
    console.error("Version must follow semver format (e.g., 0.1.0, 1.0.0-beta.1)");
    process.exit(1);
  }
  return version;
}

async function prompt(question) {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

function restorePackageFiles() {
  try {
    execSync("git checkout -- package.json plugins/wt-dev/package.json", {
      cwd: rootDir,
      stdio: "ignore",
    });
  } catch {
    console.error("Warning: Could not restore package.json files. Manual cleanup may be needed.");
  }
}

async function main() {
  // Check for clean working directory
  const status = execQuiet("git status --porcelain");
  if (status) {
    console.error("Working directory is not clean. Please commit or stash changes first.");
    console.error(status);
    process.exit(1);
  }

  // Check current branch
  const currentBranch = execQuiet("git rev-parse --abbrev-ref HEAD");
  if (currentBranch !== "main") {
    const proceed = await prompt(
      `Warning: You are on branch '${currentBranch}', not 'main'. Continue? (y/N): `
    );
    if (proceed.toLowerCase() !== "y") {
      console.log("Release cancelled.");
      process.exit(0);
    }
  }

  // Get version from args or prompt
  let version = process.argv[2];
  if (!version) {
    const currentVersion = readJson(join(rootDir, "package.json")).version;
    version = await prompt(`Enter new version (current: ${currentVersion}): `);
  }

  version = validateVersion(version);
  const tagName = `v${version}`;

  // Check if tag already exists
  try {
    execQuiet(`git rev-parse ${tagName}`);
    console.error(`Tag ${tagName} already exists. Please choose a different version.`);
    process.exit(1);
  } catch {
    // Tag doesn't exist, which is what we want
  }

  console.log(`\nPreparing release ${tagName}...\n`);

  // Update versions in package.json files
  const packageFiles = [
    join(rootDir, "package.json"),
    join(rootDir, "plugins/wt-dev/package.json"),
  ];

  for (const pkgPath of packageFiles) {
    const pkg = readJson(pkgPath);
    pkg.version = version;
    writeJson(pkgPath, pkg);
    console.log(`Updated ${pkgPath.replace(rootDir + "/", "")}`);
  }

  // Run checks - validate each step explicitly
  console.log("\nRunning checks...");
  try {
    exec("pnpm install");
    console.log("\nChecking formatting...");
    exec("pnpm run format:check");
    console.log("\nRunning linter...");
    exec("pnpm run lint");
    console.log("\nType checking...");
    exec("pnpm run typecheck");
  } catch {
    console.error("\nChecks failed. Please fix the issues before releasing.");
    restorePackageFiles();
    process.exit(1);
  }

  // Commit version bump with error handling
  try {
    exec(`git add package.json plugins/wt-dev/package.json`);
    exec(`git commit -m "chore: release ${tagName}"`);
  } catch {
    console.error("\nFailed to commit version bump.");
    restorePackageFiles();
    process.exit(1);
  }

  // Create tag with error handling
  try {
    exec(`git tag -a ${tagName} -m "Release ${tagName}"`);
  } catch {
    console.error(`\nFailed to create tag ${tagName}.`);
    console.error("The version commit was created. You may need to manually:");
    console.error("  1. Reset the commit: git reset --soft HEAD~1");
    console.error("  2. Restore files: git checkout -- package.json plugins/wt-dev/package.json");
    process.exit(1);
  }

  console.log(`\nRelease ${tagName} prepared successfully!`);
  console.log("\nTo complete the release, push the tag:");
  console.log(`  git push origin main --tags`);
  console.log("\nThis will trigger the GitHub Actions release workflow.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
