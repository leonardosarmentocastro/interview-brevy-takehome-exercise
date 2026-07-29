import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import type {
  issues,
  issueDecisions,
  issueStatusHistory,
} from "@/modules/issues/model";

export type IssueRow = InferSelectModel<typeof issues>;
export type NewIssue = InferInsertModel<typeof issues>;
export type IssueStatus = IssueRow["status"];

export type DecisionRow = InferSelectModel<typeof issueDecisions>;
export type StatusHistoryRow = InferSelectModel<typeof issueStatusHistory>;
