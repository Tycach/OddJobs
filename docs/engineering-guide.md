# Engineering Guide

## Current State

OddJobs is a React 19/Vite client with an independent Fastify API. Supabase Auth
OTP, server-verified access tokens, and a protected profile bootstrap are
implemented. Marketplace screens still use prototype fixtures and browser
state; jobs, chat, tracking, and payments are not production features yet.

## Source Layout

- `src/App.tsx` is the current composition root. It owns demo navigation,
  screen rendering, and the shared demo context. It remains large; split screen
  groups incrementally when those features are next changed.
- `src/demo/model.ts` owns prototype-only role/screen contracts, job and bid
  types, browser storage keys, and seed data. Keep production API and payment
  contracts out of this module.
- `src/index.css` owns global styles and shared visual rules.
- `src/main.tsx` mounts the app and imports the global stylesheet.
- `apps/api/` is an independently installable Fastify/TypeScript API service.
   It verifies Supabase tokens and exposes protected profile routes. Prisma
   defines identity, roles, provider profiles, jobs, quotes, and messages; only
   account profile bootstrap/read is currently backed by live data.
- `docs/` holds product/engineering decisions, implementation plans, and
   operational guidance that should be reviewed as the code evolves.

## Change Conventions

1. Keep feature UI close to its user journey. When extracting screens, use
   `src/features/<feature>/`; put reusable controls in `src/components/`.
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

- Replace demo login and role switching with authenticated sessions and
  server-enforced authorization.
- Replace local storage with API-backed records and a documented migration.
- Complete legal, payments-provider, privacy, tax, and worker-classification
  reviews described in `marketplace-payments-plan.md`.
- Follow `implementation-roadmap.md` gates; do not expose real payment actions
   until the independent API, ledger, provider approvals, and reconciliation are
   in place.
- Add monitoring, audit trails, backups, incident response, and tested
  reconciliation procedures.