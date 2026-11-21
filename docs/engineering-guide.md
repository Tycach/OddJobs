# Engineering Guide

## Current State

OddJobs is a React 19/Vite client with an independent Fastify API. Supabase Auth
password and OTP sign-in, customer registration, password recovery, optional
Google/Apple OAuth, server-verified access tokens, and protected profile
bootstrap are implemented. Provider applications are API-backed and reviewed
by administrators with private identity documents. Providers can use the
workspace and publish ten listings before approval; approval removes the cap.
Core job and
quote journeys, approved-provider discovery, staff marketplace review, and
in-app notifications are API-backed. Several surrounding screens still use
prototype fixtures and browser state; messaging, tracking, dispute resolution,
and payments are not production features yet. The durable event outbox has no
delivery worker.

## Source Layout

- `src/App.tsx` owns the authenticated route shell, workspace switching, and
  top-level feature composition. Keep screen behavior in feature modules.
- `src/app/access.ts` owns workspace routes, navigation entries, role homes,
  and the frontend route guard. The authenticated API profile remains the
  source of workspace access; route selection never grants a role.
- `src/features/marketplace/hooks.ts` owns the API-backed marketplace read and
  refresh hooks. Keep feature API calls out of screen composition where
  practical.
- `src/features/customer/ProviderDirectory.tsx` owns live provider search and
  public provider profile views.
- `src/features/customer/CustomerScreens.tsx` groups customer job, quote,
  history, and preference screens.
- `src/features/provider/ProviderScreens.tsx` groups provider onboarding,
  job management, and provider-only dashboard screens.
- `src/features/admin/MarketplaceOperations.tsx` owns staff marketplace job
  search, case details, quote review, and activity timelines.
- `src/features/admin/AdminConsoleScreens.tsx` composes the admin overview,
  user, verification, moderation, category, ads, audit, and settings screens.
- `src/features/marketplace/Notifications.tsx` owns the API-backed in-app
  notification list and read actions.
- `src/features/prototype/PrototypeScreens.tsx` contains visibly marked
  support and partner previews that do not write live records.
- `src/shared/components/WorkspaceUi.tsx` provides shared visual components for
  the feature modules.
- `src/demo/model.ts` owns prototype-only role/screen contracts, job and bid
  types, browser storage keys, and seed data. Keep production API and payment
  contracts out of this module.
- `src/index.css` owns global styles and shared visual rules.
- `src/main.tsx` mounts the app and imports the global stylesheet.
- `apps/api/` is an independently installable Fastify/TypeScript API service.
  It verifies Supabase tokens and exposes protected profile, marketplace, and
  admin routes. Private provider IDs use Supabase Storage and admin-only,
  short-lived links. Prisma defines identity, roles, provider profiles, jobs,
  quotes, activity, messages, in-app notifications, and the event outbox.
- `docs/` holds product/engineering decisions, implementation plans, and
   operational guidance that should be reviewed as the code evolves.

## Change Conventions

1. Keep feature UI close to its user journey. Use `src/features/<feature>/`
   for screens, data hooks, and feature components; put reusable controls in
   `src/shared/components/`.
2. Keep route definitions, domain types, and infrastructure in purpose-named
   modules. Avoid creating a catch-all `utils` module.
3. Keep demo state clearly named and visibly simulated. Do not silently turn
   browser state or route checks into production authentication or money state.
4. Keep currency calculations out of display components. A future backend must
   calculate and persist amounts using integer minor units, explicit currency,
   and a documented rounding rule.
5. Treat the server and payment provider as authoritative for payment status,
   fees, refunds, disputes, and payouts. The browser requests actions and shows
   results; it cannot authorize or confirm money movement.
6. Never put provider credentials, identity documents, or production secrets in
   browser code, local storage, source control, or demo fixtures.
7. Prefer small feature-level changes. Run `pnpm build`; add focused automated
   tests when business rules or money-state transitions are introduced.

## Suggested Future Boundaries

Keep the API independently built and deployed under `apps/api`; these are
production targets that are not yet implemented:

- `src/features/` for marketplace user journeys and UI.
- `apps/api/` for a trusted server-side API for identity, authorization, jobs,
   payments, disputes, and provider payouts. The browser must not import its
   implementation or receive its secrets.
- PostgreSQL persistence is modeled with Prisma in `apps/api/prisma/`. The
   financial ledger is not implemented yet.
- A payment-provider adapter that isolates provider-specific APIs and events.
- Background workers for webhooks, retries, notifications, and reconciliation.
- An explicit API contract (OpenAPI recommended) to keep client and server
   integration reviewable without coupling their source code.

Choose the backend framework, hosting, and provider after confirming team
experience, provider support, data residency needs, and the Kenyan operating
model. Do not add a backend framework to this front-end prototype by assumption.

## Before Production

- Continue replacing prototype screens and local demo state with authenticated
  API-backed journeys and server-enforced authorization. The public entry page
  guides customer, provider, and staff sign-in; selected workspace is only a
  navigation hint.
- Replace local storage with API-backed records and a documented migration.
- Complete legal, payments-provider, privacy, tax, and worker-classification
  reviews described in `marketplace-payments-plan.md`.
- Follow `implementation-roadmap.md` gates; do not expose real payment actions
   until the independent API, ledger, provider approvals, and reconciliation are
   in place.
- Add monitoring, audit trails, backups, incident response, and tested
  reconciliation procedures.
- Keep API rate limits backed by a shared store or trusted gateway when scaling
  beyond one process; only trust explicitly configured reverse-proxy IP ranges.
- Run authorization and authentication regression tests in an authorized
  staging environment with dedicated role-specific test accounts.
