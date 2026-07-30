import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import { startServer, stopServer } from "@test/helpers";
import { ingestIssue } from "@/modules/issues/ingestion/ingest";
import { createIssueSchema } from "@/modules/issues/schema";
import { issuesRepository } from "@/modules/issues/repository";
import { declineBody } from "./fixtures";

describe("GET /issues/:id — agent decisions", () => {
  let server: Server;
  let base: string;
  beforeAll(async () => {
    ({ server, base } = await startServer());
  });
  afterAll(async () => {
    await stopServer(server);
  });

  it("exposes the agent's verdict, confidence and trace in the audit trail", async () => {
    const issue = (await ingestIssue(createIssueSchema.parse(declineBody)))!;
    await issuesRepository.applyAgentDecision(issue, {
      recommendation: "auto_resolve",
      decision: "resolve",
      target: "resolved",
      band: "auto_execute",
      reasoning: "Both conditions hold.",
      model: "claude-opus-5",
      confidence: 0.95,
      confidenceBase: 0.95,
      scoreBreakdown: { base: 0.95, penalties: [], caps: [], final: 0.95 },
      trace: [{ src: 78, rule: "r", status: "fired", evidence: "e" }],
      reason: "agent recommended auto_resolve at 95%",
    });

    const res = await fetch(`${base}/issues/${issue.id}`);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.status).toBe("resolved");
    expect(body.decisions[0]).toMatchObject({
      actor: "agent",
      recommendation: "auto_resolve",
      routingBand: "auto_execute",
      confidence: 0.95,
      decidedBy: "claude-opus-5",
    });
    expect(body.decisions[0].trace[0].src).toBe(78);
    // The arithmetic travels with the decision, so a reviewer can check the
    // score rather than trust it.
    expect(body.decisions[0].scoreBreakdown).toMatchObject({ final: 0.95 });
    expect(body.timeline.some((e: { kind: string }) => e.kind === "decision")).toBe(true);
  });
});
