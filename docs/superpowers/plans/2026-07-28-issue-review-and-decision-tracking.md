# Issue Review + Decision Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `POST /issues/:id/review` (human review decision) plus persistence for status history and decisions, and make the recorded audit trail readable via `GET /issues/:id`.

**Architecture:** Two new append-only tables (`issue_status_history`, `issue_decisions`) alongside the existing `issues` table; an `on_hold` status; a pure transition state machine (`nextStatusFor`) enforced by the review resolver; a transactional `recordReview` repository method that writes the decision, the status-history row, and the status flip atomically. The chronological timeline is derived on read, never stored.

**Tech Stack:** TypeScript, Express 5, Drizzle ORM + `node-postgres`, Zod 4, Vitest 4, Postgres (docker).

## Global Constraints

- **TDD is mandatory** — one failing test → minimal implementation → pass → commit. Never skip the failing-test step. (root `AGENTS.md`)
- **Feature branch:** all work on `feat/issue-review-and-decision-tracking` (already created); never commit on `main`.
- **Tests exercise the HTTP surface** (the real contract), except pure logic which is unit-tested directly. Tests live in `__tests__/` beside the file under test. (`apps/api/AGENTS.md`)
- **Every test starts from a pristine DB** — the `beforeEach` truncate hook in `test/setup.ts` must cover every table. DB-backed files run serially.
- **Resolver pattern:** a resolver is an Express handler; validate body inline, call the repository, apply domain rules (throw domain errors), wrap in `try/catch` and forward via `next(err)`. Never translate errors inline.
- **Data access only through `repository.ts`** — resolvers never build queries or import the client.
- **Error mapping (central handler, already wired):** `ZodError`/malformed JSON → 400, `NotFoundError` → 404, `ConflictError` → 409, else 500.
- **Run tests from `apps/api`:** `pnpm test` (vitest defaults `DATABASE_URL` to `postgres://brevy:brevy@localhost:5432/brevy_test`). Postgres must be running: `pnpm db:up` first.
- **Spec:** `docs/superpowers/specs/2026-07-28-issue-review-and-decision-tracking-design.md`.

---

## File Structure

- `src/modules/issues/model.ts` — MODIFY: add `on_hold` to `issueStatus`; add `decisionActor` enum, `issueDecisions` and `issueStatusHistory` tables.
- `src/modules/issues/types.ts` — MODIFY: add `DecisionRow`, `StatusHistoryRow` inferred types.
- `src/modules/issues/state-machine.ts` — CREATE: `REVIEW_DECISIONS`, `ReviewDecision`, `nextStatusFor`.
- `src/modules/issues/timeline.ts` — CREATE: `TimelineEntry`, `mergeTimeline`.
- `src/modules/issues/schema.ts` — MODIFY: add `reviewIssueSchema` + `ReviewIssueInput`.
- `src/modules/issues/repository.ts` — MODIFY: `create` writes intake history row; add `listStatusHistory`, `listDecisions`, `recordReview`.
- `src/modules/issues/resolvers/get-issue-resolver.ts` — MODIFY: embed history/decisions/timeline.
- `src/modules/issues/resolvers/review-issue-resolver.ts` — CREATE.
- `src/modules/issues/resolvers/index.ts` — MODIFY: export the new resolver.
- `src/modules/issues/routes.ts` — MODIFY: mount `POST /:id/review`.
- `src/modules/issues/__tests__/fixtures.ts` — MODIFY: add `setIssueStatus` helper.
- `src/modules/issues/__tests__/state-machine.test.ts` — CREATE.
- `src/modules/issues/__tests__/get-issue.api.test.ts` — MODIFY: assert embedded trail.
- `src/modules/issues/__tests__/review-issue.api.test.ts` — CREATE.
- `test/setup.ts` — MODIFY: truncate the two new tables.
- `drizzle/` — new generated migration.

---

## Task 1: Persistence foundation (schema + migration + truncate hook)

Adds the `on_hold` status, the two new tables, their inferred row types, the generated migration, and extends the truncate hook. No new behavior — verified by the existing suite staying green against the new migration.

