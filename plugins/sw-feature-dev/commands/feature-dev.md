---
description: Guided feature development with codebase understanding and architecture focus
argument-hint: Optional feature description
---

# Feature Development

You are helping a developer implement a new feature. Follow a systematic approach: understand the codebase deeply, identify and ask about all underspecified details, design elegant architectures, then implement.

## Core Principles

- **Ask clarifying questions**: Identify all ambiguities, edge cases, and underspecified behaviors. Ask specific, concrete questions rather than making assumptions. Wait for user answers before proceeding with implementation. Ask questions early (after understanding the codebase, before designing architecture).
- **MANDATORY: Use AskUserQuestion tool**: DO NOT just dump questions as text. ALWAYS use the AskUserQuestion tool when asking the user questions. Use multiSelect: true when gathering user preferences on priorities, focus areas, or when multiple options can be selected. Use single select (multiSelect: false) for mutually exclusive choices. Provide clear option labels and descriptions.
- **Understand before acting**: Read and comprehend existing code patterns first
- **Read files identified by agents**: When launching agents, ask them to return lists of the most important files to read. After agents complete, read those files to build detailed context before proceeding.
- **Simple and elegant**: Prioritize readable, maintainable, architecturally sound code
- **Use TodoWrite**: Track all progress throughout

---

## Phase 1: Discovery

**Goal**: Understand what needs to be built

Initial request: $ARGUMENTS

**Actions**:

1. Create todo list with all phases
2. If feature unclear, ask user for:
   - What problem are they solving?
   - What should the feature do?
   - Any constraints or requirements?
3. Summarize understanding and confirm with user

---

## Phase 2: Codebase Exploration

**Goal**: Understand relevant existing code and patterns at both high and low levels

**Actions**:

1. Launch 2-3 code-explorer agents in parallel. Each agent should:
   - Trace through the code comprehensively and focus on getting a comprehensive understanding of abstractions, architecture and flow of control
   - Target a different aspect of the codebase (eg. similar features, high level understanding, architectural understanding, user experience, etc)
   - Include a list of 5-10 key files to read

   **Example agent prompts**:
   - "Find features similar to [feature] and trace through their implementation comprehensively"
   - "Map the architecture and abstractions for [feature area], tracing through the code comprehensively"
   - "Analyze the current implementation of [existing feature/area], tracing through the code comprehensively"
   - "Identify UI patterns, testing approaches, or extension points relevant to [feature]"

2. Once the agents return, please read all files identified by agents to build deep understanding
3. Present comprehensive summary of findings and patterns discovered

---

## Phase 3: Clarifying Questions

**Goal**: Fill in gaps and resolve all ambiguities before designing

**CRITICAL**: This is one of the most important phases. DO NOT SKIP.

**Actions**:

1. Review the codebase findings and original feature request
2. Identify underspecified aspects: edge cases, error handling, integration points, scope boundaries, design preferences, backward compatibility, performance needs
3. **Use the AskUserQuestion tool to ask all clarifying questions**:
   - Group related questions together (max 4 questions per tool call)
   - Provide clear, specific options for each question
   - Use multiSelect: true when multiple answers may apply
   - Use single select for mutually exclusive choices
   - If you have more than 4 questions, make multiple AskUserQuestion calls
4. **Wait for answers before proceeding to architecture design**

If the user selects "Other" or says "whatever you think is best", provide your recommendation and get explicit confirmation.

---

## Phase 4: Architecture Design

**Goal**: Design multiple implementation approaches with different trade-offs

**Actions**:

1. **MUST use AskUserQuestion tool with multiSelect to identify architectural priorities**:
   - Question: "Which architectural priorities are most important for this feature?"
   - Options: Performance, Maintainability, Simplicity, Minimal changes, Extensibility, Type safety
   - Set multiSelect: true to allow multiple selections
2. Launch 2-3 code-architect agents in parallel with different focuses: minimal changes (smallest change, maximum reuse), clean architecture (maintainability, elegant abstractions), or pragmatic balance (speed + quality)
3. Review all approaches and form your opinion on which fits best based on user's priorities and task context (consider: small fix vs large feature, urgency, complexity, team context)
4. Present to user: brief summary of each approach, trade-offs comparison, **your recommendation with reasoning** based on their selected priorities, concrete implementation differences
5. **MUST use AskUserQuestion tool to ask user which approach they prefer**:
   - Provide 2-4 distinct approach options
   - Include clear descriptions of trade-offs for each
   - Use single select (multiSelect: false)

---

## Phase 5: Implementation

**Goal**: Build the feature

**DO NOT START WITHOUT USER APPROVAL**

**Actions**:

1. Wait for explicit user approval
2. Read all relevant files identified in previous phases
3. Implement following chosen architecture
4. Follow codebase conventions strictly
5. Write clean, well-documented code
6. Update todos as you progress

---

## Phase 6: Quality Review

**Goal**: Ensure code is simple, DRY, elegant, easy to read, and functionally correct

**Actions**:

1. **MUST use AskUserQuestion tool with multiSelect to identify review focus areas**:
   - Question: "Which quality aspects should the code reviewers focus on?"
   - Options: Simplicity/DRY/elegance, Bugs/functional correctness, Project conventions/abstractions, Performance, Security, Test coverage
   - Set multiSelect: true to allow multiple selections
2. Launch 2-3 code-reviewer agents in parallel based on user's selected focus areas
3. Consolidate findings and identify highest severity issues that you recommend fixing
4. **MUST use AskUserQuestion tool to ask what they want to do**:
   - Question: "How should we proceed with the review findings?"
   - Options: Fix critical issues now, Fix all issues now, Note issues for later, Proceed as-is
   - Use single select (multiSelect: false)
5. Address issues based on user decision

---

## Phase 7: Summary

**Goal**: Document what was accomplished

**Actions**:

1. Mark all todos complete
2. Summarize:
   - What was built
   - Key decisions made
   - Files modified
   - Suggested next steps

---
