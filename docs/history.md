# Build History

Chronological log of every meaningful step taken to build Payphlo (formerly Monirex) so far,
with a one-line note on what each command does.

---

## Phase 0 — Local machine setup (Windows + WSL)

```bash
git --version            # confirm Git installed
node -v                  # confirm Node.js LTS installed
npm -v                   # confirm npm installed
wsl --install            # install WSL2 + Ubuntu (PowerShell, admin)
sudo apt update && sudo apt upgrade -y   # update Ubuntu packages
sudo npm install -g pnpm # global install of pnpm package manager
pnpm -v                  # verify pnpm
docker --version         # confirm Docker Desktop talking to WSL
```

**Tools installed:** Git, Node.js LTS, VS Code, Docker Desktop, WSL2 + Ubuntu, pnpm, Postman.

---

## Phase 1 — Project scaffold

```bash
mkdir -p ~/projects/finapp                 # workspace root
cd ~/projects/finapp
mkdir web api docs                          # frontend / backend / docs folders
```

### Frontend
```bash
cd ~/projects/finapp/web
pnpm create next-app .                      # scaffold Next.js (TS, Tailwind, App Router, ESLint)
pnpm dev                                    # run dev server on :3000
```

### Backend
```bash
cd ~/projects/finapp/api
pnpm init                                   # create package.json
pnpm add express cors dotenv zod jsonwebtoken bcrypt   # runtime deps
pnpm add -D typescript ts-node-dev @types/node @types/express  # dev deps
npx tsc --init                              # generate tsconfig.json
touch index.ts                              # initial entry file (later replaced by src/main.ts)
npx ts-node-dev index.ts                    # run server with auto-reload
```

**Fixed:** `tsconfig.json` was using `verbatimModuleSyntax` which clashed with CommonJS Express imports. Rewrote with `module: "CommonJS"`, `esModuleInterop: true`.

### Local infra (Postgres + Redis in Docker)
```bash
cd ~/projects/finapp
touch docker-compose.yml                    # define services
sudo usermod -aG docker $USER               # grant Docker access to user
newgrp docker                               # reload group in shell
docker compose up -d                        # start Postgres + Redis in background
docker ps                                   # verify both containers running
```

`docker-compose.yml` defines:
- `postgres:16` on port 5432, user/pass/db = `app` / `app` / `finapp`
- `redis:7` on port 6379

---

## Phase 2 — Auth (foundation feature)

### Backend folders
```bash
cd ~/projects/finapp/api
mkdir -p src/routes src/controllers src/services src/lib src/middleware src/validators
```

### Auth dependencies
```bash
pnpm add bcrypt jsonwebtoken
pnpm add -D @types/bcrypt @types/jsonwebtoken
```

### Files created
- `src/main.ts` — Express bootstrap, mounts `/auth` routes, `/health`, CORS.
- `src/routes/auth.routes.ts` — `POST /auth/signup`, `POST /auth/login`, `GET /auth/me`.
- `src/controllers/auth.controller.ts` — request handlers using Prisma.
- `src/services/auth.service.ts` — `hashPassword`, `comparePasswords`, `createToken`.
- `src/middleware/auth.middleware.ts` — `requireAuth` JWT verifier.
- `src/validators/auth.validator.ts` — zod schema for email + password.

### Test calls used during build
```bash
# Signup test
curl -X POST http://localhost:4000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Login test
curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Protected route test
curl http://localhost:4000/auth/me \
  -H "Authorization: Bearer <token>"
```

---

## Phase 3 — Database (Prisma + Postgres)

```bash
cd ~/projects/finapp/api
pnpm add prisma @prisma/client              # ORM + client
pnpm add @prisma/adapter-pg pg              # Prisma 7 Postgres adapter
npx prisma init                             # creates prisma/schema.prisma + prisma.config.ts
pnpm approve-builds                         # allow Prisma postinstall scripts
```

