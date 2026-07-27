import { describe, expect, it } from "vitest";
import { groupByColumn } from "@/modules/operators/utils/group-by-column";
import type { IssueViewModel } from "@/modules/operators/types";

const vm = (id: string, lane: string) =>
  ({ issue: { id }, decision: { lane } }) as unknown as IssueViewModel;

describe("groupByColumn", () => {
  it("buckets view models by decision.lane into the four columns", () => {
    const grouped = groupByColumn([
      vm("a", "needs_review"),
      vm("b", "resolved"),
      vm("c", "needs_review"),
    ]);
    expect(grouped.needs_review.map((v) => v.issue.id)).toEqual(["a", "c"]);
    expect(grouped.resolved).toHaveLength(1);
    expect(grouped.in_review).toEqual([]);
  });
});
