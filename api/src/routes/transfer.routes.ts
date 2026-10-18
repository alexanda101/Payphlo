import { Router } from "express";
import {
  confirm,
  corridors,
  listTransfers,
  quote,
} from "../controllers/transfer.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.get("/corridors", requireAuth, corridors);
router.post("/quote", requireAuth, quote);
router.post("/confirm", requireAuth, confirm);
router.get("/", requireAuth, listTransfers);

export default router;