**Edits made:**
- `api/.env` → set `DATABASE_URL="postgresql://app:app@localhost:5432/finapp?schema=public"` (replaced the auto-generated `prisma+postgres://...` placeholder).
- `prisma/schema.prisma` → defined the `User` model.
- `src/lib/prisma.ts` → singleton Prisma client wired to `PrismaPg` adapter.

```bash
npx prisma migrate dev --name init_users    # create + apply first migration
npx prisma generate                         # regenerate Prisma client
```

After this, `signup` writes real users to Postgres and `login` looks them up.

---

## Phase 4 — Validation

```bash
# auth.validator.ts uses zod
```
- Replaced manual `if (!email || !password)` checks with `authSchema.safeParse(req.body)`.
- Bad emails → `400` with `errors.email`. Short passwords → `400` with `errors.password`.

---

## Phase 5 — Frontend wired to API

### Port fix
- `api/.env` → added `PORT=4000` so the API stops colliding with Next.js (3000).
- `web/.env.local` → added `NEXT_PUBLIC_API_URL=http://localhost:4000`.

### New files
- `web/lib/api.ts` — fetch helper. Originally used frontend token storage; later replaced by httpOnly cookie auth.
- `web/app/page.tsx` — Payphlo landing.
- `web/app/signup/page.tsx` — signup form (auto-logs in on success).
- `web/app/login/page.tsx` — login form.
- `web/app/dashboard/page.tsx` — protected page that calls `/auth/me`, redirects to `/login` without a token.
- `web/app/layout.tsx` — title set to "Payphlo".

### Verified end-to-end
1. `/signup` → creates user in Postgres → auto-login → `/dashboard` shows email + user ID.
2. Log out → token cleared → `/dashboard` bounces to `/login`.
3. Log back in → `/dashboard` again.
4. Bad input → red field errors.

---

## Where we are now

✅ Phase 0 — Local setup
✅ Phase 1 — Project scaffold
✅ Phase 2 — Auth (signup, login, JWT, protected routes)
✅ Phase 3 — Real database persistence
✅ Phase 4 — Input validation
✅ Phase 5 — Frontend connected to API
✅ Phase 6 — AI Assistant (`/assistant/ask`, guardrails, conversation history, chat UI)
✅ Phase 7 — Mock Transfers (5 corridors, 3 speed tiers, true-cost panel, 10-min quote lock, AI integration)
✅ Phase 8 — Mock Investing (paper trading)

---

## Phase 8 — Mock Investing (paper trading)

### Schema (migration `20260510233349_add_investing`)
- `User.cashBalance Float @default(10000)` — every signup starts with $10,000 virtual cash.
- `Asset` — seeded with 10 symbols (VOO, VTI, AGG, AAPL, MSFT, NVDA, TSLA, JNJ, BTC, ETH) covering ETF / stock / crypto and low/medium/high risk.
- `WatchlistItem` — `@@unique([userId, assetId])`.
- `PaperOrder` — every executed buy/sell, with `price`, `total`, `status: "filled"`.
- `Position` — `@@unique([userId, assetId])` with `avgCost` (weighted-average cost basis).

### Services
- `market.service.ts` — deterministic mock pricing:
  - Sine drift over 6 h cycle + 30 s bucketed jitter scaled by per-symbol volatility.
  - `dayChange()` compares current price to the price at start-of-UTC-day for an intraday percentage.
- `investing.service.ts`:
  - `ensureAssetsSeeded()` upserts the 10 seed assets on first read.
  - `getPortfolio(userId)` returns cash + position market value + total + per-position unrealized P&L.
  - `placePaperOrder()` executes inside `prisma.$transaction`:
    - **buy** → checks cash, decrements `cashBalance`, upserts position with weighted-average cost.
    - **sell** → checks shares, increments `cashBalance`, decrements / deletes position.

### Routes (all `requireAuth`)
- `GET    /investing/assets`
- `GET    /investing/assets/:symbol`
- `GET    /investing/portfolio`
- `POST   /investing/orders` (validated with `orderSchema`)
- `GET    /investing/orders`
- `GET    /investing/watchlist`
- `POST   /investing/watchlist/:symbol`
- `DELETE /investing/watchlist/:symbol`

