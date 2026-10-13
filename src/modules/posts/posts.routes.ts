import { Router, type Response } from "express";
import type { Post } from "../../db/schema/index.js";
import { validate } from "../../middleware/validate.js";
import { idParamsSchema, type UserIdParams as PostIdParams } from "../users/users.schemas.js";
import {
  createPostSchema,
  updatePostSchema,
  type CreatePostInput,
  type UpdatePostInput,
} from "./posts.schemas.js";
import * as postsService from "./posts.service.js";
import type { PostWithAuthor, PostWithFullAuthor } from "./posts.service.js";

export const postsRouter = Router();

postsRouter.get("/", async (_req, res) => {
  res.json(await postsService.listPosts());
});

postsRouter.get(
  "/:id",
  validate(idParamsSchema, "params"),
  async (_req, res: Response<PostWithFullAuthor, { params: PostIdParams }>) => {
    res.json(await postsService.getPost(res.locals.params.id));
  },
);

postsRouter.post(
  "/",
  validate(createPostSchema, "body"),
  async (_req, res: Response<PostWithAuthor, { body: CreatePostInput }>) => {
    res.status(201).json(await postsService.createPost(res.locals.body));
  },
);

postsRouter.put(
  "/:id",
  validate(idParamsSchema, "params"),
  validate(updatePostSchema, "body"),
  async (_req, res: Response<Post, { params: PostIdParams; body: UpdatePostInput }>) => {
    res.status(200).json(await postsService.updatePost(res.locals.params.id, res.locals.body));
  },
);

postsRouter.patch(
  "/:id/publish",
  validate(idParamsSchema, "params"),
  async (_req, res: Response<Post, { params: PostIdParams }>) => {
    res.status(200).json(await postsService.publishPost(res.locals.params.id));
  },
);

postsRouter.patch(
  "/:id/view",
  validate(idParamsSchema, "params"),
  async (_req, res: Response<Post, { params: PostIdParams }>) => {
    res.status(200).json(await postsService.incrementPostViews(res.locals.params.id));
  },
);

postsRouter.delete(
  "/:id",
  validate(idParamsSchema, "params"),
  async (_req, res: Response<void, { params: PostIdParams }>) => {
    await postsService.deletePost(res.locals.params.id);
    res.status(204).send();
  },
);
