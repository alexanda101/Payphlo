# Decisions

Short notes on *why* things are the way they are. Append-only.

---

### JWT in `localStorage` (MVP only)
- **Why:** simplest possible flow to ship auth.
- **Risk:** vulnerable to XSS.
- **Fix later:** move JWT to an httpOnly, Secure, SameSite=Strict cookie set by the API. Required before public launch.

### API on port 4000, web on 3000
- **Why:** Next.js defaults to 3000. Avoid the collision instead of fighting it.
- **Set via:** `api/.env` → `PORT=4000`, `web/.env.local` → `NEXT_PUBLIC_API_URL=http://localhost:4000`.

### Postgres + Redis in Docker (not native install)
- **Why:** zero pollution of the host machine; same setup any teammate can clone.
- **Tradeoff:** Docker Desktop must be running.

### Prisma 7 with `@prisma/adapter-pg`
- **Why:** Prisma 7 expects an adapter for app code; matches current docs.

### Password hashing with bcrypt (10 rounds)
- **Why:** standard, well-tested. 10 rounds is enough for now; raise to 12 in production.

### zod for input validation
- **Why:** type-safe, runs at runtime, gives clean field-level error messages.

### No tests yet
- **Why:** we're prioritizing learning the full stack first.
- **Fix soon:** add vitest, cover `hashPassword`, `signup`, `login`, `requireAuth` first.

### `JWT_SECRET` has a fallback string
- **Why:** convenience during local dev.
- **Risk:** if env var is missing in prod, app silently uses a known weak secret.
- **Fix before launch:** crash on startup if `JWT_SECRET` is missing.

### App display name is "Payphlo" (was "Monirex"), folder/db still say "finapp"
- **Renamed:** May 2026 — `monirex.com` was taken; switched to `payphlo.com`.
- **Why:** renaming the folder + database mid-flight is disruptive and wipes test users.
- **Fix later:** clean rename when we do a fresh environment reset.

### Mock market prices are deterministic
- **Why:** No paid market data feed for the MVP. Using a hash-seeded sine + 30-second jitter means any user loading the same symbol at the same wall-clock instant sees the same price, but prices still *move* over time so the UI feels alive.
- **Fix later:** swap `market.service.ts` for a real provider (Alpaca, Polygon, or a free tier like Finnhub). The service interface stays the same — controllers don't change.

### Every new user starts with $10,000 virtual cash
- **Why:** Big enough to buy fractional slices of every asset class (incl. BTC/NVDA) so users can experiment immediately without "you need to fund your account first" friction.
- **Mechanism:** `User.cashBalance Float @default(10000)` in the schema.
- **Fix later:** when real funding lands (Plaid → ACH), `cashBalance` becomes the source of truth for *settled* cash and we add a separate ledger for pending deposits.

### Paper orders execute inside a Prisma transaction
- **Why:** A buy must atomically debit cash, write the order row, and upsert the position. A crash between any two of those would leave the user with free shares or missing cash.
- **Mechanism:** `prisma.$transaction(async (tx) => {...})` wraps all three writes.

### Fractional shares everywhere (`quantity: Float`)
- **Why:** Users want to spend "$50 on AAPL" without doing share-count math, and crypto trading is fractional by nature.
- **Tradeoff:** rounding visible on the UI. We round dollar amounts to 2dp and avgCost to 4dp.

### Assistant is *educational*, never opinionated
- **Decision:** the AI never says "buy", "sell", "hold", "should", or predicts price direction. It explains, defines, lists trade-offs, and redirects opinion-seeking prompts to education.
- **Why:**
  1. **Regulatory exposure** — issuing personalized recommendations turns us into something that looks like a registered investment advisor in most jurisdictions. Avoiding that is a feature, not a limitation.
  2. **Investor pitch** — "we educate, we don't advise" is the safer story for partners and acquirers than "our chatbot tells users what to buy."
  3. **Product fit** — our user is new to investing and remittance. They benefit more from frameworks than from picks.
- **Mechanism:** strict system prompt (`EDUCATOR_SYSTEM_PROMPT` in `ai.service.ts`) + `guardrails.service.ts` runs as both a *pre-check* on user input and a *post-check* on LLM output.

