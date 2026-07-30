import { z } from "zod";

// The three verbs the exercise defines. This enum is the injection chokepoint:
// the agent has no free-text action channel, so the most any injected
// instruction can achieve is asking for one of these — a request that still
// has to survive verification and capping.
export const AGENT_RECOMMENDATIONS = [
  "auto_resolve",
  "human_review",
  "escalate",
] as const;
export type AgentRecommendation = (typeof AGENT_RECOMMENDATIONS)[number];

export const traceNodeSchema = z.object({
  src: z.number().int().positive(), // policies.md line number
  rule: z.string().min(1),
  status: z.enum(["fired", "not_met", "cant_evaluate"]),
  evidence: z.string().min(1),
});

// The machine-checkable restatement of the evidence. `trace[].evidence` is
// prose for humans; this is the same claim in a shape verify.ts can check
// against source records. The agent must make its reasoning falsifiable
// before anything executes.
export const citedFactSchema = z.object({
  source: z.enum(["issue", "customer", "transaction"]),
  path: z.string().min(1), // dotted path, e.g. "shipping.status"
  value: z.string(),
});

export const agentDecisionSchema = z.object({
  recommendation: z.enum(AGENT_RECOMMENDATIONS),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().min(1),
  trace: z.array(traceNodeSchema).min(1),
  citedFacts: z.array(citedFactSchema),
  dataGap: z.string().nullable(),
});

export type AgentDecision = z.infer<typeof agentDecisionSchema>;
export type TraceNode = z.infer<typeof traceNodeSchema>;
export type CitedFact = z.infer<typeof citedFactSchema>;

// Handed to the SDK as `outputFormat: { type: "json_schema", schema }` so the
// model is constrained at generation time, not merely validated after.
export const agentDecisionJsonSchema = z.toJSONSchema(agentDecisionSchema) as {
  type: string;
  required?: string[];
  [key: string]: unknown;
};
