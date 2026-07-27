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
