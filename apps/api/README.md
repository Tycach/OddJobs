# OddJobs API Service

This is the independently installable OddJobs API service. It is built and
tested separately from the Figma Make/Vite web application. It verifies
Supabase Auth access tokens and provides protected profile bootstrap/read and
supplier-application routes. Supplier applications are saved as provider
profiles in review and never grant the provider role by themselves.
Job/quote/message APIs and payments are not implemented.

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

## Render API and Vercel Web Deployment

For a Render Web Service rooted at `apps/api`, use `npm ci && npm run build`
as the build command and `npm start` as the start command. The API defaults to
`0.0.0.0` in production (and `127.0.0.1` in development); Render supplies
`PORT`. Set the Render health check path to `/health/live`.

Configure the API service environment with `NODE_ENV=production`,
`DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `WEB_ORIGIN`
set to the exact Vercel site origin (scheme and hostname, without a path or
trailing slash). `DIRECT_URL` is needed when running Prisma migrations.

The Vercel frontend is built separately. Set `VITE_API_URL` in the Vercel
project's environment variables to the public Render service origin, then
redeploy the frontend so Vite includes it in the build. Set the frontend's
`VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` there as well. These
`VITE_` values are public client configuration; never put database credentials
or Supabase secret keys in Vercel frontend variables.

Run `npm run db:migrate:deploy` before releasing the signup policy-consent
flow. The API accepts only the current policy versions and stores each
user/document/version acceptance once with a server-generated timestamp.

The API applies Helmet security headers, exact-origin CORS checks, and
per-process request limits (120 requests/IP/minute globally; 5 supplier
application requests/IP/hour). The built-in limiter store is in-memory:
configure a shared rate-limit store or enforce equivalent limits at the
trusted gateway before running multiple API replicas. If deployed behind a
reverse proxy, configure Fastify to trust only the known proxy IP ranges;
never trust arbitrary forwarded-IP headers. Protected identity responses are
sent with `Cache-Control: no-store`.

## Initial Admin API

The read-only admin API requires an active `admin` role assignment in the
OddJobs database; a valid Supabase token or client-supplied role is not
sufficient. `GET /v1/admin/overview` returns live user, provider, verification,
and job counts supported by the current schema. `GET /v1/admin/users` returns
a paginated directory without email or phone fields. `GET /v1/admin/verification`
returns provider profile records filtered by status. `POST
/v1/admin/verification/:profileId/decision` records an audited `verified` or
`rejected` status for a profile currently in review; rejection requires a
reason. This status decision does not grant the provider role, and the current
product has no identity-evidence upload or review storage. Do not use the
decision endpoint as proof of identity until that evidence workflow exists.
`POST /v1/reports` accepts authenticated reports (limited to five per IP per
hour); `GET /v1/admin/moderation` lists them, and `POST
/v1/admin/moderation/:reportId/decision` updates workflow status with an audit
record. Resolving an account report may explicitly suspend a non-admin account;
the action is reasoned, transactional, audited, and reversible through
`POST /v1/admin/users/:userId/reinstate`. No content takedown, warning, or job
resolution is performed.

`GET /v1/admin/categories` and `PUT /v1/admin/categories` manage the audited
category catalog. `GET /v1/admin/settings` and `PUT /v1/admin/settings` manage
an allowlisted set of marketplace settings. Provider application and ad
submission switches are enforced by the API. The stored commission percentage
is **not** applied to charges because job and payment fee calculation is not
implemented. `POST /v1/ads` accepts authenticated campaign submissions (up to
five per IP per hour), and `GET /v1/admin/ads` plus
`POST /v1/admin/ads/:campaignId/decision` provide the audited review workflow.
Approval does not publish or serve an ad; an ad-serving integration is not
implemented.

`GET /v1/admin/monitoring` returns database/process health and queue-threshold
alerts, and records a snapshot when the database is reachable. `GET
/v1/admin/monitoring/history` reads the
latest 1,000 snapshots. The history is written when an admin requests a health
check; it is not continuous uptime monitoring and no external alert delivery is
configured. `GET /v1/admin/audit` returns persisted administrative access
events. Admin routes require the
`20261109130000_admin_audit`, `20261109150000_admin_workflows`, and
`20261109170000_admin_console_features` migrations. Admin roles must be
provisioned by a trusted operator; public signup and provider application
flows do not grant them. Do not expose the database connection or grant admin
roles through browser-facing code.

The admin Overview, Monitoring, Users & roles, Verification queue, Reports &
moderation, Audit log, Categories & fees, Ad approvals, and System config
screens use API-backed data. Before release, apply migrations in staging,
provision a dedicated test admin through a trusted operator, then validate
consumer denial, admin access, pagination, workflow decisions, and audit
persistence. Do not apply migrations to production without confirming the
target and receiving deployment approval.

Identity-document evidence storage/review is intentionally not implemented:
it requires an approved private object-storage provider/bucket, server-side
credentials, access/retention rules, and a defined evidence policy. Verification
status must not be treated as proof of identity. Historical health snapshots
are available, but continuous checks and external notifications require
separately configured monitoring/notification infrastructure.

Before production, maintain an authorized staging test environment with
dedicated accounts for each role. Regression checks should cover expired and
invalid tokens, missing authorization, consumer/provider/staff role boundaries,
forged role fields, wrong-user access, recovery and OAuth redirects, and rate
limits. Do not run load, brute-force, or destructive tests against production.

## Current Limits

- `/v1/me/bootstrap` and `/v1/me` require a verified Supabase bearer token.
  New accounts receive only the consumer role; provider/staff provisioning is
  not implemented.
- `POST /v1/provider-applications` stores the authenticated user's requested
  public name, service description, and region as a profile in review. It does
  not grant provider access; provider approval and role provisioning remain a
  trusted administrative operation.
- Job, quote, message CRUD, realtime updates, payment collection, worker
  payouts, and production deployment are not implemented.
- Service categories and marketplace settings are persisted, but the
  commission rate is not wired into any transaction or fee calculation, and
  job APIs do not yet validate new jobs against the category catalog. Promo
  codes and subscription plans are not implemented.
- Ad campaign review does not publish campaigns; there is no ad-serving
  integration or advertiser-facing campaign management screen.
- Admin-issued account suspension blocks the existing active-profile guarded
  operations and can be reversed by an admin. It does not ban the identity at
  Supabase Auth or remove content.
- Monitoring snapshots are created on admin health-check requests, not by a
  continuous background collector. External alerts are not configured.
- Identity documents are not collected or stored; do not approve verification
  based on profile fields alone.
- Do not connect a real payment provider until legal/provider approval, ledger
  design, verified callbacks, idempotency, refund/dispute handling, and
  reconciliation are implemented and tested. See
  `../../docs/marketplace-payments-plan.md` and
  `../../docs/implementation-roadmap.md`.
