import type { DecisionRow, StatusHistoryRow } from "@/modules/issues/types";

// A single chronological entry. The timeline is DERIVED from the source tables
// on read — never persisted — so it can't drift from the facts.
export type TimelineEntry = {
  kind: "status" | "decision";
  at: Date;
  actor: string;
  fromStatus?: StatusHistoryRow["fromStatus"];
  toStatus?: StatusHistoryRow["toStatus"];
  decision?: string;
  justification?: string;
};

export const mergeTimeline = (
  history: StatusHistoryRow[],
  decisions: DecisionRow[],
): TimelineEntry[] => {
  const entries: TimelineEntry[] = [
    ...history.map((h) => ({
      kind: "status" as const,
      at: h.at,
      actor: h.actor,
      fromStatus: h.fromStatus,
      toStatus: h.toStatus,
    })),
    ...decisions.map((d) => ({
      kind: "decision" as const,
      at: d.at,
      actor: d.actor,
      decision: d.decision,
      justification: d.justification,
    })),
  ];
  return entries.sort((a, b) => a.at.getTime() - b.at.getTime());
};
