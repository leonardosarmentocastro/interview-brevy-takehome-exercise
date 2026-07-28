import { Router } from "express";
import * as resolvers from "@/modules/issues/resolvers";

export const issuesRouter = Router();

issuesRouter.post("/", resolvers.createIssueResolver);
issuesRouter.get("/", resolvers.listIssuesResolver);
issuesRouter.get("/:id", resolvers.getIssueResolver);
