import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import { prisma } from "../lib/prisma";
import {
  buildQuote,
  getSpeedTiers,
  listCorridors,
} from "../services/transfer.service";
import {
  confirmSchema,
  quoteSchema,
} from "../validators/transfer.validator";

export async function corridors(_req: AuthRequest, res: Response) {
  return res.json({
    corridors: listCorridors(),
    speedTiers: getSpeedTiers(),
  });
}

export async function quote(req: AuthRequest, res: Response) {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });

    const result = quoteSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        message: "Invalid input",
        errors: result.error.flatten().fieldErrors,
      });
    }

    let breakdown;
    try {
      breakdown = buildQuote(result.data);
    } catch (e) {
      return res.status(400).json({ message: (e as Error).message });
    }

    const saved = await prisma.transferQuote.create({
      data: {
        userId: req.userId,
        fromCurrency: breakdown.fromCurrency,
        toCurrency: breakdown.toCurrency,
        sendAmount: breakdown.sendAmount,
        midMarketRate: breakdown.midMarketRate,
        ourRate: breakdown.ourRate,
        markupPct: breakdown.markupPct,
        feeAmount: breakdown.feeAmount,
        totalCost: breakdown.totalCost,
        receiveAmount: breakdown.receiveAmount,
        speedTier: breakdown.speedTier,
        deliveryEtaMin: breakdown.deliveryEtaMin,
        deliveryEtaMax: breakdown.deliveryEtaMax,
        expiresAt: new Date(breakdown.expiresAtIso),
      },
    });

    return res.json({
      quote: { ...breakdown, id: saved.id },
    });
  } catch (error) {
    console.error("[transfers.quote] error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
}

export async function confirm(req: AuthRequest, res: Response) {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });

    const result = confirmSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        message: "Invalid input",
        errors: result.error.flatten().fieldErrors,
      });
    }

    const { quoteId, recipientName } = result.data;

    const q = await prisma.transferQuote.findFirst({
      where: { id: quoteId, userId: req.userId },
      include: { transfer: true },
    });
    if (!q) return res.status(404).json({ message: "Quote not found" });
    if (q.transfer)
      return res.status(409).json({ message: "Quote already confirmed" });
    if (q.expiresAt.getTime() < Date.now())
      return res.status(410).json({ message: "Quote expired — fetch a new one" });

    const transfer = await prisma.transfer.create({
      data: {
        userId: req.userId,
        quoteId: q.id,
        recipientName,
        status: "pending",
      },
      include: { quote: true },
    });

    return res.status(201).json({ transfer });
  } catch (error) {
    console.error("[transfers.confirm] error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
}

export async function listTransfers(req: AuthRequest, res: Response) {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });

    const transfers = await prisma.transfer.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: "desc" },
      include: { quote: true },
      take: 50,
    });

    return res.json({ transfers });
  } catch (error) {
    return res.status(500).json({ message: "Something went wrong" });
  }
}