**Files:**
- Modify: `src/modules/issues/model.ts`
- Modify: `src/modules/issues/types.ts`
- Modify: `test/setup.ts`
- Create: `drizzle/<generated>.sql` (via `db:generate`)

**Interfaces:**
- Produces: enum `issueStatus` now includes `"on_hold"`; tables `issueDecisions`, `issueStatusHistory`; types `DecisionRow`, `StatusHistoryRow`.

- [ ] **Step 1: Add the `on_hold` status and the two tables to the model**

Edit `src/modules/issues/model.ts`. Change the `issueStatus` enum to insert `on_hold`, and append the new enum + tables after the `issues` table:

```ts
export const issueStatus = pgEnum("issue_status", [
  "pending",
  "processing",
  "on_hold",
  "resolved",
  "escalated",
]);
```

```ts
// actor that authored a decision. Only "human" is written today; the AI cycle
// adds the "agent" branch (additive — nullable trace columns join later).
export const decisionActor = pgEnum("decision_actor", ["human", "agent"]);

// Append-only record of a decision taken on an issue.
export const issueDecisions = pgTable("issue_decisions", {
  id: uuid("id").primaryKey().defaultRandom(),
  issueId: uuid("issue_id")
    .notNull()
    .references(() => issues.id),
  actor: decisionActor("actor").notNull(),
  decision: text("decision").notNull(), // 'resolve' | 'escalate' | 'hold'
  justification: text("justification").notNull(),
  decidedBy: text("decided_by").notNull(), // reviewer identifier
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
});

// Append-only log of every status transition. from_status null = intake (birth).
export const issueStatusHistory = pgTable("issue_status_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  issueId: uuid("issue_id")
    .notNull()
    .references(() => issues.id),
  fromStatus: issueStatus("from_status"),
  toStatus: issueStatus("to_status").notNull(),
  actor: text("actor").notNull(), // 'system' (intake) | 'human'
  decisionId: uuid("decision_id").references(() => issueDecisions.id),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
});
```

- [ ] **Step 2: Add inferred row types**

Edit `src/modules/issues/types.ts` to add the two row types:

```ts
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import type {
  issues,
  issueDecisions,
  issueStatusHistory,
} from "@/modules/issues/model";

export type IssueRow = InferSelectModel<typeof issues>;
export type NewIssue = InferInsertModel<typeof issues>;
export type IssueStatus = IssueRow["status"];

export type DecisionRow = InferSelectModel<typeof issueDecisions>;
export type StatusHistoryRow = InferSelectModel<typeof issueStatusHistory>;
```

- [ ] **Step 3: Extend the truncate hook**

Edit `test/setup.ts` so every table is cleared before each test:

```ts
beforeEach(async () => {
  await pool.query(
    "TRUNCATE TABLE issues, issue_decisions, issue_status_history RESTART IDENTITY CASCADE",
  );
});
```

- [ ] **Step 4: Generate the migration**

Run: `cd apps/api && pnpm db:generate`
Expected: a new file appears under `apps/api/drizzle/` containing `ALTER TYPE "public"."issue_status" ADD VALUE 'on_hold' ...`, `CREATE TYPE "public"."decision_actor" ...`, and `CREATE TABLE "issue_decisions"` / `CREATE TABLE "issue_status_history"`. (Adding the enum value and creating tables of that type in one migration is safe — the new label is not *used* in the same transaction.)

- [ ] **Step 5: Verify the migration applies and nothing regressed**

Run: `cd apps/api && pnpm db:up && pnpm test`
Expected: PASS — the global setup migrates cleanly (new tables + enum value) and every existing test still passes.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/issues/model.ts apps/api/src/modules/issues/types.ts apps/api/test/setup.ts apps/api/drizzle
git commit -m "feat(api): status_history + decisions tables, on_hold status"
```

---

## Task 2: Transition state machine (pure)

The `nextStatusFor(current, decision)` function that returns the target status for a legal review, or `null` for an illegal one. Pure, no HTTP/DB — unit-tested over the full matrix.

**Files:**
- Create: `src/modules/issues/state-machine.ts`
- Test: `src/modules/issues/__tests__/state-machine.test.ts`

**Interfaces:**
- Consumes: `IssueStatus` from `@/modules/issues/types`.
- Produces: `REVIEW_DECISIONS` (readonly tuple `["resolve","escalate","hold"]`), `type ReviewDecision`, `nextStatusFor(current: IssueStatus, decision: ReviewDecision): IssueStatus | null`.

- [ ] **Step 1: Write the failing test**

Create `src/modules/issues/__tests__/state-machine.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { nextStatusFor } from "@/modules/issues/state-machine";
import type { IssueStatus } from "@/modules/issues/types";

