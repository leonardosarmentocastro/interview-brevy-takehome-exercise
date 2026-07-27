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
