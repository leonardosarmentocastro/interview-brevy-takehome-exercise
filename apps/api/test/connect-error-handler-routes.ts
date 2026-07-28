import { Router, type Express } from "express";
import { z } from "zod";
import { ConflictError, NotFoundError } from "@/db/data/errors";

/**
 * Test-only routes that deliberately trigger each branch of the global error
 * handler, so middleware behavior can be tested where it is owned
 * (server/middlewares) instead of through an unrelated domain module. Injected
 * into `createApp` from the test harness, never mounted in production.
 */
export const connectErrorHandlerRoutes = (app: Express): void => {
  const router = Router();

  // Accepts a POST so a malformed body makes express.json() throw before the
  // handler runs, exercising the body-parse branch.
  router.post("/json", (_req, res) => {
    res.status(200).json({ ok: true });
  });
  router.get("/zod-error", () => {
    z.object({ id: z.string() }).parse({});
  });
  router.get("/not-found", () => {
    throw new NotFoundError("resource not found");
  });
  router.get("/conflict", () => {
    throw new ConflictError("resource already exists");
  });
  router.get("/boom", () => {
    throw new Error("unexpected failure");
  });

  app.use("/test/middlewares", router);
};
