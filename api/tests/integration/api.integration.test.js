require("dotenv/config");

const { createServer } = require("node:http");
const { once } = require("node:events");
const test = require("node:test");
const assert = require("node:assert/strict");

const { createApp } = require("../../dist/app");
const { prisma } = require("../../dist/lib/prisma");
const { AUTH_COOKIE_NAME } = require("../../dist/services/auth.service");
const { CSRF_COOKIE_NAME } = require("../../dist/services/csrf.service");

class CookieJar {
  constructor() {
    this.cookies = new Map();
  }

  header() {
    return [...this.cookies.entries()]
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }

  get(name) {
    return this.cookies.get(name);
  }

  storeFrom(response) {
    for (const cookie of getSetCookies(response.headers)) {
      const [pair] = cookie.split(";");
      const separator = pair.indexOf("=");
      if (separator === -1) continue;

      const name = pair.slice(0, separator).trim();
      const value = pair.slice(separator + 1).trim();
      if (value) {
        this.cookies.set(name, value);
      } else {
        this.cookies.delete(name);
      }
    }
  }
}

function getSetCookies(headers) {
  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie();
  }

  const header = headers.get("set-cookie");
  if (!header) return [];

  return header.split(/,(?=\s*[^;,]+=)/).map((cookie) => cookie.trim());
}

function makeClient(baseUrl, jar = new CookieJar()) {
  return {
    jar,
    async request(path, options = {}) {
      const headers = { ...(options.headers || {}) };
      const cookieHeader = jar.header();

      if (cookieHeader) headers.Cookie = cookieHeader;
      if (options.body !== undefined) headers["Content-Type"] = "application/json";
      if (options.csrf) headers["X-CSRF-Token"] = jar.get(CSRF_COOKIE_NAME) || "";

      const response = await fetch(`${baseUrl}${path}`, {
        method: options.method || "GET",
        headers,
        body:
          options.body === undefined ? undefined : JSON.stringify(options.body),
      });

      jar.storeFrom(response);

      const text = await response.text();
      const data = text ? JSON.parse(text) : null;

      return {
        data,
        headers: response.headers,
        setCookies: getSetCookies(response.headers),
        status: response.status,
      };
    },
  };
}

