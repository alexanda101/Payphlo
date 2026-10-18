import { prisma } from "../lib/prisma";
import { ASSET_SEEDS, priceFor, dayChange, priceHistory } from "./market.service";

export async function ensureAssetsSeeded() {
  const count = await prisma.asset.count();
  if (count >= ASSET_SEEDS.length) return;

  for (const seed of ASSET_SEEDS) {
    await prisma.asset.upsert({
      where: { symbol: seed.symbol },
      update: {},
      create: {
        symbol: seed.symbol,
        name: seed.name,
        assetClass: seed.assetClass,
        sector: seed.sector,
        basePrice: seed.basePrice,
        riskLevel: seed.riskLevel,
        description: seed.description,
      },
    });
  }
}

function volatilityFor(symbol: string): number {
  const seed = ASSET_SEEDS.find((s) => s.symbol === symbol);
  return seed?.volatility ?? 0.2;
}

export async function listAssets() {
  await ensureAssetsSeeded();
  const assets = await prisma.asset.findMany({ orderBy: { symbol: "asc" } });
  return assets.map((a) => {
    const vol = volatilityFor(a.symbol);
    const price = priceFor(a.basePrice, vol, a.symbol);
    const change = dayChange(a.basePrice, vol, a.symbol);
    const history = priceHistory(a.basePrice, vol, a.symbol, 24, 32);
    return {
      id: a.id,
      symbol: a.symbol,
      name: a.name,
      assetClass: a.assetClass,
      sector: a.sector,
      riskLevel: a.riskLevel,
      description: a.description,
      price,
      changeAbs: change.changeAbs,
      changePct: change.changePct,
      history,
    };
  });
}

export async function getAssetWithPrice(symbol: string) {
  await ensureAssetsSeeded();
  const asset = await prisma.asset.findUnique({ where: { symbol } });
  if (!asset) return null;
  const vol = volatilityFor(asset.symbol);
  const price = priceFor(asset.basePrice, vol, asset.symbol);
  const change = dayChange(asset.basePrice, vol, asset.symbol);
  const history = priceHistory(asset.basePrice, vol, asset.symbol, 24, 64);
  return { asset, price, change, volatility: vol, history };
}

export async function getPortfolio(userId: string) {
  const [user, positions] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { cashBalance: true },
    }),
    prisma.position.findMany({
      where: { userId },
      include: { asset: true },
    }),
  ]);
  if (!user) throw new Error("User not found");

  let positionsValue = 0;
  const enriched = positions.map((p) => {
    const vol = volatilityFor(p.asset.symbol);
    const price = priceFor(p.asset.basePrice, vol, p.asset.symbol);
    const marketValue = round2(price * p.quantity);
    const costBasis = round2(p.avgCost * p.quantity);
    const unrealizedPnL = round2(marketValue - costBasis);
    const unrealizedPnLPct =
      costBasis > 0 ? round2((unrealizedPnL / costBasis) * 100) : 0;
    positionsValue += marketValue;
    return {
      symbol: p.asset.symbol,
      name: p.asset.name,
      assetClass: p.asset.assetClass,
      quantity: p.quantity,
      avgCost: p.avgCost,
      price,
      marketValue,
      costBasis,
      unrealizedPnL,
      unrealizedPnLPct,
    };
  });

  const totalValue = round2(user.cashBalance + positionsValue);

  return {
    cashBalance: round2(user.cashBalance),
    positionsValue: round2(positionsValue),
    totalValue,
    positions: enriched,
  };
}

