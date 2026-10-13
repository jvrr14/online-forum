import { Router } from "express";
import { usersRouter } from "./modules/users/users.routes.js";

export const apiRouter = Router();

apiRouter.use("/users", usersRouter);
