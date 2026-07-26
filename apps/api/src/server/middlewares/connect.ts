import cors from "cors";
import express, { type Express } from "express";
import { errorHandlerMiddleware } from "@/server/middlewares/error-handler-middleware";

/**
 * Global request middlewares, applied BEFORE routes so every handler benefits
 * from them (CORS headers, parsed JSON body, etc.).
 */
export const connectMiddlewares = (app: Express): void => {
  app.use(cors({ origin: true }));
  app.use(express.json());
};

/**
 * Terminal error-handling middleware. Kept here alongside the other
 * middlewares, but exposed separately because Express only routes errors to it
 * when it is registered AFTER the routes that may throw.
 */
export const connectErrorHandler = (app: Express): void => {
  app.use(errorHandlerMiddleware);
};
