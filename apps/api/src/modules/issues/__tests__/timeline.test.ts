import { describe, expect, it } from "vitest";
import { mergeTimeline } from "@/modules/issues/timeline";
import type { DecisionRow, StatusHistoryRow } from "@/modules/issues/types";

// Minimal row factories — only the fields mergeTimeline reads matter; the rest
// are filled with representative placeholders to satisfy the row types.
const statusRow = (
  over: Partial<StatusHistoryRow> & { at: Date },
): StatusHistoryRow => ({
  id: "sh_1",
  issueId: "iss_1",
  fromStatus: "processing",
  toStatus: "resolved",
  actor: "human",
  decisionId: null,
  ...over,
});

const decisionRow = (
  over: Partial<DecisionRow> & { at: Date },
): DecisionRow => ({
  id: "dec_1",
  issueId: "iss_1",
  actor: "human",
  decision: "resolve",
  justification: "retry succeeded",
  decidedBy: "agent_lee",
  ...over,
});

describe("mergeTimeline", () => {
  it("returns an empty timeline when there is nothing to merge", () => {
    expect(mergeTimeline([], [])).toEqual([]);
  });

  it("maps a status-history row to a status entry", () => {
    const at = new Date("2026-01-01T00:00:00Z");
    const [entry] = mergeTimeline(
      [statusRow({ at, fromStatus: null, toStatus: "pending", actor: "system" })],
      [],
    );
    expect(entry).toEqual({
      kind: "status",
      at,
      actor: "system",
      fromStatus: null,
      toStatus: "pending",
    });
    // decision-only fields are absent on a status entry
    expect(entry).not.toHaveProperty("decision");
    expect(entry).not.toHaveProperty("justification");
  });

  it("maps a decision row to a decision entry", () => {
    const at = new Date("2026-01-01T00:00:00Z");
    const [entry] = mergeTimeline(
      [],
      [decisionRow({ at, decision: "escalate", justification: "high value" })],
    );
    expect(entry).toEqual({
      kind: "decision",
      at,
      actor: "human",
      decision: "escalate",
      justification: "high value",
    });
    // status-only fields are absent on a decision entry
    expect(entry).not.toHaveProperty("fromStatus");
    expect(entry).not.toHaveProperty("toStatus");
  });

  it("interleaves both kinds into a single chronological (ascending) order", () => {
    const t1 = new Date("2026-01-01T10:00:00Z"); // intake (status)
    const t2 = new Date("2026-01-01T11:00:00Z"); // decision
    const t3 = new Date("2026-01-01T12:00:00Z"); // transition (status)

    // Pass rows out of order to prove the merge sorts rather than relying on
    // input order or grouping by kind.
    const timeline = mergeTimeline(
      [
        statusRow({ id: "sh_2", at: t3, fromStatus: "processing", toStatus: "resolved" }),
        statusRow({ id: "sh_1", at: t1, fromStatus: null, toStatus: "pending" }),
      ],
      [decisionRow({ at: t2 })],
    );

    expect(timeline.map((e) => [e.at, e.kind])).toEqual([
      [t1, "status"],
      [t2, "decision"],
      [t3, "status"],
    ]);
  });
});
