import { Router } from "express";
import { usersRouter } from "./modules/users/users.routes.js";

export const router = Router();

router.use("/users", usersRouter);
