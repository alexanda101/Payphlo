import { NextFunction, Request, Response } from "express";
import { getCookieValue } from "../lib/cookies";
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from "../services/csrf.service";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function requireCsrf(req: Request, res: Response, next: NextFunction) {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  const cookieToken = getCookieValue(req.headers.cookie, CSRF_COOKIE_NAME);
  const headerToken = req.header(CSRF_HEADER_NAME);

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({
      message: "Invalid CSRF token",
    });
  }

  next();
}
