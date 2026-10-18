const test = require("node:test");
const assert = require("node:assert/strict");

const prismaModule = require("../dist/lib/prisma");

const calls = [];
prismaModule.prisma.conversation = {
  deleteMany: async (args) => {
    calls.push(args);
    if (args.where.id === "missing") return { count: 0 };
    return { count: args.where.id ? 1 : 3 };
  },
};

const {
  clearConversations,
  deleteConversation,
} = require("../dist/controllers/assistant.controller");

function makeRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test("deleteConversation scopes deletion to current user", async () => {
  calls.length = 0;
  const req = { userId: "user-1", params: { id: "chat-1" } };
  const res = makeRes();

  await deleteConversation(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { ok: true });
  assert.deepEqual(calls[0], { where: { id: "chat-1", userId: "user-1" } });
});

test("deleteConversation returns 404 when chat is not owned or missing", async () => {
  const req = { userId: "user-1", params: { id: "missing" } };
  const res = makeRes();

  await deleteConversation(req, res);

  assert.equal(res.statusCode, 404);
  assert.deepEqual(res.body, { message: "Conversation not found" });
});

test("clearConversations only clears current user's chats", async () => {
  calls.length = 0;
  const req = { userId: "user-1", params: {} };
  const res = makeRes();

  await clearConversations(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { ok: true, deletedCount: 3 });
  assert.deepEqual(calls[0], { where: { userId: "user-1" } });
});
