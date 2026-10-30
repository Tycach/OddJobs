# Implementation Roadmap

This is a phased delivery plan for turning the prototype into a production
marketplace. A phase is not complete because its UI exists; each phase has an
explicit operational and verification gate.

## Phase 1: Product and Front-End Foundation

**Status: Implementation complete.**

- Set the orange-first visual identity with white surfaces and restrained blue
  informational accents; keep layout and interactions unchanged.
- Separate demo domain data from the app composition root.
- Document code conventions, payment research, and the independent API
  boundary.
- Keep the front end clearly in demo mode; no real user data or money.

**Complete when:** the team approves the brand and project boundaries, the
frontend build passes, and the API remains an independent service rather than
being embedded in browser code.

## Phase 2: Independent API Foundation

**Status: Foundation implemented; production gate remains open.**

- Added a self-contained Fastify/TypeScript `apps/api` package with its own
  dependencies, lockfile, compiler settings, scripts, and tests.
- Added validated environment configuration, structured logs with credential
  redaction, request IDs, Helmet, and a single-origin CORS policy.
- Added liveness and PostgreSQL readiness endpoints plus local Docker Compose
  configuration.
- Added generated OpenAPI documentation and seven health/configuration tests.

Still required before calling this phase production-ready:

- Select hosting, CI owner, secret management, staging/production configuration,
  and deployment/rollback procedures.
- Apply and verify Prisma migrations; add backup/restore drills and operational
  ownership.
- Define the public API origin and environment-specific CORS policy when
  deployment is selected.
- Keep authentication, user/job persistence, payments, and real-time events for
  their later phases; none are implemented by this foundation.

**Gate:** independent build/test/deploy; secrets are server-only; health,
logging, migrations, backup/restore, rollback, and incident ownership are
documented and tested.

## Phase 3: Identity, Roles, and Marketplace Core

**Status: Supabase sign-in and profile bootstrap implemented; marketplace CRUD remains open.**

- Added Prisma ORM 7.10.1 to the independent API service with a PostgreSQL
  driver adapter and generated client.
- Added an initial versioned migration for users, identity handles, role
  assignments, hashed session tokens, provider profiles, jobs, revisioned
  quotes, and job messages.
- Stored quote/job amounts as integer minor units and enforced one accepted
  quote per job in PostgreSQL.
- Switched the API readiness probe to Prisma's database client.
- Added Supabase phone/email OTP in the browser, API-side token verification,
  and protected `/v1/me/bootstrap` and `/v1/me` routes.
- New accounts receive only the consumer role; the API ignores client-selected
  role claims and routes are constrained to roles returned by the API.

Still required before Phase 3 is complete:

- Apply the migration to a running PostgreSQL instance and verify migration
  status and backup/restore procedures.
- Configure Supabase public Auth settings in the web app and API, and confirm
  phone/email delivery settings in Supabase.
- Implement provider onboarding/provisioning and server-side authorization for
  provider/admin/support roles.
- Implement authenticated repositories/routes for jobs, quotes, and messages
  before replacing their demo fixtures in the web client.
- Replace demo local-storage state with API-backed queries/mutations and define
  how job updates reach active clients (polling or a separate real-time channel).
- Add privacy/retention policies and worker onboarding before real identity
  documents are collected.

**Gate:** authorization tests prove a user cannot access another user's jobs,
provider data, admin screens, or support-only operations.

## Phase 4: Payment Ledger and Provider Integration

- Resolve the legal operating model, worker classification, fees, payout terms,
  provider approval, and customer/worker disclosures before payment work.
- Implement a versioned fee schedule and immutable double-entry ledger using
  integer currency amounts and explicit currency.
- Add provider adapters for collection, status verification, refunds, payouts,
  and transaction queries. Keep provider-specific code isolated in the API.
- Implement authenticated/idempotent webhook processing, retries, payout
  state tracking, dispute holds, refund workflows, finance approvals, and daily
  reconciliation.
- Build customer receipts, worker earnings statements, and finance operations
  views from ledger records, not browser-calculated balances.

**Gate:** sandbox tests cover duplicate callbacks, timeouts, concurrent release,
failed/reversed payout, refunds, dispute, settlement mismatch, and provider
outage recovery. Provider and counsel approve the actual funds flow.

## Phase 5: Controlled Paid Pilot

- Launch in one city with a small verified worker cohort, low transaction
  limits, in-app-only payments, and manual payout release review.
- Assign finance and support owners; reconcile daily; monitor payment success,
  payout failures, disputes, refunds, and unmatched ledger/provider amounts.
- Collect worker and customer feedback on fee clarity, payout timing, and
  dispute handling.

**Gate:** agreed targets for successful collection/payout, reconciliation,
support response, dispute rates, and unit economics are met before expansion.

## Phase 6: Automation and Expansion

- Automate payout release only after the pilot validates job and dispute rules.
- Add payment methods, service categories, and regions behind provider
  adapters, with country-specific compliance and terms.
- Add stronger fraud monitoring, capacity/performance improvements, and
  disaster recovery tests as transaction volume grows.

**Gate:** each expansion has provider eligibility, legal review, support
coverage, capacity planning, and updated reconciliation controls.