# OddJobs

OddJobs is a mobile-first marketplace connecting hirers and workers. The web
client is React + Vite; the separately deployed API uses Fastify, Prisma, and
Supabase Postgres/Auth. Job posts, bids, job conversations, profiles, reviews,
and the manual payment-confirmation ledger have API-backed workflows. Payment
recording does not collect funds or provide escrow or automated payouts.

## Project map

- `src/App.tsx` contains the route handling and app shell.
- `src/auth/` contains browser authentication and API integration.
- `src/features/` contains customer, provider, admin, and public pages.
- `apps/api/` is the independently installable API service; see
  `apps/api/README.md` for local and deployment setup.
- `docs/engineering-guide.md` explains code boundaries and conventions.
- `docs/marketplace-payments-plan.md` documents payment policy and gates.
- `docs/implementation-roadmap.md` tracks product implementation milestones.
- `docs/scalability-security-plan.md` records scale targets, architecture,
  current controls, and the remaining infrastructure work for a million-user
  growth target.

## Run locally

```sh
pnpm install
pnpm dev
```

Create a production frontend build with `pnpm build`.

Run the API independently from `apps/api` with `npm install`,
`docker compose up -d db`, and `npm run dev`. The frontend and API have
separate package manifests, build commands, environment configuration, and
deployment targets.

For Supabase Auth, set the public Supabase URL and
`VITE_SUPABASE_PUBLISHABLE_KEY` in `.env.local`. Configure the intended email,
phone/OTP, Google, and Apple providers and their redirect URLs in Supabase.
The browser publishable key is public configuration; never put database
passwords or Supabase secret keys in Vite variables.

For the API, configure `DATABASE_URL`, `DATABASE_POOL_MAX`, `SUPABASE_URL`,
`SUPABASE_PUBLISHABLE_KEY`, and the exact `WEB_ORIGIN` in `apps/api/.env`.
Keep credentials in the deployment secret manager and use a separate staging
database. Set `DATABASE_POOL_MAX` from the database pool's connection budget
and maximum API replica count; increasing API instances without that
calculation can exhaust Postgres connections.

## Current scale and security controls

- API request IDs, credential-redacted structured logs, Helmet headers,
  exact-origin CORS, an in-process rate limiter, and graceful shutdown are
  implemented.
- API and health responses default to `Cache-Control: no-store`; a one MiB
  request-body limit reduces exposure to oversized JSON payloads.
- The Prisma/Postgres pool is capped at five connections per API process by
  default and can be adjusted with `DATABASE_POOL_MAX` after capacity planning.
- `vercel.json` configures long-lived caching for Vite's content-hashed build
  assets, short caching for public brand images, and baseline browser security
  headers. It applies when the frontend is deployed on Vercel.
- `/health/live` and `/health/ready` provide process and database readiness
  checks.

These are application-level safeguards, not a million-user deployment by
themselves. A shared Redis rate-limit store, production CDN/WAF configuration,
multi-instance API autoscaling, database pool sizing, external monitoring,
load testing, and recovery drills still need deployment/account configuration.
The current rate limiter is in-memory and its limits multiply across replicas;
do not treat it as a global abuse-control system when scaling horizontally.
See the [scalability and security plan](docs/scalability-security-plan.md) for
the staged implementation and operational gates.

## Product and production limits

Most screens are API-backed, but some prototype screens still use sample data
in browser `localStorage`; do not treat those as business records. Job payment
records capture the agreed split and confirmation/reconciliation states, but
OddJobs does not process card or M-Pesa payments, hold escrow, or send
automated worker payouts. Validate role boundaries, database migrations,
backup restoration, and deployment settings in staging before production
changes. Never commit `.env` files or put server credentials in browser code.
