import { useQuery } from "@tanstack/react-query";
import { fetchLocal } from "@/shared/api/local";
import type { IssueViewModel } from "@/modules/operators/types";

export function useIssue(id: string) {
  return useQuery({
    queryKey: ["operators", "issue", id],
    queryFn: () => fetchLocal<IssueViewModel>(`/api/operators/issues/${id}`),
    enabled: !!id,
  });
}
