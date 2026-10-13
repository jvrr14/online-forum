import { Router, type Response } from "express";
import type { Post, Profile } from "../../db/schema/index.js";
import { validate } from "../../middleware/validate.js";
import { listPostsQuerySchema, type ListPostsQuery } from "../posts/posts.schemas.js";
import { listPostsByUser } from "../posts/posts.service.js";
import {
  createUserSchema,
  idParamsSchema,
  listUsersQuerySchema,
  updateUserSchema,
  upsertProfileSchema,
  type CreateUserInput,
  type ListUsersQuery,
  type UpdateUserInput,
  type UpsertProfileInput,
  type UserIdParams,
} from "./users.schemas.js";
import * as usersService from "./users.service.js";
import type {
  UserDetailResponse,
  UserListResponse,
  UserResponse,
  UserWithProfile,
} from "./users.service.js";

export const usersRouter = Router();

usersRouter.get(
  "/",
  validate(listUsersQuerySchema, "query"),
  async (_req, res: Response<UserListResponse[], { query: ListUsersQuery }>) => {
    res.json(await usersService.listUsers(res.locals.query));
  },
);

usersRouter.get(
  "/:id/posts",
  validate(idParamsSchema, "params"),
  validate(listPostsQuerySchema, "query"),
  async (_req, res: Response<Post[], { params: UserIdParams; query: ListPostsQuery }>) => {
    res.json(await listPostsByUser(res.locals.params.id, res.locals.query));
  },
);

usersRouter.get(
  "/:id",
  validate(idParamsSchema, "params"),
  async (_req, res: Response<UserDetailResponse, { params: UserIdParams }>) => {
    res.json(await usersService.getUser(res.locals.params.id));
  },
);

usersRouter.post(
  "/",
  validate(createUserSchema, "body"),
  async (_req, res: Response<UserWithProfile, { body: CreateUserInput }>) => {
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

usersRouter.put(
  "/:id/profile",
  validate(idParamsSchema, "params"),
  validate(upsertProfileSchema, "body"),
  async (_req, res: Response<Profile, { params: UserIdParams; body: UpsertProfileInput }>) => {
    res.status(200).json(await usersService.upsertProfile(res.locals.params.id, res.locals.body));
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
