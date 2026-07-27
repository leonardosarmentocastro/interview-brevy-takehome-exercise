import type { BoardColumns, IssueViewModel } from "@/modules/operators/types";

export function groupByColumn(viewModels: IssueViewModel[]): BoardColumns {
  const grouped: BoardColumns = {
    needs_review: [],
    in_review: [],
    on_hold: [],
    resolved: [],
  };
  for (const vm of viewModels) {
    const lane = vm.decision?.lane;
    if (lane && grouped[lane]) grouped[lane].push(vm);
  }
  return grouped;
}
