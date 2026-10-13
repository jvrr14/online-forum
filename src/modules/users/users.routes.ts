import { Router, type Response } from "express";
import { validate } from "../../middleware/validate.js";
import {
  createUserSchema,
  idParamsSchema,
  updateUserSchema,
  type CreateUserInput,
  type UpdateUserInput,
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

usersRouter.put(
  "/:id",
  validate(idParamsSchema, "params"),
  validate(updateUserSchema, "body"),
  async (_req, res: Response<UserResponse, { params: UserIdParams; body: UpdateUserInput }>) => {
    res.status(200).json(await usersService.updateUser(res.locals.params.id, res.locals.body));
  },
);

usersRouter.delete(
  "/:id",
  validate(idParamsSchema, "params"),
  async (_req, res: Response<void, { params: UserIdParams }>) => {
    await usersService.deleteUser(res.locals.params.id);
    res.status(204).send();
  },
);
