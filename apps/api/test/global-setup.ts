import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { runMigrations } from "graphile-worker";
import { Pool } from "pg";

export default async function setup(): Promise<void> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);
  await migrate(db, { migrationsFolder: "./drizzle" });
  await pool.end();

  // Installs the `graphile_worker` schema. Separate from Drizzle: the queue
  // library owns its own migrations in its own schema, so the two never collide.
  await runMigrations({ connectionString: process.env.DATABASE_URL! });
}
