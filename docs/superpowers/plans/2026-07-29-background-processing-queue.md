# Background Processing & Job Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move issue processing out of the API request into a Postgres-backed job queue that retries with backoff, never processes an issue twice, and survives a mid-job crash.

**Architecture:** Graphile Worker over the existing Postgres. `graphile_worker.add_job` is a SQL function, so the enqueue joins the issue `INSERT` in one transaction and the Postgres/Redis dual-write failure mode cannot occur. A cron task ingests from `docs/initial/payment_issues.json` and fans out one `process_issue` job per new issue. The processing step is a `decide()` seam whose v1 stub routes every issue to `needs_review` — the pipeline is real end to end, the intelligence is deliberately absent and lands in the next cycle.

**Tech Stack:** TypeScript, Express 5, Drizzle ORM, Postgres 16, `graphile-worker@^0.17.3`, Vitest, tsx.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-29-background-processing-queue-design.md`. Read it before Task 1.
- Branch `feat/background-processing-queue` is already checked out. Do not commit to `main`.
- **TDD is mandatory.** Red → green → refactor, one vertical slice per commit. Never write implementation before a failing test.
- Tests live in `__tests__/` at the same level as the file under test.
- Resolver pattern per `apps/api/AGENTS.md`: resolvers are Express handlers, all data access via `repository.ts`, errors thrown and forwarded with `next(err)`.
- Every test starts from a pristine database (`fileParallelism: false`, truncate in `test/setup.ts`).
- **No AI in this cycle.** No Anthropic SDK dependency, no `confidence` column, no confidence routing, no citation guardrail, no decide/execute split. See spec §14.
- `max_attempts` for `process_issue` is **8**, set in `queue/retry-policy.ts`. For `ingest_issues` it is **1**, set in the `crontab` line — cron-scheduled jobs never pass through `enqueue()`, so that is the only place it can live.
- v1 writes **no `issue_decisions` row** — the outcome is a status transition with `actor: 'system'`.
- Assert against the **public** `graphile_worker.jobs` view. `graphile_worker._private_jobs` is internal and is touched only by the test truncate hook.
- All commands run from `apps/api` unless stated otherwise.

---

### Task 1: Install Graphile Worker and wire the test harness

**Files:**
- Modify: `apps/api/package.json`
- Modify: `apps/api/test/global-setup.ts`
- Modify: `apps/api/test/setup.ts`
- Create: `apps/api/test/queue.ts`
- Test: `apps/api/src/queue/__tests__/harness.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `test/queue.ts` exporting `listJobs(): Promise<JobRow[]>` and `jobsForIssue(issueId: string): Promise<JobRow[]>`, where `JobRow = { id: string; task_identifier: string; payload: Record<string, unknown>; attempts: number; max_attempts: number; run_at: Date; last_error: string | null }`.

- [ ] **Step 1: Install the dependency**

```bash
pnpm --filter api add graphile-worker
```

- [ ] **Step 2: Write the failing test**

Create `apps/api/src/queue/__tests__/harness.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { listJobs } from "@test/queue";

describe("queue harness", () => {
  it("exposes an empty graphile_worker.jobs view", async () => {
    expect(await listJobs()).toEqual([]);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter api test -- harness`
Expected: FAIL — cannot resolve `@test/queue`.

- [ ] **Step 4: Install the worker schema in global setup**

Modify `apps/api/test/global-setup.ts` — add the import and the `runMigrations` call after the Drizzle migration:

```ts
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { runMigrations } from "graphile-worker";
import { Pool } from "pg";

export default async function setup(): Promise<void> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);
  await migrate(db, { migrationsFolder: "./drizzle" });
  await pool.end();

  // Installs the `graphile_worker` schema. Separate from Drizzle: the queue
  // library owns its own migrations in its own schema, so the two never collide.
  await runMigrations({ connectionString: process.env.DATABASE_URL! });
}
```

- [ ] **Step 5: Reset the job table between tests**

Modify `apps/api/test/setup.ts`:

```ts
import { afterAll, beforeEach } from "vitest";
import { pool } from "@/db/client";

beforeEach(async () => {
  await pool.query(
    "TRUNCATE TABLE issues, issue_decisions, issue_status_history RESTART IDENTITY CASCADE",
  );
  // `_private_jobs` is Graphile Worker's internal table. We touch it here, and
  // only here, because a test reset needs a bulk wipe and the public `jobs`
  // view is not truncatable. All *assertions* go through the public view.
  await pool.query("TRUNCATE TABLE graphile_worker._private_jobs CASCADE");
});

afterAll(async () => {
  await pool.end();
});
```

- [ ] **Step 6: Create the job-reading helper**

Create `apps/api/test/queue.ts`:

```ts
import { pool } from "@/db/client";

export type JobRow = {
  id: string;
  task_identifier: string;
  payload: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
  run_at: Date;
  last_error: string | null;
};

// Reads the PUBLIC `graphile_worker.jobs` view — the documented, stable
// interface. Never read `_private_jobs`: it can change in a minor version.
export const listJobs = async (): Promise<JobRow[]> => {
  const { rows } = await pool.query<JobRow>(
    `SELECT id, task_identifier, payload, attempts, max_attempts, run_at, last_error
     FROM graphile_worker.jobs
     ORDER BY created_at`,
  );
  return rows;
};

export const jobsForIssue = async (issueId: string): Promise<JobRow[]> =>
  (await listJobs()).filter((job) => job.payload?.issueId === issueId);
```

- [ ] **Step 7: Verify the view's column names**

Run: `docker compose exec -T postgres psql -U brevy -d brevy_test -c '\d graphile_worker.jobs'`
Expected: a view listing at least `id`, `task_identifier`, `payload`, `attempts`, `max_attempts`, `run_at`, `last_error`, `created_at`.

If any column is named differently in the installed version, correct the `SELECT` list and the `JobRow` type in `test/queue.ts` to match. This file is the only place those column names appear, so no other task is affected.

- [ ] **Step 8: Run test to verify it passes**

Run: `pnpm --filter api test -- harness`
Expected: PASS.

- [ ] **Step 9: Run the full suite to confirm nothing regressed**

Run: `pnpm --filter api test`
Expected: all existing tests still PASS.

- [ ] **Step 10: Commit**

```bash
git add apps/api/package.json apps/api/test pnpm-lock.yaml apps/api/src/queue/__tests__/harness.test.ts
git commit -m "test(api): install graphile-worker and wire the queue test harness"
```

---

### Task 2: Add the `needs_review` status

**Files:**
- Modify: `apps/api/src/modules/issues/model.ts`
- Modify: `apps/api/src/modules/issues/state-machine.ts`
- Create: `apps/api/drizzle/0002_*.sql` (generated)
- Test: `apps/api/src/modules/issues/__tests__/state-machine.test.ts` (modify)
- Test: `apps/api/src/modules/issues/__tests__/review-issue.api.test.ts` (modify)

**Interfaces:**
- Consumes: nothing.
- Produces: `IssueStatus` now includes `"needs_review"`. `nextStatusFor("needs_review", "resolve")` returns `"resolved"`.

- [ ] **Step 1: Write the failing state-machine test**

Append to `apps/api/src/modules/issues/__tests__/state-machine.test.ts`:

```ts
describe("needs_review", () => {
  it("is reviewable — a human can resolve, escalate or hold it", () => {
    expect(nextStatusFor("needs_review", "resolve")).toBe("resolved");
    expect(nextStatusFor("needs_review", "escalate")).toBe("escalated");
    expect(nextStatusFor("needs_review", "hold")).toBe("on_hold");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter api test -- state-machine`
