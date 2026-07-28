# `GET /issues` filtering + `GET /issues/:id` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add status filtering to `GET /issues` and a `GET /issues/:id` endpoint that resolves an issue by either its uuid or its `external_id`.

**Architecture:** Both are read-only additions to the existing `issues` module. Filtering is a Zod-validated query schema feeding an `inArray` where-clause in the repository; single-fetch branches on whether `:id` is uuid-shaped (query `id`) or not (query `external_id`). No schema/enum migration — the `status` enum (`pending | processing | resolved | escalated`) is untouched.

**Tech Stack:** TypeScript, Express 5, Drizzle ORM (Postgres), Zod 4, Vitest.

## Global Constraints

- **TDD is mandatory** — one failing test → minimal implementation → pass → commit. Never skip the failing-test step. (root `AGENTS.md`)
- **Tests exercise the module through HTTP** (the real contract), live in `src/modules/issues/__tests__/`, and start from a **pristine DB** (a global `beforeEach` truncates tables; assertions may assume an empty table). Direct DB access is allowed only to *arrange* state, never to assert. (`apps/api/AGENTS.md`)
- **Resolvers** are Express handlers `(req, res, next) => Promise<void>`; one per operation, one file `<verb>-<noun>-resolver.ts` exporting `<verb><Noun>Resolver`; always `try/catch` → `next(err)`; **never translate errors inline** — the central handler owns status mapping (`NotFoundError` → 404, `ZodError` → 400). (`apps/api/AGENTS.md`)
- **All data access goes through `repository.ts`** — resolvers never build queries or import the db client directly. (`apps/api/AGENTS.md`)
- **Zod 4**: use the top-level format API `z.uuid()`, not the deprecated `z.string().uuid()`.
- **Keep the current 4-value `status` enum** — no lane/team axis, no migration.
- **List ordering** stays `orderBy(desc(issues.ingestedAt))` (newest-first), filtered or not.

**Prerequisite for running tests:** Postgres must be up. From `apps/api/`, run `pnpm db:up` once (idempotent). All test commands below are run from `apps/api/`.

---

### Task 1: Status filtering on `GET /issues`

**Files:**
- Modify: `apps/api/src/modules/issues/types.ts` (add `IssueStatus`)
- Modify: `apps/api/src/modules/issues/schema.ts` (add `listIssuesQuerySchema`)
- Modify: `apps/api/src/modules/issues/repository.ts` (`list` gains a filter arg)
- Modify: `apps/api/src/modules/issues/resolvers/list-issues-resolver.ts` (parse query)
- Test: `apps/api/src/modules/issues/__tests__/list-issues.api.test.ts` (extend)

**Interfaces:**
- Consumes: existing `issues` table (`model.ts`), `IssueRow` (`types.ts`), `issuesRepository` (`repository.ts`), fixtures `declineBody` / `missedInstallmentBody` / `postIssue`.
- Produces:
  - `IssueStatus = IssueRow["status"]` (union `"pending" | "processing" | "resolved" | "escalated"`).
  - `listIssuesQuerySchema` — parses `req.query`; `.parse()` returns `{ status?: IssueStatus[] }` (comma-split, each validated; throws `ZodError` on any invalid/empty value).
  - `issuesRepository.list(filters?: { statuses?: IssueStatus[] }): Promise<IssueRow[]>` — filters via `inArray` when `statuses` is non-empty; ordering unchanged.

- [ ] **Step 1: Write the failing tests**

Append these cases inside the existing `describe("GET /issues", …)` block in `apps/api/src/modules/issues/__tests__/list-issues.api.test.ts`. Also add the three imports at the top of the file (below the existing imports).

```ts
// add to the top-of-file imports:
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { issues } from "@/modules/issues/model";
```

```ts
  it("filters by a single status", async () => {
    await postIssue(base, declineBody); // iss_001, defaults to `pending`
    const resolved = await (
      await fetch(`${base}/issues?status=resolved`)
    ).json();
    expect(resolved).toEqual([]);
    const pending = await (await fetch(`${base}/issues?status=pending`)).json();
    expect(pending).toHaveLength(1);
    expect(pending[0].externalId).toBe("iss_001");
  });

  it("filters by comma-separated statuses (union)", async () => {
    await postIssue(base, declineBody); // iss_001, pending
    await postIssue(base, missedInstallmentBody); // iss_002, pending
    // Arrange only: no HTTP path sets status yet, so flip one row directly.
    await db
      .update(issues)
      .set({ status: "processing" })
      .where(eq(issues.externalId, "iss_002"));

    const both = await (
      await fetch(`${base}/issues?status=pending,processing`)
    ).json();
    expect(both).toHaveLength(2);

    const onlyProcessing = await (
      await fetch(`${base}/issues?status=processing`)
    ).json();
    expect(onlyProcessing.map((i: { externalId: string }) => i.externalId)).toEqual([
      "iss_002",
    ]);
  });

  it("rejects an unknown status value (400)", async () => {
    const res = await fetch(`${base}/issues?status=banana`);
    expect(res.status).toBe(400);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test src/modules/issues/__tests__/list-issues.api.test.ts`
