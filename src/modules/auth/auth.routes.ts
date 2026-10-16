import { Router, type Response } from "express";
import {
  clearRefreshTokenCookie,
  readRefreshTokenCookie,
  setRefreshTokenCookie,
} from "../../lib/cookies.js";
import { requireAuthenticatedUser } from "../../lib/auth.js";
import { UnauthorizedError } from "../../lib/errors.js";
import { authenticate } from "../../middleware/authenticate.js";
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
    res.status(201).json({ user, accessToken });
  },
);

authRouter.post(
  "/login",
  validate(loginSchema, "body"),
  async (_req, res: Response<AuthRouteResponse, { body: LoginInput }>) => {
    const { user, accessToken, refreshToken } = await authService.loginUser(res.locals.body);

    setRefreshTokenCookie(res, refreshToken);
    res.status(200).json({ user, accessToken });
  },
);

authRouter.post("/refresh", async (req, res: Response<{ accessToken: string }>) => {
  try {
    const { accessToken, refreshToken } = await authService.refreshSession(
      readRefreshTokenCookie(req.cookies),
    );
    setRefreshTokenCookie(res, refreshToken);
    res.json({ accessToken });
  } catch (error) {
    // Preserve the cookie on infrastructure failures so the client can retry.
    if (error instanceof UnauthorizedError) {
      clearRefreshTokenCookie(res);
    }
    throw error;
  }
});

authRouter.post("/logout", async (req, res) => {
  await authService.logoutSession(readRefreshTokenCookie(req.cookies));
  clearRefreshTokenCookie(res);
  res.status(204).send();
});

authRouter.delete("/sessions", authenticate, async (req, res) => {
  await authService.revokeAllSessions(requireAuthenticatedUser(req.user).id);
  clearRefreshTokenCookie(res);
  res.status(204).send();
});
