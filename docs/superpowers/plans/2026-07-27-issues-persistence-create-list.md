# Issues Persistence + Create/List Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Drizzle/Postgres persistence pack in `apps/api` and deliver `POST /issues` (create) + `GET /issues` (list-all, newest first) for payment issues.

**Architecture:** First persistent module in a currently database-free API. Hybrid schema — typed core columns + a `metadata` jsonb for the type-specific tail. Incoming bodies are validated by a per-`type` **discriminated union** (non-strict branches) then normalized to a storage row (`amount = amount ?? amount_due`, raw `amount_due` retained in `metadata`; source `id` → unique `external_id`; server-generated uuid PK). Follows the house resolver pattern (`model` / `schema` / `types` / `repository` / `resolvers` / `routes`) and the API `AGENTS.md` "Adding persistence" playbook.

**Tech Stack:** TypeScript (ESM), Express 5, Drizzle ORM + `node-postgres` (`pg`), Postgres 16 (docker-compose), Zod v4, Vitest (HTTP-level tests, `fileParallelism: false`), `drizzle-kit` generate + committed SQL migrations.

## Global Constraints

- **Feature branch already created:** `feat/issues-persistence-create-list` (branched from `docs/ai-decisioning-spec`). Do not commit on `main`/`master`.
- **TDD, vertical slices only:** one failing test → minimal implementation → pass → commit. Never skip the red step.
- **Tests live in `__tests__/` at the same level as the file under test.** API tests exercise the **HTTP** surface. One `<verb>-<noun>.api.test.ts` per resolver; unit logic (schema normalization) in `schema.test.ts`; shared test data in `fixtures.ts`.
- **Resolver pattern:** a resolver *is* an Express handler `(req, res, next) => Promise<void>`; wrap the body in `try/catch` and forward errors with `next(err)`. Never translate errors inline — the central error handler owns that.
- **All data access through `repository.ts`.** Resolvers never build queries or import `db` directly.
- **Routing lives in one place:** mount every module router in `src/server/routes/connect.ts`.
- **Migrations:** `drizzle-kit generate` → committed SQL under `apps/api/drizzle/`. Never `drizzle-kit push`.
- **Schema decisions (verbatim from spec):** server uuid PK `id`; `external_id` `UNIQUE` (duplicate → `409 Conflict`); single `amount` column normalized from `amount ?? amount_due` with raw `amount_due` kept in `metadata`; `merchant` nullable; `status` enum `pending|processing|resolved|escalated` default `pending` (only `pending` is ever written this slice); `created_at` = preserved source timestamp, `ingested_at` = server insert time; discriminated-union validation with **non-strict** branches.
- **Out of scope (do not build):** `?status=` filtering, `GET /issues/:id`, `POST /issues/:id/review`, status-history/decisions/customer/transaction tables, the queue, the AI harness.

---

### Task 1: Stand up the Drizzle/Postgres pack + `issues` table

Brings up the persistence infra (deps, env, client, docker Postgres, drizzle config, test-DB hooks) **and** the `issues` model + first committed migration. Deliverable: a smoke test proves the pack connects and the `issues` table is queryable, and the existing suite runs green through the new test-DB harness.

**Files:**
- Modify: `apps/api/package.json` (deps + scripts)
- Modify: `apps/api/src/config/env.ts`
- Create: `apps/api/src/db/client.ts`
- Create: `apps/api/src/modules/issues/model.ts`
- Create: `apps/api/src/modules/issues/types.ts`
- Create: `apps/api/src/db/schema.ts`
- Create: `apps/api/drizzle.config.ts`
- Create: `apps/api/docker-compose.yml`
- Create: `apps/api/docker/initdb/01-create-test-db.sql`
- Create: `apps/api/.env` (gitignored) and `apps/api/.env.example` (committed)
- Modify: `apps/api/vitest.config.ts`
- Create: `apps/api/test/global-setup.ts`
- Create: `apps/api/test/setup.ts`
- Create: `apps/api/src/db/__tests__/db.test.ts`
- Create (generated): `apps/api/drizzle/0000_*.sql` + `apps/api/drizzle/meta/*`

**Interfaces:**
- Produces: `db` and `pool` from `@/db/client`; `issues`, `issueType`, `issueStatus` from `@/modules/issues/model`; `IssueRow`, `NewIssue` from `@/modules/issues/types`.

- [ ] **Step 1: Install dependencies**

