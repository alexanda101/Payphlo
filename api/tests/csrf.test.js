const test = require("node:test");
const assert = require("node:assert/strict");

const { getCookieValue } = require("../dist/lib/cookies");
const { requireCsrf } = require("../dist/middleware/csrf.middleware");
const {
  CSRF_COOKIE_NAME,
  createCsrfToken,
  ensureCsrfCookie,
  setCsrfCookie,
} = require("../dist/services/csrf.service");

function makeReq(method, cookieToken, headerToken) {
  return {
    method,
    headers: {
      cookie: cookieToken ? `${CSRF_COOKIE_NAME}=${encodeURIComponent(cookieToken)}` : "",
      "x-csrf-token": headerToken,
    },
    header(name) {
      return this.headers[name.toLowerCase()];
    },
  };
}

function makeRes() {
  return {
    statusCode: 200,
    body: null,
    cookies: [],
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
    cookie(name, value, options) {
      this.cookies.push({ name, value, options });
    },
  };
}

test("getCookieValue reads encoded cookie values", () => {
  assert.equal(
    getCookieValue("other=1; payphlo_csrf=hello%20world", "payphlo_csrf"),
    "hello world"
  );
});

test("createCsrfToken returns a strong hex token", () => {
  const token = createCsrfToken();

  assert.match(token, /^[a-f0-9]{64}$/);
});

test("setCsrfCookie sets a readable SameSite cookie", () => {
  const res = makeRes();
  const token = setCsrfCookie(res, "token-123");

  assert.equal(token, "token-123");
  assert.equal(res.cookies[0].name, CSRF_COOKIE_NAME);
  assert.equal(res.cookies[0].value, "token-123");
  assert.equal(res.cookies[0].options.httpOnly, false);
  assert.equal(res.cookies[0].options.sameSite, "lax");
  assert.equal(res.cookies[0].options.path, "/");
});

test("ensureCsrfCookie reuses an existing token", () => {
  const req = makeReq("GET", "existing-token", undefined);
  const res = makeRes();

  assert.equal(ensureCsrfCookie(req, res), "existing-token");
  assert.equal(res.cookies.length, 0);
});

test("requireCsrf allows safe methods without a token", () => {
  const req = makeReq("GET", null, undefined);
  const res = makeRes();
  let called = false;

  requireCsrf(req, res, () => {
    called = true;
  });

  assert.equal(called, true);
  assert.equal(res.statusCode, 200);
});

test("requireCsrf rejects unsafe methods without matching cookie and header", () => {
  const req = makeReq("POST", "cookie-token", "wrong-token");
  const res = makeRes();
  let called = false;

  requireCsrf(req, res, () => {
    called = true;
  });

  assert.equal(called, false);
  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.body, { message: "Invalid CSRF token" });
});

test("requireCsrf allows unsafe methods with matching cookie and header", () => {
  const req = makeReq("POST", "same-token", "same-token");
  const res = makeRes();
  let called = false;

  requireCsrf(req, res, () => {
    called = true;
  });

  assert.equal(called, true);
  assert.equal(res.statusCode, 200);
});
