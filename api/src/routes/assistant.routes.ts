import { Router } from "express";
import {
  ask,
  clearConversations,
  compare,
  deleteConversation,
  getConversation,
  listConversations,
} from "../controllers/assistant.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { assistantRateLimit } from "../middleware/rateLimit.middleware";

const router = Router();

router.post("/ask", requireAuth, assistantRateLimit, ask);
router.post("/compare", requireAuth, assistantRateLimit, compare);
router.get("/conversations", requireAuth, listConversations);
router.delete("/conversations", requireAuth, clearConversations);
router.get("/conversations/:id", requireAuth, getConversation);
router.delete("/conversations/:id", requireAuth, deleteConversation);

export default router;
