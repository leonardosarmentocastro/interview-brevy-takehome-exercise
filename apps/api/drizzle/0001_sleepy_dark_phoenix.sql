CREATE TYPE "public"."decision_actor" AS ENUM('human', 'agent');--> statement-breakpoint
ALTER TYPE "public"."issue_status" ADD VALUE 'on_hold' BEFORE 'resolved';--> statement-breakpoint
CREATE TABLE "issue_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"issue_id" uuid NOT NULL,
	"actor" "decision_actor" NOT NULL,
	"decision" text NOT NULL,
	"justification" text NOT NULL,
	"decided_by" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "issue_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"issue_id" uuid NOT NULL,
	"from_status" "issue_status",
	"to_status" "issue_status" NOT NULL,
	"actor" text NOT NULL,
	"decision_id" uuid,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "issue_decisions" ADD CONSTRAINT "issue_decisions_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_status_history" ADD CONSTRAINT "issue_status_history_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_status_history" ADD CONSTRAINT "issue_status_history_decision_id_issue_decisions_id_fk" FOREIGN KEY ("decision_id") REFERENCES "public"."issue_decisions"("id") ON DELETE no action ON UPDATE no action;