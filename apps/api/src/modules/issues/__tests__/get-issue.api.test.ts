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
