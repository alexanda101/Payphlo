# API Routes

Base URL (local dev): `http://localhost:4000`

## Public

### `GET /`
Returns: `{ message: "Finapp API is running" }`

### `GET /health`
Returns: `{ status: "ok" }`

---

## Auth

The browser auth flow uses the `payphlo_token` httpOnly cookie set by signup/login.
For manual API testing, `requireAuth` also accepts `Authorization: Bearer <token>`.
Unsafe authenticated requests outside `/auth` require the `payphlo_csrf` cookie value to be sent as `X-CSRF-Token`.

### `POST /auth/signup`
**Body:** `{ name, email, password }`
**Validation:** name 2–60 chars, valid email, password ≥ 8 chars

**Responses:**
- `201` — sets `payphlo_token` cookie and returns `{ message: "Signup successful", user: { id, name, email, createdAt } }`
- `400` — `{ message: "Invalid input", errors: { name?: [...], email?: [...], password?: [...] } }`
- `409` — `{ message: "User with this email already exists" }`

### `POST /auth/login`
**Body:** `{ email, password }`

**Responses:**
- `200` — sets `payphlo_token` cookie and returns `{ message: "Login successful", user: { id, name, email } }`
- `400` — invalid input
- `401` — `{ message: "Invalid email or password" }`

### `POST /auth/logout`
Clears the `payphlo_token` and `payphlo_csrf` cookies.

**Responses:**
- `200` — `{ message: "Logout successful" }`

### `GET /auth/csrf`
Sets/reuses the readable `payphlo_csrf` cookie and returns the token.

**Responses:**
- `200` — `{ csrfToken }`

### `GET /auth/me` 🔒
**Auth:** browser cookie, or `Authorization: Bearer <token>` for tooling

**Responses:**
- `200` — `{ user: { id, name, email, createdAt } }`
- `401` — `{ message: "Unauthorized" }`
- `404` — `{ message: "User not found" }`

---

## Assistant 🔒 (all require auth)

### `POST /assistant/ask`
**Body:** `{ prompt: string, conversationId?: string }`

If `conversationId` is omitted, a new conversation is created.

**Responses:**
- `200` — `{ conversationId, blocked, intent?, source, provider, model, message: { id, role, content, createdAt } }`
- `400` — invalid input
- `404` — conversation not found / not yours

When `blocked: true`, the message contains a redirect explaining what the assistant won't do.

### `POST /assistant/compare`
**Body:** `{ symbols: string[], conversationId?: string }` — 2 to 3 symbols.

Returns an educational side-by-side comparison. Never declares a winner.

**Responses:**
- `200` — `{ conversationId, blocked, intent: "compare", source: "llm" | "fallback", provider, model, userPrompt, message: {...} }`
- `400` — bad input (need 2–3 symbols)
- `404` — unknown symbol(s)

### `GET /assistant/conversations`
Lists the current user's conversations (most recent first).

### `DELETE /assistant/conversations`
Deletes all current user's conversations and their messages.

**Responses:**
- `200` — `{ ok: true, deletedCount }`

### `GET /assistant/conversations/:id`
Returns a conversation with all its messages in order.

### `DELETE /assistant/conversations/:id`
Deletes one conversation owned by the current user. Messages are deleted by cascade.

**Responses:**
- `200` — `{ ok: true }`
- `404` — conversation not found / not yours

---

## Transfers 🔒 (all require auth)

### `GET /transfers/corridors`
Returns supported corridors (with health indicator) and speed tiers.

### `POST /transfers/quote`
**Body:** `{ corridorCode, sendAmount, speedTier }`
- `speedTier`: `"economy" | "standard" | "express"`

**Response:** full breakdown including `midMarketRate`, `ourRate`, `markupPct`, `fxMarkupCost`, `feeAmount`, `totalCost`, `receiveAmount`, `expiresAtIso` (10-min lock).

### `POST /transfers/confirm`
**Body:** `{ quoteId, recipientName }`

- `404` — quote not found
- `409` — quote already confirmed
- `410` — quote expired

### `GET /transfers`
Returns user's transfers (most recent first, max 50), each including its quote.

---

## Investing 🔒 (all require auth)

Mock paper-trading engine. Prices are deterministic per-symbol (sine drift + 30s jitter), no real market data.

### `GET /investing/assets`
Returns all tradable assets with live mock prices and intraday change.
**Response:** `{ assets: [{ symbol, name, assetClass, sector, riskLevel, description, price, changeAbs, changePct }] }`

### `GET /investing/assets/:symbol`
Returns one asset with price + intraday change.

### `GET /investing/portfolio`
**Response:** `{ cashBalance, positionsValue, totalValue, positions: [{ symbol, quantity, avgCost, price, marketValue, costBasis, unrealizedPnL, unrealizedPnLPct }] }`

New users start with **$10,000 virtual cash** (`User.cashBalance` default).

### `POST /investing/orders`
**Body:** `{ symbol, side: "buy" | "sell", quantity: number > 0 }`

Executes immediately at the current mock price inside a Prisma transaction:
- **buy**: debits cash, upserts position with weighted-average cost
- **sell**: credits cash, decrements position (deletes when qty hits 0)

**Responses:**
- `201` — `{ order, executedPrice, total }`
- `400` — invalid input, insufficient cash, or insufficient shares

### `GET /investing/orders`
Returns the user's last 50 paper orders, newest first.

### `GET /investing/watchlist`
Returns the user's watchlist with live prices.

### `POST /investing/watchlist/:symbol`
Adds an asset to the watchlist (idempotent via upsert). `201 { ok: true }`.

### `DELETE /investing/watchlist/:symbol`
Removes an asset from the watchlist. `200 { ok: true }`.
