import { Router } from "express";
import { authRouter } from "./modules/auth/auth.routes.js";
import { authorsRouter } from "./modules/authors/authors.routes.js";
import { postsRouter } from "./modules/posts/posts.routes.js";
import { usersRouter } from "./modules/users/users.routes.js";

export const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/authors", authorsRouter);
apiRouter.use("/users", usersRouter);
apiRouter.use("/posts", postsRouter);
