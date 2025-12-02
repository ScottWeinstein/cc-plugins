# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Structure

This is a Claude Code plugin marketplace repository containing custom plugins that extend Claude Code's capabilities.

**Core files:**

- `.claude-plugin/marketplace.json`: Marketplace manifest defining available plugins
- `plugins/`: Directory containing individual plugin implementations

**Current plugins:**

- `sw-feature-dev`: Comprehensive feature development workflow with 7-phase guided process

## Plugin Structure

Each plugin lives in `plugins/<plugin-name>/` with:

- `.claude-plugin/plugin.json`: Plugin metadata (name, version, description, author)
- `README.md`: User-facing documentation
- `commands/*.md`: Slash command definitions (frontmatter + prompt)
- `agents/*.md`: Agent definitions (frontmatter with tools, model, color + prompt)

### Frontmatter Requirements

**Slash commands** (`commands/*.md`):

```yaml
---
description: Brief description shown in command list
argument-hint: Optional hint text (e.g., "Optional feature description")
---
```

**Agents** (`agents/*.md`):

```yaml
---
name: agent-name
description: Brief description of agent purpose
tools: Comma-separated list (e.g., Glob, Grep, Read, Write)
model: sonnet | opus | haiku
color: yellow | red | green | blue | etc.
---
```

## sw-feature-dev Plugin Architecture

The `sw-feature-dev` plugin implements a 7-phase feature development workflow with three specialized agents.

### The 7 Phases

1. **Discovery**: Clarify feature requirements and constraints
2. **Codebase Exploration**: Launch 2-3 `code-explorer` agents in parallel to understand existing patterns
3. **Clarifying Questions**: Use AskUserQuestion tool to resolve all ambiguities before design
4. **Architecture Design**: Launch 2-3 `code-architect` agents with different focuses (minimal changes, clean architecture, pragmatic balance)
5. **Implementation**: Build feature following chosen architecture
6. **Quality Review**: Launch 2-3 `code-reviewer` agents to check simplicity, bugs, and conventions
7. **Summary**: Document accomplishments and next steps

### Agent Responsibilities

**code-explorer**: Traces execution paths, maps architecture layers, identifies patterns. Returns list of 5-10 essential files to read. Used in Phase 2.

**code-architect**: Analyzes codebase patterns, makes architectural decisions, produces implementation blueprints with specific files/components/data flows. Used in Phase 4.

**code-reviewer**: Reviews for project guidelines (CLAUDE.md), bugs, and quality issues. Uses confidence-based filtering (≥80 confidence). Only reports high-priority issues. Used in Phase 6.

### Critical Design Patterns

**MANDATORY AskUserQuestion tool usage**: The `/feature-dev` command MUST use AskUserQuestion tool (not plain text) when asking questions. Key usage points:

- Phase 3: All clarifying questions
- Phase 4: Architectural priorities (multiSelect: true), approach selection (single select)
- Phase 6: Review focus areas (multiSelect: true), how to proceed with findings (single select)

**Agent parallelization**: Launch multiple agents in Phase 2, 4, and 6 using parallel tool calls in a single message.

**File reading after agents**: After agents return, explicitly read all files they identified as essential.

**TodoWrite usage**: Track all 7 phases and update progress throughout.

## Development Commands

### Testing Plugin Locally

```bash
# Link plugin for local development
cd /home/sw/cc-plugins
# Use the plugin via slash command
/feature-dev <optional feature description>
```

### Marketplace Structure

The `.claude-plugin/marketplace.json` follows this schema:

```json
{
  "name": "marketplace-id",
  "displayName": "Human Readable Name",
  "description": "Description of marketplace",
  "plugins": [
    {
      "name": "plugin-id",
      "path": "plugins/plugin-directory"
    }
  ]
}
```

## Design Principles

**Structured workflows over ad-hoc**: Plugins guide users through systematic processes with clear phases.

**Agent specialization**: Each agent has a narrow, well-defined purpose with specific tools and prompts.

**Confidence-based filtering**: Code reviewers only report issues ≥80% confidence to minimize noise.

**Read before act**: Agents return file lists; main workflow reads files before making decisions.

**Interactive decision points**: Use AskUserQuestion at key decision points (architecture selection, review handling) rather than making assumptions.

**Parallel execution**: Launch independent agents in parallel to maximize efficiency.

## Adding New Plugins

1. Create directory: `plugins/<plugin-name>/`
2. Add `.claude-plugin/plugin.json` with metadata
3. Create `README.md` with user documentation
4. Add commands in `commands/*.md` with frontmatter
5. Add agents in `agents/*.md` with frontmatter
6. Register in `marketplace.json`

## Common Patterns

**Agent prompts**: Start with role/expertise statement, provide structured process sections, include output guidance with specific deliverables.

**Command prompts**: Define phases clearly, specify tool requirements (TodoWrite, AskUserQuestion), indicate when to wait for user input.

**Tool access**: Agents typically get: Glob, Grep, LS, Read, NotebookRead, WebFetch, TodoWrite, WebSearch, KillShell, BashOutput. Avoid giving agents Write/Edit to prevent unintended modifications.

**Model selection**: Use `sonnet` for agents requiring deep analysis, `haiku` for simple tasks.
