import express, { type Express } from "express";
import {
  connectErrorHandler,
  connectMiddlewares,
} from "@/server/middlewares/connect";
import { connectRoutes } from "@/server/routes/connect";

// `registerExtraRoutes` is an injection seam for mounting additional routers
// after the app's real routes but before the error handler — used by the test
// harness to attach routes that deliberately trigger each error branch. It is
// never passed in production, so no test code leaks into the running app.
export const createApp = (
  registerExtraRoutes?: (app: Express) => void,
): Express => {
  const app = express();

  connectMiddlewares(app);
  connectRoutes(app);
  registerExtraRoutes?.(app);
  connectErrorHandler(app);

  return app;
};
