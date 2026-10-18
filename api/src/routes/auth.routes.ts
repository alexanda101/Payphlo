import { Router } from "express";
import { csrf, getMe, login, logout, signup } from "../controllers/auth.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { authRateLimit } from "../middleware/rateLimit.middleware";

const router = Router();

router.post("/signup", authRateLimit, signup);
router.post("/login", authRateLimit, login);
router.post("/logout", logout);
router.get("/csrf", csrf);
router.get("/me", requireAuth, getMe);

export default router;
