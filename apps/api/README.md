# OddJobs API Service

This is the independently installable OddJobs API service. It is built and
tested separately from the Figma Make/Vite web application. It verifies
Supabase Auth access tokens and provides protected profile bootstrap/read
routes. Prisma models are in place, but job/quote/message APIs and payments are
not implemented.

## Boundary

- The repository root currently remains the Figma Make/Vite web application.
- The API owns authentication, authorization, validation, jobs, fee
  calculation, payment state, disputes, ledger entries, and payout decisions.
- The web client calls the API over authenticated HTTP and treats API responses
  as authoritative. It must not import API implementation files.
- Define the client/server contract explicitly (prefer a versioned OpenAPI
  specification with generated or validated client types).
- Keep API dependencies, environment configuration, tests, build, and
  deployment independent from the web app. Never expose API secrets to Vite.

## Local Development

Install and run from this directory:

```sh
npm install
docker compose up -d db
npm run db:migrate:dev
npm run dev
```

Before running, copy `.env.example` to `.env`. For Supabase, set `DATABASE_URL`
to the transaction-mode pooler URL for API runtime and `DIRECT_URL` to the
session-mode pooler URL for Prisma migrations. Set `SUPABASE_URL` and
`SUPABASE_PUBLISHABLE_KEY` for server-side token verification. Do not configure
or use the Supabase secret key for this flow. Keep database credentials private
and out of source control. The service listens on port
3000 by default; liveness is at
`/health/live`, readiness at `/health/ready`, and interactive API documentation
at `/docs`.

Run checks with `npm test`, `npm run typecheck`, and `npm run build`. Use
`npm run db:status` to inspect applied migrations. Production configuration
must be provided through the deployment secret manager; never commit `.env` or
put API secrets in Vite variables.

## Current Limits

- `/v1/me/bootstrap` and `/v1/me` require a verified Supabase bearer token.
  New accounts receive only the consumer role; provider/staff provisioning is
  not implemented.
- Job, quote, message CRUD, realtime updates, payment collection, worker
  payouts, and production deployment are not implemented.
- Do not connect a real payment provider until legal/provider approval, ledger
  design, verified callbacks, idempotency, refund/dispute handling, and
  reconciliation are implemented and tested. See
  `../../docs/marketplace-payments-plan.md` and
  `../../docs/implementation-roadmap.md`.

