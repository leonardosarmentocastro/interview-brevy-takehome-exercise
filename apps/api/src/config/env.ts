import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(3333),
});

export const env = envSchema.parse(process.env);
export type Env = z.infer<typeof envSchema>;
