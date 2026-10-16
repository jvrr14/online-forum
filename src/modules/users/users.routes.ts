import { Router, type Response } from "express";
import type { Post, Profile } from "../../db/schema/index.js";
import { validate } from "../../middleware/validate.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { requireAuthenticatedUser } from "../../lib/auth.js";
import { paginationSchema, type PaginationQuery } from "../../lib/request.schemas.js";
import { listPostsByUser } from "../posts/posts.service.js";
import {
  createUserSchema,
  idParamsSchema,
  listUsersQuerySchema,
  updateUserSchema,
  updateOwnUserSchema,
  upsertProfileSchema,
  type CreateUserInput,
  type ListUsersQuery,
  type UpdateUserInput,
  type UpdateOwnUserInput,
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

// Declare literal self-service paths before the /:id routes.
usersRouter.get("/me", authenticate, async (req, res: Response<UserWithProfile>) => {
  res.set("Cache-Control", "no-store");
  res.json(await usersService.getUserProfile(requireAuthenticatedUser(req.user).id));
});

usersRouter.put(
  "/me",
  authenticate,
  validate(updateOwnUserSchema, "body"),
  async (req, res: Response<UserResponse, { body: UpdateOwnUserInput }>) => {
    res.set("Cache-Control", "no-store");
    res.json(
      await usersService.updateOwnUser(requireAuthenticatedUser(req.user).id, res.locals.body),
    );
  },
);

usersRouter.put(
  "/me/profile",
  authenticate,
  validate(upsertProfileSchema, "body"),
  async (req, res: Response<Profile, { body: UpsertProfileInput }>) => {
    res.set("Cache-Control", "no-store");
    res.json(
      await usersService.upsertProfile(requireAuthenticatedUser(req.user).id, res.locals.body),
    );
  },
);

usersRouter.get(
  "/",
  authenticate,
  authorize("ADMIN"),
  validate(listUsersQuerySchema, "query"),
  async (_req, res: Response<UserListResponse[], { query: ListUsersQuery }>) => {
    res.json(await usersService.listUsers(res.locals.query));
  },
);

usersRouter.get(
  "/:id/posts",
  validate(idParamsSchema, "params"),
  validate(paginationSchema, "query"),
  async (_req, res: Response<Post[], { params: UserIdParams; query: PaginationQuery }>) => {
    res.json(await listPostsByUser(res.locals.params.id, res.locals.query));
  },
);

usersRouter.get(
  "/:id",
  authenticate,
  authorize("ADMIN"),
  validate(idParamsSchema, "params"),
  async (_req, res: Response<UserDetailResponse, { params: UserIdParams }>) => {
    res.json(await usersService.getUser(res.locals.params.id));
  },
);

usersRouter.post(
  "/",
  authenticate,
  authorize("ADMIN"),
  validate(createUserSchema, "body"),
  async (_req, res: Response<UserWithProfile, { body: CreateUserInput }>) => {
    res.status(201).json(await usersService.createUser(res.locals.body));
  },
);

usersRouter.put(
  "/:id",
  authenticate,
  authorize("ADMIN"),
  validate(idParamsSchema, "params"),
  validate(updateUserSchema, "body"),
  async (_req, res: Response<UserResponse, { params: UserIdParams; body: UpdateUserInput }>) => {
    res.status(200).json(await usersService.updateUser(res.locals.params.id, res.locals.body));
  },
);

usersRouter.put(
  "/:id/profile",
  authenticate,
  authorize("ADMIN"),
  validate(idParamsSchema, "params"),
  validate(upsertProfileSchema, "body"),
  async (_req, res: Response<Profile, { params: UserIdParams; body: UpsertProfileInput }>) => {
    res.status(200).json(await usersService.upsertProfile(res.locals.params.id, res.locals.body));
  },
);

usersRouter.delete(
  "/:id",
  authenticate,
  authorize("ADMIN"),
  validate(idParamsSchema, "params"),
  async (_req, res: Response<void, { params: UserIdParams }>) => {
    await usersService.deleteUser(res.locals.params.id);
    res.status(204).send();
  },
);
