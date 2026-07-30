import { describe, expect, it } from "vitest";
import {
  getCustomerHandler,
  getTransactionHandler,
} from "@/modules/issues/ai/agent/tools";

const parse = (result: { content: { type: string; text: string }[] }) =>
  JSON.parse(result.content[0].text);

describe("getCustomerHandler", () => {
  it("returns one customer record", async () => {
    expect(parse(await getCustomerHandler({ id: "cust_042" }))).toMatchObject({
      id: "cust_042",
      lifetime_spend: 1847.5,
    });
  });

  it("reports a miss instead of throwing", async () => {
    // A thrown tool error ends the run; a reported miss lets the agent
    // declare a data gap, which is a decision we can score.
    expect(parse(await getCustomerHandler({ id: "cust_nope" }))).toMatchObject({
      error: expect.stringContaining("cust_nope"),
    });
  });
});

describe("getTransactionHandler", () => {
  it("returns one transaction record", async () => {
    expect(parse(await getTransactionHandler({ id: "txn_5998" }))).toMatchObject({
      id: "txn_5998",
      shipping: { status: "not_shipped" },
    });
  });

  it("returns only the requested record, never the whole file", async () => {
    const result = parse(await getTransactionHandler({ id: "txn_5998" }));
    expect(Array.isArray(result)).toBe(false);
  });

  it("reports a miss instead of throwing", async () => {
    expect(parse(await getTransactionHandler({ id: "txn_nope" }))).toMatchObject({
      error: expect.stringContaining("txn_nope"),
    });
  });
});