Expected: FAIL — `?status=resolved` returns the pending row instead of `[]`, and `?status=banana` returns `200` instead of `400` (the resolver still ignores the query).

- [ ] **Step 3: Add the `IssueStatus` type**

In `apps/api/src/modules/issues/types.ts`, add below the existing exports:

```ts
export type IssueStatus = IssueRow["status"];
```

- [ ] **Step 4: Add `listIssuesQuerySchema`**

In `apps/api/src/modules/issues/schema.ts`, add the import at the top and the schema at the bottom of the file:

```ts
import { issueStatus } from "@/modules/issues/model";
```

```ts
// GET /issues?status=pending,processing — comma-separated, each value must be a
// known status. Absent -> no filter; empty or unknown value -> ZodError (400).
// Enum values are derived from the model so the two can't drift.
export const listIssuesQuerySchema = z.object({
  status: z
    .string()
    .transform((s) => s.split(","))
    .pipe(z.array(z.enum(issueStatus.enumValues)).nonempty())
    .optional(),
});

export type ListIssuesQuery = z.infer<typeof listIssuesQuerySchema>;
```

- [ ] **Step 5: Filter in the repository**

In `apps/api/src/modules/issues/repository.ts`, extend the drizzle import and replace the `list` method. Also import `IssueStatus`.

Change the imports at the top:

```ts
import { desc, inArray } from "drizzle-orm";
```

```ts
import type { IssueRow, IssueStatus } from "@/modules/issues/types";
```

Replace the existing `list` method with:

```ts
  async list(filters?: { statuses?: IssueStatus[] }): Promise<IssueRow[]> {
    // `.where(undefined)` is a drizzle no-op, so an absent/empty filter lists all.
    const where = filters?.statuses?.length
      ? inArray(issues.status, filters.statuses)
      : undefined;
    return db
      .select()
      .from(issues)
      .where(where)
      .orderBy(desc(issues.ingestedAt));
  },
```

- [ ] **Step 6: Parse the query in the resolver**

Replace the entire contents of `apps/api/src/modules/issues/resolvers/list-issues-resolver.ts`:

```ts
import type { Request, Response, NextFunction } from "express";
import { listIssuesQuerySchema } from "@/modules/issues/schema";
import { issuesRepository } from "@/modules/issues/repository";

export const listIssuesResolver = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { status } = listIssuesQuerySchema.parse(req.query);
    res.status(200).json(await issuesRepository.list({ statuses: status }));
  } catch (err) {
    next(err);
  }
};
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `pnpm test src/modules/issues/__tests__/list-issues.api.test.ts`
Expected: PASS (all cases, including the pre-existing empty-array and newest-first tests).

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/modules/issues/types.ts \
        apps/api/src/modules/issues/schema.ts \
        apps/api/src/modules/issues/repository.ts \
        apps/api/src/modules/issues/resolvers/list-issues-resolver.ts \
        apps/api/src/modules/issues/__tests__/list-issues.api.test.ts
git commit -m "feat(api): status filtering on GET /issues"
```

---

### Task 2: `GET /issues/:id` (by uuid or external_id)

**Files:**
- Modify: `apps/api/src/modules/issues/repository.ts` (add `findByIdOrExternalId`)
- Create: `apps/api/src/modules/issues/resolvers/get-issue-resolver.ts`
- Modify: `apps/api/src/modules/issues/resolvers/index.ts` (export the new resolver)
- Modify: `apps/api/src/modules/issues/routes.ts` (mount `GET /:id`)
- Test: `apps/api/src/modules/issues/__tests__/get-issue.api.test.ts` (create)

**Interfaces:**
- Consumes: `issuesRepository`, `IssueRow`, `NotFoundError` (`@/db/data/errors`), fixtures `declineBody` / `postIssue`, `startServer` / `stopServer` (`@test/helpers`).
- Produces:
  - `issuesRepository.findByIdOrExternalId(idOrExternalId: string): Promise<IssueRow | undefined>` — uuid-shaped → query `id`; otherwise → query `external_id`.
  - `getIssueResolver` — mounted at `GET /issues/:id`; `200` with the row, or throws `NotFoundError` → `404`.

- [ ] **Step 1: Write the failing tests**

Create `apps/api/src/modules/issues/__tests__/get-issue.api.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import { startServer, stopServer } from "@test/helpers";
import { declineBody, postIssue } from "./fixtures";

describe("GET /issues/:id", () => {
  let server: Server;
  let base: string;
  beforeAll(async () => {
    ({ server, base } = await startServer());
  });
  afterAll(async () => {
    await stopServer(server);
  });

  it("fetches an issue by its uuid (200)", async () => {
    const created = await (await postIssue(base, declineBody)).json();
    const res = await fetch(`${base}/issues/${created.id}`);
    expect(res.status).toBe(200);
    expect((await res.json()).externalId).toBe("iss_001");
  });

  it("fetches an issue by its external_id (200)", async () => {
    await postIssue(base, declineBody); // external_id iss_001
    const res = await fetch(`${base}/issues/iss_001`);
    expect(res.status).toBe(200);
    expect((await res.json()).externalId).toBe("iss_001");
  });

  it("returns 404 for an unknown external_id", async () => {
    const res = await fetch(`${base}/issues/iss_999`);
    expect(res.status).toBe(404);
  });

  it("returns 404 for an unknown (well-formed) uuid", async () => {
    const res = await fetch(
      `${base}/issues/00000000-0000-0000-0000-000000000000`,
    );
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test src/modules/issues/__tests__/get-issue.api.test.ts`
Expected: FAIL — no `GET /:id` route is mounted, so requests return `404` for the wrong reason on the success cases (the `200` assertions fail).

