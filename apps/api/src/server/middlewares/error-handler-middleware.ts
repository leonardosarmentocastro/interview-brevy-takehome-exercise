import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { NotFoundError } from "@/db/data/errors";

// `express.json()` throws a SyntaxError tagged `entity.parse.failed` when the
// request body isn't valid JSON. That's a client mistake (400), not a server
// fault (500).
const isBodyParseError = (err: unknown): boolean =>
  err instanceof SyntaxError &&
  "type" in err &&
  (err as { type?: unknown }).type === "entity.parse.failed";

export const errorHandlerMiddleware = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  if (isBodyParseError(err)) {
    res.status(400).json({ error: "invalid_json" });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({ error: "validation_error", issues: err.issues });
    return;
  }
  if (err instanceof NotFoundError) {
    res.status(404).json({ error: err.message });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "internal_server_error" });
};
