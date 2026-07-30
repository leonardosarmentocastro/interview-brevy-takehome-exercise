import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.url(),
  PORT: z.coerce.number().default(3333),
  // `agent` is production. The other modes are fault injection the queue tests
  // drive retry, abort and dead-letter behaviour through — see
  // modules/issues/ai/decide.ts and tasks/__tests__/process-issue.test.ts.
  DECIDE_MODE: z
    .enum(["agent", "stub", "slow", "fail_retryable", "fail_terminal"])
    .default("agent"),
  // Optional so the API and the test suite boot without it. Only the worker's
  // agent path needs it, and it fails loudly there if absent.
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
});

export const env = envSchema.parse(process.env);
export type Env = z.infer<typeof envSchema>;