- [ ] **Step 3: Add `findByIdOrExternalId` to the repository**

In `apps/api/src/modules/issues/repository.ts`, add `eq` to the drizzle import, import `z`, and add the method. Update imports:

```ts
import { desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
```

Add this method to the `issuesRepository` object (e.g. after `list`):

```ts
  async findByIdOrExternalId(
    idOrExternalId: string,
  ): Promise<IssueRow | undefined> {
    // A uuid-shaped param is our PK; anything else is the upstream external_id.
    // We must branch BEFORE querying: comparing a non-uuid value against the
    // uuid `id` column makes Postgres raise an invalid-input-syntax error.
    const isUuid = z.uuid().safeParse(idOrExternalId).success;
    const where = isUuid
      ? eq(issues.id, idOrExternalId)
      : eq(issues.externalId, idOrExternalId);
    const [found] = await db.select().from(issues).where(where);
    return found;
  },
```

- [ ] **Step 4: Create the resolver**

Create `apps/api/src/modules/issues/resolvers/get-issue-resolver.ts`:

```ts
import type { Request, Response, NextFunction } from "express";
import { issuesRepository } from "@/modules/issues/repository";
import { NotFoundError } from "@/db/data/errors";

export const getIssueResolver = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const found = await issuesRepository.findByIdOrExternalId(req.params.id);
    if (!found) throw new NotFoundError(`issue ${req.params.id} not found`);
    res.status(200).json(found);
  } catch (err) {
    next(err);
  }
};
```

- [ ] **Step 5: Export the resolver from the barrel**

Add to `apps/api/src/modules/issues/resolvers/index.ts`:

```ts
export * from "@/modules/issues/resolvers/get-issue-resolver";
```

- [ ] **Step 6: Mount the route**

In `apps/api/src/modules/issues/routes.ts`, add the `GET /:id` route **after** the `GET /` route so `/issues` is not captured by `/:id`:

```ts
issuesRouter.get("/:id", resolvers.getIssueResolver);
```

The file should now read:

```ts
import { Router } from "express";
import * as resolvers from "@/modules/issues/resolvers";

export const issuesRouter = Router();

issuesRouter.post("/", resolvers.createIssueResolver);
issuesRouter.get("/", resolvers.listIssuesResolver);
issuesRouter.get("/:id", resolvers.getIssueResolver);
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `pnpm test src/modules/issues/__tests__/get-issue.api.test.ts`
Expected: PASS (all four cases).

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/modules/issues/repository.ts \
        apps/api/src/modules/issues/resolvers/get-issue-resolver.ts \
        apps/api/src/modules/issues/resolvers/index.ts \
        apps/api/src/modules/issues/routes.ts \
        apps/api/src/modules/issues/__tests__/get-issue.api.test.ts
git commit -m "feat(api): GET /issues/:id by uuid or external_id"
```

---

### Task 3: Full-suite green + lint

**Files:** none (verification only).

- [ ] **Step 1: Run the full API test suite**

Run: `pnpm test`
Expected: PASS — every file, including `create-issue.api.test.ts`, `list-issues.api.test.ts`, `get-issue.api.test.ts`, `schema.test.ts`, `normalizer.test.ts`, and the db/middleware suites. (DB-backed files run serially per `vitest.config.ts`.)

- [ ] **Step 2: Typecheck**

Run: `pnpm lint`
Expected: PASS — no `tsc` errors.

- [ ] **Step 3: Commit only if Steps 1–2 surfaced fixes**

If the full run required any change, commit it; otherwise skip.

```bash
git commit -am "test(api): green suite for issues read slice"
```

---

## Notes for the implementer

- **`z.array(...).nonempty()`** makes `?status=` (empty string → `[""]` → fails the enum) and any unknown value throw `ZodError`, which the central error handler maps to `400`. No manual status-checking in the resolver.
- **`issueStatus.enumValues`** is drizzle's readonly tuple of the enum members; feeding it to `z.enum` keeps the query validator and the DB enum from drifting.
- **`.where(undefined)`** is a genuine drizzle no-op — that's why an absent filter lists everything without a branch in the query chain itself.
- Do **not** attempt an `id = $1 OR external_id = $1` single query: when `$1` is `iss_001`, Postgres tries to cast it to `uuid` for the `id` side and errors. Branch on shape first (Task 2, Step 3).