### Frontend
- `web/app/investing/page.tsx` — market browse (filter by all / stock / etf / crypto / ★watchlist), watchlist toggle, portfolio sidebar (cash, holdings, total value), per-position unrealized P&L. Polls every 15 s.
- `web/app/investing/[symbol]/page.tsx` — price + day change, risk badge with plain-English risk blurb, buy/sell form with estimated-total preview and cash/shares validation, "Ask Phlo" deep link to the assistant prefilled with the symbol. Polls every 10 s.
- Dashboard — Investing card is now a link showing total portfolio value.

### Design decisions
- **Why deterministic prices?** No paid market data feed for the MVP; we still want prices that *move* so the UI feels alive but are reproducible for any user / any browser at the same instant.
- **Why $10,000 starting cash?** Big enough to buy meaningful slices of every asset class (including high-priced ones like BTC fractions or NVDA) so new users can experiment immediately.
- **Why fractional shares?** `quantity: Float` everywhere so users can spend exact dollar amounts and exercise crypto trades naturally.
- **Why `prisma.$transaction` for orders?** Cash debit, position upsert, and order insert must all succeed or all fail. Anything less and a crash mid-write would leave the user with "free" shares or vanished cash.

---

## Phase 3 — Educational LLM assistant + parallax UI polish

### Backend
- New `api/src/services/llm.service.ts` — provider-agnostic chat client. `LLM_PROVIDER` env switches between `openai` / `mistral` / `anthropic` / `none`. Each adapter is ~25 lines of `fetch`. No SDK deps.
- Refactored `api/src/services/ai.service.ts`:
  - Strict `EDUCATOR_SYSTEM_PROMPT` ("never tell the user to buy/sell/hold; redirect opinion-seeking prompts to education").
  - Strict `COMPARATOR_SYSTEM_PROMPT` ("never declare a winner; explain trade-offs").
  - Tries the LLM first; on any error falls back to the original rule-based templates so the app still works with zero API keys.
  - Re-runs `checkGuardrails()` on the LLM **output** as a second safety net.
  - New `compareAssets()` function with fallback rendering.
- New endpoint: `POST /assistant/compare` — takes 2-3 symbols, hydrates each via `getAssetWithPrice()`, calls `compareAssets()`, persists messages.
- New `api/.env.example` documents `LLM_PROVIDER`, `LLM_API_KEY`, `LLM_MODEL`.

### Frontend animations (no extra deps)
- **Parallax page transitions** (`globals.css` + `AppShell.tsx`): two layered `key={pathname}` wrappers — outer "deep" layer slides 40px / 420ms, inner "front" layer slides 16px / 260ms — creates a depth illusion on every navigation.
- **Sliding sidebar pill** (`AppShell.tsx`): a single absolutely-positioned `<span>` whose `transform: translateY()` is driven by the active item's `offsetTop`. Slides smoothly between routes (320ms cubic-bezier ease-out).
- **Animated number counters** (`components/AnimatedNumber.tsx`): `requestAnimationFrame`-driven cubic ease-out tween on prop change. Used on dashboard total wealth and investing portfolio value. Tabular-nums to prevent width jitter.
- **Sparkline draw-in** (`components/Sparkline.tsx`): `stroke-dashoffset` animation draws the path left-to-right (700ms), gradient area fades in afterwards (500ms).
- All animations honor `prefers-reduced-motion`.
- Easing standard across the app: `cubic-bezier(0.2, 0.8, 0.2, 1)`. No bounce. Durations 220–420ms.

### Compare UI
- Assistant page gained a "Compare assets" button + modal. User picks 2-3 symbols → `api.compareAssets()` → assistant message rendered into the chat stream.