Expected: FAIL — `nextStatusFor("needs_review", "resolve")` returns `null`.

- [ ] **Step 3: Add the enum value**

Modify `apps/api/src/modules/issues/model.ts`. Place `needs_review` between `processing` and `on_hold` so the generated migration emits `ADD VALUE ... BEFORE 'on_hold'`:

```ts
export const issueStatus = pgEnum("issue_status", [
  "pending",
  "processing",
  "needs_review",
  "on_hold",
  "resolved",
  "escalated",
]);
```

- [ ] **Step 4: Make `needs_review` reviewable**

Modify the `TRANSITIONS` map in `apps/api/src/modules/issues/state-machine.ts`:

```ts
// The human-review transition map. pending is never here (a review needs a first
// machine or agent verdict); resolved is terminal (never a legal `from`).
// needs_review is where the worker parks an issue it cannot decide — the
// primary lane a human reviews from.
const TRANSITIONS: Record<ReviewDecision, Rule> = {
  resolve: {
    target: "resolved",
    from: ["processing", "needs_review", "on_hold", "escalated"],
  },
  escalate: {
    target: "escalated",
    from: ["processing", "needs_review", "on_hold"],
  },
  hold: {
    target: "on_hold",
    from: ["processing", "needs_review", "escalated"],
  },
};
```

- [ ] **Step 5: Generate and apply the migration**

```bash
pnpm --filter api db:generate
pnpm --filter api db:migrate
```

Expected: a new `drizzle/0002_*.sql` containing `ALTER TYPE "public"."issue_status" ADD VALUE 'needs_review' BEFORE 'on_hold';`

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm --filter api test -- state-machine`
Expected: PASS.

- [ ] **Step 7: Add the HTTP-level test**

Append to `apps/api/src/modules/issues/__tests__/review-issue.api.test.ts`, following the arrange pattern already used in that file (`postIssue` then `setIssueStatus`):

```ts
it("resolves an issue sitting in needs_review", async () => {
  await postIssue(base, declineBody);
  await setIssueStatus("iss_001", "needs_review");

  const res = await fetch(`${base}/issues/iss_001/review`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      decision: "resolve",
      justification: "retry succeeded on the customer's new card",
      reviewer: "ops@brevy.com",
    }),
  });

  expect(res.status).toBe(200);
  expect((await res.json()).status).toBe("resolved");
});
```

- [ ] **Step 8: Run the full suite**

Run: `pnpm --filter api test`
Expected: all PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/modules/issues apps/api/drizzle
git commit -m "feat(api): add needs_review status for queue-parked issues"
```

---

### Task 3: Retry policy

**Files:**
- Create: `apps/api/src/queue/retry-policy.ts`
- Test: `apps/api/src/queue/__tests__/retry-policy.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `RetryableError`, `TerminalError` (both extend `Error`), `isRetryable(err: unknown): boolean`, `MAX_ATTEMPTS: { processIssue: 8; ingestIssues: 1 }`.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/queue/__tests__/retry-policy.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  isRetryable,
  MAX_ATTEMPTS,
  RetryableError,
  TerminalError,
} from "@/queue/retry-policy";

describe("isRetryable", () => {
  it("retries transient failures", () => {
    expect(isRetryable(new RetryableError("429 rate limited"))).toBe(true);
  });

  it("does not retry failures that retrying cannot fix", () => {
    expect(isRetryable(new TerminalError("401 bad credentials"))).toBe(false);
  });

  it("treats unknown errors as terminal", () => {
    // Default-deny: a bug in our own code should surface on attempt 1 rather
    // than burning the whole retry budget over 78 minutes before anyone notices.
    expect(isRetryable(new TypeError("cannot read property of undefined"))).toBe(
      false,
    );
    expect(isRetryable("not even an error")).toBe(false);
  });
});

describe("MAX_ATTEMPTS", () => {
  it("gives process_issue enough attempts to outlast an hour-long outage", () => {
    // exp(least(10, attempt)) seconds cumulative: 8 attempts spans ~1h18m.
    expect(MAX_ATTEMPTS.processIssue).toBe(8);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter api test -- retry-policy`
Expected: FAIL — cannot resolve `@/queue/retry-policy`.

- [ ] **Step 3: Write the implementation**

Create `apps/api/src/queue/retry-policy.ts`:

```ts
/**
 * Transient failure — the dependency is expected to recover, so the job should
 * back off and try again.
 */
export class RetryableError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "RetryableError";
  }
}

/**
 * Permanent failure — retrying changes nothing (bad credentials, malformed
 * request). Fail on the first attempt so it surfaces immediately.
 */
export class TerminalError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "TerminalError";
  }
}

// Default-deny. The retryable set is enumerable; the failure set is not.
export const isRetryable = (err: unknown): boolean =>
  err instanceof RetryableError;

export const MAX_ATTEMPTS = {
  // Graphile Worker's backoff is a fixed exp(least(10, attempt)) seconds. Eight
  // attempts span ~1h18m, which covers "the AI provider is down for more than
  // an hour" for 8 calls. A ninth would push the total to ~3h33m — too long to
  // leave a payment issue unattended. The library default of 25 spans days.
  processIssue: 8,
  // `ingest_issues` is absent on purpose. Cron-scheduled jobs are queued by the
  // worker itself, not by `enqueue()`, so their budget is set in the `crontab`
  // line — see the comment there. Duplicating it here would create two sources
  // of truth with nothing keeping them in agreement.
} as const;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter api test -- retry-policy`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/queue
git commit -m "feat(api): retry policy — error taxonomy and attempt budgets"
```

---

### Task 4: Transactional enqueue

**Files:**
- Modify: `apps/api/src/db/client.ts`
- Create: `apps/api/src/queue/enqueue.ts`
- Test: `apps/api/src/queue/__tests__/enqueue.test.ts`

**Interfaces:**
- Consumes: `MAX_ATTEMPTS` from Task 3; `listJobs` from Task 1.
- Produces: `Tx` type exported from `@/db/client`; `enqueue(tx: Tx, name: string, payload: Record<string, unknown>, opts: { jobKey: string; maxAttempts: number }): Promise<void>` from `@/queue/enqueue`.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/queue/__tests__/enqueue.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { enqueue } from "@/queue/enqueue";
import { listJobs } from "@test/queue";

describe("enqueue", () => {
  it("adds a job that is visible after the transaction commits", async () => {
    await db.transaction(async (tx) => {
      await enqueue(tx, "process_issue", { issueId: "abc" }, {
        jobKey: "abc",
        maxAttempts: 8,
      });
    });

    const jobs = await listJobs();
    expect(jobs).toHaveLength(1);
    expect(jobs[0].task_identifier).toBe("process_issue");
    expect(jobs[0].payload).toEqual({ issueId: "abc" });
    expect(jobs[0].max_attempts).toBe(8);
  });

  it("adds NO job when the transaction rolls back", async () => {
    // This is the whole reason for a Postgres-backed queue: the enqueue is part
    // of the caller's transaction, so it cannot survive a rollback. With Redis
    // this job would leak.
    await expect(
      db.transaction(async (tx) => {
        await enqueue(tx, "process_issue", { issueId: "abc" }, {
          jobKey: "abc",
          maxAttempts: 8,
        });
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    expect(await listJobs()).toEqual([]);
  });

  it("collapses a duplicate enqueue for the same job key", async () => {
    for (const _ of [1, 2]) {
      await db.transaction(async (tx) => {
        await enqueue(tx, "process_issue", { issueId: "abc" }, {
          jobKey: "abc",
          maxAttempts: 8,
        });
      });
    }

    expect(await listJobs()).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter api test -- enqueue`