```bash
pnpm --filter api add drizzle-orm pg
pnpm --filter api add -D drizzle-kit @types/pg
```

- [ ] **Step 2: Add `DATABASE_URL` to the env schema**

Modify `apps/api/src/config/env.ts`:

```ts
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.url(),
  PORT: z.coerce.number().default(3333),
});

export const env = envSchema.parse(process.env);
export type Env = z.infer<typeof envSchema>;
```

- [ ] **Step 3: Create the Drizzle client**

Create `apps/api/src/db/client.ts`:

```ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "@/config/env";

// `pool` manages a reusable set of Postgres connections, lending one out per
// query so concurrent requests don't block each other.
export const pool = new Pool({ connectionString: env.DATABASE_URL });
// `db` builds/maps typed queries but delegates execution to `pool`.
export const db = drizzle(pool);
```

- [ ] **Step 4: Create the `issues` model**

Create `apps/api/src/modules/issues/model.ts`:

```ts
import {
  pgTable,
  uuid,
  text,
  numeric,
  jsonb,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";

export const issueType = pgEnum("issue_type", [
  "decline",
  "missed_installment",
  "dispute",
  "refund_request",
]);

export const issueStatus = pgEnum("issue_status", [
  "pending",
  "processing",
  "resolved",
  "escalated",
]);

export const issues = pgTable("issues", {
  id: uuid("id").primaryKey().defaultRandom(),
  // The issue's id in the upstream/source system (e.g. "iss_001"). Unique so a
  // re-submitted or re-seeded issue can't double-insert (idempotency seam).
  externalId: text("external_id").notNull().unique(),
  type: issueType("type").notNull(),
  customerId: text("customer_id").notNull(),
  transactionId: text("transaction_id").notNull(),
  // Normalized money figure (amount ?? amount_due). numeric mode:"number"
  // returns a JS number on select.
  amount: numeric("amount", { precision: 12, scale: 2, mode: "number" }).notNull(),
  merchant: text("merchant"), // nullable — absent on missed_installment
  status: issueStatus("status").notNull().default("pending"),
  // Type-specific tail (error_code, days_overdue, reason, raw amount_due, ...).
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(), // source time
  ingestedAt: timestamp("ingested_at", { withTimezone: true }).notNull().defaultNow(), // system time
});
```

- [ ] **Step 5: Create the inferred row types**

Create `apps/api/src/modules/issues/types.ts`:

```ts
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import type { issues } from "@/modules/issues/model";

export type IssueRow = InferSelectModel<typeof issues>;
export type NewIssue = InferInsertModel<typeof issues>;
```

- [ ] **Step 6: Create the aggregated Drizzle schema barrel**

Create `apps/api/src/db/schema.ts` (drizzle-kit reads this single entry point):

```ts
export * from "@/modules/issues/model";
```

- [ ] **Step 7: Create the drizzle-kit config**

Create `apps/api/drizzle.config.ts`:

```ts
import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      "postgres://brevy:brevy@localhost:5432/brevy",
  },
});
```

- [ ] **Step 8: Create docker-compose + test-DB init script**

Create `apps/api/docker-compose.yml`:

```yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: brevy
      POSTGRES_PASSWORD: brevy
      POSTGRES_DB: brevy
    ports:
      - "5432:5432"
    volumes:
      - brevy_pg:/var/lib/postgresql/data
      - ./docker/initdb:/docker-entrypoint-initdb.d

volumes:
  brevy_pg:
```

Create `apps/api/docker/initdb/01-create-test-db.sql` (runs once on first container init, so the test database exists):

```sql
CREATE DATABASE brevy_test;
```

- [ ] **Step 9: Create local env files**

Create `apps/api/.env` (gitignored — used by `dev`/`seed`/`drizzle-kit`):

```
DATABASE_URL=postgres://brevy:brevy@localhost:5432/brevy
```

Create `apps/api/.env.example` (committed):

```
DATABASE_URL=postgres://brevy:brevy@localhost:5432/brevy
```

- [ ] **Step 10: Add package scripts**

Modify the `scripts` block in `apps/api/package.json` to add:

```json
    "db:up": "docker compose up -d",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "seed": "tsx scripts/seed.ts"
```

(Keep the existing `dev`, `start`, `build`, `lint`, `test` entries.)

- [ ] **Step 11: Wire the test DB into Vitest**

Replace `apps/api/vitest.config.ts` with:

