import { Router } from "express";
import * as resolvers from "@/modules/health/resolvers";

export const healthRouter = Router();

healthRouter.get("/", resolvers.getHealthResolver);
