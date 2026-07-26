import express, { type Express } from "express";
import {
  connectErrorHandler,
  connectMiddlewares,
} from "@/server/middlewares/connect";
import { connectRoutes } from "@/server/routes/connect";

export const createApp = (): Express => {
  const app = express();

  connectMiddlewares(app);
  connectRoutes(app);
  connectErrorHandler(app);

  return app;
};
