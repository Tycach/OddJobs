# OddJobs API Service

This is the independently installable OddJobs API service. It is built and
tested separately from the Figma Make/Vite web application. It verifies
Supabase Auth access tokens and provides protected profile bootstrap/read and
supplier-application routes. It also provides persistent job, quote, hiring,
and completion workflows. Supplier applications are saved as provider
profiles in review. Provider accounts can publish ten listings before
identity approval; the server removes the listing cap after verification is
approved. Provider identity documents are stored in a private
Supabase Storage bucket and are available to administrators through audited,
short-lived links. Job-linked messaging, reviews, and the manual job-payment
ledger are API-backed. The ledger records hirer reports, worker confirmations,
disputes, and admin fee reconciliation; it does not collect funds, provide
escrow, or issue automated payouts.

## Boundary

- The repository root currently remains the Figma Make/Vite web application.
- The API owns authentication, authorization, validation, job and quote state.
- The current marketplace milestone does not charge users or move funds.
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

Before running, copy `.env.example` to `.env`. Use a dedicated Supabase
development project, not the previously configured shared/production project.
Point `DATABASE_URL` to the connection mode selected for the persistent API
runtime and `DIRECT_URL` to the direct/session connection used for Prisma
migrations. Set `DATABASE_POOL_MAX` to a safe per-instance connection cap
(default 5), then verify maximum API instances multiplied by this value, plus
worker and operational connections, stays below the Supabase pool's backend
connection budget. Set `SUPABASE_URL` and
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
`PORT`. Set the Render HTTP health check path to `/health/ready`; use
`/health/live` for process-only liveness probes. Keep at least two instances
for production availability where the service plan allows it, and configure
autoscaling bounds from measured load. Autoscaling is a Render service setting,
not enabled by this repository alone.