### LLM is provider-agnostic + has a deterministic fallback
- **Decision:** `llm.service.ts` exposes a single `chat()` that dispatches to OpenAI, Mistral, or Anthropic via `LLM_PROVIDER` env. If no key is configured, `ai.service.ts` falls back to the original rule-based templates.
- **Why:**
  1. **Cost flexibility** — swap to Mistral / Haiku when bills get big; back to GPT for quality when it matters.
  2. **No demo blockers** — fresh clones run with zero API keys; assistant still answers.
  3. **No vendor lock** — adapters are ~20 lines each, easy to add a new one.
- **Default models:** `gpt-4o-mini`, `mistral-small-latest`, `claude-3-5-haiku-latest`.

### Mistral is the first real Phlo provider path
- **Decision:** start real LLM testing with `LLM_PROVIDER=mistral` and `LLM_MODEL=mistral-small-latest`.
- **Why:** it fits the product's early needs: good enough educational answers, relatively simple API shape, and cost flexibility while the assistant is still learning-focused.
- **Safety controls:** provider calls have a timeout (`LLM_TIMEOUT_MS`), input/response character caps, `max_tokens`, low temperature, empty-response fallback, and post-output guardrail checks.
- **Debugging:** assistant responses include `source`, `provider`, and `model` so we can tell whether an answer came from Mistral or the fallback templates.
- **Rule:** Mistral still does not get permission to advise. The provider changes the language quality, not the product boundary.

### API security baseline: required secrets, restricted CORS, rate limits
- **Decision:** the API now fails startup if `JWT_SECRET` is missing, restricts CORS to configured frontend origins, and rate-limits auth + assistant write endpoints.
- **Why:**
  1. Silent fallback secrets are too dangerous for a product path.
  2. Open CORS is unnecessary for local product development and risky before public sharing.
  3. Auth and assistant endpoints are the obvious brute-force / abuse surfaces.
- **Mechanism:**
  - `src/lib/env.ts` centralizes required secrets and allowed origins.
  - `src/main.ts` validates env at startup and configures CORS.
  - `express-rate-limit` protects `POST /auth/signup`, `POST /auth/login`, `POST /assistant/ask`, and `POST /assistant/compare`.

### JWT moved to an API-set httpOnly cookie
- **Decision:** signup/login set the JWT in a `payphlo_token` cookie instead of returning a token for `localStorage`. Logout clears that cookie.
- **Why:** JavaScript cannot read httpOnly cookies, so an XSS bug cannot directly steal the auth token.
- **Config:**
  - `httpOnly: true` blocks browser JavaScript access.
  - `secure: true` in production sends the cookie only over HTTPS.
  - `sameSite: "lax"` reduces CSRF exposure for cross-site requests while keeping local app navigation simple.
  - `path: "/"` makes the cookie available to the API routes.
  - `credentials: "include"` in `web/lib/api.ts` tells `fetch()` to send cookies.
- **Tradeoff:** cookie auth brings CSRF design into scope. `SameSite=Lax` is a good baseline; the app now adds an explicit CSRF token/header check for unsafe authenticated product routes.

### CSRF protection for cookie auth
- **Decision:** unsafe assistant, transfer, and investing routes require the readable `payphlo_csrf` cookie value to match the `X-CSRF-Token` request header.
- **Why:** once auth moved to cookies, browser requests can carry credentials automatically. The explicit header proves the request came from Payphlo's frontend code, not a plain cross-site form post.
- **Mechanism:**
  - `GET /auth/csrf` sets or reuses the CSRF cookie.
  - Signup/login also issue a CSRF cookie.
  - `web/lib/api.ts` reads the CSRF cookie and sends `X-CSRF-Token` for unsafe methods.
  - `requireCsrf` runs before `/assistant`, `/transfers`, and `/investing`.
- **Tradeoff:** logout is intentionally left easy to call so users can always clear the session.

### Initial API tests use Node's built-in test runner
- **Decision:** start with `node --test` JavaScript tests against compiled `dist` output instead of adding Vitest/Jest right away.
- **Why:** the API is already TypeScript-compiled with `tsc`, and Node's built-in runner is enough to cover the highest-risk foundation rules with zero new dependencies.
- **Coverage now:** auth validators, CSRF helpers/middleware, Phlo guardrails, Phlo conversation delete/clear handlers, and paper investing buy/sell service rules.
- **Integration coverage:** `pnpm run test:integration` starts the real Express app on a temporary local port and verifies auth cookies, CSRF blocking/passing, `/auth/me`, and paper buy/sell routes against Docker Postgres.
- **Tradeoff:** integration tests require Postgres to be running, so fast unit/service tests remain separate under `pnpm test`.
