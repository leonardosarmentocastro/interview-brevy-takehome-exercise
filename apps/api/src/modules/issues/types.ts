import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import type { issues } from "@/modules/issues/model";

export type IssueRow = InferSelectModel<typeof issues>;
export type NewIssue = InferInsertModel<typeof issues>;

export type IssueStatus = IssueRow["status"];
