import type { RequestHandler } from "express";
import { AppError } from "../errors/app-error.js";
import * as userRepository from "../repositories/user.repository.js";
import { createUserSchema, idParamsSchema } from "../validation/forum.js";

export const listUsers: RequestHandler = (_req, res) => {
  res.json(userRepository.findAllUsers());
};

export const getUser: RequestHandler = (req, res) => {
  const { id } = idParamsSchema.parse(req.params);
  const user = userRepository.findUserById(id);

  if (!user) {
    throw new AppError(404, "USER_NOT_FOUND", "User not found");
  }

  res.json(user);
};

export const createUser: RequestHandler = (req, res) => {
  const input = createUserSchema.parse(req.body);
  res.status(201).json(userRepository.createUser(input));
};
