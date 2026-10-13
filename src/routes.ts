import { Router } from "express";
import { getPost, listPosts } from "./controllers/post.controller.js";
import { createUser, getUser, listUsers } from "./controllers/user.controller.js";

export const router = Router();

router.get("/users", listUsers);
router.get("/users/:id", getUser);
router.post("/users", createUser);

router.get("/posts", listPosts);
router.get("/posts/:id", getPost);
