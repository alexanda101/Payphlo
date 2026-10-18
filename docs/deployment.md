# Production Deployment

Payphlo uses three public endpoints:

- `https://payphlo.com` — Next.js web app on Vercel.
- `https://www.payphlo.com` — redirects to the primary web domain.
- `https://api.payphlo.com` — Express API on Render.

PostgreSQL runs as a managed Render database. Redis is not required because the
current application does not use it.

## 1. Deploy the API and PostgreSQL on Render

1. Sign in to Render with GitHub and grant access to `alexanda101/Payphlo`.
2. Create a new Blueprint and select the repository.
3. Render detects the root `render.yaml` and proposes `payphlo-api` and
   `payphlo-db`.
4. Review the plan choices and deploy the Blueprint.
5. Confirm `https://<render-service>.onrender.com/health` returns
   `{ "status": "ok" }`.

The Blueprint generates `JWT_SECRET`, connects `DATABASE_URL`, generates the
Prisma client, compiles the API, applies migrations during the free-tier build,
and starts the compiled API.

To enable Mistral later, add these secret environment variables to the Render
web service and redeploy:

```env
LLM_PROVIDER=mistral
LLM_API_KEY=<secret>
LLM_MODEL=mistral-small-latest
```

## 2. Deploy the Web App on Vercel

1. Import `alexanda101/Payphlo` into Vercel.
2. Set **Root Directory** to `web`.
3. Keep **Framework Preset** set to Next.js.
4. Add `NEXT_PUBLIC_API_URL` with the temporary Render URL.
5. Deploy and record the generated `*.vercel.app` URL.
6. Add that exact URL to `CORS_ORIGINS` in Render, then redeploy the API.

## 3. Connect the Domains

Add `payphlo.com` and `www.payphlo.com` to the Vercel project. Add
`api.payphlo.com` to the Render web service. Each provider displays the exact
DNS records it requires.

In Porkbun, open **Domain Management**, expand `payphlo.com`, and edit
**DNS Records**. Add the provider-supplied records:

| Type | Host | Answer |
| --- | --- | --- |
| A | blank / `@` | Vercel-provided address |
| CNAME | `www` | Vercel-provided target |
| CNAME | `api` | Render-provided target |

Delete only conflicting parking records. Preserve mail-related MX and TXT
records. Wait for both providers to verify DNS and issue TLS certificates.

## 4. Switch to Production URLs

Set the Vercel production environment variable:

```env
NEXT_PUBLIC_API_URL=https://api.payphlo.com
```

Set the Render environment variable:

```env
CORS_ORIGINS=https://payphlo.com,https://www.payphlo.com
```

Redeploy both services after changing their environment variables.

## 5. Verify

```bash
curl https://api.payphlo.com/health
curl -I https://payphlo.com
```

Then verify signup, login, logout, assistant history, transfer quotes, watchlist,
and paper buy/sell flows from a phone and desktop browser.

## Plan Warning

The Blueprint starts on Render's free plans for a no-cost deployment test. Free
web services sleep after inactivity, and free PostgreSQL databases expire. Move
both resources to persistent paid plans before inviting real users.
