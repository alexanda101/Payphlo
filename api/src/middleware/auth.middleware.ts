import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { getCookieValue } from "../lib/cookies";
import { getJwtSecret } from "../lib/env";
import { AUTH_COOKIE_NAME } from "../services/auth.service";

export type AuthRequest = Request & {
  userId?: string;
};

type TokenPayload = {
  userId: string;
};

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const token = getAuthToken(req);

  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as TokenPayload;

    req.userId = decoded.userId;

    next();
  } catch (error) {
    return res.status(401).json({ message: "Unauthorized" });
  }
}

function getAuthToken(req: Request) {
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.split(" ")[1]
    : null;

  return bearerToken || getCookieValue(req.headers.cookie, AUTH_COOKIE_NAME);
}
