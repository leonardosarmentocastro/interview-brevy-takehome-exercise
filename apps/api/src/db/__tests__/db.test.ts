import { describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { issues } from "@/modules/issues/model";

describe("persistence pack", () => {
  it("connects and the issues table is queryable", async () => {
    const rows = await db.select().from(issues);
    expect(rows).toEqual([]);
  });
});
