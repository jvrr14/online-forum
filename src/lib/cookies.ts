import type { CookieOptions, Response } from "express";
import { env } from "../config/env.js";
import { REFRESH_TOKEN_TTL_SECONDS } from "./jwt.js";

const refreshCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "strict",
  path: "/api/v1/auth",
};

export function setRefreshTokenCookie(res: Response, refreshToken: string): void {
  res.cookie("refreshToken", refreshToken, {
    ...refreshCookieOptions,
    maxAge: REFRESH_TOKEN_TTL_SECONDS * 1000,
  });
}

export function clearRefreshTokenCookie(res: Response): void {
  res.clearCookie("refreshToken", refreshCookieOptions);
}

// cookie-parser can also parse JSON cookies; only accept a plain token string.
export function readRefreshTokenCookie(cookies: unknown): string | undefined {
  if (typeof cookies !== "object" || cookies === null || !("refreshToken" in cookies)) {
    return undefined;
  }
  const token: unknown = cookies.refreshToken;
  return typeof token === "string" && token.length > 0 ? token : undefined;
}
