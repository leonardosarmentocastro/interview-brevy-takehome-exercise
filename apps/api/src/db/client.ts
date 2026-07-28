import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "@/config/env";

// `pool` manages a reusable set of Postgres connections, lending one out per
// query so concurrent requests don't block each other.
export const pool = new Pool({ connectionString: env.DATABASE_URL });
// `db` builds/maps typed queries but delegates execution to `pool`.
export const db = drizzle(pool);
