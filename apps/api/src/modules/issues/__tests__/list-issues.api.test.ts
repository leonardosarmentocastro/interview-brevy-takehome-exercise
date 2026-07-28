import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import { startServer, stopServer } from "@test/helpers";
import { declineBody, missedInstallmentBody, postIssue } from "./fixtures";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { issues } from "@/modules/issues/model";

describe("GET /issues", () => {
  let server: Server;
  let base: string;
  const declineId = "iss_001";
  const missedId = "iss_002";
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
    await postIssue(base, { ...declineBody, id: declineId }); // first
    await postIssue(base, { ...missedInstallmentBody, id: missedId }); // second
    const list = await (await fetch(`${base}/issues`)).json();
    expect(list).toHaveLength(2);
    expect(list[0].externalId).toBe(missedId); // most recently ingested first
    expect(list[1].externalId).toBe(declineId);
  });

  it("filters by a single status", async () => {
    await postIssue(base, { ...declineBody, id: declineId }); // defaults to `pending`
    const resolved = await (
      await fetch(`${base}/issues?status=resolved`)
    ).json();
    expect(resolved).toEqual([]);
    const pending = await (await fetch(`${base}/issues?status=pending`)).json();
    expect(pending).toHaveLength(1);
    expect(pending[0].externalId).toBe(declineId);
  });

  it("filters by comma-separated statuses (union)", async () => {
    await postIssue(base, { ...declineBody, id: declineId }); // pending
    await postIssue(base, { ...missedInstallmentBody, id: missedId }); // pending
    // Arrange only: no HTTP path sets status yet, so flip one row directly.
    await db
      .update(issues)
      .set({ status: "processing" })
      .where(eq(issues.externalId, missedId));

    const both = await (
      await fetch(`${base}/issues?status=pending,processing`)
    ).json();
    expect(both).toHaveLength(2);

    const onlyProcessing = await (
      await fetch(`${base}/issues?status=processing`)
    ).json();
    expect(onlyProcessing.map((i: { externalId: string }) => i.externalId)).toEqual([
      missedId,
    ]);
  });

  it("rejects an unknown status value (400)", async () => {
    const res = await fetch(`${base}/issues?status=banana`);
    expect(res.status).toBe(400);
  });
});
