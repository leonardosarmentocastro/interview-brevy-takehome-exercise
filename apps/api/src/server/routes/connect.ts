import { Router, type Express } from "express";
import { z } from "zod";
import { ConflictError, NotFoundError } from "@/db/data/errors";
import { healthRouter } from "@/modules/health/routes";

/**
 * Mounts every module's router on the app under its base path. New modules
 * should be added here so routing lives in one place.
 */
export const connectRoutes = (app: Express): void => {
  app.use("/health", healthRouter);

  // Test-only routes that deliberately trigger each branch of the global error
  // handler, so middleware behavior can be tested where it is owned
  // (server/middlewares) instead of through an unrelated domain module.
  if (process.env.NODE_ENV === "test") {
    const testMiddlewaresRouter = Router();

    // Accepts a POST so a malformed body makes express.json() throw before the
    // handler runs, exercising the body-parse branch.
    testMiddlewaresRouter.post("/json", (_req, res) => {
      res.status(200).json({ ok: true });
    });
    testMiddlewaresRouter.get("/zod-error", () => {
      z.object({ id: z.string() }).parse({});
    });
    testMiddlewaresRouter.get("/not-found", () => {
      throw new NotFoundError("resource not found");
    });
    testMiddlewaresRouter.get("/conflict", () => {
      throw new ConflictError("resource already exists");
    });
    testMiddlewaresRouter.get("/boom", () => {
      throw new Error("unexpected failure");
    });

    app.use("/test/middlewares", testMiddlewaresRouter);
  }
};
