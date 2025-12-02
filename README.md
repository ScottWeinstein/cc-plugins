# cc-plugins

A Claude Code plugin marketplace containing custom plugins that extend Claude Code's capabilities.

## Plugins

### sw-feature-dev

A comprehensive 7-phase feature development workflow plugin that guides you through:

1. **Discovery** - Clarify requirements and constraints
2. **Codebase Exploration** - Understand existing patterns with parallel `code-explorer` agents
3. **Clarifying Questions** - Resolve ambiguities before design
4. **Architecture Design** - Multiple architectural approaches from `code-architect` agents
5. **Implementation** - Build the feature following chosen architecture
6. **Quality Review** - Parallel `code-reviewer` agents check for bugs and conventions
7. **Summary** - Document accomplishments and next steps

### wt-dev

Dev server and Inngest management CLI for multi-worktree projects:

- Hash-based port assignment for consistent dev server ports per worktree
- Shared Inngest server across worktrees
- Lock-based startup coordination
- Full CLI and programmatic API

## Installation

### Claude Code Plugins (Marketplace)

Install plugins directly from the marketplace:

```bash
claude plugins:add https://github.com/ScottWeinstein/cc-plugins
```

This gives you access to all plugins in the marketplace.

### wt-dev CLI (npm package)

Install from a GitHub release (no npm publish required):

```bash
# Install a specific version
pnpm add https://github.com/ScottWeinstein/cc-plugins/releases/download/v0.1.0/wt-dev.tgz
```

## Development

### Prerequisites

- Node.js >= 18
- pnpm >= 9

### Setup

```bash
pnpm install
pnpm build
```

### Scripts

| Script              | Description                              |
| ------------------- | ---------------------------------------- |
| `pnpm build`        | Build all packages                       |
| `pnpm typecheck`    | Type check all TypeScript                |
| `pnpm lint`         | Run ESLint                               |
| `pnpm format`       | Format code with Prettier                |
| `pnpm format:check` | Check code formatting                    |
| `pnpm check`        | Run all checks (format, lint, typecheck) |
| `pnpm release`      | Cut a new release                        |

### Project Structure

```
cc-plugins/
├── .claude-plugin/
│   └── marketplace.json     # Marketplace manifest
├── .github/workflows/
│   ├── ci.yml               # CI checks on push/PR
│   └── release.yml          # Release workflow on tags
├── plugins/
│   ├── sw-feature-dev/      # Feature development plugin (markdown-only)
│   │   ├── .claude-plugin/
│   │   │   └── plugin.json
│   │   ├── commands/
│   │   │   └── feature-dev.md
│   │   └── agents/
│   │       ├── code-explorer.md
│   │       ├── code-architect.md
│   │       └── code-reviewer.md
│   └── wt-dev/              # Dev server CLI plugin (TypeScript)
│       ├── .claude-plugin/
│       │   └── plugin.json
│       ├── src/
│       ├── skills/
│       └── package.json
├── scripts/
│   └── release.js           # Release automation script
├── package.json             # Workspace root
├── pnpm-workspace.yaml
└── CLAUDE.md                # Claude Code guidelines
```

## Versioning

This monorepo uses **unified versioning** - all packages share the same version number. When a release is created, both the root `package.json` and `plugins/wt-dev/package.json` are updated to the same version.

This approach:

- Simplifies the release process
- Ensures compatibility between packages
- Makes it easy to track which versions were released together

## Contributing

### Adding a New Plugin

1. Create directory: `plugins/<plugin-name>/`
2. Add `.claude-plugin/plugin.json` with metadata
3. Create `README.md` with documentation
4. Add commands in `commands/*.md` with YAML frontmatter
5. Add agents in `agents/*.md` with YAML frontmatter
6. Register in `.claude-plugin/marketplace.json`

For TypeScript plugins:

- Add `package.json` with build scripts
- Add `tsconfig.json` extending root config
- Update `pnpm-workspace.yaml` to include the package

### Making a Release

Releases are done via GitHub Actions to avoid direct commits to `main`.

```bash
pnpm release          # Bump patch: 0.1.1 → 0.1.2
pnpm release --minor  # Bump minor: 0.1.1 → 0.2.0
pnpm release --major  # Bump major: 0.1.1 → 1.0.0
pnpm release --dry-run  # Preview without triggering
```

The release workflow will:

- Run all checks and tests
- Update version in all `package.json` files
- Commit and tag the release
- Push to `main`
- Create a GitHub release with artifacts

Requires [GitHub CLI](https://cli.github.com/) (`gh`) to be installed and authenticated.

## License

MIT
