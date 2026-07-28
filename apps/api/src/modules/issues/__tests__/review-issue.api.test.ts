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
