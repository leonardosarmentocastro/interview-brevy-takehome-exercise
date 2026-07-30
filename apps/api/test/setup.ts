import { afterAll, beforeEach } from "vitest";
import { pool } from "@/db/client";

beforeEach(async () => {
  await pool.query(
    "TRUNCATE TABLE issues, issue_decisions, issue_status_history RESTART IDENTITY CASCADE",
  );
  // `_private_jobs` is Graphile Worker's internal table. We touch it here, and
  // only here, because a test reset needs a bulk wipe and the public `jobs`
  // view is not truncatable. All *assertions* go through the public view.
  await pool.query("TRUNCATE TABLE graphile_worker._private_jobs CASCADE");
});

afterAll(async () => {
  await pool.end();
});
