# OddJobs

OddJobs is a mobile-first marketplace app in phased implementation. The shared
orange-branded login experience supports Supabase password and OTP sign-in,
customer registration, password recovery, and configured Google/Apple OAuth.
Provider accounts can publish up to ten listings before identity approval;
verified providers can publish without a listing cap.
The first live marketplace milestone persists customer jobs and provider quotes,
supports quote acceptance and job completion, and refreshes the relevant
consumer/provider screens through scoped Supabase Realtime subscriptions.
Provider verification now supports private ID uploads and the audited admin
review queue once its migration is applied to the intended development
Supabase project. Messaging, tracking, reviews, support/partner data, and
payments remain prototype or unavailable features.

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
there. The web app returns from Google/Apple OAuth to the site root so that
workspace-specific login paths do not need separate allowlist entries. Add
`http://localhost:8443/` to Supabase Auth's Redirect URLs for local development
and add the deployed web app root URL for production. The OAuth provider must
also be enabled and configured with valid provider credentials in Supabase.
Supabase controls whether a new email account needs confirmation. When signup
returns no session, the app clearly asks the user to verify their email before
signing in. To skip email confirmation in a local-only Supabase project, disable
email confirmation in that project's Auth settings; never do this in production.
A frontend environment flag cannot bypass Supabase confirmation. In
`apps/api/.env`, set the matching `SUPABASE_URL` and
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
consumer role; provider workspace access is activated server-side when an
application is submitted. Most workspace
screens still display sample content, partly persisted in browser
`localStorage`; do not treat it as real user or business data. Before collecting
real identity documents, apply the private verification migration to the
intended development Supabase project and configure `SUPABASE_SECRET_KEY` on
the API service only. M-Pesa payments, escrow, exports, and live tracking
remain simulated. Do not enter real payment information.

The marketplace migration and Realtime policies must first be applied to a
separate development Supabase project. Verify the API and frontend both target
that project before running migrations; do not apply them to the currently
configured shared project. Payments remain disabled: accepting a quote does
not charge users or move funds. Before production, validate role access and
Realtime row policies in staging, then implement the remaining real-data
features and payment safeguards. Never put secrets in browser code or commit
them to this repository.
