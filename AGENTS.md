# Monorepo — agent working agreements

These rules apply to **every** feature and bug fix in this repo (API and web).
App-specific conventions live in `apps/api/AGENTS.md` and `apps/web/AGENTS.md`.

## Feature branches

- **Always** create a dedicated feature branch before implementation work.
  Do not commit feature work directly on `master` / `main`.
- Name branches by intent, e.g. `feat/health-endpoint`, `fix/port-in-use`.
- Open the branch from an up-to-date base before the first implementation commit.
- Prefer small, frequent commits (one logical TDD cycle per commit is fine).

## Test-driven development (API and web)

- **Every behavior change is TDD** — backend and frontend.
- Vertical slices only: one failing test → minimal implementation → pass →
  commit. Do **not** write a bulk of tests first and implement afterward.
- Prefer tests that exercise public behavior (HTTP for the API; user-visible UI
  / schema contracts for the web) over tests coupled to private internals.
- Red → green → refactor. Never skip the failing-test step.
- Tests live in a `__tests__/` folder at the **same level as the file under
  test** — this is uniform across API and web.
- If the app under change has no test runner yet, add the minimal harness as
  part of the first TDD task for that app — do not ship untested logic.

## Specs and plans

- Approved designs live under `docs/superpowers/specs/`.
- Implementation plans live under `docs/superpowers/plans/`.
- Follow the plan task-by-task; keep the plan's Global Constraints aligned with
  this file.
