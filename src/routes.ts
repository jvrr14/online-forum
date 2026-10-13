import { Router } from "express";
import { postsRouter } from "./modules/posts/posts.routes.js";
import { usersRouter } from "./modules/users/users.routes.js";

export const apiRouter = Router();

apiRouter.use("/users", usersRouter);
apiRouter.use("/posts", postsRouter);
