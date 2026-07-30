import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.url(),
  PORT: z.coerce.number().default(3333),
  // Demo/test scaffolding for the v1 decide() stub — see
  // modules/issues/ai/decide.ts. Removed once a real decider lands.
  DECIDE_MODE: z
    .enum(["stub", "slow", "fail_retryable", "fail_terminal"])
    .default("stub"),
  // Optional so the API and the test suite boot without it. Only the worker's
  // agent path needs it, and it fails loudly there if absent.
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
});

export const env = envSchema.parse(process.env);
export type Env = z.infer<typeof envSchema>;
