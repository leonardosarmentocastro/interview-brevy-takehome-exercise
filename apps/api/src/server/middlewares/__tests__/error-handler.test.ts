import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import { startServer, stopServer } from "@test/helpers";

describe("error-handler middleware", () => {
  let server: Server;
  let base: string;

  beforeAll(async () => {
    ({ server, base } = await startServer());
  });
  afterAll(async () => {
    await stopServer(server);
  });

  it("maps malformed JSON to 400", async () => {
    const res = await fetch(`${base}/test/middlewares/json`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{ not json",
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_json" });
  });

  it("maps ZodError to 400", async () => {
    const res = await fetch(`${base}/test/middlewares/zod-error`);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("validation_error");
  });

  it("maps NotFoundError to 404", async () => {
    const res = await fetch(`${base}/test/middlewares/not-found`);
    expect(res.status).toBe(404);
  });

  it("maps unexpected errors to 500", async () => {
    const res = await fetch(`${base}/test/middlewares/boom`);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "internal_server_error" });
  });
});
