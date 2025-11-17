# SW Code Review Plugin

Comprehensive code and design review plugin for Claude Code that enforces pragmatic quality standards while maintaining development velocity.

## Overview

This plugin provides two specialized review workflows:

1. **Code Review** - Pragmatic Quality framework for technical excellence
2. **Design Review** - World-class UX/accessibility/visual design standards

## Commands

### `/review`

Conducts a comprehensive code review of pending changes using the Pragmatic Quality framework.

**Usage:**

```bash
/review
```

**What it does:**

- Analyzes git diff against origin/HEAD
- Reviews using hierarchical framework (Architecture → Security → Maintainability → Testing → Performance)
- Categorizes findings by priority (Critical, High, Medium, Nit)
- Presents actionable directives with engineering principles
- Allows interactive selection of issues to fix
- Implements selected changes automatically

**Review Focus Areas:**

- Architectural Design & Integrity
- Functionality & Correctness
- Security (XSS, SQLi, auth, secrets)
- Maintainability & Readability
- Testing Strategy & Robustness
- Performance & Scalability
- Dependencies & Documentation

### `/design-review`

Completes a design review of pending changes focusing on UX, accessibility, and visual design.

**Usage:**

```bash
/design-review
```

**What it does:**

- Analyzes git diff for front-end and UI changes
- Reviews against S-tier design standards (Stripe, Airbnb, Linear)
- Checks design system consistency, accessibility (WCAG AA+), and UX patterns
- **Optional:** Can test live UI with Playwright if local dev server is running
- Categorizes findings by priority
- Allows interactive selection of improvements
- Implements selected changes automatically

**Review Focus Areas:**

- Core Design Philosophy (Users First, Simplicity, Consistency)
- Design System Foundation (colors, typography, spacing, components)
- Layout & Visual Hierarchy
- Interaction Design & Animations
- Module-Specific Patterns (tables, forms, media)
- Accessibility & Performance

**Interactive Testing (Optional):**
If you have a local development server running, the command will ask if you want interactive Playwright testing:

- Visual screenshots of UI components
- Accessibility tree analysis (ARIA labels, semantic HTML)
- Keyboard navigation testing (Tab, Enter, Escape)
- Responsive behavior testing (different viewport sizes)
- Console error detection
- Interactive state verification (hover, focus, active)

## Agents

### `pragmatic-code-review`

Principal Engineer Reviewer specializing in balancing rigorous engineering standards with development speed.

**Model:** Sonnet
**Tools:** Bash, Glob, Grep, Read, Edit, Write, WebFetch, TodoWrite, WebSearch

**Philosophy:**

- Net Positive > Perfection
- Focus on Substance over Style
- Grounded in Engineering Principles (SOLID, DRY, KISS, YAGNI)
- Confidence-based reporting (only high-priority issues)

### `design-review`

Elite design review specialist with expertise in UX, visual design, accessibility, and front-end implementation.

**Model:** Sonnet
**Tools:** Bash, Glob, Grep, Read, Edit, Write, WebFetch, TodoWrite, WebSearch, Playwright (all browser automation tools)

**Philosophy:**

- Users First, Meticulous Craft
- Speed & Performance
- Simplicity & Clarity
- Accessibility (WCAG AA+)
- Consistency across design system

**Interactive Testing:**

- Can use Playwright for live UI/UX testing if local dev server is available
- Tests visual appearance, accessibility tree, keyboard navigation, responsive behavior
- Captures screenshots and console errors for comprehensive review

## Context Resources

### `ux-design-principles.md`

S-Tier design checklist inspired by top Silicon Valley companies. Includes:

- Core design philosophy and strategy
- Design system foundation (tokens, components)
- Layout and visual hierarchy guidelines
- Interaction design patterns
- Module-specific tactics (tables, forms, media)
- CSS architecture recommendations

## Workflow Examples

### Code Review Workflow

```bash
# Make changes to your codebase
git add .

# Run code review
/review

# Agent analyzes changes and presents findings grouped by priority
# User selects which issues to fix via interactive menu
# Claude implements selected fixes automatically
# Review summary shows files modified
```

### Design Review Workflow

```bash
# Make UI/UX changes
git add .

# Run design review
/design-review

# Agent analyzes changes against design principles
# User selects which improvements to implement
# Claude implements selected improvements automatically
# Review summary shows files modified
```

## Key Features

**Interactive Selection:** Both reviews use `AskUserQuestion` tool to present findings in an actionable format with multi-select options grouped by priority.

**Automatic Implementation:** After user selects items, Claude immediately implements the changes using Edit/Write tools.

**Confidence-Based Filtering:** Agents only report issues they're highly confident about (≥80% confidence) to minimize noise.

**Hierarchical Framework:** Issues are categorized by priority to help teams focus on what matters most:

- **Critical**: Must fix before merge
- **High Priority**: Fix to improve quality
- **Medium Priority**: Address in follow-up
- **Nit**: Minor polish, optional

**Principle-Driven Feedback:** Every directive explains the underlying engineering principle or design standard that motivates the change.

## Installation

This plugin is part of the cc-plugins marketplace.

```bash
cd /path/to/cc-plugins
# Use the plugin via slash commands
/review
/design-review
```

**Requirements:**

- **Code Review:** No additional dependencies
- **Design Review:** Requires Playwright MCP server for interactive testing (optional)
  - The plugin includes Playwright browser automation tools
  - Interactive testing is optional - diff-based review works without Playwright
  - For full interactive testing capability, ensure the testing-suite plugin with Playwright is available

## Best Practices

**When to use `/review`:**

- Before merging feature branches
- After implementing security-critical features
- After refactoring complex services
- When adding new API endpoints

**When to use `/design-review`:**

- After UI/UX changes
- Before launching new features with user-facing components
- When implementing design system components
- After accessibility improvements

**Maximizing Value:**

- Run reviews on logical chunks of work (complete features, not mid-implementation)
- Read through the full report before selecting items to implement
- Use Critical and High Priority findings as learning opportunities
- Reference the UX design principles doc when building new features

## Architecture

```
plugins/sw-code-review/
├── .claude-plugin/
│   └── plugin.json          # Plugin metadata
├── agents/
│   ├── pragmatic-code-review.md  # Code review agent
│   └── design-review.md          # Design review agent
├── commands/
│   ├── review.md                 # /review command
│   └── design-review.md          # /design-review command
├── context/
│   └── ux-design-principles.md   # Design standards reference
└── README.md                     # This file
```

## Version History

**1.0.0** (2025-01-16)

- Initial release
- Pragmatic code review with hierarchical framework
- Design review with S-tier standards
- Interactive issue selection and automatic implementation
- UX design principles context resource