Configure the API service environment with `NODE_ENV=production`,
`DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `WEB_ORIGIN`
set to the exact Vercel site origin (scheme and hostname, without a path or
trailing slash). Set `SUPABASE_SECRET_KEY` only on the API service so it can
mint one-minute signed links for private identity documents. Never add this
secret key to Vite or the web hosting environment. `DIRECT_URL` is needed when
running Prisma migrations.

The Vercel frontend is built separately. Set `VITE_API_URL` in the Vercel
project's environment variables to the public Render service origin, then
redeploy the frontend so Vite includes it in the build. Set the frontend's
`VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` there as well. These
`VITE_` values are public client configuration; never put database credentials
or Supabase secret keys in Vercel frontend variables.

Only after verifying `.env` targets the dedicated development project, run
`npm run db:migrate:deploy` to apply pending versioned migrations, including
policy-consent, admin workflows, marketplace activity, and notification/outbox
tables, marketplace media storage policies, and the private
provider-verification bucket. The `20261123180000_hirer_job_media_upload`
migration allows active hirers and providers to upload and remove media only
inside their own storage folder. Do not run that command against the previously configured
shared/production project. The API accepts only the current policy versions and
stores each user/document/version acceptance once with a server-generated
timestamp.

## Marketplace jobs and quotes

The authenticated marketplace API supports `POST /v1/jobs`, role-scoped
`GET /v1/jobs`, job/quote reads, provider quote submission, customer quote
acceptance, and the awarded → in-progress → completion-pending → completed
workflow. Job and quote writes are server-validated and persisted in Postgres;
only the customer who owns a job and the authorized provider can advance its
state. Accepting a quote creates a payment agreement in the ledger; it does
not charge a user, move funds, or create escrow.

The `20261109180000_marketplace_realtime_policies` migration adds the quote
availability field, enables row-level read policies for authenticated
marketplace participants, and adds jobs and quotes to the Supabase Realtime
publication when available. Browser subscriptions are read-only and use
Supabase Auth; all writes still go through the API. Apply this migration only
to the dedicated development Supabase project until its row-level policies and
role boundaries have been validated there.

The web app's customer job list/post/quotes screens and provider job
feed/detail/management screens use these API workflows and refresh from
authorized Realtime events. The customer provider directory is API-backed and
returns only active, approved provider profiles with public fields. Staff can
search marketplace jobs and inspect quotes and activity timelines through
audited admin routes. Admin job reads do not expose customer contact details.

Marketplace changes persist in-app notifications and an outbox event in the
same database transaction. `GET /v1/notifications` and
`POST /v1/notifications/:notificationId/read` are scoped to the authenticated
user. The frontend shows these durable in-app notifications. The outbox is only
a durable event record today: no worker sends email, SMS, or push notifications,
and no background retry/processing service is deployed.

Job-linked messages, provider reviews, and manual payment confirmation are
implemented in the API. Payment records are not payment processing: no card or
M-Pesa collection, escrow, automated worker payout, or external payment
reconciliation is integrated. Some support/partner screens remain prototypes.

The API applies Helmet security headers, exact-origin CORS checks, a one MiB
JSON body limit, a configurable Postgres pool cap, API-wide
`Cache-Control: no-store`, and per-process request limits (120 requests/IP/minute
globally; 5 supplier application requests/IP/hour). The built-in limiter store
is in-memory: configure a shared rate-limit store or enforce equivalent limits
at the trusted gateway before running multiple API replicas. If deployed behind
a reverse proxy, configure Fastify to trust only the known proxy IP ranges;
never trust arbitrary forwarded-IP headers. The root `vercel.json` configures
cache/security headers for the Vite frontend; it does not configure API/CDN
behavior or Render scaling. See `../../docs/scalability-security-plan.md`.

## Initial Admin API

The read-only admin API requires an active `admin` role assignment in the
OddJobs database; a valid Supabase token or client-supplied role is not
sufficient. `GET /v1/admin/overview` returns live user, provider, verification,
and job counts supported by the current schema. `GET /v1/admin/users` returns
a paginated directory without email or phone fields. `GET /v1/admin/verification`
returns provider profile records filtered by status. `POST
/v1/admin/verification/:profileId/decision` records an audited `verified` or
`rejected` status for a profile currently in review; rejection requires a
reason. Approving the service application transactionally grants the provider role; rejection does not. This is not identity verification, and the current
product has no identity-evidence upload or review storage. Do not treat approval as proof of identity; identity evidence is not collected or reviewed.
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
submission switches are enforced by the API. The configured fee percentage is
captured in a payment agreement and shown as a separate hirer obligation; it
is reconciled manually and is not collected by the app. `POST /v1/ads` accepts authenticated campaign submissions (up to
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
`20261109170000_admin_console_features` migrations. Marketplace notifications
also require `20261116120000_marketplace_notifications_outbox`. Admin roles must be
provisioned by a trusted operator; public signup and provider application
flows do not grant them. Do not expose the database connection or grant admin
roles through browser-facing code.

For a first local development admin, create and confirm the account in Supabase
Auth, then run `npm run admin:bootstrap -- admin@example.com` from `apps/api`.
The one-time script bootstraps the OddJobs profile and grants the `ADMIN` role
only after you confirm the Supabase project ref. It refuses to run unless
`NODE_ENV=development`; verify the displayed Supabase project and database host
are your dedicated development environment before continuing. Never use this
script against shared or production data.

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
  New accounts receive only the consumer role. Submitting an ID-backed provider
  application adds provider workspace access while retaining consumer access.
- `POST /v1/provider-applications` stores provider details and private ID
  evidence in review. Pending providers may create three service listings;
  listing creation is transactionally capped by the API until an audited admin
  approval verifies them. Admin and support roles remain trusted operations.
- Core job and quote creation, reads, quote acceptance, and the initial job
  lifecycle are implemented. Provider discovery, job-linked messages, reviews,
  staff marketplace review, durable in-app notifications, and the manual
  payment ledger are API-backed. Automated payment collection, escrow, worker
  payouts, outbox delivery, and multi-instance rate-limit coordination are not
  implemented/configured.
- Service categories and marketplace settings are persisted, and the selected
  fee percentage is captured when an accepted bid creates its payment
  agreement. Job APIs do not yet validate new jobs against the category
  catalog. Promo
  codes and subscription plans are not implemented.
- Ad campaign review does not publish campaigns; there is no ad-serving
  integration or advertiser-facing campaign management screen.
- Admin-issued account suspension blocks the existing active-profile guarded
  operations and can be reversed by an admin. It does not ban the identity at
  Supabase Auth or remove content.
- A one-minute background collector records database, API resource, queue,
  report, support, and overdue-commission signals. Managed alerts can be
  acknowledged, assigned, and resolved with audited outcomes. The API exposes
  `/health/ready` for an external uptime provider; outbound email/SMS alerts
  and a third-party uptime account still need to be configured separately.
- Identity documents are not collected or stored; do not approve verification
  based on profile fields alone.
- Do not connect a real payment provider until legal/provider approval, ledger
  design, verified callbacks, idempotency, refund/dispute handling, and
  reconciliation are implemented and tested. See
  `../../docs/marketplace-payments-plan.md` and
  `../../docs/implementation-roadmap.md`.

## Admin team access

- Only an owner can invite administrators, revoke pending invitations, assign
  scoped roles, or remove invited administrators. Existing admin accounts are
  treated as protected legacy owners until explicitly managed.
- Invitations are sent through Supabase Auth and expire after seven days.
  Configure `SUPABASE_SECRET_KEY` on the API only, and allow the local and
  production `/consumer/adminInviteAccept` URLs in Supabase Auth redirect URLs.
- Team changes, invitations, alert actions, and other admin decisions are
  recorded in the audit log. Routine dashboard reads are not logged.
