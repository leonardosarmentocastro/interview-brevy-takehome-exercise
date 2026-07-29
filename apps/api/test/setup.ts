import { afterAll, beforeEach } from "vitest";
import { pool } from "@/db/client";

beforeEach(async () => {
  await pool.query(
    "TRUNCATE TABLE issues, issue_decisions, issue_status_history RESTART IDENTITY CASCADE",
  );
});

afterAll(async () => {
  await pool.end();
});
