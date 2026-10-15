import { Router, type Response } from "express";
import { setRefreshTokenCookie } from "../../lib/cookies.js";
import { validate } from "../../middleware/validate.js";
import {
  loginSchema,
  registerSchema,
  type LoginInput,
  type RegisterInput,
} from "./auth.schemas.js";
import * as authService from "./auth.service.js";
import type { AuthResponse } from "./auth.service.js";

type AuthRouteResponse = Pick<AuthResponse, "user" | "accessToken">;

export const authRouter = Router();

authRouter.post(
  "/register",
  validate(registerSchema, "body"),
  async (_req, res: Response<AuthRouteResponse, { body: RegisterInput }>) => {
    const { user, accessToken, refreshToken } = await authService.registerUser(res.locals.body);

    setRefreshTokenCookie(res, refreshToken);
    res.set("Cache-Control", "no-store").status(201).json({ user, accessToken });
  },
);

authRouter.post(
  "/login",
  validate(loginSchema, "body"),
  async (_req, res: Response<AuthRouteResponse, { body: LoginInput }>) => {
    const { user, accessToken, refreshToken } = await authService.loginUser(res.locals.body);

    setRefreshTokenCookie(res, refreshToken);
    res.set("Cache-Control", "no-store").status(200).json({ user, accessToken });
  },
);
