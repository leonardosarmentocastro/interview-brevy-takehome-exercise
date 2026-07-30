# Handoff Prompt — Role Selection & Admin Identity (inline execution in Cursor)

Paste the block below into Cursor to execute the plan inline, task by task.

---

You are implementing a committed plan in this repo (a static vanilla-JS prototype under `sample/`). Execute it INLINE, task by task, using strict TDD.

PLAN:  docs/superpowers/plans/2026-07-26-role-selection-admin-identity.md
SPEC:  docs/superpowers/specs/2026-07-26-role-selection-admin-identity-design.md

Read both fully before writing any code. The plan has 3 tasks with exact file paths, code, and test code — follow them verbatim; do not improvise alternatives.

HOW TO EXECUTE
- Do the tasks in order (1 → 2 → 3). Each task is a full cycle: write the failing test → run it and confirm it fails → write the minimal implementation → run it and confirm it passes → commit.
- Commit after every task using the exact conventional-commit message given in that task's final step. One commit per task — the commit is the checkpoint.
- After each task that touches JS, run the full suite and confirm green before moving on:
      cd sample && npm test        (alias for `node --test`)
  Focused run for the new tests:
      cd sample && node --test tests/shell.test.js

REPO CONVENTIONS (do not deviate)
- Render functions return HTML strings; tests are node:test + node:assert with substring assertions (assert.match). Match the existing pattern in sample/lib/*.js and sample/tests/*.
- Dark theme only. Reuse the existing tokens from sample/styles.css (--bg --col --col2 --line --tx --tx2 --tx3 --ok --warn --bad --info --mono). Do NOT redefine :root.
- Do NOT refactor or "improve" existing operator/monitor/specialist code beyond the exact edits the plan names. No dependencies, no build step.

TASKS 2 & 3 ARE VISUAL (no DOM unit tests in this repo)
- Verify by serving the app: from the repo root run `python3 -m http.server 8000`, then open http://localhost:8000/sample/ and check the behaviour described in each task's "serve and verify" step.
- The node tests still guard against import/typo regressions, so run `cd sample && npm test` after Tasks 2 and 3 as well.

ONE STEP TO EYEBALL CAREFULLY (Task 2)
- Task 2 stops applying the `specialist-mode` full-viewport class so the specialist board flows in the shared `.wrap` width like the other two boards. This deliberately trades the specialist board's per-column independent scroll for normal page scroll — that is the intended fix for the "specialist board is fullscreen, the others aren't" discrepancy (spec §4/§7). After the change, load the specialist board AND a specialist case view in the browser and confirm they render acceptably in normal flow (header on top, contained width, page scrolls). If a base style breaks, adjust minimally to restore a clean layout — do not re-enable full-viewport mode.

DEFINITION OF DONE
- All 3 tasks committed with their exact messages.
- `cd sample && npm test` is green.
- In the browser: the role modal shows on arrival over a blurred virtual-agent board; only Admin is clickable; picking Admin lands on the virtual-agent view; every board shows the shared header (eyebrow + per-board title + ADM chip); clicking the ADM chip re-opens the modal; the specialist board renders at the shared width.

Report back after each task with the commit hash and the test result before continuing to the next.
