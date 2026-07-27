import type { BoardColumns, IssueViewModel, Lane } from "@/modules/operators/types";

const COLUMNS: Lane[] = ["needs_review", "in_review", "on_hold", "resolved"];

export function groupByColumn(viewModels: IssueViewModel[]): BoardColumns {
  const grouped = Object.fromEntries(COLUMNS.map((c) => [c, []])) as BoardColumns;
  for (const vm of viewModels) {
    const lane = vm.decision?.lane;
    if (lane && grouped[lane]) grouped[lane].push(vm);
  }
  return grouped;
}
