# Implementation Roadmap

This is a phased delivery plan for turning the prototype into a production
marketplace. A phase is not complete because its UI exists; each phase has an
explicit operational and verification gate.

## Phase 1: Product and Front-End Foundation

**Status: Foundation implemented; the app is still being modularized.**

- Set the orange-first visual identity with white surfaces and restrained blue
  informational accents; keep layout and interactions unchanged.
- Separate demo domain data, access rules, provider discovery, and staff
  marketplace operations from the app composition root.
- Document code conventions, payment research, and the independent API
  boundary.
- Keep unfinished journeys clearly marked as prototypes; live job, quote,
  provider discovery, staff operations, and notification journeys use the API.

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
- Authentication, marketplace persistence, and read-only Realtime refresh are
  now implemented in later milestones; payments and external event delivery
  remain outside the current foundation.

**Gate:** independent build/test/deploy; secrets are server-only; health,
logging, migrations, backup/restore, rollback, and incident ownership are
documented and tested.

## Phase 3: Identity, Roles, and Marketplace Core

**Status: Core role-aware flows are implemented; broader marketplace completion remains open.**

- Added Prisma ORM 7.10.1 to the independent API service with a PostgreSQL
  driver adapter and generated client.
- Added an initial versioned migration for users, identity handles, role
  assignments, hashed session tokens, provider profiles, jobs, revisioned
  quotes, and job messages.
- Stored quote/job amounts as integer minor units and enforced one accepted
  quote per job in PostgreSQL.
- Switched the API readiness probe to Prisma's database client.
- Added Supabase phone/email OTP and password sign-in, customer registration,
  password recovery, and optional Google/Apple OAuth in the browser.
- Added API-side token verification, protected profile bootstrap/read routes,
  and `POST /v1/provider-applications` for supplier profiles awaiting review.
- New accounts receive only the consumer role; the API ignores client-selected
  role claims and routes are constrained to roles returned by the API.
- Added a shared responsive orange login/signup experience based on the
  supplied OddJobs reference artwork. Remember-me selects session-only or
  persistent browser storage for new Auth sessions.
- Added a public role chooser for customer, provider, and staff sign-in. The
  selected workspace guides navigation; API profile roles remain authoritative.
- Customers can use both approved-provider discovery and job posting, including
  when their account also has an approved provider role. Providers cannot quote
  their own jobs. Staff can review customer and provider activity together.
- Added an API-backed provider directory restricted to active, approved
  providers, with public profile fields only.
- Added audited staff marketplace job search and case details with quotes and
  activity timeline.
- Added persistent in-app notifications written in the same transaction as
  marketplace events, plus user-scoped listing and read state. An outbox table
  records events for future delivery integrations.

Still required before Phase 3 is complete:

- Apply the migration to a running PostgreSQL instance and verify migration
  status and backup/restore procedures.
- Configure Supabase public Auth settings in the web app and API, enable the
  chosen password/OTP/OAuth providers, and confirm redirect and delivery
  settings in Supabase.
- Obtain legal/privacy approval for the Terms & Conditions and Privacy Policy,
  complete the privacy contact, retention, and hosting details, and apply the
  policy-consent migration before deploying. Versioned acceptance and
  re-acceptance are implemented and covered by API/UI checks.
- Configure a shared rate-limit store or equivalent edge limits for multi-
  replica API deployment, and trust only explicitly known proxy IP ranges.
- Run the role-boundary, recovery/OAuth redirect, and invalid/expired-token
  checks in an authorized staging environment before production.
- Publish and link approved Terms/Privacy documents and persist versioned
  consent acceptance before enabling production signup.
- Provider applications collect private ID evidence. Pending providers retain
  customer access, may use the provider workspace, and are capped at three
  listings until trusted, audited admin approval. Admin and support roles still
  require trusted server-side provisioning.
- Core authenticated job and quote routes exist, including ownership checks,
  provider approval checks, quote acceptance, and the initial job lifecycle.
- Complete job/quote editing, actual dispute handling, messaging, and external
  notification delivery before removing their remaining demo fixtures.
- Replace remaining demo local-storage journeys with API-backed
  queries/mutations and confirm the refresh/realtime behavior for each workflow.
- Use the public entry flow to guide customer, provider, and staff sign-in;
  workspace selection is a navigation hint and server profile roles remain
  authoritative.
- Add privacy/retention policies and worker onboarding before real identity
  documents are collected.

The app shell now delegates customer, provider, admin, notification, provider
discovery, and support/partner prototype screens to feature modules. Unfinished
journeys such as disputes, messaging, saved providers, and profile editing are
visibly marked prototype experiences and must not be presented as live services.
The outbox is persisted but has no delivery worker; only in-app notification
rows are currently consumed by the client.

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
