# OddJobs

OddJobs is a mobile-first React prototype for a marketplace connecting people
with essential service providers in Kenya. It includes consumer, provider,
admin, support, and institutional-partner workspace previews, with sample
Nairobi content and KES pricing.

## Run locally

```sh
pnpm install
pnpm dev
```

Create a production build with `pnpm build`.

## Prototype scope and security

This repository contains a front-end demo, not a production marketplace.
Workspace routes and role switching are client-side previews, not
authentication or authorization. Demo records are stored in browser
`localStorage` and are not protected as confidential data. OTP verification,
M-Pesa payments, escrow, uploads, exports, and moderation actions are
simulated; do not enter real personal, identity, or payment information.

Production use requires a trusted backend to authenticate users and enforce
role-based permissions on every protected operation. Payment credentials and
payment/escrow operations must remain server-side and use a verified payment
provider integration. Add server-side validation, secure session and CSRF
protections where applicable, rate limits, audit logging, and privacy-safe
retention before handling real user data or money. Never put secrets in
browser code or commit them to this repository.
