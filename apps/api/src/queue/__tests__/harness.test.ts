import { describe, expect, it } from "vitest";
import { listJobs } from "@test/queue";

describe("queue harness", () => {
  it("exposes an empty graphile_worker.jobs view", async () => {
    expect(await listJobs()).toEqual([]);
  });
});
