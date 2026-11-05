# OddJobs

OddJobs is a mobile-first marketplace app in phased implementation. The shared
orange-branded login experience supports Supabase password and OTP sign-in,
customer registration, password recovery, and configured Google/Apple OAuth.
Supplier applications are stored for review; they do not grant provider access.
Service discovery, jobs, chat, tracking, and payments still use prototype
content and are not production marketplace flows.

## Project Map

- `src/App.tsx` contains the demo app shell, route handling, and current screens.
- `src/auth/` contains the Supabase browser auth/session integration.
- `src/demo/model.ts` contains demo-only shared types and seed data.
- `src/index.css` contains global styles and shared styling.
- `apps/api/` is the independently installable Fastify API service; see its
	README for local setup and current implementation limits.
- `docs/engineering-guide.md` explains code boundaries and conventions.
- `docs/marketplace-payments-plan.md` documents the payment and commission
	research, operating policy, provider questions, and delivery gates.
- `docs/implementation-roadmap.md` tracks the implementation phases and gates.

## Run locally

```sh
pnpm install
pnpm dev
```

Create a production build with `pnpm build`.

For Supabase Auth, copy `.env.example` to `.env.local` and set the public
Supabase URL and `VITE_SUPABASE_PUBLISHABLE_KEY`. Enable the email/password,
phone/OTP, Google, and Apple providers you intend to offer in Supabase; OAuth
providers also require their callback URLs and credentials to be configured
there. In `apps/api/.env`, set the matching `SUPABASE_URL` and
`SUPABASE_PUBLISHABLE_KEY`. The publishable key is designed for client use;
never put database passwords or the Supabase secret key in Vite.

Password recovery redirects to `/consumer/login` and requires the web app URL
to be allowed by the Supabase Auth redirect URL settings. Supplier applications
use `POST /v1/provider-applications`; the API creates a provider profile in
review and keeps the account's assigned roles unchanged. Provider role
provisioning still requires a trusted administrative process.

The signup form requires users to read both the Terms & Conditions and Privacy
Policy through to the end and explicitly accept them. Each signup stores the accepted policy versions in Supabase account metadata;
after verification, the authenticated API records each version with a server
timestamp in the OddJobs database. Users with missing or outdated versions
must review and accept the current policies before accessing their workspace.
Apply API migrations before deploying this flow:
`npm --prefix apps/api run db:migrate:deploy`.

Both policy documents are product drafts and require legal/privacy review
before production. Complete the Privacy Policy with OddJobs' legal entity,
privacy contact, hosting regions, retention periods, and complaint process.
When either policy changes, update its version; the app will require
re-acceptance and the API will reject obsolete versions.

Run the API independently from `apps/api` with `npm install`, `docker compose
up -d db`, and `npm run dev`. The web app and API have separate package
manifests, build commands, and runtime configuration.

## Prototype scope and security

Supabase Auth verifies sign-in and the Fastify API verifies access tokens and
returns database-assigned roles. The initial profile bootstrap grants only the
consumer role; elevated roles must be provisioned server-side. Most workspace
screens still display sample content, partly persisted in browser
`localStorage`; do not treat it as real user or business data. M-Pesa payments,
escrow, uploads, exports, moderation actions, and live tracking remain
simulated. Do not enter real identity documents or payment information.

Production use requires a trusted backend to authenticate users and enforce
role-based permissions on every protected operation. Payment credentials and
payment/escrow operations must remain server-side and use a verified payment
provider integration. Add server-side validation, secure session and CSRF
protections where applicable, rate limits, audit logging, and privacy-safe
retention before handling real user data or money. Never put secrets in
browser code or commit them to this repository.
