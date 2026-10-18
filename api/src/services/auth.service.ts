import bcrypt from "bcrypt";
import { Response } from "express";
import jwt from "jsonwebtoken";
import { getJwtSecret } from "../lib/env";

export const AUTH_COOKIE_NAME = "payphlo_token";

export async function hashPassword(password: string) {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
}

export async function comparePasswords(password: string, hashedPassword: string) {
  return bcrypt.compare(password, hashedPassword);
}

export function createToken(userId: string) {
  return jwt.sign(
    { userId },
    getJwtSecret(),
    { expiresIn: "1d" }
  );
}

export function setAuthCookie(res: Response, token: string) {
  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 24 * 60 * 60 * 1000,
    path: "/",
  });
}

export function clearAuthCookie(res: Response) {
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
}
