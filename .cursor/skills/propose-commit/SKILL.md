---
name: propose-commit
description: >-
  Propose one or more scoped git commits (message + file list) after finishing
  an issue or implementation slice. Use when wrapping up work, before committing,
  when the working tree has grown mixed changes, or when the user asks to commit
  / propose a commit message / split commits.
---

# Propose commit(s)

When finishing an implementation slice, **do not** blindly stage everything.
Inspect the working tree, group related changes, and **propose** commit(s) for
user confirmation before running `git commit` (unless they already named an
exact slice to commit).

## When to run

- User finishes an issue / feature slice / bug fix
- User says commit, wrap up, or asks for a commit message
- Working tree has files from more than one logical change

## Workflow

1. **Inspect** (parallel):
   - `git status`
   - `git diff` and `git diff --staged`
   - `git log -5 --oneline` (match repo message style)

2. **Partition** unstaged/untracked/staged files into **logical slices**.
   A slice is one intent (one reason to revert). Prefer small commits.

   Typical split axes:
   - app boundary (`apps/api` vs `apps/web`)
   - concern (feat / fix / refactor / test / docs / style)
   - leftovers that are not part of the slice → **exclude** or call out
     separately; never bury in a feature commit

3. **Respect ignore rules for generated output**
   - Do not stage paths covered by `.gitignore` (or equivalent).
   - If a *tracked* file clearly belongs under an ignored generated tree
     (build output, regenerated docs site, etc.), exclude it from feature
     commits and propose a separate `chore` to `git rm --cached` so ignore
     can take effect — do not hardcode specific filenames in this skill.
   - Prefer fixing tracking/ignore over teaching the agent one-off exceptions.

4. **Propose** to the user (do not commit yet unless they already scoped it):

```markdown
### Proposed commits

**1. `<type>(<scope>): <summary>`**
- why: <one line>
- files:
  - `path/a`
  - `path/b`

**2. …**

**Excluded**
- `path` — <reason>

Reply with which to commit (e.g. “1 and 2”, “only 1”, or adjust).
```

5. **Message style** (match repo `git log`):
   - Conventional Commits: `type(scope): summary`
   - Summary focuses on **why**; body only if needed (1–2 short sentences)
   - Types seen here: `feat`, `fix`, `refactor`, `style`, `test`, `docs`, `chore`

6. **After approval**, commit each approved slice separately:
   - Stage only that slice’s files
   - Commit via HEREDOC (no `--no-verify` unless asked)
   - `git status` after each commit

## Anti-patterns

- One mega-commit mixing API docs, web UI, and test-only refactors
- Staging generated / ignored output with feature code
- Writing the message before inspecting the full diff
- Committing without proposing when the tree clearly has multiple intents

## Quick heuristic

If you need “and” to describe the commit, split it.
