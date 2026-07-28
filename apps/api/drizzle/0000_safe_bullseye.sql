CREATE TYPE "public"."issue_status" AS ENUM('pending', 'processing', 'resolved', 'escalated');--> statement-breakpoint
CREATE TYPE "public"."issue_type" AS ENUM('decline', 'missed_installment', 'dispute', 'refund_request');--> statement-breakpoint
CREATE TABLE "issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" text NOT NULL,
	"type" "issue_type" NOT NULL,
	"customer_id" text NOT NULL,
	"transaction_id" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"merchant" text,
	"status" "issue_status" DEFAULT 'pending' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "issues_external_id_unique" UNIQUE("external_id")
);