```ts
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

process.env.NODE_ENV ||= "test";
process.env.DATABASE_URL ||=
  "postgres://brevy:brevy@localhost:5432/brevy_test";

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@test\//,
        replacement: fileURLToPath(new URL("./test/", import.meta.url)),
      },
      {
        find: /^@\//,
        replacement: fileURLToPath(new URL("./src/", import.meta.url)),
      },
    ],
  },
  test: {
    globalSetup: ["./test/global-setup.ts"],
    setupFiles: ["./test/setup.ts"],
    fileParallelism: false,
  },
});
```

- [ ] **Step 12: Create the Vitest global setup (migrate the test DB once)**

Create `apps/api/test/global-setup.ts`:

```ts
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

export default async function setup(): Promise<void> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);
  await migrate(db, { migrationsFolder: "./drizzle" });
  await pool.end();
}
```

- [ ] **Step 13: Create the per-test reset hook**

Create `apps/api/test/setup.ts`:

```ts
import { afterAll, beforeEach } from "vitest";
import { pool } from "@/db/client";

beforeEach(async () => {
  await pool.query("TRUNCATE TABLE issues RESTART IDENTITY CASCADE");
});

afterAll(async () => {
  await pool.end();
});
```

- [ ] **Step 14: Write the failing smoke test**

Create `apps/api/src/db/__tests__/db.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { issues } from "@/modules/issues/model";

describe("persistence pack", () => {
  it("connects and the issues table is queryable", async () => {
    const rows = await db.select().from(issues);
    expect(rows).toEqual([]);
  });
});
```

- [ ] **Step 15: Bring up Postgres and generate + apply the migration**

```bash
cd apps/api
pnpm db:up
pnpm db:generate   # emits drizzle/0000_*.sql (commit this)
pnpm db:migrate    # applies it to the dev DB (brevy)
```

Expected: a new `apps/api/drizzle/0000_*.sql` file containing `CREATE TYPE ... issue_type`, `CREATE TYPE ... issue_status`, and `CREATE TABLE "issues"` with an `external_id` unique constraint.

- [ ] **Step 16: Run the smoke test (and full suite) to verify green**

```bash
pnpm --filter api test
```

Expected: PASS. `db.test.ts` returns `[]`; the pre-existing `health` and `error-handler` suites still pass (proving `global-setup` migrated the test DB and `setup` truncated `issues` without error).

- [ ] **Step 17: Commit**

```bash
git add apps/api/package.json apps/api/src/config/env.ts apps/api/src/db \
  apps/api/src/modules/issues/model.ts apps/api/src/modules/issues/types.ts \
  apps/api/drizzle.config.ts apps/api/docker-compose.yml apps/api/docker \
  apps/api/.env.example apps/api/vitest.config.ts apps/api/test/global-setup.ts \
  apps/api/test/setup.ts apps/api/drizzle pnpm-lock.yaml
git commit -m "feat(api): stand up drizzle/postgres pack + issues table"
```

---

### Task 2: Map `ConflictError` → `409`

The central error handler currently knows `400`/`404`/`500`. A duplicate `external_id` must surface as `409`. Add the domain error and its mapping, tested where the middleware is owned.

**Files:**
- Modify: `apps/api/src/db/data/errors.ts`
- Modify: `apps/api/src/server/middlewares/error-handler-middleware.ts`
- Modify: `apps/api/src/server/routes/connect.ts` (add a test-only route)
- Modify: `apps/api/src/server/middlewares/__tests__/error-handler.test.ts`

**Interfaces:**
- Produces: `ConflictError` from `@/db/data/errors` (constructor `(message: string)`); error handler responds `409 { error: message }` for it.

- [ ] **Step 1: Write the failing test**

Add to `apps/api/src/server/middlewares/__tests__/error-handler.test.ts`, inside the `describe` block:

```ts
  it("maps ConflictError to 409", async () => {
    const res = await fetch(`${base}/test/middlewares/conflict`);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("resource already exists");
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter api test error-handler`
Expected: FAIL — the `/test/middlewares/conflict` route doesn't exist yet, so the request falls through (404) instead of 409.

- [ ] **Step 3: Add the `ConflictError` class**

Append to `apps/api/src/db/data/errors.ts`:

```ts
/**
 * Raised when a write violates a uniqueness invariant (e.g. inserting an issue
 * whose `external_id` already exists). The HTTP error handler maps it to a
 * `409 Conflict`.
 */
export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}
```

