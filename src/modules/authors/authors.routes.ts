import { Router, type Response } from "express";
import { idParamsSchema, type IdParams } from "../../lib/request.schemas.js";
import { validate } from "../../middleware/validate.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requireAuthenticatedUser } from "../../lib/auth.js";
import { publishAllPostsByAuthor } from "../posts/posts.service.js";

export const authorsRouter = Router();

authorsRouter.post(
  "/:id/publish-all",
  authenticate,
  validate(idParamsSchema, "params"),
  async (req, res: Response<{ message: string }, { params: IdParams }>) => {
    const { username, count } = await publishAllPostsByAuthor(
      res.locals.params.id,
      requireAuthenticatedUser(req.user),
    );
    res.status(200).json({ message: `Published ${count} posts for ${username}` });
  },
);
