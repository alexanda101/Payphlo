import { Request, Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import {
  clearAuthCookie,
  comparePasswords,
  createToken,
  hashPassword,
  setAuthCookie,
} from "../services/auth.service";
import {
  clearCsrfCookie,
  ensureCsrfCookie,
  setCsrfCookie,
} from "../services/csrf.service";
import { prisma } from "../lib/prisma";
import { loginSchema, signupSchema } from "../validators/auth.validator";

export async function signup(req: Request, res: Response) {
  try {
    const result = signupSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        message: "Invalid input",
        errors: result.error.flatten().fieldErrors,
      });
    }

    const { email, name, password } = result.data;

    const existingUser = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (existingUser) {
      return res.status(409).json({
        message: "User with this email already exists",
      });
    }

    const hashedPassword = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
      },
    });

    setAuthCookie(res, createToken(user.id));
    setCsrfCookie(res);

    return res.status(201).json({
      message: "Signup successful",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: "Something went wrong",
    });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const result = loginSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        message: "Invalid input",
        errors: result.error.flatten().fieldErrors,
      });
    }

    const { email, password } = result.data;

    const user = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    const passwordMatches = await comparePasswords(password, user.password);

    if (!passwordMatches) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    const token = createToken(user.id);
    setAuthCookie(res, token);
    setCsrfCookie(res);

    return res.json({
      message: "Login successful",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: "Something went wrong",
    });
  }
}

export async function logout(_req: Request, res: Response) {
  clearAuthCookie(res);
  clearCsrfCookie(res);

  return res.json({
    message: "Logout successful",
  });
}

export function csrf(req: Request, res: Response) {
  const csrfToken = ensureCsrfCookie(req, res);

  return res.json({
    csrfToken,
  });
}

export async function getMe(req: AuthRequest, res: Response) {
  try {
    if (!req.userId) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    const user = await prisma.user.findUnique({
      where: {
        id: req.userId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    return res.json({
      user,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Something went wrong",
    });
  }
}