- [ ] **Step 4: Map it in the error handler**

In `apps/api/src/server/middlewares/error-handler-middleware.ts`, update the import and add the branch **before** the `NotFoundError` branch:

```ts
import { ConflictError, NotFoundError } from "@/db/data/errors";
```

```ts
  if (err instanceof ConflictError) {
    res.status(409).json({ error: err.message });
    return;
  }
  if (err instanceof NotFoundError) {
    res.status(404).json({ error: err.message });
    return;
  }
```

- [ ] **Step 5: Add the test-only route**

In `apps/api/src/server/routes/connect.ts`, update the import and add a route inside the `if (process.env.NODE_ENV === "test")` block, next to the other `testMiddlewaresRouter` routes:

```ts
import { ConflictError, NotFoundError } from "@/db/data/errors";
```

```ts
    testMiddlewaresRouter.get("/conflict", () => {
      throw new ConflictError("resource already exists");
    });
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm --filter api test error-handler`
Expected: PASS (all branches incl. the new 409).

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/db/data/errors.ts \
  apps/api/src/server/middlewares/error-handler-middleware.ts \
  apps/api/src/server/routes/connect.ts \
  apps/api/src/server/middlewares/__tests__/error-handler.test.ts
git commit -m "feat(api): map ConflictError to 409"
```

---

### Task 3: `issues` validation schema + normalization

Build the discriminated-union validator (non-strict branches) and the pure `toIssueRow` normalizer, unit-tested directly. This is where `amount`/`amount_due` normalization and the `metadata` sweep live.

**Files:**
- Create: `apps/api/src/modules/issues/schema.ts`
- Create: `apps/api/src/modules/issues/__tests__/schema.test.ts`

**Interfaces:**
- Consumes: nothing from prior tasks (pure logic).
- Produces:
  - `createIssueSchema` — `z.discriminatedUnion("type", [...])`; `.parse(body)` throws `ZodError` on invalid input.
  - `type CreateIssueInput = z.infer<typeof createIssueSchema>`.
  - `toIssueRow(input: CreateIssueInput): NewIssueRow`.
  - `type NewIssueRow = { externalId: string; type: "decline"|"missed_installment"|"dispute"|"refund_request"; customerId: string; transactionId: string; amount: number; merchant: string | null; metadata: Record<string, unknown>; createdAt: Date }`.

- [ ] **Step 1: Write the failing tests**

Create `apps/api/src/modules/issues/__tests__/schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createIssueSchema, toIssueRow } from "@/modules/issues/schema";

const decline = {
  id: "iss_001",
  type: "decline",
  transaction_id: "txn_5521",
  customer_id: "cust_042",
  error_code: "insufficient_funds",
  amount: 89.99,
  merchant: "TechGadgets.com",
  created_at: "2025-01-13T03:22:00Z",
  auto_retry_count: 2,
};

const missedInstallment = {
  id: "iss_002",
  type: "missed_installment",
  transaction_id: "txn_4892",
  customer_id: "cust_108",
  installment_number: 3,
  installments_total: 4,
  amount_due: 62.5,
  days_overdue: 5,
  created_at: "2025-01-12T00:00:00Z",
};

describe("createIssueSchema", () => {
  it("accepts a valid decline and rejects one missing error_code", () => {
    expect(createIssueSchema.safeParse(decline).success).toBe(true);
    const { error_code, ...noCode } = decline;
    expect(createIssueSchema.safeParse(noCode).success).toBe(false);
  });

  it("rejects an unknown issue type", () => {
    expect(
      createIssueSchema.safeParse({ ...decline, type: "chargeback" }).success,
    ).toBe(false);
  });
});

