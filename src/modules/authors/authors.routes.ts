import { Router, type Response } from "express";
import { idParamsSchema, type IdParams } from "../../lib/request.schemas.js";
import { validate } from "../../middleware/validate.js";
import { publishAllPostsByAuthor } from "../posts/posts.service.js";

export const authorsRouter = Router();

authorsRouter.post(
  "/:id/publish-all",
  validate(idParamsSchema, "params"),
  async (_req, res: Response<{ message: string }, { params: IdParams }>) => {
    const { username, count } = await publishAllPostsByAuthor(res.locals.params.id);
    res.status(200).json({ message: `Published ${count} posts for ${username}` });
  },
);
