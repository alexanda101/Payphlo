import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import {
  addToWatchlist,
  getAssetWithPrice,
  getPortfolio,
  getWatchlist,
  listAssets,
  listOrders,
  placePaperOrder,
  removeFromWatchlist,
} from "../services/investing.service";
import { orderSchema } from "../validators/investing.validator";

export async function assets(_req: AuthRequest, res: Response) {
  try {
    const items = await listAssets();
    return res.json({ assets: items });
  } catch (e) {
    return res.status(500).json({ message: "Something went wrong" });
  }
}

export async function assetDetail(req: AuthRequest, res: Response) {
  try {
    const symbol = String(req.params.symbol || "").toUpperCase();
    const ap = await getAssetWithPrice(symbol);
    if (!ap) return res.status(404).json({ message: "Asset not found" });
    return res.json({
      asset: {
        symbol: ap.asset.symbol,
        name: ap.asset.name,
        assetClass: ap.asset.assetClass,
        sector: ap.asset.sector,
        riskLevel: ap.asset.riskLevel,
        description: ap.asset.description,
        price: ap.price,
        changeAbs: ap.change.changeAbs,
        changePct: ap.change.changePct,
        history: ap.history,
      },
    });
  } catch (e) {
    return res.status(500).json({ message: "Something went wrong" });
  }
}

export async function watchlist(req: AuthRequest, res: Response) {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const items = await getWatchlist(req.userId);
    return res.json({ watchlist: items });
  } catch (e) {
    return res.status(500).json({ message: "Something went wrong" });
  }
}

export async function addWatch(req: AuthRequest, res: Response) {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const symbol = String(req.params.symbol || "").toUpperCase();
    await addToWatchlist(req.userId, symbol);
    return res.status(201).json({ ok: true });
  } catch (e) {
    return res.status(400).json({ message: (e as Error).message });
  }
}

export async function removeWatch(req: AuthRequest, res: Response) {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const symbol = String(req.params.symbol || "").toUpperCase();
    await removeFromWatchlist(req.userId, symbol);
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ message: "Something went wrong" });
  }
}

export async function portfolio(req: AuthRequest, res: Response) {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const p = await getPortfolio(req.userId);
    return res.json(p);
  } catch (e) {
    return res.status(500).json({ message: "Something went wrong" });
  }
}

export async function order(req: AuthRequest, res: Response) {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const result = orderSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        message: "Invalid input",
        errors: result.error.flatten().fieldErrors,
      });
    }
    const { symbol, side, quantity } = result.data;
    const r = await placePaperOrder({
      userId: req.userId,
      symbol: symbol.toUpperCase(),
      side,
      quantity,
    });
    return res.status(201).json({
      order: r.order,
      executedPrice: r.executedPrice,
      total: r.total,
    });
  } catch (e) {
    return res.status(400).json({ message: (e as Error).message });
  }
}

export async function orders(req: AuthRequest, res: Response) {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const items = await listOrders(req.userId);
    return res.json({ orders: items });
  } catch (e) {
    return res.status(500).json({ message: "Something went wrong" });
  }
}