describe("toIssueRow", () => {
  it("maps core fields, sets external_id from source id, sweeps the tail into metadata", () => {
    const row = toIssueRow(createIssueSchema.parse(decline));
    expect(row.externalId).toBe("iss_001");
    expect(row.type).toBe("decline");
    expect(row.customerId).toBe("cust_042");
    expect(row.transactionId).toBe("txn_5521");
    expect(row.amount).toBe(89.99);
    expect(row.merchant).toBe("TechGadgets.com");
    expect(row.createdAt).toBeInstanceOf(Date);
    expect(row.metadata).toMatchObject({
      error_code: "insufficient_funds",
      auto_retry_count: 2,
    });
    // core fields must NOT be duplicated into metadata
    expect(row.metadata).not.toHaveProperty("id");
    expect(row.metadata).not.toHaveProperty("amount");
  });

  it("normalizes amount_due -> amount, keeps raw amount_due in metadata, merchant null", () => {
    const row = toIssueRow(createIssueSchema.parse(missedInstallment));
    expect(row.amount).toBe(62.5);
    expect(row.merchant).toBeNull();
    expect(row.metadata).toMatchObject({
      amount_due: 62.5,
      installment_number: 3,
      installments_total: 4,
      days_overdue: 5,
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter api test schema`
Expected: FAIL — `@/modules/issues/schema` has no exports yet.

- [ ] **Step 3: Implement the schema + normalizer**

Create `apps/api/src/modules/issues/schema.ts`:

```ts
import { z } from "zod";

const base = {
  id: z.string().min(1),
  customer_id: z.string().min(1),
  transaction_id: z.string().min(1),
  created_at: z.string().min(1),
};

// `.passthrough()` keeps unknown keys so a not-yet-modeled field still flows
// into `metadata` instead of being rejected (non-strict branches).
const decline = z
  .object({
    ...base,
    type: z.literal("decline"),
    amount: z.number(),
    merchant: z.string(),
    error_code: z.enum(["insufficient_funds", "card_expired"]),
    auto_retry_count: z.number().optional(),
    is_recurring: z.boolean().optional(),
  })
  .passthrough();

const missedInstallment = z
  .object({
    ...base,
    type: z.literal("missed_installment"),
    amount_due: z.number(),
    installment_number: z.number(),
    installments_total: z.number(),
    days_overdue: z.number(),
  })
  .passthrough();

const dispute = z
  .object({
    ...base,
    type: z.literal("dispute"),
    amount: z.number(),
    merchant: z.string(),
    reason: z.string().min(1),
    days_since_purchase: z.number(),
  })
  .passthrough();

const refundRequest = z
  .object({
    ...base,
    type: z.literal("refund_request"),
    amount: z.number(),
    merchant: z.string(),
    reason: z.string().min(1),
    days_since_purchase: z.number(),
    installment_plan: z.boolean().optional(),
    installments_paid: z.number().optional(),
  })
  .passthrough();

export const createIssueSchema = z.discriminatedUnion("type", [
  decline,
  missedInstallment,
  dispute,
  refundRequest,
]);

export type CreateIssueInput = z.infer<typeof createIssueSchema>;

export type NewIssueRow = {
  externalId: string;
  type: CreateIssueInput["type"];
  customerId: string;
  transactionId: string;
  amount: number;
  merchant: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
};

// Keys that map to typed columns; everything else is the type-specific tail.
const COLUMN_KEYS = new Set([
  "id",
  "type",
  "customer_id",
  "transaction_id",
  "amount",
  "merchant",
  "created_at",
]);

export const toIssueRow = (input: CreateIssueInput): NewIssueRow => {
  const raw = input as Record<string, unknown>;

  const metadata: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    // amount_due is intentionally NOT a column, so it stays in metadata.
    if (!COLUMN_KEYS.has(key)) metadata[key] = value;
  }

  const amount =
    typeof raw.amount === "number" ? raw.amount : (raw.amount_due as number);
  const merchant = typeof raw.merchant === "string" ? raw.merchant : null;

  return {
    externalId: input.id,
    type: input.type,
    customerId: input.customer_id,
    transactionId: input.transaction_id,
    amount,
    merchant,
    metadata,
    createdAt: new Date(input.created_at),
  };
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter api test schema`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/issues/schema.ts \
  apps/api/src/modules/issues/__tests__/schema.test.ts
git commit -m "feat(api): issues discriminated-union schema + amount normalization"
```

---

### Task 4: `POST /issues` — create (repository + resolver + route)

Wire the create path end to end and test it over HTTP: `201` on success, `400` on an invalid body, `409` on a duplicate `external_id`.

**Files:**
- Create: `apps/api/src/modules/issues/repository.ts`
- Create: `apps/api/src/modules/issues/resolvers/create-issue-resolver.ts`
- Create: `apps/api/src/modules/issues/resolvers/index.ts`
- Create: `apps/api/src/modules/issues/routes.ts`
- Modify: `apps/api/src/server/routes/connect.ts` (mount `/issues`)
- Create: `apps/api/src/modules/issues/__tests__/fixtures.ts`
- Create: `apps/api/src/modules/issues/__tests__/create-issue.api.test.ts`

**Interfaces:**
- Consumes: `createIssueSchema`, `toIssueRow`, `NewIssueRow` from `@/modules/issues/schema`; `IssueRow` from `@/modules/issues/types`; `ConflictError` from `@/db/data/errors`; `db` from `@/db/client`.
- Produces:
  - `issuesRepository.create(row: NewIssueRow): Promise<IssueRow>` (throws `ConflictError` on unique violation).
  - `createIssueResolver` (Express handler); `issuesRouter` mounted at `/issues`; POST `/` → `201` with the created `IssueRow`.
  - Test fixtures `declineBody`, `missedInstallmentBody`, `postIssue(base, body)` from `./fixtures`.

- [ ] **Step 1: Write the failing test + fixtures**

Create `apps/api/src/modules/issues/__tests__/fixtures.ts`:

```ts
export const declineBody = {
  id: "iss_001",
  type: "decline",
  transaction_id: "txn_5521",
  customer_id: "cust_042",
  error_code: "insufficient_funds",
  amount: 89.99,
  merchant: "TechGadgets.com",
  created_at: "2025-01-13T03:22:00Z",
  auto_retry_count: 2,
};

export const missedInstallmentBody = {
  id: "iss_002",
  type: "missed_installment",
  transaction_id: "txn_4892",
  customer_id: "cust_108",
  installment_number: 3,
  installments_total: 4,
  amount_due: 62.5,
  days_overdue: 5,
  created_at: "2025-01-12T00:00:00Z",
};

export const postIssue = (base: string, body: unknown) =>
  fetch(`${base}/issues`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
```

Create `apps/api/src/modules/issues/__tests__/create-issue.api.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import { startServer, stopServer } from "@test/helpers";
import { declineBody, missedInstallmentBody, postIssue } from "./fixtures";

describe("POST /issues", () => {
  let server: Server;
  let base: string;
  beforeAll(async () => {
    ({ server, base } = await startServer());
  });
  afterAll(async () => {
    await stopServer(server);
  });

  it("creates an issue (201) with a server id, pending status, normalized amount", async () => {
    const res = await postIssue(base, missedInstallmentBody);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toMatch(/[0-9a-f-]{36}/); // server-generated uuid
    expect(body.externalId).toBe("iss_002");
    expect(body.status).toBe("pending");
    expect(body.amount).toBe(62.5); // normalized from amount_due
    expect(body.merchant).toBeNull();
    expect(body.metadata.amount_due).toBe(62.5); // raw retained
  });

  it("rejects an invalid body (400)", async () => {
    const { error_code, ...noCode } = declineBody;
    const res = await postIssue(base, noCode);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("validation_error");
  });

  it("rejects a duplicate external_id (409)", async () => {
    await postIssue(base, declineBody);
    const res = await postIssue(base, declineBody);
    expect(res.status).toBe(409);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter api test create-issue`
Expected: FAIL — `POST /issues` is not mounted (requests 404), and `@/modules/issues/repository` doesn't exist.

- [ ] **Step 3: Implement the repository**

Create `apps/api/src/modules/issues/repository.ts`:

```ts
import { desc } from "drizzle-orm";
import { db } from "@/db/client";
import { issues } from "@/modules/issues/model";
import { ConflictError } from "@/db/data/errors";
import type { NewIssueRow } from "@/modules/issues/schema";
import type { IssueRow } from "@/modules/issues/types";

const UNIQUE_VIOLATION = "23505"; // Postgres error code for unique constraint

export const issuesRepository = {
  async create(row: NewIssueRow): Promise<IssueRow> {
    try {
      const [created] = await db.insert(issues).values(row).returning();
      return created;
    } catch (err) {
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        (err as { code?: string }).code === UNIQUE_VIOLATION
      ) {
        throw new ConflictError(
          `issue with external_id ${row.externalId} already exists`,
        );
      }
      throw err;
    }
  },

  async list(): Promise<IssueRow[]> {
    return db.select().from(issues).orderBy(desc(issues.ingestedAt));
  },
};
```

- [ ] **Step 4: Implement the create resolver + barrel**

Create `apps/api/src/modules/issues/resolvers/create-issue-resolver.ts`:

```ts
import type { Request, Response, NextFunction } from "express";
import { createIssueSchema, toIssueRow } from "@/modules/issues/schema";
import { issuesRepository } from "@/modules/issues/repository";

export const createIssueResolver = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const input = createIssueSchema.parse(req.body);
    const created = await issuesRepository.create(toIssueRow(input));
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
};
```

Create `apps/api/src/modules/issues/resolvers/index.ts`:

```ts
export * from "@/modules/issues/resolvers/create-issue-resolver";
```

- [ ] **Step 5: Create the router and mount it**

Create `apps/api/src/modules/issues/routes.ts`:

```ts
import { Router } from "express";
import * as resolvers from "@/modules/issues/resolvers";

export const issuesRouter = Router();

issuesRouter.post("/", resolvers.createIssueResolver);
```

In `apps/api/src/server/routes/connect.ts`, add the import and mount (next to the health mount):

```ts
import { issuesRouter } from "@/modules/issues/routes";
```

```ts
  app.use("/issues", issuesRouter);
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm --filter api test create-issue`
Expected: PASS (201, 400, 409).

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/issues/repository.ts \
  apps/api/src/modules/issues/resolvers apps/api/src/modules/issues/routes.ts \
  apps/api/src/server/routes/connect.ts \
  apps/api/src/modules/issues/__tests__/fixtures.ts \
  apps/api/src/modules/issues/__tests__/create-issue.api.test.ts
git commit -m "feat(api): POST /issues create endpoint"
```

---

### Task 5: `GET /issues` — list (newest first)

Add the list resolver + route, tested over HTTP: `200`, array, ordered by `ingested_at DESC`.

**Files:**
- Create: `apps/api/src/modules/issues/resolvers/list-issues-resolver.ts`
- Modify: `apps/api/src/modules/issues/resolvers/index.ts`
- Modify: `apps/api/src/modules/issues/routes.ts`
- Create: `apps/api/src/modules/issues/__tests__/list-issues.api.test.ts`

**Interfaces:**
- Consumes: `issuesRepository.list()` (Task 4); `postIssue` (Task 4 fixtures).
- Produces: `listIssuesResolver`; GET `/issues` → `200` with `IssueRow[]` ordered `ingested_at DESC`.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/modules/issues/__tests__/list-issues.api.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import { startServer, stopServer } from "@test/helpers";
import { declineBody, missedInstallmentBody, postIssue } from "./fixtures";

describe("GET /issues", () => {
  let server: Server;
  let base: string;
  beforeAll(async () => {
    ({ server, base } = await startServer());
  });
  afterAll(async () => {
    await stopServer(server);
  });

  it("returns an empty array when there are no issues (200)", async () => {
    const res = await fetch(`${base}/issues`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("lists issues newest-first by ingestion order", async () => {
    await postIssue(base, declineBody); // iss_001 first
    await postIssue(base, missedInstallmentBody); // iss_002 second
    const list = await (await fetch(`${base}/issues`)).json();
    expect(list).toHaveLength(2);
    expect(list[0].externalId).toBe("iss_002"); // most recently ingested first
    expect(list[1].externalId).toBe("iss_001");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter api test list-issues`
Expected: FAIL — `GET /issues` returns 404 (no route / resolver yet).

- [ ] **Step 3: Implement the list resolver**

Create `apps/api/src/modules/issues/resolvers/list-issues-resolver.ts`:

```ts
import type { Request, Response, NextFunction } from "express";
import { issuesRepository } from "@/modules/issues/repository";

export const listIssuesResolver = async (
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    res.status(200).json(await issuesRepository.list());
  } catch (err) {
    next(err);
  }
};
```

- [ ] **Step 4: Export it and add the route**

Append to `apps/api/src/modules/issues/resolvers/index.ts`:

```ts
export * from "@/modules/issues/resolvers/list-issues-resolver";
```

Add to `apps/api/src/modules/issues/routes.ts` (below the POST line):

```ts
issuesRouter.get("/", resolvers.listIssuesResolver);
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter api test list-issues`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/issues/resolvers/list-issues-resolver.ts \
  apps/api/src/modules/issues/resolvers/index.ts \
  apps/api/src/modules/issues/routes.ts \
  apps/api/src/modules/issues/__tests__/list-issues.api.test.ts
git commit -m "feat(api): GET /issues list endpoint"
```

---

### Task 6: Seed script (the 5 issues, via the repository)

A one-command seed that ingests the five fixtures **through the repository** (validation + normalization first), idempotent by `external_id`. Deliverable satisfies "accepts the 5 issues from `payment_issues.json`."

**Files:**
- Create: `apps/api/scripts/seed.ts`

**Interfaces:**
- Consumes: `createIssueSchema`, `toIssueRow` (Task 3); `issuesRepository` (Task 4); `ConflictError` (Task 2); `pool` (Task 1).

- [ ] **Step 1: Write the seed script**

Create `apps/api/scripts/seed.ts`:

```ts
import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createIssueSchema, toIssueRow } from "@/modules/issues/schema";
import { issuesRepository } from "@/modules/issues/repository";
import { ConflictError } from "@/db/data/errors";
import { pool } from "@/db/client";

// apps/api/scripts/seed.ts -> repo root docs/initial/payment_issues.json
const dataPath = fileURLToPath(
  new URL("../../../docs/initial/payment_issues.json", import.meta.url),
);

async function main(): Promise<void> {
  const issues = JSON.parse(readFileSync(dataPath, "utf8")) as unknown[];
  for (const raw of issues) {
    const row = toIssueRow(createIssueSchema.parse(raw));
    try {
      const created = await issuesRepository.create(row);
      console.log(`seeded ${created.externalId} -> ${created.id}`);
    } catch (err) {
      if (err instanceof ConflictError) {
        console.log(`skip ${row.externalId} (already exists)`);
        continue;
      }
      throw err;
    }
  }
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Run the seed against the dev DB (verify it ingests all 5)**

```bash
cd apps/api
pnpm db:up          # ensure Postgres is running
pnpm db:migrate     # ensure the dev DB (brevy) has the issues table
pnpm seed
```

Expected: five `seeded iss_00x -> <uuid>` lines.

- [ ] **Step 3: Run it again (verify idempotency)**

```bash
pnpm seed
```

Expected: five `skip iss_00x (already exists)` lines, no error, exit 0.

- [ ] **Step 4: Verify via the API**

```bash
pnpm dev &   # starts the API on :3333 (Ctrl-C when done)
curl -s http://localhost:3333/issues | head -c 400
```

Expected: a JSON array containing the five issues (`external_id` `iss_001`…`iss_005`), each with a server `id`, `status: "pending"`, a normalized `amount`, and the type-specific tail under `metadata`.

- [ ] **Step 5: Commit**

```bash
git add apps/api/scripts/seed.ts
git commit -m "feat(api): seed script for the 5 payment issues"
```

---

## Self-Review

**Spec coverage:**
- §1 scope (`POST /issues`, `GET /issues`, Postgres+Drizzle) → Tasks 4, 5, 1. ✅
- §3 persistence pack (client, env, drizzle.config, docker-compose, test hooks, scripts, deps) → Task 1. ✅
- §4.1 model (columns + enums, source vs system time, `ingested_at DESC`) → Task 1 (model), Task 5 (ordering). ✅
- §4.2 schema (discriminated union non-strict, `amount ?? amount_due`, raw `amount_due` in metadata, `id`→`external_id`) → Task 3. ✅
- §4.3 repository (`create` w/ 23505→Conflict, `list`) → Task 4. ✅
- §4.4 resolvers (`createIssueResolver` 201/400/409, `listIssuesResolver` 200) → Tasks 4, 5. ✅
- §4.5 routes + mount → Tasks 4, 5. ✅
- §5 `ConflictError` → 409 → Task 2. ✅
- §6 tests (one file per resolver, `schema.test.ts`, `fixtures.ts`, middleware 409 branch) → Tasks 2, 3, 4, 5. ✅
- §7 seed via repository → Task 6. ✅
- §2 decision 7 committed SQL migrations → Task 1 (Step 15, `drizzle/` committed in Step 17). ✅

**Placeholder scan:** No TBD/TODO/"handle edge cases"/"similar to Task N" — every code and command step is concrete. ✅

**Type consistency:** `NewIssueRow` (fields `externalId`/`type`/`customerId`/`transactionId`/`amount`/`merchant`/`metadata`/`createdAt`) is defined in Task 3 and consumed identically by `issuesRepository.create` (Task 4) and `seed.ts` (Task 6). `issuesRepository.create`/`.list` signatures match between definition (Task 4) and consumers (Tasks 5, 6). `ConflictError(message)` constructor matches between definition (Task 2) and throw sites (Task 4). Drizzle field names (`ingestedAt`, `externalId`) match between model (Task 1) and query usage (Tasks 4, 5). ✅