### Auth foundation hardening
- API auth now uses an httpOnly `payphlo_token` cookie on signup/login instead of frontend `localStorage`.
- Frontend requests send cookies with `credentials: "include"`.
- Logout clears the cookie through `POST /auth/logout`.
- Protected pages now redirect when the API returns `401 Unauthorized`.

### CSRF foundation
- API now issues a readable `payphlo_csrf` cookie.
- Unsafe assistant, transfer, and investing requests must include `X-CSRF-Token`.
- `web/lib/api.ts` automatically fetches/reads the token and attaches the header.

### Signup display name
- Signup now collects a display name and stores it on `User.name`.
- `/auth/me`, signup, and login responses include `name`.
- Dashboard greeting prefers the stored name and falls back to the email prefix for older users.

### Adaptive Phlo starter questions
- Phlo's empty-state question cards now adapt to safe usage signals: recent transfer currencies, portfolio position count, asset classes, and watchlist size.
- Prompts use everyday wording first, then Phlo can explain terms like FX spread, diversification, concentration risk, and volatility inside the answer.
- The UI avoids send/wait/buy/sell recommendation framing.

### Phlo history cleanup
- Added `DELETE /assistant/conversations/:id` to remove one saved chat.
- Added `DELETE /assistant/conversations` to clear all saved Phlo chats for the signed-in user.
- Assistant history UI now has per-chat delete controls and a guarded "Clear" action.

### Initial automated test baseline
- Added `api/tests` using Node's built-in test runner so the API can be tested without adding a new test framework yet.
- `pnpm test` now runs `pnpm run build` first, then executes the compiled-output unit/service tests with `node --test`.
- Coverage added for signup/login validation, CSRF token behavior, Phlo guardrails, Phlo conversation deletion/clear, and paper investing buy/sell cash + position rules.

### API integration test baseline
- Split API test commands into `pnpm test`, `pnpm run test:integration`, and `pnpm run test:all`.
- Added `api/src/app.ts` so tests can create the real Express app without binding the production dev port.
- Added a database-backed integration test that starts the real app on a temporary port, creates a throwaway user, verifies signup/login auth + CSRF cookies, confirms `/auth/me` returns the display name, proves unsafe protected writes fail without `X-CSRF-Token`, proves matching CSRF passes, and runs paper buy/sell flows through the real investing routes against Postgres.

### Mistral provider readiness
- Hardened `llm.service.ts` for real provider use with `LLM_TIMEOUT_MS`, `LLM_MAX_INPUT_CHARS`, `LLM_MAX_RESPONSE_CHARS`, `LLM_MAX_TOKENS`, and `LLM_TEMPERATURE`.
- Mistral remains selected by env (`LLM_PROVIDER=mistral`, `LLM_MODEL=mistral-small-latest`) and falls back to deterministic templates if the key is missing, the provider fails, times out, or returns an empty response.
- Assistant responses now include debug metadata (`source`, `provider`, `model`) so we can verify whether Phlo used Mistral or fallback.
- Added mocked LLM unit tests for Mistral request shape, config clamping, input trimming, timeout fallback behavior, and disabled-provider behavior.

### Design decisions
- **Why educational, never opinionated?** Three reasons: regulatory exposure (issuing recommendations looks like RIA territory in most jurisdictions), investor pitch ("we educate, we don't advise" is the safer story), and product fit (our user is new — frameworks help more than picks). Hard rule encoded in the system prompts AND as a post-output guardrail check.
- **Why a provider abstraction with fallback?** Cost flexibility (swap to Mistral / Haiku when bills grow), no demo blockers (clones run with zero keys), no vendor lock.
- **Why parallax + sliding pill (not Framer Motion)?** Same depth/premium feel as Linear/Revolut without the bundle weight. Pure CSS keyframes + a single rAF-driven counter component. Total animation code: ~150 lines.

## Next milestones
- Replace mock market data with a real provider (Alpaca / Polygon).
- Replace mock corridors with real FX (Wise API or partner rails).
- Add web/e2e coverage for the browser flows once the product UI settles.