export async function placePaperOrder(params: {
  userId: string;
  symbol: string;
  side: "buy" | "sell";
  quantity: number;
}) {
  const { userId, symbol, side, quantity } = params;
  if (quantity <= 0) throw new Error("Quantity must be positive");

  const ap = await getAssetWithPrice(symbol);
  if (!ap) throw new Error("Asset not found");
  const price = ap.price;
  const total = round2(price * quantity);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { cashBalance: true },
  });
  if (!user) throw new Error("User not found");

  if (side === "buy" && user.cashBalance < total) {
    throw new Error(
      `Insufficient cash. Need $${total.toFixed(2)}, have $${user.cashBalance.toFixed(2)}`
    );
  }

  const existing = await prisma.position.findUnique({
    where: { userId_assetId: { userId, assetId: ap.asset.id } },
  });

  if (side === "sell") {
    if (!existing || existing.quantity < quantity) {
      throw new Error(
        `Insufficient shares. Have ${existing?.quantity ?? 0}, trying to sell ${quantity}`
      );
    }
  }

  // Execute in a transaction
  const order = await prisma.$transaction(async (tx) => {
    const placed = await tx.paperOrder.create({
      data: {
        userId,
        assetId: ap.asset.id,
        side,
        quantity,
        price,
        total,
        status: "filled",
      },
    });

    if (side === "buy") {
      await tx.user.update({
        where: { id: userId },
        data: { cashBalance: { decrement: total } },
      });

      if (existing) {
        const newQty = existing.quantity + quantity;
        const newAvgCost =
          (existing.avgCost * existing.quantity + price * quantity) / newQty;
        await tx.position.update({
          where: { userId_assetId: { userId, assetId: ap.asset.id } },
          data: { quantity: newQty, avgCost: round4(newAvgCost) },
        });
      } else {
        await tx.position.create({
          data: {
            userId,
            assetId: ap.asset.id,
            quantity,
            avgCost: price,
          },
        });
      }
    } else {
      // sell
      await tx.user.update({
        where: { id: userId },
        data: { cashBalance: { increment: total } },
      });

      const newQty = existing!.quantity - quantity;
      if (newQty <= 0.0000001) {
        await tx.position.delete({
          where: { userId_assetId: { userId, assetId: ap.asset.id } },
        });
      } else {
        await tx.position.update({
          where: { userId_assetId: { userId, assetId: ap.asset.id } },
          data: { quantity: newQty },
        });
      }
    }

    return placed;
  });

  return { order, executedPrice: price, total };
}

export async function getWatchlist(userId: string) {
  const items = await prisma.watchlistItem.findMany({
    where: { userId },
    include: { asset: true },
    orderBy: { createdAt: "asc" },
  });
  return items.map((w) => {
    const vol = volatilityFor(w.asset.symbol);
    const price = priceFor(w.asset.basePrice, vol, w.asset.symbol);
    const change = dayChange(w.asset.basePrice, vol, w.asset.symbol);
    return {
      symbol: w.asset.symbol,
      name: w.asset.name,
      assetClass: w.asset.assetClass,
      riskLevel: w.asset.riskLevel,
      price,
      changeAbs: change.changeAbs,
      changePct: change.changePct,
    };
  });
}

export async function addToWatchlist(userId: string, symbol: string) {
  const asset = await prisma.asset.findUnique({ where: { symbol } });
  if (!asset) throw new Error("Asset not found");
  await prisma.watchlistItem.upsert({
    where: { userId_assetId: { userId, assetId: asset.id } },
    update: {},
    create: { userId, assetId: asset.id },
  });
}

export async function removeFromWatchlist(userId: string, symbol: string) {
  const asset = await prisma.asset.findUnique({ where: { symbol } });
  if (!asset) return;
  await prisma.watchlistItem
    .delete({
      where: { userId_assetId: { userId, assetId: asset.id } },
    })
    .catch(() => {});
}

export async function listOrders(userId: string, limit = 50) {
  const orders = await prisma.paperOrder.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { asset: true },
    take: limit,
  });
  return orders.map((o) => ({
    id: o.id,
    symbol: o.asset.symbol,
    name: o.asset.name,
    side: o.side,
    quantity: o.quantity,
    price: o.price,
    total: o.total,
    status: o.status,
    createdAt: o.createdAt,
  }));
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
function round4(n: number) {
  return Math.round(n * 10000) / 10000;
}
