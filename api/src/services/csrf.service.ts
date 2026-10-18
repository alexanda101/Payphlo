import crypto from "crypto";
import { Request, Response } from "express";
import { getCookieValue } from "../lib/cookies";

export const CSRF_COOKIE_NAME = "payphlo_csrf";
export const CSRF_HEADER_NAME = "x-csrf-token";

function cookieOptions() {
  return {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 24 * 60 * 60 * 1000,
    path: "/",
  };
}

export function createCsrfToken() {
  return crypto.randomBytes(32).toString("hex");
}

export function setCsrfCookie(res: Response, token = createCsrfToken()) {
  res.cookie(CSRF_COOKIE_NAME, token, cookieOptions());
  return token;
}

export function clearCsrfCookie(res: Response) {
  res.clearCookie(CSRF_COOKIE_NAME, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
}

export function ensureCsrfCookie(req: Request, res: Response) {
  return getCookieValue(req.headers.cookie, CSRF_COOKIE_NAME) || setCsrfCookie(res);
}
