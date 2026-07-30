import type { IssueStatus } from "@/modules/issues/types";

// The only two statuses the worker is responsible for.
const OWNED_BY_QUEUE: IssueStatus[] = ["pending", "processing"];

/**
 * Has this issue already passed out of the queue's control?
 *
 * The `process_issue` handler's entry guard. It closes the window where the
 * outcome transaction commits and the process dies before the job is marked
 * complete: the job is retried against finished work, and without this check
 * the issue would be decided twice.
 *
 * Deliberately NOT the same thing as `state-machine.ts`, which maps human
 * review verbs to statuses. This asks a different question.
 */
export const hasLeftTheQueue = (status: IssueStatus): boolean =>
  !OWNED_BY_QUEUE.includes(status);
