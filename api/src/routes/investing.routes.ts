import { Router } from "express";
import {
  addWatch,
  assetDetail,
  assets,
  order,
  orders,
  portfolio,
  removeWatch,
  watchlist,
} from "../controllers/investing.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.get("/assets", requireAuth, assets);
router.get("/assets/:symbol", requireAuth, assetDetail);
router.get("/watchlist", requireAuth, watchlist);
router.post("/watchlist/:symbol", requireAuth, addWatch);
router.delete("/watchlist/:symbol", requireAuth, removeWatch);
router.get("/portfolio", requireAuth, portfolio);
router.post("/orders", requireAuth, order);
router.get("/orders", requireAuth, orders);

export default router;
