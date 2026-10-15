import type { Response } from "express";
import { env } from "../config/env.js";
import { REFRESH_TOKEN_TTL_SECONDS } from "./jwt.js";

export function setRefreshTokenCookie(res: Response, refreshToken: string): void {
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/v1/auth",
    maxAge: REFRESH_TOKEN_TTL_SECONDS * 1000,
  });
}