Expected: FAIL — cannot resolve `@/queue/enqueue`.

- [ ] **Step 3: Export the transaction type**

Append to `apps/api/src/db/client.ts`:

```ts
// The handle drizzle hands to a `db.transaction(async (tx) => …)` callback.
// Derived rather than imported so it tracks the driver's own type.
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
```

- [ ] **Step 4: Write the implementation**

Create `apps/api/src/queue/enqueue.ts`:

```ts
import { sql } from "drizzle-orm";
import type { Tx } from "@/db/client";

export type EnqueueOpts = {
  /** Dedupe key. A second enqueue with the same key is discarded. */
  jobKey: string;
  maxAttempts: number;
};

/**
 * Adds a job **inside the caller's transaction**.
 *
 * This is the load-bearing piece of the queue design. Graphile Worker's JS
 * `addJob` helper uses its own connection pool, which would make enqueueing a
 * second write outside the caller's transaction — a dual-write, where a crash
 * between the two commits strands the row with no job. `add_job` is a SQL
 * function, so calling it on the transaction's own connection makes the row and
 * its job commit or roll back together.
 */
export const enqueue = async (
  tx: Tx,
  name: string,
  payload: Record<string, unknown>,
  opts: EnqueueOpts,
): Promise<void> => {
  await tx.execute(sql`
    select graphile_worker.add_job(
      ${name}::text,
      payload      := ${JSON.stringify(payload)}::json,
      max_attempts := ${opts.maxAttempts}::int,
      job_key      := ${opts.jobKey}::text,
      job_key_mode := 'unsafe_dedupe'
    )
  `);
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter api test -- enqueue`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/queue apps/api/src/db/client.ts
git commit -m "feat(api): transactional enqueue via graphile_worker.add_job"
```

---

### Task 5: Ingest — insert and enqueue as one unit

**Files:**
- Modify: `apps/api/src/modules/issues/repository.ts`
- Create: `apps/api/src/modules/issues/ingest.ts`
- Test: `apps/api/src/modules/issues/__tests__/ingest.test.ts`

**Interfaces:**
- Consumes: `enqueue` (Task 4), `MAX_ATTEMPTS` (Task 3), `toIssueRow`/`NewIssueRow` from `@/modules/issues/normalizer`.
- Produces: `issuesRepository.insertIfNew(tx: Tx, row: NewIssueRow): Promise<IssueRow | null>`; `ingestIssue(raw: CreateIssueInput): Promise<IssueRow | null>` from `@/modules/issues/ingest`.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/modules/issues/__tests__/ingest.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { pool } from "@/db/client";
import { ingestIssue } from "@/modules/issues/ingest";
import { createIssueSchema } from "@/modules/issues/schema";
import { declineBody } from "@/modules/issues/__tests__/fixtures";
import { listJobs } from "@test/queue";

const raw = () => createIssueSchema.parse(declineBody);

describe("ingestIssue", () => {
  it("stores the issue as pending and queues exactly one job for it", async () => {
    const issue = await ingestIssue(raw());

    expect(issue).not.toBeNull();
    expect(issue!.status).toBe("pending");

    const jobs = await listJobs();
    expect(jobs).toHaveLength(1);
    expect(jobs[0].task_identifier).toBe("process_issue");
    expect(jobs[0].payload).toEqual({ issueId: issue!.id });
    expect(jobs[0].max_attempts).toBe(8);
  });

  it("records the intake transition", async () => {
    const issue = await ingestIssue(raw());

    const { rows } = await pool.query(
      "SELECT from_status, to_status, actor FROM issue_status_history WHERE issue_id = $1",
      [issue!.id],
    );
    expect(rows).toEqual([
      { from_status: null, to_status: "pending", actor: "system" },
    ]);
  });

  it("ignores an issue it has already seen, and queues no second job", async () => {
    // Intake dedupe and job dedupe are the same line of code: no insert means
    // no enqueue. This is what makes re-running the cron over a static file a
    // no-op forever.
    const first = await ingestIssue(raw());
    const second = await ingestIssue(raw());

    expect(first).not.toBeNull();
    expect(second).toBeNull();

    const { rows } = await pool.query("SELECT id FROM issues");
    expect(rows).toHaveLength(1);
    expect(await listJobs()).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter api test -- ingest`
Expected: FAIL — cannot resolve `@/modules/issues/ingest`.

- [ ] **Step 3: Add `insertIfNew` to the repository**

Add this method to `issuesRepository` in `apps/api/src/modules/issues/repository.ts`, directly after `create`. Add `Tx` to the existing `@/db/client` import.

```ts
  /**
   * Inserts an issue unless its `external_id` is already known, and records the
   * intake transition. Returns `null` when the issue was already present.
   *
   * Takes a caller-supplied transaction so the insert and the job enqueue
   * commit together — see `modules/issues/ingest.ts`. Unlike `create`, a
   * duplicate is not an error here: re-reading the same upstream feed is the
   * normal case, not a fault.
   */
  async insertIfNew(tx: Tx, row: NewIssueRow): Promise<IssueRow | null> {
    const [created] = await tx
      .insert(issues)
      .values(row)
      .onConflictDoNothing({ target: issues.externalId })
      .returning();
    if (!created) return null;

    await tx.insert(issueStatusHistory).values({
      issueId: created.id,
      fromStatus: null,
      toStatus: "pending",
      actor: "system",
    });
    return created;
  },
```

- [ ] **Step 4: Write the ingest function**

Create `apps/api/src/modules/issues/ingest.ts`:

```ts
import { db } from "@/db/client";
import { toIssueRow } from "@/modules/issues/normalizer";
import { issuesRepository } from "@/modules/issues/repository";
import type { CreateIssueInput } from "@/modules/issues/schema";
import type { IssueRow } from "@/modules/issues/types";
import { enqueue } from "@/queue/enqueue";
import { MAX_ATTEMPTS } from "@/queue/retry-policy";

/**
 * The single door into the system. `POST /issues`, the ingest cron task and the
 * seed script all call this; a webhook would be a fourth caller needing no
 * change here.
 *
 * The insert and the enqueue are one transaction, so there is no window in
 * which an issue exists with no job waiting to process it.
 *
 * Returns `null` when the issue was already known.
 */
export const ingestIssue = async (
  raw: CreateIssueInput,
): Promise<IssueRow | null> =>
  db.transaction(async (tx) => {
    const created = await issuesRepository.insertIfNew(tx, toIssueRow(raw));
    if (!created) return null; // already known → no job

    await enqueue(
      tx,
      "process_issue",
      { issueId: created.id },
      { jobKey: created.id, maxAttempts: MAX_ATTEMPTS.processIssue },
    );
    return created;
  });
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter api test -- ingest`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/issues
git commit -m "feat(api): ingestIssue — insert and enqueue in one transaction"
```

---

### Task 6: Route `POST /issues` and the seed script through ingest

**Files:**
- Modify: `apps/api/src/modules/issues/resolvers/create-issue-resolver.ts`
- Modify: `apps/api/src/modules/issues/repository.ts` (remove `create`)
- Modify: `apps/api/scripts/seed.ts`
- Test: `apps/api/src/modules/issues/__tests__/create-issue.api.test.ts` (modify)

**Interfaces:**
- Consumes: `ingestIssue` (Task 5).
- Produces: `POST /issues` enqueues a `process_issue` job; still `409` on a duplicate `external_id`. `issuesRepository.create` no longer exists.

- [ ] **Step 1: Write the failing test**

Append to `apps/api/src/modules/issues/__tests__/create-issue.api.test.ts`:

```ts
it("queues the new issue for processing", async () => {
  const res = await postIssue(base, declineBody);
  const created = await res.json();

  const jobs = await jobsForIssue(created.id);
  expect(jobs).toHaveLength(1);
  expect(jobs[0].task_identifier).toBe("process_issue");
});

