import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import { startServer, stopServer } from "@test/helpers";
import { declineBody, postIssue } from "./fixtures";

describe("GET /issues/:id", () => {
  let server: Server;
  let base: string;
  const externalId = "iss_001";
  beforeAll(async () => {
    ({ server, base } = await startServer());
  });
  afterAll(async () => {
    await stopServer(server);
  });

  it("fetches an issue by its uuid (200)", async () => {
    const created = await (
      await postIssue(base, { ...declineBody, id: externalId })
    ).json();
    const res = await fetch(`${base}/issues/${created.id}`);
    expect(res.status).toBe(200);
    expect((await res.json()).externalId).toBe(externalId);
  });

  it("fetches an issue by its external_id (200)", async () => {
    await postIssue(base, { ...declineBody, id: externalId });
    const res = await fetch(`${base}/issues/${externalId}`);
    expect(res.status).toBe(200);
    expect((await res.json()).externalId).toBe(externalId);
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

  it("embeds the audit trail; a new issue's history starts at intake", async () => {
    await postIssue(base, { ...declineBody, id: externalId });
    const res = await fetch(`${base}/issues/${externalId}`);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.decisions).toEqual([]);
    expect(body.statusHistory).toHaveLength(1);
    expect(body.statusHistory[0].fromStatus).toBeNull();
    expect(body.statusHistory[0].toStatus).toBe("pending");
    expect(body.statusHistory[0].actor).toBe("system");

    expect(body.timeline).toHaveLength(1);
    expect(body.timeline[0].kind).toBe("status");
    expect(body.timeline[0].toStatus).toBe("pending");
  });
});
