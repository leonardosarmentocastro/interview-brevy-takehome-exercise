import { useQuery } from "@tanstack/react-query";
import { fetchLocal } from "@/shared/api/local";
import type { AgentSummary, BoardColumns } from "@/modules/operators/types";

export function useIssues() {
  return useQuery({
    queryKey: ["operators", "issues"],
    queryFn: () =>
      fetchLocal<{ columns: BoardColumns; agentSummary: AgentSummary }>(
        "/api/operators/issues",
      ),
  });
}
