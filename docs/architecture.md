# Payphlo Architecture

A current map of how the local product pieces fit together.

```
┌──────────────────┐        ┌──────────────────┐        ┌──────────────────┐
│   Browser        │        │   Express API    │        │   PostgreSQL     │
│   Next.js        │ HTTP   │   Node + TS      │ Prisma │   (Docker)       │
│   localhost:3000 │ ─────▶ │  localhost:4000  │ ─────▶ │  localhost:5432  │
└──────────────────┘        └──────────────────┘        └──────────────────┘
                                     │
                                     │ planned / not used yet
                                     ▼
                            ┌──────────────────┐
                            │   Redis          │
                            │   (Docker)       │
                            │  localhost:6379  │
                            └──────────────────┘
```

## Product Shape

Payphlo is being built as a real fintech product in small, testable slices:

- **Send** — mock remittance corridors, transparent FX quote breakdowns, quote confirmation, transfer history.
- **Invest** — deterministic mock market data, watchlist, paper orders, positions, portfolio P&L, sparklines.
- **Ask Phlo** — educational money guide with guardrails, provider fallback, and stock/asset comparisons.

The current app is still mock-money and mock-market-data only. No real funds move.

## Web (`web/`)

- Next.js 16 + React + TypeScript + Tailwind.
- App routes: `/`, `/signup`, `/login`, `/dashboard`, `/transfers`, `/investing`, `/investing/[symbol]`, `/assistant`.
- Shared UI:
  - `AppShell` — authenticated layout, sidebar, mobile nav, route transition wrapper.
  - `AuthShell` — signup/login layout.
  - `Logo` — Payphlo mark and wordmark.
  - `AnimatedNumber` — animated numeric counters.
  - `Sparkline` — SVG mini price charts.
- API calls live in `web/lib/api.ts`.
- Auth uses an API-set httpOnly cookie. `web/lib/api.ts` sends requests with `credentials: "include"` so the browser attaches the cookie automatically.

## API (`api/`)

- Express + TypeScript.
- Routes are mounted in `src/main.ts`:
  - `/auth`
  - `/assistant`
  - `/transfers`
  - `/investing`
- Controllers handle HTTP request/response work.
- Services hold business logic:
  - `auth.service.ts` — password hashing and JWT creation.
  - `transfer.service.ts` — mock corridors, speed tiers, FX quote math.
  - `market.service.ts` — deterministic mock prices and price history.
  - `investing.service.ts` — asset seeding, portfolio, paper orders, watchlist.
  - `ai.service.ts` — educational assistant dispatcher and fallback templates.
  - `llm.service.ts` — OpenAI / Mistral / Anthropic provider abstraction.
  - `guardrails.service.ts` — input and output checks for advice-like content.
- Validators use zod for runtime request validation.
- Prisma client lives in `src/lib/prisma.ts`.
- Startup validates required secrets, including `JWT_SECRET`.
- CORS is restricted to configured frontend origins.
- Auth and assistant write endpoints are rate-limited.

## Database

Source of truth: `api/prisma/schema.prisma`

Current tables:

- `User` — auth identity and virtual cash balance.
- `Conversation` / `Message` — assistant chat history.
- `TransferQuote` / `Transfer` — mock remittance quotes and confirmations.
- `Asset` — seeded stock/ETF/crypto universe.
- `WatchlistItem` — user watchlist.
- `PaperOrder` — executed mock buy/sell orders.
- `Position` — current paper holdings and average cost.

## Phlo Contract

Phlo is Payphlo's educational money guide. It can:

- explain financial concepts in plain English;
- compare stocks, ETFs, and crypto by risk, asset class, sector, and trade-offs;
- explain remittance costs and FX spreads;
- highlight questions a user should consider.

It must not:

- tell a user to buy, sell, hold, short, enter, or exit a specific asset;
- predict prices or guaranteed returns;
- present itself as licensed financial, tax, or legal advice.

The backend enforces this with strict prompts, a pre-check on user input, and a post-check on LLM output.

## LLM Provider Switching

The assistant can run with no paid provider or with a configured LLM:

```env
LLM_PROVIDER=none | openai | mistral | anthropic
LLM_API_KEY=...
LLM_MODEL=...
LLM_MAX_TOKENS=600
LLM_MAX_INPUT_CHARS=8000
LLM_MAX_RESPONSE_CHARS=2500
LLM_TIMEOUT_MS=12000
LLM_TEMPERATURE=0.3
```

Mistral is the preferred first real provider for Phlo. If no provider/key is configured,
or if the provider call fails/times out, `ai.service.ts` falls back to deterministic educational templates.
Assistant responses include internal debug metadata: `source`, `provider`, and `model`.

## Auth Flow

1. User signs up or logs in with email and password.
2. API validates with zod, hashes/compares the password with bcrypt, and creates a JWT.
3. API stores the JWT in the `payphlo_token` httpOnly cookie.
4. API also issues a readable `payphlo_csrf` cookie for unsafe request protection.
5. Frontend calls the API with `credentials: "include"`; browser sends cookies automatically.
6. For unsafe methods, `web/lib/api.ts` sends `X-CSRF-Token` from the CSRF cookie.
7. `requireAuth` verifies the auth cookie token and sets `req.userId`. It still accepts a bearer token for tooling/backwards compatibility.
8. `requireCsrf` rejects unsafe assistant/transfer/investing requests if the CSRF cookie and header do not match.
9. Protected handlers query data scoped to `req.userId`.
10. Logout calls `POST /auth/logout`, which clears auth and CSRF cookies.

## Known Foundation Work

- Add browser-level e2e tests once the UI settles.
- Replace mock market/FX services with real providers when product scope requires it.
