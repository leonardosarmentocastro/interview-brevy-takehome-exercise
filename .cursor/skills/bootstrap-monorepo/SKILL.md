---
name: bootstrap-monorepo
description: >-
  Scaffold a fresh pnpm/turbo monorepo (Express API + Next.js web) that already
  follows this org's DDD/TDD working agreements. Use at the very start of a new
  project, before writing any feature code. Installs current dependencies within
  pinned majors, lays down the AGENTS.md hierarchy and glue, and verifies green.
---

# Bootstrap a patterns-compliant monorepo

Runs inside a **target repo** (may be empty or may already contain unrelated
files like `docs/`, `sample/`). **Strictly additive: never overwrite or delete
existing files.** If a path this skill would write already exists, stop and ask.

Let `KIT` = path to `agent-starter-kit`, `T` = target repo root (cwd).

## Pinned majors (bump only here)

- Root: `pnpm@9`, `turbo@2`
- API: `express@^5`, `zod@^4`, `cors@^2.8`, `dotenv@^17`, `tsx@^4`,
  `typescript@^5`, `vitest@^4`
- Web: `next@^16.2.0`, `react@^19.2.0`, `react-dom@^19.2.0`,
  `@tanstack/react-query@^5`, `react-hook-form@^7`, `@hookform/resolvers@^5`,
  `zod@^4`, `tailwindcss@^4`, `@testing-library/react@^16`,
  `@testing-library/jest-dom@^7`, `vitest@^4`, `jsdom@^29`
- DB (opt-in): `drizzle-orm@^0.45`, `drizzle-zod@^0.8`, `pg@^8`, `drizzle-kit@^0.31`

**Deliberate hold:** `typescript@^5` (not `latest`, which is `7.x` — the native
compiler rewrite). Hold until `tsx`/`eslint-config-next`/editor tooling certify
TS 7, then bump here.

Install the latest patch/minor within each major (`pnpm add pkg@major`). If a
generator's flags or output have shifted from what this skill describes, adapt —
the pins and the resulting file layout are the contract, not the exact commands.

## Steps

1. **Preflight.** Confirm `pnpm -v` (>=9) and `node -v`. `git status` to record
   what already exists so you can keep the write additive.

2. **Root workspace.** Copy `$KIT/glue/root/*` to `$T/` (rename `gitignore` →
   `.gitignore`; if `.gitignore` exists, append missing lines instead). Replace
   `REPLACE_ME` in `package.json` `name` with the target repo's directory name.
   Copy `$KIT/templates/AGENTS.md` and `$KIT/templates/CLAUDE.md` to `$T/`.
   Create `$T/docs/superpowers/{specs,plans}/` if absent.

3. **API app.** Create `$T/apps/api/`. Copy `$KIT/glue/api/**` into it. Then
   `cd apps/api` and install pinned deps:
   `pnpm add express@5 cors@2 dotenv@17 zod@4` and
   `pnpm add -D vitest@4 tsx@4 typescript@5 @types/express @types/cors @types/node`.
   Copy `$KIT/templates/apps/api/AGENTS.md` to `apps/api/AGENTS.md`.

4. **Web app.** Create `$T/apps/web/` with the current Next generator pinned to
   the major (e.g. `pnpm create next-app@16 apps/web --ts --app --no-src-dir` —
   adapt flags to the current generator). Then overlay `$KIT/glue/web/**`,
   preferring the glue versions of `tsconfig.json`, `next.config.ts`,
   `package.json` scripts/deps, and the `src/` files. `cd apps/web` and ensure
   the pinned web deps + testing libs are installed
   (`pnpm add -D vitest@4 jsdom@29 @testing-library/react@16 @testing-library/dom@10 @testing-library/jest-dom@7 @testing-library/user-event@14`).
   Copy `$KIT/templates/apps/web/AGENTS.md`, `apps/web/CLAUDE.md`, and
   `apps/web/src/modules/AGENTS.md` into place.

5. **Fan out skills.** For `provider` in `.claude .cursor`:
   `mkdir -p $T/$provider/skills && cp -R $KIT/skills/* $T/$provider/skills/`.
   (Per `$KIT/install.md`.)

6. **Install & verify green.** From `$T`: `pnpm install`, then `pnpm -r test`.
   Both the API (`GET /health`, error-handler branches) and web (`Counter`)
   suites must pass. Boot-check each app: `pnpm --filter api dev` responds on
   `/health`; `pnpm --filter web dev` serves the landing page. Report the actual
   test output — do not claim green without it.

7. **Hand off.** Summarize what was created and remind: DB is opt-in
   (`$KIT/glue/api-db-optional/`), and the first feature must start with a
   failing test per `AGENTS.md`.