it("queues no second job when the same issue is submitted twice", async () => {
  await postIssue(base, declineBody);
  const second = await postIssue(base, declineBody);

  expect(second.status).toBe(409);
  expect(await listJobs()).toHaveLength(1);
});
```

Add to that file's imports:

```ts
import { jobsForIssue, listJobs } from "@test/queue";
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter api test -- create-issue`
Expected: FAIL — `jobsForIssue(...)` returns `[]`, because the resolver still calls `issuesRepository.create`, which enqueues nothing.

- [ ] **Step 3: Switch the resolver to ingest**

Replace the body of `apps/api/src/modules/issues/resolvers/create-issue-resolver.ts`:

```ts
import type { Request, Response, NextFunction } from "express";
import { createIssueSchema } from "@/modules/issues/schema";
import { ingestIssue } from "@/modules/issues/ingest";
import { ConflictError } from "@/db/data/errors";

export const createIssueResolver = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const input = createIssueSchema.parse(req.body);
    const created = await ingestIssue(input);
    // ingestIssue treats a known issue as a no-op (the cron re-reads the same
    // feed constantly). Over HTTP a re-submission is still a client error.
    if (!created) {
      throw new ConflictError(
        `issue with external_id ${input.id} already exists`,
      );
    }
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
};
```

- [ ] **Step 4: Switch the seed script to ingest**

Replace `apps/api/scripts/seed.ts`:

```ts
import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createIssueSchema } from "@/modules/issues/schema";
import { ingestIssue } from "@/modules/issues/ingest";
import { pool } from "@/db/client";

// apps/api/scripts/seed.ts -> repo root docs/initial/payment_issues.json
const dataPath = fileURLToPath(
  new URL("../../../docs/initial/payment_issues.json", import.meta.url),
);

