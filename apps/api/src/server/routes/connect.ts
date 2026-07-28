import { type Express } from "express";
import { healthRouter } from "@/modules/health/routes";
import { issuesRouter } from "@/modules/issues/routes";

/**
 * Mounts every module's router on the app under its base path. New modules
 * should be added here so routing lives in one place.
 */
export const connectRoutes = (app: Express): void => {
  app.use("/health", healthRouter);
  app.use("/issues", issuesRouter);
};
