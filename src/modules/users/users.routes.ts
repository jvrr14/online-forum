import { Router, type Response } from "express";
import { validate } from "../../middleware/validate.js";
import {
  createUserSchema,
  idParamsSchema,
  type CreateUserInput,
  type UserIdParams,
} from "./users.schemas.js";
import * as usersService from "./users.service.js";
import type { UserResponse } from "./users.service.js";

export const usersRouter = Router();

usersRouter.get("/", async (_req, res) => {
  res.json(await usersService.listUsers());
});

usersRouter.get(
  "/:id",
  validate(idParamsSchema, "params"),
  async (_req, res: Response<UserResponse, { params: UserIdParams }>) => {
    res.json(await usersService.getUser(res.locals.params.id));
  },
);

usersRouter.post(
  "/",
  validate(createUserSchema, "body"),
  async (_req, res: Response<UserResponse, { body: CreateUserInput }>) => {
    res.status(201).json(await usersService.createUser(res.locals.body));
  },
);