async function main(): Promise<void> {
  const issues = JSON.parse(readFileSync(dataPath, "utf8")) as unknown[];
  for (const raw of issues) {
    const created = await ingestIssue(createIssueSchema.parse(raw));
    console.log(
      created
        ? `seeded ${created.externalId} -> ${created.id} (queued)`
        : `skip (already exists)`,
    );
  }
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 5: Delete the now-unused `create` method**

Remove the entire `async create(row: NewIssueRow): Promise<IssueRow> { … }` method from `apps/api/src/modules/issues/repository.ts`. Both of its callers now use `ingestIssue`.

Then remove any imports that method alone needed. Run `pnpm --filter api lint` and delete whatever it reports as unused — expect `ConflictError` and `isUniqueViolation` to become unused in `repository.ts`.

- [ ] **Step 6: Run the full suite**

Run: `pnpm --filter api test`
Expected: all PASS, including the two new tests.

- [ ] **Step 7: Verify types**

Run: `pnpm --filter api lint`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src apps/api/scripts
git commit -m "feat(api): POST /issues and seed enqueue through ingestIssue"
```

---

### Task 7: The `decide()` seam

**Files:**
- Modify: `apps/api/src/config/env.ts`
- Create: `apps/api/src/modules/issues/decide.ts`
- Test: `apps/api/src/modules/issues/__tests__/decide.test.ts`

**Interfaces:**
- Consumes: `RetryableError`, `TerminalError` (Task 3).
- Produces: `decide(issue: IssueRow, opts: { signal?: AbortSignal }): Promise<void>` from `@/modules/issues/decide`. Resolving means "processing succeeded"; the caller parks the issue in `needs_review`. Throwing signals failure.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/modules/issues/__tests__/decide.test.ts`:

```ts
import { afterEach, describe, expect, it } from "vitest";
import { decide } from "@/modules/issues/decide";
import { RetryableError, TerminalError } from "@/queue/retry-policy";
import type { IssueRow } from "@/modules/issues/types";

const issue = { id: "00000000-0000-0000-0000-000000000001" } as IssueRow;

afterEach(() => {
  delete process.env.DECIDE_MODE;
});

describe("decide", () => {
  it("succeeds by default — v1 has no intelligence, so a human decides", async () => {
    await expect(decide(issue, {})).resolves.toBeUndefined();
  });

  it("throws a retryable error in fail_retryable mode", async () => {
    process.env.DECIDE_MODE = "fail_retryable";
    await expect(decide(issue, {})).rejects.toBeInstanceOf(RetryableError);
  });

  it("throws a terminal error in fail_terminal mode", async () => {
    process.env.DECIDE_MODE = "fail_terminal";
    await expect(decide(issue, {})).rejects.toBeInstanceOf(TerminalError);
  });

  it("aborts promptly in slow mode when the signal fires", async () => {
    // This is what makes "kill the worker mid-issue and restart" demonstrable
    // before any AI exists: SIGTERM aborts in-flight work rather than blocking
    // shutdown until the delay elapses.
    process.env.DECIDE_MODE = "slow";
    const controller = new AbortController();
    const promise = decide(issue, { signal: controller.signal });
    controller.abort();
    await expect(promise).rejects.toThrow(/abort/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter api test -- decide`
Expected: FAIL — cannot resolve `@/modules/issues/decide`.

- [ ] **Step 3: Add `DECIDE_MODE` to env**

Modify `apps/api/src/config/env.ts`:

```ts
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.url(),
  PORT: z.coerce.number().default(3333),
  // Demo/test scaffolding for the v1 decide() stub — see modules/issues/decide.ts.
  // Removed once a real decider lands.
  DECIDE_MODE: z
    .enum(["stub", "slow", "fail_retryable", "fail_terminal"])
    .default("stub"),
});

export const env = envSchema.parse(process.env);
export type Env = z.infer<typeof envSchema>;
```

- [ ] **Step 4: Write the implementation**

Create `apps/api/src/modules/issues/decide.ts`:

```ts
import { setTimeout as delay } from "node:timers/promises";
import type { IssueRow } from "@/modules/issues/types";
import { RetryableError, TerminalError } from "@/queue/retry-policy";

export type DecideOpts = { signal?: AbortSignal };

/**
 * The processing step — the seam the AI decisioning layer replaces.
 *
 * v1 has no intelligence: it resolves, and the caller parks the issue in
 * `needs_review` for a human. That is an honest stub rather than a fabricated
 * verdict, and it makes the whole pipeline real end to end without pretending.
 *
 * The next cycle replaces the body with prompt assembly + an Anthropic call,
 * and adds a `mapAnthropicError()` that classifies 429/5xx/timeouts as
 * `RetryableError` and 400/401 as `TerminalError`. Nothing in the queue layer
 * changes, and `retry-policy.ts` never learns what Anthropic is.
 */
export const decide = async (
  _issue: IssueRow,
  opts: DecideOpts,
): Promise<void> => {
  // Read at call time, not module load, so a test can flip modes per case.
  switch (process.env.DECIDE_MODE ?? "stub") {
    case "fail_retryable":
      throw new RetryableError("simulated transient upstream failure");
    case "fail_terminal":
      throw new TerminalError("simulated permanent upstream failure");
    case "slow":
      // Honours the abort signal — throws on abort instead of running to term.
      await delay(30_000, undefined, { signal: opts.signal });
      return;
    default:
      return;
  }
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter api test -- decide`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/issues apps/api/src/config
git commit -m "feat(api): decide() seam with fault-injection modes"
```

---

### Task 8: Lifecycle guard and worker repository methods

**Files:**
- Create: `apps/api/src/modules/issues/lifecycle.ts`
- Modify: `apps/api/src/modules/issues/repository.ts`
- Test: `apps/api/src/modules/issues/__tests__/lifecycle.test.ts`
- Test: `apps/api/src/modules/issues/__tests__/worker-repository.test.ts`

**Interfaces:**
- Consumes: `IssueStatus` from `@/modules/issues/types`.
- Produces: `hasLeftTheQueue(status: IssueStatus): boolean` from `@/modules/issues/lifecycle`; `issuesRepository.beginProcessing(issue: IssueRow): Promise<void>` and `issuesRepository.parkForHumanReview(issue: IssueRow, reason: string): Promise<void>`.

- [ ] **Step 1: Write the failing lifecycle test**

Create `apps/api/src/modules/issues/__tests__/lifecycle.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { hasLeftTheQueue } from "@/modules/issues/lifecycle";

describe("hasLeftTheQueue", () => {
  it("is false while the issue is still the queue's responsibility", () => {
    expect(hasLeftTheQueue("pending")).toBe(false);
    expect(hasLeftTheQueue("processing")).toBe(false);
  });

  it("is true once a human owns the issue", () => {
    expect(hasLeftTheQueue("needs_review")).toBe(true);
    expect(hasLeftTheQueue("on_hold")).toBe(true);
    expect(hasLeftTheQueue("resolved")).toBe(true);
    expect(hasLeftTheQueue("escalated")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter api test -- lifecycle`
Expected: FAIL — cannot resolve `@/modules/issues/lifecycle`.

- [ ] **Step 3: Write the lifecycle guard**

Create `apps/api/src/modules/issues/lifecycle.ts`:

```ts
import type { IssueStatus } from "@/modules/issues/types";

// The only two statuses the worker is responsible for.
const OWNED_BY_QUEUE: IssueStatus[] = ["pending", "processing"];

/**
 * Has this issue already passed out of the queue's control?
 *
 * The `process_issue` handler's entry guard. It closes the window where the
 * outcome transaction commits and the process dies before the job is marked
 * complete: the job is retried against finished work, and without this check
 * the issue would be decided twice.
 *
 * Deliberately NOT the same thing as `state-machine.ts`, which maps human
 * review verbs to statuses. This asks a different question.
 */
export const hasLeftTheQueue = (status: IssueStatus): boolean =>
  !OWNED_BY_QUEUE.includes(status);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter api test -- lifecycle`
Expected: PASS (2 tests).

- [ ] **Step 5: Write the failing repository test**

Create `apps/api/src/modules/issues/__tests__/worker-repository.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { pool } from "@/db/client";
import { ingestIssue } from "@/modules/issues/ingest";
import { issuesRepository } from "@/modules/issues/repository";
import { createIssueSchema } from "@/modules/issues/schema";
import { declineBody } from "@/modules/issues/__tests__/fixtures";

const seed = () => ingestIssue(createIssueSchema.parse(declineBody));

const historyOf = async (issueId: string) =>
  (
    await pool.query(
      "SELECT from_status, to_status, actor FROM issue_status_history WHERE issue_id = $1 ORDER BY at",
      [issueId],
    )
  ).rows;

describe("beginProcessing", () => {
  it("moves a pending issue to processing and records it", async () => {
    const issue = (await seed())!;
    await issuesRepository.beginProcessing(issue);

    const [updated] = (
      await pool.query("SELECT status FROM issues WHERE id = $1", [issue.id])
    ).rows;
    expect(updated.status).toBe("processing");
    expect(await historyOf(issue.id)).toEqual([
      { from_status: null, to_status: "pending", actor: "system" },
      { from_status: "pending", to_status: "processing", actor: "system" },
    ]);
  });

  it("records nothing when the issue is already processing", async () => {
    // A retried job re-enters here. The transition is a fact that happened
    // once, so it must be logged once — otherwise the audit trail grows a
    // duplicate row for every retry.
    const issue = (await seed())!;
    await issuesRepository.beginProcessing(issue);
    await issuesRepository.beginProcessing({ ...issue, status: "processing" });

    expect(await historyOf(issue.id)).toHaveLength(2);
  });
});

describe("parkForHumanReview", () => {
  it("moves the issue to needs_review with the reason recorded", async () => {
    const issue = (await seed())!;
    await issuesRepository.beginProcessing(issue);
    await issuesRepository.parkForHumanReview(
      { ...issue, status: "processing" },
      "awaiting human decision",
    );

    const [updated] = (
      await pool.query("SELECT status FROM issues WHERE id = $1", [issue.id])
    ).rows;
    expect(updated.status).toBe("needs_review");

    const [last] = (
      await pool.query(
        "SELECT to_status, actor, reason FROM issue_status_history WHERE issue_id = $1 ORDER BY at DESC LIMIT 1",
        [issue.id],
      )
    ).rows;
    expect(last).toEqual({
      to_status: "needs_review",
      actor: "system",
      reason: "awaiting human decision",
    });
  });

  it("writes no decision row — v1 has no decider", async () => {
    const issue = (await seed())!;
    await issuesRepository.parkForHumanReview(issue, "awaiting human decision");

    const { rows } = await pool.query("SELECT id FROM issue_decisions");
    expect(rows).toEqual([]);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `pnpm --filter api test -- worker-repository`
Expected: FAIL — `issuesRepository.beginProcessing is not a function`.

- [ ] **Step 7: Add a `reason` column to status history**

The worker needs to record *why* an issue was parked. Modify `issueStatusHistory` in `apps/api/src/modules/issues/model.ts` — add the column after `actor`:

```ts
  actor: text("actor").notNull(), // 'system' (intake, worker) | 'human'
  // Why this transition happened. Set by the worker when it parks an issue
  // (e.g. "processing failed permanently: …"); null for human reviews, whose
  // rationale lives in the linked decision's `justification`.
  reason: text("reason"),
```

Generate and apply:

```bash
pnpm --filter api db:generate
pnpm --filter api db:migrate
```

Expected: a new `drizzle/0003_*.sql` with `ALTER TABLE "issue_status_history" ADD COLUMN "reason" text;`

- [ ] **Step 8: Add the two repository methods**

Add to `issuesRepository` in `apps/api/src/modules/issues/repository.ts`, after `insertIfNew`:

```ts
  /**
   * Marks the start of processing. Idempotent: a retried job re-enters here
   * with the issue already `processing`, and the transition must stay a single
   * fact in the audit trail rather than gaining a row per retry.
   *
   * Note this is NOT a mutual-exclusion claim. Only one worker holds a given
   * job at a time — that is the job lease's guarantee, and using this update as
   * a lock instead would strand any issue whose worker died mid-job.
   */
  async beginProcessing(issue: IssueRow): Promise<void> {
    if (issue.status === "processing") return;

    await db.transaction(async (tx) => {
      await tx
        .update(issues)
        .set({ status: "processing" })
        .where(eq(issues.id, issue.id));
      await tx.insert(issueStatusHistory).values({
        issueId: issue.id,
        fromStatus: issue.status,
        toStatus: "processing",
        actor: "system",
      });
    });
  },

  /**
   * Hands the issue to a human, recording why.
   *
   * Both exits from the worker land here: the ordinary one (v1 has no decider,
   * so every issue needs a person) and the failure one (processing failed
   * permanently). No decision row is written — nothing has decided anything.
   */
  async parkForHumanReview(issue: IssueRow, reason: string): Promise<void> {
    await db.transaction(async (tx) => {
      await tx
        .update(issues)
        .set({ status: "needs_review" })
        .where(eq(issues.id, issue.id));
      await tx.insert(issueStatusHistory).values({
        issueId: issue.id,
        fromStatus: issue.status,
        toStatus: "needs_review",
        actor: "system",
        reason,
      });
    });
  },
```

- [ ] **Step 9: Run test to verify it passes**

Run: `pnpm --filter api test -- worker-repository`
Expected: PASS (4 tests).

- [ ] **Step 10: Run the full suite**

Run: `pnpm --filter api test`
Expected: all PASS. The `reason` column is nullable, so existing audit-trail tests are unaffected.

- [ ] **Step 11: Commit**

```bash
git add apps/api/src apps/api/drizzle
git commit -m "feat(api): lifecycle guard and worker status transitions"
```

---

### Task 9: The `process_issue` handler

**Files:**
- Create: `apps/api/src/modules/issues/tasks/process-issue.ts`
- Test: `apps/api/src/modules/issues/__tests__/process-issue.test.ts`

**Interfaces:**
- Consumes: `hasLeftTheQueue` (Task 8), `beginProcessing`/`parkForHumanReview` (Task 8), `decide` (Task 7), `isRetryable`/`MAX_ATTEMPTS` (Task 3).
- Produces: `processIssue(payload: { issueId: string }, helpers: ProcessHelpers): Promise<void>` from `@/modules/issues/tasks/process-issue`, where `ProcessHelpers = { job: { attempts: number }; abortSignal?: AbortSignal }`.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/modules/issues/__tests__/process-issue.test.ts`:

```ts
import { afterEach, describe, expect, it } from "vitest";
import { pool } from "@/db/client";
import { ingestIssue } from "@/modules/issues/ingest";
import { createIssueSchema } from "@/modules/issues/schema";
import { processIssue } from "@/modules/issues/tasks/process-issue";
import { declineBody } from "@/modules/issues/__tests__/fixtures";

const seed = async () => (await ingestIssue(createIssueSchema.parse(declineBody)))!;

// The worker calls tasks with a rich `helpers`; the handler needs only these
// two fields, so tests supply them directly. No runner, no timers, no flake.
const helpers = (attempts: number) => ({ job: { attempts } });

const statusOf = async (issueId: string) =>
  (await pool.query("SELECT status FROM issues WHERE id = $1", [issueId]))
    .rows[0].status;

const historyOf = async (issueId: string) =>
  (
    await pool.query(
      "SELECT to_status, reason FROM issue_status_history WHERE issue_id = $1 ORDER BY at",
      [issueId],
    )
  ).rows;

afterEach(() => {
  delete process.env.DECIDE_MODE;
});

describe("processIssue", () => {
  it("takes a pending issue through processing and parks it for a human", async () => {
    const issue = await seed();
    await processIssue({ issueId: issue.id }, helpers(1));

    expect(await statusOf(issue.id)).toBe("needs_review");
    expect((await historyOf(issue.id)).map((r) => r.to_status)).toEqual([
      "pending",
      "processing",
      "needs_review",
    ]);
  });

  it("does nothing when the issue has already left the queue", async () => {
    // The crash-after-commit window: the outcome committed, then the process
    // died before the job was marked done, so the job is retried against
    // finished work. Without the entry guard the issue is decided twice.
    const issue = await seed();
    await processIssue({ issueId: issue.id }, helpers(1));
    const before = await historyOf(issue.id);

    await processIssue({ issueId: issue.id }, helpers(2));

    expect(await historyOf(issue.id)).toEqual(before);
  });

  it("does nothing when the issue no longer exists", async () => {
    await expect(
      processIssue(
        { issueId: "00000000-0000-0000-0000-000000000009" },
        helpers(1),
      ),
    ).resolves.toBeUndefined();
  });

  it("rethrows a retryable failure mid-budget so the queue backs off", async () => {
    const issue = await seed();
    process.env.DECIDE_MODE = "fail_retryable";

    await expect(processIssue({ issueId: issue.id }, helpers(3))).rejects.toThrow();

    // Critically: still `processing`, NOT parked. The issue is not abandoned,
    // and the next attempt will re-enter cleanly.
    expect(await statusOf(issue.id)).toBe("processing");
  });

  it("parks the issue instead of throwing on the final attempt", async () => {
    // Graphile Worker has no "fail permanently now" signal — throwing always
    // means retry. So the only way to reach a terminal outcome is to NOT throw:
    // swallow, park the issue where an operator sees it, report success. A
    // failed job row is something nobody looks at; the human lane gets worked.
    const issue = await seed();
    process.env.DECIDE_MODE = "fail_retryable";

    await expect(
      processIssue({ issueId: issue.id }, helpers(8)),
    ).resolves.toBeUndefined();

    expect(await statusOf(issue.id)).toBe("needs_review");
    const last = (await historyOf(issue.id)).at(-1);
    expect(last.reason).toMatch(/permanently/i);
  });

  it("parks the issue on the first attempt for a terminal failure", async () => {
    const issue = await seed();
    process.env.DECIDE_MODE = "fail_terminal";

    await expect(
      processIssue({ issueId: issue.id }, helpers(1)),
    ).resolves.toBeUndefined();

    expect(await statusOf(issue.id)).toBe("needs_review");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter api test -- process-issue`
Expected: FAIL — cannot resolve `@/modules/issues/tasks/process-issue`.

- [ ] **Step 3: Write the implementation**

Create `apps/api/src/modules/issues/tasks/process-issue.ts`:

```ts
import { decide } from "@/modules/issues/decide";
import { hasLeftTheQueue } from "@/modules/issues/lifecycle";
import { issuesRepository } from "@/modules/issues/repository";
import { isRetryable, MAX_ATTEMPTS } from "@/queue/retry-policy";

export type ProcessIssuePayload = { issueId: string };

/** The subset of Graphile Worker's `helpers` this handler actually uses. */
export type ProcessHelpers = {
  job: { attempts: number };
  abortSignal?: AbortSignal;
};

const reasonFrom = (err: unknown): string =>
  `processing failed permanently: ${err instanceof Error ? err.message : String(err)}`;

export const processIssue = async (
  { issueId }: ProcessIssuePayload,
  helpers: ProcessHelpers,
): Promise<void> => {
  const issue = await issuesRepository.findByIdOrExternalId(issueId);
  if (!issue) return; // deleted between enqueue and run — nothing to do
  if (hasLeftTheQueue(issue.status)) return; // entry guard

  await issuesRepository.beginProcessing(issue);
  const processing = { ...issue, status: "processing" as const };

  try {
    await decide(processing, { signal: helpers.abortSignal });
  } catch (err) {
    // Without this last-attempt check, an exhausted retryable failure lets the
    // queue mark the job permanently failed — stranding the issue in
    // `processing`, where nobody is looking.
    const lastChance = helpers.job.attempts >= MAX_ATTEMPTS.processIssue;
    if (isRetryable(err) && !lastChance) throw err; // → exponential backoff

    await issuesRepository.parkForHumanReview(processing, reasonFrom(err));
    return; // job SUCCEEDS — the dead letter is a human lane, not a void
  }

  // v1 has no decider, so every successfully-processed issue needs a person.
  await issuesRepository.parkForHumanReview(
    processing,
    "awaiting human decision",
  );
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter api test -- process-issue`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/issues
git commit -m "feat(api): process_issue handler with retry, entry guard and human-lane dead letter"
```

---

### Task 10: The ingest task and file source

**Files:**
- Create: `apps/api/src/modules/issues/sources/file-source.ts`
- Create: `apps/api/src/modules/issues/tasks/ingest-issues.ts`
- Create: `apps/api/src/modules/issues/tasks/index.ts`
- Test: `apps/api/src/modules/issues/__tests__/ingest-issues.test.ts`

**Interfaces:**
- Consumes: `ingestIssue` (Task 5), `createIssueSchema` from `@/modules/issues/schema`.
- Produces: `fetchIssues(): CreateIssueInput[]` from `@/modules/issues/sources/file-source`; `ingestIssues(): Promise<void>` from `@/modules/issues/tasks/ingest-issues`; a barrel at `@/modules/issues/tasks` re-exporting `processIssue` and `ingestIssues`.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/modules/issues/__tests__/ingest-issues.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { pool } from "@/db/client";
import { ingestIssues } from "@/modules/issues/tasks/ingest-issues";
import { listJobs } from "@test/queue";

describe("ingestIssues", () => {
  it("pulls every issue from the source and queues one job each", async () => {
    await ingestIssues();

    const { rows } = await pool.query("SELECT external_id FROM issues ORDER BY external_id");
    expect(rows.map((r) => r.external_id)).toEqual([
      "iss_001",
      "iss_002",
      "iss_003",
      "iss_004",
      "iss_005",
    ]);

    const jobs = await listJobs();
    expect(jobs).toHaveLength(5);
    expect(jobs.every((j) => j.task_identifier === "process_issue")).toBe(true);
  });

  it("is a no-op on every tick after the first", async () => {
    // The cron re-reads the whole file every minute. Because ingest dedupes on
    // the source's id, that costs nothing — which is why this design needs no
    // watermark/cursor at all.
    await ingestIssues();
    await ingestIssues();
    await ingestIssues();

    const { rows } = await pool.query("SELECT id FROM issues");
    expect(rows).toHaveLength(5);
    expect(await listJobs()).toHaveLength(5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter api test -- ingest-issues`
Expected: FAIL — cannot resolve `@/modules/issues/tasks/ingest-issues`.

- [ ] **Step 3: Write the source**

Create `apps/api/src/modules/issues/sources/file-source.ts`:

```ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createIssueSchema, type CreateIssueInput } from "@/modules/issues/schema";

// apps/api/src/modules/issues/sources/ -> repo root docs/initial/
const dataPath = fileURLToPath(
  new URL("../../../../../../docs/initial/payment_issues.json", import.meta.url),
);

/**
 * Stands in for the upstream payments platform.
 *
 * Reads the whole feed every call rather than tracking a watermark. That is
 * only safe because ingestion dedupes on the source's own id — a real API
 * needs a cursor, since it cannot re-fetch all history every minute.
 */
export const fetchIssues = (): CreateIssueInput[] => {
  const raw = JSON.parse(readFileSync(dataPath, "utf8")) as unknown[];
  return raw.map((issue) => createIssueSchema.parse(issue));
};
```

- [ ] **Step 4: Verify the relative path resolves**

Run: `pnpm --filter api test -- ingest-issues`
Expected: still FAIL (the task file does not exist yet), but **not** with `ENOENT`. If you see `ENOENT`, count the directory levels from `src/modules/issues/sources/` up to the repo root again and correct `dataPath`.

- [ ] **Step 5: Write the task**

Create `apps/api/src/modules/issues/tasks/ingest-issues.ts`:

```ts
import { ingestIssue } from "@/modules/issues/ingest";
import { fetchIssues } from "@/modules/issues/sources/file-source";

/**
 * The scheduled pull from the upstream system. Each new issue is inserted and
 * queued in its own transaction, so one malformed record cannot roll back the
 * batch around it.
 */
export const ingestIssues = async (): Promise<void> => {
  for (const raw of fetchIssues()) {
    await ingestIssue(raw);
  }
};
```

- [ ] **Step 6: Create the task barrel**

Create `apps/api/src/modules/issues/tasks/index.ts`:

```ts
export { ingestIssues } from "@/modules/issues/tasks/ingest-issues";
export { processIssue } from "@/modules/issues/tasks/process-issue";
```

- [ ] **Step 7: Run test to verify it passes**

Run: `pnpm --filter api test -- ingest-issues`
Expected: PASS (2 tests).

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/modules/issues
git commit -m "feat(api): ingest_issues cron task over the file source"
```

---

### Task 11: Worker runner, crontab and entrypoint

**Files:**
- Create: `apps/api/src/queue/runner.ts`
- Create: `apps/api/src/worker/start.ts`
- Create: `apps/api/crontab`
- Modify: `apps/api/package.json`
- Test: `apps/api/src/queue/__tests__/runner.e2e.test.ts`

**Interfaces:**
- Consumes: the task barrel (Task 10).
- Produces: `taskList` and `runnerOptions` from `@/queue/runner`; `pnpm --filter api worker` starts the worker.

- [ ] **Step 1: Write the failing end-to-end test**

Create `apps/api/src/queue/__tests__/runner.e2e.test.ts`:

```ts
import { runOnce } from "graphile-worker";
import { describe, expect, it } from "vitest";
import { pool } from "@/db/client";
import { ingestIssue } from "@/modules/issues/ingest";
import { createIssueSchema } from "@/modules/issues/schema";
import { taskList } from "@/queue/runner";
import { declineBody } from "@/modules/issues/__tests__/fixtures";
import { listJobs } from "@test/queue";

describe("worker wiring", () => {
  it("drains a queued issue through the real runner", async () => {
    // Everything else is tested by calling handlers directly. This one test
    // proves the wiring: that the task name in the payload matches a task the
    // runner actually registers.
    const issue = (await ingestIssue(createIssueSchema.parse(declineBody)))!;
    expect(await listJobs()).toHaveLength(1);

    await runOnce({ pgPool: pool, taskList });

    const [updated] = (
      await pool.query("SELECT status FROM issues WHERE id = $1", [issue.id])
    ).rows;
    expect(updated.status).toBe("needs_review");
    expect(await listJobs()).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter api test -- runner`
Expected: FAIL — cannot resolve `@/queue/runner`.

- [ ] **Step 3: Write the runner config**

Create `apps/api/src/queue/runner.ts`:

```ts
import type { RunnerOptions, TaskList } from "graphile-worker";
import { pool } from "@/db/client";
import { ingestIssues, processIssue } from "@/modules/issues/tasks";
import type { ProcessHelpers, ProcessIssuePayload } from "@/modules/issues/tasks/process-issue";

/**
 * Task names are the contract between `enqueue()` and the worker. They are
 * declared here, once, so a typo shows up as a job nobody can run rather than
 * as silence.
 */
export const taskList: TaskList = {
  ingest_issues: async () => {
    await ingestIssues();
  },
  process_issue: async (payload, helpers) => {
    await processIssue(
      payload as ProcessIssuePayload,
      helpers as unknown as ProcessHelpers,
    );
  },
};

export const runnerOptions: RunnerOptions = {
  // Share the API's pool so there is one connection story, not two.
  pgPool: pool,
  taskList,
  // Left at the library default. Tuning concurrency against a rate limit is
  // for the cycle that introduces a rate limit.
};
```

- [ ] **Step 4: Write the crontab**

Create `apps/api/crontab`:

```
# Pull new issues from the upstream system.
#
# max_attempts=1: this tick IS the retry. Ingestion is idempotent and runs every
# minute, so retrying inside the job would only hammer the source for no gain.
# (The budget lives here, not in queue/retry-policy.ts — cron jobs are queued by
# the worker itself and never pass through enqueue().)
#
# No `?fill=` backfill: ingestion re-reads the entire feed and dedupes on the
# source's id, so a tick missed during downtime is fully covered by the next
# one. Backfilling would only enqueue extra ingest jobs that all no-op.
* * * * * ingest_issues ?max_attempts=1
```

- [ ] **Step 5: Write the worker entrypoint**

Create `apps/api/src/worker/start.ts`:

```ts
import "dotenv/config";
import { fileURLToPath } from "node:url";
import { run } from "graphile-worker";
import { runnerOptions } from "@/queue/runner";

// apps/api/src/worker/start.ts -> apps/api/crontab
const crontabFile = fileURLToPath(new URL("../../crontab", import.meta.url));

const runner = await run({ ...runnerOptions, crontabFile });

console.log("worker started — tasks:", Object.keys(runnerOptions.taskList!));

await runner.promise;
```

- [ ] **Step 6: Add the worker scripts**

Add to `scripts` in `apps/api/package.json`, after `"start"`:

```json
    "worker": "tsx src/worker/start.ts",
    "worker:dev": "tsx watch src/worker/start.ts",
```

- [ ] **Step 7: Run test to verify it passes**

Run: `pnpm --filter api test -- runner`
Expected: PASS.

If TypeScript rejects `crontabFile` as unknown on `RunnerOptions`, supply cron through a preset instead: create `apps/api/graphile.config.ts` exporting `{ extends: [WorkerPreset], worker: { crontabFile: "crontab" } }` and start with `run({ ...runnerOptions, preset })`. The `taskList` stays inline either way — only the cron wiring moves.

- [ ] **Step 8: Verify the worker boots and the cron registers**

In one terminal:

```bash
pnpm --filter api db:up
pnpm --filter api db:migrate
pnpm --filter api worker
```

Expected: `worker started — tasks: [ 'ingest_issues', 'process_issue' ]`, and within 60 seconds the 5 issues are ingested and processed.

In a second terminal:

```bash
docker compose -f apps/api/docker-compose.yml exec -T postgres \
  psql -U brevy -d brevy -c "SELECT external_id, status FROM issues ORDER BY external_id"
```

Expected: 5 rows, all `needs_review`. Stop the worker with Ctrl-C.

- [ ] **Step 9: Run the full suite**

Run: `pnpm --filter api test`
Expected: all PASS.

- [ ] **Step 10: Commit**

```bash
git add apps/api/src apps/api/crontab apps/api/package.json
git commit -m "feat(api): worker entrypoint, task registry and ingest crontab"
```

---

### Task 12: Backend-first README

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: everything above.
- Produces: documentation only.

- [ ] **Step 1: Rewrite the README**

Replace `README.md`. The audience is an engineer who has never seen this repo and will not open a source file before reading it. **Backend only** — cut the screens table, the frontend stack list, and the `apps/web` structure notes down to at most a single sentence acknowledging a UI exists.

Required sections, in order:

1. **What this is** — a payment-issue processing service: REST intake, a Postgres-backed job queue, and an audit trail of every status change and decision.
2. **Architecture** — the process/topology diagram from spec §4, and the flow diagram from the same section.
3. **How one issue travels the system** — prose walkthrough with a file pointer at each hop: `modules/issues/tasks/ingest-issues.ts` → `modules/issues/ingest.ts` → `queue/enqueue.ts` → `modules/issues/tasks/process-issue.ts` → `modules/issues/repository.ts`.
4. **Where state lives** — a table separating business state (`issues`, `issue_status_history`, `issue_decisions` — permanent) from operational state (`graphile_worker.*` — archived), and stating that Postgres is the system of record and the queue holds only job references.
5. **Setup** — `pnpm install`, `pnpm --filter api db:up`, `db:migrate`, then `pnpm --filter api dev` and `pnpm --filter api worker` in separate terminals.
6. **Try it yourself** — the six scenarios from spec §13, each with copy-pasteable commands. Write them out in full; see Step 2.
7. **Failure modes** — the table from spec §10 verbatim.
8. **Trade-offs and decisions** — three subsections of 2–3 paragraphs each:
   - *Database schema*: `metadata` JSONB for the type-specific tail vs. per-type tables; append-only history and decisions; at 10,000 issues/day what changes (index on `issues(status, ingested_at)`, partition or archive `issue_status_history`, a read replica for list queries).
   - *Queue design*: crash mid-processing (lease expiry, entry guard, no double decision); the AI provider down for more than an hour (8 attempts spanning ~1h18m, then the human lane); why enqueue is transactional and why that ruled out Redis.
   - *Agent architecture*: state that this cycle ships a `decide()` seam with no AI behind it and why that was the disciplined call; summarise the planned architecture from `docs/superpowers/specs/2026-07-27-ai-decisioning-layer-design.md`, including the single-agent-versus-specialised trade-off.
9. **What I'd do differently** — prioritised: real AI behind `decide()`; split `decide_issue` from `execute_action` once actions move money; a webhook intake route plus a durable cursor for a real upstream API; a circuit breaker so an outage does not burn every issue's retry budget in parallel; per-worker test databases to restore parallel test execution.

- [ ] **Step 2: Write the six scenarios with real commands**

Include this section verbatim, adjusting only if a command differs in your environment:

````markdown
### 1. Happy path

```bash
pnpm --filter api db:up && pnpm --filter api db:migrate
pnpm --filter api worker          # terminal 1
pnpm --filter api dev             # terminal 2
curl -s localhost:3333/issues | jq '.[] | {external_id: .externalId, status}'
```

Within a minute the cron ingests all 5 issues and the worker moves each to
`needs_review`.

### 2. Idempotency

```bash
pnpm --filter api seed
pnpm --filter api seed            # run it again
curl -s localhost:3333/issues | jq 'length'     # still 5
```

The second run prints `skip (already exists)` for every issue and queues nothing.

### 3. Crash recovery

```bash
DECIDE_MODE=slow pnpm --filter api worker       # terminal 1
pnpm --filter api seed                          # terminal 2
# Ctrl-C the worker while an issue is mid-flight, then restart it:
pnpm --filter api worker
```

The job's lock expires, the restarted worker picks the same issue back up, and
it completes exactly once.

### 4. Retry with backoff

```bash
DECIDE_MODE=fail_retryable pnpm --filter api worker
```

Watch the attempt counter climb and the next run time push further out:

```bash
watch -n5 'docker compose -f apps/api/docker-compose.yml exec -T postgres \
  psql -U brevy -d brevy -c \
  "SELECT task_identifier, attempts, run_at, last_error FROM graphile_worker.jobs"'
```

### 5. Exhaustion lands in a human lane

Leave scenario 4 running. After 8 attempts (~1h18m — or edit
`MAX_ATTEMPTS.processIssue` in `src/queue/retry-policy.ts` to shorten it):

```bash
curl -s localhost:3333/issues?status=needs_review | jq 'length'
```

The issue is in `needs_review` with the failure in its history, and the job row
is gone rather than left permanently failed.

### 6. Human review loop

```bash
ID=$(curl -s localhost:3333/issues | jq -r '.[0].id')
curl -s -X POST localhost:3333/issues/$ID/review \
  -H 'content-type: application/json' \
  -d '{"decision":"resolve","justification":"retried on a new card","reviewer":"ops@brevy.com"}'
curl -s localhost:3333/issues/$ID | jq '.status, .auditTrail.timeline'
```

The status flips to `resolved` and the timeline shows the full journey:
intake → processing → needs_review → resolved, with the decision attached.
````

- [ ] **Step 3: Verify every command in the README actually runs**

Work through all six scenarios against a running stack. Fix any command that
errors. Do not ship a README containing a command you have not executed.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: backend-first README covering the processing pipeline"
```

---

## Definition of done

- [ ] `pnpm --filter api test` passes.
- [ ] `pnpm --filter api lint` passes.
- [ ] `pnpm --filter api worker` ingests and processes all 5 issues from a clean database.
- [ ] All six README scenarios have been executed by hand.
- [ ] No Anthropic SDK dependency, no `confidence` column, no confidence routing (spec §14).
