import { Router, type Response } from "express";
import type { Post } from "../../db/schema/index.js";
import { validate } from "../../middleware/validate.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { requireAuthenticatedUser } from "../../lib/auth.js";
import { idParamsSchema, type IdParams as PostIdParams } from "../../lib/request.schemas.js";
import {
  createPostSchema,
  addPostCategoriesSchema,
  removePostCategorySchema,
  listPostsQuerySchema,
  updatePostSchema,
  transferPostsSchema,
  type AddPostCategoriesInput,
  type RemovePostCategoryInput,
  type ListPostsQuery,
  type CreatePostInput,
  type UpdatePostInput,
  type TransferPostsInput,
} from "./posts.schemas.js";
import * as postsService from "./posts.service.js";
import type {
  PostListResponse,
  PostWithAuthor,
  PostWithCategories,
  PostWithFullAuthor,
  TransferPostsResult,
} from "./posts.service.js";

export const postsRouter = Router();

postsRouter.get(
  "/",
  validate(listPostsQuerySchema, "query"),
  async (_req, res: Response<PostListResponse, { query: ListPostsQuery }>) => {
    res.json(await postsService.listPosts(res.locals.query));
  },
);

postsRouter.get(
  "/:id",
  validate(idParamsSchema, "params"),
  async (_req, res: Response<PostWithFullAuthor, { params: PostIdParams }>) => {
    res.json(await postsService.getPost(res.locals.params.id));
  },
);

postsRouter.post(
  "/",
  authenticate,
  validate(createPostSchema, "body"),
  async (req, res: Response<PostWithAuthor, { body: CreatePostInput }>) => {
    res
      .status(201)
      .json(await postsService.createPost(res.locals.body, requireAuthenticatedUser(req.user)));
  },
);

postsRouter.post(
  "/transfer",
  authenticate,
  authorize("ADMIN"),
  validate(transferPostsSchema, "body"),
  async (_req, res: Response<TransferPostsResult, { body: TransferPostsInput }>) => {
    res.status(200).json(await postsService.transferPosts(res.locals.body));
  },
);

postsRouter.put(
  "/:id",
  authenticate,
  validate(idParamsSchema, "params"),
  validate(updatePostSchema, "body"),
  async (req, res: Response<Post, { params: PostIdParams; body: UpdatePostInput }>) => {
    res
      .status(200)
      .json(
        await postsService.updatePost(
          res.locals.params.id,
          res.locals.body,
          requireAuthenticatedUser(req.user),
        ),
      );
  },
);

postsRouter.patch(
  "/:id/publish",
  authenticate,
  validate(idParamsSchema, "params"),
  async (req, res: Response<Post, { params: PostIdParams }>) => {
    res
      .status(200)
      .json(
        await postsService.publishPost(res.locals.params.id, requireAuthenticatedUser(req.user)),
      );
  },
);

postsRouter.patch(
  "/:id/view",
  authenticate,
  validate(idParamsSchema, "params"),
  async (_req, res: Response<Post, { params: PostIdParams }>) => {
    res.status(200).json(await postsService.incrementPostViews(res.locals.params.id));
  },
);

postsRouter.delete(
  "/:id",
  authenticate,
  validate(idParamsSchema, "params"),
  async (req, res: Response<void, { params: PostIdParams }>) => {
    await postsService.deletePost(res.locals.params.id, requireAuthenticatedUser(req.user));
    res.status(204).send();
  },
);

postsRouter.patch(
  "/:id/categories/add",
  authenticate,
  validate(idParamsSchema, "params"),
  validate(addPostCategoriesSchema, "body"),
  async (
    req,
    res: Response<PostWithCategories, { params: PostIdParams; body: AddPostCategoriesInput }>,
  ) => {
    res
      .status(200)
      .json(
        await postsService.addPostCategories(
          res.locals.params.id,
          res.locals.body.categoryNames,
          requireAuthenticatedUser(req.user),
        ),
      );
  },
);

postsRouter.patch(
  "/:id/categories/remove",
  authenticate,
  validate(idParamsSchema, "params"),
  validate(removePostCategorySchema, "body"),
  async (
    req,
    res: Response<PostWithCategories, { params: PostIdParams; body: RemovePostCategoryInput }>,
  ) => {
    res
      .status(200)
      .json(
        await postsService.removePostCategory(
          res.locals.params.id,
          res.locals.body.categoryName,
          requireAuthenticatedUser(req.user),
        ),
      );
  },
);