async function startServer() {
  const server = createServer(createApp());
  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Test server did not start on a TCP port");
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

function findCookie(setCookies, name) {
  return setCookies.find((cookie) => cookie.startsWith(`${name}=`));
}

function expectMoneyNear(actual, expected) {
  assert.ok(
    Math.abs(actual - expected) < 0.02,
    `expected ${actual} to be within 2 cents of ${expected}`
  );
}

test(
  "auth cookies, csrf protection, and investing routes work against Postgres",
  { timeout: 30000 },
  async () => {
    const server = await startServer();
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const email = `integration-${suffix}@example.com`;
    const password = "password123";
    const name = "Integration Tester";

    try {
      const client = makeClient(server.baseUrl);

      const invalidSignup = await client.request("/auth/signup", {
        method: "POST",
        body: { email, password },
      });
      assert.equal(invalidSignup.status, 400);
      assert.ok(invalidSignup.data.errors.name);

      const signup = await client.request("/auth/signup", {
        method: "POST",
        body: { name, email, password },
      });
      assert.equal(signup.status, 201);
      assert.equal(signup.data.user.name, name);
      assert.equal(signup.data.user.email, email);
      assert.match(findCookie(signup.setCookies, AUTH_COOKIE_NAME), /HttpOnly/i);
      assert.doesNotMatch(
        findCookie(signup.setCookies, CSRF_COOKIE_NAME),
        /HttpOnly/i
      );
      assert.ok(client.jar.get(AUTH_COOKIE_NAME));
      assert.ok(client.jar.get(CSRF_COOKIE_NAME));

      const me = await client.request("/auth/me");
      assert.equal(me.status, 200);
      assert.equal(me.data.user.name, name);
      assert.equal(me.data.user.email, email);

      const loginClient = makeClient(server.baseUrl);
      const login = await loginClient.request("/auth/login", {
        method: "POST",
        body: { email, password },
      });
      assert.equal(login.status, 200);
      assert.equal(login.data.user.name, name);
      assert.match(findCookie(login.setCookies, AUTH_COOKIE_NAME), /HttpOnly/i);
      assert.ok(loginClient.jar.get(AUTH_COOKIE_NAME));
      assert.ok(loginClient.jar.get(CSRF_COOKIE_NAME));

      const blockedWrite = await client.request("/investing/watchlist/AAPL", {
        method: "POST",
      });
      assert.equal(blockedWrite.status, 403);
      assert.deepEqual(blockedWrite.data, { message: "Invalid CSRF token" });

      const assets = await client.request("/investing/assets");
      assert.equal(assets.status, 200);
      assert.ok(assets.data.assets.some((asset) => asset.symbol === "AAPL"));

      const allowedWrite = await client.request("/investing/watchlist/AAPL", {
        method: "POST",
        csrf: true,
      });
      assert.equal(allowedWrite.status, 201);
      assert.deepEqual(allowedWrite.data, { ok: true });

      const initialPortfolio = await client.request("/investing/portfolio");
      assert.equal(initialPortfolio.status, 200);
      const initialCash = initialPortfolio.data.cashBalance;

      const buyOne = await client.request("/investing/orders", {
        method: "POST",
        csrf: true,
        body: { symbol: "AAPL", side: "buy", quantity: 1 },
      });
      assert.equal(buyOne.status, 201);
      assert.equal(buyOne.data.order.side, "buy");

      const portfolioAfterFirstBuy = await client.request("/investing/portfolio");
      let aapl = portfolioAfterFirstBuy.data.positions.find(
        (position) => position.symbol === "AAPL"
      );
      assert.equal(aapl.quantity, 1);
      expectMoneyNear(
        portfolioAfterFirstBuy.data.cashBalance,
        initialCash - buyOne.data.total
      );

      const buySecond = await client.request("/investing/orders", {
        method: "POST",
        csrf: true,
        body: { symbol: "AAPL", side: "buy", quantity: 1 },
      });
      assert.equal(buySecond.status, 201);

      const portfolioAfterSecondBuy = await client.request("/investing/portfolio");
      aapl = portfolioAfterSecondBuy.data.positions.find(
        (position) => position.symbol === "AAPL"
      );
      assert.equal(aapl.quantity, 2);
      expectMoneyNear(
        portfolioAfterSecondBuy.data.cashBalance,
        initialCash - buyOne.data.total - buySecond.data.total
      );

      const sellOne = await client.request("/investing/orders", {
        method: "POST",
        csrf: true,
        body: { symbol: "AAPL", side: "sell", quantity: 1 },
      });
      assert.equal(sellOne.status, 201);
      assert.equal(sellOne.data.order.side, "sell");

      const portfolioAfterFirstSell = await client.request("/investing/portfolio");
      aapl = portfolioAfterFirstSell.data.positions.find(
        (position) => position.symbol === "AAPL"
      );
      assert.equal(aapl.quantity, 1);
      expectMoneyNear(
        portfolioAfterFirstSell.data.cashBalance,
        initialCash -
          buyOne.data.total -
          buySecond.data.total +
          sellOne.data.total
      );

      const sellSecond = await client.request("/investing/orders", {
        method: "POST",
        csrf: true,
        body: { symbol: "AAPL", side: "sell", quantity: 1 },
      });
      assert.equal(sellSecond.status, 201);

      const finalPortfolio = await client.request("/investing/portfolio");
      aapl = finalPortfolio.data.positions.find(
        (position) => position.symbol === "AAPL"
      );
      assert.equal(aapl, undefined);
      expectMoneyNear(
        finalPortfolio.data.cashBalance,
        initialCash -
          buyOne.data.total -
          buySecond.data.total +
          sellOne.data.total +
          sellSecond.data.total
      );
    } finally {
      await prisma.user.deleteMany({ where: { email } });
      await prisma.$disconnect();
      await server.close();
    }
  }
);
