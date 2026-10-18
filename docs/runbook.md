# Payphlo Runbook

How to start, stop, and operate the local dev environment.

---

## Daily startup (after laptop reboot)

You need **3 things running**: Docker services, API, Web.

### 1. Start Docker services (Postgres + Redis)
```bash
cd ~/projects/finapp
docker compose up -d
```
Verify:
```bash
docker ps
```
Expect to see `finapp-postgres-1` and `finapp-redis-1`.

### 2. Start the API (Express, port 4000)
Open a terminal:
```bash
cd ~/projects/finapp/api
npx ts-node-dev src/main.ts
```
Expect: `API running on http://localhost:4000`

Verify:
```bash
curl http://localhost:4000/health
```
Expect: `{"status":"ok"}`

### 3. Start the Web app (Next.js, port 3000)
Open a second terminal:
```bash
cd ~/projects/finapp/web
pnpm dev
```
Open browser at: http://localhost:3000

---

## Stopping everything

```bash
# In the API and Web terminals:
CTRL + C

# Stop Docker (optional — usually leave it running):
cd ~/projects/finapp
docker compose down
```

---

## Common issues

| Symptom | Fix |
|---|---|
| `Failed to fetch` in browser login form | API isn't on port 4000. Check `api/.env` has `PORT=4000` and restart API. |
| Next.js says "port 3000 in use, using 3001" | Something else is on 3000 (probably the API). Kill it and restart. |
| `permission denied` on `docker` command | Run `sudo usermod -aG docker $USER` then `newgrp docker`. |
| `EACCES` installing global npm | Use `sudo npm install -g <pkg>` or switch to nvm-managed Node. |
| Prisma "Can't reach database" | Postgres container isn't running. `docker compose up -d`. |

---

## Test the auth flow end-to-end

```bash
# Signup and save auth + CSRF cookies
curl -X POST http://localhost:4000/auth/signup \
  -H "Content-Type: application/json" \
  -c /tmp/payphlo-cookies.txt \
  -d '{"name":"Test User","email":"test@example.com","password":"password123"}'

# Login and refresh the auth cookie
curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -c /tmp/payphlo-cookies.txt \
  -d '{"email":"test@example.com","password":"password123"}'

# Protected route using the saved cookie
curl http://localhost:4000/auth/me \
  -b /tmp/payphlo-cookies.txt

# Read the CSRF token for unsafe authenticated requests
CSRF_TOKEN=$(grep payphlo_csrf /tmp/payphlo-cookies.txt | awk '{print $7}')

# Example unsafe request
curl -X POST http://localhost:4000/assistant/ask \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -b /tmp/payphlo-cookies.txt \
  -d '{"prompt":"What is diversification?"}'
```

---

## Automated checks

### API unit/service tests
```bash
cd ~/projects/finapp/api
pnpm test
```

This runs the fast API tests without needing to start a local HTTP server.

### API integration tests
Postgres must be running first:
```bash
cd ~/projects/finapp
docker compose up -d

cd api
pnpm run test:integration
```

This starts the real Express app on a temporary local port and tests signup/login cookies,
`/auth/me`, CSRF blocking/passing, and paper buy/sell flows against Postgres.

### Full API suite
```bash
cd ~/projects/finapp/api
pnpm run test:all
pnpm run typecheck
```

---

## Enable Mistral for Phlo

Phlo works without a paid provider because the API falls back to deterministic educational templates.
To test real Mistral answers locally, edit `api/.env`:

```env
LLM_PROVIDER=mistral
LLM_API_KEY=<your Mistral API key>
LLM_MODEL=mistral-small-latest
LLM_MAX_TOKENS=600
LLM_MAX_INPUT_CHARS=8000
LLM_MAX_RESPONSE_CHARS=2500
LLM_TIMEOUT_MS=12000
LLM_TEMPERATURE=0.3
```

Restart the API after changing `.env`:

```bash
cd ~/projects/finapp/api
pnpm run dev
```

If Mistral is slow, unavailable, or the key is missing, Phlo falls back to the built-in educational templates.

---

## Resetting the database (destructive)

```bash
cd ~/projects/finapp
docker compose down -v        # -v also removes the volume (wipes data)
docker compose up -d
cd api
npx prisma migrate dev
```
