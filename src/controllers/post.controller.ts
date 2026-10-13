import type { RequestHandler } from "express";
import { AppError } from "../errors/app-error.js";
import * as postRepository from "../repositories/post.repository.js";
import { findUserById } from "../repositories/user.repository.js";
import { idParamsSchema } from "../validation/forum.js";

export const listPosts: RequestHandler = (_req, res) => {
  res.json(postRepository.findAllPosts());
};

export const getPost: RequestHandler = (req, res) => {
  const { id } = idParamsSchema.parse(req.params);
  const post = postRepository.findPostById(id);

  if (!post) {
    throw new AppError(404, "POST_NOT_FOUND", "Post not found");
  }

  const author = findUserById(post.authorId) ?? null;
  res.json({ ...post, author });
};
