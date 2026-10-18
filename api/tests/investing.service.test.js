const test = require("node:test");
const assert = require("node:assert/strict");

const prismaModule = require("../dist/lib/prisma");
const { placePaperOrder } = require("../dist/services/investing.service");

const ASSET = {
  id: "asset-aapl",
  symbol: "AAPL",
  name: "Apple Inc.",
  assetClass: "stock",
  sector: "Technology",
  basePrice: 218.3,
  riskLevel: "medium",
  description: "Consumer electronics, services, and software.",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
};

function round4(n) {
  return Math.round(n * 10000) / 10000;
}

function setupPrisma({ cashBalance = 10000, existingPosition = null } = {}) {
  const calls = {
    assetFindUnique: [],
    userFindUnique: [],
    positionFindUnique: [],
    paperOrderCreate: [],
    userUpdate: [],
    positionCreate: [],
    positionUpdate: [],
    positionDelete: [],
    transactionCount: 0,
  };

  prismaModule.prisma.asset = {
    count: async () => 999,
    findUnique: async (args) => {
      calls.assetFindUnique.push(args);
      return args.where.symbol === ASSET.symbol ? ASSET : null;
    },
  };

  prismaModule.prisma.user = {
    findUnique: async (args) => {
      calls.userFindUnique.push(args);
      return cashBalance === null ? null : { cashBalance };
    },
  };

  prismaModule.prisma.position = {
    findUnique: async (args) => {
      calls.positionFindUnique.push(args);
      return existingPosition;
    },
  };

  prismaModule.prisma.$transaction = async (callback) => {
    calls.transactionCount += 1;
    return callback({
      paperOrder: {
        create: async (args) => {
          calls.paperOrderCreate.push(args);
          return { id: "order-1", ...args.data };
        },
      },
      user: {
        update: async (args) => {
          calls.userUpdate.push(args);
          return { id: args.where.id };
        },
      },
      position: {
        create: async (args) => {
          calls.positionCreate.push(args);
          return { id: "position-1", ...args.data };
        },
        update: async (args) => {
          calls.positionUpdate.push(args);
          return { id: "position-1", ...args.data };
        },
        delete: async (args) => {
          calls.positionDelete.push(args);
          return { id: "position-1" };
        },
      },
    });
  };

  return calls;
}

test("paper buy debits cash and creates a new position", async () => {
  const calls = setupPrisma();

  const result = await placePaperOrder({
    userId: "user-1",
    symbol: "AAPL",
    side: "buy",
    quantity: 2,
  });

  assert.equal(calls.transactionCount, 1);
  assert.deepEqual(calls.assetFindUnique[0], { where: { symbol: "AAPL" } });
  assert.equal(calls.paperOrderCreate[0].data.side, "buy");
  assert.equal(calls.paperOrderCreate[0].data.quantity, 2);
  assert.equal(calls.paperOrderCreate[0].data.assetId, ASSET.id);
  assert.equal(calls.paperOrderCreate[0].data.total, result.total);
  assert.equal(calls.userUpdate[0].data.cashBalance.decrement, result.total);
  assert.equal(calls.positionCreate[0].data.quantity, 2);
  assert.equal(calls.positionCreate[0].data.avgCost, result.executedPrice);
  assert.equal(calls.positionUpdate.length, 0);
});

test("paper buy adds to an existing position using weighted average cost", async () => {
  const existingPosition = {
    id: "position-1",
    userId: "user-1",
    assetId: ASSET.id,
    quantity: 3,
    avgCost: 200,
  };
  const calls = setupPrisma({ existingPosition });

  const result = await placePaperOrder({
    userId: "user-1",
    symbol: "AAPL",
    side: "buy",
    quantity: 2,
  });

  const expectedAvgCost = round4(
    (existingPosition.avgCost * existingPosition.quantity +
      result.executedPrice * 2) /
      5
  );

  assert.equal(calls.userUpdate[0].data.cashBalance.decrement, result.total);
  assert.equal(calls.positionCreate.length, 0);
  assert.equal(calls.positionUpdate[0].data.quantity, 5);
  assert.equal(calls.positionUpdate[0].data.avgCost, expectedAvgCost);
});

test("paper sell credits cash and reduces an existing position", async () => {
  const calls = setupPrisma({
    existingPosition: {
      id: "position-1",
      userId: "user-1",
      assetId: ASSET.id,
      quantity: 5,
      avgCost: 200,
    },
  });

  const result = await placePaperOrder({
    userId: "user-1",
    symbol: "AAPL",
    side: "sell",
    quantity: 2,
  });

  assert.equal(calls.paperOrderCreate[0].data.side, "sell");
  assert.equal(calls.userUpdate[0].data.cashBalance.increment, result.total);
  assert.equal(calls.positionUpdate[0].data.quantity, 3);
  assert.equal(calls.positionDelete.length, 0);
});

test("paper sell deletes the position when the remaining quantity is zero", async () => {
  const calls = setupPrisma({
    existingPosition: {
      id: "position-1",
      userId: "user-1",
      assetId: ASSET.id,
      quantity: 2,
      avgCost: 200,
    },
  });

  const result = await placePaperOrder({
    userId: "user-1",
    symbol: "AAPL",
    side: "sell",
    quantity: 2,
  });

  assert.equal(calls.userUpdate[0].data.cashBalance.increment, result.total);
  assert.deepEqual(calls.positionDelete[0], {
    where: { userId_assetId: { userId: "user-1", assetId: ASSET.id } },
  });
  assert.equal(calls.positionUpdate.length, 0);
});

test("paper buy rejects orders that exceed available cash", async () => {
  const calls = setupPrisma({ cashBalance: 1 });

  await assert.rejects(
    placePaperOrder({
      userId: "user-1",
      symbol: "AAPL",
      side: "buy",
      quantity: 1,
    }),
    /Insufficient cash/
  );

  assert.equal(calls.transactionCount, 0);
});

test("paper sell rejects orders that exceed available shares", async () => {
  const calls = setupPrisma({
    existingPosition: {
      id: "position-1",
      userId: "user-1",
      assetId: ASSET.id,
      quantity: 1,
      avgCost: 200,
    },
  });

  await assert.rejects(
    placePaperOrder({
      userId: "user-1",
      symbol: "AAPL",
      side: "sell",
      quantity: 2,
    }),
    /Insufficient shares/
  );

  assert.equal(calls.transactionCount, 0);
});