describe("nextStatusFor", () => {
  it("resolve -> resolved from processing, on_hold, escalated", () => {
    expect(nextStatusFor("processing", "resolve")).toBe("resolved");
    expect(nextStatusFor("on_hold", "resolve")).toBe("resolved");
    expect(nextStatusFor("escalated", "resolve")).toBe("resolved");
  });

  it("escalate -> escalated from processing, on_hold", () => {
    expect(nextStatusFor("processing", "escalate")).toBe("escalated");
    expect(nextStatusFor("on_hold", "escalate")).toBe("escalated");
  });

  it("hold -> on_hold from processing, escalated", () => {
    expect(nextStatusFor("processing", "hold")).toBe("on_hold");
    expect(nextStatusFor("escalated", "hold")).toBe("on_hold");
  });

  it("returns null for illegal transitions", () => {
    // pending is never reviewable
    expect(nextStatusFor("pending", "resolve")).toBeNull();
    expect(nextStatusFor("pending", "escalate")).toBeNull();
    expect(nextStatusFor("pending", "hold")).toBeNull();
    // resolved is terminal
    expect(nextStatusFor("resolved", "resolve")).toBeNull();
    // no double-apply
    expect(nextStatusFor("escalated", "escalate")).toBeNull();
    expect(nextStatusFor("on_hold", "hold")).toBeNull();
  });

  // Guards against forgetting a status in the "from" lists.
  it("only legal (status, decision) pairs are non-null", () => {
    const statuses: IssueStatus[] = [
      "pending",
      "processing",
      "on_hold",
      "resolved",
      "escalated",
    ];
    const legal = new Set([
      "processing:resolve",
      "on_hold:resolve",
      "escalated:resolve",
      "processing:escalate",
      "on_hold:escalate",
      "processing:hold",
      "escalated:hold",
    ]);
    for (const s of statuses) {
      for (const d of ["resolve", "escalate", "hold"] as const) {
        const expected = legal.has(`${s}:${d}`);
        expect(nextStatusFor(s, d) !== null).toBe(expected);
      }
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && pnpm test state-machine`
Expected: FAIL — cannot resolve `@/modules/issues/state-machine`.

- [ ] **Step 3: Write minimal implementation**

Create `src/modules/issues/state-machine.ts`:

```ts
import type { IssueStatus } from "@/modules/issues/types";

// The verbs POST /issues/:id/review accepts. Single source of truth — the Zod
// schema derives its enum from this tuple.
export const REVIEW_DECISIONS = ["resolve", "escalate", "hold"] as const;
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

type Rule = { target: IssueStatus; from: IssueStatus[] };

// The human-review transition map. pending is never here (a review needs a first
// agent verdict); resolved is terminal (never a legal `from`).
const TRANSITIONS: Record<ReviewDecision, Rule> = {
  resolve: { target: "resolved", from: ["processing", "on_hold", "escalated"] },
  escalate: { target: "escalated", from: ["processing", "on_hold"] },
  hold: { target: "on_hold", from: ["processing", "escalated"] },
};

// Target status for a legal (current, decision) pair, else null (illegal → 409).
export const nextStatusFor = (
  current: IssueStatus,
  decision: ReviewDecision,
): IssueStatus | null => {
  const rule = TRANSITIONS[decision];
  return rule.from.includes(current) ? rule.target : null;
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && pnpm test state-machine`
Expected: PASS (all cases green).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/issues/state-machine.ts apps/api/src/modules/issues/__tests__/state-machine.test.ts
git commit -m "feat(api): issue review transition state machine"
```

---

## Task 3: Intake history + read path

`POST /issues` writes an intake status-history row (`null → pending`, actor `system`), and `GET /issues/:id` returns the issue with embedded `status_history`, `decisions`, and a derived `timeline`. Both are proven by one HTTP test: a freshly created issue's trail starts with exactly its intake row.

**Files:**
- Create: `src/modules/issues/timeline.ts`
- Modify: `src/modules/issues/repository.ts`
- Modify: `src/modules/issues/resolvers/get-issue-resolver.ts`
- Modify: `src/modules/issues/__tests__/get-issue.api.test.ts`

**Interfaces:**
- Consumes: `issueDecisions`, `issueStatusHistory` (Task 1); `DecisionRow`, `StatusHistoryRow` (Task 1).
- Produces:
  - `mergeTimeline(history: StatusHistoryRow[], decisions: DecisionRow[]): TimelineEntry[]`
  - `issuesRepository.listStatusHistory(issueId: string): Promise<StatusHistoryRow[]>`
  - `issuesRepository.listDecisions(issueId: string): Promise<DecisionRow[]>`
  - `create` now also writes the intake history row (same signature: `create(row: NewIssueRow): Promise<IssueRow>`).
  - `GET /issues/:id` response = `{ ...issue, status_history, decisions, timeline }`.

- [ ] **Step 1: Write the failing test**

Edit `src/modules/issues/__tests__/get-issue.api.test.ts` — add this test inside the existing `describe`:

```ts
it("embeds the audit trail; a new issue's history starts at intake", async () => {
  await postIssue(base, { ...declineBody, id: externalId });
  const res = await fetch(`${base}/issues/${externalId}`);
  expect(res.status).toBe(200);
  const body = await res.json();

  expect(body.decisions).toEqual([]);
  expect(body.status_history).toHaveLength(1);
  expect(body.status_history[0].from_status).toBeNull();
  expect(body.status_history[0].to_status).toBe("pending");
  expect(body.status_history[0].actor).toBe("system");

  expect(body.timeline).toHaveLength(1);
  expect(body.timeline[0].kind).toBe("status");
  expect(body.timeline[0].to_status).toBe("pending");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && pnpm test get-issue`
Expected: FAIL — `body.status_history` is `undefined` (resolver returns the bare issue; intake row not written).

- [ ] **Step 3: Create the timeline projection helper**

Create `src/modules/issues/timeline.ts`:

```ts
import type { DecisionRow, StatusHistoryRow } from "@/modules/issues/types";

// A single chronological entry. The timeline is DERIVED from the source tables
// on read — never persisted — so it can't drift from the facts.
export type TimelineEntry = {
  kind: "status" | "decision";
  at: Date;
  actor: string;
  from_status?: StatusHistoryRow["fromStatus"];
  to_status?: StatusHistoryRow["toStatus"];
  decision?: string;
  justification?: string;
};

export const mergeTimeline = (
  history: StatusHistoryRow[],
  decisions: DecisionRow[],
): TimelineEntry[] => {
  const entries: TimelineEntry[] = [
    ...history.map((h) => ({
      kind: "status" as const,
      at: h.at,
      actor: h.actor,
      from_status: h.fromStatus,
      to_status: h.toStatus,
    })),
    ...decisions.map((d) => ({
      kind: "decision" as const,
      at: d.at,
      actor: d.actor,
      decision: d.decision,
      justification: d.justification,
    })),
  ];
  return entries.sort((a, b) => a.at.getTime() - b.at.getTime());
};
```

- [ ] **Step 4: Write the intake row on create and add the list helpers**

Edit `src/modules/issues/repository.ts`. Update imports and the `create` method, and add the two read helpers.

Update the imports at the top:

```ts
import { asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import {
  issues,
  issueDecisions,
  issueStatusHistory,
} from "@/modules/issues/model";
import { ConflictError } from "@/db/data/errors";
import { isUniqueViolation } from "@/db/data/pg-errors";
import type { NewIssueRow } from "@/modules/issues/normalizer";
import type {
  IssueRow,
  IssueStatus,
  DecisionRow,
  StatusHistoryRow,
} from "@/modules/issues/types";
```

Replace the `create` method body with a transaction that also writes the intake row:

```ts
  async create(row: NewIssueRow): Promise<IssueRow> {
    try {
      return await db.transaction(async (tx) => {
        const [created] = await tx.insert(issues).values(row).returning();
        await tx.insert(issueStatusHistory).values({
          issueId: created.id,
          fromStatus: null,
          toStatus: "pending",
          actor: "system",
        });
        return created;
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictError(
          `issue with external_id ${row.externalId} already exists`,
        );
      }
      throw err;
    }
  },
```

Add these two methods to the `issuesRepository` object (e.g. after `findByIdOrExternalId`):

```ts
  async listStatusHistory(issueId: string): Promise<StatusHistoryRow[]> {
    return db
      .select()
      .from(issueStatusHistory)
      .where(eq(issueStatusHistory.issueId, issueId))
      .orderBy(asc(issueStatusHistory.at));
  },

  async listDecisions(issueId: string): Promise<DecisionRow[]> {
    return db
      .select()
      .from(issueDecisions)
      .where(eq(issueDecisions.issueId, issueId))
      .orderBy(asc(issueDecisions.at));
  },
```

- [ ] **Step 5: Embed the trail in the get resolver**

Replace `src/modules/issues/resolvers/get-issue-resolver.ts` with:

```ts
import type { Request, Response, NextFunction } from "express";
import { issuesRepository } from "@/modules/issues/repository";
import { mergeTimeline } from "@/modules/issues/timeline";
import { NotFoundError } from "@/db/data/errors";

export const getIssueResolver = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const issue = await issuesRepository.findByIdOrExternalId(req.params.id);
    if (!issue) throw new NotFoundError(`issue ${req.params.id} not found`);
    const [statusHistory, decisions] = await Promise.all([
      issuesRepository.listStatusHistory(issue.id),
      issuesRepository.listDecisions(issue.id),
    ]);
    res.status(200).json({
      ...issue,
      status_history: statusHistory,
      decisions,
      timeline: mergeTimeline(statusHistory, decisions),
    });
  } catch (err) {
    next(err);
  }
};
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd apps/api && pnpm test get-issue`
Expected: PASS — including the existing "by uuid", "by external_id", and 404 tests (they only assert `externalId`/status codes, which the spread preserves).

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/issues/timeline.ts apps/api/src/modules/issues/repository.ts apps/api/src/modules/issues/resolvers/get-issue-resolver.ts apps/api/src/modules/issues/__tests__/get-issue.api.test.ts
git commit -m "feat(api): intake status history + embed audit trail on GET /issues/:id"
```

---

## Task 4: `POST /issues/:id/review` endpoint (happy paths)

The review endpoint: validate the body, look up the issue, compute the target via `nextStatusFor`, and record the decision + status-history + status flip in one transaction. Driven by the three happy-path verbs; the audit trail is asserted through `GET /issues/:id`.

**Files:**
- Modify: `src/modules/issues/schema.ts`
- Modify: `src/modules/issues/repository.ts`
- Create: `src/modules/issues/resolvers/review-issue-resolver.ts`
- Modify: `src/modules/issues/resolvers/index.ts`
- Modify: `src/modules/issues/routes.ts`
- Modify: `src/modules/issues/__tests__/fixtures.ts`
- Create: `src/modules/issues/__tests__/review-issue.api.test.ts`

**Interfaces:**
- Consumes: `nextStatusFor`, `REVIEW_DECISIONS`, `ReviewDecision` (Task 2); `findByIdOrExternalId` (existing).
- Produces:
  - `reviewIssueSchema` (Zod) + `type ReviewIssueInput`.
  - `issuesRepository.recordReview(issueId: string, params: { decision: ReviewDecision; target: IssueStatus; justification: string; reviewer: string; fromStatus: IssueStatus }): Promise<IssueRow>`
  - `reviewIssueResolver` (Express handler), mounted at `POST /issues/:id/review`, returns `200` with the updated issue.
  - test helper `setIssueStatus(externalId: string, status: string): Promise<unknown>`.

- [ ] **Step 1: Write the failing test**

First add the arrange-helper. Edit `src/modules/issues/__tests__/fixtures.ts` — add at the top and bottom:

```ts
import { pool } from "@/db/client";
```

```ts
// Arrange a reviewable precondition. Issues are born `pending` (not reviewable);
// in production the queue/agent moves them on. Tests set the status directly.
export const setIssueStatus = (externalId: string, status: string) =>
  pool.query("UPDATE issues SET status = $1 WHERE external_id = $2", [
    status,
    externalId,
  ]);
```

Create `src/modules/issues/__tests__/review-issue.api.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import { startServer, stopServer } from "@test/helpers";
import { declineBody, postIssue, setIssueStatus } from "./fixtures";

const review = (base: string, id: string, body: unknown) =>
  fetch(`${base}/issues/${id}/review`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

describe("POST /issues/:id/review (happy paths)", () => {
  let server: Server;
  let base: string;
  const externalId = "iss_001";
  beforeAll(async () => {
    ({ server, base } = await startServer());
  });
  afterAll(async () => {
    await stopServer(server);
  });

  it("resolve: processing -> resolved, records decision + history", async () => {
    await postIssue(base, { ...declineBody, id: externalId });
    await setIssueStatus(externalId, "processing");

    const res = await review(base, externalId, {
      decision: "resolve",
      justification: "retry succeeded",
      reviewer: "agent_lee",
    });
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("resolved");

    const detail = await (await fetch(`${base}/issues/${externalId}`)).json();
    expect(detail.status).toBe("resolved");
    expect(detail.decisions).toHaveLength(1);
    expect(detail.decisions[0]).toMatchObject({
      actor: "human",
      decision: "resolve",
      justification: "retry succeeded",
      decided_by: "agent_lee",
    });
    // intake row + the review transition row
    expect(detail.status_history).toHaveLength(2);
    const transition = detail.status_history[1];
    expect(transition).toMatchObject({
      from_status: "processing",
      to_status: "resolved",
      actor: "human",
    });
    expect(transition.decision_id).toBe(detail.decisions[0].id);
  });

  it("escalate: processing -> escalated", async () => {
    await postIssue(base, { ...declineBody, id: externalId });
    await setIssueStatus(externalId, "processing");
    const res = await review(base, externalId, {
      decision: "escalate",
      justification: "over $200 and high value",
      reviewer: "agent_lee",
    });
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("escalated");
  });

  it("hold: processing -> on_hold", async () => {
    await postIssue(base, { ...declineBody, id: externalId });
    await setIssueStatus(externalId, "processing");
    const res = await review(base, externalId, {
      decision: "hold",
      justification: "await payment retry window",
      reviewer: "agent_lee",
    });
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("on_hold");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && pnpm test review-issue`
Expected: FAIL — `POST /issues/:id/review` is not routed (404), so `res.status` is not 200.

- [ ] **Step 3: Add the review schema**

Edit `src/modules/issues/schema.ts` — add the import and the schema at the end:

```ts
import { REVIEW_DECISIONS } from "@/modules/issues/state-machine";
```

```ts
// POST /issues/:id/review body. `decision` enum is derived from the state
// machine's tuple so the two can't drift.
export const reviewIssueSchema = z.object({
  decision: z.enum(REVIEW_DECISIONS),
  justification: z.string().min(1),
  reviewer: z.string().min(1),
});

export type ReviewIssueInput = z.infer<typeof reviewIssueSchema>;
```

- [ ] **Step 4: Add the transactional `recordReview` repository method**

Edit `src/modules/issues/repository.ts`. Add the `ReviewDecision` import:

```ts
import type { ReviewDecision } from "@/modules/issues/state-machine";
```

Add this method to `issuesRepository`:

```ts
  // Atomic human review: write the decision, the status-history row (linked to
  // that decision), and flip the issue's status — all or nothing.
  async recordReview(
    issueId: string,
    params: {
      decision: ReviewDecision;
      target: IssueStatus;
      justification: string;
      reviewer: string;
      fromStatus: IssueStatus;
    },
  ): Promise<IssueRow> {
    return db.transaction(async (tx) => {
      const [decision] = await tx
        .insert(issueDecisions)
        .values({
          issueId,
          actor: "human",
          decision: params.decision,
          justification: params.justification,
          decidedBy: params.reviewer,
        })
        .returning();
      await tx.insert(issueStatusHistory).values({
        issueId,
        fromStatus: params.fromStatus,
        toStatus: params.target,
        actor: "human",
        decisionId: decision.id,
      });
      const [updated] = await tx
        .update(issues)
        .set({ status: params.target })
        .where(eq(issues.id, issueId))
        .returning();
      return updated;
    });
  },
```

- [ ] **Step 5: Create the resolver**

Create `src/modules/issues/resolvers/review-issue-resolver.ts`:

```ts
import type { Request, Response, NextFunction } from "express";
import { reviewIssueSchema } from "@/modules/issues/schema";
import { nextStatusFor } from "@/modules/issues/state-machine";
import { issuesRepository } from "@/modules/issues/repository";
import { ConflictError, NotFoundError } from "@/db/data/errors";

export const reviewIssueResolver = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const input = reviewIssueSchema.parse(req.body);
    const issue = await issuesRepository.findByIdOrExternalId(req.params.id);
    if (!issue) throw new NotFoundError(`issue ${req.params.id} not found`);

    const target = nextStatusFor(issue.status, input.decision);
    if (!target) {
      throw new ConflictError(
        `cannot ${input.decision} an issue in status ${issue.status}`,
      );
    }

    const updated = await issuesRepository.recordReview(issue.id, {
      decision: input.decision,
      target,
      justification: input.justification,
      reviewer: input.reviewer,
      fromStatus: issue.status,
    });
    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
};
```

- [ ] **Step 6: Export the resolver and mount the route**

Edit `src/modules/issues/resolvers/index.ts` — add:

```ts
export * from "@/modules/issues/resolvers/review-issue-resolver";
```

Edit `src/modules/issues/routes.ts` — add the route after the existing ones:

```ts
issuesRouter.post("/:id/review", resolvers.reviewIssueResolver);
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd apps/api && pnpm test review-issue`
Expected: PASS — all three happy-path verbs.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/modules/issues/schema.ts apps/api/src/modules/issues/repository.ts apps/api/src/modules/issues/resolvers/review-issue-resolver.ts apps/api/src/modules/issues/resolvers/index.ts apps/api/src/modules/issues/routes.ts apps/api/src/modules/issues/__tests__/fixtures.ts apps/api/src/modules/issues/__tests__/review-issue.api.test.ts
git commit -m "feat(api): POST /issues/:id/review records human decision + transition"
```

---

## Task 5: Review endpoint guardrails (400 / 404 / 409)

Locks the endpoint's error contract: bad body → 400, unknown issue → 404, illegal transition → 409 (including the "pending is never reviewable" and "no double-apply" rules). The guards were written in Task 4 as the minimal correct resolver (TypeScript forces the `!issue` and `!target` checks to compile); this task proves each guard and prevents regressions. Run each new test before its assertion is trusted — if any fails, fix the resolver.

**Files:**
- Modify: `src/modules/issues/__tests__/review-issue.api.test.ts`

**Interfaces:**
- Consumes: everything from Task 4.

- [ ] **Step 1: Write the failing/locking tests**

Append a second `describe` block to `src/modules/issues/__tests__/review-issue.api.test.ts`:

```ts
describe("POST /issues/:id/review (guardrails)", () => {
  let server: Server;
  let base: string;
  const externalId = "iss_001";
  beforeAll(async () => {
    ({ server, base } = await startServer());
  });
  afterAll(async () => {
    await stopServer(server);
  });

  it("rejects a missing justification (400)", async () => {
    await postIssue(base, { ...declineBody, id: externalId });
    await setIssueStatus(externalId, "processing");
    const res = await review(base, externalId, {
      decision: "resolve",
      reviewer: "agent_lee",
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("validation_error");
  });

  it("returns 404 for an unknown issue", async () => {
    const res = await review(base, "iss_999", {
      decision: "resolve",
      justification: "x",
      reviewer: "agent_lee",
    });
    expect(res.status).toBe(404);
  });

  it("returns 409 reviewing a pending issue (breaks automation)", async () => {
    await postIssue(base, { ...declineBody, id: externalId });
    const res = await review(base, externalId, {
      decision: "resolve",
      justification: "x",
      reviewer: "agent_lee",
    });
    expect(res.status).toBe(409);
  });

  it("returns 409 reviewing a resolved (terminal) issue", async () => {
    await postIssue(base, { ...declineBody, id: externalId });
    await setIssueStatus(externalId, "resolved");
    const res = await review(base, externalId, {
      decision: "resolve",
      justification: "x",
      reviewer: "agent_lee",
    });
    expect(res.status).toBe(409);
  });

  it("returns 409 escalating an already-escalated issue", async () => {
    await postIssue(base, { ...declineBody, id: externalId });
    await setIssueStatus(externalId, "escalated");
    const res = await review(base, externalId, {
      decision: "escalate",
      justification: "x",
      reviewer: "agent_lee",
    });
    expect(res.status).toBe(409);
  });

  it("does not persist a decision or transition on a 409", async () => {
    await postIssue(base, { ...declineBody, id: externalId });
    await setIssueStatus(externalId, "resolved");
    await review(base, externalId, {
      decision: "resolve",
      justification: "x",
      reviewer: "agent_lee",
    });
    const detail = await (await fetch(`${base}/issues/${externalId}`)).json();
    expect(detail.decisions).toEqual([]);
    // only the intake row; the rejected review wrote nothing
    expect(detail.status_history).toHaveLength(1);
  });
});
```

Reuse the module-level `review` helper defined in Task 4 (it stays at the top of the file, above both `describe` blocks).

- [ ] **Step 2: Run the tests**

Run: `cd apps/api && pnpm test review-issue`
Expected: PASS. (These assert the guards implemented in Task 4. If any fails, the resolver is missing that guard — add it, then re-run.)

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/issues/__tests__/review-issue.api.test.ts
git commit -m "test(api): lock review endpoint 400/404/409 guardrails"
```

---

## Task 6: Full suite green + typecheck

Final gate: the whole suite passes and the project typechecks.

- [ ] **Step 1: Run the full test suite**

Run: `cd apps/api && pnpm db:up && pnpm test`
Expected: PASS — all suites (health, issues create/list/get/review, state-machine, normalizer, schema, db, error-handler, pg-errors).

- [ ] **Step 2: Typecheck**

Run: `cd apps/api && pnpm lint`
Expected: no TypeScript errors (`tsc --noEmit`).

- [ ] **Step 3: Commit (only if any fix was needed)**

```bash
git add -A
git commit -m "chore(api): review + decision tracking green across suite"
```

---

## Self-Review

**Spec coverage** (spec §→task):
- §3.1 `on_hold` enum → Task 1. §3.2 `issue_decisions` → Task 1. §3.3 `issue_status_history` → Task 1. §3.4 timeline projection → Task 3 (`mergeTimeline`). §3.5 intake row → Task 3.
- §4 state machine + §4.1 transition map → Task 2 (`nextStatusFor`), enforced in Task 4 resolver.
- §5 endpoint contract (200/400/404/409, uuid-or-external_id) → Task 4 (200) + Task 5 (400/404/409); `:id` reuses `findByIdOrExternalId`.
- §6 transactional `recordReview` → Task 4.
- §7 read path (`status_history`/`decisions`/`timeline`) → Task 3.
- §8 data flow → Task 4 resolver order.
- §9 testing: (1) state-machine unit → Task 2; (2) 3 verbs → Task 4; (3) 404 → Task 5; (4) 409 illegal (resolved/escalated/pending) → Task 5; (5) 400 missing justification → Task 5; (6) intake row → Task 3; (7) read path → Task 3; (8) truncate hook → Task 1.
- §10 files touched → matches the File Structure section.

**Placeholder scan:** none — every code step shows complete code; every run step shows the command and expected result.

**Type consistency:** `nextStatusFor(current, decision)` signature identical in Task 2 (def) and Task 4 (call). `recordReview(issueId, params)` param shape identical in Task 4 def and its resolver call. `mergeTimeline(history, decisions)` identical in Task 3 def and get-resolver call. `REVIEW_DECISIONS` produced in Task 2, consumed by `reviewIssueSchema` in Task 4. Response keys `status_history` / `decisions` / `timeline` and decision fields `decided_by` / `decision_id` are consistent between the resolvers (Task 3/4) and the test assertions (Task 3/4/5).
